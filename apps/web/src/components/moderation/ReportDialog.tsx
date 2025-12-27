"use client";

import { useState } from "react";
import { DisputeTypeEnum, type DisputeType, getDisputeTypeName } from "@scalecraft/sdk";
import { useScalecraft } from "@/hooks/useScalecraft";
import { useSubjectStatus } from "@/hooks/useSubjectStatus";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { ReportCategorySelect } from "./ReportCategorySelect";

// Constants - should match Tribunalcraft program
const MIN_CHALLENGER_STAKE = 0.01; // 0.01 SOL minimum stake

interface ReportDialogProps {
  contentCid: string;
  contentTitle?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ReportDialog({
  contentCid,
  contentTitle,
  isOpen,
  onClose,
  onSuccess,
}: ReportDialogProps) {
  const { session } = useSupabaseAuth();
  const { createDispute, joinDispute, isConnected } = useScalecraft();
  const { data: subjectStatus, refetch } = useSubjectStatus(contentCid);

  const [disputeType, setDisputeType] = useState<DisputeType>(DisputeTypeEnum.Other);
  const [details, setDetails] = useState("");
  const [stakeAmount, setStakeAmount] = useState(MIN_CHALLENGER_STAKE.toString());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const hasActiveDispute = subjectStatus?.status === "disputed";
  const stakeLamports = Math.floor(parseFloat(stakeAmount || "0") * 1e9);
  const isValidStake = stakeLamports >= MIN_CHALLENGER_STAKE * 1e9;

  const handleSubmit = async () => {
    if (!details.trim()) {
      setError("Please provide details about the violation");
      return;
    }

    if (!isValidStake) {
      setError(`Minimum stake is ${MIN_CHALLENGER_STAKE} SOL`);
      return;
    }

    if (!isConnected) {
      setError("Please connect your wallet");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Upload report details to IPFS
      const reportData = {
        disputeType: getDisputeTypeName(disputeType),
        details,
        timestamp: Date.now(),
        contentCid,
      };

      const formData = new FormData();
      formData.append(
        "file",
        new Blob([JSON.stringify(reportData)], { type: "application/json" })
      );
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

      // Submit dispute on-chain
      if (hasActiveDispute) {
        // Join existing dispute
        await joinDispute({
          contentCid,
          detailsCid,
          stake: stakeLamports,
        });
      } else {
        // Create new dispute
        await createDispute({
          contentCid,
          disputeType,
          detailsCid,
          stake: stakeLamports,
        });
      }

      // Refetch status
      await refetch();

      onSuccess?.();
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
            <h2 className="text-xl font-semibold text-white">
              {hasActiveDispute ? "Join Dispute" : "Report Content"}
            </h2>
            {contentTitle && (
              <p className="text-sm text-white/50 mt-1 truncate max-w-[300px]">
                {contentTitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            <svg
              className="w-5 h-5 text-white/50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {hasActiveDispute && (
            <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl">
              <h4 className="text-sm font-medium text-orange-400 mb-1">
                Active Dispute
              </h4>
              <p className="text-xs text-white/50">
                This content is already being disputed. You can join the existing
                dispute to add your stake and evidence.
              </p>
            </div>
          )}

          <ReportCategorySelect value={disputeType} onChange={setDisputeType} />

          <div className="space-y-2">
            <label className="block text-sm font-medium text-white/70">
              Details
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Please describe the violation in detail. Include any relevant information that would help jurors make a decision."
              rows={4}
              className="w-full px-4 py-3 bg-white/[0.02] border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-red-500/50 resize-none"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-white/70">
              Stake Amount (SOL)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min={MIN_CHALLENGER_STAKE}
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                className="w-full px-4 py-3 bg-white/[0.02] border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-red-500/50"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50">
                SOL
              </span>
            </div>
            <p className="text-xs text-white/50">
              Minimum: {MIN_CHALLENGER_STAKE} SOL. Higher stakes increase your
              share of rewards if the dispute is upheld.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="p-4 bg-white/[0.02] border border-white/10 rounded-xl">
            <h4 className="text-sm font-medium text-white/70 mb-2">
              How disputes work
            </h4>
            <ul className="text-xs text-white/50 space-y-1">
              <li>- Your stake is locked during the voting period</li>
              <li>- Community jurors vote on whether to uphold or dismiss</li>
              <li>- If upheld: you receive rewards from defender&apos;s bond</li>
              <li>- If dismissed: you lose your stake to the defender</li>
              <li>- False reports affect your reputation score</li>
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
            disabled={isSubmitting || !details.trim() || !isValidStake || !isConnected}
            className="flex-1 py-3 bg-red-500/20 hover:bg-red-500/30 rounded-xl font-medium transition-colors border border-red-500/30 text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting
              ? "Submitting..."
              : hasActiveDispute
              ? "Join Dispute"
              : "Submit Report"}
          </button>
        </div>
      </div>
    </div>
  );
}
