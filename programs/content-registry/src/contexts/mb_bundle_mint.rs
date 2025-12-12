use anchor_lang::prelude::*;
use ephemeral_vrf_sdk::anchor::vrf;
use ephemeral_vrf_sdk::instructions::{create_request_randomness_ix, RequestRandomnessParams};
use ephemeral_vrf_sdk::types::SerializableAccountMeta;
use mpl_core::instructions::CreateV2CpiBuilder;
use mpl_core::types::DataState;

use crate::state::*;
use crate::errors::ContentRegistryError;
use crate::instruction;
use crate::MPL_CORE_ID;

/// Seed for MagicBlock bundle mint requests
/// PDA seeds: ["mb_bundle_mint_request", buyer, bundle]
pub const MB_BUNDLE_MINT_REQUEST_SEED: &[u8] = b"mb_bundle_mint_req";

/// Seed for MagicBlock-minted bundle NFT assets
/// PDA seeds: ["mb_bundle_nft", mint_request]
pub const MB_BUNDLE_NFT_SEED: &[u8] = b"mb_bundle_nft";

/// MagicBlock Bundle Mint request - tracks state until oracle callback completes
#[account]
#[derive(InitSpace)]
pub struct MagicBlockBundleMintRequest {
    /// Buyer who initiated the mint
    pub buyer: Pubkey,
    /// Bundle being minted
    pub bundle: Pubkey,
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
    /// Bundle collection bump for signing
    pub bundle_collection_bump: u8,
    /// Metadata CID for NFT URI
    #[max_len(64)]
    pub metadata_cid: String,
    /// Current minted count at request time (for edition number)
    pub minted_count: u64,
    /// Edition number used in PDA derivation (allows multiple mints per buyer+bundle)
    pub edition: u64,
}

// ============================================================================
// REQUEST BUNDLE MINT - User's single transaction
// ============================================================================

/// Request a bundle mint with MagicBlock VRF
/// Oracle callback will complete the mint automatically
#[vrf]
#[derive(Accounts)]
#[instruction(edition: u64)]
pub struct MagicBlockRequestBundleMint<'info> {
    #[account(
        mut,
        seeds = [ECOSYSTEM_CONFIG_SEED],
        bump
    )]
    pub ecosystem_config: Box<Account<'info, EcosystemConfig>>,

    #[account(
        mut,
        constraint = bundle.is_active @ ContentRegistryError::BundleNotActive
    )]
    pub bundle: Box<Account<'info, Bundle>>,

    #[account(
        seeds = [BUNDLE_MINT_CONFIG_SEED, bundle.key().as_ref()],
        bump
    )]
    pub mint_config: Box<Account<'info, BundleMintConfig>>,

    /// Mint request PDA - stores all info needed for callback
    /// Uses edition number in seeds to allow multiple mints per buyer+bundle
    #[account(
        init,
        payer = payer,
        space = 8 + MagicBlockBundleMintRequest::INIT_SPACE,
        seeds = [MB_BUNDLE_MINT_REQUEST_SEED, payer.key().as_ref(), bundle.key().as_ref(), &edition.to_le_bytes()],
        bump
    )]
    pub mint_request: Box<Account<'info, MagicBlockBundleMintRequest>>,

    /// Bundle-specific reward pool
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + BundleRewardPool::INIT_SPACE,
        seeds = [BUNDLE_REWARD_POOL_SEED, bundle.key().as_ref()],
        bump
    )]
    pub bundle_reward_pool: Box<Account<'info, BundleRewardPool>>,

    /// BundleCollection tracker PDA
    #[account(
        seeds = [BUNDLE_COLLECTION_SEED, bundle.key().as_ref()],
        bump
    )]
    pub bundle_collection: Box<Account<'info, BundleCollection>>,

    /// CHECK: The Metaplex Core Collection asset
    #[account(mut)]
    pub collection_asset: AccountInfo<'info>,

    /// CHECK: Creator to receive payment
    #[account(mut, constraint = bundle.creator == creator.key())]
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
        space = 8 + BundleWalletState::INIT_SPACE,
        seeds = [BUNDLE_WALLET_STATE_SEED, payer.key().as_ref(), bundle.key().as_ref()],
        bump
    )]
    pub buyer_wallet_state: Box<Account<'info, BundleWalletState>>,

    /// CHECK: NFT asset - will be created in callback
    #[account(
        mut,
        seeds = [MB_BUNDLE_NFT_SEED, mint_request.key().as_ref()],
        bump
    )]
    pub nft_asset: AccountInfo<'info>,

    /// NFT reward state - created now so callback doesn't need to init
    #[account(
        init,
        payer = payer,
        space = 8 + BundleNftRewardState::INIT_SPACE,
        seeds = [BUNDLE_NFT_REWARD_STATE_SEED, nft_asset.key().as_ref()],
        bump
    )]
    pub nft_reward_state: Box<Account<'info, BundleNftRewardState>>,

    /// NFT rarity state - created now so callback doesn't need to init
    #[account(
        init,
        payer = payer,
        space = 8 + BundleNftRarity::INIT_SPACE,
        seeds = [BUNDLE_NFT_RARITY_SEED, nft_asset.key().as_ref()],
        bump
    )]
    pub nft_rarity: Box<Account<'info, BundleNftRarity>>,

    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: MagicBlock VRF oracle queue
    #[account(mut)]
    pub oracle_queue: AccountInfo<'info>,

    // Note: system_program, vrf_program, slot_hashes, program_identity are added by #[vrf] macro
}

impl<'info> MagicBlockRequestBundleMint<'info> {
    pub fn handler(ctx: Context<MagicBlockRequestBundleMint>, edition: u64) -> Result<()> {
        let clock = Clock::get()?;

        // Capture ALL keys upfront before any mutable borrows
        let mint_request_key = ctx.accounts.mint_request.key();
        let bundle_key = ctx.accounts.bundle.key();
        let payer_key = ctx.accounts.payer.key();
        let nft_asset_key = ctx.accounts.nft_asset.key();
        let nft_rarity_key = ctx.accounts.nft_rarity.key();
        let nft_reward_state_key = ctx.accounts.nft_reward_state.key();
        let bundle_collection_key = ctx.accounts.bundle_collection.key();
        let collection_asset_key = ctx.accounts.collection_asset.key();
        let creator_key = ctx.accounts.creator.key();
        let treasury_key = ctx.accounts.treasury.key();
        let oracle_queue_key = ctx.accounts.oracle_queue.key();
        let platform_key = ctx.accounts.platform.as_ref().map(|p| p.key()).unwrap_or(ctx.accounts.ecosystem_config.treasury);
        let bundle_reward_pool_key = ctx.accounts.bundle_reward_pool.key();

        // Check minting is enabled (read-only checks)
        require!(ctx.accounts.mint_config.is_active, ContentRegistryError::MintingNotActive);
        require!(!ctx.accounts.ecosystem_config.is_paused, ContentRegistryError::EcosystemPaused);

        // Check max supply
        let total_minted_or_pending = ctx.accounts.bundle.minted_count.saturating_add(ctx.accounts.bundle.pending_count);
        if let Some(max_supply) = ctx.accounts.mint_config.max_supply {
            require!(total_minted_or_pending < max_supply, ContentRegistryError::MaxSupplyReached);
        }

        // Calculate payment
        let mint_price = ctx.accounts.mint_config.price;
        let had_existing_nfts = ctx.accounts.bundle_reward_pool.total_weight > 0;
        let bundle_creator = ctx.accounts.bundle.creator;
        let metadata_cid = ctx.accounts.bundle.metadata_cid.clone();
        let minted_count = ctx.accounts.bundle.minted_count;

        // Store in request for callback
        ctx.accounts.mint_request.buyer = payer_key;
        ctx.accounts.mint_request.bundle = bundle_key;
        ctx.accounts.mint_request.creator = bundle_creator;
        ctx.accounts.mint_request.amount_paid = mint_price;
        ctx.accounts.mint_request.created_at = clock.unix_timestamp;
        ctx.accounts.mint_request.had_existing_nfts = had_existing_nfts;
        ctx.accounts.mint_request.bump = ctx.bumps.mint_request;
        ctx.accounts.mint_request.nft_bump = ctx.bumps.nft_asset;
        ctx.accounts.mint_request.is_fulfilled = false;
        ctx.accounts.mint_request.collection_asset = collection_asset_key;
        ctx.accounts.mint_request.treasury = treasury_key;
        ctx.accounts.mint_request.platform = platform_key;
        ctx.accounts.mint_request.bundle_collection_bump = ctx.bumps.bundle_collection;
        ctx.accounts.mint_request.metadata_cid = metadata_cid;
        ctx.accounts.mint_request.minted_count = minted_count;
        ctx.accounts.mint_request.edition = edition;

        // Initialize NFT reward state
        ctx.accounts.nft_reward_state.nft_asset = nft_asset_key;
        ctx.accounts.nft_reward_state.bundle = bundle_key;
        ctx.accounts.nft_reward_state.reward_debt = 0;
        ctx.accounts.nft_reward_state.weight = 1; // Default Common weight, will be updated in callback
        ctx.accounts.nft_reward_state.created_at = clock.unix_timestamp;

        // Initialize NFT rarity (will be updated in callback)
        ctx.accounts.nft_rarity.nft_asset = nft_asset_key;
        ctx.accounts.nft_rarity.bundle = bundle_key;
        ctx.accounts.nft_rarity.rarity = Rarity::Common; // Placeholder, callback will set
        ctx.accounts.nft_rarity.weight = 1; // Default Common weight
        ctx.accounts.nft_rarity.revealed_at = 0; // Not revealed yet

        // Initialize bundle reward pool if needed
        if ctx.accounts.bundle_reward_pool.bundle == Pubkey::default() {
            ctx.accounts.bundle_reward_pool.bundle = bundle_key;
            ctx.accounts.bundle_reward_pool.total_deposited = 0;
            ctx.accounts.bundle_reward_pool.total_claimed = 0;
        }

        // Initialize buyer wallet state if needed
        if ctx.accounts.buyer_wallet_state.bundle == Pubkey::default() {
            ctx.accounts.buyer_wallet_state.wallet = payer_key;
            ctx.accounts.buyer_wallet_state.bundle = bundle_key;
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
        ctx.accounts.bundle.pending_count = ctx.accounts.bundle.pending_count.saturating_add(1);

        // Build callback accounts
        let callback_accounts = vec![
            SerializableAccountMeta { pubkey: mint_request_key, is_signer: false, is_writable: true },
            SerializableAccountMeta { pubkey: bundle_key, is_signer: false, is_writable: true },
            SerializableAccountMeta { pubkey: bundle_collection_key, is_signer: false, is_writable: false },
            SerializableAccountMeta { pubkey: collection_asset_key, is_signer: false, is_writable: true },
            SerializableAccountMeta { pubkey: nft_asset_key, is_signer: false, is_writable: true },
            SerializableAccountMeta { pubkey: nft_rarity_key, is_signer: false, is_writable: true },
            SerializableAccountMeta { pubkey: nft_reward_state_key, is_signer: false, is_writable: true },
            SerializableAccountMeta { pubkey: payer_key, is_signer: false, is_writable: true },
            SerializableAccountMeta { pubkey: creator_key, is_signer: false, is_writable: true },
            SerializableAccountMeta { pubkey: treasury_key, is_signer: false, is_writable: true },
            SerializableAccountMeta { pubkey: platform_key, is_signer: false, is_writable: true },
            SerializableAccountMeta { pubkey: bundle_reward_pool_key, is_signer: false, is_writable: true },
            SerializableAccountMeta { pubkey: MPL_CORE_ID, is_signer: false, is_writable: false },
            SerializableAccountMeta { pubkey: anchor_lang::system_program::ID, is_signer: false, is_writable: false },
        ];

        // Generate seed from mint request key
        let caller_seed = solana_sha256_hasher::hashv(&[
            b"mb_bundle_vrf_seed",
            mint_request_key.as_ref(),
            &clock.unix_timestamp.to_le_bytes(),
        ]).to_bytes();

        // Create VRF request instruction
        let vrf_ix = create_request_randomness_ix(RequestRandomnessParams {
            payer: payer_key,
            oracle_queue: oracle_queue_key,
            callback_program_id: crate::ID,
            callback_discriminator: instruction::MagicblockFulfillBundleMint::DISCRIMINATOR.to_vec(),
            caller_seed,
            accounts_metas: Some(callback_accounts),
            ..Default::default()
        });

        // Invoke VRF request CPI
        ctx.accounts.invoke_signed_vrf(&ctx.accounts.payer.to_account_info(), &vrf_ix)?;

        msg!("MagicBlock VRF bundle mint requested for bundle: {}", bundle_key);
        msg!("Mint request: {}", mint_request_key);
        msg!("NFT asset (pending): {}", nft_asset_key);

        Ok(())
    }
}

// ============================================================================
// FULFILL BUNDLE MINT - Oracle callback (no user signature!)
// ============================================================================

/// Oracle callback to fulfill bundle mint with randomness
#[derive(Accounts)]
pub struct MagicBlockFulfillBundleMint<'info> {
    /// CHECK: VRF program identity - validates callback is from VRF oracle
    #[account(address = ephemeral_vrf_sdk::consts::VRF_PROGRAM_IDENTITY)]
    pub vrf_program_identity: Signer<'info>,

    // === Remaining accounts from callback (14 accounts) ===

    /// Mint request (writable)
    #[account(
        mut,
        seeds = [MB_BUNDLE_MINT_REQUEST_SEED, mint_request.buyer.as_ref(), mint_request.bundle.as_ref(), &mint_request.edition.to_le_bytes()],
        bump = mint_request.bump,
        constraint = !mint_request.is_fulfilled @ ContentRegistryError::AlreadyFulfilled
    )]
    pub mint_request: Box<Account<'info, MagicBlockBundleMintRequest>>,

    /// Bundle entry (writable)
    #[account(mut)]
    pub bundle: Box<Account<'info, Bundle>>,

    /// BundleCollection tracker (for signing)
    #[account(
        seeds = [BUNDLE_COLLECTION_SEED, mint_request.bundle.as_ref()],
        bump = mint_request.bundle_collection_bump
    )]
    pub bundle_collection: Box<Account<'info, BundleCollection>>,

    /// CHECK: Collection asset (writable)
    #[account(mut)]
    pub collection_asset: AccountInfo<'info>,

    /// CHECK: NFT asset to create (writable)
    #[account(mut)]
    pub nft_asset: AccountInfo<'info>,

    /// NFT rarity (writable)
    #[account(
        mut,
        seeds = [BUNDLE_NFT_RARITY_SEED, nft_asset.key().as_ref()],
        bump
    )]
    pub nft_rarity: Box<Account<'info, BundleNftRarity>>,

    /// NFT reward state (writable)
    #[account(
        mut,
        seeds = [BUNDLE_NFT_REWARD_STATE_SEED, nft_asset.key().as_ref()],
        bump
    )]
    pub nft_reward_state: Box<Account<'info, BundleNftRewardState>>,

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

    /// Bundle reward pool (writable) - for holder rewards
    #[account(
        mut,
        seeds = [BUNDLE_REWARD_POOL_SEED, mint_request.bundle.as_ref()],
        bump
    )]
    pub bundle_reward_pool: Box<Account<'info, BundleRewardPool>>,

    /// CHECK: MPL Core program
    #[account(address = MPL_CORE_ID)]
    pub mpl_core_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> MagicBlockFulfillBundleMint<'info> {
    pub fn handler(ctx: Context<MagicBlockFulfillBundleMint>, randomness: [u8; 32]) -> Result<()> {
        // Capture all values from mint_request upfront
        let mint_request_key = ctx.accounts.mint_request.key();
        let bundle_key = ctx.accounts.mint_request.bundle;
        let bundle_collection_bump = ctx.accounts.mint_request.bundle_collection_bump;
        let buyer_key = ctx.accounts.mint_request.buyer;
        let mint_request_bump = ctx.accounts.mint_request.bump;
        let nft_bump = ctx.accounts.mint_request.nft_bump;
        let metadata_cid = ctx.accounts.mint_request.metadata_cid.clone();
        let amount_paid = ctx.accounts.mint_request.amount_paid;
        let had_existing_nfts = ctx.accounts.mint_request.had_existing_nfts;

        // Determine rarity from randomness
        let rarity = Rarity::from_random(randomness);
        let weight = rarity.weight();
        let clock = Clock::get()?;

        // Update rarity state
        ctx.accounts.nft_rarity.rarity = rarity.clone();
        ctx.accounts.nft_rarity.weight = weight;
        ctx.accounts.nft_rarity.revealed_at = clock.unix_timestamp;

        // Set weight
        ctx.accounts.nft_reward_state.weight = weight;

        // Calculate edition number
        let edition = ctx.accounts.bundle.minted_count + 1;

        // Build NFT name and URI
        let nft_name = format!("Bundle #{}", edition);
        let nft_uri = format!("https://ipfs.io/ipfs/{}", metadata_cid);

        // Create NFT via Metaplex Core
        let bundle_collection_seeds = &[
            BUNDLE_COLLECTION_SEED,
            bundle_key.as_ref(),
            &[bundle_collection_bump],
        ];

        let _mint_request_seeds = &[
            MB_BUNDLE_MINT_REQUEST_SEED,
            buyer_key.as_ref(),
            bundle_key.as_ref(),
            &[mint_request_bump],
        ];

        let nft_seeds = &[
            MB_BUNDLE_NFT_SEED,
            mint_request_key.as_ref(),
            &[nft_bump],
        ];

        // Create the NFT
        CreateV2CpiBuilder::new(&ctx.accounts.mpl_core_program)
            .asset(&ctx.accounts.nft_asset)
            .collection(Some(&ctx.accounts.collection_asset))
            .authority(Some(&ctx.accounts.bundle_collection.to_account_info()))
            .payer(&ctx.accounts.mint_request.to_account_info())
            .owner(Some(&ctx.accounts.buyer))
            .system_program(&ctx.accounts.system_program.to_account_info())
            .name(nft_name)
            .uri(nft_uri)
            .data_state(DataState::AccountState)
            .invoke_signed(&[bundle_collection_seeds, nft_seeds])?;

        // Update bundle minted count and decrement pending
        ctx.accounts.bundle.minted_count = edition;
        ctx.accounts.bundle.pending_count = ctx.accounts.bundle.pending_count.saturating_sub(1);

        // Lock bundle on first mint
        if edition == 1 {
            ctx.accounts.bundle.is_locked = true;
        }

        // Distribute payment from escrow
        if amount_paid > 0 {
            let (creator_amount, platform_amount, ecosystem_amount, holder_reward_amount) =
                EcosystemConfig::calculate_primary_split(amount_paid);

            // For first NFT, holder reward goes to creator
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

            // Transfer to treasury
            if ecosystem_amount > 0 {
                **mint_request_info.try_borrow_mut_lamports()? -= ecosystem_amount;
                **ctx.accounts.treasury.try_borrow_mut_lamports()? += ecosystem_amount;
            }

            // Transfer holder reward to pool
            if had_existing_nfts && holder_reward_amount > 0 {
                **mint_request_info.try_borrow_mut_lamports()? -= holder_reward_amount;
                **ctx.accounts.bundle_reward_pool.to_account_info().try_borrow_mut_lamports()? += holder_reward_amount;
                ctx.accounts.bundle_reward_pool.add_rewards(holder_reward_amount);
            }

            msg!("Payment distributed: creator={}, platform={}, ecosystem={}, holder_pool={}",
                final_creator_amount, platform_amount, ecosystem_amount,
                if had_existing_nfts { holder_reward_amount } else { 0 });
        }

        // Set reward_debt BEFORE adding NFT to pool
        ctx.accounts.nft_reward_state.reward_debt =
            (weight as u128) * ctx.accounts.bundle_reward_pool.reward_per_share;

        // Add new NFT to pool's tracking
        ctx.accounts.bundle_reward_pool.add_nft(weight);

        // Mark as fulfilled
        ctx.accounts.mint_request.is_fulfilled = true;

        msg!("MagicBlock VRF bundle mint fulfilled!");
        msg!("NFT: {} with rarity {:?} (weight: {})", ctx.accounts.nft_asset.key(), rarity, weight);

        Ok(())
    }
}

// ============================================================================
// CANCEL BUNDLE MINT - Allow user to cancel pending request
// ============================================================================

#[derive(Accounts)]
#[instruction(edition: u64)]
pub struct MagicBlockCancelBundleMint<'info> {
    #[account(mut)]
    pub bundle: Box<Account<'info, Bundle>>,

    #[account(
        mut,
        close = buyer,
        seeds = [MB_BUNDLE_MINT_REQUEST_SEED, buyer.key().as_ref(), bundle.key().as_ref(), &edition.to_le_bytes()],
        bump = mint_request.bump,
        constraint = !mint_request.is_fulfilled @ ContentRegistryError::AlreadyFulfilled,
        constraint = mint_request.buyer == buyer.key() @ ContentRegistryError::Unauthorized
    )]
    pub mint_request: Box<Account<'info, MagicBlockBundleMintRequest>>,

    /// CHECK: NFT asset PDA (not created yet)
    #[account(
        seeds = [MB_BUNDLE_NFT_SEED, mint_request.key().as_ref()],
        bump = mint_request.nft_bump
    )]
    pub nft_asset: AccountInfo<'info>,

    /// CHECK: NFT rarity to close (using AccountInfo to handle schema migration)
    #[account(
        mut,
        seeds = [BUNDLE_NFT_RARITY_SEED, nft_asset.key().as_ref()],
        bump
    )]
    pub nft_rarity: AccountInfo<'info>,

    /// NFT reward state to close
    #[account(
        mut,
        close = buyer,
        seeds = [BUNDLE_NFT_REWARD_STATE_SEED, nft_asset.key().as_ref()],
        bump
    )]
    pub nft_reward_state: Box<Account<'info, BundleNftRewardState>>,

    #[account(mut)]
    pub buyer: Signer<'info>,
}

impl<'info> MagicBlockCancelBundleMint<'info> {
    pub fn handler(ctx: Context<MagicBlockCancelBundleMint>, _edition: u64) -> Result<()> {
        // Decrement pending count
        let bundle = &mut ctx.accounts.bundle;
        bundle.pending_count = bundle.pending_count.saturating_sub(1);

        // Manually close the rarity account (transfer lamports to buyer)
        let rarity_lamports = ctx.accounts.nft_rarity.lamports();
        **ctx.accounts.nft_rarity.try_borrow_mut_lamports()? = 0;
        **ctx.accounts.buyer.try_borrow_mut_lamports()? += rarity_lamports;

        msg!("MagicBlock bundle mint request cancelled, funds returned to buyer");
        Ok(())
    }
}

// ============================================================================
// CLAIM FALLBACK - Mint with slot hash randomness if VRF doesn't respond
// ============================================================================

/// Fallback timeout in seconds (5 seconds)
pub const MB_BUNDLE_FALLBACK_TIMEOUT: i64 = 5;

/// Claim bundle NFT with random rarity using slot hash if VRF oracle doesn't respond
#[derive(Accounts)]
pub struct MagicBlockBundleClaimFallback<'info> {
    /// Mint request (must exist and not be fulfilled) - closed after completion
    #[account(
        mut,
        close = buyer,
        seeds = [MB_BUNDLE_MINT_REQUEST_SEED, mint_request.buyer.as_ref(), mint_request.bundle.as_ref(), &mint_request.edition.to_le_bytes()],
        bump = mint_request.bump,
        constraint = !mint_request.is_fulfilled @ ContentRegistryError::AlreadyFulfilled,
        constraint = mint_request.buyer == buyer.key() @ ContentRegistryError::Unauthorized
    )]
    pub mint_request: Box<Account<'info, MagicBlockBundleMintRequest>>,

    /// Bundle entry (writable for minted_count update)
    #[account(mut)]
    pub bundle: Box<Account<'info, Bundle>>,

    /// BundleCollection tracker (for signing NFT creation)
    #[account(
        seeds = [BUNDLE_COLLECTION_SEED, mint_request.bundle.as_ref()],
        bump = mint_request.bundle_collection_bump
    )]
    pub bundle_collection: Box<Account<'info, BundleCollection>>,

    /// CHECK: Collection asset (writable)
    #[account(mut, constraint = bundle_collection.collection_asset == collection_asset.key())]
    pub collection_asset: AccountInfo<'info>,

    /// CHECK: NFT asset to create (writable)
    #[account(
        mut,
        seeds = [MB_BUNDLE_NFT_SEED, mint_request.key().as_ref()],
        bump = mint_request.nft_bump
    )]
    pub nft_asset: AccountInfo<'info>,

    /// NFT rarity (writable)
    #[account(
        mut,
        seeds = [BUNDLE_NFT_RARITY_SEED, nft_asset.key().as_ref()],
        bump
    )]
    pub nft_rarity: Box<Account<'info, BundleNftRarity>>,

    /// NFT reward state (writable)
    #[account(
        mut,
        seeds = [BUNDLE_NFT_REWARD_STATE_SEED, nft_asset.key().as_ref()],
        bump
    )]
    pub nft_reward_state: Box<Account<'info, BundleNftRewardState>>,

    /// Buyer who initiated the mint
    #[account(mut)]
    pub buyer: Signer<'info>,

    /// CHECK: Creator - receives payment
    #[account(mut, constraint = mint_request.creator == creator.key())]
    pub creator: AccountInfo<'info>,

    /// CHECK: Treasury - receives fee
    #[account(mut, constraint = mint_request.treasury == treasury.key())]
    pub treasury: AccountInfo<'info>,

    /// CHECK: Platform - receives fee
    #[account(mut, constraint = mint_request.platform == platform.key())]
    pub platform: AccountInfo<'info>,

    /// Bundle reward pool - for holder rewards
    #[account(
        mut,
        seeds = [BUNDLE_REWARD_POOL_SEED, mint_request.bundle.as_ref()],
        bump
    )]
    pub bundle_reward_pool: Box<Account<'info, BundleRewardPool>>,

    /// CHECK: MPL Core program
    #[account(address = MPL_CORE_ID)]
    pub mpl_core_program: AccountInfo<'info>,

    /// CHECK: Slot hashes sysvar for randomness
    #[account(address = anchor_lang::solana_program::sysvar::slot_hashes::ID)]
    pub slot_hashes: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> MagicBlockBundleClaimFallback<'info> {
    pub fn handler(ctx: Context<MagicBlockBundleClaimFallback>) -> Result<()> {
        let clock = Clock::get()?;

        // Check timeout has passed
        let created_at = ctx.accounts.mint_request.created_at;
        let elapsed = clock.unix_timestamp - created_at;
        require!(
            elapsed >= MB_BUNDLE_FALLBACK_TIMEOUT,
            ContentRegistryError::FallbackTooEarly
        );

        // Capture all values from mint_request upfront
        let mint_request_key = ctx.accounts.mint_request.key();
        let bundle_key = ctx.accounts.mint_request.bundle;
        let bundle_collection_bump = ctx.accounts.mint_request.bundle_collection_bump;
        let buyer_key = ctx.accounts.mint_request.buyer;
        let nft_bump = ctx.accounts.mint_request.nft_bump;
        let metadata_cid = ctx.accounts.mint_request.metadata_cid.clone();
        let amount_paid = ctx.accounts.mint_request.amount_paid;
        let had_existing_nfts = ctx.accounts.mint_request.had_existing_nfts;

        // Generate randomness from slot hashes
        let slot_hashes_data = ctx.accounts.slot_hashes.try_borrow_data()?;

        let randomness_seed = solana_sha256_hasher::hashv(&[
            &slot_hashes_data[..std::cmp::min(64, slot_hashes_data.len())],
            mint_request_key.as_ref(),
            buyer_key.as_ref(),
            &clock.unix_timestamp.to_le_bytes(),
            &clock.slot.to_le_bytes(),
        ]);

        // Determine rarity from slot hash
        let rarity = Rarity::from_random(randomness_seed.to_bytes());
        let weight = rarity.weight();

        // Update rarity state
        ctx.accounts.nft_rarity.rarity = rarity.clone();
        ctx.accounts.nft_rarity.weight = weight;
        ctx.accounts.nft_rarity.revealed_at = clock.unix_timestamp;

        // Set weight
        ctx.accounts.nft_reward_state.weight = weight;

        // Calculate edition number
        let edition = ctx.accounts.bundle.minted_count + 1;

        // Build NFT name and URI
        let nft_name = format!("Bundle #{}", edition);
        let nft_uri = format!("https://ipfs.io/ipfs/{}", metadata_cid);

        // Create NFT via Metaplex Core
        let bundle_collection_seeds = &[
            BUNDLE_COLLECTION_SEED,
            bundle_key.as_ref(),
            &[bundle_collection_bump],
        ];

        let nft_seeds = &[
            MB_BUNDLE_NFT_SEED,
            mint_request_key.as_ref(),
            &[nft_bump],
        ];

        // Create the NFT
        CreateV2CpiBuilder::new(&ctx.accounts.mpl_core_program)
            .asset(&ctx.accounts.nft_asset)
            .collection(Some(&ctx.accounts.collection_asset))
            .authority(Some(&ctx.accounts.bundle_collection.to_account_info()))
            .payer(&ctx.accounts.buyer.to_account_info())
            .owner(Some(&ctx.accounts.buyer.to_account_info()))
            .system_program(&ctx.accounts.system_program.to_account_info())
            .name(nft_name)
            .uri(nft_uri)
            .data_state(DataState::AccountState)
            .invoke_signed(&[bundle_collection_seeds, nft_seeds])?;

        // Update bundle minted count and decrement pending
        ctx.accounts.bundle.minted_count = edition;
        ctx.accounts.bundle.pending_count = ctx.accounts.bundle.pending_count.saturating_sub(1);

        // Lock bundle on first mint
        if edition == 1 {
            ctx.accounts.bundle.is_locked = true;
        }

        // Distribute payment from escrow
        if amount_paid > 0 {
            let (creator_amount, platform_amount, ecosystem_amount, holder_reward_amount) =
                EcosystemConfig::calculate_primary_split(amount_paid);

            let final_creator_amount = if !had_existing_nfts {
                creator_amount + holder_reward_amount
            } else {
                creator_amount
            };

            let mint_request_info = ctx.accounts.mint_request.to_account_info();

            if final_creator_amount > 0 {
                **mint_request_info.try_borrow_mut_lamports()? -= final_creator_amount;
                **ctx.accounts.creator.try_borrow_mut_lamports()? += final_creator_amount;
            }

            if platform_amount > 0 {
                **mint_request_info.try_borrow_mut_lamports()? -= platform_amount;
                **ctx.accounts.platform.try_borrow_mut_lamports()? += platform_amount;
            }

            if ecosystem_amount > 0 {
                **mint_request_info.try_borrow_mut_lamports()? -= ecosystem_amount;
                **ctx.accounts.treasury.try_borrow_mut_lamports()? += ecosystem_amount;
            }

            if had_existing_nfts && holder_reward_amount > 0 {
                **mint_request_info.try_borrow_mut_lamports()? -= holder_reward_amount;
                **ctx.accounts.bundle_reward_pool.to_account_info().try_borrow_mut_lamports()? += holder_reward_amount;
                ctx.accounts.bundle_reward_pool.add_rewards(holder_reward_amount);
            }

            msg!("Payment distributed: creator={}, platform={}, ecosystem={}, holder_pool={}",
                final_creator_amount, platform_amount, ecosystem_amount,
                if had_existing_nfts { holder_reward_amount } else { 0 });
        }

        // Set reward_debt BEFORE adding NFT to pool
        ctx.accounts.nft_reward_state.reward_debt =
            (weight as u128) * ctx.accounts.bundle_reward_pool.reward_per_share;

        // Add new NFT to pool's tracking
        ctx.accounts.bundle_reward_pool.add_nft(weight);

        msg!("MagicBlock fallback bundle mint completed with slot hash randomness!");
        msg!("NFT: {} with {:?} rarity (weight: {}) - VRF timeout after {}s",
            ctx.accounts.nft_asset.key(), rarity, weight, elapsed);

        Ok(())
    }
}

// ============================================================================
// CLOSE FULFILLED REQUEST - Clean up completed mint request
// ============================================================================

#[derive(Accounts)]
pub struct MagicBlockCloseFulfilledBundle<'info> {
    #[account(
        mut,
        close = buyer,
        seeds = [MB_BUNDLE_MINT_REQUEST_SEED, buyer.key().as_ref(), mint_request.bundle.as_ref(), &mint_request.edition.to_le_bytes()],
        bump = mint_request.bump,
        constraint = mint_request.is_fulfilled @ ContentRegistryError::NotFulfilled,
        constraint = mint_request.buyer == buyer.key() @ ContentRegistryError::Unauthorized
    )]
    pub mint_request: Box<Account<'info, MagicBlockBundleMintRequest>>,

    #[account(mut)]
    pub buyer: Signer<'info>,
}

impl<'info> MagicBlockCloseFulfilledBundle<'info> {
    pub fn handler(_ctx: Context<MagicBlockCloseFulfilledBundle>) -> Result<()> {
        msg!("Fulfilled MagicBlock bundle mint request closed");
        Ok(())
    }
}
