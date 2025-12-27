"use client";

import { useState, useMemo } from "react";
import { getIpfsUrl } from "@handcraft/sdk";
import type { CreatorFeaturedContent, IndexedContent, IndexedBundle } from "@/lib/supabase";

interface FeaturedItem {
  content_cid: string;
  content_type: "content" | "bundle";
  position: number;
  is_hero: boolean;
  custom_title: string | null;
  custom_description: string | null;
}

interface FeaturedContentPickerProps {
  isOpen: boolean;
  onClose: () => void;
  currentFeatured: CreatorFeaturedContent[];
  availableContent: IndexedContent[];
  availableBundles: IndexedBundle[];
  onSave: (items: FeaturedItem[]) => Promise<void>;
}

type SelectableItem = {
  id: string;
  type: "content" | "bundle";
  name: string;
  imageUrl: string | null;
  data: IndexedContent | IndexedBundle;
};

const MAX_FEATURED = 6;

export function FeaturedContentPicker({
  isOpen,
  onClose,
  currentFeatured,
  availableContent,
  availableBundles,
  onSave,
}: FeaturedContentPickerProps) {
  // Initialize selected items from currentFeatured
  const [selectedItems, setSelectedItems] = useState<FeaturedItem[]>(() =>
    currentFeatured
      .sort((a, b) => a.position - b.position)
      .map((f) => ({
        content_cid: f.content_cid,
        content_type: f.content_type,
        position: f.position,
        is_hero: f.is_hero,
        custom_title: f.custom_title,
        custom_description: f.custom_description,
      }))
  );

  const [filter, setFilter] = useState<"all" | "content" | "bundle">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build selectable items list
  const allItems: SelectableItem[] = useMemo(() => {
    const contentItems: SelectableItem[] = availableContent.map((c) => ({
      id: c.content_cid,
      type: "content" as const,
      name: c.name || "Untitled",
      imageUrl: c.image_url,
      data: c,
    }));

    const bundleItems: SelectableItem[] = availableBundles.map((b) => ({
      id: b.bundle_id,
      type: "bundle" as const,
      name: b.name || "Untitled Bundle",
      imageUrl: b.image_url,
      data: b,
    }));

    return [...contentItems, ...bundleItems];
  }, [availableContent, availableBundles]);

  // Filter and search
  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      // Type filter
      if (filter !== "all" && item.type !== filter) return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return item.name.toLowerCase().includes(query);
      }

      return true;
    });
  }, [allItems, filter, searchQuery]);

  const isSelected = (id: string) =>
    selectedItems.some((s) => s.content_cid === id);

  const getSelectedPosition = (id: string) => {
    const item = selectedItems.find((s) => s.content_cid === id);
    return item ? item.position : -1;
  };

  const toggleItem = (item: SelectableItem) => {
    if (isSelected(item.id)) {
      // Remove item
      const newItems = selectedItems
        .filter((s) => s.content_cid !== item.id)
        .map((s, i) => ({ ...s, position: i, is_hero: i === 0 }));
      setSelectedItems(newItems);
    } else {
      // Add item (if not at max)
      if (selectedItems.length >= MAX_FEATURED) {
        setError(`Maximum ${MAX_FEATURED} items can be featured`);
        return;
      }
      const newPosition = selectedItems.length;
      setSelectedItems([
        ...selectedItems,
        {
          content_cid: item.id,
          content_type: item.type,
          position: newPosition,
          is_hero: newPosition === 0,
          custom_title: null,
          custom_description: null,
        },
      ]);
    }
    setError(null);
  };

  const moveItem = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= selectedItems.length) return;

    const newItems = [...selectedItems];
    [newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]];

    // Update positions and hero status
    setSelectedItems(
      newItems.map((item, i) => ({
        ...item,
        position: i,
        is_hero: i === 0,
      }))
    );
  };

  const getItemDetails = (cid: string): SelectableItem | undefined => {
    return allItems.find((item) => item.id === cid);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      await onSave(selectedItems);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (isSaving) return;
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative bg-black rounded-2xl w-full max-w-2xl mx-4 overflow-hidden border border-white/10 max-h-[90vh] flex flex-col">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none" />

        {/* Header */}
        <div className="relative flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div>
            <h2 className="text-lg font-medium text-white/90">Featured Content</h2>
            <p className="text-sm text-white/40 mt-0.5">
              Select up to {MAX_FEATURED} items to showcase on your profile
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={isSaving}
            className="p-2 hover:bg-white/5 rounded-full transition-all duration-300 text-white/40 hover:text-white/70 disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="relative flex-1 overflow-hidden flex">
          {/* Left: Selection list */}
          <div className="flex-1 border-r border-white/5 flex flex-col">
            {/* Filters */}
            <div className="p-4 border-b border-white/5 space-y-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search content..."
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white/90 placeholder:text-white/20 focus:outline-none focus:border-cyan-500/50"
              />
              <div className="flex gap-2">
                {(["all", "content", "bundle"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      filter === f
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                        : "text-white/40 hover:text-white/60 hover:bg-white/5"
                    }`}
                  >
                    {f === "all" ? "All" : f === "content" ? "Content" : "Bundles"}
                  </button>
                ))}
              </div>
            </div>

            {/* Items list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredItems.length === 0 && (
                <p className="text-center text-white/30 text-sm py-8">
                  {searchQuery ? "No matching content found" : "No content available"}
                </p>
              )}

              {filteredItems.map((item) => {
                const selected = isSelected(item.id);
                const position = getSelectedPosition(item.id);
                const imageUrl = item.imageUrl
                  ? getIpfsUrl(item.imageUrl.replace("https://ipfs.io/ipfs/", ""))
                  : null;

                return (
                  <button
                    key={item.id}
                    onClick={() => toggleItem(item)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      selected
                        ? "bg-cyan-500/10 border-cyan-500/30"
                        : "bg-white/[0.02] border-white/10 hover:bg-white/5 hover:border-white/20"
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm text-white/80 truncate">{item.name}</p>
                      <p className="text-xs text-white/40">
                        {item.type === "bundle" ? "Bundle" : "Content"}
                      </p>
                    </div>

                    {/* Selection indicator */}
                    {selected ? (
                      <div className="w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-black">{position + 1}</span>
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full border-2 border-white/20 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Selected order */}
          <div className="w-64 flex flex-col">
            <div className="p-4 border-b border-white/5">
              <h3 className="text-sm font-medium text-white/70">
                Selected ({selectedItems.length}/{MAX_FEATURED})
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {selectedItems.length === 0 && (
                <p className="text-center text-white/30 text-xs py-4">
                  Select items from the left to feature them
                </p>
              )}

              {selectedItems.map((item, index) => {
                const details = getItemDetails(item.content_cid);
                if (!details) return null;

                const imageUrl = details.imageUrl
                  ? getIpfsUrl(details.imageUrl.replace("https://ipfs.io/ipfs/", ""))
                  : null;

                return (
                  <div
                    key={item.content_cid}
                    className={`flex items-center gap-2 p-2 rounded-lg ${
                      index === 0
                        ? "bg-amber-500/10 border border-amber-500/20"
                        : "bg-white/[0.02] border border-white/5"
                    }`}
                  >
                    {/* Position */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => moveItem(index, "up")}
                        disabled={index === 0}
                        className="p-0.5 hover:bg-white/10 rounded disabled:opacity-20"
                      >
                        <svg className="w-3 h-3 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => moveItem(index, "down")}
                        disabled={index === selectedItems.length - 1}
                        className="p-0.5 hover:bg-white/10 rounded disabled:opacity-20"
                      >
                        <svg className="w-3 h-3 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    {/* Thumbnail */}
                    <div className="w-8 h-8 rounded overflow-hidden bg-white/5 flex-shrink-0">
                      {imageUrl ? (
                        <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-purple-900/30 to-black" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white/70 truncate">{details.name}</p>
                      {index === 0 && (
                        <span className="text-xs text-amber-400">Hero</span>
                      )}
                    </div>

                    {/* Remove */}
                    <button
                      onClick={() => toggleItem(details)}
                      className="p-1 hover:bg-red-500/10 rounded"
                    >
                      <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative px-6 py-4 border-t border-white/5">
          {error && (
            <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={handleClose}
              disabled={isSaving}
              className="px-4 py-2 text-sm text-white/50 hover:text-white/70 hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium text-white text-sm transition-all"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
