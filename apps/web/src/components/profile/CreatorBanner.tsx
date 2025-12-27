"use client";

import { getIpfsUrl } from "@handcraft/sdk";

interface CreatorBannerProps {
  bannerCid: string | null | undefined;
  bannerUrl: string | null | undefined;
  username: string | null | undefined;
  isEditable?: boolean;
  onEdit?: () => void;
}

export function CreatorBanner({
  bannerCid,
  bannerUrl,
  username,
  isEditable = false,
  onEdit,
}: CreatorBannerProps) {
  // Get banner URL from CID or direct URL
  const imageUrl = bannerCid
    ? getIpfsUrl(bannerCid)
    : bannerUrl || null;

  return (
    <div className="relative w-full h-40 sm:h-48 md:h-56 lg:h-64 overflow-hidden rounded-2xl">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={`${username || "Creator"}'s banner`}
          className="w-full h-full object-cover"
        />
      ) : (
        // Fallback gradient
        <div className="w-full h-full bg-gradient-to-br from-purple-900/50 via-cyan-900/30 to-black" />
      )}

      {/* Gradient overlay for better text contrast */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

      {/* Edit button */}
      {isEditable && onEdit && (
        <button
          onClick={onEdit}
          className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 rounded-lg backdrop-blur-sm transition-all duration-300 group"
        >
          <svg
            className="w-5 h-5 text-white/70 group-hover:text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
