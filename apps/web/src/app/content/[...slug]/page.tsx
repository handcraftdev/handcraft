"use client";

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Feed } from "@/components/feed";
import { SidebarPanel } from "@/components/sidebar";

export default function ContentPage() {
  const params = useParams();
  const slug = params.slug as string[];

  // Parse slug: /content/CID or /content/CID/position
  const cid = slug[0];
  const positionParam = slug[1] ? parseInt(slug[1], 10) : 1;
  const initialPosition = Math.max(1, positionParam);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);

  const toggleSidebar = useCallback(() => {
    setShowFilters(false); // Always close filters when toggling sidebar
    setIsSidebarOpen(prev => !prev);
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setIsSidebarOpen(false);
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
        className={`fixed top-4 z-50 p-3 bg-black/60 backdrop-blur-md rounded-full border border-white/10 hover:border-white/30 transition-all duration-300 ${isSidebarOpen || showFilters ? 'left-[304px]' : 'left-4'} ${showOverlay ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        title="Menu"
      >
        <svg className="w-5 h-5 text-white/70 hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <Feed
        isSidebarOpen={isSidebarOpen}
        onCloseSidebar={handleCloseSidebar}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        initialCid={cid}
        initialPosition={initialPosition}
        onOverlayChange={handleOverlayChange}
      />
    </div>
  );
}
