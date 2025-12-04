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
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />

      <div className="relative bg-gray-900 rounded-xl w-full max-w-md p-6 m-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Edit Content</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter title"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter description"
              rows={3}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500 resize-none"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium mb-2">Tags</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="tag1, tag2, tag3"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">Separate tags with commas</p>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUpdatingContent}
              className="flex-1 py-3 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
            >
              {isUpdatingContent ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
