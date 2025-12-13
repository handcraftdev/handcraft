"use client";

import { useState, useMemo, useEffect } from "react";
import { useMembership, formatSol, calculateYearlyPrice } from "@/hooks/useMembership";

interface CreatorMembershipSettingsProps {
  onSuccess?: () => void;
}

const LAMPORTS_PER_SOL = 1_000_000_000;

export function CreatorMembershipSettings({ onSuccess }: CreatorMembershipSettingsProps) {
  const {
    useMembershipConfig,
    initMembershipConfig,
    updateMembershipConfig,
    isInitializingMembership,
    isUpdatingMembership,
  } = useMembership();

  const { data: membershipConfig, isLoading: isLoadingConfig, refetch: refetchConfig } = useMembershipConfig(null);

  const [monthlyPrice, setMonthlyPrice] = useState("0.05");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Check if config already exists for current user
  const hasExistingConfig = !!membershipConfig;

  // Set initial price from existing config when entering edit mode
  useEffect(() => {
    if (isEditing && membershipConfig) {
      const currentPrice = Number(membershipConfig.monthlyPrice) / LAMPORTS_PER_SOL;
      setMonthlyPrice(currentPrice.toFixed(4));
    }
  }, [isEditing, membershipConfig]);

  // Auto-calculate yearly price (10 months for 12 months access)
  const yearlyPrice = useMemo(() => {
    const monthly = parseFloat(monthlyPrice);
    if (isNaN(monthly) || monthly <= 0) return "0.0000";
    return (monthly * 10).toFixed(4);
  }, [monthlyPrice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const monthlyNum = parseFloat(monthlyPrice);

    if (isNaN(monthlyNum) || monthlyNum <= 0) {
      setError("Please enter a valid monthly price");
      return;
    }

    try {
      if (hasExistingConfig) {
        // Update existing config
        await updateMembershipConfig.mutateAsync({
          monthlyPrice: monthlyNum,
        });
      } else {
        // Initialize new config
        await initMembershipConfig.mutateAsync({
          monthlyPrice: monthlyNum,
        });
      }
      // Refetch config to update UI
      await refetchConfig();
      setSuccess(true);
      setIsEditing(false);
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || "Failed to save membership settings");
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setError(null);
    setSuccess(false);
    // Reset price to current value
    if (membershipConfig) {
      const currentPrice = Number(membershipConfig.monthlyPrice) / LAMPORTS_PER_SOL;
      setMonthlyPrice(currentPrice.toFixed(4));
    }
  };

  if (isLoadingConfig) {
    return (
      <div className="relative rounded-2xl bg-white/[0.02] border border-white/5 p-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none" />
        <div className="relative animate-pulse">
          <div className="h-6 bg-white/5 rounded w-1/3 mb-4"></div>
          <div className="h-10 bg-white/5 rounded mb-3"></div>
          <div className="h-10 bg-white/5 rounded"></div>
        </div>
      </div>
    );
  }

  const isSubmitting = isInitializingMembership || isUpdatingMembership;

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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-medium text-white/90">Membership Settings</h2>
              <p className="text-sm text-white/40">Let fans become members and access exclusive content</p>
            </div>
          </div>
          {hasExistingConfig && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-sm font-medium transition-all duration-300 flex items-center gap-2 text-white/70 hover:text-white/90"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="relative p-5">
        {hasExistingConfig && !isEditing ? (
          <div className="space-y-4">
            {/* Status badge */}
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium text-emerald-400">Memberships Enabled</span>
              </div>
              <p className="text-sm text-white/40">Fans can now become members to access your exclusive content.</p>
            </div>

            {/* Pricing cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 border border-white/5 rounded-xl p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/30 mb-1">Monthly</p>
                <p className="text-2xl font-bold text-white/90">{formatSol(membershipConfig.monthlyPrice)} SOL</p>
                <p className="text-xs text-white/30 mt-1">per month</p>
              </div>
              <div className="relative bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent pointer-events-none" />
                <div className="relative">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/30 mb-1">Yearly</p>
                  <p className="text-2xl font-bold text-white/90">{formatSol(calculateYearlyPrice(membershipConfig.monthlyPrice))} SOL</p>
                  <p className="text-xs text-emerald-400 mt-1">2 months free!</p>
                </div>
              </div>
            </div>

            {/* Benefits */}
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
              <h4 className="text-[11px] uppercase tracking-[0.2em] text-white/30 mb-3">Member Benefits</h4>
              <ul className="space-y-2 text-sm text-white/50">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Access to all "Members" tier content
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Access to all "Subscribers" tier content
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Direct support to you
                </li>
              </ul>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Info banner */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
              <p className="text-sm text-blue-300/80">
                {isEditing
                  ? "Update your monthly membership price. Changes apply to new memberships."
                  : "Set your monthly membership price. Yearly memberships automatically include a 2-month discount (fans pay for 10 months, get 12)."}
              </p>
            </div>

            {/* Price input */}
            <div>
              <label className="block text-[11px] uppercase tracking-[0.2em] text-white/30 mb-2">
                Monthly Membership Price (SOL)
              </label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                value={monthlyPrice}
                onChange={(e) => setMonthlyPrice(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white/90 focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.07] transition-all duration-300 placeholder:text-white/20"
                placeholder="0.05"
              />
              <p className="text-xs text-white/30 mt-2">Members pay this amount monthly for content access</p>
            </div>

            {/* Yearly price display */}
            <div className="relative bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent pointer-events-none" />
              <div className="relative flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/30">Yearly Price (auto-calculated)</p>
                  <p className="text-2xl font-bold text-white/90 mt-1">{yearlyPrice} SOL</p>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center px-2.5 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full border border-emerald-500/20">
                    2 months free
                  </span>
                  <p className="text-xs text-white/30 mt-2">10 months = 12 months access</p>
                </div>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Success message */}
            {success && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                <p className="text-sm text-emerald-400">
                  {isEditing ? "Membership price updated successfully!" : "Memberships enabled successfully!"}
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className={isEditing ? "flex gap-3" : ""}>
              {isEditing && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl font-medium transition-all duration-300 text-white/70 hover:text-white/90"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className={`${isEditing ? "flex-1" : "w-full"} py-3 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 hover:border-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium transition-all duration-300 flex items-center justify-center gap-2 text-white/90`}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>{isEditing ? "Updating..." : "Setting up..."}</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{isEditing ? "Update Price" : "Enable Memberships"}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
