use anchor_lang::prelude::*;

use crate::state::*;
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

    /// NFT reward state for the specific NFT
    /// This PDA proves the NFT is valid for this bundle (created only during minting)
    #[account(
        mut,
        seeds = [BUNDLE_NFT_REWARD_STATE_SEED, nft_asset.key().as_ref()],
        bump,
        constraint = nft_reward_state.bundle == bundle.key() @ ContentRegistryError::BundleMismatch
    )]
    pub nft_reward_state: Account<'info, BundleNftRewardState>,

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
    let pending = ctx.accounts.nft_reward_state.pending_reward(reward_per_share);

    if pending == 0 {
        msg!("No rewards available to claim");
        return Ok(()); // Not an error, just nothing to claim
    }

    // Update reward debt before transfer
    ctx.accounts.nft_reward_state.update_reward_debt(reward_per_share);

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

        // Verify NftRewardState PDA (this proves the NFT belongs to this bundle)
        let (expected_pda, _) = Pubkey::find_program_address(
            &[BUNDLE_NFT_REWARD_STATE_SEED, nft_asset.key().as_ref()],
            ctx.program_id,
        );
        if nft_reward_state_info.key() != expected_pda {
            continue;
        }

        // Load and update reward state
        let mut data = nft_reward_state_info.try_borrow_mut_data()?;
        if data.len() < 8 + BundleNftRewardState::INIT_SPACE {
            continue;
        }

        // Read bundle from state (offset 40 after discriminator 8 + nft_asset 32)
        let state_bundle = Pubkey::try_from_slice(&data[40..72])?;
        if state_bundle != bundle_key {
            continue; // Wrong bundle
        }

        // Read weight (u16 at offset 88)
        let weight = u16::from_le_bytes([data[88], data[89]]);

        // Read reward_debt (u128 at offset 72)
        let mut reward_debt_bytes = [0u8; 16];
        reward_debt_bytes.copy_from_slice(&data[72..88]);
        let reward_debt = u128::from_le_bytes(reward_debt_bytes);

        // Calculate pending
        let entitled = (weight as u128) * reward_per_share;
        let pending = if entitled > reward_debt {
            ((entitled - reward_debt) / PRECISION) as u64
        } else {
            0
        };

        if pending > 0 {
            // Update reward_debt
            let new_debt = (weight as u128) * reward_per_share;
            data[72..88].copy_from_slice(&new_debt.to_le_bytes());

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
