"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  useContentRegistry,
  FIXED_CREATOR_ROYALTY_BPS,
  MIN_PRICE_LAMPORTS,
} from "@/hooks/useContentRegistry";
import { getTransactionErrorMessage } from "@/utils/wallet-errors";

interface MintConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentCid: string;
  contentTitle?: string;
  isLocked?: boolean;
  onSuccess?: () => void;
}

const LAMPORTS_PER_SOL = 1_000_000_000;

export function MintConfigModal({
  isOpen,
  onClose,
  contentCid,
  contentTitle,
  isLocked = false,
  onSuccess,
}: MintConfigModalProps) {
  const { publicKey } = useWallet();
  const { configureMint, updateMintSettings, isConfiguringMint, isUpdatingMintSettings, useMintConfig } = useContentRegistry();
  const { data: existingConfig, isLoading: isLoadingConfig } = useMintConfig(contentCid);

  const isSaving = isConfiguringMint || isUpdatingMintSettings;

  // Form state
  const [price, setPrice] = useState("");
  const [supplyType, setSupplyType] = useState<"unlimited" | "limited">("unlimited");
  const [maxSupply, setMaxSupply] = useState("");
  // Royalty is now fixed at 4% (FIXED_CREATOR_ROYALTY_BPS)
  const royaltyPercent = FIXED_CREATOR_ROYALTY_BPS / 100;
  const [error, setError] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Load existing config values when available
  useEffect(() => {
    if (existingConfig && !hasInitialized) {
      // Set price (SOL only)
      if (existingConfig.priceSol > BigInt(0)) {
        setPrice((Number(existingConfig.priceSol) / LAMPORTS_PER_SOL).toString());
      } else {
        setPrice("");
      }

      // Set supply
      if (existingConfig.maxSupply !== null) {
        setSupplyType("limited");
        setMaxSupply(existingConfig.maxSupply.toString());
      } else {
        setSupplyType("unlimited");
        setMaxSupply("");
      }

      // Royalty is now fixed at 4%, no need to set from existing config

      setHasInitialized(true);
    }
  }, [existingConfig, hasInitialized]);

  // Reset hasInitialized when modal closes
  useEffect(() => {
    if (!isOpen) {
      setHasInitialized(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!publicKey) {
      setError("Please connect your wallet");
      return;
    }

    try {
      // Parse price (SOL only) - free minting is not allowed
      const priceFloat = parseFloat(price);
      if (isNaN(priceFloat) || priceFloat <= 0) {
        setError("Price is required. Free minting is not allowed.");
        return;
      }
      const priceValue = BigInt(Math.floor(priceFloat * LAMPORTS_PER_SOL));
      if (priceValue < MIN_PRICE_LAMPORTS) {
        setError(`Minimum price is ${MIN_PRICE_LAMPORTS / LAMPORTS_PER_SOL} SOL`);
        return;
      }

      // Parse supply
      let maxSupplyValue: bigint | null = null;
      if (supplyType === "limited") {
        const supplyNum = parseInt(maxSupply);
        if (isNaN(supplyNum) || supplyNum < 1) {
          setError("Invalid supply (minimum 1)");
          return;
        }
        maxSupplyValue = BigInt(supplyNum);
      }

      // Royalty is now fixed at 4%
      const royaltyBps = FIXED_CREATOR_ROYALTY_BPS;

      if (existingConfig) {
        // Update existing config
        // For maxSupply: undefined = don't change, null = set unlimited (not supported), bigint = set value
        // If existing is unlimited and staying unlimited, pass undefined (don't change)
        // If existing is limited, pass the new value (can only change the number, not to unlimited)
        let maxSupplyForUpdate: bigint | null | undefined;
        if (existingConfig.maxSupply === null && supplyType === "unlimited") {
          // Was unlimited, staying unlimited - don't change
          maxSupplyForUpdate = undefined;
        } else {
          // Either was limited (must stay limited), or was unlimited and setting a cap
          maxSupplyForUpdate = maxSupplyValue;
        }

        await updateMintSettings({
          contentCid,
          price: priceValue,
          maxSupply: maxSupplyForUpdate,
          // Don't change royalty if content is locked (editions have been minted)
          creatorRoyaltyBps: isLocked ? null : royaltyBps,
          isActive: null, // Keep current value
        });
      } else {
        // Create new config
        await configureMint({
          contentCid,
          price: priceValue,
          maxSupply: maxSupplyValue,
          creatorRoyaltyBps: royaltyBps,
        });
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("Failed to save mint settings:", err);
      setError(getTransactionErrorMessage(err));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-black border border-white/10 rounded-2xl w-full max-w-md p-6 m-4 max-h-[90vh] overflow-y-auto">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none rounded-2xl" />

        <div className="relative">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-medium text-white/90">Content Settings</h2>
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
              {existingConfig ? "Editing" : "Setting up"} minting for: <span className="text-white/80">{contentTitle}</span>
            </p>
          )}

          {isLoadingConfig ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin w-8 h-8 text-purple-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Price */}
            <div>
              <label className="block text-[11px] uppercase tracking-[0.2em] text-white/30 mb-2">Price (SOL)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Min 0.001"
                  className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.07] text-white/90 placeholder:text-white/20 transition-all duration-300"
                />
                <span className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white/40">
                  SOL
                </span>
              </div>
              <p className="text-xs text-white/30 mt-2">
                Minimum price is 0.001 SOL (free minting not allowed)
              </p>
            </div>

            {/* Supply */}
            <div>
              <label className="block text-[11px] uppercase tracking-[0.2em] text-white/30 mb-3">Supply</label>
              {/* When editing existing config with limited supply, can only change the number, not switch to unlimited */}
              {existingConfig && existingConfig.maxSupply !== null ? (
                <>
                  <input
                    type="number"
                    min="1"
                    value={maxSupply}
                    onChange={(e) => setMaxSupply(e.target.value)}
                    placeholder="Max supply (e.g., 100)"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.07] text-white/90 placeholder:text-white/20 transition-all duration-300"
                  />
                  <p className="text-xs text-white/30 mt-2">
                    Limited supply cannot be changed to unlimited after creation
                  </p>
                </>
              ) : existingConfig && existingConfig.maxSupply === null ? (
                <>
                  <div className="flex gap-3 mb-3">
                    <button
                      type="button"
                      onClick={() => setSupplyType("unlimited")}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300 text-sm ${
                        supplyType === "unlimited"
                          ? "bg-purple-500/20 border border-purple-500/50 text-purple-300"
                          : "bg-white/[0.02] border border-white/10 text-white/50 hover:bg-white/5"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        supplyType === "unlimited" ? "border-purple-400" : "border-white/30"
                      }`}>
                        {supplyType === "unlimited" && <div className="w-2 h-2 rounded-full bg-purple-400" />}
                      </div>
                      Unlimited
                    </button>
                    <button
                      type="button"
                      onClick={() => setSupplyType("limited")}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300 text-sm ${
                        supplyType === "limited"
                          ? "bg-purple-500/20 border border-purple-500/50 text-purple-300"
                          : "bg-white/[0.02] border border-white/10 text-white/50 hover:bg-white/5"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        supplyType === "limited" ? "border-purple-400" : "border-white/30"
                      }`}>
                        {supplyType === "limited" && <div className="w-2 h-2 rounded-full bg-purple-400" />}
                      </div>
                      Limited
                    </button>
                  </div>
                  {supplyType === "limited" && (
                    <input
                      type="number"
                      min="1"
                      value={maxSupply}
                      onChange={(e) => setMaxSupply(e.target.value)}
                      placeholder="Max supply (e.g., 100)"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.07] text-white/90 placeholder:text-white/20 transition-all duration-300"
                    />
                  )}
                  <p className="text-xs text-white/30 mt-2">
                    You can set a cap on unlimited supply
                  </p>
                </>
              ) : (
                <>
                  <div className="flex gap-3 mb-3">
                    <button
                      type="button"
                      onClick={() => setSupplyType("unlimited")}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300 text-sm ${
                        supplyType === "unlimited"
                          ? "bg-purple-500/20 border border-purple-500/50 text-purple-300"
                          : "bg-white/[0.02] border border-white/10 text-white/50 hover:bg-white/5"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        supplyType === "unlimited" ? "border-purple-400" : "border-white/30"
                      }`}>
                        {supplyType === "unlimited" && <div className="w-2 h-2 rounded-full bg-purple-400" />}
                      </div>
                      Unlimited
                    </button>
                    <button
                      type="button"
                      onClick={() => setSupplyType("limited")}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300 text-sm ${
                        supplyType === "limited"
                          ? "bg-purple-500/20 border border-purple-500/50 text-purple-300"
                          : "bg-white/[0.02] border border-white/10 text-white/50 hover:bg-white/5"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        supplyType === "limited" ? "border-purple-400" : "border-white/30"
                      }`}>
                        {supplyType === "limited" && <div className="w-2 h-2 rounded-full bg-purple-400" />}
                      </div>
                      Limited
                    </button>
                  </div>
                  {supplyType === "limited" && (
                    <input
                      type="number"
                      min="1"
                      value={maxSupply}
                      onChange={(e) => setMaxSupply(e.target.value)}
                      placeholder="Max supply (e.g., 100)"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.07] text-white/90 placeholder:text-white/20 transition-all duration-300"
                    />
                  )}
                </>
              )}
            </div>

            {/* Royalty - Fixed at 4% */}
            <div>
              <label className="block text-[11px] uppercase tracking-[0.2em] text-white/30 mb-2">
                Secondary Sale Royalty
              </label>
              <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white/80">
                {royaltyPercent}% (fixed)
              </div>
              <p className="text-xs text-white/30 mt-2">
                Creator royalty is fixed at 4% on all secondary sales
              </p>
            </div>

            {/* Revenue Split Info */}
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
              <h3 className="text-[11px] uppercase tracking-[0.15em] text-white/30 mb-3">Primary Sale Split</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/40">Creator (you)</span>
                  <span className="text-emerald-400 font-medium">80%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Existing Holders</span>
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
              <p className="text-xs text-white/30 mt-3">
                First mint: 12% holder reward goes to creator
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-3 bg-purple-500/20 hover:bg-purple-500/30 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl font-medium transition-all duration-300 border border-purple-500/30 hover:border-purple-500/50 text-white/90"
            >
              {isSaving ? "Saving..." : "Save Settings"}
            </button>
          </form>
          )}
        </div>
      </div>
    </div>
  );
}
