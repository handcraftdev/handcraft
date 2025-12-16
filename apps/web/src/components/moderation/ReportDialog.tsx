"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { ReportCategory } from "@handcraft/sdk";
import { useModeration } from "@/hooks/useModeration";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { ReportCategorySelect } from "./ReportCategorySelect";

interface ReportDialogProps {
  contentPda: PublicKey;
  contentTitle?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ReportDialog({ contentPda, contentTitle, isOpen, onClose }: ReportDialogProps) {
  const { session } = useSupabaseAuth();
  const { submitReport } = useModeration();
  const [category, setCategory] = useState<ReportCategory>(ReportCategory.Other);
  const [details, setDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!details.trim()) {
      setError("Please provide details about the violation");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Upload report details to IPFS
      const reportData = {
        category,
        details,
        timestamp: Date.now(),
        contentPda: contentPda.toBase58(),
      };

      const formData = new FormData();
      formData.append("file", new Blob([JSON.stringify(reportData)], { type: "application/json" }));
      formData.append("encrypt", "false");

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload report details");
      }

      const { cid: detailsCid } = await uploadRes.json();

      // Submit report on-chain
      await submitReport.mutateAsync({
        content: contentPda,
        category,
        detailsCid,
      });

      onClose();
    } catch (err) {
      console.error("Failed to submit report:", err);
      setError(err instanceof Error ? err.message : "Failed to submit report");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-lg mx-4 bg-[#0a0a0f] border border-white/10 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-xl font-semibold text-white">Report Content</h2>
            {contentTitle && (
              <p className="text-sm text-white/50 mt-1 truncate max-w-[300px]">{contentTitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            <svg className="w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          <ReportCategorySelect value={category} onChange={setCategory} />

          <div className="space-y-2">
            <label className="block text-sm font-medium text-white/70">Details</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Please describe the violation in detail. Include any relevant information that would help moderators make a decision."
              rows={4}
              className="w-full px-4 py-3 bg-white/[0.02] border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-red-500/50 resize-none"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="p-4 bg-white/[0.02] border border-white/10 rounded-xl">
            <h4 className="text-sm font-medium text-white/70 mb-2">How reporting works</h4>
            <ul className="text-xs text-white/50 space-y-1">
              <li>- Your report will be reviewed by community moderators</li>
              <li>- Moderators have 7 days to vote on the report</li>
              <li>- A 30% quorum and 60% approval is required for action</li>
              <li>- False reports may affect your reputation</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-white/10">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-medium transition-colors border border-white/10 text-white/70"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !details.trim()}
            className="flex-1 py-3 bg-red-500/20 hover:bg-red-500/30 rounded-xl font-medium transition-colors border border-red-500/30 text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Submitting..." : "Submit Report"}
          </button>
        </div>
      </div>
    </div>
  );
}
