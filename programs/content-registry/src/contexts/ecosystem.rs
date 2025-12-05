use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::ContentRegistryError;

#[derive(Accounts)]
pub struct InitializeEcosystem<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + EcosystemConfig::INIT_SPACE,
        seeds = [ECOSYSTEM_CONFIG_SEED],
        bump
    )]
    pub ecosystem_config: Account<'info, EcosystemConfig>,

    /// CHECK: Treasury wallet to receive ecosystem fees
    pub treasury: AccountInfo<'info>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateEcosystem<'info> {
    #[account(
        mut,
        seeds = [ECOSYSTEM_CONFIG_SEED],
        bump,
        has_one = admin @ ContentRegistryError::Unauthorized
    )]
    pub ecosystem_config: Account<'info, EcosystemConfig>,

    pub admin: Signer<'info>,
}
