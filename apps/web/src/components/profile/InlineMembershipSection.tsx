"use client";

import { useState, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useMembership, formatSol, getDaysRemaining, calculateYearlyPrice, BillingPeriod } from "@/hooks/useMembership";

interface InlineMembershipSectionProps {
  creator: PublicKey;
  creatorUsername?: string | null;
  customTiers?: Array<{
    id: string;
    name: string;
    description: string;
    monthlyPrice: number;
    benefits: string[];
    isActive: boolean;
  }>;
}

export function InlineMembershipSection({
  creator,
  creatorUsername,
  customTiers = [],
}: InlineMembershipSectionProps) {
  const { publicKey } = useWallet();
  const {
    useMembershipConfig,
    useCreatorMembership,
    useStreamInfo,
    joinMembership,
    isJoiningMembership,
  } = useMembership();

  const [selectedPeriod, setSelectedPeriod] = useState<BillingPeriod>("monthly");
  const [error, setError] = useState<string | null>(null);

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
      <div className="rounded-2xl bg-white/[0.02] border border-white/10 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-white/5 rounded w-1/3"></div>
          <div className="h-20 bg-white/5 rounded"></div>
        </div>
      </div>
    );
  }

  const isActiveMember = membership?.isActive && streamInfo && getDaysRemaining(streamInfo.endTime) > 0;

  const handleJoin = async () => {
    if (!membershipConfig) return;
    setError(null);
    try {
      await joinMembership.mutateAsync({
        creator,
        period: selectedPeriod,
        monthlyPrice: membershipConfig.monthlyPrice,
      });
    } catch (err: any) {
      console.error("Join error:", err);
      setError(err.message || "Failed to join membership");
    }
  };

  const monthlyPrice = membershipConfig?.monthlyPrice ?? BigInt(0);
  const yearlyPrice = calculateYearlyPrice(monthlyPrice);
  const displayPrice = selectedPeriod === "monthly" ? monthlyPrice : yearlyPrice;

  // Get active custom tiers
  const activeTiers = customTiers.filter(t => t.isActive);

  return (
    <div className="rounded-2xl bg-gradient-to-br from-purple-500/10 via-transparent to-cyan-500/10 border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">
              Join {creatorUsername ? `${creatorUsername}'s` : "this creator's"} community
            </h3>
            <p className="text-sm text-white/50 mt-1">
              Get exclusive access to members-only content
            </p>
          </div>
          {isActiveMember && streamInfo && (
            <div className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-full">
              <span className="text-sm text-emerald-400 font-medium">
                Active Member
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {isActiveMember && streamInfo ? (
          // Active member view
          <div className="text-center py-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-emerald-300 font-medium">
                {getDaysRemaining(streamInfo.endTime)} days remaining
              </span>
            </div>
            <p className="text-white/40 text-sm mt-3">
              You have full access to all member content
            </p>
          </div>
        ) : (
          // Join view
          <div className="space-y-6">
            {/* Billing period toggle */}
            <div className="flex justify-center">
              <div className="inline-flex rounded-xl bg-white/5 p-1">
                <button
                  onClick={() => setSelectedPeriod("monthly")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedPeriod === "monthly"
                      ? "bg-white/10 text-white"
                      : "text-white/50 hover:text-white/70"
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setSelectedPeriod("yearly")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedPeriod === "yearly"
                      ? "bg-white/10 text-white"
                      : "text-white/50 hover:text-white/70"
                  }`}
                >
                  Yearly
                  <span className="ml-1 text-emerald-400 text-xs">Save 17%</span>
                </button>
              </div>
            </div>

            {/* Price display */}
            <div className="text-center">
              <div className="text-4xl font-bold text-white">
                {formatSol(displayPrice)} SOL
              </div>
              <div className="text-white/40 text-sm mt-1">
                {selectedPeriod === "monthly" ? "per month" : "per year"}
              </div>
            </div>

            {/* Benefits */}
            {activeTiers.length > 0 && activeTiers[0].benefits.length > 0 && (
              <div className="space-y-2">
                {activeTiers[0].benefits.slice(0, 4).map((benefit, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <svg className="w-4 h-4 text-cyan-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-white/70">{benefit}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Default benefits if no custom tiers */}
            {activeTiers.length === 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-sm">
                  <svg className="w-4 h-4 text-cyan-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-white/70">Access to member-only content</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <svg className="w-4 h-4 text-cyan-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-white/70">Early access to new releases</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <svg className="w-4 h-4 text-cyan-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-white/70">Support the creator directly</span>
                </div>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Join button */}
            <button
              onClick={handleJoin}
              disabled={isJoiningMembership || !publicKey}
              className="w-full py-3 px-6 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium text-white transition-all duration-300 shadow-lg shadow-purple-500/20"
            >
              {isJoiningMembership ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Joining...
                </span>
              ) : !publicKey ? (
                "Connect wallet to join"
              ) : (
                `Join for ${formatSol(displayPrice)} SOL/${selectedPeriod === "monthly" ? "mo" : "yr"}`
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
