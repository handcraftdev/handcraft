"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useMembership, formatSol, getDaysRemaining, formatMemberSince, calculateYearlyPrice, getStreamBillingPeriod, BillingPeriod } from "@/hooks/useMembership";

interface EcosystemMembershipCardProps {
  compact?: boolean;
}

export function EcosystemMembershipCard({ compact = false }: EcosystemMembershipCardProps) {
  const { publicKey } = useWallet();
  const {
    ecosystemConfigQuery,
    ecosystemMembershipQuery,
    useStreamInfo,
    joinEcosystemMembership,
    cancelEcosystemMembership,
    renewEcosystemMembership,
    isJoiningEcosystemMembership,
    isCancellingEcosystemMembership,
  } = useMembership();

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0); // Force re-render for live updates

  // Update stream progress every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const { data: config, isLoading: isLoadingConfig } = ecosystemConfigQuery;
  const { data: membership, isLoading: isLoadingMembership } = ecosystemMembershipQuery;
  const { data: streamInfo } = useStreamInfo(membership?.streamId?.toBase58() ?? null);

  // Config not active or not set up
  if (!isLoadingConfig && (!config || !config.isActive)) {
    return null;
  }

  // Loading state
  if (isLoadingConfig || isLoadingMembership) {
    return (
      <div className="rounded-xl bg-white/[0.02] border border-white/5 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-white/5 rounded w-1/3 mb-4"></div>
          <div className="h-10 bg-white/5 rounded"></div>
        </div>
      </div>
    );
  }

  const handleJoin = async (period: BillingPeriod) => {
    if (!config) return;
    setError(null);
    try {
      // Stream goes to EcosystemStreamingTreasury PDA (not authority)
      await joinEcosystemMembership.mutateAsync({
        price: config.price,
        period,
      });
    } catch (err: any) {
      console.error("Join error:", err);
      setError(err.message || "Failed to join");
    }
  };

  const handleCancel = async () => {
    if (!membership?.streamId) return;
    try {
      await cancelEcosystemMembership.mutateAsync({ streamId: membership.streamId.toBase58() });
      setShowCancelConfirm(false);
    } catch (error) {
      console.error("Cancel error:", error);
    }
  };

  const handleRenew = async (period: BillingPeriod) => {
    if (!config || !membership?.streamId) return;
    setError(null);
    try {
      await renewEcosystemMembership.mutateAsync({
        price: config.price,
        streamId: membership.streamId.toBase58(),
        period,
      });
    } catch (err: any) {
      console.error("Renew error:", err);
      setError(err.message || "Failed to renew");
    }
  };

  const isMember = membership?.isValid;
  const daysRemaining = streamInfo ? getDaysRemaining(streamInfo.endTime) : 0;

  // Detect original billing period from stream name (reliable even after topups)
  const originalBillingPeriod: BillingPeriod = streamInfo?.name
    ? getStreamBillingPeriod(streamInfo.name)
    : "monthly";

  // Calculate stream progress and balance
  const getStreamProgress = () => {
    if (!streamInfo) return null;

    const now = Math.floor(Date.now() / 1000);
    const totalDuration = streamInfo.endTime - streamInfo.startTime;
    const elapsed = Math.max(0, Math.min(now - streamInfo.startTime, totalDuration));
    const progressPercent = totalDuration > 0 ? (elapsed / totalDuration) * 100 : 0;

    const depositedLamports = streamInfo.depositedAmount.toNumber();
    const streamedLamports = Math.floor((elapsed / totalDuration) * depositedLamports);
    const remainingLamports = depositedLamports - streamedLamports;

    return {
      progressPercent: Math.min(100, progressPercent),
      streamedSol: streamedLamports / 1e9,
      remainingSol: remainingLamports / 1e9,
      totalSol: depositedLamports / 1e9,
      daysTotal: Math.round(totalDuration / 86400),
      daysElapsed: Math.floor(elapsed / 86400),
    };
  };

  const streamProgress = getStreamProgress();
  const yearlyPrice = config ? calculateYearlyPrice(config.price) : BigInt(0);

  // Compact mode - just a status indicator
  if (compact) {
    if (isMember) {
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-sm">
          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span className="text-emerald-400 font-medium">Platform Member</span>
          <span className="text-white/40">({daysRemaining}d)</span>
        </div>
      );
    }

    return (
      <button
        onClick={() => handleJoin("monthly")}
        disabled={isJoiningEcosystemMembership || !publicKey}
        className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/40 rounded-full text-sm transition-colors disabled:opacity-50"
      >
        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
        <span className="text-blue-400">Join Platform</span>
        {config && <span className="text-white/40">({formatSol(config.price)} SOL/mo)</span>}
      </button>
    );
  }

  // Full card mode
  return (
    <div className="relative rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none" />

      <div className="relative p-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Platform Membership</h2>
            <p className="text-sm text-white/40">Access all "Subscribers" tier content</p>
          </div>
        </div>
      </div>

      <div className="relative p-5">
        {isMember ? (
          <div className="space-y-4">
            {/* Status Header */}
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-medium text-emerald-400">Active Member</span>
                </div>
                <span className="text-sm text-white/40">{daysRemaining} days remaining</span>
              </div>
              {streamInfo && (
                <p className="text-xs text-white/30 mt-2">
                  Member since {formatMemberSince(streamInfo.startTime)}
                </p>
              )}
            </div>

            {/* Stream Progress */}
            {streamProgress && (
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/40">Stream Progress</span>
                  <span className="text-white/70">
                    {streamProgress.daysElapsed} / {streamProgress.daysTotal} days
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500"
                    style={{ width: `${streamProgress.progressPercent}%` }}
                  />
                </div>

                {/* Balance Info */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-wider text-white/30">Streamed</p>
                    <p className="text-sm font-medium text-amber-400">
                      {streamProgress.progressPercent.toFixed(2)}%
                    </p>
                    <p className="text-[10px] text-white/20">
                      {streamProgress.streamedSol.toFixed(6)} SOL
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-wider text-white/30">Remaining</p>
                    <p className="text-sm font-medium text-emerald-400">
                      {(100 - streamProgress.progressPercent).toFixed(2)}%
                    </p>
                    <p className="text-[10px] text-white/20">
                      {streamProgress.remainingSol.toFixed(6)} SOL
                    </p>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Action Buttons - Only show matching billing period */}
            <div className="flex gap-3">
              <button
                onClick={() => handleRenew(originalBillingPeriod)}
                disabled={isJoiningEcosystemMembership}
                className="flex-1 py-3 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 hover:border-blue-500/50 disabled:opacity-50 rounded-xl font-medium transition-all flex items-center justify-center gap-2"
              >
                {isJoiningEcosystemMembership ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Extending...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    {originalBillingPeriod === "yearly" ? (
                      <>
                        <span>1 Year ({formatSol(yearlyPrice)} SOL)</span>
                        <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded">Save 2 months</span>
                      </>
                    ) : (
                      <span>1 Month ({formatSol(config!.price)} SOL)</span>
                    )}
                  </>
                )}
              </button>
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-sm text-white/40 hover:text-white/60 transition-all border border-white/5 hover:border-white/10"
              >
                Cancel
              </button>
            </div>

            {/* Info about billing period */}
            <p className="text-xs text-white/30 text-center">
              {originalBillingPeriod === "yearly"
                ? "You have a yearly membership. To switch to monthly, cancel and rejoin."
                : "You have a monthly membership. To switch to yearly, cancel and rejoin."}
            </p>

            {/* Low Balance Warning */}
            {daysRemaining <= 7 && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-sm text-amber-400">
                  Your membership expires soon! Extend now to keep access.
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-white/40 text-sm">
              Become a member to access all "Subscribers" tier content from every creator.
            </p>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Join Options */}
            <div className="space-y-3">
              {/* Yearly (Best Value) */}
              <button
                onClick={() => handleJoin("yearly")}
                disabled={isJoiningEcosystemMembership || !publicKey}
                className="group w-full p-4 bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 hover:border-blue-500/40 rounded-xl text-left transition-all disabled:opacity-50"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Yearly</span>
                    <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded">Best Value</span>
                  </div>
                  <span className="text-blue-400 font-bold">{formatSol(yearlyPrice)} SOL</span>
                </div>
                <p className="text-xs text-white/40">Pay for 10 months, get 12 months access</p>
              </button>

              {/* Monthly */}
              <button
                onClick={() => handleJoin("monthly")}
                disabled={isJoiningEcosystemMembership || !publicKey}
                className="group w-full p-4 bg-white/[0.02] border border-white/5 hover:border-white/10 rounded-xl text-left transition-all disabled:opacity-50"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Monthly</span>
                  <span className="text-white font-bold">{formatSol(config!.price)} SOL</span>
                </div>
                <p className="text-xs text-white/40">Billed every 30 days</p>
              </button>
            </div>

            {!publicKey && (
              <p className="text-xs text-white/30 text-center">Connect wallet to join</p>
            )}

            {isJoiningEcosystemMembership && (
              <div className="flex items-center justify-center gap-2 text-white/40">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Processing...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-black border border-white/10 rounded-2xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-bold mb-2 tracking-tight">Cancel Platform Membership?</h3>
            <p className="text-sm text-white/40 mb-4">
              You'll lose access to all "Subscribers" tier content across the platform. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium transition-all"
              >
                Keep Membership
              </button>
              <button
                onClick={handleCancel}
                disabled={isCancellingEcosystemMembership}
                className="flex-1 px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 disabled:opacity-50 rounded-xl text-sm font-medium transition-all"
              >
                {isCancellingEcosystemMembership ? "Cancelling..." : "Yes, Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
