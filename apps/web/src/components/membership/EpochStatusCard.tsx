"use client";

import { useContentRegistry } from "@/hooks/useContentRegistry";
import { useStreamflow } from "@/hooks/useStreamflow";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

/**
 * EpochStatusCard - Displays subscription pool status
 *
 * Separated into:
 * 1. Epoch & Treasury - distribution timing and pending funds
 *    - Shows escrow balance (released from streams, need to withdraw)
 *    - Shows WSOL ATA balance (withdrawn, need to unwrap)
 * 2. Pools - totals and user allocation info
 */
export function EpochStatusCard() {
  const {
    epochState,
    globalHolderPool,
    creatorDistPool,
    ecosystemTreasuryBalance, // WSOL in treasury's ATA (withdrawn but not unwrapped)
    isLoadingEpochState,
    isLoadingGlobalHolderPool,
    isLoadingCreatorDistPool,
    isLoadingEcosystemTreasuryBalance,
  } = useContentRegistry();

  // Fetch escrow balance (released from streams but not yet withdrawn)
  const { useEcosystemEscrowBalance } = useStreamflow();
  const escrowBalanceQuery = useEcosystemEscrowBalance();
  const escrowBalance = escrowBalanceQuery.data ?? BigInt(0);
  const isLoadingEscrow = escrowBalanceQuery.isLoading;

  // Total pending = escrow + WSOL ATA
  const totalPending = escrowBalance + ecosystemTreasuryBalance;

  const isLoading = isLoadingEpochState || isLoadingGlobalHolderPool ||
                    isLoadingCreatorDistPool || isLoadingEcosystemTreasuryBalance || isLoadingEscrow;

  // Calculate epoch status
  const now = Math.floor(Date.now() / 1000);
  const lastDistribution = epochState ? Number(epochState.lastDistributionAt) : 0;
  const epochDuration = epochState ? Number(epochState.epochDuration) : 24 * 60 * 60; // Default 1 day
  const nextDistribution = lastDistribution + epochDuration;
  const timeRemaining = Math.max(0, nextDistribution - now);
  const epochProgress = epochDuration > 0 ? Math.min(100, ((now - lastDistribution) / epochDuration) * 100) : 0;
  const epochEnded = timeRemaining === 0;

  // Format helpers
  const formatTimeRemaining = (seconds: number): string => {
    if (seconds <= 0) return "Ready";
    const hours = Math.floor(seconds / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatSol = (lamports: bigint): string => {
    const sol = Number(lamports) / LAMPORTS_PER_SOL;
    if (sol === 0) return "0";
    if (sol < 0.001) return sol.toFixed(6);
    if (sol < 1) return sol.toFixed(4);
    return sol.toFixed(2);
  };

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

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="relative rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
          <div className="p-6 animate-pulse">
            <div className="h-6 bg-white/5 rounded-lg w-1/3 mb-4" />
            <div className="h-20 bg-white/5 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  const poolsInitialized = globalHolderPool || creatorDistPool;

  if (!poolsInitialized) {
    return (
      <div className="relative rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden p-6">
        <p className="text-sm text-white/50 text-center">
          Subscription pools not yet initialized
        </p>
      </div>
    );
  }

  // Pool calculations
  const holderPoolTotal = globalHolderPool?.totalDeposited ?? BigInt(0);
  const holderPoolClaimed = globalHolderPool?.totalClaimed ?? BigInt(0);
  const holderPoolUnclaimed = holderPoolTotal - holderPoolClaimed;
  const holderPoolWeight = globalHolderPool?.totalWeight ?? BigInt(0);

  const creatorPoolTotal = creatorDistPool?.totalDeposited ?? BigInt(0);
  const creatorPoolClaimed = creatorDistPool?.totalClaimed ?? BigInt(0);
  const creatorPoolUnclaimed = creatorPoolTotal - creatorPoolClaimed;
  const creatorPoolWeight = creatorDistPool?.totalWeight ?? BigInt(0);

  return (
    <div className="space-y-4">
      {/* ============================================ */}
      {/* SECTION 1: EPOCH & TREASURY */}
      {/* ============================================ */}
      <div className="relative rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none" />

        <div className="relative p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-medium text-white/90">Pending Distribution</h3>
                <p className="text-sm text-white/40">Treasury waiting for epoch end</p>
              </div>
            </div>
            {epochEnded ? (
              <span className="px-3 py-1.5 rounded-full text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">
                Ready to Distribute
              </span>
            ) : (
              <span className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white/60">
                {formatTimeRemaining(timeRemaining)} left
              </span>
            )}
          </div>

          {/* Treasury Balance - Main Display */}
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-amber-400/80">Total Pending</span>
              <span className="text-2xl font-bold text-amber-400">
                {formatSol(totalPending)} SOL
              </span>
            </div>

            {/* Breakdown: Escrow vs WSOL ATA */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="p-2 bg-amber-500/5 rounded-lg">
                <p className="text-[10px] text-amber-400/60 mb-0.5">In Stream Escrows</p>
                <p className="text-sm font-medium text-amber-400/80">{formatSol(escrowBalance)} SOL</p>
                <p className="text-[9px] text-amber-400/40 mt-0.5">Need to withdraw</p>
              </div>
              <div className="p-2 bg-amber-500/5 rounded-lg">
                <p className="text-[10px] text-amber-400/60 mb-0.5">In Treasury WSOL</p>
                <p className="text-sm font-medium text-amber-400/80">{formatSol(ecosystemTreasuryBalance)} SOL</p>
                <p className="text-[9px] text-amber-400/40 mt-0.5">Need to unwrap</p>
              </div>
            </div>

            {totalPending > BigInt(0) && (
              <div className="pt-3 border-t border-amber-500/20 grid grid-cols-3 gap-3 text-xs">
                <div className="text-center">
                  <p className="text-amber-400/60">→ Holders (12%)</p>
                  <p className="text-amber-400 font-medium">{formatSol(totalPending * BigInt(12) / BigInt(100))} SOL</p>
                </div>
                <div className="text-center">
                  <p className="text-amber-400/60">→ Creators (80%)</p>
                  <p className="text-amber-400 font-medium">{formatSol(totalPending * BigInt(80) / BigInt(100))} SOL</p>
                </div>
                <div className="text-center">
                  <p className="text-amber-400/60">→ Platform (8%)</p>
                  <p className="text-amber-400 font-medium">{formatSol(totalPending * BigInt(8) / BigInt(100))} SOL</p>
                </div>
              </div>
            )}
          </div>

          {/* Epoch Progress */}
          <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
            <div className="flex items-center justify-between mb-2 text-xs">
              <span className="text-white/40">Last Distribution</span>
              <span className="text-white/60">{formatTimestamp(lastDistribution)}</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  epochEnded
                    ? "bg-emerald-500/70"
                    : "bg-gradient-to-r from-white/20 to-white/40"
                }`}
                style={{ width: `${Math.min(100, epochProgress)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/40">Next eligible</span>
              <span className="text-white/60">{formatTimestamp(nextDistribution)}</span>
            </div>
          </div>

          {/* How Distribution Works */}
          <p className="text-[11px] text-white/30 mt-3 leading-relaxed">
            Subscription fees stream to escrow → withdraw to treasury → unwrap WSOL → distribute to pools.
            Distribution triggers on mint/claim after epoch ends. Anyone can trigger.
          </p>
        </div>
      </div>

      {/* ============================================ */}
      {/* SECTION 2: HOLDER POOL */}
      {/* ============================================ */}
      <div className="relative rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />

        <div className="relative p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-medium text-white/90">NFT Holder Pool</h3>
                <p className="text-sm text-white/40">12% of subscriptions → NFT holders</p>
              </div>
            </div>
          </div>

          {/* Pool Stats */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-center">
              <p className="text-xs text-white/40 mb-1">Total Distributed</p>
              <p className="text-lg font-medium text-white/80">{formatSol(holderPoolTotal)} SOL</p>
            </div>
            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-center">
              <p className="text-xs text-white/40 mb-1">Claimed</p>
              <p className="text-lg font-medium text-white/50">{formatSol(holderPoolClaimed)} SOL</p>
            </div>
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
              <p className="text-xs text-emerald-400/70 mb-1">Available to Claim</p>
              <p className="text-lg font-medium text-emerald-400">{formatSol(holderPoolUnclaimed)} SOL</p>
            </div>
          </div>

          {/* User Allocation Info */}
          <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
            <p className="text-xs text-white/50 mb-2 font-medium">Your Allocation</p>
            <p className="text-xs text-white/40 leading-relaxed">
              Your share = (Your NFT Weight / Total Weight) × Pool Balance
            </p>
            <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-xs">
              <span className="text-white/30">Total Pool Weight</span>
              <span className="text-white/50 font-mono">{holderPoolWeight.toString()}</span>
            </div>
            <p className="text-[10px] text-white/30 mt-2">
              Claim anytime from the Rewards page. No epoch lock on claiming.
            </p>
          </div>
        </div>
      </div>

      {/* ============================================ */}
      {/* SECTION 3: CREATOR POOL */}
      {/* ============================================ */}
      <div className="relative rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none" />

        <div className="relative p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-medium text-white/90">Creator Pool</h3>
                <p className="text-sm text-white/40">80% of subscriptions → Creators</p>
              </div>
            </div>
          </div>

          {/* Pool Stats */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-center">
              <p className="text-xs text-white/40 mb-1">Total Distributed</p>
              <p className="text-lg font-medium text-white/80">{formatSol(creatorPoolTotal)} SOL</p>
            </div>
            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-center">
              <p className="text-xs text-white/40 mb-1">Claimed</p>
              <p className="text-lg font-medium text-white/50">{formatSol(creatorPoolClaimed)} SOL</p>
            </div>
            <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-center">
              <p className="text-xs text-purple-400/70 mb-1">Available to Claim</p>
              <p className="text-lg font-medium text-purple-400">{formatSol(creatorPoolUnclaimed)} SOL</p>
            </div>
          </div>

          {/* User Allocation Info */}
          <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
            <p className="text-xs text-white/50 mb-2 font-medium">Your Allocation</p>
            <p className="text-xs text-white/40 leading-relaxed">
              Your share = (Your Content Weight / Total Weight) × Pool Balance
            </p>
            <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-xs">
              <span className="text-white/30">Total Pool Weight</span>
              <span className="text-white/50 font-mono">{creatorPoolWeight.toString()}</span>
            </div>
            <p className="text-[10px] text-white/30 mt-2">
              Creators can claim anytime based on their registered content weight.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
