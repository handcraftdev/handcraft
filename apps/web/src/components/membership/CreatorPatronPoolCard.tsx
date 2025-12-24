"use client";

import { useState, useMemo, useEffect } from "react";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useQuery } from "@tanstack/react-query";
import { useContentRegistry } from "@/hooks/useContentRegistry";
import { useStreamflow } from "@/hooks/useStreamflow";
import { getCreatorPatronTreasuryPda } from "@handcraft/sdk";

const EPOCHS_PER_PAGE = 5;

interface CreatorPatronPoolCardProps {
  creator: PublicKey;
}

/**
 * CreatorPatronPoolCard - Displays patron pool epoch status for a specific creator
 * Shows epoch progress, pool balances, and distribution info for creator memberships
 */
export function CreatorPatronPoolCard({ creator }: CreatorPatronPoolCardProps) {
  const [isPastEpochsExpanded, setIsPastEpochsExpanded] = useState(false);
  const [pastEpochsPage, setPastEpochsPage] = useState(0);
  const [mounted, setMounted] = useState(false);

  const { client } = useContentRegistry();
  const { streamflowClient } = useStreamflow();

  // Prevent hydration mismatch by deferring time-dependent calculations to client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch creator patron config
  const { data: patronConfig, isLoading: isLoadingConfig } = useQuery({
    queryKey: ["creatorPatronConfig", creator.toBase58()],
    queryFn: () => client?.fetchCreatorPatronConfig(creator) ?? null,
    enabled: !!client,
    staleTime: 60000,
  });

  // Fetch creator patron pool
  const { data: patronPool, isLoading: isLoadingPool } = useQuery({
    queryKey: ["creatorPatronPool", creator.toBase58()],
    queryFn: () => client?.fetchCreatorPatronPool(creator) ?? null,
    enabled: !!client && !!patronConfig?.isActive,
    staleTime: 60000,
  });

  // Fetch creator patron treasury WSOL ATA balance (withdrawn from escrow, ready to unwrap)
  const { data: treasuryBalance = BigInt(0), isLoading: isLoadingTreasury } = useQuery({
    queryKey: ["creatorPatronTreasuryBalance", creator.toBase58()],
    queryFn: () => client?.fetchCreatorPatronTreasuryBalance(creator) ?? BigInt(0),
    enabled: !!client && !!patronConfig?.isActive,
    staleTime: 30000,
  });

  // Fetch escrow balance (still in Streamflow, not yet withdrawn)
  const { data: escrowBalance = BigInt(0), isLoading: isLoadingEscrow } = useQuery({
    queryKey: ["creatorPatronEscrowBalance", creator.toBase58()],
    queryFn: async () => {
      if (!streamflowClient) return BigInt(0);
      const [treasuryPda] = getCreatorPatronTreasuryPda(creator);
      return streamflowClient.getTotalAvailableForRecipient(treasuryPda);
    },
    enabled: !!streamflowClient && !!patronConfig?.isActive,
    staleTime: 30000,
  });

  const isLoading = !mounted || isLoadingConfig || isLoadingPool || isLoadingTreasury || isLoadingEscrow;

  // Calculate epoch-related values (must be before early returns to respect hooks rules)
  const now = mounted ? Math.floor(Date.now() / 1000) : 0;
  const lastDistribution = patronPool ? Number(patronPool.lastDistributionAt) : 0;
  const epochDuration = patronPool ? Number(patronPool.epochDuration) : 0;
  const poolCreatedAt = patronPool ? Number(patronPool.createdAt) : 0;
  const isTestMode = epochDuration < 3600;
  const completedEpochs = !isTestMode && poolCreatedAt > 0 && epochDuration > 0
    ? Math.floor((lastDistribution - poolCreatedAt) / epochDuration)
    : 0;

  // Generate past epoch details - must be called before early returns
  const pastEpochDetails = useMemo(() => {
    if (completedEpochs <= 0 || poolCreatedAt <= 0 || epochDuration <= 0) return [];

    const epochs: Array<{
      epochNumber: number;
      startTime: number;
      endTime: number;
      status: "completed";
    }> = [];

    for (let i = completedEpochs; i >= 1; i--) {
      const epochStartTime = poolCreatedAt + (i - 1) * epochDuration;
      const epochEndTime = poolCreatedAt + i * epochDuration;
      epochs.push({
        epochNumber: i,
        startTime: epochStartTime,
        endTime: epochEndTime,
        status: "completed",
      });
    }

    return epochs;
  }, [completedEpochs, poolCreatedAt, epochDuration]);

  // Format SOL amount
  const formatSol = (lamports: bigint): string => {
    const sol = Number(lamports) / LAMPORTS_PER_SOL;
    if (sol < 0.001) return sol.toFixed(6);
    if (sol < 1) return sol.toFixed(4);
    return sol.toFixed(2);
  };

  // Format timestamp
  const formatTimestamp = (timestamp: number): string => {
    if (timestamp === 0) return "Never";
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Format date only (shorter)
  const formatDate = (timestamp: number): string => {
    if (timestamp === 0) return "N/A";
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Format epoch duration
  const formatDuration = (seconds: number): string => {
    const days = Math.floor(seconds / (24 * 60 * 60));
    if (days > 0) return `${days} day${days > 1 ? "s" : ""}`;
    const hours = Math.floor(seconds / (60 * 60));
    return `${hours} hour${hours > 1 ? "s" : ""}`;
  };

  // Format time remaining
  const formatTimeRemaining = (seconds: number): string => {
    if (seconds <= 0) return "Ready to distribute";
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  // Don't render if config doesn't exist or isn't active
  if (!isLoading && (!patronConfig || !patronConfig.isActive)) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="relative rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none" />
        <div className="relative p-6 animate-pulse">
          <div className="h-6 bg-white/5 rounded-lg w-1/3 mb-4" />
          <div className="h-4 bg-white/5 rounded-lg w-2/3 mb-6" />
          <div className="h-20 bg-white/5 rounded-xl" />
        </div>
      </div>
    );
  }

  // Don't show if pool doesn't exist (shouldn't happen if config is active)
  if (!patronPool) {
    return null;
  }

  // Calculate derived epoch values (base values already computed before early returns)
  const nextDistribution = lastDistribution + epochDuration;
  const timeRemaining = Math.max(0, nextDistribution - now);
  const epochProgress = epochDuration > 0 ? Math.min(100, ((now - lastDistribution) / epochDuration) * 100) : 0;

  // Pagination for past epochs
  const totalPastEpochPages = Math.ceil(pastEpochDetails.length / EPOCHS_PER_PAGE);
  const paginatedPastEpochs = pastEpochDetails.slice(
    pastEpochsPage * EPOCHS_PER_PAGE,
    (pastEpochsPage + 1) * EPOCHS_PER_PAGE
  );

  const poolBalance = patronPool.totalDeposited;
  const poolClaimed = patronPool.totalClaimed;
  const poolUnclaimed = poolBalance - poolClaimed;
  const poolWeight = patronPool.totalWeight;

  // Calculate estimated distribution per epoch (rough average)
  const avgPerEpoch = completedEpochs > 0 ? poolBalance / BigInt(completedEpochs) : BigInt(0);

  return (
    <div className="relative rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none" />

      {/* Header */}
      <div className="relative p-5 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-medium text-white/90">Membership Pool</h3>
              <p className="text-sm text-white/40">Holder rewards from memberships</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isTestMode && (
              <span className="px-2 py-0.5 rounded-full text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Test Mode
              </span>
            )}
            {timeRemaining === 0 && (
              <span className="px-3 py-1 rounded-full text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Ready
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative p-5 space-y-5">
        {/* Epoch Progress */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase tracking-[0.2em] text-white/30">Current Epoch Progress</span>
            <span className="text-sm text-white/70">{formatTimeRemaining(timeRemaining)}</span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500/50 to-purple-400/70 rounded-full transition-all duration-500"
              style={{ width: `${epochProgress}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-white/30">
            <span>Last: {formatTimestamp(lastDistribution)}</span>
            <span>Next: {formatTimestamp(nextDistribution)}</span>
          </div>
        </div>

        {/* Past Epochs - Collapsible */}
        {completedEpochs > 0 && (
          <div className="rounded-xl border border-white/5 overflow-hidden">
            {/* Collapsible Header */}
            <button
              onClick={() => setIsPastEpochsExpanded(!isPastEpochsExpanded)}
              className="w-full flex items-center justify-between p-4 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-left">
                  <span className="text-sm font-medium text-white/70">Past Epochs</span>
                  <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] bg-white/10 text-white/50">
                    {completedEpochs} completed
                  </span>
                </div>
              </div>
              <svg
                className={`w-5 h-5 text-white/30 transition-transform duration-300 ${isPastEpochsExpanded ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Collapsible Content */}
            {isPastEpochsExpanded && (
              <div className="border-t border-white/5">
                {/* Summary Stats */}
                <div className="p-4 bg-white/[0.01] border-b border-white/5">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-white/30 mb-1">Started</p>
                      <p className="text-sm text-white/60">{formatDate(poolCreatedAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-white/30 mb-1">Epoch Duration</p>
                      <p className="text-sm text-white/60">{formatDuration(epochDuration)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-white/30 mb-1">Avg/Epoch</p>
                      <p className="text-sm text-emerald-400/80">~{formatSol(avgPerEpoch)} SOL</p>
                    </div>
                  </div>
                </div>

                {/* Epoch List */}
                <div className="divide-y divide-white/5">
                  {paginatedPastEpochs.map((epoch) => (
                    <div
                      key={epoch.epochNumber}
                      className="p-4 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 rounded-lg bg-purple-500/10 text-purple-400 text-xs font-bold">
                            #{epoch.epochNumber}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/20">
                            Completed
                          </span>
                        </div>
                        <span className="text-xs text-white/30">
                          {formatDuration(epochDuration)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-4">
                          <div>
                            <span className="text-white/30">Start: </span>
                            <span className="text-white/50">{formatDate(epoch.startTime)}</span>
                          </div>
                          <svg className="w-3 h-3 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <div>
                            <span className="text-white/30">End: </span>
                            <span className="text-white/50">{formatDate(epoch.endTime)}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-white/30">Est. distributed: </span>
                          <span className="text-emerald-400/70">~{formatSol(avgPerEpoch)} SOL</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPastEpochPages > 1 && (
                  <div className="p-3 bg-white/[0.01] border-t border-white/5 flex items-center justify-between">
                    <button
                      onClick={() => setPastEpochsPage(Math.max(0, pastEpochsPage - 1))}
                      disabled={pastEpochsPage === 0}
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-xs text-white/60 transition-colors flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Previous
                    </button>
                    <span className="text-xs text-white/40">
                      Page {pastEpochsPage + 1} of {totalPastEpochPages}
                    </span>
                    <button
                      onClick={() => setPastEpochsPage(Math.min(totalPastEpochPages - 1, pastEpochsPage + 1))}
                      disabled={pastEpochsPage >= totalPastEpochPages - 1}
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-xs text-white/60 transition-colors flex items-center gap-1"
                    >
                      Next
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* Note about estimates */}
                <div className="p-3 bg-amber-500/5 border-t border-amber-500/10">
                  <p className="text-[10px] text-amber-400/60 text-center">
                    Distribution amounts are estimates based on total pool averages.
                    Actual per-epoch amounts are not tracked on-chain.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Summary Cards - Available vs Pending */}
        <div className="grid grid-cols-3 gap-3">
          {/* Available to Claim - From Holder Pool */}
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <p className="text-[10px] text-emerald-400/70 uppercase tracking-wider mb-1">Available</p>
            <p className="text-xl font-bold text-emerald-400">{formatSol(poolUnclaimed)} SOL</p>
            <p className="text-[9px] text-white/30 mt-1">Holder pool</p>
          </div>
          {/* In Treasury - Withdrawn from Streamflow, ready for unwrap */}
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <p className="text-[10px] text-amber-400/70 uppercase tracking-wider mb-1">Treasury</p>
            <p className="text-xl font-bold text-amber-400">{formatSol(treasuryBalance)} SOL</p>
            <p className="text-[9px] text-white/30 mt-1">Ready to unwrap</p>
          </div>
          {/* In Escrow - Still in Streamflow */}
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <p className="text-[10px] text-blue-400/70 uppercase tracking-wider mb-1">Escrow</p>
            <p className="text-xl font-bold text-blue-400">{formatSol(escrowBalance)} SOL</p>
            <p className="text-[9px] text-white/30 mt-1">In Streamflow</p>
          </div>
        </div>

        {/* Pool Stats - Detailed breakdown */}
        <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-3 h-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <span className="text-[11px] uppercase tracking-[0.2em] text-white/30">Pool Details</span>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-white/40">Total Distributed</span>
              <span className="text-white/70">{formatSol(poolBalance)} SOL</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/40">Claimed</span>
              <span className="text-white/50">{formatSol(poolClaimed)} SOL</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/40">Total NFT Weight</span>
              <span className="text-white/50">{poolWeight.toString()}</span>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
          <p className="text-xs text-white/40 leading-relaxed">
            When members subscribe to this creator,
            <span className="text-emerald-400/80"> 12% goes to NFT holders</span> (by rarity weight),
            and <span className="text-purple-400/80">80% to the creator</span>.
          </p>
        </div>

        {/* Debug Info - shown when test mode or for troubleshooting */}
        {(isTestMode || process.env.NODE_ENV === "development") && (
          <details className="group">
            <summary className="cursor-pointer text-[10px] text-white/20 hover:text-white/40 transition-colors">
              Debug Info
            </summary>
            <div className="mt-2 p-3 bg-black/20 border border-white/5 rounded-lg text-[10px] font-mono text-white/30 space-y-1">
              <div>Epoch Duration: {epochDuration}s ({formatDuration(epochDuration)})</div>
              <div>Pool Created: {poolCreatedAt} ({formatTimestamp(poolCreatedAt)})</div>
              <div>Last Distribution: {lastDistribution} ({formatTimestamp(lastDistribution)})</div>
              <div>Time Since Pool Created: {lastDistribution - poolCreatedAt}s</div>
              <div>Raw Completed Epochs: {poolCreatedAt > 0 && epochDuration > 0 ? Math.floor((lastDistribution - poolCreatedAt) / epochDuration) : 0}</div>
              <div>Is Test Mode: {isTestMode ? "Yes (epoch &lt; 1 hour)" : "No"}</div>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
