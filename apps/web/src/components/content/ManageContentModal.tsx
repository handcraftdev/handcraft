"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { getIpfsUrl, getContentTypeLabel, VisibilityLevel, ContentType } from "@handcraft/sdk";
import {
  useContentRegistry,
  ContentEntry,
  MIN_PRICE_LAMPORTS,
  MIN_RENT_FEE_LAMPORTS,
  FIXED_CREATOR_ROYALTY_BPS,
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
  // Royalty is now fixed at 4%
  const fixedRoyaltyPercent = FIXED_CREATOR_ROYALTY_BPS / 100;

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
  // contentCid may be undefined for new optimized ContentEntry structure
  const mintConfigQuery = useMintConfig(content.contentCid ?? null);
  const rentConfigQuery = useRentConfig(content.contentCid ?? null);

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
      // Royalty is now fixed at 4%, no need to set from existing config
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
    if (!content.contentCid) {
      setError("Content CID not available");
      return;
    }
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
    if (!content.contentCid) {
      setError("Content CID not available");
      return;
    }
    setError(null);

    try {
      const priceLamports = BigInt(Math.floor(parseFloat(mintPrice) * LAMPORTS_PER_SOL));
      if (priceLamports > 0 && priceLamports < BigInt(MIN_PRICE_LAMPORTS)) {
        setError(`Minimum price is ${MIN_PRICE_LAMPORTS / LAMPORTS_PER_SOL} SOL`);
        return;
      }

      const maxSupplyValue = mintSupplyType === "limited" && mintMaxSupply
        ? BigInt(mintMaxSupply)
        : null;
      // Royalty is fixed at 4%
      const royaltyBps = FIXED_CREATOR_ROYALTY_BPS;

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
    if (!content.contentCid) {
      setError("Content CID not available");
      return;
    }
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
    if (!content.contentCid) {
      setError("Content CID not available");
      return;
    }
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

  const contentTitle = metadata?.title || metadata?.name || (content.contentCid?.slice(0, 16) ?? content.pubkey?.toBase58().slice(0, 16) ?? "Unknown") + "...";
  const contentTypeLabel = content.contentType !== undefined ? getContentTypeLabel(content.contentType as ContentType) : "Content";

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
                Buy
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
                  <p className="text-sm text-white/60 font-mono break-all">{content.contentCid ?? "N/A"}</p>
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
                  <h3 className="text-[11px] uppercase tracking-[0.15em] text-white/30 mb-2">Content Visibility</h3>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-xs flex items-center gap-1.5 ${
                      content.visibilityLevel === 3 /* NftOnly */
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        : content.visibilityLevel === 2 /* Subscriber */
                        ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                        : content.visibilityLevel === 1 /* Ecosystem */
                        ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                        : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    }`}>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        {content.visibilityLevel === 0 ? (
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 3.03v.568c0 .334.148.65.405.864l1.068.89c.442.369.535 1.01.216 1.49l-.51.766a2.25 2.25 0 01-1.161.886l-.143.048a1.107 1.107 0 00-.57 1.664c.369.555.169 1.307-.427 1.605L9 13.125l.423 1.059a.956.956 0 01-1.652.928l-.679-.906a1.125 1.125 0 00-1.906.172L4.5 15.75l-.612.153M12.75 3.031a9 9 0 00-8.862 12.872M12.75 3.031a9 9 0 016.69 14.036m0 0l-.177-.529A2.25 2.25 0 0017.128 15H16.5l-.324-.324a1.453 1.453 0 00-2.328.377l-.036.073a1.586 1.586 0 01-.982.816l-.99.282c-.55.157-.894.702-.8 1.267l.073.438c.08.474.49.821.97.821.846 0 1.598.542 1.865 1.345l.215.643m5.276-3.67a9.012 9.012 0 01-5.276 3.67m0 0a9 9 0 01-10.275-4.835M15.75 9c0 .896-.393 1.7-1.016 2.25" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                        )}
                      </svg>
                      {content.visibilityLevel === 3 /* NftOnly */
                        ? "Buy/Rent Only"
                        : content.visibilityLevel === 2 /* Subscriber */
                        ? "Members Only"
                        : content.visibilityLevel === 1 /* Ecosystem */
                        ? "Subscriber Only"
                        : "Public"}
                    </span>
                  </div>
                  <p className="text-xs text-white/30 mt-2">
                    {content.visibilityLevel === 3 /* NftOnly */
                      ? "Only NFT owners or active renters can access"
                      : content.visibilityLevel === 2 /* Subscriber */
                      ? "Requires your membership or NFT ownership"
                      : content.visibilityLevel === 1 /* Ecosystem */
                      ? "Requires platform subscription, membership, or NFT"
                      : "Anyone can access this content"}
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

                {/* Edit Metadata Button */}
                {!isLocked && content.contentCid ? (
                  <Link
                    href={`/studio/edit/${content.contentCid}`}
                    onClick={onClose}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl font-medium transition-all duration-300 text-white/70 hover:text-white/90"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Metadata
                  </Link>
                ) : isLocked ? (
                  <div className="text-center p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                    <p className="text-xs text-amber-400/70">
                      Metadata cannot be edited after NFTs have been minted
                    </p>
                  </div>
                ) : null}
              </div>
            )}

            {/* Mint Tab */}
            {settingsTab === "mint" && (
              <div className="space-y-4">
                {mintConfig ? (
                  <>
                    {/* Buy Status */}
                    <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-white/80">Buying Status</p>
                        <p className="text-xs text-white/40 mt-0.5">
                          {mintConfig.isActive ? "Active - users can buy editions" : "Paused - buying is disabled"}
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
                            max="999999"
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.07] text-white/90 placeholder:text-white/20 transition-all duration-300"
                          />
                          <p className="text-xs text-white/30 mt-2">
                            Limited supply cannot be changed to unlimited (max 999,999)
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
                              max="999999"
                              placeholder="Max supply (max 999,999)"
                              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.07] text-white/90 placeholder:text-white/20 transition-all duration-300"
                            />
                          )}
                        </>
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
                      {isUpdatingMintSettings ? "Saving..." : "Update Buy Settings"}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-white/40 mb-4 text-sm">Set up NFT buying for this content.</p>

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
                          max="999999"
                          placeholder="Max supply (max 999,999)"
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.07] text-white/90 placeholder:text-white/20 transition-all duration-300"
                        />
                      )}
                    </div>

                    <button
                      onClick={handleSaveMintSettings}
                      disabled={isLoading}
                      className="w-full py-3 bg-purple-500/20 hover:bg-purple-500/30 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl font-medium transition-all duration-300 border border-purple-500/30 hover:border-purple-500/50 text-white/90"
                    >
                      {isConfiguringMint ? "Setting Up..." : "Enable Buying"}
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
                    <p className="text-white/40 text-sm">Set up NFT buying first before enabling rentals.</p>
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
