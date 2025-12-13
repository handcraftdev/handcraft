"use client";

import { useState, useMemo, useCallback } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { SidebarPanel } from "@/components/sidebar";
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

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [expandedRewards, setExpandedRewards] = useState<Set<string>>(new Set());

  const toggleSidebar = useCallback(() => setIsSidebarOpen(prev => !prev), []);

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
      <div className="min-h-screen bg-black text-white">
        <SidebarPanel isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

        {/* Menu Button */}
        <button
          onClick={toggleSidebar}
          className="fixed top-4 left-4 z-50 p-3 bg-white/5 backdrop-blur-md rounded-full border border-white/10 hover:border-white/20 transition-all"
        >
          <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="flex items-center justify-center min-h-screen px-6">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-3 tracking-tight">Connect Wallet</h1>
            <p className="text-white/40 max-w-sm mx-auto">Please connect your wallet to view your rewards</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <SidebarPanel isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Menu Button */}
      <button
        onClick={toggleSidebar}
        className={`fixed top-4 z-50 p-3 bg-white/5 backdrop-blur-md rounded-full border border-white/10 hover:border-white/20 transition-all duration-300 ${isSidebarOpen ? 'left-[296px]' : 'left-4'}`}
      >
        <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <main className="max-w-4xl mx-auto px-6 py-20">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Rewards</h1>
          <p className="text-white/40">Claim your pending rewards from content and bundle positions</p>
        </div>

        {isLoadingRewards ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        ) : stats.totalPendingRewards === BigInt(0) ? (
          <div className="relative p-16 rounded-2xl bg-white/[0.02] border border-white/5 text-center">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium mb-2">No pending rewards</h3>
            <p className="text-white/40 text-sm max-w-md mx-auto">You'll earn rewards when new NFTs are minted for content or bundles you hold.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Card */}
            <div className="relative rounded-2xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-emerald-600/5" />
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

              <div className="relative p-6 border border-emerald-500/20 rounded-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/40 mb-2">Total Claimable</p>
                    <p className="text-4xl font-bold tracking-tight text-emerald-400">
                      {(Number(stats.totalPendingRewards) / LAMPORTS_PER_SOL).toFixed(6)}
                    </p>
                    <p className="text-white/40 mt-1">SOL</p>
                    <p className="text-sm text-white/30 mt-3">
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
                    className="px-8 py-4 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 hover:border-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium transition-all duration-300 backdrop-blur-sm"
                  >
                    {isClaiming ? (
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Claiming...
                      </span>
                    ) : "Claim All"}
                  </button>
                </div>
              </div>
            </div>

            {claimError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
                {claimError}
              </div>
            )}

            {/* Content Rewards */}
            {stats.contentPositions > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-2 h-2 rounded-full bg-primary-400" />
                  <h3 className="text-[11px] uppercase tracking-[0.2em] text-white/40">Content Positions</h3>
                  <span className="text-xs text-white/30">({(Number(stats.contentPendingRewards) / LAMPORTS_PER_SOL).toFixed(6)} SOL)</span>
                </div>
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
                        className="group relative rounded-xl bg-white/[0.02] border border-white/5 overflow-hidden hover:border-white/10 transition-all duration-300"
                      >
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                        <button
                          onClick={() => hasMultipleNfts && toggleRewardExpanded(`content-${reward.contentCid}`)}
                          className={`relative w-full p-4 flex items-center gap-4 ${hasMultipleNfts ? "cursor-pointer" : "cursor-default"} transition-colors`}
                        >
                          <div className="w-12 h-12 rounded-lg bg-white/5 flex-shrink-0 overflow-hidden">
                            {previewUrl ? (
                              <img src={previewUrl} alt={title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <svg className="w-5 h-5 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <h4 className="font-medium truncate text-sm text-white/90">{title}</h4>
                            <p className="text-xs text-white/40">
                              {reward.nftCount.toString()} NFT{hasMultipleNfts ? "s" : ""} owned
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-lg font-bold text-emerald-400">
                              {(Number(reward.pending) / LAMPORTS_PER_SOL).toFixed(6)}
                            </p>
                            <p className="text-xs text-white/30">SOL</p>
                          </div>
                          {hasMultipleNfts && (
                            <svg
                              className={`w-5 h-5 text-white/30 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          )}
                        </button>
                        {isExpanded && reward.nftRewards && (
                          <div className="border-t border-white/5 bg-white/[0.01]">
                            <div className="p-3 space-y-2">
                              {reward.nftRewards
                                .filter(nft => nft.pending > BigInt(0))
                                .sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
                                .map((nft, idx) => (
                                  <div
                                    key={nft.nftAsset.toBase58()}
                                    className="flex items-center justify-between px-3 py-2 bg-white/[0.02] rounded-lg"
                                  >
                                    <div className="flex items-center gap-3">
                                      <span className="text-xs text-white/30 w-6">#{idx + 1}</span>
                                      <span className="text-xs font-mono text-white/50">
                                        {nft.nftAsset.toBase58().slice(0, 4)}...{nft.nftAsset.toBase58().slice(-4)}
                                      </span>
                                    </div>
                                    <span className="text-sm font-medium text-emerald-400">
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
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-2 h-2 rounded-full bg-secondary-400" />
                  <h3 className="text-[11px] uppercase tracking-[0.2em] text-white/40">Bundle Positions</h3>
                  <span className="text-xs text-white/30">({(Number(stats.bundlePendingTotal) / LAMPORTS_PER_SOL).toFixed(6)} SOL)</span>
                </div>
                <div className="space-y-3">
                  {bundlePendingRewards.filter(r => r.pending > BigInt(0)).map((reward) => {
                    const bundleKey = `${reward.creator.toBase58()}-${reward.bundleId}`;
                    const isExpanded = expandedRewards.has(`bundle-${bundleKey}`);
                    const hasMultipleNfts = reward.nftCount > BigInt(1);

                    return (
                      <div
                        key={bundleKey}
                        className="group relative rounded-xl bg-white/[0.02] border border-white/5 overflow-hidden hover:border-white/10 transition-all duration-300"
                      >
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                        <button
                          onClick={() => hasMultipleNfts && toggleRewardExpanded(`bundle-${bundleKey}`)}
                          className={`relative w-full p-4 flex items-center gap-4 ${hasMultipleNfts ? "cursor-pointer" : "cursor-default"} transition-colors`}
                        >
                          <div className="w-12 h-12 rounded-lg bg-secondary-500/10 flex-shrink-0 flex items-center justify-center">
                            <svg className="w-5 h-5 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <h4 className="font-medium truncate text-sm flex items-center gap-2 text-white/90">
                              <span className="px-2 py-0.5 rounded bg-secondary-500/20 text-secondary-400 text-[10px] uppercase tracking-wider">Bundle</span>
                              {reward.bundleId}
                            </h4>
                            <p className="text-xs text-white/40">
                              {reward.nftCount.toString()} NFT{hasMultipleNfts ? "s" : ""} owned
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-lg font-bold text-emerald-400">
                              {(Number(reward.pending) / LAMPORTS_PER_SOL).toFixed(6)}
                            </p>
                            <p className="text-xs text-white/30">SOL</p>
                          </div>
                          {hasMultipleNfts && (
                            <svg
                              className={`w-5 h-5 text-white/30 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          )}
                        </button>
                        {isExpanded && reward.nftRewards && (
                          <div className="border-t border-white/5 bg-white/[0.01]">
                            <div className="p-3 space-y-2">
                              {reward.nftRewards
                                .filter(nft => nft.pending > BigInt(0))
                                .sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
                                .map((nft, idx) => (
                                  <div
                                    key={nft.nftAsset.toBase58()}
                                    className="flex items-center justify-between px-3 py-2 bg-white/[0.02] rounded-lg"
                                  >
                                    <div className="flex items-center gap-3">
                                      <span className="text-xs text-white/30 w-6">#{idx + 1}</span>
                                      <span className="text-xs font-mono text-white/50">
                                        {nft.nftAsset.toBase58().slice(0, 4)}...{nft.nftAsset.toBase58().slice(-4)}
                                      </span>
                                    </div>
                                    <span className="text-sm font-medium text-emerald-400">
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
            <div className="relative p-5 rounded-xl bg-white/[0.02] border border-white/5">
              <p className="text-sm text-white/40 text-center">
                Rewards accumulate from the 12% holder share when NFTs are minted.
              </p>
              <p className="text-sm text-amber-400/60 mt-3 text-center">
                Tip: Claim before selling your NFTs - unclaimed rewards transfer to the new owner.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
