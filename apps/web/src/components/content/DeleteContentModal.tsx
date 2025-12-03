"use client";

import { useState } from "react";
import { useContentRegistry } from "@/hooks/useContentRegistry";

interface DeleteContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentCid: string;
  contentTitle?: string;
  hasMintConfig?: boolean;
  onSuccess?: () => void;
}

export function DeleteContentModal({
  isOpen,
  onClose,
  contentCid,
  contentTitle,
  hasMintConfig,
  onSuccess,
}: DeleteContentModalProps) {
  const { deleteContent, isDeletingContent } = useContentRegistry();
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setError(null);

    try {
      await deleteContent({ contentCid, hasMintConfig });
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("Failed to delete content:", err);
      setError(err instanceof Error ? err.message : "Failed to delete content");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />

      <div className="relative bg-gray-900 rounded-xl w-full max-w-sm p-6 m-4">
        <div className="text-center">
          {/* Warning Icon */}
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>

          <h2 className="text-xl font-bold mb-2">Delete Content</h2>

          <p className="text-gray-400 mb-4">
            Are you sure you want to delete{" "}
            <span className="text-white font-medium">
              {contentTitle || "this content"}
            </span>
            ? This action cannot be undone.
          </p>

          {error && (
            <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-400 text-sm mb-4">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeletingContent}
              className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
            >
              {isDeletingContent ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
