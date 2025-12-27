"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useContentRegistry } from "@/hooks/useContentRegistry";
import { getIpfsUrl, getContentDomain, getDomainLabel, getContentTypeLabel, getBundleTypeLabel, BundleType, ContentDomain, ContentType } from "@handcraft/sdk";
import { SidebarPanel } from "@/components/sidebar";
import Link from "next/link";

type SortOption = "recent" | "name" | "type";
type GroupOption = "none" | "type" | "domain";
type ViewMode = "grid" | "list";
type ItemTypeFilter = "all" | "content" | "bundle";
type ContentTypeFilter = "all" | ContentType;
type BundleTypeFilter = "all" | BundleType;

// All content types
const ALL_CONTENT_TYPES: { type: ContentType; label: string; domain: ContentDomain }[] = [
  // Video
  { type: ContentType.Video, label: "Video", domain: "video" },
  { type: ContentType.Movie, label: "Movie", domain: "video" },
  { type: ContentType.Television, label: "TV", domain: "video" },
  { type: ContentType.MusicVideo, label: "Music Video", domain: "video" },
  { type: ContentType.Short, label: "Short", domain: "video" },
  // Audio
  { type: ContentType.Music, label: "Music", domain: "audio" },
  { type: ContentType.Podcast, label: "Podcast", domain: "audio" },
  { type: ContentType.Audiobook, label: "Audiobook", domain: "audio" },
  // Image
  { type: ContentType.Photo, label: "Photo", domain: "image" },
  { type: ContentType.Artwork, label: "Artwork", domain: "image" },
  // Document
  { type: ContentType.Book, label: "Book", domain: "document" },
  { type: ContentType.Comic, label: "Comic", domain: "document" },
  // File
  { type: ContentType.Asset, label: "Asset", domain: "file" },
  { type: ContentType.Game, label: "Game", domain: "file" },
  { type: ContentType.Software, label: "Software", domain: "file" },
  { type: ContentType.Dataset, label: "Dataset", domain: "file" },
  // Text
  { type: ContentType.Post, label: "Post", domain: "text" },
];

// All bundle types
const ALL_BUNDLE_TYPES: { type: BundleType; label: string }[] = [
  { type: BundleType.Album, label: "Album" },
  { type: BundleType.Series, label: "Series" },
  { type: BundleType.Playlist, label: "Playlist" },
  { type: BundleType.Course, label: "Course" },
  { type: BundleType.Newsletter, label: "Newsletter" },
  { type: BundleType.Collection, label: "Collection" },
  { type: BundleType.ProductPack, label: "Product Pack" },
];

const BUNDLE_TYPE_LABELS: Record<BundleType, string> = {
  0: "Album",
  1: "Series",
  2: "Playlist",
  3: "Course",
  4: "Newsletter",
  5: "Collection",
  6: "Pack",
};

export default function LibraryClient() {
  const { publicKey } = useWallet();
  const { walletNfts, walletBundleNfts, globalContent, globalBundles, isLoadingGlobalContent, isLoadingGlobalBundles } = useContentRegistry();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [groupBy, setGroupBy] = useState<GroupOption>("none");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [itemTypeFilter, setItemTypeFilter] = useState<ItemTypeFilter>("all");
  const [contentTypeFilter, setContentTypeFilter] = useState<ContentTypeFilter>("all");
  const [bundleTypeFilter, setBundleTypeFilter] = useState<BundleTypeFilter>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  // Check if any filter is active
  const hasActiveFilters = itemTypeFilter !== "all" || contentTypeFilter !== "all" || bundleTypeFilter !== "all";

  // Clear all filters
  const clearFilters = () => {
    setItemTypeFilter("all");
    setContentTypeFilter("all");
    setBundleTypeFilter("all");
  };

  // Click outside handler for dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilters(false);
      }
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setShowSort(false);
      }
    };
    if (showFilters || showSort) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showFilters, showSort]);

  // Build owned content list - deduplicate by collectionAsset
  const ownedContent = useMemo(() => {
    if (!walletNfts || walletNfts.length === 0) return [];

    const contentByCollection = new Map(
      globalContent
        .filter(c => c.collectionAsset)
        .map(c => [c.collectionAsset.toBase58(), c])
    );

    const countMap = new Map<string, number>();
    const nftNameMap = new Map<string, string>();
    const contentCidMap = new Map<string, string>();
    for (const nft of walletNfts) {
      if (!nft.collectionAsset) continue;
      const collectionKey = nft.collectionAsset.toBase58();
      countMap.set(collectionKey, (countMap.get(collectionKey) || 0) + 1);
      if (!nftNameMap.has(collectionKey) && nft.name) {
        nftNameMap.set(collectionKey, nft.name);
      }
      if (!contentCidMap.has(collectionKey) && nft.contentCid) {
        contentCidMap.set(collectionKey, nft.contentCid);
      }
    }

    const uniqueCollections = Array.from(countMap.keys());

    return uniqueCollections
      .map(collectionKey => {
        const content = contentByCollection.get(collectionKey);
        if (!content) return null;
        const nftName = nftNameMap.get(collectionKey) || "";
        const contentCid = contentCidMap.get(collectionKey) || collectionKey;
        const title = nftName || `Content ${contentCid.slice(0, 8)}...`;
        return {
          id: contentCid,
          type: "content" as const,
          title,
          thumbnail: content.thumbnail,
          previewCid: content.previewCid,
          domain: content.contentType !== undefined ? getContentDomain(content.contentType as ContentType) : "file" as ContentDomain,
          contentType: content.contentType as ContentType | undefined,
          createdAt: content.createdAt ?? BigInt(0),
          count: countMap.get(collectionKey) || 1,
        };
      })
      .filter(Boolean);
  }, [walletNfts, globalContent]);

  // Build owned bundles list
  const ownedBundles = useMemo(() => {
    if (!walletBundleNfts || walletBundleNfts.length === 0) return [];

    const bundleMap = new Map(globalBundles.map(b => [`${b.creator.toBase58()}-${b.bundleId}`, b]));

    const countMap = new Map<string, number>();
    const nftNameMap = new Map<string, string>();
    for (const nft of walletBundleNfts) {
      if (!nft.creator || !nft.bundleId) continue;
      const key = `${nft.creator.toBase58()}-${nft.bundleId}`;
      countMap.set(key, (countMap.get(key) || 0) + 1);
      if (!nftNameMap.has(key) && nft.name) {
        nftNameMap.set(key, nft.name);
      }
    }

    const uniqueKeys = Array.from(countMap.keys());

    return uniqueKeys
      .map(key => {
        const bundle = bundleMap.get(key);
        if (!bundle) return null;
        const nftName = nftNameMap.get(key) || "";
        const title = nftName || bundle.bundleId;
        return {
          id: bundle.bundleId,
          type: "bundle" as const,
          title,
          thumbnail: bundle.thumbnail,
          previewCid: undefined,
          domain: "bundle" as string,
          bundleType: bundle.bundleType,
          createdAt: bundle.createdAt,
          itemCount: bundle.itemCount,
          count: countMap.get(key) || 1,
        };
      })
      .filter(Boolean);
  }, [walletBundleNfts, globalBundles]);

  // Combine and process items
  const libraryItems = useMemo(() => {
    const items = [...ownedContent, ...ownedBundles].filter(Boolean) as Array<{
      id: string;
      type: "content" | "bundle";
      title: string;
      thumbnail?: string;
      previewCid?: string;
      domain: ContentDomain | "bundle";
      contentType?: number;
      bundleType?: BundleType;
      createdAt: bigint;
      itemCount?: number;
      count: number;
    }>;

    let filtered = items;

    // Item type filter (content vs bundle)
    if (itemTypeFilter !== "all") {
      filtered = filtered.filter(item => item.type === itemTypeFilter);
    }

    // Content type filter (specific content types like Video, Music, etc.)
    if (contentTypeFilter !== "all") {
      filtered = filtered.filter(item =>
        item.type === "content" && item.contentType === contentTypeFilter
      );
    }

    // Bundle type filter (Album, Series, Playlist, etc.)
    if (bundleTypeFilter !== "all") {
      filtered = filtered.filter(item =>
        item.type === "bundle" && item.bundleType === bundleTypeFilter
      );
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(query) ||
        item.domain.toLowerCase().includes(query)
      );
    }

    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.title.localeCompare(b.title);
        case "type":
          return a.type.localeCompare(b.type) || a.domain.localeCompare(b.domain);
        case "recent":
        default:
          return Number(b.createdAt) - Number(a.createdAt);
      }
    });

    if (groupBy === "none") {
      return [{ label: null, items: sorted }];
    }

    const groups = new Map<string, typeof sorted>();
    for (const item of sorted) {
      let key: string;
      if (groupBy === "type") {
        key = item.type === "bundle" ? "Bundles" : "Content";
      } else {
        key = item.type === "bundle"
          ? (item.bundleType !== undefined ? BUNDLE_TYPE_LABELS[item.bundleType] : "Bundle")
          : getDomainLabel(item.domain as ContentDomain);
      }

      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }

    return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
  }, [ownedContent, ownedBundles, sortBy, groupBy, searchQuery, itemTypeFilter, contentTypeFilter, bundleTypeFilter]);

  const totalItems = ownedContent.length + ownedBundles.length;
  const isLoading = isLoadingGlobalContent || isLoadingGlobalBundles;

  // Empty wallet state
  if (!publicKey) {
    return (
      <div className="min-h-screen bg-black">
        <SidebarPanel isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className={`fixed top-4 z-50 p-3 bg-black/60 backdrop-blur-md rounded-full border border-white/10 hover:border-white/30 transition-all duration-300 ${isSidebarOpen ? 'left-[264px]' : 'left-4'}`}
        >
          <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="flex items-center justify-center min-h-screen px-4">
          <div className="text-center max-w-sm">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center backdrop-blur-sm border border-white/10">
              <svg className="w-7 h-7 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6" />
              </svg>
            </div>
            <h2 className="text-lg font-medium text-white mb-1">Your Library</h2>
            <p className="text-white/40 text-sm">Connect your wallet to view your collection</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <SidebarPanel isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className={`fixed top-4 z-50 p-3 bg-black/60 backdrop-blur-md rounded-full border border-white/10 hover:border-white/30 transition-all duration-300 ${isSidebarOpen ? 'left-[264px]' : 'left-4'}`}
      >
        <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Compact header bar */}
      <div className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            {/* Left: Title & count */}
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-medium text-white">Library</h1>
              <span className="text-base text-white/40">{totalItems} items</span>
            </div>

            {/* Right: Controls */}
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative hidden sm:block">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-40 pl-8 pr-3 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-lg text-base text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 focus:bg-white/[0.06] transition-all"
                />
              </div>

              {/* Divider */}
              <div className="w-px h-5 bg-white/[0.08] hidden sm:block" />

              {/* Sort dropdown */}
              <div className="relative" ref={sortRef}>
                <button
                  onClick={() => setShowSort(!showSort)}
                  className={`p-1.5 rounded-lg transition-all duration-200 ${
                    showSort ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
                  }`}
                  title={`Sort by: ${sortBy}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7h6M3 12h9m-9 5h12M17 3v18m0 0l-3-3m3 3l3-3" />
                  </svg>
                </button>

                {showSort && (
                  <div className="absolute right-0 top-full mt-2 w-40 bg-black/95 backdrop-blur-xl border border-white/[0.08] rounded-lg shadow-xl z-50 overflow-hidden">
                    <div className="p-2">
                      <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1.5 px-1">Sort By</p>
                      <div className="flex flex-col gap-1">
                        {(["recent", "name", "type"] as SortOption[]).map((opt) => (
                          <button
                            key={opt}
                            onClick={() => {
                              setSortBy(opt);
                              setShowSort(false);
                            }}
                            className={`px-2 py-1.5 text-sm font-medium rounded-md capitalize transition-all duration-200 text-left ${
                              sortBy === opt
                                ? "bg-white text-black"
                                : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
                            }`}
                          >
                            {opt === "recent" ? "Recent" : opt === "name" ? "Name" : "Type"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Group toggle */}
              <button
                onClick={() => setGroupBy(groupBy === "none" ? "type" : groupBy === "type" ? "domain" : "none")}
                className={`p-1.5 rounded-lg transition-all duration-200 ${
                  groupBy !== "none" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
                }`}
                title={`Group by: ${groupBy}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
              </button>

              {/* Filter toggle */}
              <div className="relative" ref={filterRef}>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`p-1.5 rounded-lg transition-all duration-200 ${
                    hasActiveFilters ? "bg-purple-500/20 text-purple-300" :
                    showFilters ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
                  }`}
                  title="Filter"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  {hasActiveFilters && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-purple-400 rounded-full" />
                  )}
                </button>

                {/* Filter dropdown */}
                {showFilters && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-black/95 backdrop-blur-xl border border-white/[0.08] rounded-lg shadow-xl z-50 overflow-hidden max-h-[70vh] overflow-y-auto">
                    {/* Item type filter */}
                    <div className="p-2 border-b border-white/[0.06]">
                      <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1.5 px-1">Item Type</p>
                      <div className="flex items-center gap-1">
                        {(["all", "content", "bundle"] as ItemTypeFilter[]).map((opt) => (
                          <button
                            key={opt}
                            onClick={() => {
                              setItemTypeFilter(opt);
                              // Reset all filters when "all" is selected
                              if (opt === "all") {
                                setContentTypeFilter("all");
                                setBundleTypeFilter("all");
                              }
                              // Reset type-specific filters when switching
                              if (opt === "content") setBundleTypeFilter("all");
                              if (opt === "bundle") setContentTypeFilter("all");
                            }}
                            className={`flex-1 px-2 py-1.5 text-sm font-medium rounded-md capitalize transition-all duration-200 ${
                              itemTypeFilter === opt
                                ? "bg-white text-black"
                                : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Content type filter (content only, hide if bundle type selected) */}
                    {itemTypeFilter !== "bundle" && bundleTypeFilter === "all" && (
                      <div className="p-2 border-b border-white/[0.06]">
                        <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1.5 px-1">Content Type</p>
                        <div className="flex flex-wrap gap-1">
                          <button
                            onClick={() => setContentTypeFilter("all")}
                            className={`px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                              contentTypeFilter === "all"
                                ? "bg-white text-black"
                                : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
                            }`}
                          >
                            All
                          </button>
                          {ALL_CONTENT_TYPES.map(({ type, label }) => (
                            <button
                              key={type}
                              onClick={() => {
                                setContentTypeFilter(type);
                                setItemTypeFilter("content");
                              }}
                              className={`px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                                contentTypeFilter === type
                                  ? "bg-white text-black"
                                  : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Bundle type filter (bundles only, hide if content type selected) */}
                    {itemTypeFilter !== "content" && contentTypeFilter === "all" && (
                      <div className="p-2 border-b border-white/[0.06]">
                        <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1.5 px-1">Bundle Type</p>
                        <div className="flex flex-wrap gap-1">
                          <button
                            onClick={() => setBundleTypeFilter("all")}
                            className={`px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                              bundleTypeFilter === "all"
                                ? "bg-white text-black"
                                : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
                            }`}
                          >
                            All
                          </button>
                          {ALL_BUNDLE_TYPES.map(({ type, label }) => (
                            <button
                              key={type}
                              onClick={() => {
                                setBundleTypeFilter(type);
                                setItemTypeFilter("bundle");
                              }}
                              className={`px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                                bundleTypeFilter === type
                                  ? "bg-white text-black"
                                  : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Clear button */}
                    {hasActiveFilters && (
                      <div className="p-2">
                        <button
                          onClick={clearFilters}
                          className="w-full px-2 py-1.5 text-sm font-medium text-white/50 hover:text-white/70 hover:bg-white/[0.04] rounded transition-all"
                        >
                          Clear all filters
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* View toggle */}
              <div className="flex items-center bg-white/[0.03] rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded-md transition-all duration-200 ${
                    viewMode === "grid" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M1 2.5A1.5 1.5 0 012.5 1h3A1.5 1.5 0 017 2.5v3A1.5 1.5 0 015.5 7h-3A1.5 1.5 0 011 5.5v-3zm8 0A1.5 1.5 0 0110.5 1h3A1.5 1.5 0 0115 2.5v3A1.5 1.5 0 0113.5 7h-3A1.5 1.5 0 019 5.5v-3zm-8 8A1.5 1.5 0 012.5 9h3A1.5 1.5 0 017 10.5v3A1.5 1.5 0 015.5 15h-3A1.5 1.5 0 011 13.5v-3zm8 0A1.5 1.5 0 0110.5 9h3a1.5 1.5 0 011.5 1.5v3a1.5 1.5 0 01-1.5 1.5h-3A1.5 1.5 0 019 13.5v-3z"/>
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 rounded-md transition-all duration-200 ${
                    viewMode === "list" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
                    <path fillRule="evenodd" d="M2.5 12a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5zm0-4a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5zm0-4a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5z"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Mobile search */}
          <div className="sm:hidden pb-3">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                placeholder="Search library..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white/[0.04] border border-white/[0.06] rounded-lg text-base text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-32">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        ) : totalItems === 0 ? (
          <div className="flex items-center justify-center py-32">
            <div className="text-center max-w-xs">
              <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
                <svg className="w-6 h-6 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-1">Empty library</h3>
              <p className="text-white/40 text-base mb-4">Collect content to build your library</p>
              <Link
                href="/content"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-black rounded-lg text-base font-medium hover:bg-white/90 transition-colors"
              >
                <span>Browse</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {libraryItems.map((group, groupIndex) => (
              <div key={group.label || groupIndex}>
                {group.label && (
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-sm font-medium text-white/50 uppercase tracking-wider">{group.label}</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-white/[0.08] to-transparent" />
                    <span className="text-sm text-white/30">{group.items.length}</span>
                  </div>
                )}

                {viewMode === "grid" ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 sm:gap-3">
                    {group.items.map((item, idx) => (
                      <Link
                        key={`${item.type}-${item.id}`}
                        href={`/content/${item.id}`}
                        className="group relative aspect-square rounded-lg overflow-hidden bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-300"
                        style={{ animationDelay: `${idx * 30}ms` }}
                      >
                        {(item.thumbnail || item.previewCid) ? (
                          <img
                            src={item.thumbnail || (item.previewCid ? getIpfsUrl(item.previewCid) : '')}
                            alt={item.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/[0.04] to-transparent">
                            <svg className="w-8 h-8 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              {item.type === "bundle" ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                              ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                              )}
                            </svg>
                          </div>
                        )}

                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300">
                          <div className="absolute bottom-0 left-0 right-0 p-2">
                            <p className="text-white text-sm font-medium truncate leading-tight">{item.title}</p>
                            <p className="text-white/50 text-xs capitalize">
                              {item.type === "bundle"
                                ? (item.bundleType !== undefined ? BUNDLE_TYPE_LABELS[item.bundleType] : "Bundle")
                                : getDomainLabel(item.domain as ContentDomain)}
                            </p>
                          </div>
                        </div>

                        {/* Badges */}
                        <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                          {item.count > 1 && (
                            <span className="px-1 py-0.5 rounded text-2xs font-bold bg-amber-500/90 text-white shadow-sm">
                              ×{item.count}
                            </span>
                          )}
                          {item.type === "bundle" && (
                            <span className="px-1.5 py-0.5 rounded text-2xs font-medium bg-purple-500/80 text-white shadow-sm">
                              Bundle
                            </span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {group.items.map((item, idx) => (
                      <Link
                        key={`${item.type}-${item.id}`}
                        href={`/content/${item.id}`}
                        className="group flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-white/[0.03] transition-all duration-200"
                        style={{ animationDelay: `${idx * 20}ms` }}
                      >
                        <div className="w-10 h-10 rounded-md overflow-hidden bg-white/[0.04] flex-shrink-0">
                          {(item.thumbnail || item.previewCid) ? (
                            <img
                              src={item.thumbnail || (item.previewCid ? getIpfsUrl(item.previewCid) : '')}
                              alt={item.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <svg className="w-5 h-5 text-white/15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13" />
                              </svg>
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-base text-white font-medium truncate group-hover:text-white/90">{item.title}</p>
                          <p className="text-sm text-white/40 capitalize">
                            {item.type === "bundle"
                              ? (item.bundleType !== undefined ? BUNDLE_TYPE_LABELS[item.bundleType] : "Bundle")
                              : getDomainLabel(item.domain as ContentDomain)}
                            {item.type === "bundle" && item.itemCount && ` · ${item.itemCount} items`}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {item.count > 1 && (
                            <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-amber-500/80 text-white">
                              ×{item.count}
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            item.type === "bundle"
                              ? "bg-purple-500/20 text-purple-300"
                              : "bg-white/[0.06] text-white/50"
                          }`}>
                            {item.type === "bundle" ? "Bundle" : "Content"}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
