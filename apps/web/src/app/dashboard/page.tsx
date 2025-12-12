"use client";

import { useState, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { useContentRegistry, getBundleTypeLabel, ContentEntry } from "@/hooks/useContentRegistry";
import { ClaimRewardsModal } from "@/components/claim";
import { CreateBundleModal, ManageBundleModal } from "@/components/bundle";
import { ManageContentModal } from "@/components/content";
import { getIpfsUrl } from "@handcraft/sdk";

const LAMPORTS_PER_SOL = 1_000_000_000;

function formatSol(lamports: number | bigint): string {
  const num = typeof lamports === "bigint" ? Number(lamports) : lamports;
  return (num / LAMPORTS_PER_SOL).toFixed(4);
}

export default function Dashboard() {
  const { publicKey } = useWallet();
  const router = useRouter();
  const { content, usePendingRewards, pendingRewardsQuery, myBundlesQuery } = useContentRegistry();
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showCreateBundleModal, setShowCreateBundleModal] = useState(false);
  const [selectedBundle, setSelectedBundle] = useState<any>(null);
  const [selectedContent, setSelectedContent] = useState<ContentEntry | null>(null);

  const { data: pendingRewards } = usePendingRewards();
  const myBundles = myBundlesQuery.data ?? [];

  // Filter to only user's content
  const myContent = useMemo(() => {
    if (!publicKey) return [];
    return content.filter(c => c.creator?.toBase58() === publicKey.toBase58());
  }, [content, publicKey]);

  // Calculate total stats
  const stats = useMemo(() => {
    let totalMints = 0;

    for (const c of myContent) {
      totalMints += Number(c.mintedCount || 0);
    }

    const totalPendingRewards = pendingRewards?.reduce(
      (acc, r) => acc + r.pending,
      BigInt(0)
    ) || BigInt(0);

    return {
      totalMints,
      totalPendingRewards,
      contentCount: myContent.length,
    };
  }, [myContent, pendingRewards]);

  // Redirect if not connected
  if (!publicKey) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 ml-0 md:ml-64 pt-16">
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center">
                <h1 className="text-2xl font-bold mb-4">Connect Wallet</h1>
                <p className="text-gray-400">Please connect your wallet to view your dashboard</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 ml-0 md:ml-64 pt-16">
          <div className="max-w-6xl mx-auto p-6">
            {/* Page Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">Creator Dashboard</h1>
              <p className="text-gray-400">Track your content performance and earnings</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-primary-500/20 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">My Content</p>
                    <p className="text-2xl font-bold">{stats.contentCount}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">NFTs Minted</p>
                    <p className="text-2xl font-bold">{stats.totalMints}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Claimable Rewards</p>
                    <p className="text-2xl font-bold text-green-400">{formatSol(stats.totalPendingRewards)} SOL</p>
                  </div>
                </div>
                {stats.totalPendingRewards > BigInt(0) && (
                  <button
                    onClick={() => setShowClaimModal(true)}
                    className="w-full mt-2 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    Claim Rewards
                  </button>
                )}
              </div>
            </div>

            {/* My Content Table */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <div className="p-5 border-b border-gray-800">
                <h2 className="text-xl font-semibold">My Content</h2>
              </div>

              {myContent.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium mb-2">No content yet</h3>
                  <p className="text-gray-400 mb-4">Upload your first content to start earning</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-800/50">
                      <tr>
                        <th className="text-left py-3 px-5 text-sm font-medium text-gray-400">Content</th>
                        <th className="text-right py-3 px-5 text-sm font-medium text-gray-400">Type</th>
                        <th className="text-right py-3 px-5 text-sm font-medium text-gray-400">Mints</th>
                        <th className="text-right py-3 px-5 text-sm font-medium text-gray-400">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {myContent.map((item) => {
                        const metadata = (item as any).metadata;
                        const title = metadata?.title || metadata?.name || "Untitled";
                        const previewUrl = item.previewCid ? getIpfsUrl(item.previewCid) : null;
                        const contentType = item.contentType?.toString().replace(/([A-Z])/g, ' $1').trim() || "Unknown";

                        return (
                          <tr
                            key={item.contentCid}
                            onClick={() => setSelectedContent(item)}
                            className="hover:bg-gray-800/30 transition-colors cursor-pointer"
                          >
                            <td className="py-4 px-5">
                              <div className="flex items-center gap-3">
                                {previewUrl ? (
                                  <img
                                    src={previewUrl}
                                    alt={title}
                                    className="w-12 h-12 rounded-lg object-cover"
                                  />
                                ) : (
                                  <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center">
                                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                  </div>
                                )}
                                <div>
                                  <p className="font-medium truncate max-w-xs">{title}</p>
                                  <p className="text-xs text-gray-500 truncate max-w-xs">
                                    {item.contentCid.slice(0, 20)}...
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-5 text-right">
                              <span className="text-sm text-gray-400">{contentType}</span>
                            </td>
                            <td className="py-4 px-5 text-right">
                              <span className="text-sm font-medium">{Number(item.mintedCount || 0)}</span>
                            </td>
                            <td className="py-4 px-5 text-right">
                              {item.isLocked ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">
                                  Locked
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                                  Active
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* My Bundles Section */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden mt-8">
              <div className="p-5 border-b border-gray-800 flex items-center justify-between">
                <h2 className="text-xl font-semibold">My Bundles</h2>
                <button
                  onClick={() => setShowCreateBundleModal(true)}
                  className="px-4 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg text-sm font-medium transition-colors"
                >
                  Create Bundle
                </button>
              </div>

              {myBundles.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium mb-2">No bundles yet</h3>
                  <p className="text-gray-400 mb-4">Create a bundle to group your content together</p>
                  <button
                    onClick={() => setShowCreateBundleModal(true)}
                    className="px-4 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg text-sm font-medium transition-colors"
                  >
                    Create Your First Bundle
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
                  {myBundles.map((bundle) => (
                    <div
                      key={bundle.bundleId}
                      onClick={() => setSelectedBundle(bundle)}
                      className="bg-gray-800 rounded-lg p-4 cursor-pointer hover:bg-gray-750 transition-colors border border-gray-700 hover:border-gray-600"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs px-2 py-1 bg-primary-500/20 text-primary-400 rounded">
                          {getBundleTypeLabel(bundle.bundleType)}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          bundle.isActive
                            ? "bg-green-500/20 text-green-400"
                            : "bg-gray-600/20 text-gray-400"
                        }`}>
                          {bundle.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <h3 className="font-medium truncate">{bundle.bundleId}</h3>
                      <p className="text-sm text-gray-400 mt-1">{bundle.itemCount} items</p>
                      <p className="text-xs text-gray-500 mt-2">
                        Created {new Date(Number(bundle.createdAt) * 1000).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Claim Rewards Modal */}
      {showClaimModal && (
        <ClaimRewardsModal
          isOpen={showClaimModal}
          onClose={() => setShowClaimModal(false)}
          onSuccess={() => pendingRewardsQuery.refetch()}
        />
      )}

      {/* Create Bundle Modal */}
      <CreateBundleModal
        isOpen={showCreateBundleModal}
        onClose={() => setShowCreateBundleModal(false)}
        onSuccess={() => myBundlesQuery.refetch()}
      />

      {/* Manage Bundle Modal */}
      {selectedBundle && (
        <ManageBundleModal
          isOpen={!!selectedBundle}
          onClose={() => setSelectedBundle(null)}
          bundle={selectedBundle}
          availableContent={myContent}
        />
      )}

      {/* Manage Content Modal */}
      {selectedContent && (
        <ManageContentModal
          isOpen={!!selectedContent}
          onClose={() => setSelectedContent(null)}
          content={selectedContent}
        />
      )}
    </div>
  );
}
