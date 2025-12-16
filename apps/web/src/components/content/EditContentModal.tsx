"use client";

import { useState, useEffect } from "react";
import { useContentRegistry, ContentEntry } from "@/hooks/useContentRegistry";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { getIpfsUrl } from "@handcraft/sdk";

interface EditContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: ContentEntry;
  onSuccess?: () => void;
}

export function EditContentModal({
  isOpen,
  onClose,
  content,
  onSuccess,
}: EditContentModalProps) {
  const { updateContent, isUpdatingContent } = useContentRegistry();
  const { session } = useSupabaseAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(true);
  const [originalMetadata, setOriginalMetadata] = useState<Record<string, unknown> | null>(null);

  // Fetch current metadata from IPFS when modal opens
  useEffect(() => {
    async function fetchMetadata() {
      if (!isOpen || !content.metadataCid) {
        setIsLoadingMetadata(false);
        return;
      }

      setIsLoadingMetadata(true);
      try {
        const url = getIpfsUrl(content.metadataCid);
        const res = await fetch(url);
        if (res.ok) {
          const meta = await res.json();
          setOriginalMetadata(meta);
          setTitle(meta.properties?.title || meta.name || "");
          setDescription(meta.description || "");
          setTags((meta.properties?.tags || meta.tags || []).join(", "));
        }
      } catch (e) {
        console.error("Failed to fetch metadata:", e);
        // Use fallback from content object
        const metadata = (content as any).metadata;
        if (metadata) {
          setTitle(metadata.title || metadata.name || "");
          setDescription(metadata.description || "");
          setTags((metadata.tags || []).join(", "));
        }
      } finally {
        setIsLoadingMetadata(false);
      }
    }

    fetchMetadata();
  }, [isOpen, content]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    if (!session?.access_token) {
      setError("Please sign in to edit content");
      return;
    }

    try {
      const tagsArray = tags.split(",").map(t => t.trim()).filter(t => t);

      // Build updated metadata, preserving original properties
      const updatedMetadata = {
        ...originalMetadata,
        name: title.trim(),
        description: description.trim(),
        properties: {
          ...(originalMetadata?.properties as Record<string, unknown> || {}),
          title: title.trim(),
          tags: tagsArray,
        },
        updatedAt: new Date().toISOString(),
      };

      // Upload new metadata to IPFS
      const metadataRes = await fetch("/api/upload/metadata", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ metadata: updatedMetadata, name: "metadata" }),
      });

      if (!metadataRes.ok) {
        throw new Error("Failed to upload metadata");
      }

      const { cid: metadataCid } = await metadataRes.json();

      // Update on-chain
      await updateContent({
        contentCid: content.contentCid,
        metadataCid,
      });

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("Failed to update content:", err);
      setError(err instanceof Error ? err.message : "Failed to update content");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-black border border-white/10 rounded-2xl w-full max-w-md p-6 m-4">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none rounded-2xl" />

        <div className="relative">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-medium text-white/90">Edit Content</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded-full transition-all duration-300 text-white/40 hover:text-white/70"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {isLoadingMetadata ? (
            <div className="flex items-center justify-center py-12">
              <svg className="w-6 h-6 animate-spin text-white/40" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="ml-2 text-sm text-white/40">Loading metadata...</span>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Title */}
            <div>
              <label className="block text-[11px] uppercase tracking-[0.2em] text-white/30 mb-2">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter title"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.07] text-white/90 placeholder:text-white/20 transition-all duration-300"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-[11px] uppercase tracking-[0.2em] text-white/30 mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter description"
                rows={3}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.07] resize-none text-white/90 placeholder:text-white/20 transition-all duration-300"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-[11px] uppercase tracking-[0.2em] text-white/30 mb-2">Tags</label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="tag1, tag2, tag3"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.07] text-white/90 placeholder:text-white/20 transition-all duration-300"
              />
              <p className="text-xs text-white/30 mt-2">Separate tags with commas</p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-medium transition-all duration-300 text-white/70 border border-white/10 hover:border-white/20"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUpdatingContent}
                className="flex-1 py-3 bg-purple-500/20 hover:bg-purple-500/30 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl font-medium transition-all duration-300 border border-purple-500/30 hover:border-purple-500/50 text-white/90"
              >
                {isUpdatingContent ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
          )}
        </div>
      </div>
    </div>
  );
}
