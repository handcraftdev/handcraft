"use client";

import { useState, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useMembership, formatSol, getDaysRemaining, calculateYearlyPrice, formatMemberSince, getStreamBillingPeriod, BillingPeriod } from "@/hooks/useMembership";

interface CreatorMembershipBannerProps {
  creator: PublicKey;
}

export function CreatorMembershipBanner({ creator }: CreatorMembershipBannerProps) {
  const { publicKey } = useWallet();
  const {
    useMembershipConfig,
    useCreatorMembership,
    useStreamInfo,
    joinMembership,
    cancelMembership,
    renewMembership,
    isJoiningMembership,
    isCancellingMembership,
  } = useMembership();

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  // Update stream progress every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const { data: membershipConfig, isLoading: isLoadingConfig } = useMembershipConfig(creator);
  const { data: membership, isLoading: isLoadingMembership } = useCreatorMembership(creator);
  const { data: streamInfo } = useStreamInfo(membership?.streamId?.toBase58() ?? null);

  // Don't show for own profile
  if (publicKey?.equals(creator)) {
    return null;
  }

  // Creator hasn't set up memberships or not active
  if (!isLoadingConfig && (!membershipConfig || !membershipConfig.isActive)) {
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
    if (!membershipConfig) return;
    setError(null);
    try {
      await joinMembership.mutateAsync({
        creator,
        period,
        monthlyPrice: membershipConfig.monthlyPrice,
      });
    } catch (err: any) {
      console.error("Join error:", err);
      setError(err.message || "Failed to join membership");
    }
  };

  const handleCancel = async () => {
    if (!membership?.streamId) return;
    try {
      await cancelMembership.mutateAsync({ creator, streamId: membership.streamId.toBase58() });
      setShowCancelConfirm(false);
    } catch (error) {
      console.error("Cancel error:", error);
    }
  };

  const handleRenew = async (period: BillingPeriod) => {
    if (!membershipConfig || !membership?.streamId) return;
    setError(null);
    try {
      await renewMembership.mutateAsync({
        creator,
        period,
        monthlyPrice: membershipConfig.monthlyPrice,
        streamId: membership.streamId.toBase58(),
      });
    } catch (err: any) {
      console.error("Renew error:", err);
      setError(err.message || "Failed to extend membership");
    }
  };

  const yearlyPrice = membershipConfig ? calculateYearlyPrice(membershipConfig.monthlyPrice) : BigInt(0);

  // Calculate stream progress
  const getStreamProgress = () => {
    if (!streamInfo) return null;
    const now = Math.floor(Date.now() / 1000);
    const depositedLamports = streamInfo.depositedAmount.toNumber();

    // Calculate actual streamed amount based on time elapsed (not withdrawnAmount)
    // withdrawnAmount only reflects what recipient has claimed, not what's been released
    const elapsedSinceStart = Math.max(0, now - streamInfo.startTime);
    const totalDuration = streamInfo.endTime - streamInfo.startTime;

    // Linear release: streamed = deposited * (elapsed / total)
    const streamedLamports = totalDuration > 0
      ? Math.min(depositedLamports, Math.floor(depositedLamports * elapsedSinceStart / totalDuration))
      : 0;

    const progressPercent = depositedLamports > 0 ? (streamedLamports / depositedLamports) * 100 : 0;
    const remainingLamports = depositedLamports - streamedLamports;
    const daysRemaining = Math.round(Math.max(0, streamInfo.endTime - now) / 86400);

    return {
      progressPercent: Math.min(100, progressPercent),
      streamedSol: streamedLamports / 1e9,
      remainingSol: remainingLamports / 1e9,
      daysRemaining,
    };
  };

  const streamProgress = getStreamProgress();
  const isMember = membership?.isValid && streamInfo;
  const daysRemaining = streamInfo ? getDaysRemaining(streamInfo.endTime) : 0;

  // Detect original billing period from stream name (reliable even after topups)
  const originalBillingPeriod: BillingPeriod = streamInfo?.name
    ? getStreamBillingPeriod(streamInfo.name)
    : "monthly";

  return (
    <div className="relative rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none" />

      <div className="relative p-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center border border-purple-500/20">
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Creator Membership</h2>
            <p className="text-sm text-white/40">Support this creator with a membership</p>
          </div>
        </div>
      </div>

      <div className="relative p-5">
        {isMember ? (
          <div className="space-y-4">
            {/* Status Header - Inline */}
            <div className="flex items-center justify-between bg-purple-500/10 border border-purple-500/20 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium text-purple-400">Active Member</span>
              </div>
              {streamInfo && (
                <span className="text-xs text-white/30">
                  Since {formatMemberSince(streamInfo.startTime)}
                </span>
              )}
            </div>

            {/* Stream Progress */}
            {streamProgress && (
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/40">Stream Progress</span>
                  <span className="text-white/70">
                    {streamProgress.daysRemaining} days remaining
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="absolute left-0 top-0 h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full transition-all duration-500"
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

            {/* Action Buttons - Only show matching billing period */}
            <div className="flex gap-3">
              <button
                onClick={() => handleRenew(originalBillingPeriod)}
                disabled={isJoiningMembership}
                className="flex-1 py-3 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 hover:border-purple-500/50 disabled:opacity-50 rounded-xl font-medium transition-all flex items-center justify-center gap-2"
              >
                {isJoiningMembership ? (
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
                      <span>1 Month ({formatSol(membershipConfig!.monthlyPrice)} SOL)</span>
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
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-white/40 text-sm">
              Become a member to support this creator and access exclusive content.
            </p>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Join Options */}
            <div className="space-y-3">
              {/* Yearly Membership (Best Value) */}
              <button
                onClick={() => handleJoin("yearly")}
                disabled={isJoiningMembership || !publicKey}
                className="group w-full p-4 bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 hover:border-purple-500/40 rounded-xl text-left transition-all disabled:opacity-50"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Yearly Membership</span>
                    <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded">Best Value</span>
                  </div>
                  <span className="text-purple-400 font-bold">{formatSol(yearlyPrice)} SOL</span>
                </div>
                <p className="text-xs text-white/40">Pay for 10 months, get 12 months access</p>
              </button>

              {/* Monthly Membership */}
              <button
                onClick={() => handleJoin("monthly")}
                disabled={isJoiningMembership || !publicKey}
                className="group w-full p-4 bg-white/[0.02] border border-white/5 hover:border-white/10 rounded-xl text-left transition-all disabled:opacity-50"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Monthly Membership</span>
                  <span className="text-white font-bold">{formatSol(membershipConfig!.monthlyPrice)} SOL</span>
                </div>
                <p className="text-xs text-white/40">Billed every 30 days</p>
              </button>
            </div>

            {!publicKey && (
              <p className="text-xs text-white/30 text-center">Connect wallet to join</p>
            )}

            {isJoiningMembership && (
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
            <h3 className="text-lg font-bold mb-2 tracking-tight">Cancel Membership?</h3>
            <p className="text-sm text-white/40 mb-4">
              You'll lose access to member-only content. Remaining funds will be returned to your wallet.
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
                disabled={isCancellingMembership}
                className="flex-1 px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 disabled:opacity-50 rounded-xl text-sm font-medium transition-all"
              >
                {isCancellingMembership ? "Cancelling..." : "Yes, Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
