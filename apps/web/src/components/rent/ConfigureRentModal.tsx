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
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />

      <div className="relative bg-gray-900 rounded-xl w-full max-w-md p-6 m-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Rental Pricing</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {contentTitle && (
          <p className="text-gray-400 mb-4 text-sm">
            {existingConfig ? "Editing" : "Setting up"} rental for: <span className="text-white">{contentTitle}</span>
          </p>
        )}

        {isLoadingConfig ? (
          <div className="flex items-center justify-center py-8">
            <svg className="animate-spin w-8 h-8 text-primary-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 3-Tier Pricing */}
          <div>
            <label className="block text-sm font-medium mb-3">Rental Fees (SOL)</label>
            <p className="text-xs text-gray-500 mb-3">
              Set prices for all three rental tiers. Users will choose which duration suits them.
            </p>

            <div className="space-y-3">
              {/* 6 Hours */}
              <div className="flex items-center gap-3">
                <label className="w-20 text-sm text-gray-400">6 Hours</label>
                <div className="flex-1 flex gap-2">
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={rentFee6h}
                    onChange={(e) => setRentFee6h(e.target.value)}
                    placeholder="0.01"
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500 text-sm"
                  />
                  <span className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 text-sm">
                    SOL
                  </span>
                </div>
              </div>

              {/* 1 Day */}
              <div className="flex items-center gap-3">
                <label className="w-20 text-sm text-gray-400">1 Day</label>
                <div className="flex-1 flex gap-2">
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={rentFee1d}
                    onChange={(e) => setRentFee1d(e.target.value)}
                    placeholder="0.02"
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500 text-sm"
                  />
                  <span className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 text-sm">
                    SOL
                  </span>
                </div>
              </div>

              {/* 7 Days */}
              <div className="flex items-center gap-3">
                <label className="w-20 text-sm text-gray-400">7 Days</label>
                <div className="flex-1 flex gap-2">
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={rentFee7d}
                    onChange={(e) => setRentFee7d(e.target.value)}
                    placeholder="0.05"
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500 text-sm"
                  />
                  <span className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 text-sm">
                    SOL
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Active Toggle - only show for existing configs */}
          {existingConfig && (
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-5 h-5 text-primary-500 rounded focus:ring-primary-500"
                />
                <div>
                  <span className="font-medium">Rental Active</span>
                  <p className="text-xs text-gray-500">
                    {isActive ? "Users can rent this content" : "Rental is paused"}
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* Stats - only show for existing configs */}
          {existingConfig && (
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-medium mb-2">Rental Stats</h3>
              <div className="space-y-1 text-sm text-gray-400">
                <div className="flex justify-between">
                  <span>Total Rentals</span>
                  <span className="text-white">{Number(existingConfig.totalRentals)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Fees Collected</span>
                  <span className="text-green-400">
                    {(Number(existingConfig.totalFeesCollected) / LAMPORTS_PER_SOL).toFixed(4)} SOL
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Revenue Split Info */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-sm font-medium mb-2">Rental Fee Split</h3>
            <div className="space-y-1 text-sm text-gray-400">
              <div className="flex justify-between">
                <span>Creator (you)</span>
                <span className="text-green-400">80%</span>
              </div>
              <div className="flex justify-between">
                <span>NFT Holders</span>
                <span className="text-blue-400">12%</span>
              </div>
              <div className="flex justify-between">
                <span>Platform</span>
                <span>5%</span>
              </div>
              <div className="flex justify-between">
                <span>Ecosystem</span>
                <span>3%</span>
              </div>
            </div>
          </div>

          {/* Rental NFT Info */}
          <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-amber-400 mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              About Rental NFTs
            </h3>
            <ul className="text-xs text-amber-200/80 space-y-1">
              <li>Rental NFTs are non-transferable (frozen)</li>
              <li>Access expires automatically after the rental period</li>
              <li>Rental NFTs do not receive holder rewards</li>
              <li>Users can rent again to extend access</li>
            </ul>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-3 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
          >
            {isSaving ? "Saving..." : existingConfig ? "Update Pricing" : "Enable Rentals"}
          </button>
        </form>
        )}
      </div>
    </div>
  );
}
