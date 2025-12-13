"use client";

import { useState, useMemo, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { SidebarPanel } from "@/components/sidebar";
import { useContentRegistry, getBundleTypeLabel, ContentEntry } from "@/hooks/useContentRegistry";
import { CreateBundleModal, ManageBundleModal } from "@/components/bundle";
import { ManageContentModal } from "@/components/content";
import { CreatorMembershipSettings, CustomMembershipManager } from "@/components/membership";
import { UserProfileSettings } from "@/components/profile";
import { getIpfsUrl } from "@handcraft/sdk";

const LAMPORTS_PER_SOL = 1_000_000_000;

export default function Dashboard() {
  const { publicKey } = useWallet();
  const { content, myBundlesQuery, userProfile, isLoadingUserProfile } = useContentRegistry();
  const [showCreateBundleModal, setShowCreateBundleModal] = useState(false);
  const [selectedBundle, setSelectedBundle] = useState<any>(null);
  const [selectedContent, setSelectedContent] = useState<ContentEntry | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = useCallback(() => setIsSidebarOpen(prev => !prev), []);

  const myBundles = myBundlesQuery.data ?? [];

  const myContent = useMemo(() => {
    if (!publicKey) return [];
    return content.filter(c => c.creator?.toBase58() === publicKey.toBase58());
  }, [content, publicKey]);

  const stats = useMemo(() => {
    let totalMints = 0;
    for (const c of myContent) {
      totalMints += Number(c.mintedCount || 0);
    }
    return { totalMints, contentCount: myContent.length };
  }, [myContent]);

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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-3 tracking-tight">Connect Wallet</h1>
            <p className="text-white/40 max-w-sm mx-auto">Please connect your wallet to access your creator studio</p>
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

      <main className="max-w-5xl mx-auto px-6 py-20">
        {/* Page Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-3 tracking-tight">Studio</h1>
          <p className="text-white/40">Track your content performance and earnings</p>
        </div>

        {/* Creator Profile */}
        <div className="mb-10">
          <UserProfileSettings highlight={!isLoadingUserProfile && !userProfile} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-10">
          <div className="relative p-6 rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden group hover:border-white/10 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
                <svg className="w-6 h-6 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-white/40 text-sm mb-0.5">My Content</p>
                <p className="text-3xl font-bold tracking-tight">{stats.contentCount}</p>
              </div>
            </div>
          </div>

          <div className="relative p-6 rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden group hover:border-white/10 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
                <svg className="w-6 h-6 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <p className="text-white/40 text-sm mb-0.5">NFTs Minted</p>
                <p className="text-3xl font-bold tracking-tight">{stats.totalMints}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Membership Settings */}
        <div className="mb-10">
          <CreatorMembershipSettings />
        </div>

        {/* Custom Membership Tiers */}
        <div className="mb-10">
          <CustomMembershipManager />
        </div>

        {/* My Content */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold tracking-tight">My Content</h2>
            <span className="text-white/30 text-sm">{myContent.length} items</span>
          </div>

          {myContent.length === 0 ? (
            <div className="relative p-12 rounded-2xl bg-white/[0.02] border border-white/5 text-center">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium mb-2">No content yet</h3>
              <p className="text-white/40 text-sm">Upload your first content to start earning</p>
            </div>
          ) : (
            <div className="space-y-2">
              {myContent.map((item) => {
                const metadata = (item as any).metadata;
                const title = metadata?.title || metadata?.name || "Untitled";
                const previewUrl = item.previewCid ? getIpfsUrl(item.previewCid) : null;
                const contentType = item.contentType?.toString().replace(/([A-Z])/g, ' $1').trim() || "Unknown";

                return (
                  <div
                    key={item.contentCid}
                    onClick={() => setSelectedContent(item)}
                    className="group relative flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all duration-300 cursor-pointer"
                  >
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                    <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
                      {previewUrl ? (
                        <img src={previewUrl} alt={title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-6 h-6 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>

                    <div className="relative flex-1 min-w-0">
                      <p className="font-medium truncate text-white/90">{title}</p>
                      <p className="text-xs text-white/40 truncate mt-0.5">{item.contentCid.slice(0, 24)}...</p>
                    </div>

                    <div className="relative flex items-center gap-4 text-sm">
                      <span className="text-white/30">{contentType}</span>
                      <span className="text-white/60 font-medium">{Number(item.mintedCount || 0)} mints</span>
                      {item.isLocked ? (
                        <span className="px-2.5 py-1 rounded-full text-[11px] bg-amber-500/10 text-amber-400/80 border border-amber-500/20">Locked</span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[11px] bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/20">Active</span>
                      )}
                    </div>

                    <svg className="relative w-4 h-4 text-white/20 group-hover:text-white/40 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* My Bundles */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold tracking-tight">My Bundles</h2>
            <button
              onClick={() => setShowCreateBundleModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-sm font-medium transition-all duration-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Bundle
            </button>
          </div>

          {myBundles.length === 0 ? (
            <div className="relative p-12 rounded-2xl bg-white/[0.02] border border-white/5 text-center">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-lg font-medium mb-2">No bundles yet</h3>
              <p className="text-white/40 text-sm mb-6">Create a bundle to group your content together</p>
              <button
                onClick={() => setShowCreateBundleModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-sm font-medium transition-all duration-300"
              >
                Create Your First Bundle
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {myBundles.map((bundle) => (
                <div
                  key={bundle.bundleId}
                  onClick={() => setSelectedBundle(bundle)}
                  className="group relative p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all duration-300 cursor-pointer"
                >
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <span className="px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider bg-white/5 text-white/50 border border-white/10">
                        {getBundleTypeLabel(bundle.bundleType)}
                      </span>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] ${
                        bundle.isActive
                          ? "bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/20"
                          : "bg-white/5 text-white/40 border border-white/10"
                      }`}>
                        {bundle.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <h3 className="font-medium truncate text-white/90 mb-1">{bundle.bundleId}</h3>
                    <p className="text-sm text-white/40">{bundle.itemCount} items</p>
                    <p className="text-xs text-white/25 mt-3">
                      {new Date(Number(bundle.createdAt) * 1000).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      <CreateBundleModal
        isOpen={showCreateBundleModal}
        onClose={() => setShowCreateBundleModal(false)}
        onSuccess={() => myBundlesQuery.refetch()}
      />

      {selectedBundle && (
        <ManageBundleModal
          isOpen={!!selectedBundle}
          onClose={() => setSelectedBundle(null)}
          bundle={selectedBundle}
          availableContent={myContent}
        />
      )}

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
