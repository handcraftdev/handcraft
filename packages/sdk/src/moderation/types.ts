import { PublicKey } from "@solana/web3.js";

// ============================================================================
// ENUMS - using const objects for Turbopack compatibility
// ============================================================================

export const ReportCategory = {
  Copyright: "Copyright",
  Illegal: "Illegal",
  Spam: "Spam",
  AdultContent: "AdultContent",
  Harassment: "Harassment",
  Fraud: "Fraud",
  Other: "Other",
} as const;
export type ReportCategory = typeof ReportCategory[keyof typeof ReportCategory];

export const ReportStatus = {
  Pending: "Pending",
  VotingEnded: "VotingEnded",
  Resolved: "Resolved",
  Expired: "Expired",
} as const;
export type ReportStatus = typeof ReportStatus[keyof typeof ReportStatus];

export const ResolutionOutcome = {
  ContentRemoved: "ContentRemoved",
  Dismissed: "Dismissed",
  NoQuorum: "NoQuorum",
  VoluntaryRemoval: "VoluntaryRemoval",
} as const;
export type ResolutionOutcome = typeof ResolutionOutcome[keyof typeof ResolutionOutcome];

export const VoteChoice = {
  Remove: "Remove",
  Keep: "Keep",
  Abstain: "Abstain",
} as const;
export type VoteChoice = typeof VoteChoice[keyof typeof VoteChoice];

// ============================================================================
// ACCOUNT TYPES
// ============================================================================

export interface ContentReport {
  content: PublicKey;
  reporter: PublicKey;
  category: ReportCategory;
  detailsCid: string;
  status: ReportStatus;
  submittedAt: bigint;
  votingEndsAt: bigint;
  votesRemove: bigint;
  votesKeep: bigint;
  votesAbstain: bigint;
  totalVotes: bigint;
  outcome: ResolutionOutcome | null;
  resolvedAt: bigint | null;
  resolver: PublicKey | null;
  reporterRefunded: boolean;
}

export interface ModerationPool {
  content: PublicKey;
  totalReports: bigint;
  activeReports: bigint;
  upheldReports: bigint;
  dismissedReports: bigint;
  isFlagged: boolean;
  flaggedAt: bigint | null;
  sasAttestationId: PublicKey | null;
  createdAt: bigint;
  updatedAt: bigint;
}

export interface ModeratorRegistry {
  admin: PublicKey;
  totalModerators: bigint;
  activeModerators: bigint;
  totalStake: bigint;
  totalVotesCast: bigint;
  createdAt: bigint;
}

export interface ModeratorAccount {
  moderator: PublicKey;
  stake: bigint;
  isActive: boolean;
  votesCast: bigint;
  correctVotes: bigint;
  reputation: number; // 0-10000 basis points
  isSlashed: boolean;
  joinedAt: bigint;
  lastVoteAt: bigint | null;
}

export interface VoteRecord {
  report: PublicKey;
  moderator: PublicKey;
  choice: VoteChoice;
  votedAt: bigint;
}

// ============================================================================
// HELPER TYPES
// ============================================================================

export interface ReportWithDetails extends ContentReport {
  contentCid?: string;
  contentType?: string;
  creatorAddress?: PublicKey;
}

export interface ModeratorStats {
  account: ModeratorAccount;
  accuracyRate: number; // calculated: correctVotes / votesCast
  isEligibleToVote: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const MIN_MODERATOR_STAKE = 100_000_000; // 0.1 SOL
export const VOTING_PERIOD = 7 * 24 * 60 * 60; // 7 days in seconds
export const QUORUM_THRESHOLD_BPS = 3000; // 30%
export const APPROVAL_THRESHOLD_BPS = 6000; // 60%

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function reportCategoryToAnchor(category: ReportCategory): { [key: string]: {} } {
  return { [category.toLowerCase()]: {} };
}

export function voteChoiceToAnchor(choice: VoteChoice): { [key: string]: {} } {
  return { [choice.toLowerCase()]: {} };
}

export function anchorToReportCategory(obj: any): ReportCategory {
  const key = Object.keys(obj)[0];
  return ReportCategory[key.charAt(0).toUpperCase() + key.slice(1) as keyof typeof ReportCategory];
}

export function anchorToReportStatus(obj: any): ReportStatus {
  const key = Object.keys(obj)[0];
  return ReportStatus[key.charAt(0).toUpperCase() + key.slice(1) as keyof typeof ReportStatus];
}

export function anchorToResolutionOutcome(obj: any): ResolutionOutcome | null {
  if (!obj) return null;
  const key = Object.keys(obj)[0];
  return ResolutionOutcome[key.charAt(0).toUpperCase() + key.slice(1) as keyof typeof ResolutionOutcome];
}

export function anchorToVoteChoice(obj: any): VoteChoice {
  const key = Object.keys(obj)[0];
  return VoteChoice[key.charAt(0).toUpperCase() + key.slice(1) as keyof typeof VoteChoice];
}

export function calculateQuorumRequired(activeModerators: number): number {
  return Math.floor((activeModerators * QUORUM_THRESHOLD_BPS) / 10000);
}

export function calculateApprovalRequired(totalVotes: number): number {
  return Math.floor((totalVotes * APPROVAL_THRESHOLD_BPS) / 10000);
}

export function isVotingActive(report: ContentReport, now: number): boolean {
  return report.status === ReportStatus.Pending && Number(report.votingEndsAt) > now;
}

export function hasQuorum(report: ContentReport, activeModerators: number): boolean {
  if (activeModerators === 0) return false;
  const quorumRequired = calculateQuorumRequired(activeModerators);
  return Number(report.totalVotes) >= quorumRequired;
}

export function isRemovalApproved(report: ContentReport): boolean {
  if (Number(report.totalVotes) === 0) return false;
  const approvalRequired = calculateApprovalRequired(Number(report.totalVotes));
  return Number(report.votesRemove) >= approvalRequired;
}
