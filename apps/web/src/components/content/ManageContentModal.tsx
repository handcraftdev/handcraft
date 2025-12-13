"use client";

import { useState, useEffect } from "react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { getIpfsUrl, getContentTypeLabel } from "@handcraft/sdk";
import {
  useContentRegistry,
  ContentEntry,
  MIN_PRICE_LAMPORTS,
  MIN_RENT_FEE_LAMPORTS,
} from "@/hooks/useContentRegistry";
import { getTransactionErrorMessage } from "@/utils/wallet-errors";

interface ManageContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: ContentEntry;
  onSuccess?: () => void;
}

type SettingsTab = "details" | "mint" | "rent";

interface ContentMetadata {
  title?: string;
  name?: string;
  description?: string;
  image?: string;
  tags?: string[];
}

export function ManageContentModal({
  isOpen,
  onClose,
  content,
  onSuccess,
}: ManageContentModalProps) {
  const { publicKey } = useWallet();
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("details");
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<ContentMetadata | null>(null);

  // Mint config state
  const [mintPrice, setMintPrice] = useState("0.1");
  const [mintSupplyType, setMintSupplyType] = useState<"unlimited" | "limited">("unlimited");
  const [mintMaxSupply, setMintMaxSupply] = useState("");
  const [mintRoyaltyPercent, setMintRoyaltyPercent] = useState("5");

  // Rent config state
  const [rentFee6h, setRentFee6h] = useState("0.01");
  const [rentFee1d, setRentFee1d] = useState("0.03");
  const [rentFee7d, setRentFee7d] = useState("0.15");

  const {
    useMintConfig,
    useRentConfig,
    configureMint,
    updateMintSettings,
    configureRent,
    updateRentConfig,
    isConfiguringMint,
    isUpdatingMintSettings,
    isConfiguringRent,
    isUpdatingRentConfig,
  } = useContentRegistry();

  // Fetch mint/rent configs
  const mintConfigQuery = useMintConfig(content.contentCid);
  const rentConfigQuery = useRentConfig(content.contentCid);

  const mintConfig = mintConfigQuery.data;
  const rentConfig = rentConfigQuery.data;

  const isLocked = content.isLocked || Number(content.mintedCount ?? 0) > 0;
  const actualMintedCount = Number(content.mintedCount ?? 0);

  // Fetch metadata from IPFS
  useEffect(() => {
    async function fetchMetadata() {
      if (!content.metadataCid) return;
      try {
        const url = getIpfsUrl(content.metadataCid);
        const res = await fetch(url);
        if (res.ok) {
          const meta = await res.json();
          setMetadata(meta);
        }
      } catch (e) {
        console.error("Failed to fetch content metadata:", e);
      }
    }
    fetchMetadata();
  }, [content.metadataCid]);

  // Initialize form values from existing configs
  useEffect(() => {
    if (mintConfig) {
      setMintPrice((Number(mintConfig.priceSol) / LAMPORTS_PER_SOL).toString());
      if (mintConfig.maxSupply !== null && mintConfig.maxSupply !== undefined) {
        setMintSupplyType("limited");
        setMintMaxSupply(mintConfig.maxSupply.toString());
      } else {
        setMintSupplyType("unlimited");
        setMintMaxSupply("");
      }
      setMintRoyaltyPercent((mintConfig.creatorRoyaltyBps / 100).toString());
    }
  }, [mintConfig]);

  useEffect(() => {
    if (rentConfig) {
      setRentFee6h((Number(rentConfig.rentFee6h) / LAMPORTS_PER_SOL).toString());
      setRentFee1d((Number(rentConfig.rentFee1d) / LAMPORTS_PER_SOL).toString());
      setRentFee7d((Number(rentConfig.rentFee7d) / LAMPORTS_PER_SOL).toString());
    }
  }, [rentConfig]);

  // Handle toggle mint active
  const handleToggleMintActive = async () => {
    if (!mintConfig) return;
    setError(null);
    try {
      await updateMintSettings({
        contentCid: content.contentCid,
        price: null,
        maxSupply: undefined,
        creatorRoyaltyBps: null,
        isActive: !mintConfig.isActive,
      });
      mintConfigQuery.refetch();
      onSuccess?.();
    } catch (err) {
      setError(getTransactionErrorMessage(err));
    }
  };

  // Handle configure/update mint settings
  const handleSaveMintSettings = async () => {
    setError(null);

    const royaltyNum = parseFloat(mintRoyaltyPercent);
    if (isNaN(royaltyNum) || royaltyNum < 2 || royaltyNum > 10) {
      setError("Royalty must be between 2% and 10%");
      return;
    }

    try {
      const priceLamports = BigInt(Math.floor(parseFloat(mintPrice) * LAMPORTS_PER_SOL));
      if (priceLamports > 0 && priceLamports < BigInt(MIN_PRICE_LAMPORTS)) {
        setError(`Minimum price is ${MIN_PRICE_LAMPORTS / LAMPORTS_PER_SOL} SOL`);
        return;
      }

      const maxSupplyValue = mintSupplyType === "limited" && mintMaxSupply
        ? BigInt(mintMaxSupply)
        : null;
      const royaltyBps = Math.floor(royaltyNum * 100);

      if (mintConfig) {
        // Update existing
        await updateMintSettings({
          contentCid: content.contentCid,
          price: priceLamports,
          maxSupply: maxSupplyValue === null ? undefined : maxSupplyValue,
          creatorRoyaltyBps: isLocked ? null : royaltyBps,
          isActive: mintConfig.isActive,
        });
      } else {
        // Create new
        await configureMint({
          contentCid: content.contentCid,
          price: priceLamports,
          maxSupply: maxSupplyValue,
          creatorRoyaltyBps: royaltyBps,
        });
      }
      mintConfigQuery.refetch();
      onSuccess?.();
    } catch (err) {
      setError(getTransactionErrorMessage(err));
    }
  };

  // Handle toggle rent active
  const handleToggleRentActive = async () => {
    if (!rentConfig) return;
    setError(null);
    try {
      await updateRentConfig({
        contentCid: content.contentCid,
        rentFee6h: null,
        rentFee1d: null,
        rentFee7d: null,
        isActive: !rentConfig.isActive,
      });
      rentConfigQuery.refetch();
      onSuccess?.();
    } catch (err) {
      setError(getTransactionErrorMessage(err));
    }
  };

  // Handle configure/update rent config
  const handleSaveRentConfig = async () => {
    setError(null);

    try {
      const fee6h = BigInt(Math.floor(parseFloat(rentFee6h) * LAMPORTS_PER_SOL));
      const fee1d = BigInt(Math.floor(parseFloat(rentFee1d) * LAMPORTS_PER_SOL));
      const fee7d = BigInt(Math.floor(parseFloat(rentFee7d) * LAMPORTS_PER_SOL));

      const minFee = BigInt(MIN_RENT_FEE_LAMPORTS);
      if (fee6h < minFee || fee1d < minFee || fee7d < minFee) {
        setError(`Minimum rent fee is ${MIN_RENT_FEE_LAMPORTS / LAMPORTS_PER_SOL} SOL`);
        return;
      }

      if (rentConfig) {
        await updateRentConfig({
          contentCid: content.contentCid,
          rentFee6h: fee6h,
          rentFee1d: fee1d,
          rentFee7d: fee7d,
          isActive: rentConfig.isActive,
        });
      } else {
        await configureRent({
          contentCid: content.contentCid,
          rentFee6h: fee6h,
          rentFee1d: fee1d,
          rentFee7d: fee7d,
        });
      }
      rentConfigQuery.refetch();
      onSuccess?.();
    } catch (err) {
      setError(getTransactionErrorMessage(err));
    }
  };

  const isLoading = isConfiguringMint || isUpdatingMintSettings || isConfiguringRent || isUpdatingRentConfig;

  if (!isOpen) return null;

  const contentTitle = metadata?.title || metadata?.name || content.contentCid.slice(0, 16) + "...";
  const contentTypeLabel = getContentTypeLabel(content.contentType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-black border border-white/10 rounded-2xl w-full max-w-lg p-6 m-4 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none rounded-2xl" />

        <div className="relative flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-medium text-white/90">{contentTitle}</h2>
              <p className="text-sm text-white/40">{contentTypeLabel}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded-full transition-all duration-300 text-white/40 hover:text-white/70"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Settings Sub-tabs */}
          <div className="flex gap-1 p-1 bg-white/[0.02] rounded-xl mb-5 border border-white/5">
            <button
              onClick={() => setSettingsTab("details")}
              className={`flex-1 py-2.5 text-center text-sm font-medium rounded-lg transition-all duration-300 ${
                settingsTab === "details"
                  ? "bg-white/10 text-white/90"
                  : "text-white/40 hover:text-white/60 hover:bg-white/5"
              }`}
            >
              Details
            </button>
            <button
              onClick={() => setSettingsTab("mint")}
              className={`flex-1 py-2.5 text-center text-sm font-medium rounded-lg transition-all duration-300 ${
                settingsTab === "mint"
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                  : "text-white/40 hover:text-white/60 hover:bg-white/5"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                Mint
                {mintConfig && (
                  <span className={`w-1.5 h-1.5 rounded-full ${mintConfig.isActive ? "bg-emerald-400" : "bg-white/30"}`} />
                )}
              </div>
            </button>
            <button
              onClick={() => setSettingsTab("rent")}
              className={`flex-1 py-2.5 text-center text-sm font-medium rounded-lg transition-all duration-300 ${
                settingsTab === "rent"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  : "text-white/40 hover:text-white/60 hover:bg-white/5"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                Rent
                {rentConfig && (
                  <span className={`w-1.5 h-1.5 rounded-full ${rentConfig.isActive ? "bg-emerald-400" : "bg-white/30"}`} />
                )}
              </div>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm mb-4">
                {error}
              </div>
            )}

            {/* Details Tab */}
            {settingsTab === "details" && (
              <div className="space-y-3">
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                  <h3 className="text-[11px] uppercase tracking-[0.15em] text-white/30 mb-2">Content CID</h3>
                  <p className="text-sm text-white/60 font-mono break-all">{content.contentCid}</p>
                </div>

                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                  <h3 className="text-[11px] uppercase tracking-[0.15em] text-white/30 mb-2">Content Type</h3>
                  <p className="text-sm text-white/60">{contentTypeLabel}</p>
                </div>

                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                  <h3 className="text-[11px] uppercase tracking-[0.15em] text-white/30 mb-2">Encryption</h3>
                  <p className="text-sm text-white/60">
                    {content.isEncrypted ? "Encrypted - requires NFT ownership or rental" : "Public - accessible to everyone"}
                  </p>
                </div>

                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                  <h3 className="text-[11px] uppercase tracking-[0.15em] text-white/30 mb-2">Lock Status</h3>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${isLocked ? "bg-amber-400" : "bg-emerald-400"}`} />
                    <p className="text-sm text-white/60">
                      {isLocked ? "Locked - content cannot be modified" : "Unlocked - content can be modified"}
                    </p>
                  </div>
                </div>

                {actualMintedCount > 0 && (
                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                    <h3 className="text-[11px] uppercase tracking-[0.15em] text-white/30 mb-2">Editions Minted</h3>
                    <p className="text-sm text-purple-400 font-medium">{actualMintedCount} NFTs</p>
                  </div>
                )}
              </div>
            )}

            {/* Mint Tab */}
            {settingsTab === "mint" && (
              <div className="space-y-4">
                {mintConfig ? (
                  <>
                    {/* Mint Status */}
                    <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-white/80">Minting Status</p>
                        <p className="text-xs text-white/40 mt-0.5">
                          {mintConfig.isActive ? "Active - users can mint NFTs" : "Paused - minting is disabled"}
                        </p>
                      </div>
                      <button
                        onClick={handleToggleMintActive}
                        disabled={isLoading}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                          mintConfig.isActive
                            ? "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40"
                            : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40"
                        } disabled:opacity-30`}
                      >
                        {mintConfig.isActive ? "Pause" : "Enable"}
                      </button>
                    </div>

                    {/* Mint Price */}
                    <div>
                      <label className="block text-[11px] uppercase tracking-[0.2em] text-white/30 mb-2">
                        Price (SOL)
                      </label>
                      <input
                        type="number"
                        value={mintPrice}
                        onChange={(e) => setMintPrice(e.target.value)}
                        min="0"
                        step="0.01"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.07] text-white/90 placeholder:text-white/20 transition-all duration-300"
                      />
                    </div>

                    {/* Max Supply */}
                    <div>
                      <label className="block text-[11px] uppercase tracking-[0.2em] text-white/30 mb-2">
                        Max Supply
                      </label>
                      {mintConfig.maxSupply !== null ? (
                        <>
                          <input
                            type="number"
                            value={mintMaxSupply}
                            onChange={(e) => setMintMaxSupply(e.target.value)}
                            min="1"
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.07] text-white/90 placeholder:text-white/20 transition-all duration-300"
                          />
                          <p className="text-xs text-white/30 mt-2">
                            Limited supply cannot be changed to unlimited
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="flex gap-3 mb-3">
                            <button
                              type="button"
                              onClick={() => setMintSupplyType("unlimited")}
                              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300 text-sm ${
                                mintSupplyType === "unlimited"
                                  ? "bg-purple-500/20 border border-purple-500/50 text-purple-300"
                                  : "bg-white/[0.02] border border-white/10 text-white/50 hover:bg-white/5"
                              }`}
                            >
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                mintSupplyType === "unlimited" ? "border-purple-400" : "border-white/30"
                              }`}>
                                {mintSupplyType === "unlimited" && <div className="w-2 h-2 rounded-full bg-purple-400" />}
                              </div>
                              Unlimited
                            </button>
                            <button
                              type="button"
                              onClick={() => setMintSupplyType("limited")}
                              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300 text-sm ${
                                mintSupplyType === "limited"
                                  ? "bg-purple-500/20 border border-purple-500/50 text-purple-300"
                                  : "bg-white/[0.02] border border-white/10 text-white/50 hover:bg-white/5"
                              }`}
                            >
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                mintSupplyType === "limited" ? "border-purple-400" : "border-white/30"
                              }`}>
                                {mintSupplyType === "limited" && <div className="w-2 h-2 rounded-full bg-purple-400" />}
                              </div>
                              Limited
                            </button>
                          </div>
                          {mintSupplyType === "limited" && (
                            <input
                              type="number"
                              value={mintMaxSupply}
                              onChange={(e) => setMintMaxSupply(e.target.value)}
                              min="1"
                              placeholder="Max supply (e.g., 100)"
                              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.07] text-white/90 placeholder:text-white/20 transition-all duration-300"
                            />
                          )}
                        </>
                      )}
                    </div>

                    {/* Royalty Slider */}
                    <div>
                      <label className="block text-[11px] uppercase tracking-[0.2em] text-white/30 mb-2">
                        Secondary Sale Royalty
                      </label>
                      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-white/90 font-medium">{mintRoyaltyPercent}%</span>
                          {isLocked && (
                            <span className="text-xs text-amber-400/70">Locked</span>
                          )}
                        </div>
                        <input
                          type="range"
                          min="2"
                          max="10"
                          step="0.5"
                          value={mintRoyaltyPercent}
                          onChange={(e) => setMintRoyaltyPercent(e.target.value)}
                          disabled={isLocked}
                          className={`w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer
                            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-400
                            [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-all
                            [&::-webkit-slider-thumb]:hover:bg-purple-300 ${isLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                        />
                        <div className="flex justify-between text-xs text-white/30 mt-2">
                          <span>2%</span>
                          <span>10%</span>
                        </div>
                      </div>
                      {isLocked && (
                        <p className="text-xs text-white/30 mt-2">
                          Royalty cannot be changed after NFTs have been minted
                        </p>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                      <h3 className="text-[11px] uppercase tracking-[0.15em] text-white/30 mb-2">Minted</h3>
                      <p className="text-sm text-purple-400 font-medium">
                        {actualMintedCount}
                        {mintConfig.maxSupply && ` / ${mintConfig.maxSupply.toString()}`}
                      </p>
                    </div>

                    <button
                      onClick={handleSaveMintSettings}
                      disabled={isLoading}
                      className="w-full py-3 bg-purple-500/20 hover:bg-purple-500/30 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl font-medium transition-all duration-300 border border-purple-500/30 hover:border-purple-500/50 text-white/90"
                    >
                      {isUpdatingMintSettings ? "Saving..." : "Update Mint Settings"}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-white/40 mb-4 text-sm">Set up NFT minting for this content.</p>

                    {/* Mint Price */}
                    <div>
                      <label className="block text-[11px] uppercase tracking-[0.2em] text-white/30 mb-2">
                        Price (SOL)
                      </label>
                      <input
                        type="number"
                        value={mintPrice}
                        onChange={(e) => setMintPrice(e.target.value)}
                        min="0"
                        step="0.01"
                        placeholder="0 for free"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.07] text-white/90 placeholder:text-white/20 transition-all duration-300"
                      />
                    </div>

                    {/* Supply */}
                    <div>
                      <label className="block text-[11px] uppercase tracking-[0.2em] text-white/30 mb-2">
                        Supply
                      </label>
                      <div className="flex gap-3 mb-3">
                        <button
                          type="button"
                          onClick={() => setMintSupplyType("unlimited")}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300 text-sm ${
                            mintSupplyType === "unlimited"
                              ? "bg-purple-500/20 border border-purple-500/50 text-purple-300"
                              : "bg-white/[0.02] border border-white/10 text-white/50 hover:bg-white/5"
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            mintSupplyType === "unlimited" ? "border-purple-400" : "border-white/30"
                          }`}>
                            {mintSupplyType === "unlimited" && <div className="w-2 h-2 rounded-full bg-purple-400" />}
                          </div>
                          Unlimited
                        </button>
                        <button
                          type="button"
                          onClick={() => setMintSupplyType("limited")}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300 text-sm ${
                            mintSupplyType === "limited"
                              ? "bg-purple-500/20 border border-purple-500/50 text-purple-300"
                              : "bg-white/[0.02] border border-white/10 text-white/50 hover:bg-white/5"
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            mintSupplyType === "limited" ? "border-purple-400" : "border-white/30"
                          }`}>
                            {mintSupplyType === "limited" && <div className="w-2 h-2 rounded-full bg-purple-400" />}
                          </div>
                          Limited
                        </button>
                      </div>
                      {mintSupplyType === "limited" && (
                        <input
                          type="number"
                          value={mintMaxSupply}
                          onChange={(e) => setMintMaxSupply(e.target.value)}
                          min="1"
                          placeholder="Max supply (e.g., 100)"
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.07] text-white/90 placeholder:text-white/20 transition-all duration-300"
                        />
                      )}
                    </div>

                    {/* Royalty */}
                    <div>
                      <label className="block text-[11px] uppercase tracking-[0.2em] text-white/30 mb-2">
                        Secondary Sale Royalty
                      </label>
                      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-white/90 font-medium">{mintRoyaltyPercent}%</span>
                        </div>
                        <input
                          type="range"
                          min="2"
                          max="10"
                          step="0.5"
                          value={mintRoyaltyPercent}
                          onChange={(e) => setMintRoyaltyPercent(e.target.value)}
                          className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer
                            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-400
                            [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-all
                            [&::-webkit-slider-thumb]:hover:bg-purple-300"
                        />
                        <div className="flex justify-between text-xs text-white/30 mt-2">
                          <span>2%</span>
                          <span>10%</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleSaveMintSettings}
                      disabled={isLoading}
                      className="w-full py-3 bg-purple-500/20 hover:bg-purple-500/30 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl font-medium transition-all duration-300 border border-purple-500/30 hover:border-purple-500/50 text-white/90"
                    >
                      {isConfiguringMint ? "Setting Up..." : "Enable Minting"}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Rent Tab */}
            {settingsTab === "rent" && (
              <div className="space-y-4">
                {!mintConfig ? (
                  <div className="text-center py-12">
                    <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                      <svg className="w-6 h-6 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <p className="text-white/40 text-sm">Set up NFT minting first before enabling rentals.</p>
                    <button
                      onClick={() => setSettingsTab("mint")}
                      className="mt-4 px-4 py-2 text-sm text-purple-400 hover:text-purple-300 transition-colors duration-300"
                    >
                      Go to Mint settings
                    </button>
                  </div>
                ) : rentConfig ? (
                  <>
                    {/* Rent Status */}
                    <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-white/80">Rental Status</p>
                        <p className="text-xs text-white/40 mt-0.5">
                          {rentConfig.isActive ? "Active - users can rent access" : "Paused - rentals are disabled"}
                        </p>
                      </div>
                      <button
                        onClick={handleToggleRentActive}
                        disabled={isLoading}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                          rentConfig.isActive
                            ? "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40"
                            : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40"
                        } disabled:opacity-30`}
                      >
                        {rentConfig.isActive ? "Pause" : "Enable"}
                      </button>
                    </div>

                    {/* Rent Fees */}
                    <div>
                      <label className="block text-[11px] uppercase tracking-[0.2em] text-white/30 mb-3">
                        Rental Pricing (SOL)
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-white/40 mb-2">6 Hours</label>
                          <input
                            type="number"
                            value={rentFee6h}
                            onChange={(e) => setRentFee6h(e.target.value)}
                            min="0.001"
                            step="0.001"
                            className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-amber-500/50 focus:bg-white/[0.07] text-white/90 placeholder:text-white/20 transition-all duration-300 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-white/40 mb-2">1 Day</label>
                          <input
                            type="number"
                            value={rentFee1d}
                            onChange={(e) => setRentFee1d(e.target.value)}
                            min="0.001"
                            step="0.001"
                            className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-amber-500/50 focus:bg-white/[0.07] text-white/90 placeholder:text-white/20 transition-all duration-300 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-white/40 mb-2">7 Days</label>
                          <input
                            type="number"
                            value={rentFee7d}
                            onChange={(e) => setRentFee7d(e.target.value)}
                            min="0.001"
                            step="0.001"
                            className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-amber-500/50 focus:bg-white/[0.07] text-white/90 placeholder:text-white/20 transition-all duration-300 text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl space-y-2">
                      <div className="flex justify-between">
                        <span className="text-xs text-white/40">Total Rentals</span>
                        <span className="text-sm text-amber-400 font-medium">{rentConfig.totalRentals?.toString() || "0"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-white/40">Fees Collected</span>
                        <span className="text-sm text-amber-400 font-medium">{(Number(rentConfig.totalFeesCollected || 0) / LAMPORTS_PER_SOL).toFixed(4)} SOL</span>
                      </div>
                    </div>

                    <button
                      onClick={handleSaveRentConfig}
                      disabled={isLoading}
                      className="w-full py-3 bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl font-medium transition-all duration-300 border border-amber-500/30 hover:border-amber-500/50 text-white/90"
                    >
                      {isUpdatingRentConfig ? "Saving..." : "Update Rent Pricing"}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-white/40 mb-4 text-sm">Set up rental pricing for this content.</p>

                    {/* Rent Fees */}
                    <div>
                      <label className="block text-[11px] uppercase tracking-[0.2em] text-white/30 mb-3">
                        Rental Pricing (SOL)
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-white/40 mb-2">6 Hours</label>
                          <input
                            type="number"
                            value={rentFee6h}
                            onChange={(e) => setRentFee6h(e.target.value)}
                            min="0.001"
                            step="0.001"
                            placeholder="0.01"
                            className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-amber-500/50 focus:bg-white/[0.07] text-white/90 placeholder:text-white/20 transition-all duration-300 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-white/40 mb-2">1 Day</label>
                          <input
                            type="number"
                            value={rentFee1d}
                            onChange={(e) => setRentFee1d(e.target.value)}
                            min="0.001"
                            step="0.001"
                            placeholder="0.03"
                            className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-amber-500/50 focus:bg-white/[0.07] text-white/90 placeholder:text-white/20 transition-all duration-300 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-white/40 mb-2">7 Days</label>
                          <input
                            type="number"
                            value={rentFee7d}
                            onChange={(e) => setRentFee7d(e.target.value)}
                            min="0.001"
                            step="0.001"
                            placeholder="0.15"
                            className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-amber-500/50 focus:bg-white/[0.07] text-white/90 placeholder:text-white/20 transition-all duration-300 text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleSaveRentConfig}
                      disabled={isLoading}
                      className="w-full py-3 bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl font-medium transition-all duration-300 border border-amber-500/30 hover:border-amber-500/50 text-white/90"
                    >
                      {isConfiguringRent ? "Setting Up..." : "Enable Rentals"}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end mt-5 pt-4 border-t border-white/5">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl font-medium transition-all duration-300 text-white/70 hover:text-white/90"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
