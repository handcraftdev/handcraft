"use client";

import { useState, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { ContentReport, VoteChoice, isVotingActive, ReportCategory } from "@handcraft/sdk";
import { useModeration } from "@/hooks/useModeration";

interface VotingPanelProps {
  report: ContentReport;
  reportPda: PublicKey;
  onVoteSuccess?: () => void;
}

const CATEGORY_LABELS: Record<ReportCategory, string> = {
  [ReportCategory.Copyright]: "Copyright",
  [ReportCategory.Illegal]: "Illegal",
  [ReportCategory.Spam]: "Spam",
  [ReportCategory.AdultContent]: "Adult Content",
  [ReportCategory.Harassment]: "Harassment",
  [ReportCategory.Fraud]: "Fraud",
  [ReportCategory.Other]: "Other",
};

export function VotingPanel({ report, reportPda, onVoteSuccess }: VotingPanelProps) {
  const { voteOnReport, hasVotedOnReport, isModerator, moderatorRegistry } = useModeration();
  const [hasVoted, setHasVoted] = useState(false);
  const [isCheckingVote, setIsCheckingVote] = useState(true);
  const [votingChoice, setVotingChoice] = useState<VoteChoice | null>(null);

  const now = Math.floor(Date.now() / 1000);
  const isActive = isVotingActive(report, now);
  const votingEndsAt = new Date(Number(report.votingEndsAt) * 1000);
  const timeRemaining = Math.max(0, Number(report.votingEndsAt) - now);

  const totalVotes = Number(report.totalVotes);
  const removeVotes = Number(report.votesRemove);
  const keepVotes = Number(report.votesKeep);
  const abstainVotes = Number(report.votesAbstain);

  const removePercent = totalVotes > 0 ? (removeVotes / totalVotes) * 100 : 0;
  const keepPercent = totalVotes > 0 ? (keepVotes / totalVotes) * 100 : 0;

  useEffect(() => {
    async function checkVote() {
      const voted = await hasVotedOnReport(reportPda);
      setHasVoted(voted);
      setIsCheckingVote(false);
    }
    checkVote();
  }, [reportPda, hasVotedOnReport]);

  const handleVote = async (choice: VoteChoice) => {
    setVotingChoice(choice);
    try {
      await voteOnReport.mutateAsync({ report: reportPda, choice });
      setHasVoted(true);
      onVoteSuccess?.();
    } catch (err) {
      console.error("Vote failed:", err);
    } finally {
      setVotingChoice(null);
    }
  };

  const formatTimeRemaining = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h remaining`;
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  };

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full border border-red-500/30">
              {CATEGORY_LABELS[report.category as ReportCategory] || report.category}
            </span>
            {isActive ? (
              <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full border border-green-500/30">
                Active
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-white/10 text-white/50 text-xs rounded-full border border-white/20">
                Ended
              </span>
            )}
          </div>
          <p className="text-xs text-white/40 mt-2">
            Reported by {report.reporter.toBase58().slice(0, 4)}...{report.reporter.toBase58().slice(-4)}
          </p>
        </div>
        {isActive && (
          <div className="text-right">
            <p className="text-xs text-white/70">{formatTimeRemaining(timeRemaining)}</p>
            <p className="text-[10px] text-white/40">Ends {votingEndsAt.toLocaleDateString()}</p>
          </div>
        )}
      </div>

      {/* Vote Progress */}
      <div className="space-y-3">
        {/* Remove votes */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-red-400">Remove ({removeVotes})</span>
            <span className="text-white/50">{removePercent.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-500/60 rounded-full transition-all duration-500"
              style={{ width: `${removePercent}%` }}
            />
          </div>
        </div>

        {/* Keep votes */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-green-400">Keep ({keepVotes})</span>
            <span className="text-white/50">{keepPercent.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500/60 rounded-full transition-all duration-500"
              style={{ width: `${keepPercent}%` }}
            />
          </div>
        </div>

        {/* Abstain */}
        <div className="text-xs text-white/40">
          Abstain: {abstainVotes} votes
        </div>
      </div>

      {/* Quorum info */}
      {moderatorRegistry && (
        <div className="text-xs text-white/40 border-t border-white/5 pt-3">
          Quorum: {totalVotes} / {Math.ceil(Number(moderatorRegistry.activeModerators) * 0.3)} required (30% of {moderatorRegistry.activeModerators.toString()} moderators)
        </div>
      )}

      {/* Voting buttons */}
      {isActive && isModerator && !hasVoted && !isCheckingVote && (
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => handleVote(VoteChoice.Remove)}
            disabled={voteOnReport.isPending}
            className="flex-1 py-2.5 bg-red-500/20 hover:bg-red-500/30 rounded-xl font-medium transition-colors border border-red-500/30 text-red-400 text-sm disabled:opacity-50"
          >
            {votingChoice === VoteChoice.Remove ? "Voting..." : "Vote Remove"}
          </button>
          <button
            onClick={() => handleVote(VoteChoice.Keep)}
            disabled={voteOnReport.isPending}
            className="flex-1 py-2.5 bg-green-500/20 hover:bg-green-500/30 rounded-xl font-medium transition-colors border border-green-500/30 text-green-400 text-sm disabled:opacity-50"
          >
            {votingChoice === VoteChoice.Keep ? "Voting..." : "Vote Keep"}
          </button>
          <button
            onClick={() => handleVote(VoteChoice.Abstain)}
            disabled={voteOnReport.isPending}
            className="py-2.5 px-4 bg-white/5 hover:bg-white/10 rounded-xl font-medium transition-colors border border-white/10 text-white/50 text-sm disabled:opacity-50"
          >
            {votingChoice === VoteChoice.Abstain ? "..." : "Abstain"}
          </button>
        </div>
      )}

      {/* Already voted indicator */}
      {hasVoted && (
        <div className="flex items-center gap-2 py-2 text-sm text-white/50">
          <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          You have already voted on this report
        </div>
      )}

      {/* Not a moderator message */}
      {isActive && !isModerator && (
        <div className="text-sm text-white/40 py-2">
          Only registered moderators can vote on reports
        </div>
      )}
    </div>
  );
}
