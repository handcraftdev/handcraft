use anchor_lang::prelude::*;
use mpl_core::instructions::CreateV2CpiBuilder;
use mpl_core::types::{DataState, Plugin, PluginAuthority, PluginAuthorityPair, PermanentBurnDelegate};

use crate::state::*;
use crate::errors::ContentRegistryError;
use crate::contexts::subscription_mint::{
    calculate_virtual_rps,
    maybe_distribute_patron_pool,
    maybe_distribute_ecosystem_pools,
};
use crate::MPL_CORE_ID;

/// Seed for simple mint NFT assets
pub const SIMPLE_NFT_SEED: &[u8] = b"simple_nft";

// ============================================================================
// SIMPLE MINT - Content NFT with Slot Hash Randomness + Subscription Pools
// ============================================================================

/// Simple mint NFT with slot hash randomness and full subscription pool integration
/// Single transaction - no VRF dependency, immediate mint, tracks all reward pools
#[derive(Accounts)]
pub struct SimpleMint<'info> {
    // =========================================================================
    // Core accounts
    // =========================================================================

    #[account(
        mut,
        seeds = [ECOSYSTEM_CONFIG_SEED],
        bump
    )]
    pub ecosystem_config: Box<Account<'info, EcosystemConfig>>,

    #[account(mut)]
    pub content: Box<Account<'info, ContentEntry>>,

    /// MintConfig PDA - authority for collection operations (signs NFT creation)
    #[account(
        seeds = [MINT_CONFIG_SEED, content.key().as_ref()],
        bump
    )]
    pub mint_config: Box<Account<'info, MintConfig>>,

    /// Content-specific reward pool (IMMEDIATE distribution)
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + ContentRewardPool::INIT_SPACE,
        seeds = [CONTENT_REWARD_POOL_SEED, content.key().as_ref()],
        bump
    )]
    pub content_reward_pool: Box<Account<'info, ContentRewardPool>>,

    /// The Metaplex Core Collection asset
    /// CHECK: Verified via content.collection_asset
    #[account(
        mut,
        constraint = collection_asset.key() == content.collection_asset @ ContentRegistryError::InvalidCollection
    )]
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

    // =========================================================================
    // NFT accounts
    // =========================================================================

    /// CHECK: NFT asset - PDA based on buyer, content, and edition
    #[account(
        mut,
        seeds = [SIMPLE_NFT_SEED, payer.key().as_ref(), content.key().as_ref(), &(content.minted_count + 1).to_le_bytes()],
        bump
    )]
    pub nft_asset: AccountInfo<'info>,

    // NOTE: nft_reward_state and nft_rarity removed - all data in unified_nft_state

    // =========================================================================
    // Subscription pool accounts (LAZY distribution pools)
    // =========================================================================

    /// Unified NFT reward state - tracks debts for all pools + rarity
    #[account(
        init,
        payer = payer,
        space = 8 + UnifiedNftRewardState::INIT_SPACE,
        seeds = [UNIFIED_NFT_REWARD_STATE_SEED, nft_asset.key().as_ref()],
        bump
    )]
    pub unified_nft_state: Box<Account<'info, UnifiedNftRewardState>>,

    /// Global holder pool (12% of ecosystem subscriptions) - singleton
    #[account(
        mut,
        seeds = [GLOBAL_HOLDER_POOL_SEED],
        bump
    )]
    pub global_holder_pool: Box<Account<'info, GlobalHolderPool>>,

    /// Creator distribution pool (80% of ecosystem subscriptions) - singleton
    #[account(
        mut,
        seeds = [CREATOR_DIST_POOL_SEED],
        bump
    )]
    pub creator_dist_pool: Box<Account<'info, CreatorDistPool>>,

    /// Creator's patron pool (12% of patron subscriptions) - per creator, lazy init
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + CreatorPatronPool::INIT_SPACE,
        seeds = [CREATOR_PATRON_POOL_SEED, creator.key().as_ref()],
        bump
    )]
    pub creator_patron_pool: Box<Account<'info, CreatorPatronPool>>,

    /// Creator's weight for ecosystem payouts - per creator, lazy init
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + CreatorWeight::INIT_SPACE,
        seeds = [CREATOR_WEIGHT_SEED, creator.key().as_ref()],
        bump
    )]
    pub creator_weight: Box<Account<'info, CreatorWeight>>,

    // =========================================================================
    // Streaming treasury accounts (for lazy distribution)
    // =========================================================================

    /// Creator's patron streaming treasury - receives Streamflow payments
    /// CHECK: PDA verified by seeds
    #[account(
        mut,
        seeds = [CREATOR_PATRON_TREASURY_SEED, creator.key().as_ref()],
        bump
    )]
    pub creator_patron_treasury: AccountInfo<'info>,

    /// Ecosystem streaming treasury - receives ecosystem subscription payments
    /// CHECK: PDA verified by seeds
    #[account(
        mut,
        seeds = [ECOSYSTEM_STREAMING_TREASURY_SEED],
        bump
    )]
    pub ecosystem_streaming_treasury: AccountInfo<'info>,

    /// Ecosystem epoch state - shared epoch tracking for lazy distribution
    #[account(
        mut,
        seeds = [ECOSYSTEM_EPOCH_STATE_SEED],
        bump
    )]
    pub ecosystem_epoch_state: Box<Account<'info, EcosystemEpochState>>,

    // NOTE: platform_treasury removed - use platform (variable host operator) for 5% fee
    // NOTE: ecosystem_treasury removed - use treasury (ecosystem_config.treasury) for 3% fee

    // =========================================================================
    // Payer and system accounts
    // =========================================================================

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

impl<'info> SimpleMint<'info> {
    pub fn handler(ctx: Context<SimpleMint>, content_name: String) -> Result<()> {
        // Validate content name (1-32 chars for Metaplex Core)
        require!(
            !content_name.is_empty() && content_name.len() <= 32,
            ContentRegistryError::InvalidContentName
        );

        let clock = Clock::get()?;
        let timestamp = clock.unix_timestamp;

        // Capture values upfront
        let payer_key = ctx.accounts.payer.key();
        let content_key = ctx.accounts.content.key();
        let creator_key = ctx.accounts.creator.key();
        let nft_asset_key = ctx.accounts.nft_asset.key();

        // =====================================================================
        // STEP 0: Validation
        // =====================================================================

        require!(ctx.accounts.mint_config.is_active, ContentRegistryError::MintingNotActive);
        require!(!ctx.accounts.ecosystem_config.is_paused, ContentRegistryError::EcosystemPaused);

        if let Some(max_supply) = ctx.accounts.mint_config.max_supply {
            require!(ctx.accounts.content.minted_count < max_supply, ContentRegistryError::MaxSupplyReached);
        }

        let mint_price = ctx.accounts.mint_config.price;
        let had_existing_nfts = ctx.accounts.content_reward_pool.total_weight > 0;

        // =====================================================================
        // STEP 1: Generate randomness from slot hashes
        // =====================================================================

        let slot_hashes_data = ctx.accounts.slot_hashes.try_borrow_data()?;
        let randomness_seed = solana_sha256_hasher::hashv(&[
            &slot_hashes_data[..std::cmp::min(64, slot_hashes_data.len())],
            nft_asset_key.as_ref(),
            payer_key.as_ref(),
            &timestamp.to_le_bytes(),
            &clock.slot.to_le_bytes(),
        ]);

        let (rarity, weight) = determine_rarity_from_bytes(randomness_seed.to_bytes());

        // =====================================================================
        // STEP 2: Initialize pool accounts if needed (lazy init)
        // =====================================================================

        // Initialize content reward pool if first mint
        if ctx.accounts.content_reward_pool.content == Pubkey::default() {
            ctx.accounts.content_reward_pool.content = content_key;
            ctx.accounts.content_reward_pool.total_deposited = 0;
            ctx.accounts.content_reward_pool.total_claimed = 0;
            ctx.accounts.content_reward_pool.created_at = timestamp;
        }

        // Initialize creator patron pool if first mint for this creator
        if ctx.accounts.creator_patron_pool.creator == Pubkey::default() {
            ctx.accounts.creator_patron_pool.creator = creator_key;
            ctx.accounts.creator_patron_pool.reward_per_share = 0;
            ctx.accounts.creator_patron_pool.total_weight = 0;
            ctx.accounts.creator_patron_pool.total_deposited = 0;
            ctx.accounts.creator_patron_pool.total_claimed = 0;
            ctx.accounts.creator_patron_pool.last_distribution_at = timestamp;
            ctx.accounts.creator_patron_pool.epoch_duration = DEFAULT_EPOCH_DURATION;
            ctx.accounts.creator_patron_pool.created_at = timestamp;
        }

        // Initialize creator weight if first mint for this creator
        if ctx.accounts.creator_weight.creator == Pubkey::default() {
            ctx.accounts.creator_weight.creator = creator_key;
            ctx.accounts.creator_weight.total_weight = 0;
            ctx.accounts.creator_weight.reward_debt = 0;
            ctx.accounts.creator_weight.total_claimed = 0;
            ctx.accounts.creator_weight.created_at = timestamp;
        }

        // =====================================================================
        // STEP 2.5: Trigger epoch distribution if needed (Option B - call first)
        // =====================================================================

        // Get platform treasury (use treasury as fallback if platform not provided)
        let platform_treasury_info = ctx.accounts.platform.as_ref()
            .map(|p| p.to_account_info())
            .unwrap_or_else(|| ctx.accounts.treasury.to_account_info());

        // Patron pool distribution (drains creator_patron_treasury at epoch end)
        let creator_key = ctx.accounts.creator.key();
        maybe_distribute_patron_pool(
            &mut ctx.accounts.creator_patron_pool,
            &ctx.accounts.creator_patron_treasury,
            &ctx.accounts.creator,
            &platform_treasury_info,
            &ctx.accounts.treasury,
            timestamp,
            &ctx.accounts.system_program.to_account_info(),
            &creator_key,
        )?;

        // Ecosystem pools distribution (drains ecosystem_streaming_treasury at epoch end)
        maybe_distribute_ecosystem_pools(
            &mut ctx.accounts.global_holder_pool,
            &mut ctx.accounts.creator_dist_pool,
            &mut ctx.accounts.ecosystem_epoch_state,
            &ctx.accounts.ecosystem_streaming_treasury,
            &platform_treasury_info,
            &ctx.accounts.treasury,
            timestamp,
            &ctx.accounts.system_program.to_account_info(),
        )?;

        // =====================================================================
        // STEP 3: Create NFT via Metaplex Core
        // =====================================================================

        let edition = ctx.accounts.content.minted_count + 1;
        // NFT name format: "<ContentName> (<R> #XXXXXX)" where R is single-letter rarity code
        let nft_name = format!("{} ({} #{:06})", content_name, rarity.code(), edition);
        // NFT metadata served from API (not stored on-chain)
        let nft_uri = format!("https://handcraft.art/api/content/{}/metadata", content_key);

        let mint_config_seeds = &[
            MINT_CONFIG_SEED,
            content_key.as_ref(),
            &[ctx.bumps.mint_config],
        ];

        let nft_seeds = &[
            SIMPLE_NFT_SEED,
            payer_key.as_ref(),
            content_key.as_ref(),
            &edition.to_le_bytes(),
            &[ctx.bumps.nft_asset],
        ];

        // Create PermanentBurnDelegate plugin with mint_config PDA as authority
        // This allows our program to burn NFTs via burn_nft_with_subscription instruction
        let burn_delegate_plugin = PluginAuthorityPair {
            plugin: Plugin::PermanentBurnDelegate(PermanentBurnDelegate {}),
            authority: Some(PluginAuthority::Address {
                address: ctx.accounts.mint_config.key()
            }),
        };

        CreateV2CpiBuilder::new(&ctx.accounts.mpl_core_program)
            .asset(&ctx.accounts.nft_asset)
            .collection(Some(&ctx.accounts.collection_asset))
            .authority(Some(&ctx.accounts.mint_config.to_account_info()))
            .payer(&ctx.accounts.payer.to_account_info())
            .owner(Some(&ctx.accounts.payer.to_account_info()))
            .system_program(&ctx.accounts.system_program.to_account_info())
            .name(nft_name)
            .uri(nft_uri)
            .data_state(DataState::AccountState)
            .plugins(vec![burn_delegate_plugin])
            .invoke_signed(&[mint_config_seeds, nft_seeds])?;

        // Update content minted count
        ctx.accounts.content.minted_count = edition;

        // =====================================================================
        // STEP 4: Distribute payment (80/5/3/12 split)
        // =====================================================================

        if mint_price > 0 {
            let (creator_amount, platform_amount, ecosystem_amount, holder_reward_amount) =
                EcosystemConfig::calculate_primary_split(mint_price);

            // For first NFT, holder reward goes to creator (no holders yet)
            let final_creator_amount = if !had_existing_nfts {
                creator_amount + holder_reward_amount
            } else {
                creator_amount
            };

            // Transfer to creator (80% + 12% if first mint)
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

            // Transfer to platform (5%)
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

            // Transfer to ecosystem treasury (3%)
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

            // Transfer holder reward to content pool (12%) and update RPS
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
                // Update reward_per_share BEFORE adding new NFT weight
                ctx.accounts.content_reward_pool.add_rewards(holder_reward_amount);
            }

            msg!("Payment: creator={}, platform={}, ecosystem={}, holder_pool={}",
                final_creator_amount, platform_amount, ecosystem_amount,
                if had_existing_nfts { holder_reward_amount } else { 0 });
        }

        // =====================================================================
        // STEP 5: Set reward debts BEFORE adding NFT weight to pools
        // =====================================================================

        // Content pool debt (IMMEDIATE pool - use actual RPS)
        let content_debt = (weight as u128) * ctx.accounts.content_reward_pool.reward_per_share;

        // =====================================================================
        // Calculate virtual RPS for LAZY pools (includes undistributed treasury)
        // =====================================================================

        // Get streaming treasury balances for virtual RPS calculation
        let patron_treasury_balance = ctx.accounts.creator_patron_treasury.lamports();
        let eco_treasury_balance = ctx.accounts.ecosystem_streaming_treasury.lamports();

        // Patron pool virtual RPS (12% of streaming treasury goes to holder pool)
        let virtual_patron_rps = calculate_virtual_rps(
            ctx.accounts.creator_patron_pool.reward_per_share,
            patron_treasury_balance,
            12, // holder share percentage
            ctx.accounts.creator_patron_pool.total_weight + weight as u64, // include new NFT weight
        );

        // Global holder pool virtual RPS (12% of ecosystem treasury)
        let virtual_global_rps = calculate_virtual_rps(
            ctx.accounts.global_holder_pool.reward_per_share,
            eco_treasury_balance,
            12, // holder share percentage
            ctx.accounts.global_holder_pool.total_weight + weight as u64, // include new NFT weight
        );

        // Creator dist pool virtual RPS (80% of ecosystem treasury)
        let virtual_creator_dist_rps = calculate_virtual_rps(
            ctx.accounts.creator_dist_pool.reward_per_share,
            eco_treasury_balance,
            80, // creator share percentage
            ctx.accounts.creator_dist_pool.total_weight + weight as u64, // include new NFT weight
        );

        // Patron pool debt (LAZY pool - use VIRTUAL RPS)
        let patron_debt = (weight as u128) * virtual_patron_rps;

        // Global holder pool debt (LAZY pool - use VIRTUAL RPS)
        let global_debt = (weight as u128) * virtual_global_rps;

        // Creator dist pool debt (LAZY pool - use VIRTUAL RPS) - ADD to creator's accumulated debt
        let creator_debt_increment = (weight as u128) * virtual_creator_dist_rps;

        // =====================================================================
        // STEP 6: Initialize NFT state account
        // =====================================================================

        // UnifiedNftRewardState (tracks rarity + all pool debts)
        ctx.accounts.unified_nft_state.nft_asset = nft_asset_key;
        ctx.accounts.unified_nft_state.creator = creator_key;
        ctx.accounts.unified_nft_state.rarity = rarity.clone();
        ctx.accounts.unified_nft_state.weight = weight;
        ctx.accounts.unified_nft_state.is_bundle = false;
        ctx.accounts.unified_nft_state.content_or_bundle = content_key;
        ctx.accounts.unified_nft_state.content_or_bundle_debt = content_debt;
        ctx.accounts.unified_nft_state.patron_debt = patron_debt;
        ctx.accounts.unified_nft_state.global_debt = global_debt;
        ctx.accounts.unified_nft_state.created_at = timestamp;

        // =====================================================================
        // STEP 7: Add NFT weight to ALL pools (AFTER setting debts)
        // =====================================================================

        // Content reward pool
        ctx.accounts.content_reward_pool.add_nft(weight);

        // Creator patron pool
        ctx.accounts.creator_patron_pool.total_weight += weight as u64;

        // Global holder pool
        ctx.accounts.global_holder_pool.total_weight += weight as u64;

        // Creator dist pool
        ctx.accounts.creator_dist_pool.total_weight += weight as u64;

        // Creator weight (ADD debt, not SET)
        ctx.accounts.creator_weight.total_weight += weight as u64;
        ctx.accounts.creator_weight.reward_debt += creator_debt_increment;

        msg!("Simple mint completed!");
        msg!("NFT: {} | Rarity: {:?} | Weight: {}", nft_asset_key, rarity, weight);
        msg!("Pools updated: content={}, patron={}, global={}, creator_dist={}",
            ctx.accounts.content_reward_pool.total_weight,
            ctx.accounts.creator_patron_pool.total_weight,
            ctx.accounts.global_holder_pool.total_weight,
            ctx.accounts.creator_dist_pool.total_weight);

        Ok(())
    }
}

// ============================================================================
// SIMPLE MINT - Bundle NFT with Slot Hash Randomness + Subscription Pools
// ============================================================================

/// Simple mint Bundle NFT with slot hash randomness and full subscription pool integration
#[derive(Accounts)]
pub struct SimpleMintBundle<'info> {
    // =========================================================================
    // Core accounts
    // =========================================================================

    #[account(
        mut,
        seeds = [ECOSYSTEM_CONFIG_SEED],
        bump
    )]
    pub ecosystem_config: Box<Account<'info, EcosystemConfig>>,

    #[account(mut)]
    pub bundle: Box<Account<'info, Bundle>>,

    /// BundleMintConfig PDA - authority for collection operations (signs NFT creation)
    #[account(
        seeds = [BUNDLE_MINT_CONFIG_SEED, bundle.key().as_ref()],
        bump
    )]
    pub bundle_mint_config: Box<Account<'info, BundleMintConfig>>,

    /// Bundle-specific reward pool (IMMEDIATE distribution)
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + BundleRewardPool::INIT_SPACE,
        seeds = [BUNDLE_REWARD_POOL_SEED, bundle.key().as_ref()],
        bump
    )]
    pub bundle_reward_pool: Box<Account<'info, BundleRewardPool>>,

    /// The Metaplex Core Collection asset
    /// CHECK: Verified via bundle.collection_asset
    #[account(
        mut,
        constraint = collection_asset.key() == bundle.collection_asset @ ContentRegistryError::BundleMismatch
    )]
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

    // =========================================================================
    // NFT accounts
    // =========================================================================

    /// CHECK: NFT asset - PDA based on buyer, bundle, and edition
    #[account(
        mut,
        seeds = [SIMPLE_NFT_SEED, payer.key().as_ref(), bundle.key().as_ref(), &(bundle.minted_count + 1).to_le_bytes()],
        bump
    )]
    pub nft_asset: AccountInfo<'info>,

    // NOTE: bundle_nft_reward_state and bundle_nft_rarity removed - all data in unified_nft_state

    // =========================================================================
    // Subscription pool accounts
    // =========================================================================

    /// Unified NFT reward state - tracks debts for all pools + rarity
    #[account(
        init,
        payer = payer,
        space = 8 + UnifiedNftRewardState::INIT_SPACE,
        seeds = [UNIFIED_NFT_REWARD_STATE_SEED, nft_asset.key().as_ref()],
        bump
    )]
    pub unified_nft_state: Box<Account<'info, UnifiedNftRewardState>>,

    /// Global holder pool (singleton)
    #[account(
        mut,
        seeds = [GLOBAL_HOLDER_POOL_SEED],
        bump
    )]
    pub global_holder_pool: Box<Account<'info, GlobalHolderPool>>,

    /// Creator distribution pool (singleton)
    #[account(
        mut,
        seeds = [CREATOR_DIST_POOL_SEED],
        bump
    )]
    pub creator_dist_pool: Box<Account<'info, CreatorDistPool>>,

    /// Creator's patron pool (lazy init)
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + CreatorPatronPool::INIT_SPACE,
        seeds = [CREATOR_PATRON_POOL_SEED, creator.key().as_ref()],
        bump
    )]
    pub creator_patron_pool: Box<Account<'info, CreatorPatronPool>>,

    /// Creator's weight (lazy init)
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + CreatorWeight::INIT_SPACE,
        seeds = [CREATOR_WEIGHT_SEED, creator.key().as_ref()],
        bump
    )]
    pub creator_weight: Box<Account<'info, CreatorWeight>>,

    // =========================================================================
    // Streaming treasury accounts (for lazy distribution)
    // =========================================================================

    /// Creator's patron streaming treasury - receives Streamflow payments
    /// CHECK: PDA verified by seeds
    #[account(
        mut,
        seeds = [CREATOR_PATRON_TREASURY_SEED, creator.key().as_ref()],
        bump
    )]
    pub creator_patron_treasury: AccountInfo<'info>,

    /// Ecosystem streaming treasury - receives ecosystem subscription payments
    /// CHECK: PDA verified by seeds
    #[account(
        mut,
        seeds = [ECOSYSTEM_STREAMING_TREASURY_SEED],
        bump
    )]
    pub ecosystem_streaming_treasury: AccountInfo<'info>,

    /// Ecosystem epoch state - shared epoch tracking for lazy distribution
    #[account(
        mut,
        seeds = [ECOSYSTEM_EPOCH_STATE_SEED],
        bump
    )]
    pub ecosystem_epoch_state: Box<Account<'info, EcosystemEpochState>>,

    // NOTE: platform_treasury removed - use platform (variable host operator) for 5% fee
    // NOTE: ecosystem_treasury removed - use treasury (ecosystem_config.treasury) for 3% fee

    // =========================================================================
    // Payer and system accounts
    // =========================================================================

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

impl<'info> SimpleMintBundle<'info> {
    pub fn handler<'a>(ctx: Context<'_, '_, 'a, 'a, SimpleMintBundle<'a>>, bundle_name: String) -> Result<()> {
        // Validate bundle name (1-32 chars for Metaplex Core)
        require!(
            !bundle_name.is_empty() && bundle_name.len() <= 32,
            ContentRegistryError::InvalidContentName
        );

        let clock = Clock::get()?;
        let timestamp = clock.unix_timestamp;

        let payer_key = ctx.accounts.payer.key();
        let bundle_key = ctx.accounts.bundle.key();
        let creator_key = ctx.accounts.creator.key();
        let nft_asset_key = ctx.accounts.nft_asset.key();

        // Validation
        require!(ctx.accounts.bundle_mint_config.is_active, ContentRegistryError::MintingNotActive);
        require!(!ctx.accounts.ecosystem_config.is_paused, ContentRegistryError::EcosystemPaused);
        require!(!ctx.accounts.bundle.is_locked || ctx.accounts.bundle.minted_count > 0, ContentRegistryError::BundleLocked);

        if let Some(max_supply) = ctx.accounts.bundle_mint_config.max_supply {
            require!(ctx.accounts.bundle.minted_count < max_supply, ContentRegistryError::MaxSupplyReached);
        }

        let mint_price = ctx.accounts.bundle_mint_config.price;
        let had_existing_nfts = ctx.accounts.bundle_reward_pool.total_weight > 0;

        // Generate randomness
        let slot_hashes_data = ctx.accounts.slot_hashes.try_borrow_data()?;
        let randomness_seed = solana_sha256_hasher::hashv(&[
            &slot_hashes_data[..std::cmp::min(64, slot_hashes_data.len())],
            nft_asset_key.as_ref(),
            payer_key.as_ref(),
            &timestamp.to_le_bytes(),
            &clock.slot.to_le_bytes(),
        ]);

        let (rarity, weight) = determine_rarity_from_bytes(randomness_seed.to_bytes());

        // Initialize pools if needed
        if ctx.accounts.bundle_reward_pool.bundle == Pubkey::default() {
            ctx.accounts.bundle_reward_pool.bundle = bundle_key;
            ctx.accounts.bundle_reward_pool.created_at = timestamp;
        }

        if ctx.accounts.creator_patron_pool.creator == Pubkey::default() {
            ctx.accounts.creator_patron_pool.creator = creator_key;
            ctx.accounts.creator_patron_pool.last_distribution_at = timestamp;
            ctx.accounts.creator_patron_pool.epoch_duration = DEFAULT_EPOCH_DURATION;
            ctx.accounts.creator_patron_pool.created_at = timestamp;
        }

        if ctx.accounts.creator_weight.creator == Pubkey::default() {
            ctx.accounts.creator_weight.creator = creator_key;
            ctx.accounts.creator_weight.created_at = timestamp;
        }

        // Get platform treasury (use treasury as fallback if platform not provided)
        let platform_treasury_info = ctx.accounts.platform.as_ref()
            .map(|p| p.to_account_info())
            .unwrap_or_else(|| ctx.accounts.treasury.to_account_info());

        // Trigger epoch distribution if needed (Option B - call first)
        let creator_key = ctx.accounts.creator.key();
        maybe_distribute_patron_pool(
            &mut ctx.accounts.creator_patron_pool,
            &ctx.accounts.creator_patron_treasury,
            &ctx.accounts.creator,
            &platform_treasury_info,
            &ctx.accounts.treasury,
            timestamp,
            &ctx.accounts.system_program.to_account_info(),
            &creator_key,
        )?;

        maybe_distribute_ecosystem_pools(
            &mut ctx.accounts.global_holder_pool,
            &mut ctx.accounts.creator_dist_pool,
            &mut ctx.accounts.ecosystem_epoch_state,
            &ctx.accounts.ecosystem_streaming_treasury,
            &platform_treasury_info,
            &ctx.accounts.treasury,
            timestamp,
            &ctx.accounts.system_program.to_account_info(),
        )?;

        // Create NFT
        let edition = ctx.accounts.bundle.minted_count + 1;
        // NFT name format: "<BundleName> (<R> #XXXXXX)" where R is single-letter rarity code
        let nft_name = format!("{} ({} #{:06})", bundle_name, rarity.code(), edition);
        // NFT metadata served from API (not stored on-chain)
        let nft_uri = format!("https://handcraft.art/api/bundle/{}/metadata", ctx.accounts.bundle.bundle_id);

        let bundle_mint_config_seeds = &[
            BUNDLE_MINT_CONFIG_SEED,
            bundle_key.as_ref(),
            &[ctx.bumps.bundle_mint_config],
        ];

        let nft_seeds = &[
            SIMPLE_NFT_SEED,
            payer_key.as_ref(),
            bundle_key.as_ref(),
            &edition.to_le_bytes(),
            &[ctx.bumps.nft_asset],
        ];

        // Create PermanentBurnDelegate plugin with bundle_mint_config PDA as authority
        // This allows our program to burn NFTs via burn_bundle_nft_with_subscription instruction
        let burn_delegate_plugin = PluginAuthorityPair {
            plugin: Plugin::PermanentBurnDelegate(PermanentBurnDelegate {}),
            authority: Some(PluginAuthority::Address {
                address: ctx.accounts.bundle_mint_config.key()
            }),
        };

        CreateV2CpiBuilder::new(&ctx.accounts.mpl_core_program)
            .asset(&ctx.accounts.nft_asset)
            .collection(Some(&ctx.accounts.collection_asset))
            .authority(Some(&ctx.accounts.bundle_mint_config.to_account_info()))
            .payer(&ctx.accounts.payer.to_account_info())
            .owner(Some(&ctx.accounts.payer.to_account_info()))
            .system_program(&ctx.accounts.system_program.to_account_info())
            .name(nft_name)
            .uri(nft_uri)
            .data_state(DataState::AccountState)
            .plugins(vec![burn_delegate_plugin])
            .invoke_signed(&[bundle_mint_config_seeds, nft_seeds])?;

        // Update bundle state
        ctx.accounts.bundle.minted_count = edition;
        if !ctx.accounts.bundle.is_locked {
            ctx.accounts.bundle.is_locked = true;
        }

        // Distribute payment
        if mint_price > 0 {
            let (creator_amount, platform_amount, ecosystem_amount, holder_reward_amount) =
                EcosystemConfig::calculate_primary_split(mint_price);

            let final_creator_amount = if !had_existing_nfts {
                creator_amount + holder_reward_amount
            } else {
                creator_amount
            };

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

            // =========================================================================
            // 50/50 HOLDER REWARD DISTRIBUTION
            // 50% to BundleRewardPool (bundle NFT holders)
            // 50% to ContentRewardPools (content NFT holders, via remaining_accounts)
            // =========================================================================
            if had_existing_nfts && holder_reward_amount > 0 {
                let bundle_share = holder_reward_amount / 2;  // 6% of mint price
                let content_share = holder_reward_amount - bundle_share;  // 6% of mint price

                // Send 50% to BundleRewardPool
                if bundle_share > 0 {
                    anchor_lang::system_program::transfer(
                        CpiContext::new(
                            ctx.accounts.system_program.to_account_info(),
                            anchor_lang::system_program::Transfer {
                                from: ctx.accounts.payer.to_account_info(),
                                to: ctx.accounts.bundle_reward_pool.to_account_info(),
                            },
                        ),
                        bundle_share,
                    )?;
                    ctx.accounts.bundle_reward_pool.add_rewards(bundle_share);
                }

                // Distribute 50% to ContentRewardPools (passed as remaining_accounts)
                // Distribution is by weight - pools with more holders get proportionally more
                let content_pool_count = ctx.remaining_accounts.len();
                if content_share > 0 && content_pool_count > 0 {
                    // First pass: calculate total weight across all content pools
                    let mut total_combined_weight: u64 = 0;
                    let mut pool_weights: Vec<u64> = Vec::with_capacity(content_pool_count);

                    for pool_info in ctx.remaining_accounts.iter() {
                        let pool_data = pool_info.try_borrow_data()?;
                        if pool_data.len() >= 8 + 32 + 16 + 8 + 8 + 8 {
                            let weight = u64::from_le_bytes(pool_data[64..72].try_into().unwrap());
                            pool_weights.push(weight);
                            total_combined_weight += weight;
                        } else {
                            pool_weights.push(0);
                        }
                    }

                    // Second pass: distribute by weight proportion
                    if total_combined_weight > 0 {
                        let payer_ai = ctx.accounts.payer.to_account_info();

                        for (i, pool_info) in ctx.remaining_accounts.iter().enumerate() {
                            let pool_weight = pool_weights[i];
                            if pool_weight == 0 {
                                continue;
                            }

                            // Calculate share based on weight proportion
                            let pool_share = (content_share as u128 * pool_weight as u128 / total_combined_weight as u128) as u64;
                            if pool_share == 0 {
                                continue;
                            }

                            let pool_key = *pool_info.key;

                            // Transfer SOL using system_program invoke
                            let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
                                &payer_key,
                                &pool_key,
                                pool_share,
                            );

                            anchor_lang::solana_program::program::invoke(
                                &transfer_ix,
                                &[payer_ai.clone(), pool_info.clone()],
                            )?;

                            // Update ContentRewardPool's reward_per_share
                            let mut pool_data = pool_info.try_borrow_mut_data()?;
                            // Read current reward_per_share at offset 40
                            let current_rps = u128::from_le_bytes(pool_data[40..56].try_into().unwrap());

                            // Calculate and write new reward_per_share
                            let rps_increment = (pool_share as u128 * PRECISION) / pool_weight as u128;
                            let new_rps = current_rps + rps_increment;
                            pool_data[40..56].copy_from_slice(&new_rps.to_le_bytes());

                            // Update total_deposited at offset 72
                            let current_deposited = u64::from_le_bytes(pool_data[72..80].try_into().unwrap());
                            pool_data[72..80].copy_from_slice(&(current_deposited + pool_share).to_le_bytes());
                        }
                        msg!("Distributed {} lamports by weight to {} content pools", content_share, content_pool_count);
                    }
                }
            }
        }

        // Calculate debts BEFORE adding weight
        // Bundle pool debt (IMMEDIATE pool - use actual RPS)
        let bundle_debt = (weight as u128) * ctx.accounts.bundle_reward_pool.reward_per_share;

        // Calculate virtual RPS for LAZY pools (includes undistributed treasury)
        let patron_treasury_balance = ctx.accounts.creator_patron_treasury.lamports();
        let eco_treasury_balance = ctx.accounts.ecosystem_streaming_treasury.lamports();

        // Patron pool virtual RPS (12% of streaming treasury goes to holder pool)
        let virtual_patron_rps = calculate_virtual_rps(
            ctx.accounts.creator_patron_pool.reward_per_share,
            patron_treasury_balance,
            12, // holder share percentage
            ctx.accounts.creator_patron_pool.total_weight + weight as u64, // include new NFT weight
        );

        // Global holder pool virtual RPS (12% of ecosystem treasury)
        let virtual_global_rps = calculate_virtual_rps(
            ctx.accounts.global_holder_pool.reward_per_share,
            eco_treasury_balance,
            12, // holder share percentage
            ctx.accounts.global_holder_pool.total_weight + weight as u64, // include new NFT weight
        );

        // Creator dist pool virtual RPS (80% of ecosystem treasury)
        let virtual_creator_dist_rps = calculate_virtual_rps(
            ctx.accounts.creator_dist_pool.reward_per_share,
            eco_treasury_balance,
            80, // creator share percentage
            ctx.accounts.creator_dist_pool.total_weight + weight as u64, // include new NFT weight
        );

        // LAZY pool debts using VIRTUAL RPS
        let patron_debt = (weight as u128) * virtual_patron_rps;
        let global_debt = (weight as u128) * virtual_global_rps;
        let creator_debt_increment = (weight as u128) * virtual_creator_dist_rps;

        // Initialize NFT state account (unified - tracks rarity + all pool debts)
        ctx.accounts.unified_nft_state.nft_asset = nft_asset_key;
        ctx.accounts.unified_nft_state.creator = creator_key;
        ctx.accounts.unified_nft_state.rarity = rarity.clone();
        ctx.accounts.unified_nft_state.weight = weight;
        ctx.accounts.unified_nft_state.is_bundle = true;
        ctx.accounts.unified_nft_state.content_or_bundle = bundle_key;
        ctx.accounts.unified_nft_state.content_or_bundle_debt = bundle_debt;
        ctx.accounts.unified_nft_state.patron_debt = patron_debt;
        ctx.accounts.unified_nft_state.global_debt = global_debt;
        ctx.accounts.unified_nft_state.created_at = timestamp;

        // Add weight to ALL pools
        ctx.accounts.bundle_reward_pool.add_nft(weight);
        ctx.accounts.creator_patron_pool.total_weight += weight as u64;
        ctx.accounts.global_holder_pool.total_weight += weight as u64;
        ctx.accounts.creator_dist_pool.total_weight += weight as u64;
        ctx.accounts.creator_weight.total_weight += weight as u64;
        ctx.accounts.creator_weight.reward_debt += creator_debt_increment;

        msg!("Simple bundle mint completed!");
        msg!("NFT: {} | Rarity: {:?} | Weight: {}", nft_asset_key, rarity, weight);

        Ok(())
    }
}

// ============================================================================
// Helper function
// ============================================================================

/// Determine rarity from random bytes (same logic as existing)
fn determine_rarity_from_bytes(random_bytes: [u8; 32]) -> (Rarity, u16) {
    let rarity = Rarity::from_random(random_bytes);
    let weight = rarity.weight();
    (rarity, weight)
}
