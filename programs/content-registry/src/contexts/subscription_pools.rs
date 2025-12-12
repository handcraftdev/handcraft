use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::ContentRegistryError;

// ============================================================================
// INITIALIZE ECOSYSTEM POOLS (Admin only, one-time)
// ============================================================================

/// Initialize the global singleton pools for ecosystem subscriptions
/// Creates: GlobalHolderPool, CreatorDistPool, EcosystemEpochState
#[derive(Accounts)]
pub struct InitializeEcosystemPools<'info> {
    /// GlobalHolderPool - holds SOL for NFT holder claims (12% of ecosystem subscriptions)
    #[account(
        init,
        payer = admin,
        space = 8 + GlobalHolderPool::INIT_SPACE,
        seeds = [GLOBAL_HOLDER_POOL_SEED],
        bump
    )]
    pub global_holder_pool: Account<'info, GlobalHolderPool>,

    /// CreatorDistPool - holds SOL for creator claims (80% of ecosystem subscriptions)
    #[account(
        init,
        payer = admin,
        space = 8 + CreatorDistPool::INIT_SPACE,
        seeds = [CREATOR_DIST_POOL_SEED],
        bump
    )]
    pub creator_dist_pool: Account<'info, CreatorDistPool>,

    /// EcosystemEpochState - shared epoch tracking for lazy distribution
    #[account(
        init,
        payer = admin,
        space = 8 + EcosystemEpochState::INIT_SPACE,
        seeds = [ECOSYSTEM_EPOCH_STATE_SEED],
        bump
    )]
    pub ecosystem_epoch_state: Account<'info, EcosystemEpochState>,

    /// Ecosystem config must exist and admin must match
    #[account(
        seeds = [ECOSYSTEM_CONFIG_SEED],
        bump,
        has_one = admin @ ContentRegistryError::Unauthorized
    )]
    pub ecosystem_config: Account<'info, EcosystemConfig>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Handler for initialize_ecosystem_pools
pub fn handle_initialize_ecosystem_pools(ctx: Context<InitializeEcosystemPools>) -> Result<()> {
    let timestamp = Clock::get()?.unix_timestamp;

    // Initialize GlobalHolderPool
    let holder_pool = &mut ctx.accounts.global_holder_pool;
    holder_pool.reward_per_share = 0;
    holder_pool.total_weight = 0;
    holder_pool.total_deposited = 0;
    holder_pool.total_claimed = 0;
    holder_pool.created_at = timestamp;

    // Initialize CreatorDistPool
    let dist_pool = &mut ctx.accounts.creator_dist_pool;
    dist_pool.reward_per_share = 0;
    dist_pool.total_weight = 0;
    dist_pool.total_deposited = 0;
    dist_pool.total_claimed = 0;
    dist_pool.created_at = timestamp;

    // Initialize EcosystemEpochState
    let epoch_state = &mut ctx.accounts.ecosystem_epoch_state;
    epoch_state.last_distribution_at = timestamp;
    epoch_state.epoch_duration = DEFAULT_EPOCH_DURATION;

    msg!("Ecosystem pools initialized at timestamp: {}", timestamp);

    Ok(())
}

// ============================================================================
// INITIALIZE ECOSYSTEM SUB CONFIG (Admin only, one-time)
// ============================================================================

/// Initialize the ecosystem subscription configuration
#[derive(Accounts)]
pub struct InitializeEcosystemSubConfig<'info> {
    /// EcosystemSubConfig - platform-wide subscription settings
    #[account(
        init,
        payer = admin,
        space = 8 + EcosystemSubConfig::INIT_SPACE,
        seeds = [ECOSYSTEM_SUB_CONFIG_SEED],
        bump
    )]
    pub ecosystem_sub_config: Account<'info, EcosystemSubConfig>,

    /// Ecosystem config must exist and admin must match
    #[account(
        seeds = [ECOSYSTEM_CONFIG_SEED],
        bump,
        has_one = admin @ ContentRegistryError::Unauthorized
    )]
    pub ecosystem_config: Account<'info, EcosystemConfig>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Handler for initialize_ecosystem_sub_config
pub fn handle_initialize_ecosystem_sub_config(
    ctx: Context<InitializeEcosystemSubConfig>,
    price: u64,
) -> Result<()> {
    let timestamp = Clock::get()?.unix_timestamp;

    let config = &mut ctx.accounts.ecosystem_sub_config;
    config.price = price;
    config.is_active = true;
    config.authority = ctx.accounts.admin.key();
    config.created_at = timestamp;
    config.updated_at = timestamp;

    msg!("Ecosystem subscription config initialized. Price: {} lamports/month", price);

    Ok(())
}

// ============================================================================
// UPDATE ECOSYSTEM SUB CONFIG (Admin only)
// ============================================================================

/// Update ecosystem subscription settings
#[derive(Accounts)]
pub struct UpdateEcosystemSubConfig<'info> {
    #[account(
        mut,
        seeds = [ECOSYSTEM_SUB_CONFIG_SEED],
        bump,
        has_one = authority @ ContentRegistryError::Unauthorized
    )]
    pub ecosystem_sub_config: Account<'info, EcosystemSubConfig>,

    pub authority: Signer<'info>,
}

/// Handler for update_ecosystem_sub_config
pub fn handle_update_ecosystem_sub_config(
    ctx: Context<UpdateEcosystemSubConfig>,
    price: Option<u64>,
    is_active: Option<bool>,
) -> Result<()> {
    let config = &mut ctx.accounts.ecosystem_sub_config;
    let timestamp = Clock::get()?.unix_timestamp;

    if let Some(new_price) = price {
        config.price = new_price;
    }

    if let Some(active) = is_active {
        config.is_active = active;
    }

    config.updated_at = timestamp;

    Ok(())
}

// ============================================================================
// UPDATE EPOCH DURATION (Admin only - for testing)
// ============================================================================

/// Update epoch duration on ecosystem pools (admin only)
/// Used for E2E testing with shorter epochs
#[derive(Accounts)]
pub struct UpdateEpochDuration<'info> {
    /// EcosystemEpochState - shared epoch tracking
    #[account(
        mut,
        seeds = [ECOSYSTEM_EPOCH_STATE_SEED],
        bump
    )]
    pub ecosystem_epoch_state: Account<'info, EcosystemEpochState>,

    /// Ecosystem config must exist and admin must match
    #[account(
        seeds = [ECOSYSTEM_CONFIG_SEED],
        bump,
        has_one = admin @ ContentRegistryError::Unauthorized
    )]
    pub ecosystem_config: Account<'info, EcosystemConfig>,

    pub admin: Signer<'info>,
}

/// Handler for update_epoch_duration
pub fn handle_update_epoch_duration(
    ctx: Context<UpdateEpochDuration>,
    epoch_duration: i64,
) -> Result<()> {
    require!(epoch_duration > 0, ContentRegistryError::InvalidInput);

    ctx.accounts.ecosystem_epoch_state.epoch_duration = epoch_duration;

    msg!("Updated ecosystem epoch duration to {} seconds", epoch_duration);

    Ok(())
}

// ============================================================================
// CLAIM UNIFIED CONTENT REWARDS (Immediate Pool)
// ============================================================================

/// Claim rewards from ContentRewardPool using UnifiedNftRewardState
/// This is for content NFTs minted after subscription system deployment
#[derive(Accounts)]
pub struct ClaimUnifiedContentRewards<'info> {
    /// The content this NFT belongs to
    /// CHECK: Verified by seed derivation of content_reward_pool
    pub content: AccountInfo<'info>,

    /// ContentRewardPool - holds SOL for this content's holder rewards
    #[account(
        mut,
        seeds = [CONTENT_REWARD_POOL_SEED, content.key().as_ref()],
        bump
    )]
    pub content_reward_pool: Account<'info, ContentRewardPool>,

    /// UnifiedNftRewardState for this NFT
    #[account(
        mut,
        seeds = [UNIFIED_NFT_REWARD_STATE_SEED, nft_asset.key().as_ref()],
        bump,
        constraint = nft_reward_state.content_or_bundle == content.key() @ ContentRegistryError::ContentMismatch,
        constraint = !nft_reward_state.is_bundle @ ContentRegistryError::InvalidNftType
    )]
    pub nft_reward_state: Account<'info, UnifiedNftRewardState>,

    /// The NFT asset (Metaplex Core)
    /// CHECK: Ownership verified separately
    pub nft_asset: AccountInfo<'info>,

    /// The NFT holder (must be signer to claim)
    #[account(mut)]
    pub holder: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Handler for claim_unified_content_rewards
pub fn handle_claim_unified_content_rewards(ctx: Context<ClaimUnifiedContentRewards>) -> Result<()> {
    let nft_state = &mut ctx.accounts.nft_reward_state;
    let pool = &mut ctx.accounts.content_reward_pool;

    // Calculate pending using weighted RPS with saturating subtraction
    let weighted_rps = nft_state.weight as u128 * pool.reward_per_share;
    let pending = weighted_rps.saturating_sub(nft_state.content_or_bundle_debt) / PRECISION;

    require!(pending > 0, ContentRegistryError::NothingToClaim);

    // Transfer SOL from pool to holder
    **pool.to_account_info().try_borrow_mut_lamports()? -= pending as u64;
    **ctx.accounts.holder.to_account_info().try_borrow_mut_lamports()? += pending as u64;

    // Update accounting
    pool.total_claimed += pending as u64;
    nft_state.content_or_bundle_debt = weighted_rps;

    msg!("Claimed {} lamports from content reward pool", pending);

    Ok(())
}

// ============================================================================
// CLAIM UNIFIED BUNDLE REWARDS (Immediate Pool)
// ============================================================================

/// Claim rewards from BundleRewardPool using UnifiedNftRewardState
/// This is for bundle NFTs minted after subscription system deployment
#[derive(Accounts)]
pub struct ClaimUnifiedBundleRewards<'info> {
    /// The bundle this NFT belongs to
    /// CHECK: Verified by seed derivation of bundle_reward_pool
    pub bundle: AccountInfo<'info>,

    /// BundleRewardPool - holds SOL for this bundle's holder rewards
    #[account(
        mut,
        seeds = [BUNDLE_REWARD_POOL_SEED, bundle.key().as_ref()],
        bump
    )]
    pub bundle_reward_pool: Account<'info, BundleRewardPool>,

    /// UnifiedNftRewardState for this NFT
    #[account(
        mut,
        seeds = [UNIFIED_NFT_REWARD_STATE_SEED, nft_asset.key().as_ref()],
        bump,
        constraint = nft_reward_state.content_or_bundle == bundle.key() @ ContentRegistryError::ContentMismatch,
        constraint = nft_reward_state.is_bundle @ ContentRegistryError::InvalidNftType
    )]
    pub nft_reward_state: Account<'info, UnifiedNftRewardState>,

    /// The NFT asset (Metaplex Core)
    /// CHECK: Ownership verified separately
    pub nft_asset: AccountInfo<'info>,

    /// The NFT holder (must be signer to claim)
    #[account(mut)]
    pub holder: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Handler for claim_unified_bundle_rewards
pub fn handle_claim_unified_bundle_rewards(ctx: Context<ClaimUnifiedBundleRewards>) -> Result<()> {
    let nft_state = &mut ctx.accounts.nft_reward_state;
    let pool = &mut ctx.accounts.bundle_reward_pool;

    // Calculate pending using weighted RPS with saturating subtraction
    let weighted_rps = nft_state.weight as u128 * pool.reward_per_share;
    let pending = weighted_rps.saturating_sub(nft_state.content_or_bundle_debt) / PRECISION;

    require!(pending > 0, ContentRegistryError::NothingToClaim);

    // Transfer SOL from pool to holder
    **pool.to_account_info().try_borrow_mut_lamports()? -= pending as u64;
    **ctx.accounts.holder.to_account_info().try_borrow_mut_lamports()? += pending as u64;

    // Update accounting
    pool.total_claimed += pending as u64;
    nft_state.content_or_bundle_debt = weighted_rps;

    msg!("Claimed {} lamports from bundle reward pool", pending);

    Ok(())
}

// ============================================================================
// CLAIM PATRON REWARDS (Lazy Pool)
// ============================================================================

/// Claim rewards from CreatorPatronPool using UnifiedNftRewardState
/// Triggers lazy distribution if epoch has ended
#[derive(Accounts)]
pub struct ClaimPatronRewards<'info> {
    /// The creator whose NFT this is
    /// CHECK: Verified by nft_reward_state.creator
    pub creator: AccountInfo<'info>,

    /// CreatorPatronPool - holds SOL for this creator's NFT holder rewards
    #[account(
        mut,
        seeds = [CREATOR_PATRON_POOL_SEED, creator.key().as_ref()],
        bump,
        constraint = creator_patron_pool.creator == creator.key() @ ContentRegistryError::Unauthorized
    )]
    pub creator_patron_pool: Account<'info, CreatorPatronPool>,

    /// CreatorPatronStreamingTreasury - receives Streamflow payments
    /// CHECK: PDA verified by seeds, we just read lamports
    #[account(
        mut,
        seeds = [CREATOR_PATRON_TREASURY_SEED, creator.key().as_ref()],
        bump
    )]
    pub creator_patron_treasury: AccountInfo<'info>,

    /// Creator's wallet to receive 80% on distribution
    /// CHECK: Must match nft_reward_state.creator
    #[account(mut)]
    pub creator_wallet: AccountInfo<'info>,

    /// Platform treasury to receive 5% on distribution
    /// CHECK: Retrieved from ecosystem config
    #[account(mut)]
    pub platform_treasury: AccountInfo<'info>,

    /// CHECK: Ecosystem treasury to receive 3% on distribution - verified by constraint
    #[account(
        mut,
        constraint = ecosystem_treasury.key() == ecosystem_config.treasury @ ContentRegistryError::Unauthorized
    )]
    pub ecosystem_treasury: AccountInfo<'info>,

    /// Ecosystem config (for treasury address)
    #[account(
        seeds = [ECOSYSTEM_CONFIG_SEED],
        bump
    )]
    pub ecosystem_config: Account<'info, EcosystemConfig>,

    /// UnifiedNftRewardState for this NFT
    #[account(
        mut,
        seeds = [UNIFIED_NFT_REWARD_STATE_SEED, nft_asset.key().as_ref()],
        bump,
        constraint = nft_reward_state.creator == creator.key() @ ContentRegistryError::Unauthorized
    )]
    pub nft_reward_state: Account<'info, UnifiedNftRewardState>,

    /// CHECK: The NFT asset (Metaplex Core) - ownership verified separately
    pub nft_asset: AccountInfo<'info>,

    /// The NFT holder (must be signer to claim)
    #[account(mut)]
    pub holder: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Handler for claim_patron_rewards
pub fn handle_claim_patron_rewards(ctx: Context<ClaimPatronRewards>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let pool = &mut ctx.accounts.creator_patron_pool;
    let treasury = &ctx.accounts.creator_patron_treasury;
    let creator_key = ctx.accounts.creator.key();

    // Step 1: If epoch ended, distribute streaming treasury
    if pool.epoch_ended(now) && treasury.lamports() > 0 {
        let balance = treasury.lamports();
        let (creator_share, platform_share, ecosystem_share, holder_share) = calculate_primary_split(balance);

        // Get treasury PDA bump for signing
        let (_, treasury_bump) = Pubkey::find_program_address(
            &[CREATOR_PATRON_TREASURY_SEED, creator_key.as_ref()],
            &crate::ID
        );
        let treasury_seeds = &[CREATOR_PATRON_TREASURY_SEED, creator_key.as_ref(), &[treasury_bump]];
        let treasury_signer = &[&treasury_seeds[..]];

        // Transfer 80% to creator wallet using CPI
        anchor_lang::system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: treasury.to_account_info(),
                    to: ctx.accounts.creator_wallet.to_account_info(),
                },
                treasury_signer,
            ),
            creator_share,
        )?;

        // Transfer 5% to platform treasury using CPI
        anchor_lang::system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: treasury.to_account_info(),
                    to: ctx.accounts.platform_treasury.to_account_info(),
                },
                treasury_signer,
            ),
            platform_share,
        )?;

        // Transfer 3% to ecosystem treasury using CPI
        anchor_lang::system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: treasury.to_account_info(),
                    to: ctx.accounts.ecosystem_treasury.to_account_info(),
                },
                treasury_signer,
            ),
            ecosystem_share,
        )?;

        // Transfer 12% to pool using CPI
        anchor_lang::system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: treasury.to_account_info(),
                    to: pool.to_account_info(),
                },
                treasury_signer,
            ),
            holder_share,
        )?;

        pool.reward_per_share += (holder_share as u128 * PRECISION) / pool.total_weight as u128;
        pool.total_deposited += holder_share;
        pool.last_distribution_at = now;

        msg!("Distributed patron pool: {} to holder pool", holder_share);
    }

    // Step 2: Claim from pool (with saturating subtraction)
    let nft_state = &mut ctx.accounts.nft_reward_state;
    let weighted_rps = nft_state.weight as u128 * pool.reward_per_share;
    let pending = weighted_rps.saturating_sub(nft_state.patron_debt) / PRECISION;

    if pending > 0 {
        // Transfer SOL from pool to holder
        **pool.to_account_info().try_borrow_mut_lamports()? -= pending as u64;
        **ctx.accounts.holder.to_account_info().try_borrow_mut_lamports()? += pending as u64;

        pool.total_claimed += pending as u64;

        // Only update debt if we claimed (preserves virtual RPS protection)
        nft_state.patron_debt = weighted_rps;

        msg!("Claimed {} lamports from patron pool", pending);
    }

    Ok(())
}

// ============================================================================
// CLAIM GLOBAL HOLDER REWARDS (Lazy Pool)
// ============================================================================

/// Claim rewards from GlobalHolderPool using UnifiedNftRewardState
/// Triggers lazy distribution if epoch has ended
#[derive(Accounts)]
pub struct ClaimGlobalHolderRewards<'info> {
    /// GlobalHolderPool - singleton, holds SOL for all NFT holder rewards
    #[account(
        mut,
        seeds = [GLOBAL_HOLDER_POOL_SEED],
        bump
    )]
    pub global_holder_pool: Account<'info, GlobalHolderPool>,

    /// CreatorDistPool - singleton, holds SOL for creator payouts
    #[account(
        mut,
        seeds = [CREATOR_DIST_POOL_SEED],
        bump
    )]
    pub creator_dist_pool: Account<'info, CreatorDistPool>,

    /// EcosystemEpochState - shared epoch tracking
    #[account(
        mut,
        seeds = [ECOSYSTEM_EPOCH_STATE_SEED],
        bump
    )]
    pub ecosystem_epoch_state: Account<'info, EcosystemEpochState>,

    /// EcosystemStreamingTreasury - receives subscription payments
    /// CHECK: PDA verified by seeds, we just read lamports
    #[account(
        mut,
        seeds = [ECOSYSTEM_STREAMING_TREASURY_SEED],
        bump
    )]
    pub ecosystem_streaming_treasury: AccountInfo<'info>,

    /// Platform treasury to receive 5% on distribution
    /// CHECK: Retrieved from ecosystem config
    #[account(mut)]
    pub platform_treasury: AccountInfo<'info>,

    /// CHECK: Ecosystem treasury to receive 3% on distribution - verified by constraint
    #[account(
        mut,
        constraint = ecosystem_treasury.key() == ecosystem_config.treasury @ ContentRegistryError::Unauthorized
    )]
    pub ecosystem_treasury: AccountInfo<'info>,

    /// Ecosystem config (for treasury address)
    #[account(
        seeds = [ECOSYSTEM_CONFIG_SEED],
        bump
    )]
    pub ecosystem_config: Account<'info, EcosystemConfig>,

    /// UnifiedNftRewardState for this NFT
    #[account(
        mut,
        seeds = [UNIFIED_NFT_REWARD_STATE_SEED, nft_asset.key().as_ref()],
        bump
    )]
    pub nft_reward_state: Account<'info, UnifiedNftRewardState>,

    /// CHECK: The NFT asset (Metaplex Core) - ownership verified separately
    pub nft_asset: AccountInfo<'info>,

    /// The NFT holder (must be signer to claim)
    #[account(mut)]
    pub holder: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Handler for claim_global_holder_rewards
pub fn handle_claim_global_holder_rewards(ctx: Context<ClaimGlobalHolderRewards>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let epoch_state = &mut ctx.accounts.ecosystem_epoch_state;
    let treasury = &ctx.accounts.ecosystem_streaming_treasury;
    let holder_pool = &mut ctx.accounts.global_holder_pool;
    let dist_pool = &mut ctx.accounts.creator_dist_pool;

    // Step 1: If epoch ended, distribute streaming treasury to BOTH pools
    if epoch_state.epoch_ended(now) && treasury.lamports() > 0 {
        let balance = treasury.lamports();
        let (creator_share, holder_share, platform_share, ecosystem_share) = calculate_ecosystem_split(balance);

        // Get treasury PDA bump for signing
        let (_, treasury_bump) = Pubkey::find_program_address(
            &[ECOSYSTEM_STREAMING_TREASURY_SEED],
            &crate::ID
        );
        let treasury_seeds = &[ECOSYSTEM_STREAMING_TREASURY_SEED, &[treasury_bump]];
        let treasury_signer = &[&treasury_seeds[..]];

        // Transfer 5% to platform treasury using CPI
        anchor_lang::system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: treasury.to_account_info(),
                    to: ctx.accounts.platform_treasury.to_account_info(),
                },
                treasury_signer,
            ),
            platform_share,
        )?;

        // Transfer 3% to ecosystem treasury using CPI
        anchor_lang::system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: treasury.to_account_info(),
                    to: ctx.accounts.ecosystem_treasury.to_account_info(),
                },
                treasury_signer,
            ),
            ecosystem_share,
        )?;

        // Transfer 12% to GlobalHolderPool using CPI
        anchor_lang::system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: treasury.to_account_info(),
                    to: holder_pool.to_account_info(),
                },
                treasury_signer,
            ),
            holder_share,
        )?;

        if holder_pool.total_weight > 0 {
            holder_pool.reward_per_share += (holder_share as u128 * PRECISION) / holder_pool.total_weight as u128;
        }
        holder_pool.total_deposited += holder_share;

        // Transfer 80% to CreatorDistPool using CPI
        anchor_lang::system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: treasury.to_account_info(),
                    to: dist_pool.to_account_info(),
                },
                treasury_signer,
            ),
            creator_share,
        )?;

        if dist_pool.total_weight > 0 {
            dist_pool.reward_per_share += (creator_share as u128 * PRECISION) / dist_pool.total_weight as u128;
        }
        dist_pool.total_deposited += creator_share;

        // Update shared epoch state
        epoch_state.last_distribution_at = now;

        msg!("Distributed ecosystem pools: {} to holders, {} to creators", holder_share, creator_share);
    }

    // Step 2: Claim from GlobalHolderPool (with saturating subtraction)
    let nft_state = &mut ctx.accounts.nft_reward_state;
    let weighted_rps = nft_state.weight as u128 * holder_pool.reward_per_share;
    let pending = weighted_rps.saturating_sub(nft_state.global_debt) / PRECISION;

    if pending > 0 {
        // Transfer SOL from pool to holder
        **holder_pool.to_account_info().try_borrow_mut_lamports()? -= pending as u64;
        **ctx.accounts.holder.to_account_info().try_borrow_mut_lamports()? += pending as u64;

        holder_pool.total_claimed += pending as u64;

        // Only update debt if we claimed
        nft_state.global_debt = weighted_rps;

        msg!("Claimed {} lamports from global holder pool", pending);
    }

    Ok(())
}

// ============================================================================
// CLAIM CREATOR ECOSYSTEM PAYOUT (from CreatorDistPool)
// ============================================================================

/// Claim creator's share from CreatorDistPool
/// Triggers lazy distribution if epoch has ended
#[derive(Accounts)]
pub struct ClaimCreatorEcosystemPayout<'info> {
    /// GlobalHolderPool - singleton (needed for distribution)
    #[account(
        mut,
        seeds = [GLOBAL_HOLDER_POOL_SEED],
        bump
    )]
    pub global_holder_pool: Account<'info, GlobalHolderPool>,

    /// CreatorDistPool - singleton, holds SOL for creator payouts
    #[account(
        mut,
        seeds = [CREATOR_DIST_POOL_SEED],
        bump
    )]
    pub creator_dist_pool: Account<'info, CreatorDistPool>,

    /// EcosystemEpochState - shared epoch tracking
    #[account(
        mut,
        seeds = [ECOSYSTEM_EPOCH_STATE_SEED],
        bump
    )]
    pub ecosystem_epoch_state: Account<'info, EcosystemEpochState>,

    /// EcosystemStreamingTreasury - receives subscription payments
    /// CHECK: PDA verified by seeds, we just read lamports
    #[account(
        mut,
        seeds = [ECOSYSTEM_STREAMING_TREASURY_SEED],
        bump
    )]
    pub ecosystem_streaming_treasury: AccountInfo<'info>,

    /// Platform treasury to receive 5% on distribution
    /// CHECK: Retrieved from ecosystem config
    #[account(mut)]
    pub platform_treasury: AccountInfo<'info>,

    /// CHECK: Ecosystem treasury to receive 3% on distribution - verified by constraint
    #[account(
        mut,
        constraint = ecosystem_treasury.key() == ecosystem_config.treasury @ ContentRegistryError::Unauthorized
    )]
    pub ecosystem_treasury: AccountInfo<'info>,

    /// Ecosystem config (for treasury address)
    #[account(
        seeds = [ECOSYSTEM_CONFIG_SEED],
        bump
    )]
    pub ecosystem_config: Account<'info, EcosystemConfig>,

    /// CreatorWeight - tracks this creator's total NFT weight
    #[account(
        mut,
        seeds = [CREATOR_WEIGHT_SEED, creator.key().as_ref()],
        bump,
        constraint = creator_weight.creator == creator.key() @ ContentRegistryError::Unauthorized
    )]
    pub creator_weight: Account<'info, CreatorWeight>,

    /// The creator claiming their ecosystem payout
    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Handler for claim_creator_ecosystem_payout
pub fn handle_claim_creator_ecosystem_payout(ctx: Context<ClaimCreatorEcosystemPayout>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let epoch_state = &mut ctx.accounts.ecosystem_epoch_state;
    let treasury = &ctx.accounts.ecosystem_streaming_treasury;
    let holder_pool = &mut ctx.accounts.global_holder_pool;
    let dist_pool = &mut ctx.accounts.creator_dist_pool;

    // Step 1: If epoch ended, distribute streaming treasury to BOTH pools
    if epoch_state.epoch_ended(now) && treasury.lamports() > 0 {
        let balance = treasury.lamports();
        let (creator_share, holder_share, platform_share, ecosystem_share) = calculate_ecosystem_split(balance);

        // Get treasury PDA bump for signing
        let (_, treasury_bump) = Pubkey::find_program_address(
            &[ECOSYSTEM_STREAMING_TREASURY_SEED],
            &crate::ID
        );
        let treasury_seeds = &[ECOSYSTEM_STREAMING_TREASURY_SEED, &[treasury_bump]];
        let treasury_signer = &[&treasury_seeds[..]];

        // Transfer 5% to platform treasury using CPI
        anchor_lang::system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: treasury.to_account_info(),
                    to: ctx.accounts.platform_treasury.to_account_info(),
                },
                treasury_signer,
            ),
            platform_share,
        )?;

        // Transfer 3% to ecosystem treasury using CPI
        anchor_lang::system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: treasury.to_account_info(),
                    to: ctx.accounts.ecosystem_treasury.to_account_info(),
                },
                treasury_signer,
            ),
            ecosystem_share,
        )?;

        // Transfer 12% to GlobalHolderPool using CPI
        anchor_lang::system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: treasury.to_account_info(),
                    to: holder_pool.to_account_info(),
                },
                treasury_signer,
            ),
            holder_share,
        )?;

        if holder_pool.total_weight > 0 {
            holder_pool.reward_per_share += (holder_share as u128 * PRECISION) / holder_pool.total_weight as u128;
        }
        holder_pool.total_deposited += holder_share;

        // Transfer 80% to CreatorDistPool using CPI
        anchor_lang::system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: treasury.to_account_info(),
                    to: dist_pool.to_account_info(),
                },
                treasury_signer,
            ),
            creator_share,
        )?;

        if dist_pool.total_weight > 0 {
            dist_pool.reward_per_share += (creator_share as u128 * PRECISION) / dist_pool.total_weight as u128;
        }
        dist_pool.total_deposited += creator_share;

        // Update shared epoch state
        epoch_state.last_distribution_at = now;

        msg!("Distributed ecosystem pools: {} to holders, {} to creators", holder_share, creator_share);
    }

    // Step 2: Claim creator's share from CreatorDistPool
    let creator_weight = &mut ctx.accounts.creator_weight;
    let weighted_rps = creator_weight.total_weight as u128 * dist_pool.reward_per_share;
    let pending = weighted_rps.saturating_sub(creator_weight.reward_debt) / PRECISION;

    if pending > 0 {
        // Transfer SOL from pool to creator
        **dist_pool.to_account_info().try_borrow_mut_lamports()? -= pending as u64;
        **ctx.accounts.creator.to_account_info().try_borrow_mut_lamports()? += pending as u64;

        dist_pool.total_claimed += pending as u64;
        creator_weight.total_claimed += pending as u64;

        // Only update debt if we claimed
        creator_weight.reward_debt = weighted_rps;

        msg!("Creator claimed {} lamports from ecosystem dist pool", pending);
    }

    Ok(())
}
