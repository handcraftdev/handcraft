"use client";

import { useState, useMemo } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { Sidebar } from "@/components/sidebar";
import { useContentRegistry } from "@/hooks/useContentRegistry";
import { getIpfsUrl } from "@handcraft/sdk";
import { getTransactionErrorMessage } from "@/utils/wallet-errors";

const LAMPORTS_PER_SOL = 1_000_000_000;

export default function RewardsPage() {
  const { publicKey } = useWallet();

  const {
    globalContent,
    globalBundles,
    usePendingRewards,
    bundlePendingRewardsQuery,
    claimAllRewardsUnified,
    isClaimingReward,
    isClaimingBundleRewards,
  } = useContentRegistry();

  const [claimError, setClaimError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [expandedRewards, setExpandedRewards] = useState<Set<string>>(new Set());

  // Fetch pending rewards
  const { data: pendingRewards = [], isLoading: isLoadingContentRewards, refetch: refetchContentRewards } = usePendingRewards();
  const { data: bundlePendingRewards = [], isLoading: isLoadingBundleRewards, refetch: refetchBundleRewards } = bundlePendingRewardsQuery;
  const isLoadingRewards = isLoadingContentRewards || isLoadingBundleRewards;

  const toggleRewardExpanded = (key: string) => {
    setExpandedRewards(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Calculate stats
  const stats = useMemo(() => {
    const contentPendingRewards = pendingRewards.reduce(
      (acc, r) => acc + r.pending,
      BigInt(0)
    );
    const bundlePendingTotal = bundlePendingRewards.reduce(
      (acc, r) => acc + r.pending,
      BigInt(0)
    );
    const totalPendingRewards = contentPendingRewards + bundlePendingTotal;

    const contentPositions = pendingRewards.filter(r => r.pending > BigInt(0)).length;
    const bundlePositions = bundlePendingRewards.filter(r => r.pending > BigInt(0)).length;

    return {
      totalPendingRewards,
      contentPendingRewards,
      bundlePendingTotal,
      rewardPositions: contentPositions + bundlePositions,
      contentPositions,
      bundlePositions,
    };
  }, [pendingRewards, bundlePendingRewards]);

  // Not connected
  if (!publicKey) {
    return (
      <div className="min-h-screen bg-black text-white flex">
        <Sidebar />
        <main className="flex-1 min-w-0">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-4">Connect Wallet</h1>
              <p className="text-gray-400">Please connect your wallet to view your rewards</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-4xl mx-auto p-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Rewards</h1>
            <p className="text-gray-400">Claim your pending rewards from content and bundle positions</p>
          </div>

          {isLoadingRewards ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400"></div>
            </div>
          ) : stats.totalPendingRewards === BigInt(0) ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium mb-2">No pending rewards</h3>
              <p className="text-gray-400">You'll earn rewards when new NFTs are minted for content or bundles you hold.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary Card */}
              <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 rounded-xl p-6 border border-green-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-1">Total Claimable</h3>
                    <p className="text-3xl font-bold text-green-400">
                      {(Number(stats.totalPendingRewards) / LAMPORTS_PER_SOL).toFixed(6)} SOL
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      From {stats.rewardPositions} position{stats.rewardPositions > 1 ? "s" : ""}
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      if (!publicKey) return;
                      setClaimError(null);
                      setIsClaiming(true);
                      try {
                        const contentCidsToClaim = pendingRewards
                          .filter(r => r.pending > BigInt(0))
                          .map(r => r.contentCid);

                        const bundleRewardsToClaim = bundlePendingRewards
                          .filter(r => r.pending > BigInt(0))
                          .map(reward => ({
                            bundleId: reward.bundleId,
                            creator: new PublicKey(reward.creator.toBase58()),
                            nftAssets: reward.nftRewards
                              .filter(nft => nft.pending > BigInt(0))
                              .map(nft => new PublicKey(nft.nftAsset.toBase58())),
                          }))
                          .filter(r => r.nftAssets.length > 0);

                        await claimAllRewardsUnified({
                          contentCids: contentCidsToClaim,
                          bundleRewards: bundleRewardsToClaim,
                        });

                        refetchContentRewards();
                        refetchBundleRewards();
                      } catch (err) {
                        console.error("Failed to claim rewards:", err);
                        setClaimError(getTransactionErrorMessage(err));
                      } finally {
                        setIsClaiming(false);
                      }
                    }}
                    disabled={isClaiming || isClaimingReward || isClaimingBundleRewards}
                    className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                  >
                    {isClaiming ? "Claiming..." : "Claim All"}
                  </button>
                </div>
              </div>

              {claimError && (
                <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-400 text-sm">
                  {claimError}
                </div>
              )}

              {/* Content Rewards */}
              {stats.contentPositions > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary-400"></span>
                    Content Positions
                    <span className="text-xs text-gray-500">({(Number(stats.contentPendingRewards) / LAMPORTS_PER_SOL).toFixed(6)} SOL)</span>
                  </h3>
                  <div className="space-y-3">
                    {pendingRewards.filter(r => r.pending > BigInt(0)).map((reward) => {
                      const contentData = globalContent.find(c => c.contentCid === reward.contentCid);
                      const metadata = (contentData as any)?.metadata;
                      const title = metadata?.title || metadata?.name || `Content ${reward.contentCid.slice(0, 8)}...`;
                      const previewUrl = contentData?.previewCid ? getIpfsUrl(contentData.previewCid) : null;
                      const isExpanded = expandedRewards.has(`content-${reward.contentCid}`);
                      const hasMultipleNfts = reward.nftCount > BigInt(1);

                      return (
                        <div
                          key={reward.contentCid}
                          className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden"
                        >
                          <button
                            onClick={() => hasMultipleNfts && toggleRewardExpanded(`content-${reward.contentCid}`)}
                            className={`w-full p-4 flex items-center gap-4 ${hasMultipleNfts ? "cursor-pointer hover:bg-gray-800/50" : "cursor-default"} transition-colors`}
                          >
                            <div className="w-12 h-12 rounded-lg bg-gray-800 flex-shrink-0 overflow-hidden">
                              {previewUrl ? (
                                <img src={previewUrl} alt={title} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                              <h4 className="font-medium truncate text-sm">{title}</h4>
                              <p className="text-xs text-gray-500">
                                {reward.nftCount.toString()} NFT{hasMultipleNfts ? "s" : ""} owned
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-lg font-bold text-green-400">
                                {(Number(reward.pending) / LAMPORTS_PER_SOL).toFixed(6)}
                              </p>
                              <p className="text-xs text-gray-500">SOL</p>
                            </div>
                            {hasMultipleNfts && (
                              <svg
                                className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            )}
                          </button>
                          {isExpanded && reward.nftRewards && (
                            <div className="border-t border-gray-800 bg-gray-950/50">
                              <div className="p-3 space-y-2">
                                {reward.nftRewards
                                  .filter(nft => nft.pending > BigInt(0))
                                  .sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
                                  .map((nft, idx) => (
                                    <div
                                      key={nft.nftAsset.toBase58()}
                                      className="flex items-center justify-between px-3 py-2 bg-gray-900/50 rounded-lg"
                                    >
                                      <div className="flex items-center gap-3">
                                        <span className="text-xs text-gray-500 w-6">#{idx + 1}</span>
                                        <span className="text-xs font-mono text-gray-400">
                                          {nft.nftAsset.toBase58().slice(0, 4)}...{nft.nftAsset.toBase58().slice(-4)}
                                        </span>
                                      </div>
                                      <span className="text-sm font-medium text-green-400">
                                        {(Number(nft.pending) / LAMPORTS_PER_SOL).toFixed(6)} SOL
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
                </div>
              )}

              {/* Bundle Rewards */}
              {stats.bundlePositions > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-secondary-400"></span>
                    Bundle Positions
                    <span className="text-xs text-gray-500">({(Number(stats.bundlePendingTotal) / LAMPORTS_PER_SOL).toFixed(6)} SOL)</span>
                  </h3>
                  <div className="space-y-3">
                    {bundlePendingRewards.filter(r => r.pending > BigInt(0)).map((reward) => {
                      const bundleKey = `${reward.creator.toBase58()}-${reward.bundleId}`;
                      const isExpanded = expandedRewards.has(`bundle-${bundleKey}`);
                      const hasMultipleNfts = reward.nftCount > BigInt(1);

                      return (
                        <div
                          key={bundleKey}
                          className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden"
                        >
                          <button
                            onClick={() => hasMultipleNfts && toggleRewardExpanded(`bundle-${bundleKey}`)}
                            className={`w-full p-4 flex items-center gap-4 ${hasMultipleNfts ? "cursor-pointer hover:bg-gray-800/50" : "cursor-default"} transition-colors`}
                          >
                            <div className="w-12 h-12 rounded-lg bg-secondary-500/20 flex-shrink-0 flex items-center justify-center">
                              <svg className="w-5 h-5 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                              <h4 className="font-medium truncate text-sm flex items-center gap-2">
                                <span className="px-1.5 py-0.5 rounded text-xs bg-secondary-500/20 text-secondary-400">Bundle</span>
                                {reward.bundleId}
                              </h4>
                              <p className="text-xs text-gray-500">
                                {reward.nftCount.toString()} NFT{hasMultipleNfts ? "s" : ""} owned
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-lg font-bold text-green-400">
                                {(Number(reward.pending) / LAMPORTS_PER_SOL).toFixed(6)}
                              </p>
                              <p className="text-xs text-gray-500">SOL</p>
                            </div>
                            {hasMultipleNfts && (
                              <svg
                                className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            )}
                          </button>
                          {isExpanded && reward.nftRewards && (
                            <div className="border-t border-gray-800 bg-gray-950/50">
                              <div className="p-3 space-y-2">
                                {reward.nftRewards
                                  .filter(nft => nft.pending > BigInt(0))
                                  .sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
                                  .map((nft, idx) => (
                                    <div
                                      key={nft.nftAsset.toBase58()}
                                      className="flex items-center justify-between px-3 py-2 bg-gray-900/50 rounded-lg"
                                    >
                                      <div className="flex items-center gap-3">
                                        <span className="text-xs text-gray-500 w-6">#{idx + 1}</span>
                                        <span className="text-xs font-mono text-gray-400">
                                          {nft.nftAsset.toBase58().slice(0, 4)}...{nft.nftAsset.toBase58().slice(-4)}
                                        </span>
                                      </div>
                                      <span className="text-sm font-medium text-green-400">
                                        {(Number(nft.pending) / LAMPORTS_PER_SOL).toFixed(6)} SOL
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
                </div>
              )}

              {/* Info */}
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-sm text-gray-400 text-center">
                  Rewards accumulate from the 12% holder share when NFTs are minted.
                </p>
                <p className="text-sm text-amber-400/80 mt-2 text-center">
                  Tip: Claim before selling your NFTs - unclaimed rewards transfer to the new owner.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
