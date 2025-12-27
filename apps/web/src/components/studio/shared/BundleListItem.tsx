"use client";

import { useState, useEffect } from "react";
import { BundleType, getIpfsUrl } from "@handcraft/sdk";
import { getBundleTypeLabel } from "@/hooks/useContentRegistry";

interface BundleMetadata {
  name?: string;
  description?: string;
  image?: string;
}

interface Bundle {
  bundleId: string;
  bundleType: BundleType;
  itemCount: number;
  isActive: boolean;
  isLocked: boolean;
  mintedCount?: bigint | number;
  createdAt: bigint | number;
  metadataCid?: string;
  creator: { toBase58: () => string };
}

interface BundleListItemProps {
  bundle: Bundle;
  onClick: () => void;
  viewMode?: "list" | "grid";
  showStats?: boolean;
}

export function BundleListItem({ bundle, onClick, viewMode = "list", showStats = true }: BundleListItemProps) {
  const [metadata, setMetadata] = useState<BundleMetadata | null>(null);

  useEffect(() => {
    if (!bundle.metadataCid) return;

    const abortController = new AbortController();

    fetch(getIpfsUrl(bundle.metadataCid), { signal: abortController.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!abortController.signal.aborted) {
          setMetadata(data);
        }
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setMetadata(null);
        }
      });

    return () => abortController.abort();
  }, [bundle.metadataCid]);

  const displayTitle = metadata?.name || bundle.bundleId;
  const thumbnailUrl = metadata?.image;
  const bundleTypeLabel = getBundleTypeLabel(bundle.bundleType);
  const mintedCount = Number(bundle.mintedCount ?? 0);
  const isLocked = bundle.isLocked || mintedCount > 0;
  const createdDate = new Date(Number(bundle.createdAt) * 1000).toLocaleDateString();

  if (viewMode === "grid") {
    return (
      <div onClick={onClick} className="group relative p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] transition-all duration-200 cursor-pointer">
        <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

        {/* Header badges */}
        <div className="relative flex items-center justify-between mb-2">
          <span className="px-1.5 py-0.5 rounded text-2xs uppercase tracking-wider bg-white/5 text-white/50 border border-white/[0.08]">
            {bundleTypeLabel}
          </span>
          <span className={`px-1.5 py-0.5 rounded text-2xs ${
            bundle.isActive ? "bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/20" :
            isLocked ? "bg-amber-500/10 text-amber-400/80 border border-amber-500/20" :
            "bg-white/5 text-white/40 border border-white/[0.08]"
          }`}>
            {isLocked ? "Locked" : bundle.isActive ? "Active" : "Inactive"}
          </span>
        </div>

        {/* Thumbnail if available */}
        {thumbnailUrl && (
          <div className="relative w-full aspect-video rounded-md overflow-hidden bg-white/5 mb-2">
            <img src={thumbnailUrl} alt={displayTitle} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          </div>
        )}

        {/* Title and info */}
        <div className="relative">
          <h3 className="text-base font-medium truncate text-white/90 mb-0.5">{displayTitle}</h3>
          <p className="text-sm text-white/40">{bundle.itemCount} items</p>
          {showStats && mintedCount > 0 && (
            <p className="text-sm text-purple-400 mt-0.5">{mintedCount} sold</p>
          )}
          <p className="text-xs text-white/25 mt-2">{createdDate}</p>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div onClick={onClick} className="group relative flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] transition-all duration-300 cursor-pointer">
      <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      {/* Thumbnail or Icon */}
      <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt={displayTitle} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/20 to-transparent">
            <svg className="w-4 h-4 text-purple-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
        )}
      </div>

      {/* Bundle Info */}
      <div className="relative flex-1 min-w-0">
        <p className="text-base font-medium truncate text-white/90">{displayTitle}</p>
        <p className="text-xs text-white/40">{bundle.itemCount} items · {createdDate}</p>
      </div>

      {/* Badges */}
      <div className="relative flex items-center gap-2 text-sm flex-shrink-0">
        <span className="px-1.5 py-0.5 rounded text-2xs uppercase tracking-wider bg-white/5 text-white/50 border border-white/[0.08]">
          {bundleTypeLabel}
        </span>

        {showStats && mintedCount > 0 && (
          <span className="text-purple-400 font-medium text-sm">{mintedCount} sold</span>
        )}

        <span className={`px-1.5 py-0.5 rounded text-2xs ${
          bundle.isActive ? "bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/20" :
          isLocked ? "bg-amber-500/10 text-amber-400/80 border border-amber-500/20" :
          "bg-white/5 text-white/40 border border-white/[0.08]"
        }`}>
          {isLocked ? "Locked" : bundle.isActive ? "Active" : "Inactive"}
        </span>
      </div>

      {/* Arrow */}
      <svg className="relative w-3.5 h-3.5 text-white/20 group-hover:text-white/40 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
      </svg>
    </div>
  );
}
