use anchor_lang::prelude::*;

use crate::state::*;
use crate::state::reward_pool::PRECISION;
use crate::errors::ContentRegistryError;

// ============================================================================
// CLAIM BUNDLE REWARDS - Claim holder rewards for bundle NFTs
// ============================================================================

#[derive(Accounts)]
pub struct ClaimBundleRewards<'info> {
    /// The claimer (must own the NFT)
    #[account(mut)]
    pub claimer: Signer<'info>,

    /// The bundle the NFT belongs to
    #[account()]
    pub bundle: Account<'info, Bundle>,

    /// Bundle reward pool to claim from
    #[account(
        mut,
        seeds = [BUNDLE_REWARD_POOL_SEED, bundle.key().as_ref()],
        bump
    )]
    pub bundle_reward_pool: Account<'info, BundleRewardPool>,

    /// CHECK: The NFT asset being claimed for
    #[account()]
    pub nft_asset: AccountInfo<'info>,

    /// Unified NFT reward state - tracks all pool debts including bundle rewards
    #[account(
        mut,
        seeds = [UNIFIED_NFT_REWARD_STATE_SEED, nft_asset.key().as_ref()],
        bump,
        constraint = nft_reward_state.content_or_bundle == bundle.key() @ ContentRegistryError::BundleMismatch,
        constraint = nft_reward_state.is_bundle @ ContentRegistryError::BundleMismatch
    )]
    pub nft_reward_state: Account<'info, UnifiedNftRewardState>,

    pub system_program: Program<'info, System>,
}

pub fn handle_claim_bundle_rewards(ctx: Context<ClaimBundleRewards>) -> Result<()> {
    // Get current rent lamports for reward pool PDA
    let pool_rent = Rent::get()?.minimum_balance(8 + BundleRewardPool::INIT_SPACE);
    let pool_lamports = ctx.accounts.bundle_reward_pool.to_account_info().lamports();

    // Sync secondary sale royalties first
    let synced = ctx.accounts.bundle_reward_pool.sync_secondary_royalties(
        pool_lamports,
        pool_rent,
    );
    if synced > 0 {
        msg!("Synced {} lamports from secondary sales", synced);
    }

    // Verify NFT ownership using Metaplex Core
    // Owner is at offset 1-32 in the asset data
    let nft_data = ctx.accounts.nft_asset.try_borrow_data()?;
    if nft_data.len() < 33 {
        return Err(ContentRegistryError::InvalidNftAsset.into());
    }
    let owner = Pubkey::try_from_slice(&nft_data[1..33])?;
    require!(
        owner == ctx.accounts.claimer.key(),
        ContentRegistryError::ClaimerNotOwner
    );
    drop(nft_data);

    // NFT validity is already verified by nft_reward_state PDA constraint:
    // - PDA is seeded by nft_asset, so it's unique per NFT
    // - nft_reward_state.bundle == bundle.key() constraint ensures it belongs to this bundle
    // - nft_reward_state can only be created by our program during minting

    // Calculate pending reward for this NFT
    let reward_per_share = ctx.accounts.bundle_reward_pool.reward_per_share;
    let pending = ctx.accounts.nft_reward_state.pending_content_or_bundle_reward(reward_per_share);

    if pending == 0 {
        msg!("No rewards available to claim");
        return Ok(()); // Not an error, just nothing to claim
    }

    // Update reward debt before transfer
    let weight = ctx.accounts.nft_reward_state.weight;
    ctx.accounts.nft_reward_state.content_or_bundle_debt = (weight as u128) * reward_per_share;

    // Track total claimed in pool
    ctx.accounts.bundle_reward_pool.total_claimed += pending;

    // Transfer rewards from pool to claimer
    let pool_info = ctx.accounts.bundle_reward_pool.to_account_info();
    let claimer_info = ctx.accounts.claimer.to_account_info();

    **pool_info.try_borrow_mut_lamports()? -= pending;
    **claimer_info.try_borrow_mut_lamports()? += pending;

    msg!("Claimed {} lamports in bundle holder rewards", pending);

    Ok(())
}

// ============================================================================
// BATCH CLAIM BUNDLE REWARDS - Claim for multiple NFTs in one tx
// ============================================================================

#[derive(Accounts)]
pub struct BatchClaimBundleRewards<'info> {
    /// The claimer (must own all NFTs)
    #[account(mut)]
    pub claimer: Signer<'info>,

    /// The bundle
    #[account()]
    pub bundle: Account<'info, Bundle>,

    /// Bundle reward pool
    #[account(
        mut,
        seeds = [BUNDLE_REWARD_POOL_SEED, bundle.key().as_ref()],
        bump
    )]
    pub bundle_reward_pool: Account<'info, BundleRewardPool>,

    pub system_program: Program<'info, System>,
    // remaining_accounts: pairs of (nft_asset, nft_reward_state)
}

pub fn handle_batch_claim_bundle_rewards(ctx: Context<BatchClaimBundleRewards>) -> Result<()> {
    // Sync secondary sales first
    let pool_rent = Rent::get()?.minimum_balance(8 + BundleRewardPool::INIT_SPACE);
    let pool_lamports = ctx.accounts.bundle_reward_pool.to_account_info().lamports();
    let synced = ctx.accounts.bundle_reward_pool.sync_secondary_royalties(
        pool_lamports,
        pool_rent,
    );
    if synced > 0 {
        msg!("Synced {} lamports from secondary sales", synced);
    }

    let remaining = ctx.remaining_accounts;
    require!(
        remaining.len() % 2 == 0,
        ContentRegistryError::InvalidAccountPairs
    );

    let bundle_key = ctx.accounts.bundle.key();
    let claimer_key = ctx.accounts.claimer.key();
    let reward_per_share = ctx.accounts.bundle_reward_pool.reward_per_share;

    let mut total_claimed: u64 = 0;

    // Process pairs of (nft_asset, nft_reward_state)
    for i in (0..remaining.len()).step_by(2) {
        let nft_asset = &remaining[i];
        let nft_reward_state_info = &remaining[i + 1];

        // Verify NFT ownership (owner at offset 1-32)
        let nft_data = nft_asset.try_borrow_data()?;
        if nft_data.len() < 33 {
            continue; // Skip invalid
        }
        let owner = Pubkey::try_from_slice(&nft_data[1..33])?;
        if owner != claimer_key {
            continue; // Skip if not owner
        }
        drop(nft_data);

        // Verify UnifiedNftRewardState PDA
        let (expected_pda, _) = Pubkey::find_program_address(
            &[UNIFIED_NFT_REWARD_STATE_SEED, nft_asset.key().as_ref()],
            ctx.program_id,
        );
        if nft_reward_state_info.key() != expected_pda {
            continue;
        }

        // Load and update reward state
        let mut data = nft_reward_state_info.try_borrow_mut_data()?;
        if data.len() < 8 + UnifiedNftRewardState::INIT_SPACE {
            continue;
        }

        // UnifiedNftRewardState layout:
        // - discriminator: 8 bytes (0-7)
        // - nft_asset: 32 bytes (8-39)
        // - creator: 32 bytes (40-71)
        // - rarity: 1 byte (72)
        // - weight: 2 bytes (73-74)
        // - is_bundle: 1 byte (75)
        // - content_or_bundle: 32 bytes (76-107)
        // - content_or_bundle_debt: 16 bytes (108-123)

        // Check is_bundle flag (offset 75)
        if data[75] == 0 {
            continue; // Not a bundle NFT
        }

        // Read content_or_bundle from state (offset 76-107)
        let state_bundle = Pubkey::try_from_slice(&data[76..108])?;
        if state_bundle != bundle_key {
            continue; // Wrong bundle
        }

        // Read weight (u16 at offset 73)
        let weight = u16::from_le_bytes([data[73], data[74]]);

        // Read content_or_bundle_debt (u128 at offset 108)
        let mut debt_bytes = [0u8; 16];
        debt_bytes.copy_from_slice(&data[108..124]);
        let reward_debt = u128::from_le_bytes(debt_bytes);

        // Calculate pending
        let entitled = (weight as u128) * reward_per_share;
        let pending = if entitled > reward_debt {
            ((entitled - reward_debt) / PRECISION) as u64
        } else {
            0
        };

        if pending > 0 {
            // Update content_or_bundle_debt
            let new_debt = (weight as u128) * reward_per_share;
            data[108..124].copy_from_slice(&new_debt.to_le_bytes());

            total_claimed += pending;
        }
    }

    if total_claimed > 0 {
        // Track in pool
        ctx.accounts.bundle_reward_pool.total_claimed += total_claimed;

        // Transfer from pool to claimer
        let pool_info = ctx.accounts.bundle_reward_pool.to_account_info();
        let claimer_info = ctx.accounts.claimer.to_account_info();

        **pool_info.try_borrow_mut_lamports()? -= total_claimed;
        **claimer_info.try_borrow_mut_lamports()? += total_claimed;

        msg!("Batch claimed {} lamports in bundle holder rewards", total_claimed);
    } else {
        msg!("No bundle rewards available to claim");
    }

    Ok(())
}

// ============================================================================
// DISTRIBUTE BUNDLE SECONDARY TO CONTENT - Distribute 50% of secondary holder rewards to content pools
// ============================================================================

#[derive(Accounts)]
pub struct DistributeBundleSecondaryToContent<'info> {
    /// Anyone can call this to trigger distribution (permissionless)
    #[account(mut)]
    pub payer: Signer<'info>,

    /// The bundle
    #[account()]
    pub bundle: Account<'info, Bundle>,

    /// Bundle reward pool - source of pending content share
    #[account(
        mut,
        seeds = [BUNDLE_REWARD_POOL_SEED, bundle.key().as_ref()],
        bump
    )]
    pub bundle_reward_pool: Account<'info, BundleRewardPool>,

    pub system_program: Program<'info, System>,
    // remaining_accounts: content_reward_pools for each content in bundle
}

pub fn handle_distribute_bundle_secondary_to_content(
    ctx: Context<DistributeBundleSecondaryToContent>
) -> Result<()> {
    // First sync any pending secondary royalties
    let pool_rent = Rent::get()?.minimum_balance(8 + BundleRewardPool::INIT_SPACE);
    let pool_lamports = ctx.accounts.bundle_reward_pool.to_account_info().lamports();
    let synced = ctx.accounts.bundle_reward_pool.sync_secondary_royalties(
        pool_lamports,
        pool_rent,
    );
    if synced > 0 {
        msg!("Synced {} lamports from secondary sales", synced);
    }

    // Get pending content share
    let pending = ctx.accounts.bundle_reward_pool.pending_content_share;
    if pending == 0 {
        msg!("No pending content share to distribute");
        return Ok(());
    }

    let remaining = ctx.remaining_accounts;
    if remaining.is_empty() {
        msg!("No content reward pools provided");
        return Ok(());
    }

    // First pass: calculate total weight across all content pools
    let mut total_combined_weight: u64 = 0;
    let mut pool_weights: Vec<u64> = Vec::with_capacity(remaining.len());

    for content_pool_info in remaining.iter() {
        if content_pool_info.owner != ctx.program_id {
            pool_weights.push(0);
            continue;
        }

        let pool_data = content_pool_info.try_borrow_data()?;
        if pool_data.len() < 8 + ContentRewardPool::INIT_SPACE {
            pool_weights.push(0);
            continue;
        }

        // Read total_weight (u64 at offset 64)
        let mut weight_bytes = [0u8; 8];
        weight_bytes.copy_from_slice(&pool_data[64..72]);
        let weight = u64::from_le_bytes(weight_bytes);

        pool_weights.push(weight);
        total_combined_weight += weight;
    }

    if total_combined_weight == 0 {
        msg!("No content pools have holders, nothing to distribute");
        return Ok(());
    }

    // Take the pending content share from bundle pool
    let distributed = ctx.accounts.bundle_reward_pool.take_pending_content_share();

    // Second pass: distribute proportionally by weight
    let bundle_pool_info = ctx.accounts.bundle_reward_pool.to_account_info();
    let mut total_actually_distributed: u64 = 0;

    for (i, content_pool_info) in remaining.iter().enumerate() {
        let pool_weight = pool_weights[i];
        if pool_weight == 0 {
            continue;
        }

        // Calculate share based on weight proportion
        let share = (distributed as u128 * pool_weight as u128 / total_combined_weight as u128) as u64;
        if share == 0 {
            continue;
        }

        // Load content reward pool data and add rewards
        let mut pool_data = content_pool_info.try_borrow_mut_data()?;

        // ContentRewardPool layout:
        // - discriminator: 8 bytes (0-7)
        // - cid_hash: 32 bytes (8-39)
        // - reward_per_share: 16 bytes (40-55)
        // - total_nfts: 8 bytes (56-63)
        // - total_weight: 8 bytes (64-71)
        // - total_deposited: 8 bytes (72-79)
        // - total_claimed: 8 bytes (80-87)
        // - created_at: 8 bytes (88-95)

        // Read reward_per_share (u128 at offset 40)
        let mut rps_bytes = [0u8; 16];
        rps_bytes.copy_from_slice(&pool_data[40..56]);
        let reward_per_share = u128::from_le_bytes(rps_bytes);

        // Calculate new reward_per_share for this pool's holders
        let new_rps = reward_per_share + (share as u128 * PRECISION) / pool_weight as u128;
        pool_data[40..56].copy_from_slice(&new_rps.to_le_bytes());

        // Update total_deposited
        let mut deposited_bytes = [0u8; 8];
        deposited_bytes.copy_from_slice(&pool_data[72..80]);
        let total_deposited = u64::from_le_bytes(deposited_bytes);
        let new_deposited = total_deposited + share;
        pool_data[72..80].copy_from_slice(&new_deposited.to_le_bytes());

        drop(pool_data);

        // Transfer lamports from bundle pool to content pool
        **bundle_pool_info.try_borrow_mut_lamports()? -= share;
        **content_pool_info.try_borrow_mut_lamports()? += share;

        total_actually_distributed += share;
        msg!("Distributed {} lamports to content pool {} (weight: {})", share, content_pool_info.key(), pool_weight);
    }

    msg!("Total distributed {} lamports by weight to {} content pools", total_actually_distributed, remaining.len());

    Ok(())
}
