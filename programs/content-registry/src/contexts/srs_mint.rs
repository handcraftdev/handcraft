use anchor_lang::prelude::*;
use anchor_spl::token::{Token, Mint};
use anchor_spl::associated_token::AssociatedToken;
use solana_randomness_service_lite::{
    SimpleRandomnessV1Request,
    Callback,
    ID as SRS_PROGRAM_ID,
    AccountMetaBorsh,
};

use crate::state::*;
use crate::errors::ContentRegistryError;
use crate::MPL_CORE_ID;

/// Seed for mint requests using SRS callback
/// PDA seeds: ["srs_mint_request", buyer, content]
pub const SRS_MINT_REQUEST_SEED: &[u8] = b"srs_mint_request";

/// Seed for SRS-minted NFT assets (PDA so oracle can create without user signature)
/// PDA seeds: ["srs_nft", mint_request]
pub const SRS_NFT_SEED: &[u8] = b"srs_nft";

/// SRS Program ID: RANDMo5gFnqnXJW5Z52KNmd24sAo95KAd5VbiCtq5Rh
pub const SRS_ID: Pubkey = SRS_PROGRAM_ID;

/// Mint request - tracks state until oracle callback completes the mint
/// Payment is held in escrow until fulfillment or cancellation
#[account]
#[derive(InitSpace)]
pub struct SrsMintRequest {
    /// Buyer who initiated the mint
    pub buyer: Pubkey,
    /// Content being minted
    pub content: Pubkey,
    /// Creator to receive payment on completion
    pub creator: Pubkey,
    /// Amount paid (held in escrow in this account's lamports)
    pub amount_paid: u64,
    /// Timestamp of request
    pub created_at: i64,
    /// Whether there were existing NFTs at request time
    pub had_existing_nfts: bool,
    /// Bump for MintRequest PDA derivation
    pub bump: u8,
    /// Bump for NFT asset PDA derivation
    pub nft_bump: u8,
    /// Whether oracle has fulfilled (minted the NFT)
    pub is_fulfilled: bool,
    /// Platform wallet to receive commission
    pub platform: Pubkey,
    /// Collection asset address (stored for callback)
    pub collection_asset: Pubkey,
    /// Treasury address (stored for callback)
    pub treasury: Pubkey,
}

// ============================================================================
// REQUEST MINT - Single user transaction
// ============================================================================

/// Request a mint with SRS randomness - SINGLE USER TRANSACTION
/// Oracle callback will complete the mint automatically
#[derive(Accounts)]
pub struct SrsRequestMint<'info> {
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

    /// Mint request PDA - stores all info needed for callback
    #[account(
        init,
        payer = payer,
        space = 8 + SrsMintRequest::INIT_SPACE,
        seeds = [SRS_MINT_REQUEST_SEED, payer.key().as_ref(), content.key().as_ref()],
        bump
    )]
    pub mint_request: Box<Account<'info, SrsMintRequest>>,

    /// Content-specific reward pool
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + ContentRewardPool::INIT_SPACE,
        seeds = [CONTENT_REWARD_POOL_SEED, content.key().as_ref()],
        bump
    )]
    pub content_reward_pool: Box<Account<'info, ContentRewardPool>>,

    /// CHECK: ContentCollection tracker PDA
    #[account(
        seeds = [CONTENT_COLLECTION_SEED, content.key().as_ref()],
        bump
    )]
    pub content_collection: AccountInfo<'info>,

    /// CHECK: The Metaplex Core Collection asset
    pub collection_asset: AccountInfo<'info>,

    /// CHECK: Creator to receive payment
    #[account(constraint = content.creator == creator.key())]
    pub creator: AccountInfo<'info>,

    /// CHECK: Ecosystem treasury
    #[account(constraint = ecosystem_config.treasury == treasury.key())]
    pub treasury: AccountInfo<'info>,

    /// CHECK: Optional platform wallet for commission
    pub platform: Option<AccountInfo<'info>>,

    // === Accounts pre-created for callback (user pays) ===

    /// Buyer's wallet state - created now so callback doesn't need to init
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + WalletContentState::INIT_SPACE,
        seeds = [WALLET_CONTENT_STATE_SEED, payer.key().as_ref(), content.key().as_ref()],
        bump
    )]
    pub buyer_wallet_state: Box<Account<'info, WalletContentState>>,

    /// CHECK: NFT asset PDA - needed for deriving reward/rarity accounts
    /// Will be created by Metaplex Core in callback
    #[account(
        seeds = [SRS_NFT_SEED, mint_request.key().as_ref()],
        bump
    )]
    pub nft_asset: AccountInfo<'info>,

    /// Per-NFT reward state - created now so callback doesn't need to init
    #[account(
        init,
        payer = payer,
        space = 8 + NftRewardState::INIT_SPACE,
        seeds = [NFT_REWARD_STATE_SEED, nft_asset.key().as_ref()],
        bump
    )]
    pub nft_reward_state: Box<Account<'info, NftRewardState>>,

    /// NFT rarity state - created now so callback doesn't need to init
    #[account(
        init,
        payer = payer,
        space = 8 + NftRarity::INIT_SPACE,
        seeds = [NFT_RARITY_SEED, nft_asset.key().as_ref()],
        bump
    )]
    pub nft_rarity: Box<Account<'info, NftRarity>>,

    // === Switchboard Randomness Service accounts ===
    /// CHECK: The SRS program
    #[account(address = SRS_ID)]
    pub srs_program: AccountInfo<'info>,

    /// CHECK: New randomness request account (signer keypair)
    #[account(mut)]
    pub randomness_request: Signer<'info>,

    /// CHECK: Escrow token account for SRS fee
    #[account(mut)]
    pub randomness_escrow: AccountInfo<'info>,

    /// CHECK: SRS state PDA (seeds = ["STATE"], program = SRS_ID)
    pub srs_state: AccountInfo<'info>,

    /// Native SOL mint (for wrapped SOL)
    pub native_mint: Account<'info, Mint>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

// ============================================================================
// FULFILL MINT - Oracle callback (no user signature needed!)
// ============================================================================

/// Oracle callback to fulfill mint with randomness
/// This creates the NFT and distributes payment - NO USER SIGNATURE
#[derive(Accounts)]
pub struct SrsFulfillMint<'info> {
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

    /// Mint request being fulfilled
    #[account(
        mut,
        seeds = [SRS_MINT_REQUEST_SEED, mint_request.buyer.as_ref(), content.key().as_ref()],
        bump = mint_request.bump,
        constraint = mint_request.content == content.key() @ ContentRegistryError::ContentMismatch,
        constraint = !mint_request.is_fulfilled @ ContentRegistryError::AlreadyFulfilled,
    )]
    pub mint_request: Box<Account<'info, SrsMintRequest>>,

    /// CHECK: ContentCollection tracker PDA
    #[account(
        seeds = [CONTENT_COLLECTION_SEED, content.key().as_ref()],
        bump
    )]
    pub content_collection: AccountInfo<'info>,

    /// CHECK: The Metaplex Core Collection asset
    #[account(
        mut,
        constraint = mint_request.collection_asset == collection_asset.key() @ ContentRegistryError::ContentMismatch
    )]
    pub collection_asset: AccountInfo<'info>,

    /// Content-specific reward pool
    #[account(
        mut,
        seeds = [CONTENT_REWARD_POOL_SEED, content.key().as_ref()],
        bump
    )]
    pub content_reward_pool: Box<Account<'info, ContentRewardPool>>,

    /// Buyer's wallet state for this content (created in SrsRequestMint)
    #[account(
        mut,
        seeds = [WALLET_CONTENT_STATE_SEED, mint_request.buyer.as_ref(), content.key().as_ref()],
        bump
    )]
    pub buyer_wallet_state: Box<Account<'info, WalletContentState>>,

    /// NFT asset - PDA derived from mint_request (no signer needed!)
    /// CHECK: Will be created by Metaplex Core
    #[account(
        mut,
        seeds = [SRS_NFT_SEED, mint_request.key().as_ref()],
        bump
    )]
    pub nft_asset: AccountInfo<'info>,

    /// Per-NFT reward state with weight (created in SrsRequestMint)
    #[account(
        mut,
        seeds = [NFT_REWARD_STATE_SEED, nft_asset.key().as_ref()],
        bump
    )]
    pub nft_reward_state: Box<Account<'info, NftRewardState>>,

    /// NFT rarity state (created in SrsRequestMint)
    #[account(
        mut,
        seeds = [NFT_RARITY_SEED, nft_asset.key().as_ref()],
        bump
    )]
    pub nft_rarity: Box<Account<'info, NftRarity>>,

    /// CHECK: Creator to receive payment
    #[account(mut, constraint = content.creator == creator.key())]
    pub creator: AccountInfo<'info>,

    /// CHECK: Ecosystem treasury
    #[account(mut, constraint = mint_request.treasury == treasury.key())]
    pub treasury: AccountInfo<'info>,

    /// CHECK: Platform wallet for commission
    #[account(mut, constraint = mint_request.platform == platform.key())]
    pub platform: AccountInfo<'info>,

    /// CHECK: Buyer who gets the NFT (not a signer - oracle is calling!)
    #[account(mut, constraint = mint_request.buyer == buyer.key() @ ContentRegistryError::Unauthorized)]
    pub buyer: AccountInfo<'info>,

    /// CHECK: Metaplex Core program
    #[account(address = MPL_CORE_ID)]
    pub mpl_core_program: AccountInfo<'info>,

    /// CHECK: SRS state PDA - this is the SIGNER for the callback!
    /// The SRS service signs with this PDA, not a separate oracle account.
    /// Safety: Verified by seeds constraint matching the SRS program's state PDA.
    #[account(
        signer,
        seeds = [b"STATE"],
        bump,
        seeds::program = SRS_ID
    )]
    pub srs_state: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

// ============================================================================
// CANCEL MINT - User can cancel if oracle fails
// ============================================================================

/// Cancel an unfulfilled mint request and refund the buyer
/// Also closes pre-created accounts (nft_reward_state, nft_rarity)
#[derive(Accounts)]
pub struct SrsCancelMint<'info> {
    #[account(mut)]
    pub content: Box<Account<'info, ContentEntry>>,

    /// Mint request to cancel (must be expired)
    #[account(
        mut,
        seeds = [SRS_MINT_REQUEST_SEED, buyer.key().as_ref(), content.key().as_ref()],
        bump = mint_request.bump,
        constraint = mint_request.content == content.key() @ ContentRegistryError::ContentMismatch,
        close = buyer
    )]
    pub mint_request: Box<Account<'info, SrsMintRequest>>,

    /// CHECK: NFT asset PDA - needed for deriving accounts to close
    #[account(
        seeds = [SRS_NFT_SEED, mint_request.key().as_ref()],
        bump = mint_request.nft_bump
    )]
    pub nft_asset: AccountInfo<'info>,

    /// Per-NFT reward state - close and refund to buyer
    #[account(
        mut,
        seeds = [NFT_REWARD_STATE_SEED, nft_asset.key().as_ref()],
        bump,
        close = buyer
    )]
    pub nft_reward_state: Box<Account<'info, NftRewardState>>,

    /// NFT rarity state - close and refund to buyer
    #[account(
        mut,
        seeds = [NFT_RARITY_SEED, nft_asset.key().as_ref()],
        bump,
        close = buyer
    )]
    pub nft_rarity: Box<Account<'info, NftRarity>>,

    /// Buyer who gets the refund
    #[account(mut, constraint = mint_request.buyer == buyer.key() @ ContentRegistryError::Unauthorized)]
    pub buyer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Minimum time (in seconds) before an unfulfilled request can be cancelled
pub const SRS_MIN_CANCEL_DELAY_SECONDS: i64 = 600; // 10 minutes

// ============================================================================
// CLEANUP ORPHANED ACCOUNTS
// ============================================================================

/// Cleanup orphaned pre-created accounts when mint_request no longer exists
/// This handles the case where a cancel happened but left orphaned accounts
#[derive(Accounts)]
pub struct SrsCleanupOrphaned<'info> {
    #[account(mut)]
    pub content: Box<Account<'info, ContentEntry>>,

    /// CHECK: Mint request PDA - must NOT exist (already closed)
    /// This proves the mint was cancelled and accounts are orphaned
    #[account(
        seeds = [SRS_MINT_REQUEST_SEED, buyer.key().as_ref(), content.key().as_ref()],
        bump
    )]
    pub mint_request_pda: AccountInfo<'info>,

    /// CHECK: NFT asset PDA - derived from the (non-existent) mint request
    pub nft_asset: AccountInfo<'info>,

    /// Per-NFT reward state - close and refund to buyer
    #[account(
        mut,
        seeds = [NFT_REWARD_STATE_SEED, nft_asset.key().as_ref()],
        bump,
        close = buyer
    )]
    pub nft_reward_state: Box<Account<'info, NftRewardState>>,

    /// NFT rarity state - close and refund to buyer
    #[account(
        mut,
        seeds = [NFT_RARITY_SEED, nft_asset.key().as_ref()],
        bump,
        close = buyer
    )]
    pub nft_rarity: Box<Account<'info, NftRarity>>,

    /// Buyer who gets the refund (must be the original creator of these accounts)
    #[account(mut)]
    pub buyer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

// ============================================================================
// INSTRUCTION HANDLERS
// ============================================================================

/// Handle srs_request_mint - SINGLE USER TRANSACTION
pub fn handle_srs_request_mint(ctx: Context<SrsRequestMint>) -> Result<()> {
    let ecosystem = &ctx.accounts.ecosystem_config;
    let mint_config = &ctx.accounts.mint_config;
    let content_reward_pool = &mut ctx.accounts.content_reward_pool;
    let mint_request = &mut ctx.accounts.mint_request;
    let clock = Clock::get()?;
    let timestamp = clock.unix_timestamp;

    let content_key = ctx.accounts.content.key();
    let minted_count = ctx.accounts.content.minted_count;
    let pending_count = ctx.accounts.content.pending_count;

    // Check ecosystem not paused
    require!(!ecosystem.is_paused, ContentRegistryError::EcosystemPaused);

    // Check minting is active and supply available
    require!(mint_config.is_active, ContentRegistryError::MintingNotActive);
    let total_allocated = minted_count + pending_count;
    require!(
        mint_config.can_mint(total_allocated),
        ContentRegistryError::MaxSupplyReached
    );

    let price = mint_config.price;
    let has_existing_nfts = content_reward_pool.total_weight > 0;

    // Initialize content reward pool if first mint
    if content_reward_pool.content == Pubkey::default() {
        content_reward_pool.content = content_key;
        content_reward_pool.created_at = timestamp;
    }

    // Get bumps
    let mint_request_bump = ctx.bumps.mint_request;

    // Derive NFT asset PDA
    let (nft_asset_pda, nft_bump) = Pubkey::find_program_address(
        &[SRS_NFT_SEED, mint_request.key().as_ref()],
        ctx.program_id,
    );

    // Get platform wallet (fallback to treasury if not provided)
    let platform_key = ctx.accounts.platform.as_ref()
        .map(|p| p.key())
        .unwrap_or(ecosystem.treasury);

    // Store mint request data (needed for callback)
    mint_request.buyer = ctx.accounts.payer.key();
    mint_request.content = content_key;
    mint_request.creator = ctx.accounts.creator.key();
    mint_request.amount_paid = price;
    mint_request.created_at = timestamp;
    mint_request.had_existing_nfts = has_existing_nfts;
    mint_request.bump = mint_request_bump;
    mint_request.nft_bump = nft_bump;
    mint_request.is_fulfilled = false;
    mint_request.platform = platform_key;
    mint_request.collection_asset = ctx.accounts.collection_asset.key();
    mint_request.treasury = ctx.accounts.treasury.key();

    // ESCROW: Transfer payment to MintRequest account
    if price > 0 {
        let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.payer.key(),
            &mint_request.to_account_info().key,
            price,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_ix,
            &[
                ctx.accounts.payer.to_account_info(),
                mint_request.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
        msg!("Payment of {} lamports held in escrow", price);
    }

    // Increment pending_count to reserve a slot
    ctx.accounts.content.pending_count = pending_count + 1;

    // Build callback for SRS - includes ALL accounts for srs_fulfill_mint
    // Note: accounts are pre-created in this instruction, so callback just updates them
    let callback = Callback {
        program_id: crate::ID,
        accounts: vec![
            // 0: ecosystem_config (mut)
            AccountMetaBorsh { pubkey: ctx.accounts.ecosystem_config.key(), is_signer: false, is_writable: true },
            // 1: content (mut)
            AccountMetaBorsh { pubkey: content_key, is_signer: false, is_writable: true },
            // 2: mint_config
            AccountMetaBorsh { pubkey: ctx.accounts.mint_config.key(), is_signer: false, is_writable: false },
            // 3: mint_request (mut)
            AccountMetaBorsh { pubkey: mint_request.key(), is_signer: false, is_writable: true },
            // 4: content_collection
            AccountMetaBorsh { pubkey: ctx.accounts.content_collection.key(), is_signer: false, is_writable: false },
            // 5: collection_asset (mut)
            AccountMetaBorsh { pubkey: ctx.accounts.collection_asset.key(), is_signer: false, is_writable: true },
            // 6: content_reward_pool (mut)
            AccountMetaBorsh { pubkey: ctx.accounts.content_reward_pool.key(), is_signer: false, is_writable: true },
            // 7: buyer_wallet_state (mut) - pre-created
            AccountMetaBorsh { pubkey: ctx.accounts.buyer_wallet_state.key(), is_signer: false, is_writable: true },
            // 8: nft_asset (mut) - PDA, will be created by Metaplex
            AccountMetaBorsh { pubkey: nft_asset_pda, is_signer: false, is_writable: true },
            // 9: nft_reward_state (mut) - pre-created
            AccountMetaBorsh { pubkey: ctx.accounts.nft_reward_state.key(), is_signer: false, is_writable: true },
            // 10: nft_rarity (mut) - pre-created
            AccountMetaBorsh { pubkey: ctx.accounts.nft_rarity.key(), is_signer: false, is_writable: true },
            // 11: creator (mut)
            AccountMetaBorsh { pubkey: ctx.accounts.creator.key(), is_signer: false, is_writable: true },
            // 12: treasury (mut)
            AccountMetaBorsh { pubkey: ctx.accounts.treasury.key(), is_signer: false, is_writable: true },
            // 13: platform (mut)
            AccountMetaBorsh { pubkey: platform_key, is_signer: false, is_writable: true },
            // 14: buyer (mut) - not a signer in callback
            AccountMetaBorsh { pubkey: ctx.accounts.payer.key(), is_signer: false, is_writable: true },
            // 15: mpl_core_program
            AccountMetaBorsh { pubkey: MPL_CORE_ID, is_signer: false, is_writable: false },
            // 16: srs_state (signer, readonly) - SRS State PDA signs the callback
            AccountMetaBorsh { pubkey: ctx.accounts.srs_state.key(), is_signer: true, is_writable: false },
            // 17: system_program
            AccountMetaBorsh { pubkey: ctx.accounts.system_program.key(), is_signer: false, is_writable: false },
        ],
        // Discriminator for srs_fulfill_mint instruction
        ix_data: get_srs_fulfill_mint_discriminator().to_vec(),
    };

    // Create the randomness request using the lite crate
    let request = SimpleRandomnessV1Request {
        request: ctx.accounts.randomness_request.to_account_info(),
        escrow: ctx.accounts.randomness_escrow.to_account_info(),
        state: ctx.accounts.srs_state.to_account_info(),
        mint: ctx.accounts.native_mint.to_account_info(),
        payer: ctx.accounts.payer.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
        token_program: ctx.accounts.token_program.to_account_info(),
        associated_token_program: ctx.accounts.associated_token_program.to_account_info(),
    };

    // Request 32 bytes of randomness with VERY HIGH priority fee to rule out fee issues
    // Fee calculation: compute_units * compute_unit_price / 1,000,000 = lamports
    // With 1,000,000 CU and 1,000,000,000 micro-lamports = 1,000,000,000 lamports = 1 SOL
    use solana_randomness_service_lite::TransactionOptions;
    let tx_options = TransactionOptions {
        compute_units: Some(1_000_000),
        compute_unit_price: Some(1_000_000_000), // 1B micro-lamports = 1 SOL oracle fee
    };

    request.invoke(
        ctx.accounts.srs_program.to_account_info(),
        32, // num_bytes
        &callback,
        &Some(tx_options),
    )?;

    msg!("SRS mint requested. NFT will be minted automatically by oracle callback.");
    msg!("NFT asset PDA: {}", nft_asset_pda);

    Ok(())
}

/// Get the discriminator for srs_fulfill_mint instruction
fn get_srs_fulfill_mint_discriminator() -> [u8; 8] {
    use solana_sha256_hasher::hashv;
    let preimage = format!("global:{}", "srs_fulfill_mint");
    let hash = hashv(&[preimage.as_bytes()]);
    let mut discriminator = [0u8; 8];
    discriminator.copy_from_slice(&hash.to_bytes()[..8]);
    discriminator
}

/// Handle srs_fulfill_mint - Oracle callback that mints the NFT
pub fn handle_srs_fulfill_mint(ctx: Context<SrsFulfillMint>, randomness: [u8; 32]) -> Result<()> {
    // Capture AccountInfo for CPI before mutable borrows
    let mint_request_info = ctx.accounts.mint_request.to_account_info();

    let content = &mut ctx.accounts.content;
    let mint_request = &mut ctx.accounts.mint_request;
    let content_reward_pool = &mut ctx.accounts.content_reward_pool;
    let buyer_wallet_state = &mut ctx.accounts.buyer_wallet_state;
    let nft_reward_state = &mut ctx.accounts.nft_reward_state;
    let nft_rarity = &mut ctx.accounts.nft_rarity;
    let clock = Clock::get()?;
    let timestamp = clock.unix_timestamp;

    // Mark as fulfilled first to prevent re-entry
    mint_request.is_fulfilled = true;

    // Verify collection matches
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

    // Determine rarity from randomness
    let rarity = Rarity::from_random(randomness);
    let weight = rarity.weight();

    // Lock content on first mint
    let is_first_mint = !content.is_locked;
    if is_first_mint {
        content.is_locked = true;
        content_reward_pool.reward_per_share = 0;
        content_reward_pool.total_nfts = 0;
        content_reward_pool.total_weight = 0;
        content_reward_pool.total_deposited = 0;
        content_reward_pool.total_claimed = 0;
    }

    // Initialize wallet state if needed
    if buyer_wallet_state.nft_count == 0 {
        buyer_wallet_state.wallet = mint_request.buyer;
        buyer_wallet_state.content = content.key();
        buyer_wallet_state.nft_count = 0;
        buyer_wallet_state.reward_debt = 0;
        buyer_wallet_state.created_at = timestamp;
    }

    // Add NFT to wallet state
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
    nft_rarity.randomness_account = Pubkey::default();
    nft_rarity.commit_slot = 0;
    nft_rarity.revealed_at = timestamp;

    // Add NFT weight to pool
    content_reward_pool.add_nft(weight);

    // Update counts
    content.pending_count = content.pending_count.saturating_sub(1);
    content.minted_count += 1;
    let edition_number = content.minted_count;

    // Update ecosystem stats
    let ecosystem_mut = &mut ctx.accounts.ecosystem_config;
    if mint_request.amount_paid > 0 {
        let (_, _, ecosystem_amount, _) = EcosystemConfig::calculate_primary_split(mint_request.amount_paid);
        ecosystem_mut.total_fees_sol += ecosystem_amount;
    }
    ecosystem_mut.total_nfts_minted += 1;

    // Create Metaplex Core NFT with rarity metadata
    // Use PDA signing for both content_collection (authority) and nft_asset
    let nft_name = format!("Handcraft #{} ({})", edition_number, rarity.name());
    let nft_uri = format!("https://ipfs.filebase.io/ipfs/{}", content.metadata_cid);

    let content_key = content.key();
    let mint_request_key = mint_request.key();

    let (_, content_collection_bump) = Pubkey::find_program_address(
        &[CONTENT_COLLECTION_SEED, content_key.as_ref()],
        ctx.program_id,
    );

    // We need the buyer key for mint_request PDA derivation
    let buyer_key = mint_request.buyer;

    // Sign for content_collection (authority), nft_asset, and mint_request (payer)
    let signer_seeds: &[&[&[u8]]] = &[
        &[CONTENT_COLLECTION_SEED, content_key.as_ref(), &[content_collection_bump]],
        &[SRS_NFT_SEED, mint_request_key.as_ref(), &[mint_request.nft_bump]],
        &[SRS_MINT_REQUEST_SEED, buyer_key.as_ref(), content_key.as_ref(), &[mint_request.bump]],
    ];

    // Use mint_request escrow to pay for NFT creation (it holds the escrowed mint price)
    crate::create_core_nft(
        &ctx.accounts.mpl_core_program.to_account_info(),
        &ctx.accounts.nft_asset.to_account_info(),
        &ctx.accounts.collection_asset.to_account_info(),
        &ctx.accounts.content_collection.to_account_info(),
        &ctx.accounts.buyer.to_account_info(),
        &mint_request_info, // Escrow pays for NFT creation
        &ctx.accounts.system_program.to_account_info(),
        nft_name,
        nft_uri,
        signer_seeds,
    )?;

    // Distribute payment from escrow
    let amount_paid = mint_request.amount_paid;
    if amount_paid > 0 {
        let (creator_amount, platform_amount, ecosystem_amount, holder_reward_amount) =
            EcosystemConfig::calculate_primary_split(amount_paid);

        let final_creator_amount = if !mint_request.had_existing_nfts {
            creator_amount + holder_reward_amount
        } else {
            creator_amount
        };

        // Transfer to creator from escrow (using mint_request_info captured earlier)
        if final_creator_amount > 0 {
            **mint_request_info.try_borrow_mut_lamports()? -= final_creator_amount;
            **ctx.accounts.creator.try_borrow_mut_lamports()? += final_creator_amount;
        }

        // Transfer holder reward to pool
        if mint_request.had_existing_nfts && holder_reward_amount > 0 {
            **mint_request_info.try_borrow_mut_lamports()? -= holder_reward_amount;
            **content_reward_pool.to_account_info().try_borrow_mut_lamports()? += holder_reward_amount;
            content_reward_pool.add_rewards(holder_reward_amount);
        }

        // Transfer to platform
        if platform_amount > 0 {
            **mint_request_info.try_borrow_mut_lamports()? -= platform_amount;
            **ctx.accounts.platform.try_borrow_mut_lamports()? += platform_amount;
        }

        // Transfer to treasury
        if ecosystem_amount > 0 {
            **mint_request_info.try_borrow_mut_lamports()? -= ecosystem_amount;
            **ctx.accounts.treasury.try_borrow_mut_lamports()? += ecosystem_amount;
        }

        msg!("Payment distributed from escrow: {} lamports", amount_paid);
    }

    msg!("NFT minted via SRS callback! Rarity: {} (weight: {})", rarity.name(), weight);

    Ok(())
}

/// Handle srs_cancel_mint instruction
pub fn handle_srs_cancel_mint(ctx: Context<SrsCancelMint>) -> Result<()> {
    let mint_request = &ctx.accounts.mint_request;
    let content = &mut ctx.accounts.content;
    let clock = Clock::get()?;

    // Verify enough time has passed
    let elapsed = clock.unix_timestamp - mint_request.created_at;
    require!(
        elapsed >= SRS_MIN_CANCEL_DELAY_SECONDS,
        ContentRegistryError::CancelTooEarly
    );

    // Verify not already fulfilled
    require!(
        !mint_request.is_fulfilled,
        ContentRegistryError::AlreadyFulfilled
    );

    let amount_paid = mint_request.amount_paid;

    // Release the reserved slot
    content.pending_count = content.pending_count.saturating_sub(1);

    // Refund escrowed payment (happens via close = buyer)
    // Pre-created accounts (nft_reward_state, nft_rarity) are also closed via close = buyer
    msg!("Cancelled SRS mint request. Refunded {} lamports to buyer", amount_paid);

    Ok(())
}

/// Handle cleanup of orphaned accounts when mint_request was already closed
pub fn handle_srs_cleanup_orphaned(ctx: Context<SrsCleanupOrphaned>) -> Result<()> {
    // Verify mint_request doesn't exist (data length should be 0)
    require!(
        ctx.accounts.mint_request_pda.data_is_empty(),
        ContentRegistryError::InvalidState
    );

    // Verify nft_asset PDA is correct (derived from mint_request_pda)
    let expected_nft_asset = Pubkey::find_program_address(
        &[SRS_NFT_SEED, ctx.accounts.mint_request_pda.key().as_ref()],
        ctx.program_id,
    ).0;
    require!(
        ctx.accounts.nft_asset.key() == expected_nft_asset,
        ContentRegistryError::InvalidState
    );

    // Accounts are closed via close = buyer in the struct
    msg!("Cleaned up orphaned SRS mint accounts");

    Ok(())
}
