"use client";

import Link from "next/link";
import { useMemo } from "react";
import { getIpfsUrl } from "@handcraft/sdk";
import type { CreatorFeaturedContent, IndexedContent, IndexedBundle } from "@/lib/supabase";

interface FeaturedContentGridProps {
  featuredContent: CreatorFeaturedContent[];
  contentData: IndexedContent[];
  bundleData: IndexedBundle[];
  isEditable?: boolean;
  onEdit?: () => void;
}

interface FeaturedItem {
  featured: CreatorFeaturedContent;
  data: IndexedContent | IndexedBundle | null;
  type: "content" | "bundle";
}

export function FeaturedContentGrid({
  featuredContent,
  contentData,
  bundleData,
  isEditable = false,
  onEdit,
}: FeaturedContentGridProps) {
  // Map featured content to actual data
  const featuredItems = useMemo<FeaturedItem[]>(() => {
    return featuredContent
      .sort((a, b) => a.position - b.position)
      .map((featured) => {
        let data: IndexedContent | IndexedBundle | null = null;

        if (featured.content_type === "content") {
          data = contentData.find((c) => c.content_cid === featured.content_cid) || null;
        } else {
          data = bundleData.find((b) => b.bundle_id === featured.content_cid) || null;
        }

        return {
          featured,
          data,
          type: featured.content_type,
        };
      })
      .filter((item) => item.data !== null);
  }, [featuredContent, contentData, bundleData]);

  if (featuredItems.length === 0 && !isEditable) {
    return null;
  }

  const heroItem = featuredItems[0];
  const gridItems = featuredItems.slice(1);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white/70 uppercase tracking-wider">
          Featured
        </h3>
        {isEditable && onEdit && (
          <button
            onClick={onEdit}
            className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Edit
          </button>
        )}
      </div>

      {featuredItems.length === 0 && isEditable && (
        <button
          onClick={onEdit}
          className="w-full p-8 border border-dashed border-white/10 rounded-xl hover:border-white/20 hover:bg-white/[0.02] transition-all duration-300 text-white/30 text-sm"
        >
          Select content to feature on your profile
        </button>
      )}

      {featuredItems.length > 0 && (
        <div className="space-y-4">
          {/* Hero Item (position 0) */}
          {heroItem && (
            <FeaturedHeroCard item={heroItem} />
          )}

          {/* Grid Items (positions 1-5) */}
          {gridItems.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {gridItems.map((item) => (
                <FeaturedGridCard key={item.featured.id} item={item} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FeaturedHeroCard({ item }: { item: FeaturedItem }) {
  const { featured, data, type } = item;
  if (!data) return null;

  const title = featured.custom_title || data.name || "Untitled";
  const description = featured.custom_description || data.description;
  const imageUrl = data.image_url ? getIpfsUrl(data.image_url.replace("https://ipfs.io/ipfs/", "")) : null;
  const href = type === "content"
    ? `/content/${(data as IndexedContent).content_cid}`
    : `/content/bundle/${(data as IndexedBundle).bundle_id}`;

  return (
    <Link
      href={href}
      className="relative block w-full aspect-[21/9] rounded-xl overflow-hidden group"
    >
      {/* Background */}
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-purple-900/50 via-cyan-900/30 to-black" />
      )}

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-6">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 mb-3">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
            type === "bundle"
              ? "bg-purple-500/30 text-purple-300"
              : "bg-cyan-500/30 text-cyan-300"
          }`}>
            {type === "bundle" ? "Bundle" : "Content"}
          </span>
          {featured.is_hero && (
            <span className="px-2 py-0.5 bg-amber-500/30 text-amber-300 rounded text-xs font-medium">
              Featured
            </span>
          )}
        </div>

        <h3 className="text-xl sm:text-2xl font-semibold text-white mb-2 group-hover:text-cyan-300 transition-colors">
          {title}
        </h3>

        {description && (
          <p className="text-white/60 text-sm line-clamp-2 max-w-2xl">
            {description}
          </p>
        )}
      </div>
    </Link>
  );
}

function FeaturedGridCard({ item }: { item: FeaturedItem }) {
  const { featured, data, type } = item;
  if (!data) return null;

  const title = featured.custom_title || data.name || "Untitled";
  const imageUrl = data.image_url ? getIpfsUrl(data.image_url.replace("https://ipfs.io/ipfs/", "")) : null;
  const href = type === "content"
    ? `/content/${(data as IndexedContent).content_cid}`
    : `/content/bundle/${(data as IndexedBundle).bundle_id}`;

  return (
    <Link
      href={href}
      className="relative block aspect-square rounded-xl overflow-hidden group"
    >
      {/* Background */}
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-purple-900/30 via-cyan-900/20 to-black" />
      )}

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 group-hover:opacity-100 transition-opacity" />

      {/* Type badge */}
      <div className="absolute top-2 right-2">
        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
          type === "bundle"
            ? "bg-purple-500/50 text-purple-200"
            : "bg-cyan-500/50 text-cyan-200"
        }`}>
          {type === "bundle" ? "Bundle" : ""}
        </span>
      </div>

      {/* Title */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <h4 className="text-sm font-medium text-white line-clamp-2 group-hover:text-cyan-300 transition-colors">
          {title}
        </h4>
      </div>
    </Link>
  );
}
