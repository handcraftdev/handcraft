"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { SidebarPanel } from "@/components/sidebar";

// Dynamically import Feed to avoid SDK loading during SSR
const Feed = dynamic(() => import("@/components/feed").then((m) => m.Feed), {
  ssr: false,
  loading: () => <FeedLoadingFallback />,
});

function FeedLoadingFallback() {
  return (
    <div className="h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white/60 font-light tracking-wide">Loading content...</p>
      </div>
    </div>
  );
}

export default function ContentPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  const handleOverlayChange = useCallback((visible: boolean) => {
    setShowOverlay(visible);
  }, []);

  return (
    <div className="min-h-screen bg-black">
      {/* Sidebar - synced with content overlay */}
      <SidebarPanel
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        overlayVisible={showOverlay}
      />

      {/* Menu Button - synced with content overlay */}
      <button
        onClick={toggleSidebar}
        className={`fixed top-4 z-50 p-3 bg-black/60 backdrop-blur-md rounded-full border border-white/10 hover:border-white/30 transition-all duration-300 ${isSidebarOpen ? 'left-[264px]' : 'left-4'} ${showOverlay ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        title="Menu"
      >
        <svg className="w-5 h-5 text-white/70 hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Feed Content - dynamically loaded client-side only */}
      <Feed
        isSidebarOpen={isSidebarOpen}
        onCloseSidebar={() => setIsSidebarOpen(false)}
        onOverlayChange={handleOverlayChange}
      />
    </div>
  );
}
