"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  useContentRegistry,
  MIN_RENT_FEE_LAMPORTS,
} from "@/hooks/useContentRegistry";
import { getTransactionErrorMessage } from "@/utils/wallet-errors";

interface ConfigureRentModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentCid: string;
  contentTitle?: string;
  onSuccess?: () => void;
}

const LAMPORTS_PER_SOL = 1_000_000_000;

export function ConfigureRentModal({
  isOpen,
  onClose,
  contentCid,
  contentTitle,
  onSuccess,
}: ConfigureRentModalProps) {
  const { publicKey } = useWallet();
  const { configureRent, updateRentConfig, isConfiguringRent, isUpdatingRentConfig, useRentConfig } = useContentRegistry();
  const { data: existingConfig, isLoading: isLoadingConfig } = useRentConfig(contentCid);

  const isSaving = isConfiguringRent || isUpdatingRentConfig;

  // Form state for 3-tier pricing
  const [rentFee6h, setRentFee6h] = useState("");
  const [rentFee1d, setRentFee1d] = useState("");
  const [rentFee7d, setRentFee7d] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Load existing config values when available
  useEffect(() => {
    if (existingConfig && !hasInitialized) {
      if (existingConfig.rentFee6h > BigInt(0)) {
        setRentFee6h((Number(existingConfig.rentFee6h) / LAMPORTS_PER_SOL).toString());
      }
      if (existingConfig.rentFee1d > BigInt(0)) {
        setRentFee1d((Number(existingConfig.rentFee1d) / LAMPORTS_PER_SOL).toString());
      }
      if (existingConfig.rentFee7d > BigInt(0)) {
        setRentFee7d((Number(existingConfig.rentFee7d) / LAMPORTS_PER_SOL).toString());
      }
      setIsActive(existingConfig.isActive);
      setHasInitialized(true);
    }
  }, [existingConfig, hasInitialized]);

  // Reset hasInitialized when modal closes
  useEffect(() => {
    if (!isOpen) {
      setHasInitialized(false);
    }
  }, [isOpen]);

  const parseFee = (feeStr: string): bigint | null => {
    if (feeStr === "" || feeStr === "0") return null;
    const feeFloat = parseFloat(feeStr);
    if (isNaN(feeFloat) || feeFloat < 0) return null;
    return BigInt(Math.floor(feeFloat * LAMPORTS_PER_SOL));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!publicKey) {
      setError("Please connect your wallet");
      return;
    }

    try {
      // Parse all fees
      const fee6h = parseFee(rentFee6h);
      const fee1d = parseFee(rentFee1d);
      const fee7d = parseFee(rentFee7d);

      // All fees are required
      if (fee6h === null || fee1d === null || fee7d === null) {
        setError("All three rental fees are required");
        return;
      }

      // Validate minimum fees
      const minFee = BigInt(MIN_RENT_FEE_LAMPORTS);
      if (fee6h < minFee || fee1d < minFee || fee7d < minFee) {
        setError(`Minimum rent fee is ${MIN_RENT_FEE_LAMPORTS / LAMPORTS_PER_SOL} SOL`);
        return;
      }

      // Validate fee progression (longer periods should cost more)
      if (fee1d < fee6h) {
        setError("1 Day fee should be equal to or greater than 6 Hours fee");
        return;
      }
      if (fee7d < fee1d) {
        setError("7 Days fee should be equal to or greater than 1 Day fee");
        return;
      }

      if (existingConfig) {
        // Update existing config
        await updateRentConfig({
          contentCid,
          rentFee6h: fee6h,
          rentFee1d: fee1d,
          rentFee7d: fee7d,
          isActive,
        });
      } else {
        // Create new config
        await configureRent({
          contentCid,
          rentFee6h: fee6h,
          rentFee1d: fee1d,
          rentFee7d: fee7d,
        });
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("Failed to save rent settings:", err);
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
            <h2 className="text-lg font-medium text-white/90">Rental Pricing</h2>
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
              {existingConfig ? "Editing" : "Setting up"} rental for: <span className="text-white/80">{contentTitle}</span>
            </p>
          )}

          {isLoadingConfig ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 3-Tier Pricing */}
            <div>
              <label className="block text-[11px] uppercase tracking-[0.2em] text-white/30 mb-3">Rental Fees (SOL)</label>
              <p className="text-xs text-white/30 mb-4">
                Set prices for all three rental tiers. Users will choose which duration suits them.
              </p>

              <div className="space-y-3">
                {/* 6 Hours */}
                <div className="flex items-center gap-3">
                  <label className="w-20 text-sm text-white/40">6 Hours</label>
                  <div className="flex-1 flex gap-2">
                    <input
                      type="number"
                      step="0.001"
                      min="0.001"
                      value={rentFee6h}
                      onChange={(e) => setRentFee6h(e.target.value)}
                      placeholder="0.01"
                      className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-amber-500/50 focus:bg-white/[0.07] text-white/90 placeholder:text-white/20 transition-all duration-300 text-sm"
                    />
                    <span className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white/40 text-sm">
                      SOL
                    </span>
                  </div>
                </div>

                {/* 1 Day */}
                <div className="flex items-center gap-3">
                  <label className="w-20 text-sm text-white/40">1 Day</label>
                  <div className="flex-1 flex gap-2">
                    <input
                      type="number"
                      step="0.001"
                      min="0.001"
                      value={rentFee1d}
                      onChange={(e) => setRentFee1d(e.target.value)}
                      placeholder="0.02"
                      className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-amber-500/50 focus:bg-white/[0.07] text-white/90 placeholder:text-white/20 transition-all duration-300 text-sm"
                    />
                    <span className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white/40 text-sm">
                      SOL
                    </span>
                  </div>
                </div>

                {/* 7 Days */}
                <div className="flex items-center gap-3">
                  <label className="w-20 text-sm text-white/40">7 Days</label>
                  <div className="flex-1 flex gap-2">
                    <input
                      type="number"
                      step="0.001"
                      min="0.001"
                      value={rentFee7d}
                      onChange={(e) => setRentFee7d(e.target.value)}
                      placeholder="0.05"
                      className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-amber-500/50 focus:bg-white/[0.07] text-white/90 placeholder:text-white/20 transition-all duration-300 text-sm"
                    />
                    <span className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white/40 text-sm">
                      SOL
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Toggle - only show for existing configs */}
            {existingConfig && (
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${isActive ? "bg-amber-500/30" : "bg-white/10"}`}>
                    <div className={`absolute top-1 left-1 w-4 h-4 rounded-full transition-all duration-300 ${isActive ? "translate-x-5 bg-amber-400" : "translate-x-0 bg-white/40"}`} />
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="sr-only"
                    />
                  </div>
                  <div>
                    <span className="font-medium text-white/80">Rental Active</span>
                    <p className="text-xs text-white/30 mt-0.5">
                      {isActive ? "Users can rent this content" : "Rental is paused"}
                    </p>
                  </div>
                </label>
              </div>
            )}

            {/* Stats - only show for existing configs */}
            {existingConfig && (
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                <h3 className="text-[11px] uppercase tracking-[0.15em] text-white/30 mb-3">Rental Stats</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/40">Total Rentals</span>
                    <span className="text-white/80">{Number(existingConfig.totalRentals)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Total Fees Collected</span>
                    <span className="text-emerald-400">
                      {(Number(existingConfig.totalFeesCollected) / LAMPORTS_PER_SOL).toFixed(4)} SOL
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Revenue Split Info */}
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
              <h3 className="text-[11px] uppercase tracking-[0.15em] text-white/30 mb-3">Rental Fee Split</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/40">Creator (you)</span>
                  <span className="text-emerald-400 font-medium">80%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">NFT Holders</span>
                  <span className="text-blue-400 font-medium">12%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/30">Platform</span>
                  <span className="text-white/30">5%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/30">Ecosystem</span>
                  <span className="text-white/30">3%</span>
                </div>
              </div>
            </div>

            {/* Rental NFT Info */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
              <h3 className="text-[11px] uppercase tracking-[0.15em] text-amber-300 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                About Rental NFTs
              </h3>
              <ul className="text-sm text-amber-200/60 space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="text-amber-400/60 mt-0.5">-</span>
                  Rental NFTs are non-transferable (frozen)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400/60 mt-0.5">-</span>
                  Access expires automatically after the rental period
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400/60 mt-0.5">-</span>
                  Rental NFTs do not receive holder rewards
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400/60 mt-0.5">-</span>
                  Users can rent again to extend access
                </li>
              </ul>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-3 bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl font-medium transition-all duration-300 border border-amber-500/30 hover:border-amber-500/50 text-white/90"
            >
              {isSaving ? "Saving..." : existingConfig ? "Update Pricing" : "Enable Rentals"}
            </button>
          </form>
          )}
        </div>
      </div>
    </div>
  );
}
