use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::ContentRegistryError;

// ============================================================================
// SUBSCRIPTION MINT HELPERS
// ============================================================================
// These functions integrate subscription system weight tracking into mints.
// They can be called from any mint instruction that wants to participate
// in the subscription reward pools.

/// Calculate virtual RPS for a lazy pool
/// Formula: pool.reward_per_share + (treasury_balance * share% * PRECISION) / pool.total_weight
/// This gives late minters a debt that includes undripped rewards, protecting early minters
pub fn calculate_virtual_rps(
    pool_rps: u128,
    streaming_treasury_balance: u64,
    share_percent: u8,
    total_weight: u64,
) -> u128 {
    if total_weight == 0 || streaming_treasury_balance == 0 {
        return pool_rps;
    }

    let treasury_share = (streaming_treasury_balance as u128 * share_percent as u128) / 100;
    pool_rps + (treasury_share * PRECISION) / total_weight as u128
}

/// Trigger epoch distribution for CreatorPatronPool if needed
/// Returns the holder share that was distributed (12% of streaming treasury)
/// Uses CPI transfers because streaming treasury is system-owned
pub fn maybe_distribute_patron_pool<'info>(
    pool: &mut Account<'info, CreatorPatronPool>,
    streaming_treasury: &AccountInfo<'info>,
    creator_wallet: &AccountInfo<'info>,
    platform_treasury: &AccountInfo<'info>,
    ecosystem_treasury: &AccountInfo<'info>,
    now: i64,
    system_program: &AccountInfo<'info>,
    creator_key: &Pubkey,
) -> Result<u64> {
    if !pool.epoch_ended(now) {
        return Ok(0);
    }

    let balance = streaming_treasury.lamports();
    if balance == 0 || pool.total_weight == 0 {
        pool.last_distribution_at = now;
        return Ok(0);
    }

    let (creator_share, platform_share, ecosystem_share, holder_share) = calculate_primary_split(balance);

    // Get treasury PDA bump for signing
    let (_, treasury_bump) = Pubkey::find_program_address(
        &[CREATOR_PATRON_TREASURY_SEED, creator_key.as_ref()],
        &crate::ID
    );
    let treasury_seeds = &[CREATOR_PATRON_TREASURY_SEED, creator_key.as_ref(), &[treasury_bump]];
    let treasury_signer = &[&treasury_seeds[..]];

    // Transfer 80% to creator using CPI
    anchor_lang::system_program::transfer(
        CpiContext::new_with_signer(
            system_program.clone(),
            anchor_lang::system_program::Transfer {
                from: streaming_treasury.clone(),
                to: creator_wallet.clone(),
            },
            treasury_signer,
        ),
        creator_share,
    )?;

    // Transfer 5% to platform using CPI
    anchor_lang::system_program::transfer(
        CpiContext::new_with_signer(
            system_program.clone(),
            anchor_lang::system_program::Transfer {
                from: streaming_treasury.clone(),
                to: platform_treasury.clone(),
            },
            treasury_signer,
        ),
        platform_share,
    )?;

    // Transfer 3% to ecosystem using CPI
    anchor_lang::system_program::transfer(
        CpiContext::new_with_signer(
            system_program.clone(),
            anchor_lang::system_program::Transfer {
                from: streaming_treasury.clone(),
                to: ecosystem_treasury.clone(),
            },
            treasury_signer,
        ),
        ecosystem_share,
    )?;

    // Transfer 12% to pool using CPI
    anchor_lang::system_program::transfer(
        CpiContext::new_with_signer(
            system_program.clone(),
            anchor_lang::system_program::Transfer {
                from: streaming_treasury.clone(),
                to: pool.to_account_info(),
            },
            treasury_signer,
        ),
        holder_share,
    )?;

    // Update pool accounting
    pool.reward_per_share += (holder_share as u128 * PRECISION) / pool.total_weight as u128;
    pool.total_deposited += holder_share;
    pool.last_distribution_at = now;

    Ok(holder_share)
}

/// Trigger epoch distribution for ecosystem pools (GlobalHolderPool + CreatorDistPool)
/// Returns (holder_share, creator_share) that were distributed
/// Uses CPI transfers because streaming treasury is system-owned
pub fn maybe_distribute_ecosystem_pools<'info>(
    holder_pool: &mut Account<'info, GlobalHolderPool>,
    dist_pool: &mut Account<'info, CreatorDistPool>,
    epoch_state: &mut Account<'info, EcosystemEpochState>,
    streaming_treasury: &AccountInfo<'info>,
    platform_treasury: &AccountInfo<'info>,
    ecosystem_treasury: &AccountInfo<'info>,
    now: i64,
    system_program: &AccountInfo<'info>,
) -> Result<(u64, u64)> {
    if !epoch_state.epoch_ended(now) {
        return Ok((0, 0));
    }

    let balance = streaming_treasury.lamports();
    if balance == 0 {
        epoch_state.last_distribution_at = now;
        return Ok((0, 0));
    }

    let (creator_share, holder_share, platform_share, ecosystem_share) = calculate_ecosystem_split(balance);

    // Get treasury PDA bump for signing
    let (_, treasury_bump) = Pubkey::find_program_address(
        &[ECOSYSTEM_STREAMING_TREASURY_SEED],
        &crate::ID
    );
    let treasury_seeds = &[ECOSYSTEM_STREAMING_TREASURY_SEED, &[treasury_bump]];
    let treasury_signer = &[&treasury_seeds[..]];

    // Transfer 5% to platform using CPI
    anchor_lang::system_program::transfer(
        CpiContext::new_with_signer(
            system_program.clone(),
            anchor_lang::system_program::Transfer {
                from: streaming_treasury.clone(),
                to: platform_treasury.clone(),
            },
            treasury_signer,
        ),
        platform_share,
    )?;

    // Transfer 3% to ecosystem using CPI
    anchor_lang::system_program::transfer(
        CpiContext::new_with_signer(
            system_program.clone(),
            anchor_lang::system_program::Transfer {
                from: streaming_treasury.clone(),
                to: ecosystem_treasury.clone(),
            },
            treasury_signer,
        ),
        ecosystem_share,
    )?;

    // Transfer 12% to GlobalHolderPool using CPI
    anchor_lang::system_program::transfer(
        CpiContext::new_with_signer(
            system_program.clone(),
            anchor_lang::system_program::Transfer {
                from: streaming_treasury.clone(),
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
            system_program.clone(),
            anchor_lang::system_program::Transfer {
                from: streaming_treasury.clone(),
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

    // Update epoch state
    epoch_state.last_distribution_at = now;

    Ok((holder_share, creator_share))
}

// ============================================================================
// REGISTER NFT IN SUBSCRIPTION POOLS
// ============================================================================

/// Context for registering a newly minted NFT in all subscription pools
/// This should be called after the NFT is minted and rarity is determined
#[derive(Accounts)]
pub struct RegisterNftInSubscriptionPools<'info> {
    /// The NFT asset that was just minted
    /// CHECK: We just need the key for PDA derivation
    pub nft_asset: AccountInfo<'info>,

    /// The content this NFT belongs to
    pub content: Account<'info, ContentEntry>,

    /// Creator of the content
    /// CHECK: Verified against content.creator
    #[account(constraint = creator.key() == content.creator @ ContentRegistryError::Unauthorized)]
    pub creator: AccountInfo<'info>,

    /// UnifiedNftRewardState - to be initialized
    #[account(
        init,
        payer = payer,
        space = 8 + UnifiedNftRewardState::INIT_SPACE,
        seeds = [UNIFIED_NFT_REWARD_STATE_SEED, nft_asset.key().as_ref()],
        bump
    )]
    pub unified_nft_state: Account<'info, UnifiedNftRewardState>,

    /// ContentRewardPool - already exists, just update weight
    #[account(
        mut,
        seeds = [CONTENT_REWARD_POOL_SEED, content.key().as_ref()],
        bump
    )]
    pub content_reward_pool: Account<'info, ContentRewardPool>,

    /// CreatorPatronPool - lazy-init if needed
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + CreatorPatronPool::INIT_SPACE,
        seeds = [CREATOR_PATRON_POOL_SEED, creator.key().as_ref()],
        bump
    )]
    pub creator_patron_pool: Account<'info, CreatorPatronPool>,

    /// CreatorPatronStreamingTreasury
    /// CHECK: PDA verified by seeds
    #[account(
        seeds = [CREATOR_PATRON_TREASURY_SEED, creator.key().as_ref()],
        bump
    )]
    pub creator_patron_treasury: AccountInfo<'info>,

    /// GlobalHolderPool - singleton
    #[account(
        mut,
        seeds = [GLOBAL_HOLDER_POOL_SEED],
        bump
    )]
    pub global_holder_pool: Account<'info, GlobalHolderPool>,

    /// CreatorDistPool - singleton
    #[account(
        mut,
        seeds = [CREATOR_DIST_POOL_SEED],
        bump
    )]
    pub creator_dist_pool: Account<'info, CreatorDistPool>,

    /// EcosystemEpochState - singleton
    #[account(
        mut,
        seeds = [ECOSYSTEM_EPOCH_STATE_SEED],
        bump
    )]
    pub ecosystem_epoch_state: Account<'info, EcosystemEpochState>,

    /// CreatorWeight - lazy-init if needed
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + CreatorWeight::INIT_SPACE,
        seeds = [CREATOR_WEIGHT_SEED, creator.key().as_ref()],
        bump
    )]
    pub creator_weight: Account<'info, CreatorWeight>,

    /// EcosystemStreamingTreasury
    /// CHECK: PDA verified by seeds
    #[account(
        seeds = [ECOSYSTEM_STREAMING_TREASURY_SEED],
        bump
    )]
    pub ecosystem_streaming_treasury: AccountInfo<'info>,

    /// Creator's wallet (for patron pool distribution)
    /// CHECK: Must match content.creator
    #[account(mut)]
    pub creator_wallet: AccountInfo<'info>,

    /// Platform treasury (for distribution)
    /// CHECK: From ecosystem config
    #[account(mut)]
    pub platform_treasury: AccountInfo<'info>,

    /// Ecosystem treasury (for distribution)
    /// CHECK: From ecosystem config
    #[account(mut)]
    pub ecosystem_treasury: AccountInfo<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Handler for registering an NFT in subscription pools
/// Called after mint with the determined weight
pub fn handle_register_nft_in_subscription_pools(
    ctx: Context<RegisterNftInSubscriptionPools>,
    weight: u16,
    is_bundle: bool,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let nft_asset = ctx.accounts.nft_asset.key();
    let creator = ctx.accounts.creator.key();
    let content_key = ctx.accounts.content.key();

    // =========================================================================
    // STEP 0: Trigger epoch distribution if needed (Option B)
    // =========================================================================

    // Patron pool distribution
    let patron_pool = &mut ctx.accounts.creator_patron_pool;

    // Initialize patron pool if new
    if patron_pool.creator == Pubkey::default() {
        patron_pool.creator = creator;
        patron_pool.reward_per_share = 0;
        patron_pool.total_weight = 0;
        patron_pool.total_deposited = 0;
        patron_pool.total_claimed = 0;
        patron_pool.last_distribution_at = now;
        patron_pool.epoch_duration = DEFAULT_EPOCH_DURATION;
        patron_pool.created_at = now;
    }

    maybe_distribute_patron_pool(
        patron_pool,
        &ctx.accounts.creator_patron_treasury,
        &ctx.accounts.creator_wallet,
        &ctx.accounts.platform_treasury,
        &ctx.accounts.ecosystem_treasury,
        now,
        &ctx.accounts.system_program.to_account_info(),
        &creator,
    )?;

    // Ecosystem pools distribution
    maybe_distribute_ecosystem_pools(
        &mut ctx.accounts.global_holder_pool,
        &mut ctx.accounts.creator_dist_pool,
        &mut ctx.accounts.ecosystem_epoch_state,
        &ctx.accounts.ecosystem_streaming_treasury,
        &ctx.accounts.platform_treasury,
        &ctx.accounts.ecosystem_treasury,
        now,
        &ctx.accounts.system_program.to_account_info(),
    )?;

    // =========================================================================
    // STEP 1: Add weight to ALL pools (EAGER)
    // =========================================================================

    // ContentRewardPool already updated by mint instruction
    // But we add to our tracked pools
    patron_pool.total_weight += weight as u64;
    ctx.accounts.global_holder_pool.total_weight += weight as u64;
    ctx.accounts.creator_dist_pool.total_weight += weight as u64;

    // Initialize creator weight if new
    let creator_weight = &mut ctx.accounts.creator_weight;
    if creator_weight.creator == Pubkey::default() {
        creator_weight.creator = creator;
        creator_weight.total_weight = 0;
        creator_weight.reward_debt = 0;
        creator_weight.total_claimed = 0;
        creator_weight.created_at = now;
    }

    // =========================================================================
    // STEP 2: Calculate Virtual RPS for lazy pools
    // =========================================================================

    // Patron pool virtual RPS (12% of streaming treasury)
    let patron_treasury_balance = ctx.accounts.creator_patron_treasury.lamports();
    let virtual_patron_rps = calculate_virtual_rps(
        patron_pool.reward_per_share,
        patron_treasury_balance,
        12, // holder share
        patron_pool.total_weight,
    );

    // Global holder pool virtual RPS (12% of ecosystem streaming treasury)
    let eco_treasury_balance = ctx.accounts.ecosystem_streaming_treasury.lamports();
    let virtual_global_rps = calculate_virtual_rps(
        ctx.accounts.global_holder_pool.reward_per_share,
        eco_treasury_balance,
        12, // holder share
        ctx.accounts.global_holder_pool.total_weight,
    );

    // Creator dist pool virtual RPS (80% of ecosystem streaming treasury)
    let virtual_creator_dist_rps = calculate_virtual_rps(
        ctx.accounts.creator_dist_pool.reward_per_share,
        eco_treasury_balance,
        80, // creator share
        ctx.accounts.creator_dist_pool.total_weight,
    );

    // =========================================================================
    // STEP 3: Set debts with virtual RPS
    // =========================================================================

    // Initialize unified NFT state
    let nft_state = &mut ctx.accounts.unified_nft_state;
    nft_state.nft_asset = nft_asset;
    nft_state.creator = creator;
    nft_state.weight = weight;
    nft_state.is_bundle = is_bundle;
    nft_state.content_or_bundle = content_key;

    // SET debt for immediate pool (uses actual RPS)
    nft_state.content_or_bundle_debt = weight as u128 * ctx.accounts.content_reward_pool.reward_per_share;

    // SET debt for lazy pools (uses virtual RPS)
    nft_state.patron_debt = weight as u128 * virtual_patron_rps;
    nft_state.global_debt = weight as u128 * virtual_global_rps;

    nft_state.created_at = now;

    // ADD to creator weight debt (accumulates, not set)
    creator_weight.total_weight += weight as u64;
    creator_weight.reward_debt += weight as u128 * virtual_creator_dist_rps;

    msg!(
        "NFT registered in subscription pools. Weight: {}, Patron debt: {}, Global debt: {}",
        weight,
        nft_state.patron_debt,
        nft_state.global_debt
    );

    Ok(())
}

// ============================================================================
// REGISTER BUNDLE NFT IN SUBSCRIPTION POOLS
// ============================================================================

/// Same as above but for bundle NFTs
#[derive(Accounts)]
pub struct RegisterBundleNftInSubscriptionPools<'info> {
    /// The NFT asset that was just minted
    /// CHECK: We just need the key for PDA derivation
    pub nft_asset: AccountInfo<'info>,

    /// The bundle this NFT belongs to
    pub bundle: Account<'info, Bundle>,

    /// Creator of the bundle
    /// CHECK: Verified against bundle.creator
    #[account(constraint = creator.key() == bundle.creator @ ContentRegistryError::Unauthorized)]
    pub creator: AccountInfo<'info>,

    /// UnifiedNftRewardState - to be initialized
    #[account(
        init,
        payer = payer,
        space = 8 + UnifiedNftRewardState::INIT_SPACE,
        seeds = [UNIFIED_NFT_REWARD_STATE_SEED, nft_asset.key().as_ref()],
        bump
    )]
    pub unified_nft_state: Account<'info, UnifiedNftRewardState>,

    /// BundleRewardPool - already exists, just need RPS
    #[account(
        mut,
        seeds = [BUNDLE_REWARD_POOL_SEED, bundle.key().as_ref()],
        bump
    )]
    pub bundle_reward_pool: Account<'info, BundleRewardPool>,

    /// CreatorPatronPool - lazy-init if needed
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + CreatorPatronPool::INIT_SPACE,
        seeds = [CREATOR_PATRON_POOL_SEED, creator.key().as_ref()],
        bump
    )]
    pub creator_patron_pool: Account<'info, CreatorPatronPool>,

    /// CreatorPatronStreamingTreasury
    /// CHECK: PDA verified by seeds
    #[account(
        seeds = [CREATOR_PATRON_TREASURY_SEED, creator.key().as_ref()],
        bump
    )]
    pub creator_patron_treasury: AccountInfo<'info>,

    /// GlobalHolderPool - singleton
    #[account(
        mut,
        seeds = [GLOBAL_HOLDER_POOL_SEED],
        bump
    )]
    pub global_holder_pool: Account<'info, GlobalHolderPool>,

    /// CreatorDistPool - singleton
    #[account(
        mut,
        seeds = [CREATOR_DIST_POOL_SEED],
        bump
    )]
    pub creator_dist_pool: Account<'info, CreatorDistPool>,

    /// EcosystemEpochState - singleton
    #[account(
        mut,
        seeds = [ECOSYSTEM_EPOCH_STATE_SEED],
        bump
    )]
    pub ecosystem_epoch_state: Account<'info, EcosystemEpochState>,

    /// CreatorWeight - lazy-init if needed
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + CreatorWeight::INIT_SPACE,
        seeds = [CREATOR_WEIGHT_SEED, creator.key().as_ref()],
        bump
    )]
    pub creator_weight: Account<'info, CreatorWeight>,

    /// EcosystemStreamingTreasury
    /// CHECK: PDA verified by seeds
    #[account(
        seeds = [ECOSYSTEM_STREAMING_TREASURY_SEED],
        bump
    )]
    pub ecosystem_streaming_treasury: AccountInfo<'info>,

    /// Creator's wallet (for patron pool distribution)
    /// CHECK: Must match bundle.creator
    #[account(mut)]
    pub creator_wallet: AccountInfo<'info>,

    /// Platform treasury (for distribution)
    /// CHECK: From ecosystem config
    #[account(mut)]
    pub platform_treasury: AccountInfo<'info>,

    /// Ecosystem treasury (for distribution)
    /// CHECK: From ecosystem config
    #[account(mut)]
    pub ecosystem_treasury: AccountInfo<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Handler for registering a bundle NFT in subscription pools
pub fn handle_register_bundle_nft_in_subscription_pools(
    ctx: Context<RegisterBundleNftInSubscriptionPools>,
    weight: u16,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let nft_asset = ctx.accounts.nft_asset.key();
    let creator = ctx.accounts.creator.key();
    let bundle_key = ctx.accounts.bundle.key();

    // STEP 0: Trigger epoch distribution if needed
    let patron_pool = &mut ctx.accounts.creator_patron_pool;

    if patron_pool.creator == Pubkey::default() {
        patron_pool.creator = creator;
        patron_pool.reward_per_share = 0;
        patron_pool.total_weight = 0;
        patron_pool.total_deposited = 0;
        patron_pool.total_claimed = 0;
        patron_pool.last_distribution_at = now;
        patron_pool.epoch_duration = DEFAULT_EPOCH_DURATION;
        patron_pool.created_at = now;
    }

    maybe_distribute_patron_pool(
        patron_pool,
        &ctx.accounts.creator_patron_treasury,
        &ctx.accounts.creator_wallet,
        &ctx.accounts.platform_treasury,
        &ctx.accounts.ecosystem_treasury,
        now,
        &ctx.accounts.system_program.to_account_info(),
        &creator,
    )?;

    maybe_distribute_ecosystem_pools(
        &mut ctx.accounts.global_holder_pool,
        &mut ctx.accounts.creator_dist_pool,
        &mut ctx.accounts.ecosystem_epoch_state,
        &ctx.accounts.ecosystem_streaming_treasury,
        &ctx.accounts.platform_treasury,
        &ctx.accounts.ecosystem_treasury,
        now,
        &ctx.accounts.system_program.to_account_info(),
    )?;

    // STEP 1: Add weight to ALL pools
    patron_pool.total_weight += weight as u64;
    ctx.accounts.global_holder_pool.total_weight += weight as u64;
    ctx.accounts.creator_dist_pool.total_weight += weight as u64;

    let creator_weight = &mut ctx.accounts.creator_weight;
    if creator_weight.creator == Pubkey::default() {
        creator_weight.creator = creator;
        creator_weight.total_weight = 0;
        creator_weight.reward_debt = 0;
        creator_weight.total_claimed = 0;
        creator_weight.created_at = now;
    }

    // STEP 2: Calculate Virtual RPS
    let patron_treasury_balance = ctx.accounts.creator_patron_treasury.lamports();
    let virtual_patron_rps = calculate_virtual_rps(
        patron_pool.reward_per_share,
        patron_treasury_balance,
        12,
        patron_pool.total_weight,
    );

    let eco_treasury_balance = ctx.accounts.ecosystem_streaming_treasury.lamports();
    let virtual_global_rps = calculate_virtual_rps(
        ctx.accounts.global_holder_pool.reward_per_share,
        eco_treasury_balance,
        12,
        ctx.accounts.global_holder_pool.total_weight,
    );

    let virtual_creator_dist_rps = calculate_virtual_rps(
        ctx.accounts.creator_dist_pool.reward_per_share,
        eco_treasury_balance,
        80,
        ctx.accounts.creator_dist_pool.total_weight,
    );

    // STEP 3: Set debts
    let nft_state = &mut ctx.accounts.unified_nft_state;
    nft_state.nft_asset = nft_asset;
    nft_state.creator = creator;
    nft_state.weight = weight;
    nft_state.is_bundle = true;
    nft_state.content_or_bundle = bundle_key;

    // Bundle uses BundleRewardPool for immediate rewards
    nft_state.content_or_bundle_debt = weight as u128 * ctx.accounts.bundle_reward_pool.reward_per_share;
    nft_state.patron_debt = weight as u128 * virtual_patron_rps;
    nft_state.global_debt = weight as u128 * virtual_global_rps;
    nft_state.created_at = now;

    creator_weight.total_weight += weight as u64;
    creator_weight.reward_debt += weight as u128 * virtual_creator_dist_rps;

    msg!(
        "Bundle NFT registered in subscription pools. Weight: {}",
        weight
    );

    Ok(())
}
