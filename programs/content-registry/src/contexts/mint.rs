use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::ContentRegistryError;

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
