use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::ContentRegistryError;
use crate::MPL_CORE_ID;

#[derive(Accounts)]
pub struct ConfigureMint<'info> {
    #[account(
        has_one = creator @ ContentRegistryError::Unauthorized
    )]
    pub content: Account<'info, ContentEntry>,

    #[account(
        init,
        payer = creator,
        space = 8 + MintConfig::INIT_SPACE,
        seeds = [MINT_CONFIG_SEED, content.key().as_ref()],
        bump
    )]
    pub mint_config: Account<'info, MintConfig>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateMintSettings<'info> {
    #[account(
        has_one = creator @ ContentRegistryError::Unauthorized
    )]
    pub content: Account<'info, ContentEntry>,

    #[account(
        mut,
        seeds = [MINT_CONFIG_SEED, content.key().as_ref()],
        bump,
        has_one = creator @ ContentRegistryError::Unauthorized
    )]
    pub mint_config: Account<'info, MintConfig>,

    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct MintNftSol<'info> {
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

    /// CHECK: ContentCollection tracker PDA - verified via seeds
    /// We use AccountInfo to reduce stack size (saves 8+ bytes)
    #[account(
        seeds = [CONTENT_COLLECTION_SEED, content.key().as_ref()],
        bump
    )]
    pub content_collection: AccountInfo<'info>,

    /// CHECK: The Metaplex Core Collection asset for this content
    /// NFT will be added to this collection, inheriting its LinkedLifecycleHook
    /// Verification: collection_asset address is read from content_collection data
    #[account(mut)]
    pub collection_asset: AccountInfo<'info>,

    /// Content-specific reward pool
    /// Holder rewards from this content's sales accumulate here
    #[account(
        init_if_needed,
        payer = buyer,
        space = 8 + ContentRewardPool::INIT_SPACE,
        seeds = [CONTENT_REWARD_POOL_SEED, content.key().as_ref()],
        bump
    )]
    pub content_reward_pool: Box<Account<'info, ContentRewardPool>>,

    /// Buyer's wallet state for this content (kept for backwards compatibility)
    /// Now primarily used for UI display, actual rewards tracked per-NFT
    #[account(
        init_if_needed,
        payer = buyer,
        space = 8 + WalletContentState::INIT_SPACE,
        seeds = [WALLET_CONTENT_STATE_SEED, buyer.key().as_ref(), content.key().as_ref()],
        bump
    )]
    pub buyer_wallet_state: Box<Account<'info, WalletContentState>>,

    /// Per-NFT reward state - tracks reward_debt for this specific NFT
    /// This is the source of truth for reward calculations
    #[account(
        init,
        payer = buyer,
        space = 8 + NftRewardState::INIT_SPACE,
        seeds = [NFT_REWARD_STATE_SEED, nft_asset.key().as_ref()],
        bump
    )]
    pub nft_reward_state: Box<Account<'info, NftRewardState>>,

    /// CHECK: Creator to receive payment and be update authority of NFT
    #[account(mut, constraint = content.creator == creator.key())]
    pub creator: AccountInfo<'info>,

    /// CHECK: Optional platform wallet for commission
    #[account(mut)]
    pub platform: Option<AccountInfo<'info>>,

    /// CHECK: Ecosystem treasury
    #[account(mut, constraint = ecosystem_config.treasury == treasury.key())]
    pub treasury: AccountInfo<'info>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    /// The NFT asset account (Metaplex Core asset)
    /// This must be a new keypair generated client-side
    #[account(mut)]
    pub nft_asset: Signer<'info>,

    /// CHECK: Metaplex Core program
    #[account(address = MPL_CORE_ID)]
    pub mpl_core_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}
