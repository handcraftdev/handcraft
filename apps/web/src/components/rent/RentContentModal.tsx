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

// Platform addresses - lazy initialization to avoid SSR _bn issues
const TREASURY_ADDRESS_STR = "3v8n7vBPDNR9xpJWPEQALmH9WxmqTLM9aQ3W5jKo4bXf";
const PLATFORM_ADDRESS_STR = "HCFiRpqFxh63z9BnJYP6LAv3YvLwuEwBCnUGh9xmzwAz";

let _TREASURY_ADDRESS: PublicKey | null = null;
let _PLATFORM_ADDRESS: PublicKey | null = null;

function getTreasuryAddress(): PublicKey {
  if (!_TREASURY_ADDRESS) {
    _TREASURY_ADDRESS = new PublicKey(TREASURY_ADDRESS_STR);
  }
  return _TREASURY_ADDRESS;
}

function getPlatformAddress(): PublicKey {
  if (!_PLATFORM_ADDRESS) {
    _PLATFORM_ADDRESS = new PublicKey(PLATFORM_ADDRESS_STR);
  }
  return _PLATFORM_ADDRESS;
}

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
      const treasury = ecosystemConfig?.treasury || getTreasuryAddress();

      await rentContentSol({
        contentCid,
        creator,
        treasury,
        platform: getPlatformAddress(),
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
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />

      <div className="relative bg-black border border-white/[0.08] rounded-lg w-full max-w-sm p-4 m-4 max-h-[90vh] overflow-y-auto">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none rounded-lg" />

        <div className="relative">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-white/90">{isExtending ? "Extend Rental" : "Rent Content"}</h2>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-all text-white/40 hover:text-white/70"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {contentTitle && (
            <p className="text-white/40 mb-4 text-base">
              {isExtending ? "Extending" : "Renting"} access to: <span className="text-white/80">{contentTitle}</span>
            </p>
          )}

          {/* Current rental info banner */}
          {isExtending && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 mb-4">
              <div className="flex items-center gap-1.5 text-amber-300 text-sm">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Current access expires: {new Date(currentExpiry).toLocaleString()}</span>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {/* Tier Selection */}
            <div>
              <label className="block text-2xs uppercase tracking-[0.15em] text-white/30 mb-2">Select Duration</label>
              <div className="grid grid-cols-3 gap-1.5">
                {TIER_OPTIONS.map(({ tier, label }) => {
                  const fee = getFeeForTier(tier);
                  const feeInSol = Number(fee) / LAMPORTS_PER_SOL;
                  return (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setSelectedTier(tier)}
                      className={`relative p-2 rounded-lg text-center transition-all overflow-hidden ${
                        selectedTier === tier
                          ? "bg-amber-500/20 border border-amber-500/50 text-white/90"
                          : "bg-white/[0.02] border border-white/[0.08] text-white/50 hover:bg-white/[0.04]"
                      }`}
                    >
                      {selectedTier === tier && (
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent pointer-events-none" />
                      )}
                      <div className="relative">
                        <div className="text-sm font-medium">{label}</div>
                        <div className={`text-xs mt-0.5 ${selectedTier === tier ? "text-amber-300" : "text-white/40"}`}>
                          {feeInSol.toFixed(4)} SOL
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Details */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-white/40 text-sm">Rental Fee</span>
                <span className="text-lg font-bold text-white/90">
                  {(Number(selectedFee) / LAMPORTS_PER_SOL).toFixed(4)} SOL
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/40 text-sm">Access Period</span>
                <span className="text-white/80 text-base font-medium">
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
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
              <h3 className="text-2xs uppercase tracking-[0.15em] text-emerald-400 mb-2">What you get</h3>
              <ul className="text-sm text-white/60 space-y-1.5">
                <li className="flex items-start gap-1.5">
                  <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Temporary NFT granting access to encrypted content</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Access for {TIER_OPTIONS.find(t => t.tier === selectedTier)?.label}</span>
                </li>
              </ul>
            </div>

            {/* Limitations */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <h3 className="text-2xs uppercase tracking-[0.15em] text-amber-300 mb-2">Please note</h3>
              <ul className="text-sm text-amber-200/60 space-y-1">
                <li className="flex items-start gap-1.5">
                  <span className="text-amber-400/60">-</span>
                  Rental NFTs cannot be transferred or sold
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-amber-400/60">-</span>
                  Access expires automatically
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-amber-400/60">-</span>
                  No holder rewards for rentals
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
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleRent}
              disabled={isRentingContent}
              className="w-full py-2 bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-base font-medium transition-all flex items-center justify-center gap-1.5 border border-amber-500/30 text-white/90"
            >
              {isRentingContent ? (
                <>
                  <svg className="animate-spin w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{isExtending ? "Extend" : "Rent"} for {(Number(selectedFee) / LAMPORTS_PER_SOL).toFixed(4)} SOL</span>
                </>
              )}
            </button>

            {/* Buy NFT suggestion */}
            {onBuyClick && (
              <p className="text-center text-2xs text-white/30">
                Want permanent access?{" "}
                <button
                  className="text-purple-400 hover:text-purple-300 transition-colors"
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
