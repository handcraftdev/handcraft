use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::ContentRegistryError;
use crate::MPL_CORE_ID;

#[derive(Accounts)]
pub struct SyncNftTransfer<'info> {
    /// The content's reward pool
    #[account(
        mut,
        seeds = [CONTENT_REWARD_POOL_SEED, content_reward_pool.content.as_ref()],
        bump
    )]
    pub content_reward_pool: Account<'info, ContentRewardPool>,

    /// The sender's wallet state for this content
    #[account(
        mut,
        seeds = [WALLET_CONTENT_STATE_SEED, sender.key().as_ref(), content_reward_pool.content.as_ref()],
        bump,
        constraint = sender_wallet_state.wallet == sender.key() @ ContentRegistryError::Unauthorized,
        constraint = sender_wallet_state.content == content_reward_pool.content @ ContentRegistryError::ContentMismatch
    )]
    pub sender_wallet_state: Account<'info, WalletContentState>,

    /// The receiver's wallet state for this content (created if needed)
    #[account(
        init_if_needed,
        payer = sender,
        space = 8 + WalletContentState::INIT_SPACE,
        seeds = [WALLET_CONTENT_STATE_SEED, receiver.key().as_ref(), content_reward_pool.content.as_ref()],
        bump
    )]
    pub receiver_wallet_state: Account<'info, WalletContentState>,

    /// The sender (must sign to authorize the sync)
    #[account(mut)]
    pub sender: Signer<'info>,

    /// CHECK: The receiver of the NFT
    #[account(mut)]
    pub receiver: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SyncNftTransfersBatch<'info> {
    /// The content's reward pool
    #[account(
        mut,
        seeds = [CONTENT_REWARD_POOL_SEED, content_reward_pool.content.as_ref()],
        bump
    )]
    pub content_reward_pool: Account<'info, ContentRewardPool>,

    /// The sender's wallet state for this content
    #[account(
        mut,
        seeds = [WALLET_CONTENT_STATE_SEED, sender.key().as_ref(), content_reward_pool.content.as_ref()],
        bump,
        constraint = sender_wallet_state.wallet == sender.key() @ ContentRegistryError::Unauthorized,
        constraint = sender_wallet_state.content == content_reward_pool.content @ ContentRegistryError::ContentMismatch
    )]
    pub sender_wallet_state: Account<'info, WalletContentState>,

    /// The receiver's wallet state for this content (created if needed)
    #[account(
        init_if_needed,
        payer = sender,
        space = 8 + WalletContentState::INIT_SPACE,
        seeds = [WALLET_CONTENT_STATE_SEED, receiver.key().as_ref(), content_reward_pool.content.as_ref()],
        bump
    )]
    pub receiver_wallet_state: Account<'info, WalletContentState>,

    /// The sender (must sign to authorize the sync)
    #[account(mut)]
    pub sender: Signer<'info>,

    /// CHECK: The receiver of the NFT
    #[account(mut)]
    pub receiver: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

/// Accounts for Metaplex Core lifecycle hook callback
/// Called automatically by Metaplex Core when NFTs with our hook are transferred
/// Receiver's wallet state is created automatically if it doesn't exist
#[derive(Accounts)]
pub struct ExecuteLifecycleHook<'info> {
    /// CHECK: The Metaplex Core program must be the caller
    /// We verify the asset has our lifecycle hook configured
    #[account(address = MPL_CORE_ID)]
    pub mpl_core_program: AccountInfo<'info>,

    /// CHECK: The NFT asset being transferred
    pub asset: AccountInfo<'info>,

    /// The content's reward pool (passed as extra account by Metaplex Core)
    #[account(
        mut,
        seeds = [CONTENT_REWARD_POOL_SEED, content_reward_pool.content.as_ref()],
        bump
    )]
    pub content_reward_pool: Account<'info, ContentRewardPool>,

    /// The sender's wallet state for this content
    #[account(
        mut,
        seeds = [WALLET_CONTENT_STATE_SEED, sender.key().as_ref(), content_reward_pool.content.as_ref()],
        bump
    )]
    pub sender_wallet_state: Account<'info, WalletContentState>,

    /// The receiver's wallet state for this content (created if needed)
    /// Sender pays for account creation as part of transfer cost
    #[account(
        init_if_needed,
        payer = sender,
        space = 8 + WalletContentState::INIT_SPACE,
        seeds = [WALLET_CONTENT_STATE_SEED, receiver.key().as_ref(), content_reward_pool.content.as_ref()],
        bump
    )]
    pub receiver_wallet_state: Account<'info, WalletContentState>,

    /// CHECK: The sender (current owner) of the NFT - pays for receiver account if needed
    #[account(mut)]
    pub sender: Signer<'info>,

    /// CHECK: The receiver (new owner) of the NFT
    #[account(mut)]
    pub receiver: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}
