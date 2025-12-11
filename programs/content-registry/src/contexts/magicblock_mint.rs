use anchor_lang::prelude::*;
use ephemeral_vrf_sdk::anchor::vrf;
use ephemeral_vrf_sdk::instructions::{create_request_randomness_ix, RequestRandomnessParams};
use ephemeral_vrf_sdk::types::SerializableAccountMeta;
use mpl_core::instructions::CreateV2CpiBuilder;

use crate::state::*;
use crate::errors::ContentRegistryError;
use crate::instruction;
use crate::MPL_CORE_ID;

/// Seed for MagicBlock mint requests
/// PDA seeds: ["mb_mint_request", buyer, content]
pub const MB_MINT_REQUEST_SEED: &[u8] = b"mb_mint_request";

/// Seed for MagicBlock-minted NFT assets
/// PDA seeds: ["mb_nft", mint_request]
pub const MB_NFT_SEED: &[u8] = b"mb_nft";

/// MagicBlock Mint request - tracks state until oracle callback completes
#[account]
#[derive(InitSpace)]
pub struct MagicBlockMintRequest {
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
    /// Collection asset address (stored for callback)
    pub collection_asset: Pubkey,
    /// Treasury address (stored for callback)
    pub treasury: Pubkey,
    /// Platform wallet for commission
    pub platform: Pubkey,
    /// Content collection bump for signing
    pub content_collection_bump: u8,
    /// Metadata CID for NFT URI
    #[max_len(64)]
    pub metadata_cid: String,
    /// Current minted count at request time (for edition number)
    pub minted_count: u64,
    /// Edition number used in PDA derivation (allows multiple mints per buyer+content)
    pub edition: u64,
}

// ============================================================================
// REQUEST MINT - User's single transaction
// ============================================================================

/// Request a mint with MagicBlock VRF
/// Oracle callback will complete the mint automatically
#[vrf]
#[derive(Accounts)]
#[instruction(edition: u64)]
pub struct MagicBlockRequestMint<'info> {
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
    /// Uses edition number in seeds to allow multiple mints per buyer+content
    #[account(
        init,
        payer = payer,
        space = 8 + MagicBlockMintRequest::INIT_SPACE,
        seeds = [MB_MINT_REQUEST_SEED, payer.key().as_ref(), content.key().as_ref(), &edition.to_le_bytes()],
        bump
    )]
    pub mint_request: Box<Account<'info, MagicBlockMintRequest>>,

    /// Content-specific reward pool
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + ContentRewardPool::INIT_SPACE,
        seeds = [CONTENT_REWARD_POOL_SEED, content.key().as_ref()],
        bump
    )]
    pub content_reward_pool: Box<Account<'info, ContentRewardPool>>,

    /// ContentCollection tracker PDA
    #[account(
        seeds = [CONTENT_COLLECTION_SEED, content.key().as_ref()],
        bump
    )]
    pub content_collection: Box<Account<'info, ContentCollection>>,

    /// CHECK: The Metaplex Core Collection asset
    #[account(mut)]
    pub collection_asset: AccountInfo<'info>,

    /// CHECK: Creator to receive payment
    #[account(mut, constraint = content.creator == creator.key())]
    pub creator: AccountInfo<'info>,

    /// CHECK: Ecosystem treasury
    #[account(mut, constraint = ecosystem_config.treasury == treasury.key())]
    pub treasury: AccountInfo<'info>,

    /// CHECK: Optional platform wallet for commission
    #[account(mut)]
    pub platform: Option<AccountInfo<'info>>,

    /// Buyer's wallet state for tracking NFT ownership
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + WalletContentState::INIT_SPACE,
        seeds = [WALLET_CONTENT_STATE_SEED, payer.key().as_ref(), content.key().as_ref()],
        bump
    )]
    pub buyer_wallet_state: Box<Account<'info, WalletContentState>>,

    /// CHECK: NFT asset - will be created in callback
    #[account(
        mut,
        seeds = [MB_NFT_SEED, mint_request.key().as_ref()],
        bump
    )]
    pub nft_asset: AccountInfo<'info>,

    /// NFT reward state - created now so callback doesn't need to init
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

    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: MagicBlock VRF oracle queue
    #[account(mut)]
    pub oracle_queue: AccountInfo<'info>,

    // Note: system_program, vrf_program, slot_hashes, program_identity are added by #[vrf] macro
}

impl<'info> MagicBlockRequestMint<'info> {
    pub fn handler(ctx: Context<MagicBlockRequestMint>, edition: u64) -> Result<()> {
        let clock = Clock::get()?;

        // Capture ALL keys upfront before any mutable borrows
        let mint_request_key = ctx.accounts.mint_request.key();
        let content_key = ctx.accounts.content.key();
        let payer_key = ctx.accounts.payer.key();
        let nft_asset_key = ctx.accounts.nft_asset.key();
        let nft_rarity_key = ctx.accounts.nft_rarity.key();
        let nft_reward_state_key = ctx.accounts.nft_reward_state.key();
        let content_collection_key = ctx.accounts.content_collection.key();
        let collection_asset_key = ctx.accounts.collection_asset.key();
        let creator_key = ctx.accounts.creator.key();
        let treasury_key = ctx.accounts.treasury.key();
        let oracle_queue_key = ctx.accounts.oracle_queue.key();
        let platform_key = ctx.accounts.platform.as_ref().map(|p| p.key()).unwrap_or(ctx.accounts.ecosystem_config.treasury);
        let content_reward_pool_key = ctx.accounts.content_reward_pool.key();

        // Check minting is enabled (read-only checks)
        require!(ctx.accounts.mint_config.is_active, ContentRegistryError::MintingNotActive);
        require!(!ctx.accounts.ecosystem_config.is_paused, ContentRegistryError::EcosystemPaused);

        // Check max supply
        let total_minted_or_pending = ctx.accounts.content.minted_count.saturating_add(ctx.accounts.content.pending_count);
        if let Some(max_supply) = ctx.accounts.mint_config.max_supply {
            require!(total_minted_or_pending < max_supply, ContentRegistryError::MaxSupplyReached);
        }

        // Calculate payment
        let mint_price = ctx.accounts.mint_config.price;
        // Use total_weight > 0 to check for existing NFTs (consistent with mint_nft_sol)
        let had_existing_nfts = ctx.accounts.content_reward_pool.total_weight > 0;
        let content_creator = ctx.accounts.content.creator;
        let metadata_cid = ctx.accounts.content.metadata_cid.clone();
        let minted_count = ctx.accounts.content.minted_count;

        // Store in request for callback
        ctx.accounts.mint_request.buyer = payer_key;
        ctx.accounts.mint_request.content = content_key;
        ctx.accounts.mint_request.creator = content_creator;
        ctx.accounts.mint_request.amount_paid = mint_price;
        ctx.accounts.mint_request.created_at = clock.unix_timestamp;
        ctx.accounts.mint_request.had_existing_nfts = had_existing_nfts;
        ctx.accounts.mint_request.bump = ctx.bumps.mint_request;
        ctx.accounts.mint_request.nft_bump = ctx.bumps.nft_asset;
        ctx.accounts.mint_request.is_fulfilled = false;
        ctx.accounts.mint_request.collection_asset = collection_asset_key;
        ctx.accounts.mint_request.treasury = treasury_key;
        ctx.accounts.mint_request.platform = platform_key;
        ctx.accounts.mint_request.content_collection_bump = ctx.bumps.content_collection;
        ctx.accounts.mint_request.metadata_cid = metadata_cid;
        ctx.accounts.mint_request.minted_count = minted_count;
        ctx.accounts.mint_request.edition = edition;

        // Initialize NFT reward state
        ctx.accounts.nft_reward_state.nft_asset = nft_asset_key;
        ctx.accounts.nft_reward_state.content = content_key;
        ctx.accounts.nft_reward_state.reward_debt = 0;
        ctx.accounts.nft_reward_state.weight = 1; // Default Common weight, will be updated in callback
        ctx.accounts.nft_reward_state.created_at = clock.unix_timestamp;

        // Initialize NFT rarity (will be updated in callback)
        ctx.accounts.nft_rarity.nft_asset = nft_asset_key;
        ctx.accounts.nft_rarity.rarity = Rarity::Common; // Placeholder, callback will set
        ctx.accounts.nft_rarity.weight = 1; // Default Common weight

        // Initialize content reward pool if needed
        if ctx.accounts.content_reward_pool.content == Pubkey::default() {
            ctx.accounts.content_reward_pool.content = content_key;
            ctx.accounts.content_reward_pool.total_deposited = 0;
            ctx.accounts.content_reward_pool.total_claimed = 0;
        }

        // Initialize buyer wallet state if needed (for reward claiming)
        if ctx.accounts.buyer_wallet_state.content == Pubkey::default() {
            ctx.accounts.buyer_wallet_state.wallet = payer_key;
            ctx.accounts.buyer_wallet_state.content = content_key;
            ctx.accounts.buyer_wallet_state.nft_count = 0;
            ctx.accounts.buyer_wallet_state.updated_at = clock.unix_timestamp;
        }

        // Transfer mint price to mint_request (escrow)
        if mint_price > 0 {
            anchor_lang::system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    anchor_lang::system_program::Transfer {
                        from: ctx.accounts.payer.to_account_info(),
                        to: ctx.accounts.mint_request.to_account_info(),
                    },
                ),
                mint_price,
            )?;
            msg!("Payment of {} lamports held in escrow", mint_price);
        }

        // Increment pending count
        ctx.accounts.content.pending_count = ctx.accounts.content.pending_count.saturating_add(1);

        // Build callback accounts - MagicBlock uses SerializableAccountMeta (much smaller than ORAO!)
        let callback_accounts = vec![
            SerializableAccountMeta { pubkey: mint_request_key, is_signer: false, is_writable: true },
            SerializableAccountMeta { pubkey: content_key, is_signer: false, is_writable: true },
            SerializableAccountMeta { pubkey: content_collection_key, is_signer: false, is_writable: false },
            SerializableAccountMeta { pubkey: collection_asset_key, is_signer: false, is_writable: true },
            SerializableAccountMeta { pubkey: nft_asset_key, is_signer: false, is_writable: true },
            SerializableAccountMeta { pubkey: nft_rarity_key, is_signer: false, is_writable: true },
            SerializableAccountMeta { pubkey: nft_reward_state_key, is_signer: false, is_writable: true },
            SerializableAccountMeta { pubkey: payer_key, is_signer: false, is_writable: true },
            SerializableAccountMeta { pubkey: creator_key, is_signer: false, is_writable: true },
            SerializableAccountMeta { pubkey: treasury_key, is_signer: false, is_writable: true },
            SerializableAccountMeta { pubkey: platform_key, is_signer: false, is_writable: true },
            SerializableAccountMeta { pubkey: content_reward_pool_key, is_signer: false, is_writable: true },
            SerializableAccountMeta { pubkey: MPL_CORE_ID, is_signer: false, is_writable: false },
            SerializableAccountMeta { pubkey: anchor_lang::system_program::ID, is_signer: false, is_writable: false },
        ];

        // Generate seed from mint request key
        let caller_seed = solana_sha256_hasher::hashv(&[
            b"mb_vrf_seed",
            mint_request_key.as_ref(),
            &clock.unix_timestamp.to_le_bytes(),
        ]).to_bytes();

        // Create VRF request instruction
        let vrf_ix = create_request_randomness_ix(RequestRandomnessParams {
            payer: payer_key,
            oracle_queue: oracle_queue_key,
            callback_program_id: crate::ID,
            callback_discriminator: instruction::MagicblockFulfillMint::DISCRIMINATOR.to_vec(),
            caller_seed,
            accounts_metas: Some(callback_accounts),
            ..Default::default()
        });

        // Invoke VRF request CPI
        ctx.accounts.invoke_signed_vrf(&ctx.accounts.payer.to_account_info(), &vrf_ix)?;

        msg!("MagicBlock VRF mint requested for content: {}", content_key);
        msg!("Mint request: {}", mint_request_key);
        msg!("NFT asset (pending): {}", nft_asset_key);

        Ok(())
    }
}

// ============================================================================
// FULFILL MINT - Oracle callback (no user signature!)
// ============================================================================

/// Oracle callback to fulfill mint with randomness
#[derive(Accounts)]
pub struct MagicBlockFulfillMint<'info> {
    /// CHECK: VRF program identity - validates callback is from VRF oracle
    #[account(address = ephemeral_vrf_sdk::consts::VRF_PROGRAM_IDENTITY)]
    pub vrf_program_identity: Signer<'info>,

    // === Remaining accounts from callback (12 accounts) ===

    /// Mint request (writable)
    #[account(
        mut,
        seeds = [MB_MINT_REQUEST_SEED, mint_request.buyer.as_ref(), mint_request.content.as_ref(), &mint_request.edition.to_le_bytes()],
        bump = mint_request.bump,
        constraint = !mint_request.is_fulfilled @ ContentRegistryError::AlreadyFulfilled
    )]
    pub mint_request: Box<Account<'info, MagicBlockMintRequest>>,

    /// Content entry (writable)
    #[account(mut)]
    pub content: Box<Account<'info, ContentEntry>>,

    /// ContentCollection tracker (for signing)
    #[account(
        seeds = [CONTENT_COLLECTION_SEED, mint_request.content.as_ref()],
        bump = mint_request.content_collection_bump
    )]
    pub content_collection: Box<Account<'info, ContentCollection>>,

    /// CHECK: Collection asset (writable)
    #[account(mut)]
    pub collection_asset: AccountInfo<'info>,

    /// CHECK: NFT asset to create (writable)
    #[account(mut)]
    pub nft_asset: AccountInfo<'info>,

    /// NFT rarity (writable)
    #[account(
        mut,
        seeds = [NFT_RARITY_SEED, nft_asset.key().as_ref()],
        bump
    )]
    pub nft_rarity: Box<Account<'info, NftRarity>>,

    /// NFT reward state (writable)
    #[account(
        mut,
        seeds = [NFT_REWARD_STATE_SEED, nft_asset.key().as_ref()],
        bump
    )]
    pub nft_reward_state: Box<Account<'info, NftRewardState>>,

    /// CHECK: Buyer (writable)
    #[account(mut)]
    pub buyer: AccountInfo<'info>,

    /// CHECK: Creator (writable) - receives payment
    #[account(mut)]
    pub creator: AccountInfo<'info>,

    /// CHECK: Treasury (writable) - receives fee
    #[account(mut)]
    pub treasury: AccountInfo<'info>,

    /// CHECK: Platform (writable) - receives fee
    #[account(mut)]
    pub platform: AccountInfo<'info>,

    /// Content reward pool (writable) - for holder rewards
    #[account(
        mut,
        seeds = [CONTENT_REWARD_POOL_SEED, mint_request.content.as_ref()],
        bump
    )]
    pub content_reward_pool: Box<Account<'info, ContentRewardPool>>,

    /// CHECK: MPL Core program
    #[account(address = MPL_CORE_ID)]
    pub mpl_core_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> MagicBlockFulfillMint<'info> {
    pub fn handler(ctx: Context<MagicBlockFulfillMint>, randomness: [u8; 32]) -> Result<()> {
        // Capture all values from mint_request upfront
        let mint_request_key = ctx.accounts.mint_request.key();
        let content_key = ctx.accounts.mint_request.content;
        let content_collection_bump = ctx.accounts.mint_request.content_collection_bump;
        let buyer_key = ctx.accounts.mint_request.buyer;
        let mint_request_bump = ctx.accounts.mint_request.bump;
        let nft_bump = ctx.accounts.mint_request.nft_bump;
        let metadata_cid = ctx.accounts.mint_request.metadata_cid.clone();
        let amount_paid = ctx.accounts.mint_request.amount_paid;
        let had_existing_nfts = ctx.accounts.mint_request.had_existing_nfts;

        // Determine rarity from randomness using the standard Rarity::from_random
        let (rarity, weight) = determine_rarity_from_bytes(randomness);

        // Update rarity state
        ctx.accounts.nft_rarity.rarity = rarity.clone();
        ctx.accounts.nft_rarity.weight = weight;

        // Set weight directly (no scaling needed - weight is already correct from rarity.weight())
        ctx.accounts.nft_reward_state.weight = weight;

        // Calculate edition number
        let edition = ctx.accounts.content.minted_count + 1;

        // Build NFT name and URI
        let nft_name = format!("Handcraft #{}", edition);
        let nft_uri = format!("https://ipfs.io/ipfs/{}", metadata_cid);

        // Create NFT via Metaplex Core
        let content_collection_seeds = &[
            CONTENT_COLLECTION_SEED,
            content_key.as_ref(),
            &[content_collection_bump],
        ];

        let mint_request_seeds = &[
            MB_MINT_REQUEST_SEED,
            buyer_key.as_ref(),
            content_key.as_ref(),
            &[mint_request_bump],
        ];

        let nft_seeds = &[
            MB_NFT_SEED,
            mint_request_key.as_ref(),
            &[nft_bump],
        ];

        // Create the NFT
        CreateV2CpiBuilder::new(&ctx.accounts.mpl_core_program)
            .asset(&ctx.accounts.nft_asset)
            .collection(Some(&ctx.accounts.collection_asset))
            .authority(Some(&ctx.accounts.content_collection.to_account_info()))
            .payer(&ctx.accounts.mint_request.to_account_info())
            .owner(Some(&ctx.accounts.buyer))
            .system_program(&ctx.accounts.system_program.to_account_info())
            .name(nft_name)
            .uri(nft_uri)
            .invoke_signed(&[content_collection_seeds, mint_request_seeds, nft_seeds])?;

        // Update content minted count and decrement pending
        ctx.accounts.content.minted_count = edition;
        ctx.accounts.content.pending_count = ctx.accounts.content.pending_count.saturating_sub(1);

        // Distribute payment from escrow using proper fee split
        // IMPORTANT: Order matters for correct reward distribution:
        // 1. First add rewards to pool (updates reward_per_share based on EXISTING total_weight)
        // 2. Then add new NFT weight to pool
        // 3. Finally set NFT's reward_debt to the NEW reward_per_share
        if amount_paid > 0 {
            let (creator_amount, platform_amount, ecosystem_amount, holder_reward_amount) =
                EcosystemConfig::calculate_primary_split(amount_paid);

            // For first NFT, holder reward goes to creator (no holders yet)
            let final_creator_amount = if !had_existing_nfts {
                creator_amount + holder_reward_amount
            } else {
                creator_amount
            };

            let mint_request_info = ctx.accounts.mint_request.to_account_info();

            // Transfer to creator
            if final_creator_amount > 0 {
                **mint_request_info.try_borrow_mut_lamports()? -= final_creator_amount;
                **ctx.accounts.creator.try_borrow_mut_lamports()? += final_creator_amount;
            }

            // Transfer to platform
            if platform_amount > 0 {
                **mint_request_info.try_borrow_mut_lamports()? -= platform_amount;
                **ctx.accounts.platform.try_borrow_mut_lamports()? += platform_amount;
            }

            // Transfer to treasury (ecosystem)
            if ecosystem_amount > 0 {
                **mint_request_info.try_borrow_mut_lamports()? -= ecosystem_amount;
                **ctx.accounts.treasury.try_borrow_mut_lamports()? += ecosystem_amount;
            }

            // Step 1: Transfer holder reward to pool and update reward_per_share
            // This must happen BEFORE adding the new NFT's weight so existing holders get their share
            if had_existing_nfts && holder_reward_amount > 0 {
                **mint_request_info.try_borrow_mut_lamports()? -= holder_reward_amount;
                **ctx.accounts.content_reward_pool.to_account_info().try_borrow_mut_lamports()? += holder_reward_amount;
                ctx.accounts.content_reward_pool.add_rewards(holder_reward_amount);
            }

            msg!("Payment distributed: creator={}, platform={}, ecosystem={}, holder_pool={}",
                final_creator_amount, platform_amount, ecosystem_amount,
                if had_existing_nfts { holder_reward_amount } else { 0 });
        }

        // Step 2: Set reward_debt BEFORE adding NFT to pool
        // reward_debt = weight * reward_per_share (at this moment, before NFT is added)
        // This ensures the new NFT doesn't claim the rewards just distributed to existing holders
        ctx.accounts.nft_reward_state.reward_debt =
            (weight as u128) * ctx.accounts.content_reward_pool.reward_per_share;

        // Step 3: Add new NFT to pool's tracking (AFTER setting reward_debt)
        ctx.accounts.content_reward_pool.add_nft(weight);

        // Mark as fulfilled
        ctx.accounts.mint_request.is_fulfilled = true;

        msg!("MagicBlock VRF mint fulfilled!");
        msg!("NFT: {} with rarity {:?} (weight: {})", ctx.accounts.nft_asset.key(), rarity, weight);

        Ok(())
    }
}

/// Determine rarity from random bytes using the standard Rarity::from_random
/// Returns the Rarity enum and its weight from rarity.rs
fn determine_rarity_from_bytes(random_bytes: [u8; 32]) -> (Rarity, u16) {
    let rarity = Rarity::from_random(random_bytes);
    let weight = rarity.weight();
    (rarity, weight)
}

// ============================================================================
// CANCEL MINT - Allow user to cancel pending request
// ============================================================================

#[derive(Accounts)]
#[instruction(edition: u64)]
pub struct MagicBlockCancelMint<'info> {
    #[account(mut)]
    pub content: Box<Account<'info, ContentEntry>>,

    #[account(
        mut,
        close = buyer,
        seeds = [MB_MINT_REQUEST_SEED, buyer.key().as_ref(), content.key().as_ref(), &edition.to_le_bytes()],
        bump = mint_request.bump,
        constraint = !mint_request.is_fulfilled @ ContentRegistryError::AlreadyFulfilled,
        constraint = mint_request.buyer == buyer.key() @ ContentRegistryError::Unauthorized
    )]
    pub mint_request: Box<Account<'info, MagicBlockMintRequest>>,

    /// CHECK: NFT asset PDA (not created yet)
    #[account(
        seeds = [MB_NFT_SEED, mint_request.key().as_ref()],
        bump = mint_request.nft_bump
    )]
    pub nft_asset: AccountInfo<'info>,

    /// NFT rarity to close
    #[account(
        mut,
        close = buyer,
        seeds = [NFT_RARITY_SEED, nft_asset.key().as_ref()],
        bump
    )]
    pub nft_rarity: Box<Account<'info, NftRarity>>,

    /// NFT reward state to close
    #[account(
        mut,
        close = buyer,
        seeds = [NFT_REWARD_STATE_SEED, nft_asset.key().as_ref()],
        bump
    )]
    pub nft_reward_state: Box<Account<'info, NftRewardState>>,

    #[account(mut)]
    pub buyer: Signer<'info>,
}

impl<'info> MagicBlockCancelMint<'info> {
    pub fn handler(ctx: Context<MagicBlockCancelMint>, _edition: u64) -> Result<()> {
        // Decrement pending count
        let content = &mut ctx.accounts.content;
        content.pending_count = content.pending_count.saturating_sub(1);

        msg!("MagicBlock mint request cancelled, funds returned to buyer");
        Ok(())
    }
}

// ============================================================================
// CLAIM FALLBACK - Mint with common rarity if VRF doesn't respond
// ============================================================================

/// Fallback timeout in seconds (5 seconds - short because we use slot hash randomness)
pub const MB_FALLBACK_TIMEOUT: i64 = 5;

/// Claim NFT with random rarity using slot hash if VRF oracle doesn't respond within timeout
/// This allows users to complete their mint even if VRF is unavailable
#[derive(Accounts)]
pub struct MagicBlockClaimFallback<'info> {
    /// Mint request (must exist and not be fulfilled) - closed after completion
    #[account(
        mut,
        close = buyer,
        seeds = [MB_MINT_REQUEST_SEED, mint_request.buyer.as_ref(), mint_request.content.as_ref(), &mint_request.edition.to_le_bytes()],
        bump = mint_request.bump,
        constraint = !mint_request.is_fulfilled @ ContentRegistryError::AlreadyFulfilled,
        constraint = mint_request.buyer == buyer.key() @ ContentRegistryError::Unauthorized
    )]
    pub mint_request: Box<Account<'info, MagicBlockMintRequest>>,

    /// Content entry (writable for minted_count update)
    #[account(mut)]
    pub content: Box<Account<'info, ContentEntry>>,

    /// ContentCollection tracker (for signing NFT creation)
    #[account(
        seeds = [CONTENT_COLLECTION_SEED, mint_request.content.as_ref()],
        bump = mint_request.content_collection_bump
    )]
    pub content_collection: Box<Account<'info, ContentCollection>>,

    /// CHECK: Collection asset (writable)
    #[account(mut, constraint = content_collection.collection_asset == collection_asset.key())]
    pub collection_asset: AccountInfo<'info>,

    /// CHECK: NFT asset to create (writable)
    #[account(
        mut,
        seeds = [MB_NFT_SEED, mint_request.key().as_ref()],
        bump = mint_request.nft_bump
    )]
    pub nft_asset: AccountInfo<'info>,

    /// NFT rarity (writable - will be set using slot hash randomness)
    #[account(
        mut,
        seeds = [NFT_RARITY_SEED, nft_asset.key().as_ref()],
        bump
    )]
    pub nft_rarity: Box<Account<'info, NftRarity>>,

    /// NFT reward state (writable)
    #[account(
        mut,
        seeds = [NFT_REWARD_STATE_SEED, nft_asset.key().as_ref()],
        bump
    )]
    pub nft_reward_state: Box<Account<'info, NftRewardState>>,

    /// Buyer who initiated the mint (also closes the request)
    #[account(mut)]
    pub buyer: Signer<'info>,

    /// CHECK: Creator (writable) - receives payment
    #[account(mut, constraint = mint_request.creator == creator.key())]
    pub creator: AccountInfo<'info>,

    /// CHECK: Treasury (writable) - receives fee
    #[account(mut, constraint = mint_request.treasury == treasury.key())]
    pub treasury: AccountInfo<'info>,

    /// CHECK: Platform (writable) - receives fee
    #[account(mut, constraint = mint_request.platform == platform.key())]
    pub platform: AccountInfo<'info>,

    /// Content reward pool (writable) - for holder rewards
    #[account(
        mut,
        seeds = [CONTENT_REWARD_POOL_SEED, mint_request.content.as_ref()],
        bump
    )]
    pub content_reward_pool: Box<Account<'info, ContentRewardPool>>,

    /// CHECK: MPL Core program
    #[account(address = MPL_CORE_ID)]
    pub mpl_core_program: AccountInfo<'info>,

    /// CHECK: Slot hashes sysvar for randomness
    #[account(address = anchor_lang::solana_program::sysvar::slot_hashes::ID)]
    pub slot_hashes: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> MagicBlockClaimFallback<'info> {
    pub fn handler(ctx: Context<MagicBlockClaimFallback>) -> Result<()> {
        let clock = Clock::get()?;

        // Check timeout has passed
        let created_at = ctx.accounts.mint_request.created_at;
        let elapsed = clock.unix_timestamp - created_at;
        require!(
            elapsed >= MB_FALLBACK_TIMEOUT,
            ContentRegistryError::FallbackTooEarly
        );

        // Capture all values from mint_request upfront
        let mint_request_key = ctx.accounts.mint_request.key();
        let content_key = ctx.accounts.mint_request.content;
        let content_collection_bump = ctx.accounts.mint_request.content_collection_bump;
        let buyer_key = ctx.accounts.mint_request.buyer;
        let mint_request_bump = ctx.accounts.mint_request.bump;
        let nft_bump = ctx.accounts.mint_request.nft_bump;
        let metadata_cid = ctx.accounts.mint_request.metadata_cid.clone();
        let amount_paid = ctx.accounts.mint_request.amount_paid;
        let had_existing_nfts = ctx.accounts.mint_request.had_existing_nfts;

        // Generate randomness from slot hashes (program controls this, user can't game it)
        let slot_hashes_data = ctx.accounts.slot_hashes.try_borrow_data()?;

        // Create seed from multiple unpredictable sources
        let randomness_seed = solana_sha256_hasher::hashv(&[
            &slot_hashes_data[..std::cmp::min(64, slot_hashes_data.len())], // Recent slot hashes
            mint_request_key.as_ref(),                                       // Unique per mint request
            buyer_key.as_ref(),                                              // Buyer's pubkey
            &clock.unix_timestamp.to_le_bytes(),                            // Current timestamp
            &clock.slot.to_le_bytes(),                                      // Current slot
        ]);

        // Use the hash bytes for rarity determination via Rarity::from_random
        let (rarity, weight) = determine_rarity_from_bytes(randomness_seed.to_bytes());

        // Update rarity state
        ctx.accounts.nft_rarity.rarity = rarity.clone();
        ctx.accounts.nft_rarity.weight = weight;

        // Set weight directly (no scaling needed)
        ctx.accounts.nft_reward_state.weight = weight;

        // Calculate edition number
        let edition = ctx.accounts.content.minted_count + 1;

        // Build NFT name and URI
        let nft_name = format!("Handcraft #{}", edition);
        let nft_uri = format!("https://ipfs.io/ipfs/{}", metadata_cid);

        // Create NFT via Metaplex Core
        let content_collection_seeds = &[
            CONTENT_COLLECTION_SEED,
            content_key.as_ref(),
            &[content_collection_bump],
        ];

        let _mint_request_seeds = &[
            MB_MINT_REQUEST_SEED,
            buyer_key.as_ref(),
            content_key.as_ref(),
            &[mint_request_bump],
        ];

        let nft_seeds = &[
            MB_NFT_SEED,
            mint_request_key.as_ref(),
            &[nft_bump],
        ];

        // Create the NFT - use buyer as payer since mint_request has data
        CreateV2CpiBuilder::new(&ctx.accounts.mpl_core_program)
            .asset(&ctx.accounts.nft_asset)
            .collection(Some(&ctx.accounts.collection_asset))
            .authority(Some(&ctx.accounts.content_collection.to_account_info()))
            .payer(&ctx.accounts.buyer.to_account_info())
            .owner(Some(&ctx.accounts.buyer.to_account_info()))
            .system_program(&ctx.accounts.system_program.to_account_info())
            .name(nft_name)
            .uri(nft_uri)
            .invoke_signed(&[content_collection_seeds, nft_seeds])?;

        // Update content minted count and decrement pending
        ctx.accounts.content.minted_count = edition;
        ctx.accounts.content.pending_count = ctx.accounts.content.pending_count.saturating_sub(1);

        // Distribute payment from escrow using proper fee split
        // IMPORTANT: Order matters for correct reward distribution:
        // 1. First add rewards to pool (updates reward_per_share based on EXISTING total_weight)
        // 2. Then add new NFT weight to pool
        // 3. Finally set NFT's reward_debt to the NEW reward_per_share
        if amount_paid > 0 {
            let (creator_amount, platform_amount, ecosystem_amount, holder_reward_amount) =
                EcosystemConfig::calculate_primary_split(amount_paid);

            // For first NFT, holder reward goes to creator (no holders yet)
            let final_creator_amount = if !had_existing_nfts {
                creator_amount + holder_reward_amount
            } else {
                creator_amount
            };

            let mint_request_info = ctx.accounts.mint_request.to_account_info();

            // Transfer to creator
            if final_creator_amount > 0 {
                **mint_request_info.try_borrow_mut_lamports()? -= final_creator_amount;
                **ctx.accounts.creator.try_borrow_mut_lamports()? += final_creator_amount;
            }

            // Transfer to platform
            if platform_amount > 0 {
                **mint_request_info.try_borrow_mut_lamports()? -= platform_amount;
                **ctx.accounts.platform.try_borrow_mut_lamports()? += platform_amount;
            }

            // Transfer to treasury (ecosystem)
            if ecosystem_amount > 0 {
                **mint_request_info.try_borrow_mut_lamports()? -= ecosystem_amount;
                **ctx.accounts.treasury.try_borrow_mut_lamports()? += ecosystem_amount;
            }

            // Step 1: Transfer holder reward to pool and update reward_per_share
            // This must happen BEFORE adding the new NFT's weight so existing holders get their share
            if had_existing_nfts && holder_reward_amount > 0 {
                **mint_request_info.try_borrow_mut_lamports()? -= holder_reward_amount;
                **ctx.accounts.content_reward_pool.to_account_info().try_borrow_mut_lamports()? += holder_reward_amount;
                ctx.accounts.content_reward_pool.add_rewards(holder_reward_amount);
            }

            msg!("Payment distributed: creator={}, platform={}, ecosystem={}, holder_pool={}",
                final_creator_amount, platform_amount, ecosystem_amount,
                if had_existing_nfts { holder_reward_amount } else { 0 });
        }

        // Step 2: Set reward_debt BEFORE adding NFT to pool
        // reward_debt = weight * reward_per_share (at this moment, before NFT is added)
        ctx.accounts.nft_reward_state.reward_debt =
            (weight as u128) * ctx.accounts.content_reward_pool.reward_per_share;

        // Step 3: Add new NFT to pool's tracking (AFTER setting reward_debt)
        ctx.accounts.content_reward_pool.add_nft(weight);

        // Account is automatically closed via `close = buyer` constraint

        msg!("MagicBlock fallback mint completed with slot hash randomness!");
        msg!("NFT: {} with {:?} rarity (weight: {}) - VRF timeout after {}s",
            ctx.accounts.nft_asset.key(), rarity, weight, elapsed);

        Ok(())
    }
}

// ============================================================================
// CLOSE FULFILLED REQUEST - Clean up completed mint request to allow new mints
// ============================================================================

/// Close a fulfilled mint request account to allow minting again
/// This reclaims rent and allows a new mint request for the same wallet+content
#[derive(Accounts)]
pub struct MagicBlockCloseFulfilled<'info> {
    /// The fulfilled mint request to close
    #[account(
        mut,
        close = buyer,
        seeds = [MB_MINT_REQUEST_SEED, buyer.key().as_ref(), mint_request.content.as_ref(), &mint_request.edition.to_le_bytes()],
        bump = mint_request.bump,
        constraint = mint_request.is_fulfilled @ ContentRegistryError::NotFulfilled,
        constraint = mint_request.buyer == buyer.key() @ ContentRegistryError::Unauthorized
    )]
    pub mint_request: Box<Account<'info, MagicBlockMintRequest>>,

    /// The buyer who originally created the request
    #[account(mut)]
    pub buyer: Signer<'info>,
}

impl<'info> MagicBlockCloseFulfilled<'info> {
    pub fn handler(_ctx: Context<MagicBlockCloseFulfilled>) -> Result<()> {
        msg!("Fulfilled MagicBlock mint request closed");
        Ok(())
    }
}

// ============================================================================
// DIRECT MINT - Single transaction mint with slot hash randomness
// ============================================================================

/// Seed for direct mint NFT assets
/// PDA seeds: ["direct_nft", buyer, content, edition_bytes]
pub const DIRECT_NFT_SEED: &[u8] = b"direct_nft";

/// Direct mint NFT with slot hash randomness
/// Single transaction - no VRF dependency, immediate mint
#[derive(Accounts)]
pub struct DirectMint<'info> {
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

    /// Content-specific reward pool
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + ContentRewardPool::INIT_SPACE,
        seeds = [CONTENT_REWARD_POOL_SEED, content.key().as_ref()],
        bump
    )]
    pub content_reward_pool: Box<Account<'info, ContentRewardPool>>,

    /// ContentCollection tracker PDA
    #[account(
        seeds = [CONTENT_COLLECTION_SEED, content.key().as_ref()],
        bump
    )]
    pub content_collection: Box<Account<'info, ContentCollection>>,

    /// CHECK: The Metaplex Core Collection asset
    #[account(mut)]
    pub collection_asset: AccountInfo<'info>,

    /// CHECK: Creator to receive payment
    #[account(mut, constraint = content.creator == creator.key())]
    pub creator: AccountInfo<'info>,

    /// CHECK: Ecosystem treasury
    #[account(mut, constraint = ecosystem_config.treasury == treasury.key())]
    pub treasury: AccountInfo<'info>,

    /// CHECK: Optional platform wallet for commission
    #[account(mut)]
    pub platform: Option<AccountInfo<'info>>,

    /// Buyer's wallet state for tracking NFT ownership
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + WalletContentState::INIT_SPACE,
        seeds = [WALLET_CONTENT_STATE_SEED, payer.key().as_ref(), content.key().as_ref()],
        bump
    )]
    pub buyer_wallet_state: Box<Account<'info, WalletContentState>>,

    /// CHECK: NFT asset - PDA based on buyer, content, and edition
    #[account(
        mut,
        seeds = [DIRECT_NFT_SEED, payer.key().as_ref(), content.key().as_ref(), &(content.minted_count + 1).to_le_bytes()],
        bump
    )]
    pub nft_asset: AccountInfo<'info>,

    /// NFT reward state
    #[account(
        init,
        payer = payer,
        space = 8 + NftRewardState::INIT_SPACE,
        seeds = [NFT_REWARD_STATE_SEED, nft_asset.key().as_ref()],
        bump
    )]
    pub nft_reward_state: Box<Account<'info, NftRewardState>>,

    /// NFT rarity state
    #[account(
        init,
        payer = payer,
        space = 8 + NftRarity::INIT_SPACE,
        seeds = [NFT_RARITY_SEED, nft_asset.key().as_ref()],
        bump
    )]
    pub nft_rarity: Box<Account<'info, NftRarity>>,

    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: Slot hashes sysvar for randomness
    #[account(address = anchor_lang::solana_program::sysvar::slot_hashes::ID)]
    pub slot_hashes: AccountInfo<'info>,

    /// CHECK: MPL Core program
    #[account(address = MPL_CORE_ID)]
    pub mpl_core_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> DirectMint<'info> {
    pub fn handler(ctx: Context<DirectMint>) -> Result<()> {
        let clock = Clock::get()?;

        // Capture values upfront
        let payer_key = ctx.accounts.payer.key();
        let content_key = ctx.accounts.content.key();
        let nft_asset_key = ctx.accounts.nft_asset.key();
        let platform_key = ctx.accounts.platform.as_ref().map(|p| p.key()).unwrap_or(ctx.accounts.ecosystem_config.treasury);

        // Check minting is enabled
        require!(ctx.accounts.mint_config.is_active, ContentRegistryError::MintingNotActive);
        require!(!ctx.accounts.ecosystem_config.is_paused, ContentRegistryError::EcosystemPaused);

        // Check max supply
        if let Some(max_supply) = ctx.accounts.mint_config.max_supply {
            require!(ctx.accounts.content.minted_count < max_supply, ContentRegistryError::MaxSupplyReached);
        }

        // Calculate payment
        let mint_price = ctx.accounts.mint_config.price;
        // Use total_weight > 0 to check for existing NFTs (consistent with mint_nft_sol)
        let had_existing_nfts = ctx.accounts.content_reward_pool.total_weight > 0;
        let metadata_cid = ctx.accounts.content.metadata_cid.clone();

        // Generate randomness from slot hashes
        let slot_hashes_data = ctx.accounts.slot_hashes.try_borrow_data()?;
        let randomness_seed = solana_sha256_hasher::hashv(&[
            &slot_hashes_data[..std::cmp::min(64, slot_hashes_data.len())],
            nft_asset_key.as_ref(),
            payer_key.as_ref(),
            &clock.unix_timestamp.to_le_bytes(),
            &clock.slot.to_le_bytes(),
        ]);

        // Use standard rarity determination
        let (rarity, weight) = determine_rarity_from_bytes(randomness_seed.to_bytes());

        // Initialize NFT reward state (no scaling needed)
        ctx.accounts.nft_reward_state.nft_asset = nft_asset_key;
        ctx.accounts.nft_reward_state.content = content_key;
        ctx.accounts.nft_reward_state.weight = weight;
        ctx.accounts.nft_reward_state.created_at = clock.unix_timestamp;

        // Initialize NFT rarity
        ctx.accounts.nft_rarity.nft_asset = nft_asset_key;
        ctx.accounts.nft_rarity.rarity = rarity.clone();
        ctx.accounts.nft_rarity.weight = weight;

        // Initialize content reward pool if needed
        if ctx.accounts.content_reward_pool.content == Pubkey::default() {
            ctx.accounts.content_reward_pool.content = content_key;
            ctx.accounts.content_reward_pool.total_deposited = 0;
            ctx.accounts.content_reward_pool.total_claimed = 0;
        }

        // Calculate edition number
        let edition = ctx.accounts.content.minted_count + 1;

        // Build NFT name and URI
        let nft_name = format!("Handcraft #{}", edition);
        let nft_uri = format!("https://ipfs.io/ipfs/{}", metadata_cid);

        // Create NFT via Metaplex Core
        let content_collection_seeds = &[
            CONTENT_COLLECTION_SEED,
            content_key.as_ref(),
            &[ctx.bumps.content_collection],
        ];

        let nft_seeds = &[
            DIRECT_NFT_SEED,
            payer_key.as_ref(),
            content_key.as_ref(),
            &edition.to_le_bytes(),
            &[ctx.bumps.nft_asset],
        ];

        CreateV2CpiBuilder::new(&ctx.accounts.mpl_core_program)
            .asset(&ctx.accounts.nft_asset)
            .collection(Some(&ctx.accounts.collection_asset))
            .authority(Some(&ctx.accounts.content_collection.to_account_info()))
            .payer(&ctx.accounts.payer.to_account_info())
            .owner(Some(&ctx.accounts.payer.to_account_info()))
            .system_program(&ctx.accounts.system_program.to_account_info())
            .name(nft_name)
            .uri(nft_uri)
            .invoke_signed(&[content_collection_seeds, nft_seeds])?;

        // Update content minted count
        ctx.accounts.content.minted_count = edition;

        // Distribute payment with correct order
        // 1. Add rewards to pool first (before new NFT weight)
        // 2. Add new NFT to pool
        // 3. Set reward_debt
        if mint_price > 0 {
            let (creator_amount, platform_amount, ecosystem_amount, holder_reward_amount) =
                EcosystemConfig::calculate_primary_split(mint_price);

            // For first NFT, holder reward goes to creator
            let final_creator_amount = if !had_existing_nfts {
                creator_amount + holder_reward_amount
            } else {
                creator_amount
            };

            // Transfer to creator
            if final_creator_amount > 0 {
                anchor_lang::system_program::transfer(
                    CpiContext::new(
                        ctx.accounts.system_program.to_account_info(),
                        anchor_lang::system_program::Transfer {
                            from: ctx.accounts.payer.to_account_info(),
                            to: ctx.accounts.creator.to_account_info(),
                        },
                    ),
                    final_creator_amount,
                )?;
            }

            // Transfer to platform
            if platform_amount > 0 {
                let platform_account = ctx.accounts.platform.as_ref()
                    .map(|p| p.to_account_info())
                    .unwrap_or_else(|| ctx.accounts.treasury.to_account_info());
                anchor_lang::system_program::transfer(
                    CpiContext::new(
                        ctx.accounts.system_program.to_account_info(),
                        anchor_lang::system_program::Transfer {
                            from: ctx.accounts.payer.to_account_info(),
                            to: platform_account,
                        },
                    ),
                    platform_amount,
                )?;
            }

            // Transfer to treasury
            if ecosystem_amount > 0 {
                anchor_lang::system_program::transfer(
                    CpiContext::new(
                        ctx.accounts.system_program.to_account_info(),
                        anchor_lang::system_program::Transfer {
                            from: ctx.accounts.payer.to_account_info(),
                            to: ctx.accounts.treasury.to_account_info(),
                        },
                    ),
                    ecosystem_amount,
                )?;
            }

            // Step 1: Transfer holder reward to pool and update reward_per_share FIRST
            if had_existing_nfts && holder_reward_amount > 0 {
                anchor_lang::system_program::transfer(
                    CpiContext::new(
                        ctx.accounts.system_program.to_account_info(),
                        anchor_lang::system_program::Transfer {
                            from: ctx.accounts.payer.to_account_info(),
                            to: ctx.accounts.content_reward_pool.to_account_info(),
                        },
                    ),
                    holder_reward_amount,
                )?;
                ctx.accounts.content_reward_pool.add_rewards(holder_reward_amount);
            }

            msg!("Payment distributed: creator={}, platform={}, ecosystem={}, holder_pool={}",
                final_creator_amount, platform_amount, ecosystem_amount,
                if had_existing_nfts { holder_reward_amount } else { 0 });
        }

        // Step 2: Set reward_debt BEFORE adding NFT to pool
        // reward_debt = weight * reward_per_share (at this moment, before NFT is added)
        ctx.accounts.nft_reward_state.reward_debt =
            (weight as u128) * ctx.accounts.content_reward_pool.reward_per_share;

        // Step 3: Add new NFT to pool's tracking (AFTER setting reward_debt)
        ctx.accounts.content_reward_pool.add_nft(weight);

        // Update buyer wallet state
        ctx.accounts.buyer_wallet_state.wallet = payer_key;
        ctx.accounts.buyer_wallet_state.content = content_key;
        ctx.accounts.buyer_wallet_state.nft_count = ctx.accounts.buyer_wallet_state.nft_count.saturating_add(1);
        ctx.accounts.buyer_wallet_state.updated_at = clock.unix_timestamp;

        msg!("Direct mint completed with slot hash randomness!");
        msg!("NFT: {} with {:?} rarity (weight: {})", nft_asset_key, rarity, weight);

        Ok(())
    }
}
