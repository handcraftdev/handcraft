"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import type { CustomMembershipTier } from "./CustomMembershipManager";
import { useMembership } from "@/hooks/useMembership";

interface CustomMembershipCardProps {
  creator: PublicKey;
}

export function CustomMembershipCard({ creator }: CustomMembershipCardProps) {
  const { publicKey } = useWallet();
  const { joinCustomMembership, isJoiningCustomMembership, useCreatorMembership } = useMembership();
  const [selectedTier, setSelectedTier] = useState<CustomMembershipTier | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check if user already has a membership with this creator
  const { data: existingMembership } = useCreatorMembership(creator);

  // Fetch custom memberships for this creator
  const { data: tiers = [], isLoading } = useQuery({
    queryKey: ["customMemberships", creator.toBase58()],
    queryFn: async () => {
      const res = await fetch(`/api/memberships/custom?creator=${creator.toBase58()}`);
      if (!res.ok) return [];
      const data = await res.json();
      // Only return active tiers
      return (data.tiers || []).filter((t: CustomMembershipTier) => t.isActive);
    },
  });

  // Don't show if no custom tiers
  if (!isLoading && tiers.length === 0) {
    return null;
  }

  // Don't show for own profile
  if (publicKey?.equals(creator)) {
    return null;
  }

  const handleJoin = (tier: CustomMembershipTier) => {
    setError(null);
    setSelectedTier(tier);
  };

  const handleConfirmJoin = async () => {
    if (!selectedTier || !publicKey) return;

    setError(null);
    try {
      await joinCustomMembership.mutateAsync({
        creator,
        tierId: selectedTier.id,
        tierName: selectedTier.name,
        monthlyPrice: selectedTier.monthlyPrice,
      });
      setSelectedTier(null);
    } catch (err: any) {
      setError(err.message || "Failed to join membership");
    }
  };

  if (isLoading) {
    return (
      <div className="relative rounded-2xl bg-white/[0.02] border border-white/5 p-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent pointer-events-none" />
        <div className="relative animate-pulse">
          <div className="h-6 bg-white/5 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="h-32 bg-white/5 rounded-xl"></div>
            <div className="h-32 bg-white/5 rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent pointer-events-none" />

      {/* Header */}
      <div className="relative p-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-medium text-white/90">Support Tiers</h2>
            <p className="text-sm text-white/40">Get exclusive perks by supporting this creator</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {tiers.map((tier: CustomMembershipTier) => (
            <div
              key={tier.id}
              className="relative bg-white/5 border border-white/10 hover:border-orange-500/30 rounded-xl p-4 transition-all duration-300 cursor-pointer group overflow-hidden"
              onClick={() => handleJoin(tier)}
            >
              {/* Hover gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-white/90">{tier.name}</h3>
                  <span className="text-orange-400 font-bold">{tier.monthlyPrice} SOL</span>
                </div>
                {tier.description && (
                  <p className="text-sm text-white/40 mb-3 line-clamp-2">{tier.description}</p>
                )}
                {tier.benefits.length > 0 && (
                  <ul className="space-y-1.5">
                    {tier.benefits.slice(0, 4).map((benefit, i) => (
                      <li key={i} className="text-sm text-white/50 flex items-start gap-2">
                        <svg className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{benefit}</span>
                      </li>
                    ))}
                    {tier.benefits.length > 4 && (
                      <li className="text-sm text-white/30">+{tier.benefits.length - 4} more benefits</li>
                    )}
                  </ul>
                )}
                <button
                  className="w-full mt-4 py-2.5 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 hover:border-orange-500/50 rounded-xl text-sm font-medium transition-all duration-300 text-white/90"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleJoin(tier);
                  }}
                >
                  Join for {tier.monthlyPrice} SOL/mo
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 text-xs text-white/30 text-center">
          These tiers provide external perks managed by the creator
        </div>
      </div>

      {/* Tier Detail Modal */}
      {selectedTier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="relative bg-black border border-white/10 rounded-2xl p-6 max-w-md mx-4 overflow-hidden">
            {/* Modal gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent pointer-events-none" />

            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-medium text-white/90">{selectedTier.name}</h3>
                <button
                  onClick={() => setSelectedTier(null)}
                  className="p-2 hover:bg-white/5 rounded-xl transition-colors"
                >
                  <svg className="w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {selectedTier.description && (
                <p className="text-white/40 mb-4">{selectedTier.description}</p>
              )}

              <div className="bg-white/5 border border-white/5 rounded-xl p-4 mb-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/30 mb-1">Price</p>
                <p className="text-2xl font-bold text-orange-400">
                  {selectedTier.monthlyPrice} SOL<span className="text-sm text-white/40 font-normal">/month</span>
                </p>
              </div>

              {selectedTier.benefits.length > 0 && (
                <div className="mb-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/30 mb-3">Benefits included</p>
                  <ul className="space-y-2">
                    {selectedTier.benefits.map((benefit, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <svg className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-white/60">{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 mb-4">
                <p className="text-sm text-orange-300/80">
                  This is a custom tier with external perks. The creator will contact you after payment to provide access.
                </p>
              </div>

              {existingMembership?.isActive && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 mb-4">
                  <p className="text-sm text-emerald-400">
                    You already have an active membership with this creator.
                  </p>
                </div>
              )}

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedTier(null)}
                  disabled={isJoiningCustomMembership}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 disabled:opacity-50 rounded-xl font-medium transition-all duration-300 text-white/70 hover:text-white/90"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmJoin}
                  disabled={!publicKey || isJoiningCustomMembership || existingMembership?.isActive}
                  className="flex-1 py-3 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 hover:border-orange-500/50 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium transition-all duration-300 text-white/90"
                >
                  {!publicKey
                    ? "Connect Wallet"
                    : isJoiningCustomMembership
                      ? "Processing..."
                      : existingMembership?.isActive
                        ? "Already Member"
                        : "Join Now"
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
