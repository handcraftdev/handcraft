"use client";

import { useState } from "react";
import { useContentRegistry } from "@/hooks/useContentRegistry";

interface EditContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentCid: string;
  currentTitle?: string;
  currentDescription?: string;
  currentTags?: string[];
  onSuccess?: () => void;
}

export function EditContentModal({
  isOpen,
  onClose,
  contentCid,
  currentTitle = "",
  currentDescription = "",
  currentTags = [],
  onSuccess,
}: EditContentModalProps) {
  const { updateContent, isUpdatingContent } = useContentRegistry();

  const [title, setTitle] = useState(currentTitle);
  const [description, setDescription] = useState(currentDescription);
  const [tags, setTags] = useState(currentTags.join(", "));
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    try {
      // Create new metadata
      const metadata = {
        name: title.trim(),
        title: title.trim(),
        description: description.trim(),
        tags: tags.split(",").map(t => t.trim()).filter(t => t),
        updatedAt: new Date().toISOString(),
      };

      // Upload new metadata to IPFS
      const metadataRes = await fetch("/api/upload/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadata, name: "metadata" }),
      });

      if (!metadataRes.ok) {
        throw new Error("Failed to upload metadata");
      }

      const { cid: metadataCid } = await metadataRes.json();

      // Update on-chain
      await updateContent({
        contentCid,
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
        </div>
      </div>
    </div>
  );
}
