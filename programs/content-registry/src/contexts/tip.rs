use anchor_lang::prelude::*;
use crate::state::*;

#[derive(Accounts)]
pub struct TipContent<'info> {
    #[account(mut)]
    pub content: Account<'info, ContentEntry>,

    /// CHECK: Creator wallet to receive tips
    #[account(mut, constraint = content.creator == creator.key())]
    pub creator: AccountInfo<'info>,

    #[account(mut)]
    pub tipper: Signer<'info>,

    pub system_program: Program<'info, System>,
}
