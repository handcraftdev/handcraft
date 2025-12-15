use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::ContentRegistryError;

/// Submit a content moderation report
#[derive(Accounts)]
pub struct SubmitReport<'info> {
    #[account(mut)]
    pub content: Account<'info, ContentEntry>,

    #[account(
        init_if_needed,
        payer = reporter,
        space = 8 + ModerationPool::INIT_SPACE,
        seeds = [MODERATION_POOL_SEED, content.key().as_ref()],
        bump
    )]
    pub moderation_pool: Account<'info, ModerationPool>,

    #[account(
        init,
        payer = reporter,
        space = 8 + ContentReport::INIT_SPACE,
        seeds = [
            CONTENT_REPORT_SEED,
            content.key().as_ref(),
            reporter.key().as_ref(),
            &Clock::get()?.unix_timestamp.to_le_bytes()
        ],
        bump
    )]
    pub report: Account<'info, ContentReport>,

    #[account(
        seeds = [MODERATOR_REGISTRY_SEED],
        bump
    )]
    pub moderator_registry: Account<'info, ModeratorRegistry>,

    #[account(mut)]
    pub reporter: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handle_submit_report(
    ctx: Context<SubmitReport>,
    category: ReportCategory,
    details_cid: String,
) -> Result<()> {
    require!(details_cid.len() <= 64, ContentRegistryError::ReportDetailsTooLong);

    let report = &mut ctx.accounts.report;
    let moderation_pool = &mut ctx.accounts.moderation_pool;
    let timestamp = Clock::get()?.unix_timestamp;

    // Initialize moderation pool if this is the first report
    if moderation_pool.content == Pubkey::default() {
        moderation_pool.content = ctx.accounts.content.key();
        moderation_pool.total_reports = 0;
        moderation_pool.active_reports = 0;
        moderation_pool.upheld_reports = 0;
        moderation_pool.dismissed_reports = 0;
        moderation_pool.is_flagged = false;
        moderation_pool.flagged_at = None;
        moderation_pool.sas_attestation_id = None;
        moderation_pool.created_at = timestamp;
        moderation_pool.updated_at = timestamp;
    }

    // Initialize report
    report.content = ctx.accounts.content.key();
    report.reporter = ctx.accounts.reporter.key();
    report.category = category;
    report.details_cid = details_cid;
    report.status = ReportStatus::Pending;
    report.submitted_at = timestamp;
    report.voting_ends_at = timestamp + VOTING_PERIOD;
    report.votes_remove = 0;
    report.votes_keep = 0;
    report.votes_abstain = 0;
    report.total_votes = 0;
    report.outcome = None;
    report.resolved_at = None;
    report.resolver = None;
    report.reporter_refunded = false;

    // Update pool stats
    moderation_pool.add_report(timestamp);

    msg!("Report submitted for content: {}", ctx.accounts.content.key());
    msg!("Category: {:?}", category);
    msg!("Voting ends at: {}", report.voting_ends_at);

    Ok(())
}
