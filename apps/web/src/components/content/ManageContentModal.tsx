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
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />

      <div className="relative bg-gray-900 rounded-xl w-full max-w-lg p-6 m-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">{contentTitle}</h2>
            <p className="text-sm text-gray-400">{contentTypeLabel}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Settings Sub-tabs */}
        <div className="flex border-b border-gray-700 mb-4">
          <button
            onClick={() => setSettingsTab("details")}
            className={`flex-1 py-3 text-center font-medium transition-colors relative ${
              settingsTab === "details" ? "text-white" : "text-gray-400 hover:text-gray-300"
            }`}
          >
            Details
            {settingsTab === "details" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />}
          </button>
          <button
            onClick={() => setSettingsTab("mint")}
            className={`flex-1 py-3 text-center font-medium transition-colors relative ${
              settingsTab === "mint" ? "text-primary-400" : "text-gray-400 hover:text-gray-300"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              Mint
              {mintConfig && <span className={`w-2 h-2 rounded-full ${mintConfig.isActive ? "bg-green-500" : "bg-gray-500"}`} />}
            </div>
            {settingsTab === "mint" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />}
          </button>
          <button
            onClick={() => setSettingsTab("rent")}
            className={`flex-1 py-3 text-center font-medium transition-colors relative ${
              settingsTab === "rent" ? "text-amber-400" : "text-gray-400 hover:text-gray-300"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              Rent
              {rentConfig && <span className={`w-2 h-2 rounded-full ${rentConfig.isActive ? "bg-green-500" : "bg-gray-500"}`} />}
            </div>
            {settingsTab === "rent" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500" />}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-400 text-sm mb-4">
              {error}
            </div>
          )}

          {/* Details Tab */}
          {settingsTab === "details" && (
            <div className="space-y-4">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h3 className="font-medium mb-1">Content CID</h3>
                <p className="text-sm text-gray-400 font-mono break-all">{content.contentCid}</p>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-4">
                <h3 className="font-medium mb-1">Content Type</h3>
                <p className="text-sm text-gray-400">{contentTypeLabel}</p>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-4">
                <h3 className="font-medium mb-1">Encryption</h3>
                <p className="text-sm text-gray-400">
                  {content.isEncrypted ? "Encrypted - requires NFT ownership or rental" : "Public - accessible to everyone"}
                </p>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-4">
                <h3 className="font-medium mb-1">Lock Status</h3>
                <p className="text-sm text-gray-400">
                  {isLocked ? "Locked - content cannot be modified" : "Unlocked - content can be modified"}
                </p>
              </div>

              {actualMintedCount > 0 && (
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h3 className="font-medium mb-1">Minted</h3>
                  <p className="text-sm text-gray-400">{actualMintedCount} NFTs</p>
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
                  <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                    <div>
                      <p className="font-medium">Minting Status</p>
                      <p className="text-sm text-gray-400">
                        {mintConfig.isActive ? "Active - users can mint NFTs" : "Paused - minting is disabled"}
                      </p>
                    </div>
                    <button
                      onClick={handleToggleMintActive}
                      disabled={isLoading}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        mintConfig.isActive
                          ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                          : "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                      } disabled:opacity-50`}
                    >
                      {mintConfig.isActive ? "Pause Minting" : "Enable Minting"}
                    </button>
                  </div>

                  {/* Mint Price */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Price (SOL)</label>
                    <input
                      type="number"
                      value={mintPrice}
                      onChange={(e) => setMintPrice(e.target.value)}
                      min="0"
                      step="0.01"
                      className="w-full px-4 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-primary-500 focus:outline-none"
                    />
                  </div>

                  {/* Max Supply */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Max Supply</label>
                    {mintConfig.maxSupply !== null ? (
                      <input
                        type="number"
                        value={mintMaxSupply}
                        onChange={(e) => setMintMaxSupply(e.target.value)}
                        min="1"
                        className="w-full px-4 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-primary-500 focus:outline-none"
                      />
                    ) : (
                      <>
                        <div className="flex gap-4 mb-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              checked={mintSupplyType === "unlimited"}
                              onChange={() => setMintSupplyType("unlimited")}
                              className="text-primary-500"
                            />
                            <span>Unlimited</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              checked={mintSupplyType === "limited"}
                              onChange={() => setMintSupplyType("limited")}
                              className="text-primary-500"
                            />
                            <span>Limited</span>
                          </label>
                        </div>
                        {mintSupplyType === "limited" && (
                          <input
                            type="number"
                            value={mintMaxSupply}
                            onChange={(e) => setMintMaxSupply(e.target.value)}
                            min="1"
                            placeholder="Max supply (e.g., 100)"
                            className="w-full px-4 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-primary-500 focus:outline-none"
                          />
                        )}
                      </>
                    )}
                  </div>

                  {/* Royalty Slider */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Secondary Sale Royalty: {mintRoyaltyPercent}%
                    </label>
                    <input
                      type="range"
                      min="2"
                      max="10"
                      step="0.5"
                      value={mintRoyaltyPercent}
                      onChange={(e) => setMintRoyaltyPercent(e.target.value)}
                      disabled={isLocked}
                      className={`w-full ${isLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>2%</span>
                      <span>10%</span>
                    </div>
                    {isLocked && (
                      <p className="text-xs text-gray-500 mt-1">
                        Royalty cannot be changed after NFTs have been minted
                      </p>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="p-4 bg-gray-800/50 rounded-lg">
                    <p className="text-sm text-gray-400">
                      Minted: {actualMintedCount}
                      {mintConfig.maxSupply && ` / ${mintConfig.maxSupply.toString()}`}
                    </p>
                  </div>

                  <button
                    onClick={handleSaveMintSettings}
                    disabled={isLoading}
                    className="w-full py-3 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-700 rounded-lg font-medium transition-colors"
                  >
                    {isUpdatingMintSettings ? "Saving..." : "Update Mint Settings"}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-gray-400 mb-4">Set up NFT minting for this content.</p>

                  {/* Mint Price */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Price (SOL)</label>
                    <input
                      type="number"
                      value={mintPrice}
                      onChange={(e) => setMintPrice(e.target.value)}
                      min="0"
                      step="0.01"
                      placeholder="0 for free"
                      className="w-full px-4 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-primary-500 focus:outline-none"
                    />
                  </div>

                  {/* Supply */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Supply</label>
                    <div className="flex gap-4 mb-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={mintSupplyType === "unlimited"}
                          onChange={() => setMintSupplyType("unlimited")}
                          className="text-primary-500"
                        />
                        <span>Unlimited</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={mintSupplyType === "limited"}
                          onChange={() => setMintSupplyType("limited")}
                          className="text-primary-500"
                        />
                        <span>Limited</span>
                      </label>
                    </div>
                    {mintSupplyType === "limited" && (
                      <input
                        type="number"
                        value={mintMaxSupply}
                        onChange={(e) => setMintMaxSupply(e.target.value)}
                        min="1"
                        placeholder="Max supply (e.g., 100)"
                        className="w-full px-4 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-primary-500 focus:outline-none"
                      />
                    )}
                  </div>

                  {/* Royalty */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Secondary Sale Royalty: {mintRoyaltyPercent}%
                    </label>
                    <input
                      type="range"
                      min="2"
                      max="10"
                      step="0.5"
                      value={mintRoyaltyPercent}
                      onChange={(e) => setMintRoyaltyPercent(e.target.value)}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>2%</span>
                      <span>10%</span>
                    </div>
                  </div>

                  <button
                    onClick={handleSaveMintSettings}
                    disabled={isLoading}
                    className="w-full py-3 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-700 rounded-lg font-medium transition-colors"
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
                <div className="text-center py-8 text-gray-500">
                  <p>Set up NFT minting first before enabling rentals.</p>
                  <button
                    onClick={() => setSettingsTab("mint")}
                    className="mt-2 text-primary-400 hover:text-primary-300"
                  >
                    Go to Mint settings
                  </button>
                </div>
              ) : rentConfig ? (
                <>
                  {/* Rent Status */}
                  <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                    <div>
                      <p className="font-medium">Rental Status</p>
                      <p className="text-sm text-gray-400">
                        {rentConfig.isActive ? "Active - users can rent access" : "Paused - rentals are disabled"}
                      </p>
                    </div>
                    <button
                      onClick={handleToggleRentActive}
                      disabled={isLoading}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        rentConfig.isActive
                          ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                          : "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                      } disabled:opacity-50`}
                    >
                      {rentConfig.isActive ? "Pause Rentals" : "Enable Rentals"}
                    </button>
                  </div>

                  {/* Rent Fees */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">6 Hours</label>
                      <input
                        type="number"
                        value={rentFee6h}
                        onChange={(e) => setRentFee6h(e.target.value)}
                        min="0.001"
                        step="0.001"
                        className="w-full px-3 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-amber-500 focus:outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">1 Day</label>
                      <input
                        type="number"
                        value={rentFee1d}
                        onChange={(e) => setRentFee1d(e.target.value)}
                        min="0.001"
                        step="0.001"
                        className="w-full px-3 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-amber-500 focus:outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">7 Days</label>
                      <input
                        type="number"
                        value={rentFee7d}
                        onChange={(e) => setRentFee7d(e.target.value)}
                        min="0.001"
                        step="0.001"
                        className="w-full px-3 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-amber-500 focus:outline-none text-sm"
                      />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="p-4 bg-gray-800/50 rounded-lg">
                    <p className="text-sm text-gray-400">
                      Total Rentals: {rentConfig.totalRentals?.toString() || "0"}
                    </p>
                    <p className="text-sm text-gray-400">
                      Fees Collected: {(Number(rentConfig.totalFeesCollected || 0) / LAMPORTS_PER_SOL).toFixed(4)} SOL
                    </p>
                  </div>

                  <button
                    onClick={handleSaveRentConfig}
                    disabled={isLoading}
                    className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-700 rounded-lg font-medium transition-colors"
                  >
                    {isUpdatingRentConfig ? "Saving..." : "Update Rent Pricing"}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-gray-400 mb-4">Set up rental pricing for this content.</p>

                  {/* Rent Fees */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">6 Hours</label>
                      <input
                        type="number"
                        value={rentFee6h}
                        onChange={(e) => setRentFee6h(e.target.value)}
                        min="0.001"
                        step="0.001"
                        placeholder="0.01"
                        className="w-full px-3 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-amber-500 focus:outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">1 Day</label>
                      <input
                        type="number"
                        value={rentFee1d}
                        onChange={(e) => setRentFee1d(e.target.value)}
                        min="0.001"
                        step="0.001"
                        placeholder="0.03"
                        className="w-full px-3 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-amber-500 focus:outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">7 Days</label>
                      <input
                        type="number"
                        value={rentFee7d}
                        onChange={(e) => setRentFee7d(e.target.value)}
                        min="0.001"
                        step="0.001"
                        placeholder="0.15"
                        className="w-full px-3 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-amber-500 focus:outline-none text-sm"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleSaveRentConfig}
                    disabled={isLoading}
                    className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-700 rounded-lg font-medium transition-colors"
                  >
                    {isConfiguringRent ? "Setting Up..." : "Enable Rentals"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
