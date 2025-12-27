"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ContentType, getContentTypeLabel, getIpfsUrl } from "@handcraft/sdk";
import { ContentEntry } from "@/hooks/useContentRegistry";
import { ModerationBadge } from "@/components/moderation/ModerationBadge";

interface ContentMetadata {
  name?: string;
  description?: string;
  image?: string;
  properties?: {
    title?: string;
    contentCid?: string;
    contentType?: number;
    tags?: string[];
  };
}

interface ContentListItemProps {
  content: ContentEntry;
  onClick: () => void;
  viewMode?: "list" | "grid";
  showStats?: boolean;
}

export function ContentListItem({ content, onClick, viewMode = "list", showStats = true }: ContentListItemProps) {
  const [metadata, setMetadata] = useState<ContentMetadata | null>(null);

  useEffect(() => {
    if (!content.metadataCid) return;

    const abortController = new AbortController();

    fetch(getIpfsUrl(content.metadataCid), { signal: abortController.signal })
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
  }, [content.metadataCid]);

  const displayTitle = metadata?.properties?.title || metadata?.name || (content.contentCid ? `Content ${content.contentCid.slice(0, 12)}...` : "Untitled");
  const thumbnailUrl = metadata?.image || (content.previewCid ? getIpfsUrl(content.previewCid) : null);
  const contentTypeLabel = content.contentType !== undefined ? getContentTypeLabel(content.contentType as ContentType) : "Content";
  const isLocked = content.isLocked || Number(content.mintedCount ?? 0) > 0;
  const mintedCount = Number(content.mintedCount ?? 0);

  if (viewMode === "grid") {
    return (
      <div onClick={onClick} className="group relative aspect-square rounded-lg overflow-hidden bg-white/[0.02] border border-white/[0.06] hover:border-white/20 transition-all duration-300 cursor-pointer">
        {/* Thumbnail */}
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt={displayTitle} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/5 to-transparent">
            <svg className="w-8 h-8 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <p className="text-white text-sm font-medium truncate mb-0.5">{displayTitle}</p>
            <p className="text-white/50 text-xs">{contentTypeLabel}</p>
          </div>
        </div>

        {/* Badges */}
        <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
          {content.contentCid && <ModerationBadge contentCid={content.contentCid} size="sm" />}
          {isLocked ? (
            <span className="px-1.5 py-0.5 rounded text-2xs bg-amber-500/80 text-white font-medium">Locked</span>
          ) : (
            <span className="px-1.5 py-0.5 rounded text-2xs bg-emerald-500/80 text-white font-medium">Active</span>
          )}
        </div>

        {/* Stats badge */}
        {showStats && mintedCount > 0 && (
          <div className="absolute top-1.5 left-1.5">
            <span className="px-1.5 py-0.5 rounded text-2xs bg-purple-500/80 text-white font-medium">{mintedCount} sold</span>
          </div>
        )}

        {/* Visibility badge */}
        {content.visibilityLevel !== undefined && content.visibilityLevel > 0 && (
          <div className="absolute bottom-1.5 left-1.5">
            <span className={`px-1.5 py-0.5 rounded text-2xs font-medium ${
              content.visibilityLevel === 3 ? "bg-amber-500/80 text-white" :
              content.visibilityLevel === 2 ? "bg-purple-500/80 text-white" :
              "bg-blue-500/80 text-white"
            }`}>
              {content.visibilityLevel === 3 ? "Buy/Rent" : content.visibilityLevel === 2 ? "Members" : "Subscribers"}
            </span>
          </div>
        )}
      </div>
    );
  }

  // List view
  return (
    <div onClick={onClick} className="group relative flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] transition-all duration-300 cursor-pointer">
      <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      {/* Thumbnail */}
      <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt={displayTitle} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      {/* Content Info */}
      <div className="relative flex-1 min-w-0">
        <p className="text-base font-medium truncate text-white/90">{displayTitle}</p>
        <p className="text-xs text-white/40 truncate">{content.pubkey?.toBase58().slice(0, 20) || "Unknown"}...</p>
      </div>

      {/* Badges */}
      <div className="relative flex items-center gap-2 text-sm flex-shrink-0">
        <span className="text-white/30">{contentTypeLabel}</span>
        {showStats && <span className="text-white/60 font-medium">{mintedCount} sold</span>}
        {content.contentCid && <ModerationBadge contentCid={content.contentCid} size="sm" />}

        {/* Visibility Badge */}
        {content.visibilityLevel !== undefined && content.visibilityLevel > 0 && (
          <span className={`px-1.5 py-0.5 rounded text-2xs flex items-center gap-0.5 ${
            content.visibilityLevel === 3 ? "bg-amber-500/10 text-amber-400/80 border border-amber-500/20" :
            content.visibilityLevel === 2 ? "bg-purple-500/10 text-purple-400/80 border border-purple-500/20" :
            "bg-blue-500/10 text-blue-400/80 border border-blue-500/20"
          }`}>
            <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            {content.visibilityLevel === 3 ? "Buy/Rent" : content.visibilityLevel === 2 ? "Members" : "Subscribers"}
          </span>
        )}

        {/* Status Badge */}
        {isLocked ? (
          <span className="px-1.5 py-0.5 rounded text-2xs bg-amber-500/10 text-amber-400/80 border border-amber-500/20">Locked</span>
        ) : (
          <span className="px-1.5 py-0.5 rounded text-2xs bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/20">Active</span>
        )}
      </div>

      {/* Arrow */}
      <svg className="relative w-3.5 h-3.5 text-white/20 group-hover:text-white/40 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
      </svg>
    </div>
  );
}
