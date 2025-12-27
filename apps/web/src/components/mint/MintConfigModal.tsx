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
        setError("Price is required");
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
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />

      <div className="relative bg-black border border-white/[0.08] rounded-lg w-full max-w-sm p-4 m-4 max-h-[90vh] overflow-y-auto">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none rounded-lg" />

        <div className="relative">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-white/90">Content Settings</h2>
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
              {existingConfig ? "Editing" : "Setting up"} buying for: <span className="text-white/80">{contentTitle}</span>
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
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Price */}
            <div>
              <label className="block text-2xs uppercase tracking-[0.15em] text-white/30 mb-1.5">Price (SOL)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Min 0.001"
                  className="flex-1 px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-base focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.06] text-white/90 placeholder:text-white/20 transition-all"
                />
                <span className="px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-base text-white/40">
                  SOL
                </span>
              </div>
              <p className="text-sm text-white/30 mt-1.5">
                Minimum price is 0.001 SOL
              </p>
            </div>

            {/* Supply */}
            <div>
              <label className="block text-2xs uppercase tracking-[0.15em] text-white/30 mb-2">Supply</label>
              {/* When editing existing config with limited supply, can only change the number, not switch to unlimited */}
              {existingConfig && existingConfig.maxSupply !== null ? (
                <>
                  <input
                    type="number"
                    min="1"
                    max="999999"
                    value={maxSupply}
                    onChange={(e) => setMaxSupply(e.target.value)}
                    placeholder="Max supply (max 999,999)"
                    className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-base focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.06] text-white/90 placeholder:text-white/20 transition-all"
                  />
                  <p className="text-sm text-white/30 mt-1.5">
                    Limited supply cannot be changed to unlimited
                  </p>
                </>
              ) : existingConfig && existingConfig.maxSupply === null ? (
                <>
                  <div className="flex gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setSupplyType("unlimited")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-sm ${
                        supplyType === "unlimited"
                          ? "bg-purple-500/20 border border-purple-500/50 text-purple-300"
                          : "bg-white/[0.02] border border-white/[0.08] text-white/50 hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${
                        supplyType === "unlimited" ? "border-purple-400" : "border-white/30"
                      }`}>
                        {supplyType === "unlimited" && <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />}
                      </div>
                      Unlimited
                    </button>
                    <button
                      type="button"
                      onClick={() => setSupplyType("limited")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-sm ${
                        supplyType === "limited"
                          ? "bg-purple-500/20 border border-purple-500/50 text-purple-300"
                          : "bg-white/[0.02] border border-white/[0.08] text-white/50 hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${
                        supplyType === "limited" ? "border-purple-400" : "border-white/30"
                      }`}>
                        {supplyType === "limited" && <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />}
                      </div>
                      Limited
                    </button>
                  </div>
                  {supplyType === "limited" && (
                    <input
                      type="number"
                      min="1"
                      max="999999"
                      value={maxSupply}
                      onChange={(e) => setMaxSupply(e.target.value)}
                      placeholder="Max supply (max 999,999)"
                      className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-base focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.06] text-white/90 placeholder:text-white/20 transition-all"
                    />
                  )}
                  <p className="text-sm text-white/30 mt-1.5">
                    You can set a cap on unlimited supply
                  </p>
                </>
              ) : (
                <>
                  <div className="flex gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setSupplyType("unlimited")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-sm ${
                        supplyType === "unlimited"
                          ? "bg-purple-500/20 border border-purple-500/50 text-purple-300"
                          : "bg-white/[0.02] border border-white/[0.08] text-white/50 hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${
                        supplyType === "unlimited" ? "border-purple-400" : "border-white/30"
                      }`}>
                        {supplyType === "unlimited" && <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />}
                      </div>
                      Unlimited
                    </button>
                    <button
                      type="button"
                      onClick={() => setSupplyType("limited")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-sm ${
                        supplyType === "limited"
                          ? "bg-purple-500/20 border border-purple-500/50 text-purple-300"
                          : "bg-white/[0.02] border border-white/[0.08] text-white/50 hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${
                        supplyType === "limited" ? "border-purple-400" : "border-white/30"
                      }`}>
                        {supplyType === "limited" && <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />}
                      </div>
                      Limited
                    </button>
                  </div>
                  {supplyType === "limited" && (
                    <input
                      type="number"
                      min="1"
                      max="999999"
                      value={maxSupply}
                      onChange={(e) => setMaxSupply(e.target.value)}
                      placeholder="Max supply (max 999,999)"
                      className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-base focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.06] text-white/90 placeholder:text-white/20 transition-all"
                    />
                  )}
                </>
              )}
            </div>

            {/* Revenue Split Info */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3">
              <h3 className="text-2xs uppercase tracking-[0.15em] text-white/30 mb-2">Primary Sale Split</h3>
              <div className="space-y-1 text-sm">
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
              <p className="text-2xs text-white/30 mt-2">
                First mint: 12% holder reward goes to creator
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2.5 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-2 bg-purple-500/20 hover:bg-purple-500/30 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-base font-medium transition-all border border-purple-500/30 text-white/90"
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
