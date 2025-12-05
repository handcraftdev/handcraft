use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::ContentRegistryError;

#[derive(Accounts)]
pub struct ClaimContentRewards<'info> {
    /// The content's reward pool to claim from
    #[account(
        mut,
        seeds = [CONTENT_REWARD_POOL_SEED, content_reward_pool.content.as_ref()],
        bump
    )]
    pub content_reward_pool: Account<'info, ContentRewardPool>,

    /// The holder's wallet state for this content
    #[account(
        mut,
        seeds = [WALLET_CONTENT_STATE_SEED, holder.key().as_ref(), wallet_content_state.content.as_ref()],
        bump,
        constraint = wallet_content_state.wallet == holder.key() @ ContentRegistryError::Unauthorized,
        constraint = wallet_content_state.content == content_reward_pool.content @ ContentRegistryError::ContentMismatch
    )]
    pub wallet_content_state: Account<'info, WalletContentState>,

    /// The holder claiming the reward
    #[account(mut)]
    pub holder: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimAllRewards<'info> {
    /// The holder claiming rewards from multiple content pools
    #[account(mut)]
    pub holder: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Accounts for claim_rewards_verified instruction
/// This is the recommended claim method that verifies NFT ownership at claim time
#[derive(Accounts)]
pub struct ClaimRewardsVerified<'info> {
    /// The content's reward pool to claim from
    #[account(
        mut,
        seeds = [CONTENT_REWARD_POOL_SEED, content_reward_pool.content.as_ref()],
        bump
    )]
    pub content_reward_pool: Account<'info, ContentRewardPool>,

    /// The holder's wallet state for this content
    #[account(
        mut,
        seeds = [WALLET_CONTENT_STATE_SEED, holder.key().as_ref(), wallet_content_state.content.as_ref()],
        bump,
        constraint = wallet_content_state.wallet == holder.key() @ ContentRegistryError::Unauthorized,
        constraint = wallet_content_state.content == content_reward_pool.content @ ContentRegistryError::ContentMismatch
    )]
    pub wallet_content_state: Account<'info, WalletContentState>,

    /// The content collection to verify NFTs against
    #[account(
        seeds = [CONTENT_COLLECTION_SEED, content_reward_pool.content.as_ref()],
        bump
    )]
    pub content_collection: Account<'info, ContentCollection>,

    /// The holder claiming the reward
    #[account(mut)]
    pub holder: Signer<'info>,

    pub system_program: Program<'info, System>,
}
