"use client";

import { BundleType, getBundleTypeLabel } from "@handcraft/sdk";
import { PublicKey } from "@solana/web3.js";

interface BundleCardProps {
  bundleId: string;
  title: string;
  description?: string;
  bundleType: BundleType;
  itemCount: number;
  coverImage?: string;
  creator: PublicKey;
  isActive: boolean;
  onClick?: () => void;
  onManage?: () => void;
  isOwner?: boolean;
}

const BUNDLE_TYPE_ICONS: Record<BundleType, string> = {
  [BundleType.Album]: "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3",
  [BundleType.Series]: "M7 4v16M7 8h8a2 2 0 002-2V4M7 12h10M7 16h10",
  [BundleType.Playlist]: "M4 6h16M4 10h16M4 14h16M4 18h16",
  [BundleType.Course]: "M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z",
  [BundleType.Newsletter]: "M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z",
  [BundleType.Collection]: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
  [BundleType.ProductPack]: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
};

export function BundleCard({
  bundleId,
  title,
  description,
  bundleType,
  itemCount,
  coverImage,
  creator,
  isActive,
  onClick,
  onManage,
  isOwner,
}: BundleCardProps) {
  return (
    <div
      className={`bg-gray-900 rounded-xl overflow-hidden border border-gray-800 hover:border-gray-700 transition-all cursor-pointer ${
        !isActive ? "opacity-60" : ""
      }`}
      onClick={onClick}
    >
      {/* Cover Image or Placeholder */}
      <div className="relative aspect-video bg-gray-800">
        {coverImage ? (
          <img
            src={coverImage}
            alt={title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
            <svg
              className="w-16 h-16 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d={BUNDLE_TYPE_ICONS[bundleType]}
              />
            </svg>
          </div>
        )}

        {/* Bundle Type Badge */}
        <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 rounded text-xs font-medium">
          {getBundleTypeLabel(bundleType)}
        </div>

        {/* Item Count Badge */}
        <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 rounded text-xs">
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </div>

        {/* Inactive Badge */}
        {!isActive && (
          <div className="absolute top-2 right-2 px-2 py-1 bg-yellow-500/80 rounded text-xs font-medium text-black">
            Draft
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-semibold text-white truncate">{title}</h3>
        {description && (
          <p className="text-sm text-gray-400 mt-1 line-clamp-2">{description}</p>
        )}

        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-gray-500">
            by {creator.toBase58().slice(0, 4)}...{creator.toBase58().slice(-4)}
          </span>

          {isOwner && onManage && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onManage();
              }}
              className="text-xs text-primary-400 hover:text-primary-300"
            >
              Manage
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
