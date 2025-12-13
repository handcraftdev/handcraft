"use client";

import { useState } from "react";
import { useContentRegistry } from "@/hooks/useContentRegistry";
import { getTransactionErrorMessage } from "@/utils/wallet-errors";

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
      setError(getTransactionErrorMessage(err));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-black border border-white/10 rounded-2xl w-full max-w-sm p-6 m-4">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent pointer-events-none rounded-2xl" />

        <div className="relative text-center">
          {/* Warning Icon */}
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>

          <h2 className="text-lg font-medium text-white/90 mb-3">Delete Content</h2>

          <p className="text-white/40 mb-5 text-sm">
            Are you sure you want to delete{" "}
            <span className="text-white/80 font-medium">
              {contentTitle || "this content"}
            </span>
            ? This action cannot be undone.
          </p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm mb-5">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-medium transition-all duration-300 text-white/70 border border-white/10 hover:border-white/20"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeletingContent}
              className="flex-1 py-3 bg-red-500/20 hover:bg-red-500/30 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl font-medium transition-all duration-300 border border-red-500/30 hover:border-red-500/50 text-white/90"
            >
              {isDeletingContent ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
