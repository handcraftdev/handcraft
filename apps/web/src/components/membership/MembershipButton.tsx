"use client";

import { useState, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useMembership, formatSol, getDaysRemaining, calculateYearlyPrice, formatMemberSince, BillingPeriod } from "@/hooks/useMembership";

interface MembershipButtonProps {
  creator: PublicKey;
  className?: string;
}

export function MembershipButton({ creator, className = "" }: MembershipButtonProps) {
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

  const [showDropdown, setShowDropdown] = useState(false);
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

  const { data: membershipConfig, isLoading: isLoadingConfig } = useMembershipConfig(creator);
  const { data: membership, isLoading: isLoadingMembership } = useCreatorMembership(creator);
  const { data: streamInfo } = useStreamInfo(membership?.streamId?.toBase58() ?? null);

  // Don't show for own profile
  if (publicKey?.equals(creator)) {
    return null;
  }

  // Creator hasn't set up memberships
  if (!isLoadingConfig && !membershipConfig) {
    return null;
  }

  // Config not active
  if (membershipConfig && !membershipConfig.isActive) {
    return null;
  }

  // Loading state
  if (isLoadingConfig || isLoadingMembership) {
    return (
      <button
        disabled
        className={`px-4 py-2 bg-gray-700 rounded-lg text-sm font-medium ${className}`}
      >
        <span className="animate-pulse">Loading...</span>
      </button>
    );
  }

  const handleJoin = async (period: BillingPeriod) => {
    if (!membershipConfig) return;

    setError(null);

    try {
      // joinMembership handles both Streamflow payment stream and on-chain record
      await joinMembership.mutateAsync({
        creator,
        period,
        monthlyPrice: membershipConfig.monthlyPrice,
      });

      setShowDropdown(false);
    } catch (err: any) {
      console.error("Join error:", err);
      setError(err.message || "Failed to join membership");
    }
  };

  const handleCancel = async () => {
    if (!membership?.streamId) return;
    try {
      // Cancel Streamflow stream - remaining funds returned to user
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
      setShowDropdown(false);
    } catch (err: any) {
      console.error("Renew error:", err);
      setError(err.message || "Failed to renew membership");
    }
  };

  const yearlyPrice = membershipConfig ? calculateYearlyPrice(membershipConfig.monthlyPrice) : BigInt(0);

  // Calculate stream progress and balance
  const getStreamProgress = () => {
    if (!streamInfo) return null;

    const now = Math.floor(Date.now() / 1000);
    const depositedLamports = Number(streamInfo.depositedAmount);

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
      totalSol: depositedLamports / 1e9,
      daysRemaining,
    };
  };

  const streamProgress = getStreamProgress();

  // Already a member
  if (membership?.isValid && streamInfo) {
    const daysRemaining = getDaysRemaining(streamInfo.endTime);

    return (
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className={`px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${className}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Member
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showDropdown && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowDropdown(false)}
            />
            <div className="absolute right-0 mt-2 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
              {/* Status Header - Inline */}
              <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-medium">Active Member</span>
                </div>
                {streamInfo && (
                  <span className="text-xs text-gray-500">
                    Since {formatMemberSince(streamInfo.startTime)}
                  </span>
                )}
              </div>

              {/* Stream Progress */}
              {streamProgress && (
                <div className="p-4 border-b border-gray-800 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">Stream Progress</span>
                    <span className="text-gray-300">
                      {streamProgress.daysRemaining} days remaining
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="relative h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="absolute left-0 top-0 h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full transition-all duration-500"
                      style={{ width: `${streamProgress.progressPercent}%` }}
                    />
                  </div>

                  {/* Balance Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <p className="text-[10px] text-gray-500">Streamed</p>
                      <p className="text-xs font-medium text-orange-400">
                        {streamProgress.progressPercent.toFixed(2)}%
                      </p>
                      <p className="text-[9px] text-gray-600">
                        {streamProgress.streamedSol.toFixed(6)} SOL
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-gray-500">Remaining</p>
                      <p className="text-xs font-medium text-green-400">
                        {(100 - streamProgress.progressPercent).toFixed(2)}%
                      </p>
                      <p className="text-[9px] text-gray-600">
                        {streamProgress.remainingSol.toFixed(6)} SOL
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Low Balance Warning */}
              {daysRemaining <= 7 && (
                <div className="px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20 flex items-center gap-2">
                  <svg className="w-4 h-4 text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-xs text-yellow-400">Expires soon!</span>
                </div>
              )}

              {/* Extend Options */}
              <div className="p-2">
                <p className="px-2 py-1 text-xs text-gray-500 font-medium">Extend Membership</p>
                <button
                  onClick={() => handleRenew("monthly")}
                  disabled={isJoiningMembership}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-800 rounded-lg transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span>+1 Month</span>
                  </div>
                  <span className="text-purple-400 font-medium">{formatSol(membershipConfig!.monthlyPrice)} SOL</span>
                </button>

                <button
                  onClick={() => handleRenew("yearly")}
                  disabled={isJoiningMembership}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-800 rounded-lg transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span>1 Year</span>
                    <span className="px-1 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded">Save 2mo</span>
                  </div>
                  <span className="text-purple-400 font-medium">{formatSol(yearlyPrice)} SOL</span>
                </button>
              </div>

              {/* Cancel Option */}
              <div className="p-2 border-t border-gray-800">
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    setShowCancelConfirm(true);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-red-500/10 text-red-400 rounded-lg transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>Cancel Membership</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* Cancel Confirmation Modal */}
        {showCancelConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm mx-4">
              <h3 className="text-lg font-bold mb-2">Cancel Membership?</h3>
              <p className="text-sm text-gray-400 mb-4">
                You'll lose access to member-only content immediately. This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
                >
                  Keep Membership
                </button>
                <button
                  onClick={handleCancel}
                  disabled={isCancellingMembership}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
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

  // Not a member - show join options
  return (
    <div className="relative">
      <button
        onClick={() => {
          setShowDropdown(!showDropdown);
          setError(null);
        }}
        disabled={!publicKey}
        className={`px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${className}`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
        Join
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showDropdown && publicKey && membershipConfig && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute right-0 mt-2 w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="p-4 border-b border-gray-800">
              <h3 className="font-medium mb-1">Become a Member</h3>
              <p className="text-sm text-gray-400">Choose your billing period</p>
            </div>

            <div className="p-3 space-y-2">
              {/* Yearly Membership (Best Value) */}
              <button
                onClick={() => handleJoin("yearly")}
                disabled={isJoiningMembership}
                className="w-full p-4 bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 hover:border-purple-500/50 rounded-xl text-left transition-all disabled:opacity-50"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Yearly Membership</span>
                    <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">Best Value</span>
                  </div>
                  <span className="text-purple-400 font-bold">{formatSol(yearlyPrice)} SOL</span>
                </div>
                <p className="text-xs text-gray-400">Pay for 10 months, get 12 months access</p>
              </button>

              {/* Monthly Membership */}
              <button
                onClick={() => handleJoin("monthly")}
                disabled={isJoiningMembership}
                className="w-full p-4 bg-gray-800 border border-gray-700 hover:border-gray-600 rounded-xl text-left transition-all disabled:opacity-50"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Monthly Membership</span>
                  <span className="text-white font-bold">{formatSol(membershipConfig.monthlyPrice)} SOL</span>
                </div>
                <p className="text-xs text-gray-400">Billed every 30 days</p>
              </button>
            </div>

            {error && (
              <div className="p-3 border-t border-gray-800">
                <p className="text-xs text-red-400 text-center">{error}</p>
              </div>
            )}

            <div className="p-3 border-t border-gray-800">
              <p className="text-xs text-gray-500 text-center">
                Members get access to exclusive content. Cancel anytime.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
