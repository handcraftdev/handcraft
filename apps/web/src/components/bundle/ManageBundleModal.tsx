"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { getBundleTypeLabel, getIpfsUrl, BundleMetadata, BundleMetadataItem } from "@handcraft/sdk";
import { useContentRegistry, Bundle, ContentEntry, MIN_PRICE_LAMPORTS, MIN_RENT_FEE_LAMPORTS } from "@/hooks/useContentRegistry";
import { getTransactionErrorMessage } from "@/utils/wallet-errors";

interface ManageBundleModalProps {
  isOpen: boolean;
  onClose: () => void;
  bundle: Bundle;
  availableContent: ContentEntry[];
  onSuccess?: () => void;
}

type MainTab = "content" | "settings";
type SettingsTab = "details" | "mint" | "rent";

export function ManageBundleModal({
  isOpen,
  onClose,
  bundle,
  availableContent,
  onSuccess,
}: ManageBundleModalProps) {
  const { publicKey } = useWallet();
  const [mainTab, setMainTab] = useState<MainTab>("content");
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("details");
  const [error, setError] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [metadata, setMetadata] = useState<BundleMetadata | null>(null);
  const [orderedItems, setOrderedItems] = useState<BundleMetadataItem[]>([]);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [hasOrderChanges, setHasOrderChanges] = useState(false);

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
    useBundleWithItems,
    useBundleMintConfig,
    useBundleRentConfig,
    addBundleItem,
    removeBundleItem,
    updateBundle,
    updateBundleMintSettings,
    updateBundleRentConfig,
    isAddingBundleItem,
    isRemovingBundleItem,
    isUpdatingBundle,
    isUpdatingBundleMintSettings,
    isUpdatingBundleRentConfig,
  } = useContentRegistry();

  // Fetch bundle with items
  const bundleWithItemsQuery = useBundleWithItems(bundle.bundleId);
  const onChainItems = bundleWithItemsQuery.data?.items ?? [];

  // Use refreshed bundle data from query if available, otherwise fall back to prop
  const currentBundle = bundleWithItemsQuery.data?.bundle ?? bundle;

  // Fetch bundle mint/rent configs
  const mintConfigQuery = useBundleMintConfig(publicKey, bundle.bundleId);
  const rentConfigQuery = useBundleRentConfig(publicKey, bundle.bundleId);

  const mintConfig = mintConfigQuery.data;
  const rentConfig = rentConfigQuery.data;

  const isLocked = currentBundle.isLocked || Number(currentBundle.mintedCount ?? 0) > 0;
  const actualMintedCount = Number(currentBundle.mintedCount ?? 0);

  // Refetch configs when modal opens to ensure fresh data
  useEffect(() => {
    if (isOpen) {
      bundleWithItemsQuery.refetch();
      mintConfigQuery.refetch();
      rentConfigQuery.refetch();
    }
  }, [isOpen]);

  // Initialize form values from existing configs
  useEffect(() => {
    if (mintConfig) {
      setMintPrice((Number(mintConfig.price) / LAMPORTS_PER_SOL).toString());
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

  // Fetch metadata from IPFS
  useEffect(() => {
    async function fetchMetadata() {
      if (!bundle.metadataCid) return;
      try {
        const url = getIpfsUrl(bundle.metadataCid);
        const res = await fetch(url);
        if (res.ok) {
          const meta = await res.json() as BundleMetadata;
          setMetadata(meta);
          if (meta.items && meta.items.length > 0) {
            setOrderedItems(meta.items);
          }
        }
      } catch (e) {
        console.error("Failed to fetch bundle metadata:", e);
      }
    }
    fetchMetadata();
  }, [bundle.metadataCid]);

  // Sync ordered items when on-chain items change
  useEffect(() => {
    if (onChainItems.length === 0) return;

    // Get current on-chain CIDs
    const onChainCids = new Set(onChainItems.map(i => i.content?.contentCid).filter(Boolean));
    const orderedCids = new Set(orderedItems.map(i => i.contentCid));

    // Check if there are new items on-chain that aren't in orderedItems
    const hasNewItems = onChainItems.some(i => i.content?.contentCid && !orderedCids.has(i.content.contentCid));

    // If orderedItems is empty or has new items, rebuild from on-chain data
    if (orderedItems.length === 0 || hasNewItems) {
      // Preserve existing order for items that are still present
      const existingOrdered = orderedItems.filter(i => onChainCids.has(i.contentCid));

      // Add new items at the end
      const newItems: BundleMetadataItem[] = onChainItems
        .filter(i => i.content?.contentCid && !orderedCids.has(i.content.contentCid))
        .sort((a, b) => a.item.position - b.item.position)
        .map(item => ({
          contentCid: item.content?.contentCid || "",
        }));

      if (existingOrdered.length > 0) {
        setOrderedItems([...existingOrdered, ...newItems]);
      } else {
        // No existing order, use on-chain order
        const items: BundleMetadataItem[] = onChainItems
          .sort((a, b) => a.item.position - b.item.position)
          .map(item => ({
            contentCid: item.content?.contentCid || "",
          }))
          .filter(item => item.contentCid);
        setOrderedItems(items);
      }
    }
  }, [onChainItems]);

  const getContentForCid = useCallback((contentCid: string): ContentEntry | null => {
    const item = onChainItems.find(i => i.content?.contentCid === contentCid);
    return item?.content || null;
  }, [onChainItems]);

  const addableContent = useMemo(() => {
    // Use on-chain items as source of truth for what's in the bundle
    const bundleCids = new Set(onChainItems.map(i => i.content?.contentCid).filter(Boolean));
    return availableContent.filter(c => !bundleCids.has(c.contentCid));
  }, [onChainItems, availableContent]);

  const handleAddItem = async (contentCid: string) => {
    setError(null);
    try {
      await addBundleItem.mutateAsync({
        bundleId: bundle.bundleId,
        contentCid,
        position: orderedItems.length,
      });
      // Don't manually update orderedItems - let the query refetch handle it
      // The useEffect that syncs orderedItems from onChainItems will update it
      bundleWithItemsQuery.refetch();
      onSuccess?.();
    } catch (err) {
      setError(getTransactionErrorMessage(err));
    }
  };

  const handleRemoveItem = async (contentCid: string) => {
    setError(null);
    try {
      await removeBundleItem.mutateAsync({
        bundleId: bundle.bundleId,
        contentCid,
      });
      // Manually remove from orderedItems since we need to update the UI immediately
      setOrderedItems(prev => prev.filter(i => i.contentCid !== contentCid));
      bundleWithItemsQuery.refetch();
      onSuccess?.();
    } catch (err) {
      setError(getTransactionErrorMessage(err));
    }
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => setDraggedIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) setDragOverIndex(index);
  };
  const handleDragLeave = () => setDragOverIndex(null);
  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }
    const newItems = [...orderedItems];
    const [draggedItem] = newItems.splice(draggedIndex, 1);
    newItems.splice(dropIndex, 0, draggedItem);
    setOrderedItems(newItems);
    setHasOrderChanges(true);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };
  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleSaveOrder = async () => {
    if (!hasOrderChanges) return;
    setIsSavingOrder(true);
    setError(null);

    try {
      const updatedMetadata: BundleMetadata = {
        ...metadata,
        name: metadata?.name || bundle.bundleId,
        description: metadata?.description || "",
        bundleType: metadata?.bundleType || getBundleTypeLabel(bundle.bundleType),
        items: orderedItems,
        updatedAt: new Date().toISOString(),
      };

      const metadataRes = await fetch("/api/upload/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metadata: updatedMetadata,
          name: `bundle-${bundle.bundleId}-metadata`,
        }),
      });

      if (!metadataRes.ok) throw new Error("Failed to upload metadata");

      const { cid: newMetadataCid } = await metadataRes.json();

      await updateBundle.mutateAsync({
        bundleId: bundle.bundleId,
        metadataCid: newMetadataCid,
      });

      setMetadata(updatedMetadata);
      setHasOrderChanges(false);
      onSuccess?.();
    } catch (err) {
      setError(getTransactionErrorMessage(err));
    } finally {
      setIsSavingOrder(false);
    }
  };

  // Handle activate/deactivate bundle
  const handleToggleBundleActive = async () => {
    setError(null);
    try {
      await updateBundle.mutateAsync({
        bundleId: bundle.bundleId,
        isActive: !currentBundle.isActive,
      });
      bundleWithItemsQuery.refetch();
      onSuccess?.();
    } catch (err) {
      setError(getTransactionErrorMessage(err));
    }
  };

  // Handle toggle mint active
  const handleToggleMintActive = async () => {
    if (!mintConfig) return;
    setError(null);
    try {
      await updateBundleMintSettings.mutateAsync({
        bundleId: bundle.bundleId,
        price: null,
        maxSupply: null,
        creatorRoyaltyBps: null,
        isActive: !mintConfig.isActive,
      });
      mintConfigQuery.refetch();
      onSuccess?.();
    } catch (err) {
      setError(getTransactionErrorMessage(err));
    }
  };

  // Handle update mint settings
  const handleUpdateMintSettings = async () => {
    if (!mintConfig) return;
    setError(null);

    const royaltyNum = parseFloat(mintRoyaltyPercent);
    if (isNaN(royaltyNum) || royaltyNum < 2 || royaltyNum > 10) {
      setError("Royalty must be between 2% and 10%");
      return;
    }

    try {
      // Free minting is not allowed
      const priceFloat = parseFloat(mintPrice);
      if (isNaN(priceFloat) || priceFloat <= 0) {
        setError("Price is required. Free minting is not allowed.");
        return;
      }
      const priceLamports = BigInt(Math.floor(priceFloat * LAMPORTS_PER_SOL));
      if (priceLamports < BigInt(MIN_PRICE_LAMPORTS)) {
        setError(`Minimum price is ${MIN_PRICE_LAMPORTS / LAMPORTS_PER_SOL} SOL`);
        return;
      }

      const maxSupplyValue = mintSupplyType === "limited" && mintMaxSupply
        ? BigInt(mintMaxSupply)
        : null;
      const royaltyBps = Math.floor(royaltyNum * 100);

      await updateBundleMintSettings.mutateAsync({
        bundleId: bundle.bundleId,
        price: priceLamports,
        maxSupply: maxSupplyValue,
        creatorRoyaltyBps: isLocked ? null : royaltyBps,
        isActive: mintConfig.isActive,
      });
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
      await updateBundleRentConfig.mutateAsync({
        bundleId: bundle.bundleId,
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

  // Handle update rent config
  const handleUpdateRentConfig = async () => {
    if (!rentConfig) return;
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

      await updateBundleRentConfig.mutateAsync({
        bundleId: bundle.bundleId,
        rentFee6h: fee6h,
        rentFee1d: fee1d,
        rentFee7d: fee7d,
        isActive: rentConfig.isActive,
      });
      rentConfigQuery.refetch();
      onSuccess?.();
    } catch (err) {
      setError(getTransactionErrorMessage(err));
    }
  };

  const isLoading = isAddingBundleItem || isRemovingBundleItem || isUpdatingBundle || isSavingOrder || isUpdatingBundleMintSettings || isUpdatingBundleRentConfig;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />

      <div className="relative bg-gray-900 rounded-xl w-full max-w-2xl p-6 m-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">{metadata?.name || currentBundle.bundleId}</h2>
            <p className="text-sm text-gray-400">{getBundleTypeLabel(currentBundle.bundleType)} - {orderedItems.length} items</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Main Tabs */}
        <div className="flex gap-1 mb-4 bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setMainTab("content")}
            className={`flex-1 py-2 px-4 rounded text-sm font-medium transition-colors ${
              mainTab === "content" ? "bg-primary-500 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            Content
          </button>
          <button
            onClick={() => setMainTab("settings")}
            className={`flex-1 py-2 px-4 rounded text-sm font-medium transition-colors ${
              mainTab === "settings" ? "bg-primary-500 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            Settings
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-400 text-sm mb-4">
              {error}
            </div>
          )}

          {/* Content Tab */}
          {mainTab === "content" && (
            <div className="space-y-4">
              {/* Bundle Items */}
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2">Bundle Items ({orderedItems.length})</h3>
                {bundleWithItemsQuery.isLoading ? (
                  <div className="text-center py-8 text-gray-500">Loading items...</div>
                ) : orderedItems.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 bg-gray-800/50 rounded-lg">
                    <p>No items in this bundle yet.</p>
                    <p className="text-sm mt-1">Add content below to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {orderedItems.map((item, index) => {
                      const content = getContentForCid(item.contentCid);
                      return (
                        <div
                          key={item.contentCid}
                          draggable={!currentBundle.isLocked}
                          onDragStart={() => handleDragStart(index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, index)}
                          onDragEnd={handleDragEnd}
                          className={`flex items-center gap-3 p-3 bg-gray-800 rounded-lg transition-all ${
                            !currentBundle.isLocked ? "cursor-move" : ""
                          } ${draggedIndex === index ? "opacity-50 scale-95" : ""} ${
                            dragOverIndex === index ? "ring-2 ring-primary-500" : ""
                          }`}
                        >
                          {!currentBundle.isLocked && (
                            <div className="text-gray-500">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                              </svg>
                            </div>
                          )}
                          <div className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded text-sm font-medium">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {item.title || (content?.contentCid ? `${content.contentCid.slice(0, 12)}...` : "Unknown")}
                            </p>
                          </div>
                          {!currentBundle.isLocked && (
                            <button
                              onClick={() => handleRemoveItem(item.contentCid)}
                              disabled={isLoading}
                              className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors disabled:opacity-50"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {hasOrderChanges && (
                  <button
                    onClick={handleSaveOrder}
                    disabled={isSavingOrder}
                    className="w-full mt-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-700 rounded-lg font-medium transition-colors"
                  >
                    {isSavingOrder ? "Saving Order..." : "Save Order"}
                  </button>
                )}
              </div>

              {/* Add Content */}
              {!currentBundle.isLocked && addableContent.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2">Add Content</h3>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {addableContent.map((content) => (
                      <div key={content.contentCid} className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{content.contentCid.slice(0, 16)}...</p>
                        </div>
                        <button
                          onClick={() => handleAddItem(content.contentCid)}
                          disabled={isLoading}
                          className="px-3 py-1.5 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-700 rounded text-sm font-medium transition-colors"
                        >
                          Add
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentBundle.isLocked && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm text-yellow-400">
                  This bundle is locked. Content cannot be added or removed after the first mint.
                </div>
              )}
            </div>
          )}

          {/* Settings Tab */}
          {mainTab === "settings" && (
            <div className="space-y-4">
              {/* Settings Sub-tabs */}
              <div className="flex border-b border-gray-700">
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

              {/* Details Sub-tab */}
              {settingsTab === "details" && (
                <div className="space-y-4 pt-2">
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <h3 className="font-medium mb-2">Bundle Status</h3>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-400">
                        {currentBundle.isActive ? "Published - visible to everyone" : "Draft - only visible to you"}
                      </p>
                      <button
                        onClick={handleToggleBundleActive}
                        disabled={isUpdatingBundle}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          currentBundle.isActive
                            ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                            : "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                        } disabled:opacity-50`}
                      >
                        {currentBundle.isActive ? "Unpublish" : "Publish"}
                      </button>
                    </div>
                  </div>

                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <h3 className="font-medium mb-1">Bundle ID</h3>
                    <p className="text-sm text-gray-400 font-mono">{currentBundle.bundleId}</p>
                  </div>

                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <h3 className="font-medium mb-1">Bundle Type</h3>
                    <p className="text-sm text-gray-400">{getBundleTypeLabel(currentBundle.bundleType)}</p>
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

              {/* Mint Sub-tab */}
              {settingsTab === "mint" && (
                <div className="space-y-4 pt-2">
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
                          min="0.001"
                          step="0.001"
                          placeholder="Min 0.001"
                          className="w-full px-4 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-primary-500 focus:outline-none"
                        />
                        <p className="text-xs text-gray-500 mt-1">Minimum 0.001 SOL (free minting not allowed)</p>
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
                        onClick={handleUpdateMintSettings}
                        disabled={isLoading}
                        className="w-full py-3 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-700 rounded-lg font-medium transition-colors"
                      >
                        {isUpdatingBundleMintSettings ? "Saving..." : "Update Mint Settings"}
                      </button>
                    </>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <p>Minting not configured for this bundle.</p>
                      <p className="text-sm mt-1">This bundle was created without mint settings.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Rent Sub-tab */}
              {settingsTab === "rent" && (
                <div className="space-y-4 pt-2">
                  {(rentConfigQuery.isLoading || rentConfigQuery.isFetching) ? (
                    <div className="flex items-center justify-center py-8">
                      <svg className="animate-spin w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
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
                        onClick={handleUpdateRentConfig}
                        disabled={isLoading}
                        className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-700 rounded-lg font-medium transition-colors"
                      >
                        {isUpdatingBundleRentConfig ? "Saving..." : "Update Rent Pricing"}
                      </button>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-400">Unable to load rent configuration.</p>
                      {rentConfigQuery.error && (
                        <p className="text-red-400 text-sm mt-2">
                          Error: {rentConfigQuery.error instanceof Error ? rentConfigQuery.error.message : "Unknown error"}
                        </p>
                      )}
                      <p className="text-gray-500 text-xs mt-2">Bundle ID: {bundle.bundleId}</p>
                      <button
                        onClick={() => rentConfigQuery.refetch()}
                        className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-600 rounded-lg text-sm font-medium transition-colors"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                </div>
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
