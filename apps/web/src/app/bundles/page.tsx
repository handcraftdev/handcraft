"use client";

import { Suspense, useState, useCallback } from "react";
import { BundleFeed } from "@/components/feed";
import { SidebarPanel } from "@/components/sidebar";

function FeedLoadingFallback() {
  return (
    <div className="h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white/60 font-light tracking-wide">Loading bundles...</p>
      </div>
    </div>
  );
}

function BundlesPageContent() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const toggleSidebar = useCallback(() => setIsSidebarOpen(prev => !prev), []);

  return (
    <div className="min-h-screen bg-black">
      {/* Slide-in Sidebar */}
      <SidebarPanel
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Bundle Feed Content - includes menu and filter buttons */}
      <Suspense fallback={<FeedLoadingFallback />}>
        <BundleFeed isSidebarOpen={isSidebarOpen} onToggleSidebar={toggleSidebar} />
      </Suspense>
    </div>
  );
}

export default function BundlesPage() {
  return (
    <Suspense fallback={<FeedLoadingFallback />}>
      <BundlesPageContent />
    </Suspense>
  );
}
