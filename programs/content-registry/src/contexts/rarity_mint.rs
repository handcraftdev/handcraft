use anchor_lang::prelude::*;
use switchboard_on_demand::accounts::RandomnessAccountData;

use crate::state::*;
use crate::errors::ContentRegistryError;
use crate::MPL_CORE_ID;

/// Seed for pending mint requests
/// PDA seeds: ["pending_mint", buyer, content]
pub const PENDING_MINT_SEED: &[u8] = b"pending_mint";

/// Pending mint request - stores state between commit and reveal
/// Also acts as escrow vault - payment is held here until reveal
#[account]
#[derive(InitSpace)]
pub struct PendingMint {
    /// Buyer who initiated the mint
    pub buyer: Pubkey,
    /// Content being minted
    pub content: Pubkey,
    /// Creator to receive payment on reveal
    pub creator: Pubkey,
    /// Randomness account to use for rarity
    pub randomness_account: Pubkey,
    /// Slot at which randomness was committed
    pub commit_slot: u64,
    /// Amount paid (held in escrow in this account's lamports)
    pub amount_paid: u64,
    /// Timestamp of request
    pub created_at: i64,
    /// Whether there were existing NFTs at commit time (affects holder reward distribution)
    pub had_existing_nfts: bool,
    // NOTE: Edition number is assigned at reveal time (minted_count + 1)
    // This ensures no gaps in edition numbers if commits are cancelled
}

/// Step 1: Commit to mint with randomness
/// Takes payment and commits to a future slot for randomness
#[derive(Accounts)]
pub struct CommitMint<'info> {
    #[account(
        mut,
        seeds = [ECOSYSTEM_CONFIG_SEED],
        bump
    )]
    pub ecosystem_config: Box<Account<'info, EcosystemConfig>>,

    #[account(mut)]
    pub content: Box<Account<'info, ContentEntry>>,

    #[account(
        seeds = [MINT_CONFIG_SEED, content.key().as_ref()],
        bump
    )]
    pub mint_config: Box<Account<'info, MintConfig>>,

    /// Pending mint request - tracks commit until reveal
    #[account(
        init,
        payer = buyer,
        space = 8 + PendingMint::INIT_SPACE,
        seeds = [PENDING_MINT_SEED, buyer.key().as_ref(), content.key().as_ref()],
        bump
    )]
    pub pending_mint: Box<Account<'info, PendingMint>>,

    /// Content-specific reward pool
    #[account(
        init_if_needed,
        payer = buyer,
        space = 8 + ContentRewardPool::INIT_SPACE,
        seeds = [CONTENT_REWARD_POOL_SEED, content.key().as_ref()],
        bump
    )]
    pub content_reward_pool: Box<Account<'info, ContentRewardPool>>,

    /// CHECK: Switchboard randomness account
    pub randomness_account: AccountInfo<'info>,

    /// CHECK: Creator to receive payment
    #[account(mut, constraint = content.creator == creator.key())]
    pub creator: AccountInfo<'info>,

    /// CHECK: Optional platform wallet for commission
    #[account(mut)]
    pub platform: Option<AccountInfo<'info>>,

    /// CHECK: Ecosystem treasury
    #[account(mut, constraint = ecosystem_config.treasury == treasury.key())]
    pub treasury: AccountInfo<'info>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Step 2: Reveal randomness and complete mint
/// Called after the committed slot has passed and randomness is available
#[derive(Accounts)]
pub struct RevealMint<'info> {
    #[account(
        mut,
        seeds = [ECOSYSTEM_CONFIG_SEED],
        bump
    )]
    pub ecosystem_config: Box<Account<'info, EcosystemConfig>>,

    #[account(mut)]
    pub content: Box<Account<'info, ContentEntry>>,

    #[account(
        seeds = [MINT_CONFIG_SEED, content.key().as_ref()],
        bump
    )]
    pub mint_config: Box<Account<'info, MintConfig>>,

    /// Pending mint to reveal
    #[account(
        mut,
        seeds = [PENDING_MINT_SEED, buyer.key().as_ref(), content.key().as_ref()],
        bump,
        close = buyer
    )]
    pub pending_mint: Box<Account<'info, PendingMint>>,

    /// CHECK: ContentCollection tracker PDA
    #[account(
        seeds = [CONTENT_COLLECTION_SEED, content.key().as_ref()],
        bump
    )]
    pub content_collection: AccountInfo<'info>,

    /// CHECK: The Metaplex Core Collection asset for this content
    #[account(mut)]
    pub collection_asset: AccountInfo<'info>,

    /// Content-specific reward pool
    #[account(
        mut,
        seeds = [CONTENT_REWARD_POOL_SEED, content.key().as_ref()],
        bump
    )]
    pub content_reward_pool: Box<Account<'info, ContentRewardPool>>,

    /// Buyer's wallet state for this content
    #[account(
        init_if_needed,
        payer = buyer,
        space = 8 + WalletContentState::INIT_SPACE,
        seeds = [WALLET_CONTENT_STATE_SEED, buyer.key().as_ref(), content.key().as_ref()],
        bump
    )]
    pub buyer_wallet_state: Box<Account<'info, WalletContentState>>,

    /// Per-NFT reward state with weight
    #[account(
        init,
        payer = buyer,
        space = 8 + NftRewardState::INIT_SPACE,
        seeds = [NFT_REWARD_STATE_SEED, nft_asset.key().as_ref()],
        bump
    )]
    pub nft_reward_state: Box<Account<'info, NftRewardState>>,

    /// NFT rarity state
    #[account(
        init,
        payer = buyer,
        space = 8 + NftRarity::INIT_SPACE,
        seeds = [NFT_RARITY_SEED, nft_asset.key().as_ref()],
        bump
    )]
    pub nft_rarity: Box<Account<'info, NftRarity>>,

    /// CHECK: Switchboard randomness account (same as committed)
    pub randomness_account: AccountInfo<'info>,

    /// CHECK: Creator to receive payment
    #[account(mut, constraint = content.creator == creator.key())]
    pub creator: AccountInfo<'info>,

    /// CHECK: Ecosystem treasury
    #[account(mut, constraint = ecosystem_config.treasury == treasury.key())]
    pub treasury: AccountInfo<'info>,

    /// CHECK: Optional platform wallet for commission
    #[account(mut)]
    pub platform: Option<AccountInfo<'info>>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    /// The NFT asset account (Metaplex Core asset)
    #[account(mut)]
    pub nft_asset: Signer<'info>,

    /// CHECK: Metaplex Core program
    #[account(address = MPL_CORE_ID)]
    pub mpl_core_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

/// Handle commit_mint instruction
pub fn handle_commit_mint(ctx: Context<CommitMint>) -> Result<()> {
    let ecosystem = &ctx.accounts.ecosystem_config;
    let mint_config = &ctx.accounts.mint_config;
    let content_reward_pool = &mut ctx.accounts.content_reward_pool;
    let pending_mint = &mut ctx.accounts.pending_mint;
    let clock = Clock::get()?;
    let timestamp = clock.unix_timestamp;

    // Capture content key before mutable borrow
    let content_key = ctx.accounts.content.key();
    let minted_count = ctx.accounts.content.minted_count;
    let pending_count = ctx.accounts.content.pending_count;

    // Check ecosystem not paused
    require!(!ecosystem.is_paused, ContentRegistryError::EcosystemPaused);

    // Check minting is active and supply available
    // Max supply check uses minted_count + pending_count (includes pending reservations)
    require!(mint_config.is_active, ContentRegistryError::MintingNotActive);
    let total_allocated = minted_count + pending_count;
    require!(
        mint_config.can_mint(total_allocated),
        ContentRegistryError::MaxSupplyReached
    );

    // Parse randomness account to verify it's valid and get commit slot
    let randomness_data = RandomnessAccountData::parse(
        ctx.accounts.randomness_account.data.borrow()
    ).map_err(|_| ContentRegistryError::InvalidRandomnessAccount)?;

    // Verify seed slot hasn't been revealed yet (commit to current slot - 1)
    if randomness_data.seed_slot != clock.slot - 1 {
        return Err(ContentRegistryError::RandomnessAlreadyRevealed.into());
    }

    let price = mint_config.price;
    let has_existing_nfts = content_reward_pool.total_weight > 0;

    // Initialize content reward pool if first mint
    if content_reward_pool.content == Pubkey::default() {
        content_reward_pool.content = content_key;
        content_reward_pool.created_at = timestamp;
    }

    // ESCROW PATTERN: Transfer payment to PendingMint account (escrow)
    // Payment will be distributed on reveal, or refunded on cancel
    if price > 0 {
        let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.buyer.key(),
            &pending_mint.to_account_info().key,
            price,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_ix,
            &[
                ctx.accounts.buyer.to_account_info(),
                pending_mint.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
        msg!("Payment of {} lamports held in escrow", price);
    }

    // Increment pending_count to reserve a slot
    // Edition number is assigned at reveal time (minted_count + 1) to avoid gaps
    ctx.accounts.content.pending_count = pending_count + 1;

    // Store pending mint with escrow info
    // NOTE: Edition number is NOT stored here - it's determined at reveal time
    pending_mint.buyer = ctx.accounts.buyer.key();
    pending_mint.content = content_key;
    pending_mint.creator = ctx.accounts.creator.key();
    pending_mint.randomness_account = ctx.accounts.randomness_account.key();
    pending_mint.commit_slot = clock.slot;
    pending_mint.amount_paid = price;
    pending_mint.created_at = timestamp;
    pending_mint.had_existing_nfts = has_existing_nfts;

    msg!("Mint slot reserved. pending_count: {}, escrow: {} lamports", pending_count + 1, price);

    Ok(())
}

/// Handle reveal_mint instruction
pub fn handle_reveal_mint(ctx: Context<RevealMint>) -> Result<()> {
    let content = &mut ctx.accounts.content;
    let pending_mint = &ctx.accounts.pending_mint;
    let content_reward_pool = &mut ctx.accounts.content_reward_pool;
    let buyer_wallet_state = &mut ctx.accounts.buyer_wallet_state;
    let nft_reward_state = &mut ctx.accounts.nft_reward_state;
    let nft_rarity = &mut ctx.accounts.nft_rarity;
    let clock = Clock::get()?;
    let timestamp = clock.unix_timestamp;

    // Verify randomness account matches what was committed
    require!(
        ctx.accounts.randomness_account.key() == pending_mint.randomness_account,
        ContentRegistryError::InvalidRandomnessAccount
    );

    // Verify collection matches content_collection
    {
        let collection_data = ctx.accounts.content_collection.try_borrow_data()?;
        let content_collection: ContentCollection = ContentCollection::try_deserialize(
            &mut &collection_data[..]
        )?;
        require!(
            content_collection.collection_asset == ctx.accounts.collection_asset.key(),
            ContentRegistryError::ContentMismatch
        );
    }

    // Parse randomness and get revealed value
    let randomness_data = RandomnessAccountData::parse(
        ctx.accounts.randomness_account.data.borrow()
    ).map_err(|_| ContentRegistryError::InvalidRandomnessAccount)?;

    let random_value = randomness_data.get_value(clock.slot)
        .map_err(|_| ContentRegistryError::RandomnessNotResolved)?;

    // Determine rarity from random value
    let rarity = Rarity::from_random(random_value);
    let weight = rarity.weight();

    // Lock content on first reveal (using is_locked flag, not minted_count)
    // minted_count is incremented at commit time to reserve slots
    let is_first_reveal = !content.is_locked;
    if is_first_reveal {
        content.is_locked = true;
        content_reward_pool.reward_per_share = 0;
        content_reward_pool.total_nfts = 0;
        content_reward_pool.total_weight = 0;
        content_reward_pool.total_deposited = 0;
        content_reward_pool.total_claimed = 0;
    }

    // Initialize wallet state if needed
    if buyer_wallet_state.nft_count == 0 {
        buyer_wallet_state.wallet = ctx.accounts.buyer.key();
        buyer_wallet_state.content = content.key();
        buyer_wallet_state.nft_count = 0;
        buyer_wallet_state.reward_debt = 0;
        buyer_wallet_state.created_at = timestamp;
    }

    // Add NFT to wallet state (for UI display)
    buyer_wallet_state.add_nft(content_reward_pool.reward_per_share, timestamp);

    // Initialize per-NFT reward state with weight
    nft_reward_state.nft_asset = ctx.accounts.nft_asset.key();
    nft_reward_state.content = content.key();
    nft_reward_state.reward_debt = weight as u128 * content_reward_pool.reward_per_share;
    nft_reward_state.weight = weight;
    nft_reward_state.created_at = timestamp;

    // Initialize NFT rarity state
    nft_rarity.nft_asset = ctx.accounts.nft_asset.key();
    nft_rarity.content = content.key();
    nft_rarity.rarity = rarity;
    nft_rarity.weight = weight;
    nft_rarity.randomness_account = pending_mint.randomness_account;
    nft_rarity.commit_slot = pending_mint.commit_slot;
    nft_rarity.revealed_at = timestamp;

    // Add NFT weight to pool
    content_reward_pool.add_nft(weight);

    // Update counts: decrement pending_count, increment minted_count
    // Edition number is determined NOW (not at commit time) to avoid gaps
    content.pending_count = content.pending_count.saturating_sub(1);
    content.minted_count += 1;
    let edition_number = content.minted_count;

    // Update ecosystem stats
    let ecosystem_mut = &mut ctx.accounts.ecosystem_config;
    ecosystem_mut.total_nfts_minted += 1;
    if pending_mint.amount_paid > 0 {
        let (_, _, ecosystem_amount, _) = EcosystemConfig::calculate_primary_split(pending_mint.amount_paid);
        ecosystem_mut.total_fees_sol += ecosystem_amount;
    }

    // Create Metaplex Core NFT with rarity metadata
    // Edition number is assigned here at reveal time (sequential, no gaps)
    let nft_name = format!("Handcraft #{} ({})", edition_number, rarity.name());
    let nft_uri = format!("https://ipfs.filebase.io/ipfs/{}", content.metadata_cid);

    // Derive content_collection PDA bump for signing
    let content_key = content.key();
    let (_, content_collection_bump) = Pubkey::find_program_address(
        &[CONTENT_COLLECTION_SEED, content_key.as_ref()],
        ctx.program_id,
    );
    let signer_seeds: &[&[&[u8]]] = &[&[
        CONTENT_COLLECTION_SEED,
        content_key.as_ref(),
        &[content_collection_bump],
    ]];

    crate::create_core_nft(
        &ctx.accounts.mpl_core_program.to_account_info(),
        &ctx.accounts.nft_asset.to_account_info(),
        &ctx.accounts.collection_asset.to_account_info(),
        &ctx.accounts.content_collection.to_account_info(),
        &ctx.accounts.buyer.to_account_info(),
        &ctx.accounts.buyer.to_account_info(),
        &ctx.accounts.system_program.to_account_info(),
        nft_name,
        nft_uri,
        signer_seeds,
    )?;

    // ESCROW DISTRIBUTION: Now that NFT is minted, distribute payment from escrow
    // Payment was stored in PendingMint account lamports at commit time
    let amount_paid = pending_mint.amount_paid;
    if amount_paid > 0 {
        let (creator_amount, platform_amount, ecosystem_amount, holder_reward_amount) =
            EcosystemConfig::calculate_primary_split(amount_paid);

        // For first NFT, holder reward goes to creator
        let final_creator_amount = if !pending_mint.had_existing_nfts {
            creator_amount + holder_reward_amount
        } else {
            creator_amount
        };

        // Get mutable reference to pending_mint lamports
        let pending_mint_info = ctx.accounts.pending_mint.to_account_info();

        // Transfer to creator from escrow
        if final_creator_amount > 0 {
            **pending_mint_info.try_borrow_mut_lamports()? -= final_creator_amount;
            **ctx.accounts.creator.try_borrow_mut_lamports()? += final_creator_amount;
        }

        // Transfer holder reward to pool (if existing NFTs at commit time)
        if pending_mint.had_existing_nfts && holder_reward_amount > 0 {
            **pending_mint_info.try_borrow_mut_lamports()? -= holder_reward_amount;
            **content_reward_pool.to_account_info().try_borrow_mut_lamports()? += holder_reward_amount;

            // Update reward_per_share
            content_reward_pool.add_rewards(holder_reward_amount);
        }

        // Transfer to platform from escrow
        if platform_amount > 0 {
            let platform_target = ctx.accounts.platform.as_ref()
                .map(|p| p.to_account_info())
                .unwrap_or(ctx.accounts.treasury.to_account_info());
            **pending_mint_info.try_borrow_mut_lamports()? -= platform_amount;
            **platform_target.try_borrow_mut_lamports()? += platform_amount;
        }

        // Transfer to treasury from escrow
        if ecosystem_amount > 0 {
            **pending_mint_info.try_borrow_mut_lamports()? -= ecosystem_amount;
            **ctx.accounts.treasury.try_borrow_mut_lamports()? += ecosystem_amount;
        }

        msg!("Payment distributed from escrow: {} lamports", amount_paid);
    }

    // Emit events
    msg!("NFT minted with rarity: {} (weight: {})", rarity.name(), weight);

    // PendingMint account will be closed by Anchor's close constraint
    // Any remaining lamports (rent) go back to buyer

    Ok(())
}

/// Minimum time (in seconds) before a pending mint can be cancelled
/// Set to 10 minutes - oracle should resolve much faster than this
pub const MIN_CANCEL_DELAY_SECONDS: i64 = 600;

/// Cancel an expired pending mint and refund the buyer
/// This can be called if the oracle fails to provide randomness
#[derive(Accounts)]
pub struct CancelExpiredMint<'info> {
    #[account(mut)]
    pub content: Box<Account<'info, ContentEntry>>,

    /// Pending mint to cancel (must be expired)
    #[account(
        mut,
        seeds = [PENDING_MINT_SEED, buyer.key().as_ref(), content.key().as_ref()],
        bump,
        constraint = pending_mint.content == content.key() @ ContentRegistryError::ContentMismatch,
        close = buyer
    )]
    pub pending_mint: Box<Account<'info, PendingMint>>,

    /// Buyer who gets the refund (anyone can call but refund goes to buyer)
    /// CHECK: Buyer must match pending_mint.buyer
    #[account(mut, constraint = pending_mint.buyer == buyer.key() @ ContentRegistryError::Unauthorized)]
    pub buyer: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

/// Handle cancel_expired_mint instruction
pub fn handle_cancel_expired_mint(ctx: Context<CancelExpiredMint>) -> Result<()> {
    let pending_mint = &ctx.accounts.pending_mint;
    let content = &mut ctx.accounts.content;
    let clock = Clock::get()?;

    // Verify enough time has passed (oracle should have resolved by now)
    let elapsed = clock.unix_timestamp - pending_mint.created_at;
    require!(
        elapsed >= MIN_CANCEL_DELAY_SECONDS,
        ContentRegistryError::CancelTooEarly
    );

    let amount_paid = pending_mint.amount_paid;

    // Decrement pending_count to release the reserved slot
    // This is safe because edition numbers are assigned at reveal time (minted_count)
    // Cancelling a pending mint just frees up a slot for someone else to commit
    content.pending_count = content.pending_count.saturating_sub(1);
    msg!("Released pending slot. pending_count: {}, minted_count: {}",
         content.pending_count, content.minted_count);

    // REFUND: Transfer escrowed payment back to buyer
    // The payment is stored in the pending_mint account's lamports
    if amount_paid > 0 {
        let pending_mint_info = ctx.accounts.pending_mint.to_account_info();
        **pending_mint_info.try_borrow_mut_lamports()? -= amount_paid;
        **ctx.accounts.buyer.try_borrow_mut_lamports()? += amount_paid;
        msg!("Refunded {} lamports to buyer", amount_paid);
    }

    msg!("Cancelled expired pending mint. Slot released for reuse.");

    // PendingMint account will be closed by Anchor's close constraint
    // Any remaining lamports (rent) go back to buyer

    Ok(())
}
