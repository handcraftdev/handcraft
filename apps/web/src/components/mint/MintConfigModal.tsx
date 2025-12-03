"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  useContentRegistry,
  PaymentCurrency,
  MIN_CREATOR_ROYALTY_BPS,
  MAX_CREATOR_ROYALTY_BPS,
  MIN_PRICE_LAMPORTS,
  MIN_PRICE_USDC,
} from "@/hooks/useContentRegistry";

interface MintConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentCid: string;
  contentTitle?: string;
  onSuccess?: () => void;
}

const LAMPORTS_PER_SOL = 1_000_000_000;

export function MintConfigModal({
  isOpen,
  onClose,
  contentCid,
  contentTitle,
  onSuccess,
}: MintConfigModalProps) {
  const { publicKey } = useWallet();
  const { configureMint, updateMintSettings, isConfiguringMint, isUpdatingMintSettings, useMintConfig } = useContentRegistry();
  const { data: existingConfig, isLoading: isLoadingConfig } = useMintConfig(contentCid);

  const isSaving = isConfiguringMint || isUpdatingMintSettings;

  // Form state
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<PaymentCurrency>(PaymentCurrency.Sol);
  const [supplyType, setSupplyType] = useState<"unlimited" | "limited">("unlimited");
  const [maxSupply, setMaxSupply] = useState("");
  const [royaltyPercent, setRoyaltyPercent] = useState("5");
  const [error, setError] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Load existing config values when available
  useEffect(() => {
    if (existingConfig && !hasInitialized) {
      // Set price
      if (existingConfig.price > BigInt(0)) {
        if (existingConfig.currency === PaymentCurrency.Sol) {
          setPrice((Number(existingConfig.price) / LAMPORTS_PER_SOL).toString());
        } else {
          setPrice((Number(existingConfig.price) / 1_000_000).toString());
        }
      } else {
        setPrice("");
      }

      // Set currency
      setCurrency(existingConfig.currency);

      // Set supply
      if (existingConfig.maxSupply !== null) {
        setSupplyType("limited");
        setMaxSupply(existingConfig.maxSupply.toString());
      } else {
        setSupplyType("unlimited");
        setMaxSupply("");
      }

      // Set royalty
      setRoyaltyPercent((existingConfig.creatorRoyaltyBps / 100).toString());

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
      // Parse price
      let priceValue: bigint;
      if (price === "" || price === "0") {
        priceValue = BigInt(0); // Free mint
      } else {
        const priceFloat = parseFloat(price);
        if (isNaN(priceFloat) || priceFloat < 0) {
          setError("Invalid price");
          return;
        }
        if (currency === PaymentCurrency.Sol) {
          priceValue = BigInt(Math.floor(priceFloat * LAMPORTS_PER_SOL));
          if (priceValue > 0 && priceValue < MIN_PRICE_LAMPORTS) {
            setError(`Minimum price is ${MIN_PRICE_LAMPORTS / LAMPORTS_PER_SOL} SOL`);
            return;
          }
        } else {
          priceValue = BigInt(Math.floor(priceFloat * 1_000_000)); // 6 decimals
          if (priceValue > 0 && priceValue < MIN_PRICE_USDC) {
            setError(`Minimum price is ${MIN_PRICE_USDC / 1_000_000} USDC`);
            return;
          }
        }
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

      // Parse royalty
      const royaltyFloat = parseFloat(royaltyPercent);
      if (isNaN(royaltyFloat) || royaltyFloat < 2 || royaltyFloat > 10) {
        setError("Royalty must be between 2% and 10%");
        return;
      }
      const royaltyBps = Math.floor(royaltyFloat * 100);

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
          creatorRoyaltyBps: royaltyBps,
          isActive: null, // Keep current value
        });
      } else {
        // Create new config
        await configureMint({
          contentCid,
          price: priceValue,
          currency,
          maxSupply: maxSupplyValue,
          creatorRoyaltyBps: royaltyBps,
        });
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("Failed to save mint settings:", err);
      setError(err instanceof Error ? err.message : "Failed to save mint settings");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />

      <div className="relative bg-gray-900 rounded-xl w-full max-w-md p-6 m-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">NFT Settings</h2>
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
            {existingConfig ? "Editing" : "Setting up"} NFT minting for: <span className="text-white">{contentTitle}</span>
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
          {/* Price */}
          <div>
            <label className="block text-sm font-medium mb-2">Price</label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.001"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0 for free"
                className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
              />
              <select
                value={currency}
                onChange={(e) => setCurrency(Number(e.target.value) as PaymentCurrency)}
                disabled={!!existingConfig}
                className={`px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500 ${
                  existingConfig ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                <option value={PaymentCurrency.Sol}>SOL</option>
                <option value={PaymentCurrency.Usdc}>USDC</option>
              </select>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {existingConfig
                ? "Currency cannot be changed after creation"
                : "Leave empty or 0 for free minting"}
            </p>
          </div>

          {/* Supply */}
          <div>
            <label className="block text-sm font-medium mb-2">Supply</label>
            {/* When editing existing config with limited supply, can only change the number, not switch to unlimited */}
            {existingConfig && existingConfig.maxSupply !== null ? (
              <>
                <input
                  type="number"
                  min="1"
                  value={maxSupply}
                  onChange={(e) => setMaxSupply(e.target.value)}
                  placeholder="Max supply (e.g., 100)"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Limited supply cannot be changed to unlimited after creation
                </p>
              </>
            ) : existingConfig && existingConfig.maxSupply === null ? (
              <>
                <div className="flex gap-4 mb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={supplyType === "unlimited"}
                      onChange={() => setSupplyType("unlimited")}
                      className="text-primary-500"
                    />
                    <span>Unlimited</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={supplyType === "limited"}
                      onChange={() => setSupplyType("limited")}
                      className="text-primary-500"
                    />
                    <span>Limited</span>
                  </label>
                </div>
                {supplyType === "limited" && (
                  <input
                    type="number"
                    min="1"
                    value={maxSupply}
                    onChange={(e) => setMaxSupply(e.target.value)}
                    placeholder="Max supply (e.g., 100)"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
                  />
                )}
                <p className="text-xs text-gray-500 mt-1">
                  You can set a cap on unlimited supply
                </p>
              </>
            ) : (
              <>
                <div className="flex gap-4 mb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={supplyType === "unlimited"}
                      onChange={() => setSupplyType("unlimited")}
                      className="text-primary-500"
                    />
                    <span>Unlimited</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={supplyType === "limited"}
                      onChange={() => setSupplyType("limited")}
                      className="text-primary-500"
                    />
                    <span>Limited</span>
                  </label>
                </div>
                {supplyType === "limited" && (
                  <input
                    type="number"
                    min="1"
                    value={maxSupply}
                    onChange={(e) => setMaxSupply(e.target.value)}
                    placeholder="Max supply (e.g., 100)"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
                  />
                )}
              </>
            )}
          </div>

          {/* Royalty */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Secondary Sale Royalty: {royaltyPercent}%
            </label>
            <input
              type="range"
              min="2"
              max="10"
              step="0.5"
              value={royaltyPercent}
              onChange={(e) => setRoyaltyPercent(e.target.value)}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>2%</span>
              <span>10%</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              You'll receive this percentage on every resale
            </p>
          </div>

          {/* Revenue Split Info */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-sm font-medium mb-2">Primary Sale Split</h3>
            <div className="space-y-1 text-sm text-gray-400">
              <div className="flex justify-between">
                <span>Creator (you)</span>
                <span className="text-green-400">92%</span>
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
            {isSaving ? "Saving..." : "Save Settings"}
          </button>
        </form>
        )}
      </div>
    </div>
  );
}
