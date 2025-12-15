use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::ContentRegistryError;

/// Initialize the moderator registry (one-time, admin only)
#[derive(Accounts)]
pub struct InitializeModeratorRegistry<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + ModeratorRegistry::INIT_SPACE,
        seeds = [MODERATOR_REGISTRY_SEED],
        bump
    )]
    pub moderator_registry: Account<'info, ModeratorRegistry>,

    #[account(
        constraint = admin.key() == ecosystem_config.admin @ ContentRegistryError::ModerationAdminOnly
    )]
    pub ecosystem_config: Account<'info, EcosystemConfig>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handle_initialize_moderator_registry(
    ctx: Context<InitializeModeratorRegistry>,
) -> Result<()> {
    let moderator_registry = &mut ctx.accounts.moderator_registry;
    let timestamp = Clock::get()?.unix_timestamp;

    moderator_registry.admin = ctx.accounts.admin.key();
    moderator_registry.total_moderators = 0;
    moderator_registry.active_moderators = 0;
    moderator_registry.total_stake = 0;
    moderator_registry.total_votes_cast = 0;
    moderator_registry.created_at = timestamp;

    msg!("Moderator registry initialized");

    Ok(())
}

/// Register as a moderator by staking SOL
#[derive(Accounts)]
pub struct RegisterModerator<'info> {
    #[account(
        init,
        payer = moderator,
        space = 8 + ModeratorAccount::INIT_SPACE,
        seeds = [b"moderator", moderator.key().as_ref()],
        bump
    )]
    pub moderator_account: Account<'info, ModeratorAccount>,

    #[account(mut)]
    pub moderator_registry: Account<'info, ModeratorRegistry>,

    #[account(mut)]
    pub moderator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handle_register_moderator(
    ctx: Context<RegisterModerator>,
    stake_amount: u64,
) -> Result<()> {
    require!(
        stake_amount >= MIN_MODERATOR_STAKE,
        ContentRegistryError::InsufficientStake
    );

    let moderator_account = &mut ctx.accounts.moderator_account;
    let moderator_registry = &mut ctx.accounts.moderator_registry;
    let timestamp = Clock::get()?.unix_timestamp;

    // Transfer stake to moderator account PDA
    let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
        &ctx.accounts.moderator.key(),
        &moderator_account.key(),
        stake_amount,
    );
    anchor_lang::solana_program::program::invoke(
        &transfer_ix,
        &[
            ctx.accounts.moderator.to_account_info(),
            moderator_account.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;

    // Initialize moderator account
    moderator_account.moderator = ctx.accounts.moderator.key();
    moderator_account.stake = stake_amount;
    moderator_account.is_active = true;
    moderator_account.votes_cast = 0;
    moderator_account.correct_votes = 0;
    moderator_account.reputation = 5000; // Start at 50%
    moderator_account.is_slashed = false;
    moderator_account.joined_at = timestamp;
    moderator_account.last_vote_at = None;

    // Update registry
    moderator_registry.add_moderator(stake_amount);

    msg!("Moderator registered: {}", ctx.accounts.moderator.key());
    msg!("Stake: {} lamports", stake_amount);

    Ok(())
}

/// Unregister as a moderator and withdraw stake
#[derive(Accounts)]
pub struct UnregisterModerator<'info> {
    #[account(
        mut,
        seeds = [b"moderator", moderator.key().as_ref()],
        bump,
        constraint = moderator_account.moderator == moderator.key() @ ContentRegistryError::Unauthorized,
        constraint = moderator_account.is_active @ ContentRegistryError::ModeratorNotActive,
        close = moderator
    )]
    pub moderator_account: Account<'info, ModeratorAccount>,

    #[account(mut)]
    pub moderator_registry: Account<'info, ModeratorRegistry>,

    #[account(mut)]
    pub moderator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handle_unregister_moderator(
    ctx: Context<UnregisterModerator>,
) -> Result<()> {
    let moderator_account = &ctx.accounts.moderator_account;
    let moderator_registry = &mut ctx.accounts.moderator_registry;

    // Update registry (stake will be returned via account close)
    moderator_registry.remove_moderator(moderator_account.stake);

    msg!("Moderator unregistered: {}", ctx.accounts.moderator.key());
    msg!("Stake returned: {} lamports", moderator_account.stake);

    Ok(())
}

/// Slash a moderator for malicious behavior (admin only)
#[derive(Accounts)]
pub struct SlashModerator<'info> {
    #[account(
        mut,
        seeds = [b"moderator", target.key().as_ref()],
        bump
    )]
    pub moderator_account: Account<'info, ModeratorAccount>,

    #[account(mut)]
    pub moderator_registry: Account<'info, ModeratorRegistry>,

    #[account(
        constraint = ecosystem_config.admin == admin.key() @ ContentRegistryError::ModerationAdminOnly
    )]
    pub ecosystem_config: Account<'info, EcosystemConfig>,

    /// The moderator being slashed
    pub target: SystemAccount<'info>,

    /// Admin wallet (receives slashed stake)
    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handle_slash_moderator(
    ctx: Context<SlashModerator>,
) -> Result<()> {
    let moderator_account = &mut ctx.accounts.moderator_account;
    let moderator_registry = &mut ctx.accounts.moderator_registry;

    let stake = moderator_account.stake;

    // Slash the moderator
    moderator_account.slash();

    // Update registry
    moderator_registry.remove_moderator(stake);

    // Transfer slashed stake to admin
    **moderator_account.to_account_info().try_borrow_mut_lamports()? -= stake;
    **ctx.accounts.admin.to_account_info().try_borrow_mut_lamports()? += stake;

    msg!("Moderator slashed: {}", ctx.accounts.target.key());
    msg!("Slashed stake: {} lamports", stake);

    Ok(())
}
