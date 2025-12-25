"use client";

import { useState, useMemo, useCallback, useEffect, Suspense } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SidebarPanel } from "@/components/sidebar";
import { useContentRegistry, getBundleTypeLabel, ContentEntry } from "@/hooks/useContentRegistry";
import { CreateBundleModal, ManageBundleModal } from "@/components/bundle";
import { ManageContentModal } from "@/components/content";
import { CreatorMembershipSettings, CustomMembershipManager } from "@/components/membership";
import { UserProfileSettings } from "@/components/profile";
import { DraftsList } from "@/components/studio/DraftsList";
import { getIpfsUrl, VisibilityLevel, getContentTypeLabel, ContentType } from "@handcraft/sdk";

type StudioTab = "overview" | "content" | "bundles" | "membership";

const VALID_TABS: StudioTab[] = ["overview", "content", "bundles", "membership"];

const LAMPORTS_PER_SOL = 1_000_000_000;

// Metadata fetched from IPFS
interface ContentMetadataJson {
  name?: string;
  description?: string;
  image?: string;
  properties?: {
    title?: string;
    contentCid?: string;
    contentType?: number;
    contentDomain?: string;
    tags?: string[];
  };
}

// Component to display a published content item with metadata from Metaplex collection
function PublishedContentItem({ item, onClick }: { item: ContentEntry; onClick: () => void }) {
  const [metadata, setMetadata] = useState<ContentMetadataJson | null>(null);

  // Fetch metadata from IPFS when metadataCid is available
  useEffect(() => {
    if (!item.metadataCid) return;

    fetch(`https://ipfs.filebase.io/ipfs/${item.metadataCid}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => setMetadata(data))
      .catch(() => setMetadata(null));
  }, [item.metadataCid]);

  // Use title from metadata, fallback to contentCid
  const displayTitle = metadata?.properties?.title
    || metadata?.name
    || (item.contentCid ? `Content ${item.contentCid.slice(0, 12)}...` : "Untitled");

  // Get thumbnail from metadata image or use preview CID
  const thumbnailUrl = metadata?.image
    || (item.previewCid ? `https://ipfs.filebase.io/ipfs/${item.previewCid}` : null);

  const contentType = item.contentType !== undefined ? getContentTypeLabel(item.contentType as ContentType) : "Content";

  return (
    <div
      onClick={onClick}
      className="group relative flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all duration-300 cursor-pointer"
    >
      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt={displayTitle} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      <div className="relative flex-1 min-w-0">
        <p className="font-medium truncate text-white/90">{displayTitle}</p>
        <p className="text-xs text-white/40 truncate mt-0.5">{item.pubkey?.toBase58().slice(0, 24) || "Unknown"}...</p>
      </div>

      <div className="relative flex items-center gap-3 text-sm">
        <span className="text-white/30">{contentType}</span>
        <span className="text-white/60 font-medium">{Number(item.mintedCount || 0)} sold</span>
        {/* Visibility Badge */}
        {item.visibilityLevel !== undefined && item.visibilityLevel > 0 && (
          <span className={`px-2 py-0.5 rounded-full text-[10px] flex items-center gap-1 ${
            item.visibilityLevel === 3 /* NftOnly */
              ? "bg-amber-500/10 text-amber-400/80 border border-amber-500/20"
              : item.visibilityLevel === 2 /* Subscriber */
              ? "bg-purple-500/10 text-purple-400/80 border border-purple-500/20"
              : "bg-blue-500/10 text-blue-400/80 border border-blue-500/20"
          }`}>
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            {item.visibilityLevel === 3 /* NftOnly */
              ? "Buy/Rent"
              : item.visibilityLevel === 2 /* Subscriber */
              ? "Members"
              : "Subscribers"}
          </span>
        )}
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
}

function StudioContent() {
  const { publicKey } = useWallet();
  const searchParams = useSearchParams();
  const { content, myBundlesQuery, userProfile, isLoadingUserProfile } = useContentRegistry();
  const [showCreateBundleModal, setShowCreateBundleModal] = useState(false);
  const [selectedBundle, setSelectedBundle] = useState<any>(null);
  const [selectedContent, setSelectedContent] = useState<ContentEntry | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Get active tab from URL params (default to overview)
  const tabParam = searchParams.get("tab");
  const activeTab: StudioTab = VALID_TABS.includes(tabParam as StudioTab) ? (tabParam as StudioTab) : "overview";

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
          className={`fixed top-4 z-50 p-3 bg-white/5 backdrop-blur-md rounded-full border border-white/10 hover:border-white/20 transition-all duration-300 ${isSidebarOpen ? 'left-[304px]' : 'left-4'}`}
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
        className={`fixed top-4 z-50 p-3 bg-white/5 backdrop-blur-md rounded-full border border-white/10 hover:border-white/20 transition-all duration-300 ${isSidebarOpen ? 'left-[304px]' : 'left-4'}`}
      >
        <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <main className="max-w-5xl mx-auto px-6 py-20">
        {/* Page Header with Upload Button */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2 tracking-tight">Studio</h1>
            <p className="text-white/40">Track your content performance and earnings</p>
          </div>
          <Link
            href="/studio/upload"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 hover:border-purple-500/50 rounded-xl text-sm font-medium transition-all duration-300"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create New
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 p-1 bg-white/[0.02] rounded-xl border border-white/5 w-fit">
          {[
            { id: "overview", label: "Overview" },
            { id: "content", label: "Content" },
            { id: "bundles", label: "Bundles" },
            { id: "membership", label: "Membership" },
          ].map((tab) => (
            <Link
              key={tab.id}
              href={tab.id === "overview" ? "/studio" : `/studio?tab=${tab.id}`}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-white/10 text-white"
                  : "text-white/50 hover:text-white/70"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <>
            {/* Creator Profile */}
            <div className="mb-8">
              <UserProfileSettings highlight={!isLoadingUserProfile && !userProfile} />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="relative p-6 rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden group hover:border-white/10 transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
                    <svg className="w-6 h-6 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white/40 text-sm mb-0.5">Published Content</p>
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
                    <p className="text-white/40 text-sm mb-0.5">NFTs Sold</p>
                    <p className="text-3xl font-bold tracking-tight">{stats.totalMints}</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Content Tab */}
        {activeTab === "content" && (
          <div className="space-y-10">
            {/* Drafts Section */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold tracking-tight">Drafts</h2>
              </div>
              <DraftsList excludeStatuses={['published']} />
            </section>

            {/* Published Section */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold tracking-tight">Published</h2>
                <span className="text-white/30 text-sm">{myContent.length} items</span>
              </div>

              {myContent.length === 0 ? (
                <div className="relative p-12 rounded-2xl bg-white/[0.02] border border-white/5 text-center">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium mb-2">No published content yet</h3>
                  <p className="text-white/40 text-sm">Publish your drafts to start earning</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {myContent.map((item) => (
                    <PublishedContentItem
                      key={item.pubkey?.toBase58() || item.contentCid || item.previewCid}
                      item={item}
                      onClick={() => setSelectedContent(item)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* Bundles Tab */}
        {activeTab === "bundles" && (
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
        )}

        {/* Membership Tab */}
        {activeTab === "membership" && (
          <div className="space-y-8">
            <CreatorMembershipSettings />
            <CustomMembershipManager />
          </div>
        )}
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

// Loading fallback for Suspense
function StudioLoading() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-6 py-20">
        <div className="h-10 w-32 bg-white/5 rounded-lg animate-pulse mb-4" />
        <div className="h-4 w-64 bg-white/5 rounded animate-pulse mb-8" />
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="h-24 bg-white/[0.02] border border-white/5 rounded-2xl animate-pulse" />
          <div className="h-24 bg-white/[0.02] border border-white/5 rounded-2xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export default function StudioClient() {
  return (
    <Suspense fallback={<StudioLoading />}>
      <StudioContent />
    </Suspense>
  );
}
