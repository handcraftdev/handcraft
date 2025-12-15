use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::ContentRegistryError;

/// Vote on a content moderation report
#[derive(Accounts)]
pub struct VoteOnReport<'info> {
    #[account(mut)]
    pub report: Account<'info, ContentReport>,

    #[account(
        seeds = [b"moderator", moderator.key().as_ref()],
        bump,
        constraint = moderator_account.is_active @ ContentRegistryError::ModeratorNotActive
    )]
    pub moderator_account: Account<'info, ModeratorAccount>,

    #[account(
        init,
        payer = moderator,
        space = 8 + VoteRecord::INIT_SPACE,
        seeds = [
            VOTE_RECORD_SEED,
            report.key().as_ref(),
            moderator.key().as_ref()
        ],
        bump
    )]
    pub vote_record: Account<'info, VoteRecord>,

    #[account(mut)]
    pub moderator_registry: Account<'info, ModeratorRegistry>,

    #[account(mut)]
    pub moderator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handle_vote_on_report(
    ctx: Context<VoteOnReport>,
    choice: VoteChoice,
) -> Result<()> {
    let report = &mut ctx.accounts.report;
    let moderator_account = &mut ctx.accounts.moderator_account;
    let vote_record = &mut ctx.accounts.vote_record;
    let moderator_registry = &mut ctx.accounts.moderator_registry;
    let timestamp = Clock::get()?.unix_timestamp;

    // Check report is still pending
    require!(
        report.status == ReportStatus::Pending,
        ContentRegistryError::ReportAlreadyResolved
    );

    // Check voting period hasn't ended
    require!(
        !report.is_voting_ended(timestamp),
        ContentRegistryError::VotingEnded
    );

    // Initialize vote record
    vote_record.report = report.key();
    vote_record.moderator = ctx.accounts.moderator.key();
    vote_record.choice = choice;
    vote_record.voted_at = timestamp;

    // Add vote to report
    report.add_vote(choice);

    // Update moderator stats
    moderator_account.record_vote(timestamp);

    // Update registry stats
    moderator_registry.record_vote();

    msg!("Vote recorded by moderator: {}", ctx.accounts.moderator.key());
    msg!("Choice: {:?}", choice);
    msg!("Total votes: {}", report.total_votes);

    Ok(())
}
