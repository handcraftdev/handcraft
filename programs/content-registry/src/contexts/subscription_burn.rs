use anchor_lang::prelude::*;
use mpl_core::instructions::BurnV1CpiBuilder;
use crate::state::*;
use crate::errors::ContentRegistryError;
use crate::MPL_CORE_ID;

// ============================================================================
// BURN NFT WITH SUBSCRIPTION POOL RECONCILIATION
// ============================================================================

/// Burn a content NFT with proper subscription pool reconciliation
/// - Auto-claims all pending rewards from all pools before burning
/// - Removes weight from all subscription pools
/// - Does NOT reduce CreatorWeight.reward_debt (creator loses potential future rewards)
/// - Closes UnifiedNftRewardState account (refunds rent to owner)
/// - Burns the NFT via Metaplex Core CPI (signed by mint_config PDA)
#[derive(Accounts)]
pub struct BurnNftWithSubscription<'info> {
    /// The content entry this NFT belongs to
    #[account(
        constraint = content.collection_asset == collection_asset.key() @ ContentRegistryError::ContentMismatch
    )]
    pub content: Account<'info, ContentEntry>,

    /// MintConfig PDA - authority for collection operations (signs burn)
    #[account(
        seeds = [MINT_CONFIG_SEED, content.key().as_ref()],
        bump
    )]
    pub mint_config: Account<'info, MintConfig>,

    /// Content's reward pool - needs to decrement weight
    #[account(
        mut,
        seeds = [CONTENT_REWARD_POOL_SEED, content.key().as_ref()],
        bump
    )]
    pub content_reward_pool: Account<'info, ContentRewardPool>,

    /// UnifiedNftRewardState - will be closed and rent refunded to owner
    #[account(
        mut,
        seeds = [UNIFIED_NFT_REWARD_STATE_SEED, nft_asset.key().as_ref()],
        bump,
        constraint = unified_nft_state.content_or_bundle == content.key() @ ContentRegistryError::ContentMismatch,
        constraint = !unified_nft_state.is_bundle @ ContentRegistryError::InvalidNftType,
        close = owner
    )]
    pub unified_nft_state: Account<'info, UnifiedNftRewardState>,

    /// Creator of the content
    /// CHECK: Verified against content.creator
    #[account(constraint = creator.key() == content.creator @ ContentRegistryError::Unauthorized)]
    pub creator: AccountInfo<'info>,

    /// CreatorPatronPool - remove weight
    #[account(
        mut,
        seeds = [CREATOR_PATRON_POOL_SEED, creator.key().as_ref()],
        bump
    )]
    pub creator_patron_pool: Account<'info, CreatorPatronPool>,

    /// GlobalHolderPool - remove weight
    #[account(
        mut,
        seeds = [GLOBAL_HOLDER_POOL_SEED],
        bump
    )]
    pub global_holder_pool: Account<'info, GlobalHolderPool>,

    /// CreatorDistPool - remove weight
    #[account(
        mut,
        seeds = [CREATOR_DIST_POOL_SEED],
        bump
    )]
    pub creator_dist_pool: Account<'info, CreatorDistPool>,

    /// CreatorWeight - remove NFT weight (but keep debt to penalize burned NFTs)
    #[account(
        mut,
        seeds = [CREATOR_WEIGHT_SEED, creator.key().as_ref()],
        bump
    )]
    pub creator_weight: Account<'info, CreatorWeight>,

    /// The NFT asset to burn (Metaplex Core asset)
    /// CHECK: Verified by Metaplex Core program
    #[account(mut)]
    pub nft_asset: AccountInfo<'info>,

    /// The collection the NFT belongs to
    /// CHECK: Verified by Metaplex Core program
    #[account(mut)]
    pub collection_asset: AccountInfo<'info>,

    /// The NFT owner who is burning
    #[account(mut)]
    pub owner: Signer<'info>,

    /// CHECK: Metaplex Core program
    #[account(address = MPL_CORE_ID)]
    pub mpl_core_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

/// Burn content NFT with subscription pool reconciliation
pub fn handle_burn_nft_with_subscription(ctx: Context<BurnNftWithSubscription>) -> Result<()> {
    let nft_state = &ctx.accounts.unified_nft_state;
    let weight = nft_state.weight;

    // =========================================================================
    // STEP 1: Auto-claim pending rewards from ContentRewardPool
    // =========================================================================
    let content_pool = &mut ctx.accounts.content_reward_pool;
    let weighted_rps = weight as u128 * content_pool.reward_per_share;
    let content_pending = weighted_rps.saturating_sub(nft_state.content_or_bundle_debt) / PRECISION;

    if content_pending > 0 {
        **content_pool.to_account_info().try_borrow_mut_lamports()? -= content_pending as u64;
        **ctx.accounts.owner.to_account_info().try_borrow_mut_lamports()? += content_pending as u64;
        content_pool.total_claimed += content_pending as u64;
        msg!("Auto-claimed {} lamports from content pool", content_pending);
    }

    // =========================================================================
    // STEP 2: Auto-claim pending rewards from CreatorPatronPool
    // =========================================================================
    let patron_pool = &mut ctx.accounts.creator_patron_pool;
    let patron_weighted_rps = weight as u128 * patron_pool.reward_per_share;
    let patron_pending = patron_weighted_rps.saturating_sub(nft_state.patron_debt) / PRECISION;

    if patron_pending > 0 {
        **patron_pool.to_account_info().try_borrow_mut_lamports()? -= patron_pending as u64;
        **ctx.accounts.owner.to_account_info().try_borrow_mut_lamports()? += patron_pending as u64;
        patron_pool.total_claimed += patron_pending as u64;
        msg!("Auto-claimed {} lamports from patron pool", patron_pending);
    }

    // =========================================================================
    // STEP 3: Auto-claim pending rewards from GlobalHolderPool
    // =========================================================================
    let holder_pool = &mut ctx.accounts.global_holder_pool;
    let global_weighted_rps = weight as u128 * holder_pool.reward_per_share;
    let global_pending = global_weighted_rps.saturating_sub(nft_state.global_debt) / PRECISION;

    if global_pending > 0 {
        **holder_pool.to_account_info().try_borrow_mut_lamports()? -= global_pending as u64;
        **ctx.accounts.owner.to_account_info().try_borrow_mut_lamports()? += global_pending as u64;
        holder_pool.total_claimed += global_pending as u64;
        msg!("Auto-claimed {} lamports from global holder pool", global_pending);
    }

    // =========================================================================
    // STEP 4: Remove weight from ALL pools
    // =========================================================================

    // ContentRewardPool
    content_pool.total_weight = content_pool.total_weight.saturating_sub(weight as u64);
    content_pool.total_nfts = content_pool.total_nfts.saturating_sub(1);

    // CreatorPatronPool
    patron_pool.total_weight = patron_pool.total_weight.saturating_sub(weight as u64);

    // GlobalHolderPool
    holder_pool.total_weight = holder_pool.total_weight.saturating_sub(weight as u64);

    // CreatorDistPool
    ctx.accounts.creator_dist_pool.total_weight =
        ctx.accounts.creator_dist_pool.total_weight.saturating_sub(weight as u64);

    // CreatorWeight - remove weight but DO NOT reduce debt
    // This means creator loses potential future rewards for burned NFTs
    ctx.accounts.creator_weight.total_weight =
        ctx.accounts.creator_weight.total_weight.saturating_sub(weight as u64);

    msg!("Removed weight {} from all pools", weight);

    // =========================================================================
    // STEP 5: Burn NFT via Metaplex Core CPI
    // =========================================================================
    let content_key = ctx.accounts.content.key();
    let (_, mint_config_bump) = Pubkey::find_program_address(
        &[MINT_CONFIG_SEED, content_key.as_ref()],
        ctx.program_id,
    );
    let signer_seeds: &[&[&[u8]]] = &[&[
        MINT_CONFIG_SEED,
        content_key.as_ref(),
        &[mint_config_bump],
    ]];

    BurnV1CpiBuilder::new(&ctx.accounts.mpl_core_program)
        .asset(&ctx.accounts.nft_asset)
        .collection(Some(&ctx.accounts.collection_asset))
        .payer(&ctx.accounts.owner)
        .authority(Some(&ctx.accounts.mint_config.to_account_info()))
        .invoke_signed(signer_seeds)?;

    msg!("NFT burned successfully with subscription reconciliation");

    Ok(())
}

// ============================================================================
// BURN BUNDLE NFT WITH SUBSCRIPTION POOL RECONCILIATION
// ============================================================================

/// Burn a bundle NFT with proper subscription pool reconciliation
/// Burns via Metaplex Core CPI (signed by bundle_mint_config PDA)
#[derive(Accounts)]
pub struct BurnBundleNftWithSubscription<'info> {
    /// The bundle this NFT belongs to
    #[account(
        constraint = bundle.collection_asset == collection_asset.key() @ ContentRegistryError::BundleMismatch
    )]
    pub bundle: Account<'info, Bundle>,

    /// BundleMintConfig PDA - authority for collection operations (signs burn)
    #[account(
        seeds = [BUNDLE_MINT_CONFIG_SEED, bundle.key().as_ref()],
        bump
    )]
    pub bundle_mint_config: Account<'info, BundleMintConfig>,

    /// Bundle's reward pool - needs to decrement weight
    #[account(
        mut,
        seeds = [BUNDLE_REWARD_POOL_SEED, bundle.key().as_ref()],
        bump
    )]
    pub bundle_reward_pool: Account<'info, BundleRewardPool>,

    /// UnifiedNftRewardState - will be closed and rent refunded to owner
    #[account(
        mut,
        seeds = [UNIFIED_NFT_REWARD_STATE_SEED, nft_asset.key().as_ref()],
        bump,
        constraint = unified_nft_state.content_or_bundle == bundle.key() @ ContentRegistryError::BundleMismatch,
        constraint = unified_nft_state.is_bundle @ ContentRegistryError::InvalidNftType,
        close = owner
    )]
    pub unified_nft_state: Account<'info, UnifiedNftRewardState>,

    /// Creator of the bundle
    /// CHECK: Verified against bundle.creator
    #[account(constraint = creator.key() == bundle.creator @ ContentRegistryError::Unauthorized)]
    pub creator: AccountInfo<'info>,

    /// CreatorPatronPool - remove weight
    #[account(
        mut,
        seeds = [CREATOR_PATRON_POOL_SEED, creator.key().as_ref()],
        bump
    )]
    pub creator_patron_pool: Account<'info, CreatorPatronPool>,

    /// GlobalHolderPool - remove weight
    #[account(
        mut,
        seeds = [GLOBAL_HOLDER_POOL_SEED],
        bump
    )]
    pub global_holder_pool: Account<'info, GlobalHolderPool>,

    /// CreatorDistPool - remove weight
    #[account(
        mut,
        seeds = [CREATOR_DIST_POOL_SEED],
        bump
    )]
    pub creator_dist_pool: Account<'info, CreatorDistPool>,

    /// CreatorWeight - remove NFT weight
    #[account(
        mut,
        seeds = [CREATOR_WEIGHT_SEED, creator.key().as_ref()],
        bump
    )]
    pub creator_weight: Account<'info, CreatorWeight>,

    /// The NFT asset to burn (Metaplex Core asset)
    /// CHECK: Verified by Metaplex Core program
    #[account(mut)]
    pub nft_asset: AccountInfo<'info>,

    /// The collection the NFT belongs to
    /// CHECK: Verified by Metaplex Core program
    #[account(mut)]
    pub collection_asset: AccountInfo<'info>,

    /// The NFT owner who is burning
    #[account(mut)]
    pub owner: Signer<'info>,

    /// CHECK: Metaplex Core program
    #[account(address = MPL_CORE_ID)]
    pub mpl_core_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

/// Burn bundle NFT with subscription pool reconciliation
pub fn handle_burn_bundle_nft_with_subscription(ctx: Context<BurnBundleNftWithSubscription>) -> Result<()> {
    let nft_state = &ctx.accounts.unified_nft_state;
    let weight = nft_state.weight;

    // STEP 1: Auto-claim pending rewards from BundleRewardPool
    let bundle_pool = &mut ctx.accounts.bundle_reward_pool;
    let weighted_rps = weight as u128 * bundle_pool.reward_per_share;
    let bundle_pending = weighted_rps.saturating_sub(nft_state.content_or_bundle_debt) / PRECISION;

    if bundle_pending > 0 {
        **bundle_pool.to_account_info().try_borrow_mut_lamports()? -= bundle_pending as u64;
        **ctx.accounts.owner.to_account_info().try_borrow_mut_lamports()? += bundle_pending as u64;
        bundle_pool.total_claimed += bundle_pending as u64;
        msg!("Auto-claimed {} lamports from bundle pool", bundle_pending);
    }

    // STEP 2: Auto-claim from CreatorPatronPool
    let patron_pool = &mut ctx.accounts.creator_patron_pool;
    let patron_pending = (weight as u128 * patron_pool.reward_per_share)
        .saturating_sub(nft_state.patron_debt) / PRECISION;

    if patron_pending > 0 {
        **patron_pool.to_account_info().try_borrow_mut_lamports()? -= patron_pending as u64;
        **ctx.accounts.owner.to_account_info().try_borrow_mut_lamports()? += patron_pending as u64;
        patron_pool.total_claimed += patron_pending as u64;
        msg!("Auto-claimed {} lamports from patron pool", patron_pending);
    }

    // STEP 3: Auto-claim from GlobalHolderPool
    let holder_pool = &mut ctx.accounts.global_holder_pool;
    let global_pending = (weight as u128 * holder_pool.reward_per_share)
        .saturating_sub(nft_state.global_debt) / PRECISION;

    if global_pending > 0 {
        **holder_pool.to_account_info().try_borrow_mut_lamports()? -= global_pending as u64;
        **ctx.accounts.owner.to_account_info().try_borrow_mut_lamports()? += global_pending as u64;
        holder_pool.total_claimed += global_pending as u64;
        msg!("Auto-claimed {} lamports from global holder pool", global_pending);
    }

    // STEP 4: Remove weight from ALL pools
    bundle_pool.total_weight = bundle_pool.total_weight.saturating_sub(weight as u64);
    bundle_pool.total_nfts = bundle_pool.total_nfts.saturating_sub(1);
    patron_pool.total_weight = patron_pool.total_weight.saturating_sub(weight as u64);
    holder_pool.total_weight = holder_pool.total_weight.saturating_sub(weight as u64);
    ctx.accounts.creator_dist_pool.total_weight =
        ctx.accounts.creator_dist_pool.total_weight.saturating_sub(weight as u64);
    ctx.accounts.creator_weight.total_weight =
        ctx.accounts.creator_weight.total_weight.saturating_sub(weight as u64);

    msg!("Removed weight {} from all pools", weight);

    // STEP 5: Burn NFT via Metaplex Core CPI
    let bundle_key = ctx.accounts.bundle.key();
    let (_, bundle_mint_config_bump) = Pubkey::find_program_address(
        &[BUNDLE_MINT_CONFIG_SEED, bundle_key.as_ref()],
        ctx.program_id,
    );
    let signer_seeds: &[&[&[u8]]] = &[&[
        BUNDLE_MINT_CONFIG_SEED,
        bundle_key.as_ref(),
        &[bundle_mint_config_bump],
    ]];

    BurnV1CpiBuilder::new(&ctx.accounts.mpl_core_program)
        .asset(&ctx.accounts.nft_asset)
        .collection(Some(&ctx.accounts.collection_asset))
        .payer(&ctx.accounts.owner)
        .authority(Some(&ctx.accounts.bundle_mint_config.to_account_info()))
        .invoke_signed(signer_seeds)?;

    msg!("Bundle NFT burned successfully with subscription reconciliation");

    Ok(())
}
