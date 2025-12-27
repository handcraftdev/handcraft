"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { SidebarPanel } from "@/components/sidebar";
import { useUnifiedRewards, formatSol, NftRewardData } from "@/hooks/useUnifiedRewards";
import { useContentRegistry } from "@/hooks/useContentRegistry";
import { EpochStatusCard } from "@/components/membership/EpochStatusCard";

type TabType = "my-rewards" | "ecosystem";

export default function RewardsClient() {
  const { publicKey } = useWallet();
  const [activeTab, setActiveTab] = useState<TabType>("my-rewards");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleSidebar = () => setIsSidebarOpen(prev => !prev);

  if (!publicKey) {
    return (
      <div className="min-h-screen bg-black text-white">
        <SidebarPanel isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <button
          onClick={toggleSidebar}
          className="fixed top-4 left-4 z-50 p-3 bg-black/60 backdrop-blur-md rounded-full border border-white/10 hover:border-white/30 transition-all"
        >
          <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center justify-center min-h-screen px-4">
          <div className="text-center max-w-sm">
            <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center backdrop-blur-sm border border-white/10">
              <svg className="w-6 h-6 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-medium text-white mb-1">Rewards</h2>
            <p className="text-white/40 text-base">Connect your wallet to view rewards</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <SidebarPanel isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <button
        onClick={toggleSidebar}
        className={`fixed top-4 z-50 p-3 bg-black/60 backdrop-blur-md rounded-full border border-white/10 hover:border-white/30 transition-all duration-300 ${isSidebarOpen ? 'left-[264px]' : 'left-4'}`}
      >
        <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Compact header bar */}
      <div className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-medium text-white">Rewards</h1>
            </div>
          </div>

          {/* Tabs in header - same as Profile page */}
          <div className="flex items-center gap-1 pb-3 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab("my-rewards")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 whitespace-nowrap ${
                activeTab === "my-rewards"
                  ? "bg-white text-black"
                  : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
              }`}
            >
              My Rewards
            </button>
            <button
              onClick={() => setActiveTab("ecosystem")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 whitespace-nowrap ${
                activeTab === "ecosystem"
                  ? "bg-white text-black"
                  : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
              }`}
            >
              Ecosystem
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
        {activeTab === "my-rewards" ? (
          <MyRewardsTab mounted={mounted} />
        ) : (
          <EcosystemTab />
        )}
      </main>
    </div>
  );
}

function MyRewardsTab({ mounted }: { mounted: boolean }) {
  const { publicKey } = useWallet();
  const { data, isLoading } = useUnifiedRewards();
  const { pendingRewardsQuery, bundlePendingRewardsQuery, client } = useContentRegistry();

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const toggleSection = (key: string) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  const creatorContentQuery = useQuery({
    queryKey: ["creatorContent", publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey || !client) return [];
      return client.fetchContentByCreator(publicKey);
    },
    enabled: !!publicKey && !!client,
    staleTime: 60000,
  });

  const creatorContent = creatorContentQuery.data || [];
  const isLoadingAny = isLoading || pendingRewardsQuery.isLoading || bundlePendingRewardsQuery.isLoading;

  const contentRewards = pendingRewardsQuery.data || [];
  const contentRewardsTotal = contentRewards.reduce((sum, r) => sum + r.pending, BigInt(0));

  const bundleRewards = bundlePendingRewardsQuery.data || [];
  const bundleRewardsTotal = bundleRewards.reduce((sum, r) => sum + r.pending, BigInt(0));

  if (!mounted || isLoadingAny) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const hasNfts = data && data.nfts.length > 0;
  const hasContentRewards = contentRewards.length > 0;
  const hasBundleRewards = bundleRewards.length > 0;
  const hasCreatorContent = creatorContent.length > 0;

  if (!hasNfts && !hasContentRewards && !hasBundleRewards && !hasCreatorContent) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center max-w-xs">
          <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
            <svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-white mb-1">No rewards yet</h3>
          <p className="text-white/40 text-base">Hold NFTs or publish content to earn rewards</p>
        </div>
      </div>
    );
  }

  // Calculate totals
  const salesTotal = contentRewardsTotal + bundleRewardsTotal;
  const globalHolderPending = data?.subscriptionRewards.globalHolder.pending || BigInt(0);
  const creatorPatronPending = data?.subscriptionRewards.creatorPatron.total || BigInt(0);
  const holderTotal = salesTotal + globalHolderPending + creatorPatronPending;

  const creatorDistPending = data?.subscriptionRewards.creatorDist.pending || BigInt(0);
  const creatorDistRps = data?.subscriptionRewards.creatorDist.poolRps || BigInt(0);
  const creatorWeight = data?.subscriptionRewards.creatorDist.creatorWeight || BigInt(0);
  const totalMintedFromContent = creatorContent.reduce((sum, c) => sum + Number(c.mintedCount || 0), 0);
  const isCreator = creatorWeight > BigInt(0) || hasCreatorContent;
  const creatorTotal = creatorDistPending;

  const grandTotal = holderTotal + creatorTotal;

  const unifiedRewardsByNft = new Map<string, NftRewardData>();
  data?.nfts.forEach(nft => {
    unifiedRewardsByNft.set(nft.nftAsset, nft);
  });

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20">
        <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-xs text-emerald-400/70 uppercase tracking-wider">Total Claimable</p>
          <p className="text-xl font-bold text-white">{formatSol(grandTotal)} <span className="text-sm text-emerald-400/80">SOL</span></p>
        </div>
      </div>

      {/* Creator section */}
      {isCreator && (
        <div className="rounded-lg border border-pink-500/20 overflow-hidden">
          <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-pink-500/10 to-transparent">
            <div className="w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-medium text-white">Creator Rewards</p>
              <p className="text-xs text-white/40">{creatorContent.length} content · {totalMintedFromContent} sold</p>
            </div>
            <p className="text-lg font-bold text-pink-400">{formatSol(creatorTotal)}</p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-px bg-white/[0.03]">
            <div className="p-2.5 bg-black text-center">
              <p className="text-xs text-white/40 mb-0.5">Content</p>
              <p className="text-sm font-medium text-white/80">{creatorContent.length}</p>
            </div>
            <div className="p-2.5 bg-black text-center">
              <p className="text-xs text-white/40 mb-0.5">NFTs Sold</p>
              <p className="text-sm font-medium text-white/80">{totalMintedFromContent}</p>
            </div>
            <div className="p-2.5 bg-black text-center">
              <p className="text-xs text-white/40 mb-0.5">Weight</p>
              <p className="text-sm font-medium text-pink-400">{creatorWeight.toString()}</p>
            </div>
          </div>

          {/* Subscription detail */}
          <button
            onClick={() => toggleSection("creator-sub")}
            className="w-full p-2.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors border-t border-white/[0.04]"
          >
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-pink-400" />
              <span className="text-sm text-white/60">Subscription Pool</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-pink-400">{formatSol(creatorDistPending)}</span>
              <svg className={`w-3 h-3 text-white/30 transition-transform ${expandedSections["creator-sub"] ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {expandedSections["creator-sub"] && (
            <div className="p-3 bg-white/[0.01] border-t border-white/[0.04] text-xs space-y-1.5">
              <div className="flex justify-between text-white/40">
                <span>Pool RPS (Virtual)</span>
                <span className="font-mono text-white/60">{creatorDistRps.toString()}</span>
              </div>
              <div className="flex justify-between text-white/40">
                <span>Your Weight</span>
                <span className="font-mono text-pink-400">{creatorWeight.toString()}</span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-white/[0.04]">
                <span className="text-white/50">Pending</span>
                <span className="font-medium text-pink-400">{formatSol(creatorDistPending)} SOL</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Holder section */}
      {(hasNfts || hasContentRewards || hasBundleRewards) && (
        <div className="rounded-lg border border-cyan-500/20 overflow-hidden">
          <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-cyan-500/10 to-transparent">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-medium text-white">Holder Rewards</p>
              <p className="text-xs text-white/40">{data?.nfts.length || 0} NFTs · Weight: {data?.totalWeight || 0}</p>
            </div>
            <p className="text-lg font-bold text-cyan-400">{formatSol(holderTotal)}</p>
          </div>

          {/* Source breakdown */}
          <div className="grid grid-cols-3 gap-px bg-white/[0.03]">
            <div className="p-2.5 bg-black text-center">
              <p className="text-xs text-purple-400/70 mb-0.5">Sales</p>
              <p className="text-sm font-medium text-purple-400">{formatSol(salesTotal)}</p>
            </div>
            <div className="p-2.5 bg-black text-center">
              <p className="text-xs text-emerald-400/70 mb-0.5">Subs</p>
              <p className="text-sm font-medium text-emerald-400">{formatSol(globalHolderPending)}</p>
            </div>
            <div className="p-2.5 bg-black text-center">
              <p className="text-xs text-amber-400/70 mb-0.5">Member</p>
              <p className="text-sm font-medium text-amber-400">{formatSol(creatorPatronPending)}</p>
            </div>
          </div>

          {/* NFT breakdown */}
          <div className="divide-y divide-white/[0.04]">
            {contentRewards.length > 0 && bundleRewards.length > 0 && (
              <div className="px-3 py-2 bg-gradient-to-r from-purple-500/5 to-transparent">
                <p className="text-xs font-medium text-purple-400/80 uppercase tracking-wider">Content NFTs</p>
              </div>
            )}

            {contentRewards.map((content) => {
              const contentCid = content.contentCid;
              const contentSalesTotal = content.pending;
              const nftRewards = content.nftRewards || [];
              const nftCount = Number(content.nftCount || nftRewards.length);

              let contentSubsTotal = BigInt(0);
              let contentMemTotal = BigInt(0);
              nftRewards.forEach(nftReward => {
                const unifiedData = unifiedRewardsByNft.get(nftReward.nftAsset.toBase58());
                if (unifiedData) {
                  contentSubsTotal += unifiedData.globalHolderPending;
                  contentMemTotal += unifiedData.patronPending;
                }
              });

              const contentTotal = contentSalesTotal + contentSubsTotal + contentMemTotal;
              const isExpanded = expandedSections[`content-${contentCid}`];

              return (
                <div key={contentCid}>
                  <button
                    onClick={() => toggleSection(`content-${contentCid}`)}
                    className="w-full p-2.5 flex items-center gap-3 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="w-6 h-6 rounded bg-white/[0.04] flex items-center justify-center text-xs text-white/40 flex-shrink-0">
                      {nftCount}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-xs font-mono text-white/60 truncate">{contentCid}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-purple-400">{formatSol(contentSalesTotal)}</span>
                      <span className="text-emerald-400">{formatSol(contentSubsTotal)}</span>
                      <span className="text-amber-400">{formatSol(contentMemTotal)}</span>
                    </div>
                    <span className="text-sm font-medium text-cyan-400 w-16 text-right">{formatSol(contentTotal)}</span>
                    <svg className={`w-3 h-3 text-white/30 transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-3">
                      <div className="rounded-lg bg-white/[0.02] overflow-hidden">
                        <div className="grid grid-cols-7 gap-2 px-2 py-1.5 text-2xs text-white/40 border-b border-white/[0.04]">
                          <div className="col-span-2">NFT</div>
                          <div>Rarity</div>
                          <div className="text-right">Wt</div>
                          <div className="text-right text-purple-400/70">Sales</div>
                          <div className="text-right text-emerald-400/70">Subs</div>
                          <div className="text-right text-amber-400/70">Mem</div>
                        </div>
                        {nftRewards.map((nftReward) => {
                          const nftAsset = nftReward.nftAsset.toBase58();
                          const unifiedData = unifiedRewardsByNft.get(nftAsset);
                          const rarity = unifiedData?.rarity || "Common";
                          const nftSales = nftReward.pending;
                          const nftSubs = unifiedData?.globalHolderPending || BigInt(0);
                          const nftMember = unifiedData?.patronPending || BigInt(0);

                          const rarityColors: Record<string, string> = {
                            Common: "text-white/50",
                            Uncommon: "text-green-400",
                            Rare: "text-blue-400",
                            Epic: "text-purple-400",
                            Legendary: "text-amber-400",
                          };

                          return (
                            <div key={nftAsset} className="grid grid-cols-7 gap-2 px-2 py-1.5 text-xs border-b border-white/[0.02] last:border-0">
                              <div className="col-span-2 font-mono text-white/50 truncate">{nftAsset.slice(0, 8)}...</div>
                              <div className={rarityColors[rarity]}>{rarity}</div>
                              <div className="text-right text-white/60">{nftReward.weight}</div>
                              <div className="text-right text-purple-400">{formatSol(nftSales)}</div>
                              <div className="text-right text-emerald-400">{formatSol(nftSubs)}</div>
                              <div className="text-right text-amber-400">{formatSol(nftMember)}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {bundleRewards.length > 0 && (
              <>
                {contentRewards.length > 0 && (
                  <div className="px-3 py-2 bg-gradient-to-r from-indigo-500/5 to-transparent">
                    <p className="text-xs font-medium text-indigo-400/80 uppercase tracking-wider">Bundle NFTs</p>
                  </div>
                )}

                {bundleRewards.map((bundle) => {
                  const bundleId = bundle.bundleId;
                  const bundleSalesTotal = bundle.pending;
                  const nftRewards = bundle.nftRewards || [];
                  const nftCount = Number(bundle.nftCount || nftRewards.length);

                  let bundleSubsTotal = BigInt(0);
                  let bundleMemTotal = BigInt(0);
                  nftRewards.forEach(nftReward => {
                    const unifiedData = unifiedRewardsByNft.get(nftReward.nftAsset.toBase58());
                    if (unifiedData) {
                      bundleSubsTotal += unifiedData.globalHolderPending;
                      bundleMemTotal += unifiedData.patronPending;
                    }
                  });

                  const bundleTotal = bundleSalesTotal + bundleSubsTotal + bundleMemTotal;
                  const isExpanded = expandedSections[`bundle-${bundleId}`];
                  const missingRewardCount = nftCount - nftRewards.length;

                  return (
                    <div key={bundleId}>
                      <button
                        onClick={() => toggleSection(`bundle-${bundleId}`)}
                        className="w-full p-2.5 flex items-center gap-3 hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="w-6 h-6 rounded bg-indigo-500/10 flex items-center justify-center text-xs text-indigo-400 flex-shrink-0">
                          {nftCount}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-xs font-mono text-white/60 truncate">{bundleId}</p>
                          {missingRewardCount > 0 && (
                            <p className="text-2xs text-amber-400/60">{missingRewardCount} legacy</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-purple-400">{formatSol(bundleSalesTotal)}</span>
                          <span className="text-emerald-400">{formatSol(bundleSubsTotal)}</span>
                          <span className="text-amber-400">{formatSol(bundleMemTotal)}</span>
                        </div>
                        <span className="text-sm font-medium text-indigo-400 w-16 text-right">{formatSol(bundleTotal)}</span>
                        <svg className={`w-3 h-3 text-white/30 transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {isExpanded && (
                        <div className="px-3 pb-3">
                          {missingRewardCount > 0 && (
                            <div className="mb-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                              <p className="text-2xs text-amber-400/80">
                                {missingRewardCount} NFT{missingRewardCount > 1 ? "s" : ""} minted before reward tracking.
                              </p>
                            </div>
                          )}
                          {nftRewards.length > 0 && (
                            <div className="rounded-lg bg-white/[0.02] overflow-hidden">
                              <div className="grid grid-cols-7 gap-2 px-2 py-1.5 text-2xs text-white/40 border-b border-white/[0.04]">
                                <div className="col-span-2">NFT</div>
                                <div>Rarity</div>
                                <div className="text-right">Wt</div>
                                <div className="text-right text-purple-400/70">Sales</div>
                                <div className="text-right text-emerald-400/70">Subs</div>
                                <div className="text-right text-amber-400/70">Mem</div>
                              </div>
                              {nftRewards.map((nftReward) => {
                                const nftAsset = nftReward.nftAsset.toBase58();
                                const unifiedData = unifiedRewardsByNft.get(nftAsset);
                                const rarity = unifiedData?.rarity || "Common";
                                const nftSales = nftReward.pending;
                                const nftSubs = unifiedData?.globalHolderPending || BigInt(0);
                                const nftMember = unifiedData?.patronPending || BigInt(0);

                                const rarityColors: Record<string, string> = {
                                  Common: "text-white/50",
                                  Uncommon: "text-green-400",
                                  Rare: "text-blue-400",
                                  Epic: "text-purple-400",
                                  Legendary: "text-amber-400",
                                };

                                return (
                                  <div key={nftAsset} className="grid grid-cols-7 gap-2 px-2 py-1.5 text-xs border-b border-white/[0.02] last:border-0">
                                    <div className="col-span-2 font-mono text-white/50 truncate">{nftAsset.slice(0, 8)}...</div>
                                    <div className={rarityColors[rarity]}>{rarity}</div>
                                    <div className="text-right text-white/60">{nftReward.weight}</div>
                                    <div className="text-right text-purple-400">{formatSol(nftSales)}</div>
                                    <div className="text-right text-emerald-400">{formatSol(nftSubs)}</div>
                                    <div className="text-right text-amber-400">{formatSol(nftMember)}</div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EcosystemTab() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-cyan-500/10 via-cyan-500/5 to-transparent border border-cyan-500/20">
        <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-base font-medium text-white">Ecosystem Overview</p>
          <p className="text-xs text-white/40">
            Fee split: <span className="text-cyan-400/80">12% holders</span> · <span className="text-purple-400/80">80% creators</span> · <span className="text-white/50">8% ecosystem</span>
          </p>
        </div>
      </div>

      <EpochStatusCard />
    </div>
  );
}
