use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::ContentRegistryError;
use crate::MPL_CORE_ID;

/// Configure rental settings for content
/// Only the content creator can configure rent
#[derive(Accounts)]
pub struct ConfigureRent<'info> {
    #[account(
        has_one = creator @ ContentRegistryError::Unauthorized
    )]
    pub content: Account<'info, ContentEntry>,

    #[account(
        init,
        payer = creator,
        space = 8 + RentConfig::INIT_SPACE,
        seeds = [RENT_CONFIG_SEED, content.key().as_ref()],
        bump
    )]
    pub rent_config: Account<'info, RentConfig>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Update existing rental settings
#[derive(Accounts)]
pub struct UpdateRentConfig<'info> {
    pub content: Account<'info, ContentEntry>,

    #[account(
        mut,
        seeds = [RENT_CONFIG_SEED, content.key().as_ref()],
        bump,
        has_one = creator @ ContentRegistryError::Unauthorized
    )]
    pub rent_config: Account<'info, RentConfig>,

    pub creator: Signer<'info>,
}

/// Rent content with SOL payment
/// Creates a frozen (non-transferable) NFT with expiry in Attributes plugin
#[derive(Accounts)]
pub struct RentContentSol<'info> {
    #[account(
        seeds = [ECOSYSTEM_CONFIG_SEED],
        bump
    )]
    pub ecosystem_config: Box<Account<'info, EcosystemConfig>>,

    /// Content entry - collection_asset stored here
    pub content: Box<Account<'info, ContentEntry>>,

    #[account(
        mut,
        seeds = [RENT_CONFIG_SEED, content.key().as_ref()],
        bump,
        constraint = rent_config.is_active @ ContentRegistryError::RentingNotActive
    )]
    pub rent_config: Box<Account<'info, RentConfig>>,

    /// MintConfig PDA - authority for collection operations (signs NFT creation)
    #[account(
        seeds = [MINT_CONFIG_SEED, content.key().as_ref()],
        bump
    )]
    pub mint_config: Box<Account<'info, MintConfig>>,

    /// The collection asset for this content
    /// CHECK: Verified via content.collection_asset
    #[account(
        mut,
        constraint = collection_asset.key() == content.collection_asset @ ContentRegistryError::InvalidCollection
    )]
    pub collection_asset: AccountInfo<'info>,

    /// Content reward pool for holder rewards
    /// Created on first mint or rent
    #[account(
        init_if_needed,
        payer = renter,
        space = 8 + ContentRewardPool::INIT_SPACE,
        seeds = [CONTENT_REWARD_POOL_SEED, content.key().as_ref()],
        bump
    )]
    pub content_reward_pool: Box<Account<'info, ContentRewardPool>>,

    /// The rental NFT asset (new keypair, signer)
    /// Expiry stored in Attributes plugin (no separate RentEntry PDA)
    #[account(mut)]
    pub nft_asset: Signer<'info>,

    /// Creator receives payment
    /// CHECK: Verified via content.creator
    #[account(mut)]
    pub creator: AccountInfo<'info>,

    /// Platform receives fees
    /// CHECK: Platform wallet
    #[account(mut)]
    pub platform: Option<AccountInfo<'info>>,

    /// Treasury receives ecosystem fees
    /// CHECK: Verified via ecosystem_config.treasury
    #[account(mut)]
    pub treasury: AccountInfo<'info>,

    /// Renter paying for rental
    #[account(mut)]
    pub renter: Signer<'info>,

    /// CHECK: Metaplex Core program
    #[account(address = MPL_CORE_ID)]
    pub mpl_core_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

/// Check if a rental has expired (for access control)
/// Rental expiry is read from the NFT's Attributes plugin
#[derive(Accounts)]
pub struct CheckRentExpiry<'info> {
    /// CHECK: The NFT asset to check - expiry stored in Attributes plugin
    pub nft_asset: AccountInfo<'info>,
}
