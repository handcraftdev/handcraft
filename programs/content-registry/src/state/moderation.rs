use anchor_lang::prelude::*;

// ============================================================================
// SEED CONSTANTS
// ============================================================================

/// Content report PDA seed
pub const CONTENT_REPORT_SEED: &[u8] = b"content_report";

/// Moderation pool PDA seed (per content)
pub const MODERATION_POOL_SEED: &[u8] = b"moderation_pool";

/// Moderator registry PDA seed (singleton)
pub const MODERATOR_REGISTRY_SEED: &[u8] = b"moderator_registry";

/// Vote record PDA seed (per moderator per report)
pub const VOTE_RECORD_SEED: &[u8] = b"vote_record";

/// Minimum stake required to become a moderator (0.1 SOL)
pub const MIN_MODERATOR_STAKE: u64 = 100_000_000;

/// Voting period duration (7 days in seconds)
pub const VOTING_PERIOD: i64 = 7 * 24 * 60 * 60;

/// Quorum threshold (minimum percentage of active moderators that must vote)
pub const QUORUM_THRESHOLD_BPS: u16 = 3000; // 30%

/// Approval threshold (percentage of votes needed to approve action)
pub const APPROVAL_THRESHOLD_BPS: u16 = 6000; // 60%

// ============================================================================
// ENUMS
// ============================================================================

/// Report category types
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum ReportCategory {
    /// Copyright infringement
    Copyright,
    /// Illegal content
    Illegal,
    /// Spam or misleading content
    Spam,
    /// Adult content without proper labeling
    AdultContent,
    /// Harassment or hate speech
    Harassment,
    /// Scam or fraud
    Fraud,
    /// Other violations
    Other,
}

/// Current status of a report
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum ReportStatus {
    /// Report submitted, voting in progress
    Pending,
    /// Voting period ended, awaiting resolution
    VotingEnded,
    /// Report resolved (action taken or dismissed)
    Resolved,
    /// Report expired without reaching quorum
    Expired,
}

/// Outcome of moderation resolution
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum ResolutionOutcome {
    /// Content was found to be in violation and removed
    ContentRemoved,
    /// Content was found to be compliant, report dismissed
    Dismissed,
    /// Report did not reach quorum, no action taken
    NoQuorum,
    /// Creator voluntarily removed content
    VoluntaryRemoval,
}

/// Moderator vote choice
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum VoteChoice {
    /// Vote to remove content
    Remove,
    /// Vote to keep content
    Keep,
    /// Abstain from voting
    Abstain,
}

// ============================================================================
// CONTENT REPORT
// ============================================================================

/// Content report submitted by users
/// PDA seeds: ["content_report", content, reporter, timestamp]
#[account]
#[derive(InitSpace)]
pub struct ContentReport {
    /// Content being reported
    pub content: Pubkey,
    /// User who submitted the report
    pub reporter: Pubkey,
    /// Category of the report
    pub category: ReportCategory,
    /// IPFS CID containing detailed report information
    #[max_len(64)]
    pub details_cid: String,
    /// Current status of the report
    pub status: ReportStatus,
    /// Timestamp when report was submitted
    pub submitted_at: i64,
    /// Timestamp when voting ends
    pub voting_ends_at: i64,
    /// Number of votes to remove
    pub votes_remove: u64,
    /// Number of votes to keep
    pub votes_keep: u64,
    /// Number of abstentions
    pub votes_abstain: u64,
    /// Total number of votes cast
    pub total_votes: u64,
    /// Resolution outcome (if resolved)
    pub outcome: Option<ResolutionOutcome>,
    /// Timestamp when resolved
    pub resolved_at: Option<i64>,
    /// Moderator who resolved the report
    pub resolver: Option<Pubkey>,
    /// Whether reporter was refunded (if report upheld)
    pub reporter_refunded: bool,
}

impl ContentReport {
    /// Check if voting period has ended
    pub fn is_voting_ended(&self, now: i64) -> bool {
        now >= self.voting_ends_at
    }

    /// Check if quorum was reached
    /// Requires QUORUM_THRESHOLD_BPS percentage of active moderators to vote
    pub fn has_quorum(&self, active_moderators: u64) -> bool {
        if active_moderators == 0 {
            return false;
        }
        let quorum_required = (active_moderators * QUORUM_THRESHOLD_BPS as u64) / 10000;
        self.total_votes >= quorum_required
    }

    /// Check if removal was approved
    /// Requires APPROVAL_THRESHOLD_BPS percentage of votes to be "Remove"
    pub fn is_removal_approved(&self) -> bool {
        if self.total_votes == 0 {
            return false;
        }
        let approval_required = (self.total_votes * APPROVAL_THRESHOLD_BPS as u64) / 10000;
        self.votes_remove >= approval_required
    }

    /// Add a vote to this report
    pub fn add_vote(&mut self, choice: VoteChoice) {
        match choice {
            VoteChoice::Remove => self.votes_remove += 1,
            VoteChoice::Keep => self.votes_keep += 1,
            VoteChoice::Abstain => self.votes_abstain += 1,
        }
        self.total_votes += 1;
    }

    /// Mark report as resolved
    pub fn resolve(&mut self, outcome: ResolutionOutcome, resolver: Pubkey, timestamp: i64) {
        self.status = ReportStatus::Resolved;
        self.outcome = Some(outcome);
        self.resolver = Some(resolver);
        self.resolved_at = Some(timestamp);
    }
}

// ============================================================================
// MODERATION POOL
// ============================================================================

/// Per-content moderation pool for tracking reports and attestations
/// PDA seeds: ["moderation_pool", content]
#[account]
#[derive(InitSpace)]
pub struct ModerationPool {
    /// Content being moderated
    pub content: Pubkey,
    /// Total number of reports submitted
    pub total_reports: u64,
    /// Number of active (pending/voting) reports
    pub active_reports: u64,
    /// Number of upheld reports (content removed)
    pub upheld_reports: u64,
    /// Number of dismissed reports
    pub dismissed_reports: u64,
    /// Whether content is currently flagged/removed
    pub is_flagged: bool,
    /// Timestamp when content was flagged (if flagged)
    pub flagged_at: Option<i64>,
    /// Solana Attestation Service (SAS) attestation ID
    /// Points to on-chain attestation proving moderation decision
    pub sas_attestation_id: Option<Pubkey>,
    /// Timestamp when pool was created
    pub created_at: i64,
    /// Timestamp when last updated
    pub updated_at: i64,
}

impl ModerationPool {
    /// Add a new report
    pub fn add_report(&mut self, timestamp: i64) {
        self.total_reports += 1;
        self.active_reports += 1;
        self.updated_at = timestamp;
    }

    /// Mark report as resolved
    pub fn resolve_report(&mut self, upheld: bool, timestamp: i64) {
        if self.active_reports > 0 {
            self.active_reports -= 1;
        }

        if upheld {
            self.upheld_reports += 1;
            self.is_flagged = true;
            self.flagged_at = Some(timestamp);
        } else {
            self.dismissed_reports += 1;
        }

        self.updated_at = timestamp;
    }

    /// Link SAS attestation
    pub fn set_attestation(&mut self, attestation_id: Pubkey, timestamp: i64) {
        self.sas_attestation_id = Some(attestation_id);
        self.updated_at = timestamp;
    }

    /// Remove flag (for appeals or reinstatement)
    pub fn remove_flag(&mut self, timestamp: i64) {
        self.is_flagged = false;
        self.flagged_at = None;
        self.updated_at = timestamp;
    }
}

// ============================================================================
// MODERATOR REGISTRY
// ============================================================================

/// Global moderator registry tracking all active moderators
/// PDA seeds: ["moderator_registry"]
#[account]
#[derive(InitSpace)]
pub struct ModeratorRegistry {
    /// Admin who can add/remove moderators
    pub admin: Pubkey,
    /// Total number of registered moderators
    pub total_moderators: u64,
    /// Number of active moderators (staked and not slashed)
    pub active_moderators: u64,
    /// Total stake held by all moderators
    pub total_stake: u64,
    /// Total number of votes cast across all reports
    pub total_votes_cast: u64,
    /// Timestamp when registry was created
    pub created_at: i64,
}

impl ModeratorRegistry {
    /// Add a new moderator
    pub fn add_moderator(&mut self, stake: u64) {
        self.total_moderators += 1;
        self.active_moderators += 1;
        self.total_stake += stake;
    }

    /// Remove a moderator
    pub fn remove_moderator(&mut self, stake: u64) {
        if self.active_moderators > 0 {
            self.active_moderators -= 1;
        }
        self.total_stake = self.total_stake.saturating_sub(stake);
    }

    /// Record a vote
    pub fn record_vote(&mut self) {
        self.total_votes_cast += 1;
    }
}

// ============================================================================
// MODERATOR ACCOUNT
// ============================================================================

/// Individual moderator account
/// PDA seeds: ["moderator", moderator_pubkey]
#[account]
#[derive(InitSpace)]
pub struct ModeratorAccount {
    /// Moderator's wallet
    pub moderator: Pubkey,
    /// Amount staked
    pub stake: u64,
    /// Whether moderator is active
    pub is_active: bool,
    /// Number of votes cast
    pub votes_cast: u64,
    /// Number of correct votes (aligned with final outcome)
    pub correct_votes: u64,
    /// Reputation score (basis points, 10000 = 100%)
    pub reputation: u16,
    /// Whether moderator has been slashed
    pub is_slashed: bool,
    /// Timestamp when joined
    pub joined_at: i64,
    /// Timestamp when last voted
    pub last_vote_at: Option<i64>,
}

impl ModeratorAccount {
    /// Record a vote and update stats
    pub fn record_vote(&mut self, timestamp: i64) {
        self.votes_cast += 1;
        self.last_vote_at = Some(timestamp);
    }

    /// Update reputation after report resolution
    /// Increases reputation if vote aligned with outcome
    pub fn update_reputation(&mut self, vote_was_correct: bool) {
        if vote_was_correct {
            self.correct_votes += 1;
            // Increase reputation by 1% (100 bps), max 100%
            self.reputation = (self.reputation + 100).min(10000);
        } else {
            // Decrease reputation by 2% (200 bps), min 0%
            self.reputation = self.reputation.saturating_sub(200);
        }
    }

    /// Slash moderator for malicious behavior
    pub fn slash(&mut self) {
        self.is_slashed = true;
        self.is_active = false;
        self.reputation = 0;
    }
}

// ============================================================================
// VOTE RECORD
// ============================================================================

/// Individual vote record
/// PDA seeds: ["vote_record", report, moderator]
#[account]
#[derive(InitSpace)]
pub struct VoteRecord {
    /// Report being voted on
    pub report: Pubkey,
    /// Moderator who cast the vote
    pub moderator: Pubkey,
    /// Vote choice
    pub choice: VoteChoice,
    /// Timestamp when vote was cast
    pub voted_at: i64,
}
