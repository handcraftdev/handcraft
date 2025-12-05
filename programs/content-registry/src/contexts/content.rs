use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::ContentRegistryError;
use crate::MPL_CORE_ID;

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

    #[account(
        init,
        payer = authority,
        space = 8 + CidRegistry::INIT_SPACE,
        seeds = [CID_REGISTRY_SEED, cid_hash.as_ref()],
        bump
    )]
    pub cid_registry: Account<'info, CidRegistry>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

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
    pub content: Account<'info, ContentEntry>,

    #[account(
        init,
        payer = authority,
        space = 8 + CidRegistry::INIT_SPACE,
        seeds = [CID_REGISTRY_SEED, cid_hash.as_ref()],
        bump
    )]
    pub cid_registry: Account<'info, CidRegistry>,

    #[account(
        init,
        payer = authority,
        space = 8 + MintConfig::INIT_SPACE,
        seeds = [MINT_CONFIG_SEED, content.key().as_ref()],
        bump
    )]
    pub mint_config: Account<'info, MintConfig>,

    /// ContentCollection PDA to track the collection for this content
    #[account(
        init,
        payer = authority,
        space = 8 + ContentCollection::INIT_SPACE,
        seeds = [CONTENT_COLLECTION_SEED, content.key().as_ref()],
        bump
    )]
    pub content_collection: Account<'info, ContentCollection>,

    /// The Metaplex Core Collection asset (must be a new keypair)
    #[account(mut)]
    pub collection_asset: Signer<'info>,

    /// CHECK: Metaplex Core program
    #[account(address = MPL_CORE_ID)]
    pub mpl_core_program: AccountInfo<'info>,

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

#[derive(Accounts)]
pub struct DeleteContent<'info> {
    #[account(
        mut,
        has_one = creator @ ContentRegistryError::Unauthorized,
        close = creator
    )]
    pub content: Account<'info, ContentEntry>,

    #[account(
        mut,
        close = creator
    )]
    pub cid_registry: Account<'info, CidRegistry>,

    #[account(mut)]
    pub creator: Signer<'info>,
}

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
        close = creator
    )]
    pub cid_registry: Account<'info, CidRegistry>,

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
