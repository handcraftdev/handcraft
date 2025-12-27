"use client";

import { useState } from "react";
import { BN } from "@coral-xyz/anchor";
import {
  type Dispute,
  type Subject,
  VoteChoiceEnum,
  type VoteChoice,
  isDisputePending,
  getDisputeTypeName,
} from "@scalecraft/sdk";
import { useScalecraft } from "@/hooks/useScalecraft";

interface VotingPanelProps {
  contentCid: string;
  subject: Subject;
  dispute: Dispute;
  onVoteSuccess?: () => void;
}

// Minimum stake allocation for voting
const MIN_VOTE_STAKE = 0.01; // 0.01 SOL

export function VotingPanel({
  contentCid,
  subject,
  dispute,
  onVoteSuccess,
}: VotingPanelProps) {
  const { client, isConnected } = useScalecraft();
  const [isVoting, setIsVoting] = useState(false);
  const [votingChoice, setVotingChoice] = useState<"challenger" | "defender" | null>(null);
  const [stakeAmount, setStakeAmount] = useState(MIN_VOTE_STAKE.toString());
  const [error, setError] = useState<string | null>(null);

  const now = Date.now();
  const votingEndsAt = new Date(dispute.votingEndsAt.toNumber() * 1000);
  const votingStartsAt = new Date(dispute.votingStartsAt.toNumber() * 1000);
  const isActive = isDisputePending(dispute.status) && votingEndsAt.getTime() > now;
  const hasVotingStarted = votingStartsAt.getTime() <= now;

  const timeRemaining = Math.max(0, Math.floor((votingEndsAt.getTime() - now) / 1000));

  // Vote counts
  const challengerVotes = dispute.votesForChallenger.toNumber() / 1e9;
  const defenderVotes = dispute.votesForDefender.toNumber() / 1e9;
  const totalVotes = challengerVotes + defenderVotes;

  const challengerPercent = totalVotes > 0 ? (challengerVotes / totalVotes) * 100 : 50;
  const defenderPercent = totalVotes > 0 ? (defenderVotes / totalVotes) * 100 : 50;

  const handleVote = async (choice: "challenger" | "defender") => {
    if (!isConnected) {
      setError("Please connect your wallet");
      return;
    }

    const stakeLamports = Math.floor(parseFloat(stakeAmount || "0") * 1e9);
    if (stakeLamports < MIN_VOTE_STAKE * 1e9) {
      setError(`Minimum stake is ${MIN_VOTE_STAKE} SOL`);
      return;
    }

    setIsVoting(true);
    setVotingChoice(choice);
    setError(null);

    try {
      const voteChoice: VoteChoice =
        choice === "challenger" ? VoteChoiceEnum.ForChallenger : VoteChoiceEnum.ForDefender;

      await client.voteOnDispute({
        subjectId: subject.subjectId,
        choice: voteChoice,
        stakeAllocation: new BN(stakeLamports),
      });

      onVoteSuccess?.();
    } catch (err) {
      console.error("Vote failed:", err);
      setError(err instanceof Error ? err.message : "Vote failed");
    } finally {
      setIsVoting(false);
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
            <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded-full border border-orange-500/30">
              {getDisputeTypeName(dispute.disputeType)}
            </span>
            {isActive && hasVotingStarted ? (
              <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full border border-green-500/30">
                Voting Active
              </span>
            ) : isActive ? (
              <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full border border-yellow-500/30">
                Waiting
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-white/10 text-white/50 text-xs rounded-full border border-white/20">
                Ended
              </span>
            )}
          </div>
          <p className="text-xs text-white/40 mt-2">
            {dispute.challengerCount} challenger{dispute.challengerCount !== 1 ? "s" : ""} ·{" "}
            {dispute.defenderCount} defender{dispute.defenderCount !== 1 ? "s" : ""} ·{" "}
            {dispute.voteCount} vote{dispute.voteCount !== 1 ? "s" : ""}
          </p>
        </div>
        {isActive && (
          <div className="text-right">
            <p className="text-xs text-white/70">{formatTimeRemaining(timeRemaining)}</p>
            <p className="text-xs text-white/40">
              Ends {votingEndsAt.toLocaleDateString()}
            </p>
          </div>
        )}
      </div>

      {/* Stakes at risk */}
      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
          <p className="text-xs text-white/50 uppercase">Challenger Stake</p>
          <p className="text-lg font-semibold text-orange-400">
            {(dispute.totalStake.toNumber() / 1e9).toFixed(2)} SOL
          </p>
        </div>
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-xs text-white/50 uppercase">Defender Bond</p>
          <p className="text-lg font-semibold text-blue-400">
            {(dispute.bondAtRisk.toNumber() / 1e9).toFixed(2)} SOL
          </p>
        </div>
      </div>

      {/* Vote Progress */}
      <div className="space-y-3">
        {/* For Challenger */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-orange-400">For Challenger ({challengerVotes.toFixed(2)} SOL)</span>
            <span className="text-white/50">{challengerPercent.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-500/60 rounded-full transition-all duration-500"
              style={{ width: `${challengerPercent}%` }}
            />
          </div>
        </div>

        {/* For Defender */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-blue-400">For Defender ({defenderVotes.toFixed(2)} SOL)</span>
            <span className="text-white/50">{defenderPercent.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500/60 rounded-full transition-all duration-500"
              style={{ width: `${defenderPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Voting section */}
      {isActive && hasVotingStarted && (
        <>
          <div className="space-y-2 pt-2 border-t border-white/5">
            <label className="block text-xs font-medium text-white/70">
              Your Stake Allocation (SOL)
            </label>
            <input
              type="number"
              step="0.01"
              min={MIN_VOTE_STAKE}
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
              className="w-full px-3 py-2 bg-white/[0.02] border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/20"
              placeholder={`Min: ${MIN_VOTE_STAKE} SOL`}
            />
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => handleVote("challenger")}
              disabled={isVoting || !isConnected}
              className="flex-1 py-2.5 bg-orange-500/20 hover:bg-orange-500/30 rounded-xl font-medium transition-colors border border-orange-500/30 text-orange-400 text-sm disabled:opacity-50"
            >
              {votingChoice === "challenger" ? "Voting..." : "Vote for Challenger"}
            </button>
            <button
              onClick={() => handleVote("defender")}
              disabled={isVoting || !isConnected}
              className="flex-1 py-2.5 bg-blue-500/20 hover:bg-blue-500/30 rounded-xl font-medium transition-colors border border-blue-500/30 text-blue-400 text-sm disabled:opacity-50"
            >
              {votingChoice === "defender" ? "Voting..." : "Vote for Defender"}
            </button>
          </div>
        </>
      )}

      {/* Not connected message */}
      {isActive && hasVotingStarted && !isConnected && (
        <div className="text-sm text-white/40 py-2 text-center">
          Connect your wallet to vote
        </div>
      )}
    </div>
  );
}
