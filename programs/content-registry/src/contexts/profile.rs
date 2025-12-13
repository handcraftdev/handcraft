use anchor_lang::prelude::*;
use crate::state::{UserProfile, USER_PROFILE_SEED, MAX_USERNAME_LENGTH};
use crate::errors::ContentRegistryError;

// ============================================================================
// CREATE USER PROFILE
// ============================================================================

#[derive(Accounts)]
pub struct CreateUserProfile<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + UserProfile::INIT_SPACE,
        seeds = [USER_PROFILE_SEED, owner.key().as_ref()],
        bump
    )]
    pub user_profile: Account<'info, UserProfile>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn create_user_profile(ctx: Context<CreateUserProfile>, username: String) -> Result<()> {
    require!(
        UserProfile::validate_username(&username),
        ContentRegistryError::InvalidUsername
    );

    let clock = Clock::get()?;
    let profile = &mut ctx.accounts.user_profile;

    profile.owner = ctx.accounts.owner.key();
    profile.username = username;
    profile.created_at = clock.unix_timestamp;
    profile.updated_at = clock.unix_timestamp;

    msg!("Created user profile: {}", profile.username);

    Ok(())
}

// ============================================================================
// UPDATE USER PROFILE
// ============================================================================

#[derive(Accounts)]
pub struct UpdateUserProfile<'info> {
    #[account(
        mut,
        seeds = [USER_PROFILE_SEED, owner.key().as_ref()],
        bump,
        has_one = owner
    )]
    pub user_profile: Account<'info, UserProfile>,

    pub owner: Signer<'info>,
}

pub fn update_user_profile(ctx: Context<UpdateUserProfile>, username: String) -> Result<()> {
    require!(
        UserProfile::validate_username(&username),
        ContentRegistryError::InvalidUsername
    );

    let clock = Clock::get()?;
    let profile = &mut ctx.accounts.user_profile;

    profile.username = username;
    profile.updated_at = clock.unix_timestamp;

    msg!("Updated user profile: {}", profile.username);

    Ok(())
}
