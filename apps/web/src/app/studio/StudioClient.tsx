"use client";

import { useState, useMemo, useCallback, Suspense } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SidebarPanel } from "@/components/sidebar";
import { useContentRegistry, ContentEntry } from "@/hooks/useContentRegistry";
import { CreateBundleModal, ManageBundleModal } from "@/components/bundle";
import { ManageContentModal } from "@/components/content";
import { OverviewTab, ContentTab, BundlesTab, MembershipTab } from "./tabs";

type StudioTab = "overview" | "content" | "bundles" | "membership";

const VALID_TABS: StudioTab[] = ["overview", "content", "bundles", "membership"];

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

  if (!publicKey) {
    return (
      <div className="min-h-screen bg-black text-white">
        <SidebarPanel isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

        {/* Menu Button */}
        <button
          onClick={toggleSidebar}
          className={`fixed top-4 z-50 p-3 bg-white/5 backdrop-blur-md rounded-full border border-white/10 hover:border-white/20 transition-all duration-300 ${isSidebarOpen ? 'left-[264px]' : 'left-4'}`}
        >
          <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="flex items-center justify-center min-h-screen px-4">
          <div className="text-center max-w-sm">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center mx-auto mb-3 border border-white/10">
              <svg className="w-6 h-6 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-lg font-medium text-white mb-1">Connect Wallet</h2>
            <p className="text-white/40 text-base">Connect your wallet to access the creator studio</p>
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
        className={`fixed top-4 z-50 p-3 bg-white/5 backdrop-blur-md rounded-full border border-white/10 hover:border-white/20 transition-all duration-300 ${isSidebarOpen ? 'left-[264px]' : 'left-4'}`}
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
              <h1 className="text-lg font-medium text-white">Studio</h1>
            </div>
            <Link
              href="/studio/upload"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 hover:border-purple-500/50 rounded-md text-sm font-medium transition-all"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create
            </Link>
          </div>

          {/* Tabs in header */}
          <div className="flex items-center gap-1 pb-3 overflow-x-auto no-scrollbar">
            {[
              { id: "overview", label: "Overview" },
              { id: "content", label: "Content" },
              { id: "bundles", label: "Bundles" },
              { id: "membership", label: "Membership" },
            ].map((tab) => (
              <Link
                key={tab.id}
                href={tab.id === "overview" ? "/studio" : `/studio?tab=${tab.id}`}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-white text-black"
                    : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-4">

        {/* Tab Content */}
        {activeTab === "overview" && (
          <OverviewTab
            content={myContent}
            bundles={myBundles}
            isLoadingProfile={isLoadingUserProfile}
            hasProfile={!!userProfile}
          />
        )}

        {activeTab === "content" && (
          <ContentTab
            content={myContent}
            onContentClick={setSelectedContent}
          />
        )}

        {activeTab === "bundles" && (
          <BundlesTab
            bundles={myBundles}
            onBundleClick={setSelectedBundle}
            onCreateBundle={() => setShowCreateBundleModal(true)}
          />
        )}

        {activeTab === "membership" && <MembershipTab />}
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
        <div className="h-7 w-24 bg-white/5 rounded-lg animate-pulse mb-2" />
        <div className="h-3 w-48 bg-white/5 rounded animate-pulse mb-6" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="h-16 bg-white/[0.02] border border-white/[0.06] rounded-xl animate-pulse" />
          <div className="h-16 bg-white/[0.02] border border-white/[0.06] rounded-xl animate-pulse" />
          <div className="h-16 bg-white/[0.02] border border-white/[0.06] rounded-xl animate-pulse" />
          <div className="h-16 bg-white/[0.02] border border-white/[0.06] rounded-xl animate-pulse" />
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
