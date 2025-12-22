use anchor_lang::prelude::*;
use crate::state::*;
use crate::state::profile::{UserProfile, USER_PROFILE_SEED};
use crate::errors::ContentRegistryError;
use crate::MPL_CORE_ID;

/// Register content without mint config (basic registration)
/// CID uniqueness is enforced by PDA seed ["content", cid_hash]
#[derive(Accounts)]
#[instruction(cid_hash: [u8; 32])]
pub struct RegisterContent<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + ContentEntry::INIT_SPACE,
        seeds = [b"content", cid_hash.as_ref()],
        bump
    )]
    pub content: Account<'info, ContentEntry>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Register content with mint config and Metaplex Core collection
/// CID uniqueness enforced by PDA seed ["content", cid_hash]
/// collection_asset stored directly in ContentEntry (no separate ContentCollection PDA)
#[derive(Accounts)]
#[instruction(cid_hash: [u8; 32])]
pub struct RegisterContentWithMint<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + ContentEntry::INIT_SPACE,
        seeds = [b"content", cid_hash.as_ref()],
        bump
    )]
    pub content: Box<Account<'info, ContentEntry>>,

    #[account(
        init,
        payer = authority,
        space = 8 + MintConfig::INIT_SPACE,
        seeds = [MINT_CONFIG_SEED, content.key().as_ref()],
        bump
    )]
    pub mint_config: Box<Account<'info, MintConfig>>,

    /// The Metaplex Core Collection asset (must be a new keypair)
    /// Address stored in content.collection_asset
    #[account(mut)]
    pub collection_asset: Signer<'info>,

    /// CHECK: Metaplex Core program
    #[account(address = MPL_CORE_ID)]
    pub mpl_core_program: AccountInfo<'info>,

    /// Ecosystem config to get treasury address for royalties
    #[account(
        seeds = [ECOSYSTEM_CONFIG_SEED],
        bump
    )]
    pub ecosystem_config: Box<Account<'info, EcosystemConfig>>,

    /// CHECK: Platform wallet for royalties
    pub platform: AccountInfo<'info>,

    /// User profile for collection naming
    /// Collection name format: "HC: <Username>" or "HC: <Username>: <CollectionName>"
    #[account(
        seeds = [USER_PROFILE_SEED, authority.key().as_ref()],
        bump,
        constraint = user_profile.owner == authority.key() @ ContentRegistryError::Unauthorized
    )]
    pub user_profile: Box<Account<'info, UserProfile>>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateContent<'info> {
    #[account(
        mut,
        has_one = creator @ ContentRegistryError::Unauthorized
    )]
    pub content: Account<'info, ContentEntry>,

    pub creator: Signer<'info>,
}

/// Delete content (basic, no mint config)
#[derive(Accounts)]
pub struct DeleteContent<'info> {
    #[account(
        mut,
        has_one = creator @ ContentRegistryError::Unauthorized,
        close = creator
    )]
    pub content: Account<'info, ContentEntry>,

    #[account(mut)]
    pub creator: Signer<'info>,
}

/// Delete content with mint config
#[derive(Accounts)]
pub struct DeleteContentWithMint<'info> {
    #[account(
        mut,
        has_one = creator @ ContentRegistryError::Unauthorized,
        close = creator
    )]
    pub content: Account<'info, ContentEntry>,

    #[account(
        mut,
        seeds = [MINT_CONFIG_SEED, content.key().as_ref()],
        bump,
        has_one = creator @ ContentRegistryError::Unauthorized,
        close = creator
    )]
    pub mint_config: Account<'info, MintConfig>,

    #[account(mut)]
    pub creator: Signer<'info>,
}
