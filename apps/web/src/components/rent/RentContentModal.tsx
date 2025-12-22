"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useContentRegistry, RentTier, RentConfig, RENT_PERIOD_6H, RENT_PERIOD_1D, RENT_PERIOD_7D } from "@/hooks/useContentRegistry";
import { getTransactionErrorMessage } from "@/utils/wallet-errors";

// Active rental info (from NFT Attributes)
interface ActiveRentalInfo {
  nftAsset: PublicKey;
  expiresAt: bigint;
  tier: number;
  isActive: boolean;
}

interface RentContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentCid: string;
  contentTitle?: string;
  creator: PublicKey;
  rentConfig: RentConfig;
  activeRental?: ActiveRentalInfo | null;
  onSuccess?: () => void;
  onBuyClick?: () => void;
}

const LAMPORTS_PER_SOL = 1_000_000_000;

// Platform addresses
const TREASURY_ADDRESS = new PublicKey("3v8n7vBPDNR9xpJWPEQALmH9WxmqTLM9aQ3W5jKo4bXf");
const PLATFORM_ADDRESS = new PublicKey("HCFiRpqFxh63z9BnJYP6LAv3YvLwuEwBCnUGh9xmzwAz");

const TIER_OPTIONS = [
  { tier: RentTier.SixHours, label: "6 Hours", period: RENT_PERIOD_6H },
  { tier: RentTier.OneDay, label: "1 Day", period: RENT_PERIOD_1D },
  { tier: RentTier.SevenDays, label: "7 Days", period: RENT_PERIOD_7D },
];

export function RentContentModal({
  isOpen,
  onClose,
  contentCid,
  contentTitle,
  creator,
  rentConfig,
  activeRental,
  onSuccess,
  onBuyClick,
}: RentContentModalProps) {
  const { publicKey } = useWallet();
  const { rentContentSol, isRentingContent, ecosystemConfig } = useContentRegistry();
  const [selectedTier, setSelectedTier] = useState<RentTier>(RentTier.OneDay);
  const [error, setError] = useState<string | null>(null);

  const getFeeForTier = (tier: RentTier): bigint => {
    switch (tier) {
      case RentTier.SixHours: return rentConfig.rentFee6h;
      case RentTier.OneDay: return rentConfig.rentFee1d;
      case RentTier.SevenDays: return rentConfig.rentFee7d;
    }
  };

  const getPeriodForTier = (tier: RentTier): number => {
    switch (tier) {
      case RentTier.SixHours: return RENT_PERIOD_6H;
      case RentTier.OneDay: return RENT_PERIOD_1D;
      case RentTier.SevenDays: return RENT_PERIOD_7D;
    }
  };

  const selectedFee = getFeeForTier(selectedTier);
  const selectedPeriod = getPeriodForTier(selectedTier);

  // If extending, calculate from current expiry, otherwise from now
  const currentExpiry = activeRental ? Number(activeRental.expiresAt) * 1000 : Date.now();
  const baseTime = activeRental && currentExpiry > Date.now() ? currentExpiry : Date.now();
  const expiryDate = new Date(baseTime + selectedPeriod * 1000);
  const isExtending = !!activeRental && currentExpiry > Date.now();

  const handleRent = async () => {
    setError(null);

    if (!publicKey) {
      setError("Please connect your wallet");
      return;
    }

    try {
      const treasury = ecosystemConfig?.treasury || TREASURY_ADDRESS;

      await rentContentSol({
        contentCid,
        creator,
        treasury,
        platform: PLATFORM_ADDRESS,
        tier: selectedTier,
      });

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("Failed to rent content:", err);
      setError(getTransactionErrorMessage(err));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-black border border-white/10 rounded-2xl w-full max-w-md p-6 m-4 max-h-[90vh] overflow-y-auto">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none rounded-2xl" />

        <div className="relative">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-medium text-white/90">{isExtending ? "Extend Rental" : "Rent Content"}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded-full transition-all duration-300 text-white/40 hover:text-white/70"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {contentTitle && (
            <p className="text-white/40 mb-5 text-sm">
              {isExtending ? "Extending" : "Renting"} access to: <span className="text-white/80">{contentTitle}</span>
            </p>
          )}

          {/* Current rental info banner */}
          {isExtending && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-5">
              <div className="flex items-center gap-2 text-amber-300 text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Current access expires: {new Date(currentExpiry).toLocaleString()}</span>
              </div>
            </div>
          )}

          <div className="space-y-5">
            {/* Tier Selection */}
            <div>
              <label className="block text-[11px] uppercase tracking-[0.2em] text-white/30 mb-3">Select Duration</label>
              <div className="grid grid-cols-3 gap-2">
                {TIER_OPTIONS.map(({ tier, label }) => {
                  const fee = getFeeForTier(tier);
                  const feeInSol = Number(fee) / LAMPORTS_PER_SOL;
                  return (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setSelectedTier(tier)}
                      className={`relative p-3 rounded-xl text-center transition-all duration-300 overflow-hidden ${
                        selectedTier === tier
                          ? "bg-amber-500/20 border border-amber-500/50 text-white/90"
                          : "bg-white/[0.02] border border-white/10 text-white/50 hover:bg-white/5 hover:border-white/20"
                      }`}
                    >
                      {selectedTier === tier && (
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent pointer-events-none" />
                      )}
                      <div className="relative">
                        <div className="text-sm font-medium">{label}</div>
                        <div className={`text-xs mt-1 ${selectedTier === tier ? "text-amber-300" : "text-white/40"}`}>
                          {feeInSol.toFixed(4)} SOL
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Details */}
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-white/40 text-sm">Rental Fee</span>
                <span className="text-xl font-bold text-white/90">
                  {(Number(selectedFee) / LAMPORTS_PER_SOL).toFixed(4)} SOL
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/40 text-sm">Access Period</span>
                <span className="text-white/80 font-medium">
                  {TIER_OPTIONS.find(t => t.tier === selectedTier)?.label}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/40 text-sm">{isExtending ? "New Expiry" : "Expires"}</span>
                <span className="text-amber-400 text-sm">
                  {expiryDate.toLocaleDateString()} {expiryDate.toLocaleTimeString()}
                </span>
              </div>
            </div>

            {/* What you get */}
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
              <h3 className="text-[11px] uppercase tracking-[0.15em] text-emerald-400 mb-3">What you get</h3>
              <ul className="text-sm text-white/60 space-y-2">
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Temporary NFT granting access to encrypted content</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Access for {TIER_OPTIONS.find(t => t.tier === selectedTier)?.label}</span>
                </li>
              </ul>
            </div>

            {/* Limitations */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
              <h3 className="text-[11px] uppercase tracking-[0.15em] text-amber-300 mb-3">Please note</h3>
              <ul className="text-sm text-amber-200/60 space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="text-amber-400/60 mt-0.5">-</span>
                  Rental NFTs cannot be transferred or sold
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400/60 mt-0.5">-</span>
                  Access expires automatically after the rental period
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400/60 mt-0.5">-</span>
                  Rental NFTs do not accumulate holder rewards
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400/60 mt-0.5">-</span>
                  You can rent again to extend access
                </li>
              </ul>
            </div>

            {/* Total Rentals - only show if there have been rentals */}
            {Number(rentConfig.totalRentals) > 0 && (
              <div className="text-center text-sm text-white/30">
                <span>{Number(rentConfig.totalRentals)} people have rented this content</span>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleRent}
              disabled={isRentingContent}
              className="w-full py-3 bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl font-medium transition-all duration-300 flex items-center justify-center gap-2 border border-amber-500/30 hover:border-amber-500/50 text-white/90"
            >
              {isRentingContent ? (
                <>
                  <svg className="animate-spin w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{isExtending ? "Extend" : "Rent"} for {(Number(selectedFee) / LAMPORTS_PER_SOL).toFixed(4)} SOL</span>
                </>
              )}
            </button>

            {/* Buy NFT suggestion */}
            {onBuyClick && (
              <p className="text-center text-xs text-white/30">
                Want permanent access?{" "}
                <button
                  className="text-purple-400 hover:text-purple-300 transition-colors duration-300"
                  onClick={() => { onClose(); onBuyClick(); }}
                >
                  Buy the NFT instead
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
