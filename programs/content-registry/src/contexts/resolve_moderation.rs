use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::ContentRegistryError;

/// Resolve a moderation report after voting period ends
#[derive(Accounts)]
pub struct ResolveModeration<'info> {
    #[account(mut)]
    pub content: Account<'info, ContentEntry>,

    #[account(mut)]
    pub moderation_pool: Account<'info, ModerationPool>,

    #[account(
        mut,
        constraint = report.content == content.key() @ ContentRegistryError::ContentMismatch,
        constraint = report.status == ReportStatus::Pending || report.status == ReportStatus::VotingEnded @ ContentRegistryError::ReportAlreadyResolved
    )]
    pub report: Account<'info, ContentReport>,

    #[account(
        seeds = [MODERATOR_REGISTRY_SEED],
        bump
    )]
    pub moderator_registry: Account<'info, ModeratorRegistry>,

    /// Reporter (may receive refund if report upheld)
    #[account(mut)]
    pub reporter: SystemAccount<'info>,

    /// Resolver (admin or moderator)
    pub resolver: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Resolve moderation with SAS attestation support
/// The attestation_id should be created off-chain via SAS before calling this
#[derive(Accounts)]
pub struct ResolveModerationWithAttestation<'info> {
    #[account(mut)]
    pub content: Account<'info, ContentEntry>,

    #[account(mut)]
    pub moderation_pool: Account<'info, ModerationPool>,

    #[account(
        mut,
        constraint = report.content == content.key() @ ContentRegistryError::ContentMismatch,
        constraint = report.status == ReportStatus::Pending || report.status == ReportStatus::VotingEnded @ ContentRegistryError::ReportAlreadyResolved
    )]
    pub report: Account<'info, ContentReport>,

    #[account(
        seeds = [MODERATOR_REGISTRY_SEED],
        bump
    )]
    pub moderator_registry: Account<'info, ModeratorRegistry>,

    /// Reporter (may receive refund if report upheld)
    #[account(mut)]
    pub reporter: SystemAccount<'info>,

    /// Resolver (admin or moderator)
    pub resolver: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handle_resolve_moderation(
    ctx: Context<ResolveModeration>,
) -> Result<()> {
    let report = &mut ctx.accounts.report;
    let moderation_pool = &mut ctx.accounts.moderation_pool;
    let moderator_registry = &ctx.accounts.moderator_registry;
    let timestamp = Clock::get()?.unix_timestamp;

    // Check voting period has ended
    require!(
        report.is_voting_ended(timestamp),
        ContentRegistryError::VotingNotEnded
    );

    // Check if quorum was reached
    let has_quorum = report.has_quorum(moderator_registry.active_moderators);

    let outcome = if !has_quorum {
        // No quorum - report expires
        ResolutionOutcome::NoQuorum
    } else if report.is_removal_approved() {
        // Quorum reached and removal approved
        ResolutionOutcome::ContentRemoved
    } else {
        // Quorum reached but removal not approved
        ResolutionOutcome::Dismissed
    };

    // Update report
    report.resolve(outcome, ctx.accounts.resolver.key(), timestamp);

    // Update moderation pool
    let upheld = outcome == ResolutionOutcome::ContentRemoved;
    moderation_pool.resolve_report(upheld, timestamp);

    // If content removed, mark it as flagged
    if upheld {
        // Could add additional logic here like:
        // - Disabling minting
        // - Hiding from discovery
        // - etc.
        msg!("Content flagged and removed");
    }

    msg!("Report resolved with outcome: {:?}", outcome);
    msg!("Votes - Remove: {}, Keep: {}, Abstain: {}",
        report.votes_remove, report.votes_keep, report.votes_abstain);

    Ok(())
}

pub fn handle_resolve_moderation_with_attestation(
    ctx: Context<ResolveModerationWithAttestation>,
    attestation_id: Pubkey,
) -> Result<()> {
    let report = &mut ctx.accounts.report;
    let moderation_pool = &mut ctx.accounts.moderation_pool;
    let moderator_registry = &ctx.accounts.moderator_registry;
    let timestamp = Clock::get()?.unix_timestamp;

    // Check voting period has ended
    require!(
        report.is_voting_ended(timestamp),
        ContentRegistryError::VotingNotEnded
    );

    // Check if quorum was reached
    let has_quorum = report.has_quorum(moderator_registry.active_moderators);

    let outcome = if !has_quorum {
        ResolutionOutcome::NoQuorum
    } else if report.is_removal_approved() {
        ResolutionOutcome::ContentRemoved
    } else {
        ResolutionOutcome::Dismissed
    };

    // Update report
    report.resolve(outcome, ctx.accounts.resolver.key(), timestamp);

    // Update moderation pool
    let upheld = outcome == ResolutionOutcome::ContentRemoved;
    moderation_pool.resolve_report(upheld, timestamp);

    // Link SAS attestation to moderation pool
    moderation_pool.set_attestation(attestation_id, timestamp);

    msg!("Report resolved with SAS attestation: {}", attestation_id);
    msg!("Outcome: {:?}", outcome);

    Ok(())
}

/// Allow creator to voluntarily remove content
#[derive(Accounts)]
pub struct VoluntaryRemoval<'info> {
    #[account(
        mut,
        has_one = creator @ ContentRegistryError::Unauthorized
    )]
    pub content: Account<'info, ContentEntry>,

    #[account(
        mut,
        seeds = [MODERATION_POOL_SEED, content.key().as_ref()],
        bump
    )]
    pub moderation_pool: Account<'info, ModerationPool>,

    #[account(
        mut,
        constraint = report.content == content.key() @ ContentRegistryError::ContentMismatch,
        constraint = report.status == ReportStatus::Pending @ ContentRegistryError::ReportAlreadyResolved
    )]
    pub report: Account<'info, ContentReport>,

    pub creator: Signer<'info>,
}

pub fn handle_voluntary_removal(
    ctx: Context<VoluntaryRemoval>,
) -> Result<()> {
    let report = &mut ctx.accounts.report;
    let moderation_pool = &mut ctx.accounts.moderation_pool;
    let timestamp = Clock::get()?.unix_timestamp;

    // Mark report as resolved with voluntary removal
    report.resolve(
        ResolutionOutcome::VoluntaryRemoval,
        ctx.accounts.creator.key(),
        timestamp
    );

    // Update moderation pool
    moderation_pool.resolve_report(true, timestamp);

    msg!("Content voluntarily removed by creator");

    Ok(())
}
