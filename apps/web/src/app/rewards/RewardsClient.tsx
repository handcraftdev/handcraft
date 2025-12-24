"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { PublicKey } from "@solana/web3.js";
import { SidebarPanel } from "@/components/sidebar";
import { useUnifiedRewards, formatSol, NftRewardData } from "@/hooks/useUnifiedRewards";
import { useContentRegistry } from "@/hooks/useContentRegistry";
import { EpochStatusCard } from "@/components/membership/EpochStatusCard";

const LAMPORTS_PER_SOL = 1_000_000_000;

type TabType = "my-rewards" | "ecosystem";

export default function RewardsClient() {
  const { publicKey } = useWallet();
  const [activeTab, setActiveTab] = useState<TabType>("my-rewards");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Avoid hydration mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleSidebar = () => setIsSidebarOpen(prev => !prev);

  // Not connected
  if (!publicKey) {
    return (
      <div className="min-h-screen bg-black text-white">
        <SidebarPanel isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
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

      <button
        onClick={toggleSidebar}
        className={`fixed top-4 z-50 p-3 bg-white/5 backdrop-blur-md rounded-full border border-white/10 hover:border-white/20 transition-all duration-300 ${isSidebarOpen ? 'left-[304px]' : 'left-4'}`}
      >
        <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <main className="max-w-5xl mx-auto px-6 py-20">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Rewards</h1>
          <p className="text-white/40">View and claim your pending rewards</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-8 p-1 bg-white/[0.02] border border-white/5 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab("my-rewards")}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === "my-rewards"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "text-white/50 hover:text-white/70 hover:bg-white/5"
            }`}
          >
            My Rewards
          </button>
          <button
            onClick={() => setActiveTab("ecosystem")}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === "ecosystem"
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                : "text-white/50 hover:text-white/70 hover:bg-white/5"
            }`}
          >
            Ecosystem
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "my-rewards" ? (
          <MyRewardsTab mounted={mounted} />
        ) : (
          <EcosystemTab />
        )}
      </main>
    </div>
  );
}

// ============================================
// MY REWARDS TAB
// ============================================
function MyRewardsTab({ mounted }: { mounted: boolean }) {
  const { publicKey } = useWallet();
  const { data, isLoading } = useUnifiedRewards();
  const { pendingRewardsQuery, bundlePendingRewardsQuery, client } = useContentRegistry();

  // Expand/collapse states
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const toggleSection = (key: string) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  // Fetch content created by this user
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

  // Calculate content rewards total from pendingRewardsQuery
  const contentRewards = pendingRewardsQuery.data || [];
  const contentRewardsTotal = contentRewards.reduce(
    (sum, r) => sum + r.pending,
    BigInt(0)
  );

  // Calculate bundle rewards total from bundlePendingRewardsQuery
  const bundleRewards = bundlePendingRewardsQuery.data || [];
  const bundleRewardsTotal = bundleRewards.reduce(
    (sum, r) => sum + r.pending,
    BigInt(0)
  );

  if (!mounted || isLoadingAny) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-40 bg-white/5 rounded-2xl mb-6" />
          <div className="h-64 bg-white/5 rounded-2xl" />
        </div>
      </div>
    );
  }

  const hasNfts = data && data.nfts.length > 0;
  const hasContentRewards = contentRewards.length > 0;
  const hasBundleRewards = bundleRewards.length > 0;
  const hasCreatorContent = creatorContent.length > 0;

  // Only show "no rewards" if user has no NFTs, no content rewards, no bundle rewards, AND no created content
  if (!hasNfts && !hasContentRewards && !hasBundleRewards && !hasCreatorContent) {
    return (
      <div className="relative p-16 rounded-2xl bg-white/[0.02] border border-white/5 text-center">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium mb-2">No Rewards Yet</h3>
        <p className="text-white/40 text-sm max-w-md mx-auto">
          Hold NFTs to earn from sales and subscriptions, or publish content to earn creator rewards.
        </p>
      </div>
    );
  }

  // ============================================
  // HOLDER REWARDS (based on NFTs owned)
  // ============================================
  const salesTotal = contentRewardsTotal + bundleRewardsTotal;
  const globalHolderPending = data?.subscriptionRewards.globalHolder.pending || BigInt(0);
  const globalHolderRps = data?.subscriptionRewards.globalHolder.poolRps || BigInt(0);
  const creatorPatronPending = data?.subscriptionRewards.creatorPatron.total || BigInt(0);
  const holderTotal = salesTotal + globalHolderPending + creatorPatronPending;

  // ============================================
  // CREATOR REWARDS (based on content created)
  // ============================================
  const creatorDistPending = data?.subscriptionRewards.creatorDist.pending || BigInt(0);
  const creatorDistRps = data?.subscriptionRewards.creatorDist.poolRps || BigInt(0);
  const creatorWeight = data?.subscriptionRewards.creatorDist.creatorWeight || BigInt(0);
  const totalMintedFromContent = creatorContent.reduce((sum, c) => sum + Number(c.mintedCount || 0), 0);
  const isCreator = creatorWeight > BigInt(0) || hasCreatorContent;
  const creatorTotal = creatorDistPending;

  const grandTotal = holderTotal + creatorTotal;

  // Create lookup map from unified rewards by NFT asset (for subs/member data)
  const unifiedRewardsByNft = new Map<string, NftRewardData>();
  data?.nfts.forEach(nft => {
    unifiedRewardsByNft.set(nft.nftAsset, nft);
  });

  return (
    <div className="space-y-8">
      {/* ============================================ */}
      {/* SUMMARY BANNER */}
      {/* ============================================ */}
      <div className="relative rounded-3xl overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 via-emerald-600/5 to-transparent" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/15 rounded-full blur-[100px] -translate-y-1/2" />

        <div className="relative border border-emerald-500/20 rounded-3xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-emerald-400/70 mb-1">Total Claimable</p>
              <p className="text-4xl font-bold text-white">
                {formatSol(grandTotal)} <span className="text-xl text-emerald-400/80">SOL</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================ */}
      {/* AS CREATOR SECTION */}
      {/* ============================================ */}
      {isCreator && (
        <div className="rounded-2xl border border-pink-500/20 overflow-hidden">
          {/* Header */}
          <div className="p-5 bg-gradient-to-r from-pink-500/10 to-transparent border-b border-pink-500/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center">
                <CreatorIcon />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-white">As Creator</h2>
                <p className="text-xs text-white/40">Rewards from content you created</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-pink-400">{formatSol(creatorTotal)} SOL</p>
              </div>
            </div>
          </div>

          {/* Creator Stats */}
          <div className="p-4 border-b border-white/5">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Content</p>
                <p className="text-lg font-bold text-white/80">{creatorContent.length}</p>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">NFTs Sold</p>
                <p className="text-lg font-bold text-white/80">{totalMintedFromContent}</p>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Your Weight</p>
                <p className="text-lg font-bold text-pink-400">{creatorWeight.toString()}</p>
              </div>
            </div>
          </div>

          {/* Subscription Pool */}
          <div className="border border-white/10 rounded-xl overflow-hidden">
            {/* Header */}
            <button
              onClick={() => toggleSection("creator-sub")}
              className="w-full p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-pink-400" />
                <div className="text-left">
                  <p className="text-sm font-medium text-white">Subscriptions</p>
                  <p className="text-[10px] text-white/40">80% of ecosystem subscription fees</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-bold text-pink-400">{formatSol(creatorDistPending)} SOL</span>
                <svg
                  className={`w-4 h-4 text-white/30 transition-transform ${expandedSections["creator-sub"] ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {/* Expanded content */}
            {expandedSections["creator-sub"] && (
              <div className="p-4 bg-white/[0.01] border-t border-white/5">
                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                  <p className="text-[10px] text-white/50 mb-3">How it's calculated:</p>
                  <p className="text-[10px] text-white/40 font-mono leading-relaxed mb-3">
                    pending = (creator_weight × pool_rps - baseline) / 10¹²
                  </p>
                  <div className="space-y-2 pt-2 border-t border-white/5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-white/40">Pool RPS</span>
                      <span className="text-white/60 font-mono">{creatorDistRps.toString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40">Your Creator Weight</span>
                      <span className="text-pink-400 font-mono">{creatorWeight.toString()}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-white/5">
                      <span className="text-white/50 font-medium">Pending Reward</span>
                      <span className="text-pink-400 font-bold">{formatSol(creatorDistPending)} SOL</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* AS HOLDER SECTION */}
      {/* ============================================ */}
      {(hasNfts || hasContentRewards || hasBundleRewards) && (
        <div className="rounded-2xl border border-cyan-500/20 overflow-hidden">
          {/* Header */}
          <div className="p-5 bg-gradient-to-r from-cyan-500/10 to-transparent border-b border-cyan-500/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <HolderIcon />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-white">As Holder</h2>
                <p className="text-xs text-white/40">Rewards from {data?.nfts.length} NFTs you own (Weight: {data?.totalWeight})</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-cyan-400">{formatSol(holderTotal)} SOL</p>
              </div>
            </div>
          </div>

          {/* Source Summary */}
          <div className="p-4 grid grid-cols-3 gap-3 border-b border-white/5">
            <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/10">
              <p className="text-[10px] text-purple-400/70 uppercase tracking-wider mb-1">Sales</p>
              <p className="text-lg font-bold text-purple-400">{formatSol(salesTotal)}</p>
              <p className="text-[9px] text-white/30 mt-0.5">Primary & secondary</p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
              <p className="text-[10px] text-emerald-400/70 uppercase tracking-wider mb-1">Subscriptions</p>
              <p className="text-lg font-bold text-emerald-400">{formatSol(globalHolderPending)}</p>
              <p className="text-[9px] text-white/30 mt-0.5">12% ecosystem fees</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
              <p className="text-[10px] text-amber-400/70 uppercase tracking-wider mb-1">Memberships</p>
              <p className="text-lg font-bold text-amber-400">{formatSol(creatorPatronPending)}</p>
              <p className="text-[9px] text-white/30 mt-0.5">12% creator fees</p>
            </div>
          </div>

          {/* NFTs grouped by Content - using contentRewards which has proper content CID mapping */}
          <div className="divide-y divide-white/5">
            {/* Content NFTs Section Header - only show if we also have bundles */}
            {contentRewards.length > 0 && bundleRewards.length > 0 && (
              <div className="px-4 py-3 bg-gradient-to-r from-purple-500/5 to-transparent">
                <p className="text-xs font-medium text-purple-400/80 uppercase tracking-wider">Content NFTs</p>
              </div>
            )}
            {contentRewards.map((content) => {
              const contentCid = content.contentCid;
              const contentSalesTotal = content.pending;
              const nftRewards = content.nftRewards || [];
              const nftCount = Number(content.nftCount || nftRewards.length);

              // Calculate subs/member totals from unified rewards lookup
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
                    className="w-full p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                        <span className="text-xs text-white/40">{nftCount}</span>
                      </div>
                      <div className="text-left">
                        <p className="text-[10px] font-medium text-white/80 font-mono">
                          {contentCid}
                        </p>
                        <p className="text-[10px] text-white/40">{nftCount} NFT{nftCount > 1 ? "s" : ""}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex gap-3 text-xs">
                        <span className="text-purple-400">{formatSol(contentSalesTotal)}</span>
                        <span className="text-emerald-400">{formatSol(contentSubsTotal)}</span>
                        <span className="text-amber-400">{formatSol(contentMemTotal)}</span>
                      </div>
                      <span className="text-sm font-bold text-emerald-400">{formatSol(contentTotal)}</span>
                      <svg
                        className={`w-4 h-4 text-white/40 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4">
                      <table className="w-full text-xs table-fixed">
                        <thead>
                          <tr className="text-white/40 border-b border-white/5">
                            <th className="text-left py-2 font-medium">NFT</th>
                            <th className="text-left py-2 font-medium w-20">Rarity</th>
                            <th className="text-right py-2 font-medium w-16">Weight</th>
                            <th className="text-right py-2 font-medium w-20 text-purple-400/70">Sales</th>
                            <th className="text-right py-2 font-medium w-20 text-emerald-400/70">Subs</th>
                            <th className="text-right py-2 font-medium w-20 text-amber-400/70">Member</th>
                            <th className="text-right py-2 font-medium w-24">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {nftRewards.map((nftReward) => {
                            const nftAsset = nftReward.nftAsset.toBase58();
                            const unifiedData = unifiedRewardsByNft.get(nftAsset);
                            const weight = nftReward.weight;
                            const rarity = unifiedData?.rarity || "Common";
                            const nftSales = nftReward.pending;
                            const nftSubs = unifiedData?.globalHolderPending || BigInt(0);
                            const nftMember = unifiedData?.patronPending || BigInt(0);
                            const nftTotal = nftSales + nftSubs + nftMember;

                            const rarityColors: Record<string, string> = {
                              Common: "text-white/50",
                              Uncommon: "text-green-400",
                              Rare: "text-blue-400",
                              Epic: "text-purple-400",
                              Legendary: "text-amber-400",
                            };

                            return (
                              <tr key={nftAsset} className="border-b border-white/5">
                                <td className="py-2 font-mono text-white/60 text-[10px]">{nftAsset}</td>
                                <td className={`py-2 w-20 ${rarityColors[rarity]}`}>{rarity}</td>
                                <td className="py-2 text-right w-16 text-white/70">{weight}</td>
                                <td className="py-2 text-right w-20 text-purple-400">{formatSol(nftSales)}</td>
                                <td className="py-2 text-right w-20 text-emerald-400">{formatSol(nftSubs)}</td>
                                <td className="py-2 text-right w-20 text-amber-400">{formatSol(nftMember)}</td>
                                <td className="py-2 text-right w-24 text-emerald-400 font-medium">{formatSol(nftTotal)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-white/10 bg-white/[0.01]">
                            <td className="py-2 text-white/50 font-medium" colSpan={2}>Subtotal</td>
                            <td className="py-2 text-right w-16 text-white/50">{nftRewards.reduce((s, n) => s + n.weight, 0)}</td>
                            <td className="py-2 text-right w-20 text-purple-400 font-medium">{formatSol(contentSalesTotal)}</td>
                            <td className="py-2 text-right w-20 text-emerald-400 font-medium">{formatSol(contentSubsTotal)}</td>
                            <td className="py-2 text-right w-20 text-amber-400 font-medium">{formatSol(contentMemTotal)}</td>
                            <td className="py-2 text-right w-24 text-emerald-400 font-bold">{formatSol(contentTotal)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Bundle NFTs Section */}
            {bundleRewards.length > 0 && (
              <>
                {/* Section divider for bundles */}
                {contentRewards.length > 0 && (
                  <div className="px-4 py-3 bg-gradient-to-r from-indigo-500/5 to-transparent border-t border-indigo-500/10">
                    <p className="text-xs font-medium text-indigo-400/80 uppercase tracking-wider">Bundle NFTs</p>
                  </div>
                )}
                {bundleRewards.map((bundle) => {
                  const bundleId = bundle.bundleId;
                  const bundleSalesTotal = bundle.pending;
                  const nftRewards = bundle.nftRewards || [];
                  const nftCount = Number(bundle.nftCount || nftRewards.length);

                  // Calculate subs/member totals from unified rewards lookup
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
                    <div key={bundleId} className="border-t border-white/5 first:border-t-0">
                      <button
                        onClick={() => toggleSection(`bundle-${bundleId}`)}
                        className="w-full p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                            <span className="text-xs text-indigo-400">{nftCount}</span>
                          </div>
                          <div className="text-left">
                            <p className="text-[10px] font-medium text-white/80 font-mono">
                              {bundleId}
                            </p>
                            <p className="text-[10px] text-indigo-400/60">
                              {nftCount} Bundle NFT{nftCount > 1 ? "s" : ""}
                              {missingRewardCount > 0 && (
                                <span className="text-amber-400/70"> ({missingRewardCount} legacy)</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex gap-3 text-xs">
                            <span className="text-purple-400">{formatSol(bundleSalesTotal)}</span>
                            <span className="text-emerald-400">{formatSol(bundleSubsTotal)}</span>
                            <span className="text-amber-400">{formatSol(bundleMemTotal)}</span>
                          </div>
                          <span className="text-sm font-bold text-indigo-400">{formatSol(bundleTotal)}</span>
                          <svg
                            className={`w-4 h-4 text-white/40 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-4">
                          {missingRewardCount > 0 && (
                            <div className="mb-3 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                              <p className="text-[10px] text-amber-400/80">
                                {missingRewardCount} NFT{missingRewardCount > 1 ? "s" : ""} minted before reward tracking was enabled.
                                These NFTs are owned but don&apos;t earn rewards from sales.
                              </p>
                            </div>
                          )}
                          {nftRewards.length > 0 ? (
                          <table className="w-full text-xs table-fixed">
                            <thead>
                              <tr className="text-white/40 border-b border-white/5">
                                <th className="text-left py-2 font-medium">NFT</th>
                                <th className="text-left py-2 font-medium w-20">Rarity</th>
                                <th className="text-right py-2 font-medium w-16">Weight</th>
                                <th className="text-right py-2 font-medium w-20 text-purple-400/70">Sales</th>
                                <th className="text-right py-2 font-medium w-20 text-emerald-400/70">Subs</th>
                                <th className="text-right py-2 font-medium w-20 text-amber-400/70">Member</th>
                                <th className="text-right py-2 font-medium w-24">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {nftRewards.map((nftReward) => {
                                const nftAsset = nftReward.nftAsset.toBase58();
                                const unifiedData = unifiedRewardsByNft.get(nftAsset);
                                const weight = nftReward.weight;
                                const rarity = unifiedData?.rarity || "Common";
                                const nftSales = nftReward.pending;
                                const nftSubs = unifiedData?.globalHolderPending || BigInt(0);
                                const nftMember = unifiedData?.patronPending || BigInt(0);
                                const nftTotal = nftSales + nftSubs + nftMember;

                                const rarityColors: Record<string, string> = {
                                  Common: "text-white/50",
                                  Uncommon: "text-green-400",
                                  Rare: "text-blue-400",
                                  Epic: "text-purple-400",
                                  Legendary: "text-amber-400",
                                };

                                return (
                                  <tr key={nftAsset} className="border-b border-white/5">
                                    <td className="py-2 font-mono text-white/60 text-[10px]">{nftAsset}</td>
                                    <td className={`py-2 w-20 ${rarityColors[rarity]}`}>{rarity}</td>
                                    <td className="py-2 text-right w-16 text-white/70">{weight}</td>
                                    <td className="py-2 text-right w-20 text-purple-400">{formatSol(nftSales)}</td>
                                    <td className="py-2 text-right w-20 text-emerald-400">{formatSol(nftSubs)}</td>
                                    <td className="py-2 text-right w-20 text-amber-400">{formatSol(nftMember)}</td>
                                    <td className="py-2 text-right w-24 text-indigo-400 font-medium">{formatSol(nftTotal)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="border-t border-white/10 bg-white/[0.01]">
                                <td className="py-2 text-white/50 font-medium" colSpan={2}>Subtotal</td>
                                <td className="py-2 text-right w-16 text-white/50">{nftRewards.reduce((s, n) => s + n.weight, 0)}</td>
                                <td className="py-2 text-right w-20 text-purple-400 font-medium">{formatSol(bundleSalesTotal)}</td>
                                <td className="py-2 text-right w-20 text-emerald-400 font-medium">{formatSol(bundleSubsTotal)}</td>
                                <td className="py-2 text-right w-20 text-amber-400 font-medium">{formatSol(bundleMemTotal)}</td>
                                <td className="py-2 text-right w-24 text-indigo-400 font-bold">{formatSol(bundleTotal)}</td>
                              </tr>
                            </tfoot>
                          </table>
                          ) : missingRewardCount === 0 && (
                            <p className="text-xs text-white/40 text-center py-4">No reward data available</p>
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

// ============================================
// ICONS
// ============================================
function HolderIcon() {
  return (
    <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );
}

function CreatorIcon() {
  return (
    <svg className="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  );
}

// ============================================
// ECOSYSTEM TAB
// ============================================
function EcosystemTab() {
  return (
    <div className="space-y-6">
      <div className="relative p-5 rounded-2xl bg-white/[0.02] border border-white/5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-cyan-500/20 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-medium text-white/90">Ecosystem Overview</h2>
            <p className="text-sm text-white/40">Subscription pools and distribution status</p>
          </div>
        </div>
        <p className="text-xs text-white/30 leading-relaxed">
          Ecosystem subscription fees are split:{" "}
          <span className="text-cyan-400/80">12% to NFT holders</span>,{" "}
          <span className="text-purple-400/80">80% to creators</span>, and{" "}
          <span className="text-white/50">8% to ecosystem</span>.
        </p>
      </div>

      <EpochStatusCard />
    </div>
  );
}
