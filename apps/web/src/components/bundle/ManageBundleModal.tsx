"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { getBundleTypeLabel, getIpfsUrl, BundleMetadata, BundleMetadataItem } from "@handcraft/sdk";
import { useContentRegistry, Bundle, ContentEntry } from "@/hooks/useContentRegistry";

interface ManageBundleModalProps {
  isOpen: boolean;
  onClose: () => void;
  bundle: Bundle;
  availableContent: ContentEntry[];
}

export function ManageBundleModal({
  isOpen,
  onClose,
  bundle,
  availableContent,
}: ManageBundleModalProps) {
  const [activeTab, setActiveTab] = useState<"items" | "add" | "settings">("items");
  const [error, setError] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [metadata, setMetadata] = useState<BundleMetadata | null>(null);
  const [orderedItems, setOrderedItems] = useState<BundleMetadataItem[]>([]);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [hasOrderChanges, setHasOrderChanges] = useState(false);

  const {
    useBundleWithItems,
    addBundleItem,
    removeBundleItem,
    updateBundle,
    isAddingBundleItem,
    isRemovingBundleItem,
    isUpdatingBundle,
    getContentPda,
  } = useContentRegistry();

  // Fetch bundle with items
  const bundleWithItemsQuery = useBundleWithItems(bundle.bundleId);
  const onChainItems = bundleWithItemsQuery.data?.items ?? [];

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

          // Initialize ordered items from metadata or fall back to on-chain order
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

  // Sync ordered items when on-chain items change (but metadata doesn't have items yet)
  useEffect(() => {
    if (onChainItems.length > 0 && orderedItems.length === 0) {
      // Initialize from on-chain if no metadata order exists
      const items: BundleMetadataItem[] = onChainItems
        .sort((a, b) => a.item.position - b.item.position)
        .map(item => ({
          contentCid: item.content?.contentCid || "",
        }))
        .filter(item => item.contentCid);
      setOrderedItems(items);
    }
  }, [onChainItems, orderedItems.length]);

  // Get content details for an item
  const getContentForCid = useCallback((contentCid: string): ContentEntry | null => {
    const item = onChainItems.find(i => i.content?.contentCid === contentCid);
    return item?.content || null;
  }, [onChainItems]);

  // Filter available content that's not already in the bundle
  const addableContent = useMemo(() => {
    const bundleCids = new Set(orderedItems.map(i => i.contentCid));
    return availableContent.filter(c => !bundleCids.has(c.contentCid));
  }, [orderedItems, availableContent]);

  // Handle adding item - add to on-chain AND update local order
  const handleAddItem = async (contentCid: string) => {
    setError(null);
    try {
      await addBundleItem.mutateAsync({
        bundleId: bundle.bundleId,
        contentCid,
        position: orderedItems.length,
      });

      // Add to local ordered items
      setOrderedItems(prev => [...prev, { contentCid }]);
      setHasOrderChanges(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add item");
    }
  };

  // Handle removing item - remove from on-chain AND update local order
  const handleRemoveItem = async (contentCid: string) => {
    setError(null);
    try {
      await removeBundleItem.mutateAsync({
        bundleId: bundle.bundleId,
        contentCid,
      });

      // Remove from local ordered items
      setOrderedItems(prev => prev.filter(i => i.contentCid !== contentCid));
      setHasOrderChanges(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove item");
    }
  };

  // Handle drag start
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  // Handle drag leave
  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  // Handle drop - reorder local items
  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    // Reorder items
    const newItems = [...orderedItems];
    const [draggedItem] = newItems.splice(draggedIndex, 1);
    newItems.splice(dropIndex, 0, draggedItem);

    setOrderedItems(newItems);
    setHasOrderChanges(true);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Handle drag end (cleanup)
  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Save order to metadata (upload new metadata, update on-chain)
  const handleSaveOrder = async () => {
    if (!hasOrderChanges) return;

    setIsSavingOrder(true);
    setError(null);

    try {
      // Create updated metadata
      const updatedMetadata: BundleMetadata = {
        ...metadata,
        name: metadata?.name || bundle.bundleId,
        description: metadata?.description || "",
        bundleType: metadata?.bundleType || getBundleTypeLabel(bundle.bundleType),
        items: orderedItems,
        updatedAt: new Date().toISOString(),
      };

      // Upload new metadata to IPFS
      const metadataRes = await fetch("/api/upload/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metadata: updatedMetadata,
          name: `bundle-${bundle.bundleId}-metadata`,
        }),
      });

      if (!metadataRes.ok) {
        throw new Error("Failed to upload metadata");
      }

      const { cid: newMetadataCid } = await metadataRes.json();

      // Update on-chain metadata CID
      await updateBundle.mutateAsync({
        bundleId: bundle.bundleId,
        metadataCid: newMetadataCid,
      });

      setMetadata(updatedMetadata);
      setHasOrderChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save order");
    } finally {
      setIsSavingOrder(false);
    }
  };

  // Handle deactivate
  const handleDeactivate = async () => {
    setError(null);
    try {
      await updateBundle.mutateAsync({
        bundleId: bundle.bundleId,
        isActive: false,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to deactivate bundle");
    }
  };

  const isLoading = isAddingBundleItem || isRemovingBundleItem || isUpdatingBundle || isSavingOrder;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />

      <div className="relative bg-gray-900 rounded-xl w-full max-w-2xl p-6 m-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">{metadata?.name || bundle.bundleId}</h2>
            <p className="text-sm text-gray-400">{getBundleTypeLabel(bundle.bundleType)} - {orderedItems.length} items</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setActiveTab("items")}
            className={`flex-1 py-2 px-4 rounded text-sm font-medium transition-colors ${
              activeTab === "items"
                ? "bg-primary-500 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Items ({orderedItems.length})
          </button>
          <button
            onClick={() => setActiveTab("add")}
            className={`flex-1 py-2 px-4 rounded text-sm font-medium transition-colors ${
              activeTab === "add"
                ? "bg-primary-500 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Add Content ({addableContent.length})
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`flex-1 py-2 px-4 rounded text-sm font-medium transition-colors ${
              activeTab === "settings"
                ? "bg-primary-500 text-white"
                : "text-gray-400 hover:text-white"
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

          {/* Items Tab */}
          {activeTab === "items" && (
            <div className="space-y-2">
              {bundleWithItemsQuery.isLoading ? (
                <div className="text-center py-8 text-gray-500">Loading items...</div>
              ) : orderedItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No items in this bundle yet.</p>
                  <p className="text-sm mt-1">Click "Add Content" to get started.</p>
                </div>
              ) : (
                <>
                  {orderedItems.map((item, index) => {
                    const content = getContentForCid(item.contentCid);

                    return (
                      <div
                        key={item.contentCid}
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, index)}
                        onDragEnd={handleDragEnd}
                        className={`flex items-center gap-3 p-3 bg-gray-800 rounded-lg cursor-move transition-all ${
                          draggedIndex === index ? "opacity-50 scale-95" : ""
                        } ${dragOverIndex === index ? "ring-2 ring-primary-500" : ""}`}
                      >
                        {/* Drag Handle */}
                        <div className="text-gray-500">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                          </svg>
                        </div>

                        {/* Position */}
                        <div className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded text-sm font-medium">
                          {index + 1}
                        </div>

                        {/* Content Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {item.title || (content?.contentCid ? `${content.contentCid.slice(0, 12)}...` : "Unknown")}
                          </p>
                          <p className="text-xs text-gray-500">
                            {content?.contentType?.toString().replace(/([A-Z])/g, ' $1').trim() || "Content"}
                          </p>
                        </div>

                        {/* Remove Button */}
                        <button
                          onClick={() => handleRemoveItem(item.contentCid)}
                          disabled={isLoading}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors disabled:opacity-50"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}

                  {/* Save Order Button */}
                  {hasOrderChanges && (
                    <div className="pt-4 border-t border-gray-700 mt-4">
                      <button
                        onClick={handleSaveOrder}
                        disabled={isSavingOrder}
                        className="w-full py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-700 rounded-lg font-medium transition-colors"
                      >
                        {isSavingOrder ? "Saving Order..." : "Save Order"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Add Content Tab */}
          {activeTab === "add" && (
            <div className="space-y-2">
              {addableContent.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>All your content is already in this bundle.</p>
                  <p className="text-sm mt-1">Create more content to add here.</p>
                </div>
              ) : (
                addableContent.map((content) => (
                  <div
                    key={content.contentCid}
                    className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg"
                  >
                    {/* Content Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{content.contentCid.slice(0, 12)}...</p>
                      <p className="text-xs text-gray-500">
                        {content.contentType?.toString().replace(/([A-Z])/g, ' $1').trim() || "Content"}
                      </p>
                    </div>

                    {/* Add Button */}
                    <button
                      onClick={() => handleAddItem(content.contentCid)}
                      disabled={isLoading}
                      className="px-3 py-1.5 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-700 rounded text-sm font-medium transition-colors"
                    >
                      {isAddingBundleItem ? "Adding..." : "Add"}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === "settings" && (
            <div className="space-y-4">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h3 className="font-medium mb-2">Bundle ID</h3>
                <p className="text-sm text-gray-400 font-mono">{bundle.bundleId}</p>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-4">
                <h3 className="font-medium mb-2">Bundle Type</h3>
                <p className="text-sm text-gray-400">{getBundleTypeLabel(bundle.bundleType)}</p>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-4">
                <h3 className="font-medium mb-2">Status</h3>
                <p className="text-sm text-gray-400">{bundle.isActive ? "Active" : "Inactive"}</p>
              </div>

              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <h3 className="font-medium text-red-400 mb-2">Danger Zone</h3>
                <p className="text-sm text-gray-400 mb-3">
                  Deactivating a bundle will hide it from public view. You can reactivate it later.
                </p>
                <button
                  onClick={handleDeactivate}
                  disabled={isUpdatingBundle || !bundle.isActive}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded text-red-400 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {isUpdatingBundle ? "Deactivating..." : "Deactivate Bundle"}
                </button>
              </div>
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
