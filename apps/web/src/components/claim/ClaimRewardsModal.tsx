"use client";

import { useState, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useContentRegistry } from "@/hooks/useContentRegistry";
import { getTransactionErrorMessage } from "@/utils/wallet-errors";

const LAMPORTS_PER_SOL = 1_000_000_000;

// Chevron icon component for expand/collapse
function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

interface ClaimRewardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ClaimRewardsModal({
  isOpen,
  onClose,
  onSuccess,
}: ClaimRewardsModalProps) {
  const { publicKey } = useWallet();
  const {
    claimRewardsVerified,
    claimAllRewards,
    isClaimingReward,
    usePendingRewards,
    globalContent,
  } = useContentRegistry();

  const { data: pendingRewards, isLoading: isLoadingPending, refetch } = usePendingRewards();

  // Create a map of contentCid -> content metadata for display
  const contentMetadataMap = useMemo(() => {
    const map = new Map<string, { title: string; creator: string }>();
    for (const content of globalContent) {
      map.set(content.contentCid, {
        title: (content as any).metadata?.title || (content as any).metadata?.name || "Untitled",
        creator: content.creator?.toBase58().slice(0, 6) + "..." || "Unknown",
      });
    }
    return map;
  }, [globalContent]);

  const [error, setError] = useState<string | null>(null);
  const [claimingAll, setClaimingAll] = useState(false);
  const [expandedContentCids, setExpandedContentCids] = useState<Set<string>>(new Set());

  const toggleExpanded = (contentCid: string) => {
    setExpandedContentCids((prev) => {
      const next = new Set(prev);
      if (next.has(contentCid)) {
        next.delete(contentCid);
      } else {
        next.add(contentCid);
      }
      return next;
    });
  };

  // Calculate total pending rewards (SOL only)
  const totalPending = pendingRewards?.reduce((acc, r) => acc + r.pending, BigInt(0)) || BigInt(0);

  // Calculate total NFT count across all content positions
  const totalNftCount = pendingRewards?.reduce((acc, r) => acc + r.nftCount, BigInt(0)) || BigInt(0);

  const formatSol = (lamports: bigint) => {
    return `${(Number(lamports) / LAMPORTS_PER_SOL).toFixed(6)} SOL`;
  };

  const handleClaimSingle = async (index: number) => {
    if (!publicKey || !pendingRewards) return;

    const reward = pendingRewards[index];
    if (!reward) return;

    setError(null);
    setClaimingAll(true);

    try {
      // Use verified claim which checks NFT ownership per-NFT
      await claimRewardsVerified({
        contentCid: reward.contentCid,
      });
      refetch();
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("Failed to claim reward:", err);
      setError(getTransactionErrorMessage(err));
    } finally {
      setClaimingAll(false);
    }
  };

  const handleClaimAll = async () => {
    if (!publicKey || !pendingRewards || pendingRewards.length === 0) return;

    setError(null);
    setClaimingAll(true);

    // Capture content CIDs before starting
    const contentCidsToClaim = pendingRewards
      .filter(r => r.pending > BigInt(0))
      .map(r => r.contentCid);

    try {
      // Batch all claims into a single transaction
      await claimAllRewards({ contentCids: contentCidsToClaim });
      // Mutation's onSuccess already invalidates queries, just trigger refetch without awaiting
      refetch();
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("Failed to claim rewards:", err);
      setError(getTransactionErrorMessage(err));
    } finally {
      setClaimingAll(false);
    }
  };

  if (!isOpen) return null;

  const isLoading = isLoadingPending;
  const hasRewards = pendingRewards && pendingRewards.length > 0 && totalPending > BigInt(0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />

      <div className="relative bg-gray-900 rounded-xl w-full max-w-md p-6 m-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Claim Rewards</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>


        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400"></div>
          </div>
        ) : !hasRewards ? (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-2">No pending rewards</div>
            <p className="text-sm text-gray-500">
              You'll earn rewards when new NFTs are minted for content you hold.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Total Summary */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Total Pending</h3>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-green-400">
                  {formatSol(totalPending)}
                </span>
                <span className="text-sm text-gray-500">
                  {pendingRewards.length} content position{pendingRewards.length > 1 ? "s" : ""} ({totalNftCount.toString()} NFT{totalNftCount > BigInt(1) ? "s" : ""})
                </span>
              </div>
            </div>

            {/* Individual Claims by Content */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-400">Your Content Positions with Pending Rewards</h3>
              {pendingRewards.filter(r => r.pending > BigInt(0)).map((reward, index) => {
                const contentInfo = contentMetadataMap.get(reward.contentCid);
                const isExpanded = expandedContentCids.has(reward.contentCid);
                const hasMultipleNfts = reward.nftCount > BigInt(1);
                const nftRewards = reward.nftRewards || [];

                return (
                  <div
                    key={reward.contentCid}
                    className="bg-gray-800 rounded-lg overflow-hidden"
                  >
                    {/* Content Position Header */}
                    <div className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0 mr-3">
                        {hasMultipleNfts && (
                          <button
                            onClick={() => toggleExpanded(reward.contentCid)}
                            className="text-gray-400 hover:text-white p-1 -ml-1"
                            title={isExpanded ? "Collapse" : "Show per-NFT breakdown"}
                          >
                            <ChevronIcon expanded={isExpanded} />
                          </button>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {contentInfo?.title && contentInfo.title !== "Untitled"
                              ? contentInfo.title
                              : `Content ${reward.contentCid.slice(0, 8)}...`}
                          </div>
                          <div className="text-xs text-gray-500">
                            {reward.nftCount.toString()} NFT{hasMultipleNfts ? "s" : ""} owned
                          </div>
                        </div>
                      </div>
                      <span className="text-green-400 font-medium flex-shrink-0">
                        {formatSol(reward.pending)}
                      </span>
                    </div>

                    {/* Per-NFT Breakdown (Expandable) */}
                    {isExpanded && nftRewards.length > 0 && (
                      <div className="border-t border-gray-700 bg-gray-900/50 px-3 py-2">
                        <div className="text-xs text-gray-500 mb-2">Per-NFT Breakdown</div>
                        <div className="space-y-1">
                          {nftRewards.map((nft, nftIndex) => (
                            <div
                              key={nft.nftAsset.toBase58()}
                              className="flex items-center justify-between text-xs py-1"
                            >
                              <span className="text-gray-400 font-mono">
                                NFT #{nftIndex + 1} ({nft.nftAsset.toBase58().slice(0, 4)}...{nft.nftAsset.toBase58().slice(-4)})
                              </span>
                              <span className={nft.pending > BigInt(0) ? "text-green-400" : "text-gray-500"}>
                                {formatSol(nft.pending)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Claim All Button */}
            {pendingRewards.length > 1 && (
              <button
                onClick={handleClaimAll}
                disabled={isClaimingReward || claimingAll}
                className="w-full py-3 rounded-lg font-medium bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors"
              >
                {claimingAll
                  ? "Claiming..."
                  : `Claim All (${pendingRewards.filter(r => r.pending > BigInt(0)).length} positions)`}
              </button>
            )}

            {pendingRewards.length === 1 && (
              <button
                onClick={() => handleClaimSingle(0)}
                disabled={isClaimingReward}
                className="w-full py-3 rounded-lg font-medium bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors"
              >
                {isClaimingReward ? "Claiming..." : "Claim Reward"}
              </button>
            )}
          </div>
        )}

        {/* Info */}
        <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
          <p className="text-xs text-gray-400 text-center">
            Rewards accumulate from the 12% holder share when NFTs are minted.
          </p>
          <p className="text-xs text-amber-400/80 mt-2 text-center">
            Tip: Claim before selling your NFTs - unclaimed rewards transfer to the new owner.
          </p>
        </div>
      </div>
    </div>
  );
}
