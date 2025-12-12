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
    claimAllRewardsUnified,
    claimBundleRewards,
    isClaimingReward,
    isClaimingBundleRewards,
    usePendingRewards,
    bundlePendingRewardsQuery,
    globalContent,
    globalBundles,
  } = useContentRegistry();

  const { data: pendingRewards, isLoading: isLoadingContentPending, refetch: refetchContent } = usePendingRewards();
  const { data: bundlePendingRewards, isLoading: isLoadingBundlePending, refetch: refetchBundle } = bundlePendingRewardsQuery;

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

  // Create a map of bundleId -> bundle metadata for display
  const bundleMetadataMap = useMemo(() => {
    const map = new Map<string, { title: string; creator: string }>();
    for (const bundle of globalBundles) {
      const key = `${bundle.creator.toBase58()}-${bundle.bundleId}`;
      // Bundle type from SDK doesn't include metadata, just use bundleId
      map.set(key, {
        title: bundle.bundleId,
        creator: bundle.creator?.toBase58().slice(0, 6) + "..." || "Unknown",
      });
    }
    return map;
  }, [globalBundles]);

  const [error, setError] = useState<string | null>(null);
  const [claimingAll, setClaimingAll] = useState(false);
  const [expandedContentCids, setExpandedContentCids] = useState<Set<string>>(new Set());
  const [expandedBundleIds, setExpandedBundleIds] = useState<Set<string>>(new Set());

  const toggleContentExpanded = (contentCid: string) => {
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

  const toggleBundleExpanded = (bundleKey: string) => {
    setExpandedBundleIds((prev) => {
      const next = new Set(prev);
      if (next.has(bundleKey)) {
        next.delete(bundleKey);
      } else {
        next.add(bundleKey);
      }
      return next;
    });
  };

  // Calculate total pending rewards (content + bundle)
  const contentTotalPending = pendingRewards?.reduce((acc, r) => acc + r.pending, BigInt(0)) || BigInt(0);
  const bundleTotalPending = bundlePendingRewards?.reduce((acc, r) => acc + r.pending, BigInt(0)) || BigInt(0);
  const totalPending = contentTotalPending + bundleTotalPending;

  // Calculate total NFT counts
  const contentNftCount = pendingRewards?.reduce((acc, r) => acc + r.nftCount, BigInt(0)) || BigInt(0);
  const bundleNftCount = bundlePendingRewards?.reduce((acc, r) => acc + r.nftCount, BigInt(0)) || BigInt(0);
  const totalNftCount = contentNftCount + bundleNftCount;

  // Position counts
  const contentPositionCount = pendingRewards?.filter(r => r.pending > BigInt(0)).length || 0;
  const bundlePositionCount = bundlePendingRewards?.filter(r => r.pending > BigInt(0)).length || 0;
  const totalPositionCount = contentPositionCount + bundlePositionCount;

  const formatSol = (lamports: bigint) => {
    return `${(Number(lamports) / LAMPORTS_PER_SOL).toFixed(6)} SOL`;
  };

  const handleClaimContentSingle = async (index: number) => {
    if (!publicKey || !pendingRewards) return;

    const reward = pendingRewards[index];
    if (!reward) return;

    setError(null);
    setClaimingAll(true);

    try {
      await claimRewardsVerified({
        contentCid: reward.contentCid,
      });
      refetchContent();
      refetchBundle();
      onSuccess?.();
    } catch (err) {
      console.error("Failed to claim reward:", err);
      setError(getTransactionErrorMessage(err));
    } finally {
      setClaimingAll(false);
    }
  };

  const handleClaimBundleSingle = async (bundleId: string, creator: { toBase58(): string }, nftAssets: { toBase58(): string }[]) => {
    if (!publicKey) return;

    setError(null);
    setClaimingAll(true);

    try {
      // Claim for each NFT in the bundle position
      for (const nftAsset of nftAssets) {
        const { PublicKey } = await import("@solana/web3.js");
        await claimBundleRewards.mutateAsync({
          bundleId,
          creator: new PublicKey(creator.toBase58()),
          nftAsset: new PublicKey(nftAsset.toBase58()),
        });
      }
      refetchContent();
      refetchBundle();
      onSuccess?.();
    } catch (err) {
      console.error("Failed to claim bundle reward:", err);
      setError(getTransactionErrorMessage(err));
    } finally {
      setClaimingAll(false);
    }
  };

  const handleClaimAll = async () => {
    if (!publicKey) return;

    setError(null);
    setClaimingAll(true);

    try {
      const { PublicKey } = await import("@solana/web3.js");

      // Collect content CIDs to claim
      const contentCidsToClaim = pendingRewards
        ?.filter(r => r.pending > BigInt(0))
        .map(r => r.contentCid) || [];

      // Collect bundle rewards to claim
      const bundleRewardsToClaim = bundlePendingRewards
        ?.filter(r => r.pending > BigInt(0))
        .map(reward => ({
          bundleId: reward.bundleId,
          creator: new PublicKey(reward.creator.toBase58()),
          nftAssets: reward.nftRewards
            .filter(nft => nft.pending > BigInt(0))
            .map(nft => new PublicKey(nft.nftAsset.toBase58())),
        }))
        .filter(r => r.nftAssets.length > 0) || [];

      // Claim all in one unified call (batched efficiently)
      await claimAllRewardsUnified({
        contentCids: contentCidsToClaim,
        bundleRewards: bundleRewardsToClaim,
      });

      refetchContent();
      refetchBundle();
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

  const isLoading = isLoadingContentPending || isLoadingBundlePending;
  const isClaiming = isClaimingReward || isClaimingBundleRewards || claimingAll;
  const hasRewards = totalPending > BigInt(0);

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
              You'll earn rewards when new NFTs are minted for content or bundles you hold.
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
                  {totalPositionCount} position{totalPositionCount > 1 ? "s" : ""} ({totalNftCount.toString()} NFT{totalNftCount > BigInt(1) ? "s" : ""})
                </span>
              </div>
            </div>

            {/* Content Rewards Section */}
            {contentPositionCount > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary-400"></span>
                  Content Positions
                  <span className="text-xs text-gray-500">({formatSol(contentTotalPending)})</span>
                </h3>
                {pendingRewards?.filter(r => r.pending > BigInt(0)).map((reward, index) => {
                  const contentInfo = contentMetadataMap.get(reward.contentCid);
                  const isExpanded = expandedContentCids.has(reward.contentCid);
                  const hasMultipleNfts = reward.nftCount > BigInt(1);
                  const nftRewards = reward.nftRewards || [];

                  return (
                    <div
                      key={reward.contentCid}
                      className="bg-gray-800 rounded-lg overflow-hidden"
                    >
                      <div className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0 mr-3">
                          {hasMultipleNfts && (
                            <button
                              onClick={() => toggleContentExpanded(reward.contentCid)}
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
            )}

            {/* Bundle Rewards Section */}
            {bundlePositionCount > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-secondary-400"></span>
                  Bundle Positions
                  <span className="text-xs text-gray-500">({formatSol(bundleTotalPending)})</span>
                </h3>
                {bundlePendingRewards?.filter(r => r.pending > BigInt(0)).map((reward) => {
                  const bundleKey = `${reward.creator.toBase58()}-${reward.bundleId}`;
                  const bundleInfo = bundleMetadataMap.get(bundleKey);
                  const isExpanded = expandedBundleIds.has(bundleKey);
                  const hasMultipleNfts = reward.nftCount > BigInt(1);
                  const nftRewards = reward.nftRewards || [];

                  return (
                    <div
                      key={bundleKey}
                      className="bg-gray-800 rounded-lg overflow-hidden"
                    >
                      <div className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0 mr-3">
                          {hasMultipleNfts && (
                            <button
                              onClick={() => toggleBundleExpanded(bundleKey)}
                              className="text-gray-400 hover:text-white p-1 -ml-1"
                              title={isExpanded ? "Collapse" : "Show per-NFT breakdown"}
                            >
                              <ChevronIcon expanded={isExpanded} />
                            </button>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate flex items-center gap-2">
                              <span className="px-1.5 py-0.5 rounded text-xs bg-secondary-500/20 text-secondary-400">Bundle</span>
                              {bundleInfo?.title || reward.bundleId.slice(0, 8) + "..."}
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
            )}

            {error && (
              <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Claim All Button */}
            <button
              onClick={handleClaimAll}
              disabled={isClaiming}
              className="w-full py-3 rounded-lg font-medium bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors"
            >
              {claimingAll
                ? "Claiming..."
                : `Claim All (${totalPositionCount} position${totalPositionCount > 1 ? "s" : ""})`}
            </button>
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
