"use client";

import { useState, useEffect, useMemo, useCallback, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useContentRegistry } from "@/hooks/useContentRegistry";
import { getIpfsUrl, getContentTypeLabel, getBundleTypeLabel, ContentType, BundleType } from "@handcraft/sdk";
import { SidebarPanel } from "@/components/sidebar";

const SEARCH_HISTORY_KEY = "handcraft-search-history";
const MAX_HISTORY = 10;

type SearchTab = "all" | "content" | "bundles" | "creators";
type SortOption = "recent" | "oldest" | "name";
type ContentTypeFilter = "all" | ContentType;
type BundleTypeFilter = "all" | BundleType;
type ViewMode = "grid" | "list";

const ALL_CONTENT_TYPES: ContentType[] = [
  ContentType.Video,
  ContentType.Movie,
  ContentType.Television,
  ContentType.MusicVideo,
  ContentType.Short,
  ContentType.Music,
  ContentType.Podcast,
  ContentType.Audiobook,
  ContentType.Photo,
  ContentType.Artwork,
  ContentType.Book,
  ContentType.Comic,
  ContentType.Asset,
  ContentType.Game,
  ContentType.Software,
  ContentType.Dataset,
  ContentType.Post,
];

const ALL_BUNDLE_TYPES: BundleType[] = [
  BundleType.Album,
  BundleType.Series,
  BundleType.Playlist,
  BundleType.Course,
  BundleType.Newsletter,
  BundleType.Collection,
  BundleType.ProductPack,
];

interface ContentMetadata {
  name?: string;
  description?: string;
  image?: string;
  tags?: string[];
}

interface BundleMetadata {
  name?: string;
  description?: string;
}

interface EnrichedContent {
  pubkey: string;
  creator: string;
  collectionAsset: string;
  previewCid: string;
  contentCid?: string;
  metadataCid?: string;
  contentType?: number;
  createdAt?: bigint;
  metadata?: ContentMetadata;
  moderationStatus?: string;
}

interface EnrichedBundle {
  bundleId: string;
  creator: string;
  bundleType: BundleType;
  collectionAsset: string;
  itemCount: number;
  createdAt: bigint;
  metadataCid?: string;
  metadata?: BundleMetadata;
}

function useSearchHistory() {
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch {
        setHistory([]);
      }
    }
  }, []);

  const addToHistory = useCallback((query: string) => {
    setHistory((prev) => {
      const filtered = prev.filter((q) => q.toLowerCase() !== query.toLowerCase());
      const updated = [query, ...filtered].slice(0, MAX_HISTORY);
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
    setHistory([]);
  }, []);

  return { history, addToHistory, clearHistory };
}

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get("q") || "";
  const [activeTab, setActiveTab] = useState<SearchTab>("all");
  const [localQuery, setLocalQuery] = useState(query);
  const { history, addToHistory, clearHistory } = useSearchHistory();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Content section state
  const [contentSort, setContentSort] = useState<SortOption>("recent");
  const [contentTypeFilter, setContentTypeFilter] = useState<ContentTypeFilter>("all");
  const [contentViewMode, setContentViewMode] = useState<ViewMode>("list");
  const [contentGroupBy, setContentGroupBy] = useState<"none" | "type" | "domain">("none");
  const [showContentSort, setShowContentSort] = useState(false);
  const [showContentFilter, setShowContentFilter] = useState(false);
  const contentSortRef = useRef<HTMLDivElement>(null);
  const contentFilterRef = useRef<HTMLDivElement>(null);

  // Bundle section state
  const [bundleSort, setBundleSort] = useState<SortOption>("recent");
  const [bundleTypeFilter, setBundleTypeFilter] = useState<BundleTypeFilter>("all");
  const [bundleViewMode, setBundleViewMode] = useState<ViewMode>("list");
  const [bundleGroupBy, setBundleGroupBy] = useState<"none" | "type" | "domain">("none");
  const [showBundleSort, setShowBundleSort] = useState(false);
  const [showBundleFilter, setShowBundleFilter] = useState(false);
  const bundleSortRef = useRef<HTMLDivElement>(null);
  const bundleFilterRef = useRef<HTMLDivElement>(null);

  // Creator section state
  const [creatorSort, setCreatorSort] = useState<SortOption>("name");
  const [creatorViewMode, setCreatorViewMode] = useState<ViewMode>("list");
  const [showCreatorSort, setShowCreatorSort] = useState(false);
  const creatorSortRef = useRef<HTMLDivElement>(null);

  const {
    globalContent,
    globalBundles,
    isLoadingGlobalContent,
    getCreatorUsername,
  } = useContentRegistry();

  const [enrichedContent, setEnrichedContent] = useState<EnrichedContent[]>([]);
  const [enrichedBundles, setEnrichedBundles] = useState<EnrichedBundle[]>([]);
  const [isEnriching, setIsEnriching] = useState(false);

  useEffect(() => {
    if (query) {
      addToHistory(query);
      setLocalQuery(query);
    }
  }, [query, addToHistory]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contentSortRef.current && !contentSortRef.current.contains(e.target as Node)) setShowContentSort(false);
      if (contentFilterRef.current && !contentFilterRef.current.contains(e.target as Node)) setShowContentFilter(false);
      if (bundleSortRef.current && !bundleSortRef.current.contains(e.target as Node)) setShowBundleSort(false);
      if (bundleFilterRef.current && !bundleFilterRef.current.contains(e.target as Node)) setShowBundleFilter(false);
      if (creatorSortRef.current && !creatorSortRef.current.contains(e.target as Node)) setShowCreatorSort(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!globalContent.length && !globalBundles.length) return;

    async function enrichData() {
      setIsEnriching(true);

      const contentPromises = globalContent.map(async (item) => {
        let metadata: ContentMetadata | undefined;
        if (item.metadataCid) {
          try {
            const res = await fetch(getIpfsUrl(item.metadataCid));
            if (res.ok) {
              const json = await res.json();
              metadata = {
                name: json.properties?.title || json.name,
                description: json.description,
                image: json.image,
                tags: json.properties?.tags || [],
              };
            }
          } catch {
            // Keep metadata undefined
          }
        }
        return {
          pubkey: item.pubkey?.toBase58() || "",
          creator: item.creator.toBase58(),
          collectionAsset: item.collectionAsset?.toBase58() || "",
          previewCid: item.previewCid,
          contentCid: item.contentCid,
          metadataCid: item.metadataCid,
          contentType: item.contentType,
          createdAt: item.createdAt,
          metadata,
          moderationStatus: item.moderationStatus,
        };
      });

      const bundlePromises = globalBundles.map(async (bundle) => {
        let metadata: BundleMetadata | undefined;
        if (bundle.metadataCid) {
          try {
            const res = await fetch(getIpfsUrl(bundle.metadataCid));
            if (res.ok) {
              metadata = await res.json();
            }
          } catch {
            // Keep metadata undefined
          }
        }
        return {
          bundleId: bundle.bundleId,
          creator: bundle.creator.toBase58(),
          bundleType: bundle.bundleType,
          collectionAsset: bundle.collectionAsset?.toBase58() || "",
          itemCount: bundle.itemCount,
          createdAt: bundle.createdAt,
          metadataCid: bundle.metadataCid,
          metadata,
        };
      });

      const [contentResults, bundleResults] = await Promise.all([
        Promise.all(contentPromises),
        Promise.all(bundlePromises),
      ]);

      setEnrichedContent(contentResults);
      setEnrichedBundles(bundleResults);
      setIsEnriching(false);
    }

    enrichData();
  }, [globalContent, globalBundles]);

  const searchResults = useMemo(() => {
    if (!query) return { content: [], bundles: [], creators: [] };

    const lowerQuery = query.toLowerCase();

    let matchedContent = enrichedContent.filter((item) => {
      if (item.moderationStatus === "disputed" || item.moderationStatus === "flagged") {
        return false;
      }

      const name = item.metadata?.name?.toLowerCase() || "";
      const description = item.metadata?.description?.toLowerCase() || "";
      const tags = item.metadata?.tags?.map((t) => t.toLowerCase()) || [];
      const creator = item.creator.toLowerCase();

      return (
        name.includes(lowerQuery) ||
        description.includes(lowerQuery) ||
        tags.some((t) => t.includes(lowerQuery)) ||
        creator.includes(lowerQuery)
      );
    });

    // Apply content type filter
    if (contentTypeFilter !== "all") {
      matchedContent = matchedContent.filter(
        (item) => item.contentType === contentTypeFilter
      );
    }

    let matchedBundles = enrichedBundles.filter((bundle) => {
      const name = bundle.metadata?.name?.toLowerCase() || "";
      const description = bundle.metadata?.description?.toLowerCase() || "";
      const creator = bundle.creator.toLowerCase();

      return (
        name.includes(lowerQuery) ||
        description.includes(lowerQuery) ||
        creator.includes(lowerQuery)
      );
    });

    // Apply bundle type filter
    if (bundleTypeFilter !== "all") {
      matchedBundles = matchedBundles.filter(
        (bundle) => bundle.bundleType === bundleTypeFilter
      );
    }

    // Sort content
    matchedContent.sort((a, b) => {
      if (contentSort === "name") {
        const nameA = a.metadata?.name || "";
        const nameB = b.metadata?.name || "";
        return nameA.localeCompare(nameB);
      }
      const timeA = a.createdAt ? Number(a.createdAt) : 0;
      const timeB = b.createdAt ? Number(b.createdAt) : 0;
      return contentSort === "recent" ? timeB - timeA : timeA - timeB;
    });

    // Sort bundles
    matchedBundles.sort((a, b) => {
      if (bundleSort === "name") {
        const nameA = a.metadata?.name || "";
        const nameB = b.metadata?.name || "";
        return nameA.localeCompare(nameB);
      }
      const timeA = Number(a.createdAt);
      const timeB = Number(b.createdAt);
      return bundleSort === "recent" ? timeB - timeA : timeA - timeB;
    });

    // Get creators
    const creatorSet = new Set<string>();
    matchedContent.forEach((c) => creatorSet.add(c.creator));
    matchedBundles.forEach((b) => creatorSet.add(b.creator));
    enrichedContent.forEach((c) => {
      if (c.creator.toLowerCase().includes(lowerQuery)) {
        creatorSet.add(c.creator);
      }
    });

    // Sort creators
    let creators = Array.from(creatorSet);
    creators.sort((a, b) => {
      if (creatorSort === "name") {
        return a.localeCompare(b);
      }
      return 0; // No time data for creators
    });

    return {
      content: matchedContent,
      bundles: matchedBundles,
      creators,
    };
  }, [query, enrichedContent, enrichedBundles, contentSort, bundleSort, creatorSort, contentTypeFilter, bundleTypeFilter]);

  // Grouped content results
  const groupedContent = useMemo(() => {
    const content = searchResults.content;

    if (contentGroupBy === "none") {
      return [{ label: null as string | null, items: content }];
    }

    // For "type", we group all as "Content" since this section is already content-only
    // For "domain", we group by content type
    if (contentGroupBy === "type") {
      if (content.length === 0) return [];
      return [{ label: "Content", items: content }];
    }

    // Group by content type (domain)
    const groups = new Map<string, typeof content>();
    for (const item of content) {
      const key = item.contentType !== undefined
        ? getContentTypeLabel(item.contentType as ContentType)
        : "Other";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
  }, [searchResults.content, contentGroupBy]);

  // Grouped bundle results
  const groupedBundles = useMemo(() => {
    const bundles = searchResults.bundles;

    if (bundleGroupBy === "none") {
      return [{ label: null as string | null, items: bundles }];
    }

    // For "type", we group all as "Bundles" since this section is already bundles-only
    // For "domain", we group by bundle type
    if (bundleGroupBy === "type") {
      if (bundles.length === 0) return [];
      return [{ label: "Bundles", items: bundles }];
    }

    // Group by bundle type (domain)
    const groups = new Map<string, typeof bundles>();
    for (const item of bundles) {
      const key = getBundleTypeLabel(item.bundleType);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
  }, [searchResults.bundles, bundleGroupBy]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (localQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(localQuery.trim())}`);
    }
  };

  const isLoading = isLoadingGlobalContent || isEnriching;
  const totalResults = searchResults.content.length + searchResults.bundles.length + searchResults.creators.length;
  const hasContentFilters = contentTypeFilter !== "all";
  const hasBundleFilters = bundleTypeFilter !== "all";

  const handleTabChange = (tab: SearchTab) => {
    setActiveTab(tab);
  };

  return (
    <div className="min-h-screen bg-black text-white">
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
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          {/* Search input */}
          <form onSubmit={handleSearch} className="py-3">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={localQuery}
                onChange={(e) => setLocalQuery(e.target.value)}
                placeholder="Search content, bundles, creators..."
                className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg pl-10 pr-20 py-2.5 text-base placeholder:text-white/30 focus:outline-none focus:border-white/20 focus:bg-white/[0.06] transition-all"
                autoFocus
              />
              <button
                type="submit"
                className="absolute inset-y-1.5 right-1.5 px-3 bg-white/10 hover:bg-white/20 rounded-md transition-colors flex items-center justify-center"
              >
                <span className="text-sm font-medium text-white/70">Search</span>
              </button>
            </div>
          </form>

          {/* Tabs */}
          {query && (
            <div className="flex items-center gap-1 pb-3 overflow-x-auto no-scrollbar">
              {(["all", "content", "bundles", "creators"] as SearchTab[]).map((tab) => {
                const count =
                  tab === "all" ? totalResults :
                  tab === "content" ? searchResults.content.length :
                  tab === "bundles" ? searchResults.bundles.length :
                  searchResults.creators.length;

                return (
                  <button
                    key={tab}
                    onClick={() => handleTabChange(tab)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                      activeTab === tab
                        ? "bg-white text-black"
                        : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    <span className="ml-1 opacity-60">{count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
        {!query ? (
          <div>
            {history.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-white/40 uppercase tracking-wider">Recent</span>
                  <button
                    onClick={clearHistory}
                    className="text-xs text-white/30 hover:text-white/50 transition-colors"
                  >
                    Clear
                  </button>
                </div>
                <div className="space-y-1">
                  {history.map((q, i) => (
                    <Link
                      key={i}
                      href={`/search?q=${encodeURIComponent(q)}`}
                      className="group flex items-center gap-3 px-3 py-2 -mx-3 rounded-lg hover:bg-white/[0.03] transition-colors"
                    >
                      <svg className="w-3.5 h-3.5 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-base text-white/60 group-hover:text-white/80 transition-colors">{q}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {history.length === 0 && (
              <div className="flex items-center justify-center py-32">
                <div className="text-center max-w-xs">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
                    <svg className="w-6 h-6 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-white mb-1">Search</h3>
                  <p className="text-white/40 text-base">Find content, bundles, and creators</p>
                </div>
              </div>
            )}
          </div>
        ) : isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-3 p-3 rounded-lg bg-white/[0.02] animate-pulse">
                <div className="w-12 h-12 bg-white/[0.04] rounded-md" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-white/[0.04] rounded w-3/4" />
                  <div className="h-2.5 bg-white/[0.04] rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : totalResults === 0 ? (
          <div className="flex items-center justify-center py-32">
            <div className="text-center max-w-xs">
              <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
                <svg className="w-6 h-6 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-1">No results</h3>
              <p className="text-white/40 text-base">Try a different search term</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Content Results */}
            {(activeTab === "all" || activeTab === "content") && searchResults.content.length > 0 && (
              <div>
                {/* Section Header with Controls */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-white/40 uppercase tracking-wider">Content</span>
                    <span className="text-xs text-white/30">{searchResults.content.length}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Sort Dropdown */}
                    <div ref={contentSortRef} className="relative">
                      <button
                        onClick={() => { setShowContentSort(!showContentSort); setShowContentFilter(false); }}
                        className={`p-1.5 rounded-lg transition-all duration-200 ${showContentSort ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}
                        title={`Sort by: ${contentSort}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7h6M3 12h9m-9 5h12M17 3v18m0 0l-3-3m3 3l3-3" />
                        </svg>
                      </button>
                      {showContentSort && (
                        <div className="absolute right-0 top-full mt-2 w-40 bg-black/95 backdrop-blur-xl border border-white/[0.08] rounded-lg shadow-xl z-50 overflow-hidden">
                          <div className="p-2">
                            <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1.5 px-1">Sort By</p>
                            <div className="flex flex-col gap-1">
                              {[{ value: "recent", label: "Recent" }, { value: "oldest", label: "Oldest" }, { value: "name", label: "Name" }].map((opt) => (
                                <button
                                  key={opt.value}
                                  onClick={() => { setContentSort(opt.value as SortOption); setShowContentSort(false); }}
                                  className={`px-2 py-1.5 text-sm font-medium rounded-md transition-all duration-200 text-left ${contentSort === opt.value ? "bg-white text-black" : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"}`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Filter Dropdown */}
                    <div ref={contentFilterRef} className="relative">
                      <button
                        onClick={() => { setShowContentFilter(!showContentFilter); setShowContentSort(false); }}
                        className={`p-1.5 rounded-lg transition-all duration-200 ${hasContentFilters ? "bg-purple-500/20 text-purple-300" : showContentFilter ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}
                        title="Filter"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                        {hasContentFilters && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-purple-400 rounded-full" />}
                      </button>
                      {showContentFilter && (
                        <div className="absolute right-0 top-full mt-2 w-56 bg-black/95 backdrop-blur-xl border border-white/[0.08] rounded-lg shadow-xl z-50 overflow-hidden max-h-[70vh] overflow-y-auto">
                          <div className="p-2 border-b border-white/[0.06]">
                            <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1.5 px-1">Content Type</p>
                            <div className="flex flex-wrap gap-1">
                              <button onClick={() => { setContentTypeFilter("all"); setShowContentFilter(false); }} className={`px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${contentTypeFilter === "all" ? "bg-white text-black" : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"}`}>All</button>
                              {ALL_CONTENT_TYPES.map((type) => (
                                <button key={type} onClick={() => { setContentTypeFilter(type); setShowContentFilter(false); }} className={`px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${contentTypeFilter === type ? "bg-white text-black" : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"}`}>{getContentTypeLabel(type)}</button>
                              ))}
                            </div>
                          </div>
                          {hasContentFilters && (
                            <div className="p-2">
                              <button onClick={() => { setContentTypeFilter("all"); setShowContentFilter(false); }} className="w-full px-2 py-1.5 text-sm font-medium text-white/50 hover:text-white/70 hover:bg-white/[0.04] rounded-md transition-all">Clear filters</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {/* Group Toggle */}
                    <button
                      onClick={() => setContentGroupBy(contentGroupBy === "none" ? "type" : contentGroupBy === "type" ? "domain" : "none")}
                      className={`p-1.5 rounded-lg transition-all duration-200 ${contentGroupBy !== "none" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}
                      title={`Group by: ${contentGroupBy}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                      </svg>
                    </button>
                    {/* View Toggle */}
                    <div className="flex items-center bg-white/[0.03] rounded-lg p-0.5 ml-1">
                      <button onClick={() => setContentViewMode("grid")} className={`p-1.5 rounded-md transition-all duration-200 ${contentViewMode === "grid" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}>
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16"><path d="M1 2.5A1.5 1.5 0 012.5 1h3A1.5 1.5 0 017 2.5v3A1.5 1.5 0 015.5 7h-3A1.5 1.5 0 011 5.5v-3zm8 0A1.5 1.5 0 0110.5 1h3A1.5 1.5 0 0115 2.5v3A1.5 1.5 0 0113.5 7h-3A1.5 1.5 0 019 5.5v-3zm-8 8A1.5 1.5 0 012.5 9h3A1.5 1.5 0 017 10.5v3A1.5 1.5 0 015.5 15h-3A1.5 1.5 0 011 13.5v-3zm8 0A1.5 1.5 0 0110.5 9h3a1.5 1.5 0 011.5 1.5v3a1.5 1.5 0 01-1.5 1.5h-3A1.5 1.5 0 019 13.5v-3z"/></svg>
                      </button>
                      <button onClick={() => setContentViewMode("list")} className={`p-1.5 rounded-md transition-all duration-200 ${contentViewMode === "list" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}>
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16"><path fillRule="evenodd" d="M2.5 12a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5zm0-4a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5zm0-4a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5z"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
                {contentViewMode === "grid" ? (
                  <div className="space-y-6">
                    {groupedContent.map((group, groupIndex) => (
                      <div key={group.label || groupIndex}>
                        {group.label && (
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-sm font-medium text-white/50 uppercase tracking-wider">{group.label}</span>
                            <div className="flex-1 h-px bg-gradient-to-r from-white/[0.08] to-transparent" />
                            <span className="text-sm text-white/30">{group.items.length}</span>
                          </div>
                        )}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                          {group.items.map((item) => (
                            <ContentResultCard key={item.contentCid} content={item} getCreatorUsername={getCreatorUsername} viewMode="grid" />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {groupedContent.map((group, groupIndex) => (
                      <div key={group.label || groupIndex}>
                        {group.label && (
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-sm font-medium text-white/50 uppercase tracking-wider">{group.label}</span>
                            <div className="flex-1 h-px bg-gradient-to-r from-white/[0.08] to-transparent" />
                            <span className="text-sm text-white/30">{group.items.length}</span>
                          </div>
                        )}
                        <div className="space-y-1">
                          {group.items.map((item) => (
                            <ContentResultCard key={item.contentCid} content={item} getCreatorUsername={getCreatorUsername} viewMode="list" />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Bundle Results */}
            {(activeTab === "all" || activeTab === "bundles") && searchResults.bundles.length > 0 && (
              <div>
                {/* Section Header with Controls */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-white/40 uppercase tracking-wider">Bundles</span>
                    <span className="text-xs text-white/30">{searchResults.bundles.length}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Sort Dropdown */}
                    <div ref={bundleSortRef} className="relative">
                      <button
                        onClick={() => { setShowBundleSort(!showBundleSort); setShowBundleFilter(false); }}
                        className={`p-1.5 rounded-lg transition-all duration-200 ${showBundleSort ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}
                        title={`Sort by: ${bundleSort}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7h6M3 12h9m-9 5h12M17 3v18m0 0l-3-3m3 3l3-3" />
                        </svg>
                      </button>
                      {showBundleSort && (
                        <div className="absolute right-0 top-full mt-2 w-40 bg-black/95 backdrop-blur-xl border border-white/[0.08] rounded-lg shadow-xl z-50 overflow-hidden">
                          <div className="p-2">
                            <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1.5 px-1">Sort By</p>
                            <div className="flex flex-col gap-1">
                              {[{ value: "recent", label: "Recent" }, { value: "oldest", label: "Oldest" }, { value: "name", label: "Name" }].map((opt) => (
                                <button
                                  key={opt.value}
                                  onClick={() => { setBundleSort(opt.value as SortOption); setShowBundleSort(false); }}
                                  className={`px-2 py-1.5 text-sm font-medium rounded-md transition-all duration-200 text-left ${bundleSort === opt.value ? "bg-white text-black" : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"}`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Filter Dropdown */}
                    <div ref={bundleFilterRef} className="relative">
                      <button
                        onClick={() => { setShowBundleFilter(!showBundleFilter); setShowBundleSort(false); }}
                        className={`p-1.5 rounded-lg transition-all duration-200 ${hasBundleFilters ? "bg-purple-500/20 text-purple-300" : showBundleFilter ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}
                        title="Filter"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                        {hasBundleFilters && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-purple-400 rounded-full" />}
                      </button>
                      {showBundleFilter && (
                        <div className="absolute right-0 top-full mt-2 w-56 bg-black/95 backdrop-blur-xl border border-white/[0.08] rounded-lg shadow-xl z-50 overflow-hidden max-h-[70vh] overflow-y-auto">
                          <div className="p-2 border-b border-white/[0.06]">
                            <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1.5 px-1">Bundle Type</p>
                            <div className="flex flex-wrap gap-1">
                              <button onClick={() => { setBundleTypeFilter("all"); setShowBundleFilter(false); }} className={`px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${bundleTypeFilter === "all" ? "bg-white text-black" : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"}`}>All</button>
                              {ALL_BUNDLE_TYPES.map((type) => (
                                <button key={type} onClick={() => { setBundleTypeFilter(type); setShowBundleFilter(false); }} className={`px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${bundleTypeFilter === type ? "bg-white text-black" : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"}`}>{getBundleTypeLabel(type)}</button>
                              ))}
                            </div>
                          </div>
                          {hasBundleFilters && (
                            <div className="p-2">
                              <button onClick={() => { setBundleTypeFilter("all"); setShowBundleFilter(false); }} className="w-full px-2 py-1.5 text-sm font-medium text-white/50 hover:text-white/70 hover:bg-white/[0.04] rounded-md transition-all">Clear filters</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {/* Group Toggle */}
                    <button
                      onClick={() => setBundleGroupBy(bundleGroupBy === "none" ? "type" : bundleGroupBy === "type" ? "domain" : "none")}
                      className={`p-1.5 rounded-lg transition-all duration-200 ${bundleGroupBy !== "none" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}
                      title={`Group by: ${bundleGroupBy}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                      </svg>
                    </button>
                    {/* View Toggle */}
                    <div className="flex items-center bg-white/[0.03] rounded-lg p-0.5 ml-1">
                      <button onClick={() => setBundleViewMode("grid")} className={`p-1.5 rounded-md transition-all duration-200 ${bundleViewMode === "grid" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}>
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16"><path d="M1 2.5A1.5 1.5 0 012.5 1h3A1.5 1.5 0 017 2.5v3A1.5 1.5 0 015.5 7h-3A1.5 1.5 0 011 5.5v-3zm8 0A1.5 1.5 0 0110.5 1h3A1.5 1.5 0 0115 2.5v3A1.5 1.5 0 0113.5 7h-3A1.5 1.5 0 019 5.5v-3zm-8 8A1.5 1.5 0 012.5 9h3A1.5 1.5 0 017 10.5v3A1.5 1.5 0 015.5 15h-3A1.5 1.5 0 011 13.5v-3zm8 0A1.5 1.5 0 0110.5 9h3a1.5 1.5 0 011.5 1.5v3a1.5 1.5 0 01-1.5 1.5h-3A1.5 1.5 0 019 13.5v-3z"/></svg>
                      </button>
                      <button onClick={() => setBundleViewMode("list")} className={`p-1.5 rounded-md transition-all duration-200 ${bundleViewMode === "list" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}>
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16"><path fillRule="evenodd" d="M2.5 12a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5zm0-4a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5zm0-4a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5z"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
                {bundleViewMode === "grid" ? (
                  <div className="space-y-6">
                    {groupedBundles.map((group, groupIndex) => (
                      <div key={group.label || groupIndex}>
                        {group.label && (
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-sm font-medium text-white/50 uppercase tracking-wider">{group.label}</span>
                            <div className="flex-1 h-px bg-gradient-to-r from-white/[0.08] to-transparent" />
                            <span className="text-sm text-white/30">{group.items.length}</span>
                          </div>
                        )}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                          {group.items.map((bundle) => (
                            <BundleResultCard key={`${bundle.creator}-${bundle.bundleId}`} bundle={bundle} getCreatorUsername={getCreatorUsername} viewMode="grid" />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {groupedBundles.map((group, groupIndex) => (
                      <div key={group.label || groupIndex}>
                        {group.label && (
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-sm font-medium text-white/50 uppercase tracking-wider">{group.label}</span>
                            <div className="flex-1 h-px bg-gradient-to-r from-white/[0.08] to-transparent" />
                            <span className="text-sm text-white/30">{group.items.length}</span>
                          </div>
                        )}
                        <div className="space-y-1">
                          {group.items.map((bundle) => (
                            <BundleResultCard key={`${bundle.creator}-${bundle.bundleId}`} bundle={bundle} getCreatorUsername={getCreatorUsername} viewMode="list" />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Creator Results */}
            {(activeTab === "all" || activeTab === "creators") && searchResults.creators.length > 0 && (
              <div>
                {/* Section Header with Controls */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-white/40 uppercase tracking-wider">Creators</span>
                    <span className="text-xs text-white/30">{searchResults.creators.length}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Sort Dropdown */}
                    <div ref={creatorSortRef} className="relative">
                      <button
                        onClick={() => setShowCreatorSort(!showCreatorSort)}
                        className={`p-1.5 rounded-lg transition-all duration-200 ${showCreatorSort ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}
                        title={`Sort by: ${creatorSort}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7h6M3 12h9m-9 5h12M17 3v18m0 0l-3-3m3 3l3-3" />
                        </svg>
                      </button>
                      {showCreatorSort && (
                        <div className="absolute right-0 top-full mt-2 w-40 bg-black/95 backdrop-blur-xl border border-white/[0.08] rounded-lg shadow-xl z-50 overflow-hidden">
                          <div className="p-2">
                            <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1.5 px-1">Sort By</p>
                            <div className="flex flex-col gap-1">
                              {[{ value: "name", label: "Name" }].map((opt) => (
                                <button
                                  key={opt.value}
                                  onClick={() => { setCreatorSort(opt.value as SortOption); setShowCreatorSort(false); }}
                                  className={`px-2 py-1.5 text-sm font-medium rounded-md transition-all duration-200 text-left ${creatorSort === opt.value ? "bg-white text-black" : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"}`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* View Toggle */}
                    <div className="flex items-center bg-white/[0.03] rounded-lg p-0.5 ml-1">
                      <button onClick={() => setCreatorViewMode("grid")} className={`p-1.5 rounded-md transition-all duration-200 ${creatorViewMode === "grid" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}>
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16"><path d="M1 2.5A1.5 1.5 0 012.5 1h3A1.5 1.5 0 017 2.5v3A1.5 1.5 0 015.5 7h-3A1.5 1.5 0 011 5.5v-3zm8 0A1.5 1.5 0 0110.5 1h3A1.5 1.5 0 0115 2.5v3A1.5 1.5 0 0113.5 7h-3A1.5 1.5 0 019 5.5v-3zm-8 8A1.5 1.5 0 012.5 9h3A1.5 1.5 0 017 10.5v3A1.5 1.5 0 015.5 15h-3A1.5 1.5 0 011 13.5v-3zm8 0A1.5 1.5 0 0110.5 9h3a1.5 1.5 0 011.5 1.5v3a1.5 1.5 0 01-1.5 1.5h-3A1.5 1.5 0 019 13.5v-3z"/></svg>
                      </button>
                      <button onClick={() => setCreatorViewMode("list")} className={`p-1.5 rounded-md transition-all duration-200 ${creatorViewMode === "list" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}>
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16"><path fillRule="evenodd" d="M2.5 12a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5zm0-4a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5zm0-4a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5z"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
                {creatorViewMode === "grid" ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {searchResults.creators.map((creator) => (
                      <CreatorResultCard key={creator} address={creator} getCreatorUsername={getCreatorUsername} viewMode="grid" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {searchResults.creators.map((creator) => (
                      <CreatorResultCard key={creator} address={creator} getCreatorUsername={getCreatorUsername} viewMode="list" />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SearchLoadingFallback() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3">
          <div className="h-10 bg-white/[0.04] rounded-lg animate-pulse" />
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-3 p-3 rounded-lg bg-white/[0.02] animate-pulse">
              <div className="w-12 h-12 bg-white/[0.04] rounded-md" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-white/[0.04] rounded w-3/4" />
                <div className="h-2.5 bg-white/[0.04] rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ContentResultCard({ content, getCreatorUsername, viewMode = "list" }: { content: EnrichedContent; getCreatorUsername: (address: string) => string | null; viewMode?: "grid" | "list" }) {
  const thumbnailUrl = content.metadata?.image || null;
  const creatorUsername = getCreatorUsername(content.creator);
  const displayName = creatorUsername || `${content.creator.slice(0, 4)}...${content.creator.slice(-4)}`;

  if (viewMode === "grid") {
    return (
      <Link
        href={`/content/${content.contentCid}`}
        className="group block rounded-lg bg-white/[0.02] border border-white/[0.06] overflow-hidden hover:border-white/20 transition-all duration-200"
      >
        <div className="aspect-square bg-white/[0.04] overflow-hidden">
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt={content.metadata?.name || "Content"} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-8 h-8 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
          )}
        </div>
        <div className="p-2.5">
          <p className="text-sm font-medium text-white truncate">{content.metadata?.name || "Untitled"}</p>
          <p className="text-xs text-white/40 mt-0.5 truncate">{displayName}</p>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/content/${content.contentCid}`}
      className="group flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-white/[0.03] transition-all duration-200"
    >
      <div className="w-11 h-11 bg-white/[0.04] rounded-md overflow-hidden flex-shrink-0">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt={content.metadata?.name || "Content"} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-5 h-5 text-white/15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-base font-medium text-white truncate group-hover:text-white/90">{content.metadata?.name || "Untitled"}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-white/40">{content.contentType !== undefined ? getContentTypeLabel(content.contentType as ContentType) : "Content"}</span>
          <span className="text-white/20">·</span>
          <span className="text-xs text-white/30">{displayName}</span>
        </div>
      </div>
      <svg className="w-4 h-4 text-white/20 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
    </Link>
  );
}

function BundleResultCard({ bundle, getCreatorUsername, viewMode = "list" }: { bundle: EnrichedBundle; getCreatorUsername: (address: string) => string | null; viewMode?: "grid" | "list" }) {
  const creatorUsername = getCreatorUsername(bundle.creator);
  const displayName = creatorUsername || `${bundle.creator.slice(0, 4)}...${bundle.creator.slice(-4)}`;

  if (viewMode === "grid") {
    return (
      <Link
        href={`/content/${bundle.bundleId}`}
        className="group block rounded-lg bg-white/[0.02] border border-white/[0.06] overflow-hidden hover:border-purple-500/30 transition-all duration-200"
      >
        <div className="aspect-square bg-purple-500/5 flex items-center justify-center">
          <svg className="w-12 h-12 text-purple-400/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
        </div>
        <div className="p-2.5">
          <p className="text-sm font-medium text-white truncate">{bundle.metadata?.name || `Bundle #${bundle.bundleId}`}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs text-purple-400/70">{getBundleTypeLabel(bundle.bundleType)}</span>
            <span className="text-white/20">·</span>
            <span className="text-xs text-white/40">{bundle.itemCount} items</span>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/content/${bundle.bundleId}`}
      className="group flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-white/[0.03] transition-all duration-200"
    >
      <div className="w-11 h-11 rounded-md bg-purple-500/10 flex items-center justify-center flex-shrink-0">
        <svg className="w-5 h-5 text-purple-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-base font-medium text-white truncate group-hover:text-white/90">{bundle.metadata?.name || `Bundle #${bundle.bundleId}`}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-purple-400/70">{getBundleTypeLabel(bundle.bundleType)}</span>
          <span className="text-white/20">·</span>
          <span className="text-xs text-white/30">{bundle.itemCount} items</span>
          <span className="text-white/20">·</span>
          <span className="text-xs text-white/30">{displayName}</span>
        </div>
      </div>
      <svg className="w-4 h-4 text-white/20 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
    </Link>
  );
}

function CreatorResultCard({ address, getCreatorUsername, viewMode = "list" }: { address: string; getCreatorUsername: (address: string) => string | null; viewMode?: "grid" | "list" }) {
  const creatorUsername = getCreatorUsername(address);
  const displayName = creatorUsername || `${address.slice(0, 4)}...${address.slice(-4)}`;
  const avatarInitial = (creatorUsername || address).charAt(0).toUpperCase();

  if (viewMode === "grid") {
    return (
      <Link
        href={`/profile/${address}`}
        className="group block rounded-lg bg-white/[0.02] border border-white/[0.06] overflow-hidden hover:border-white/20 transition-all duration-200 p-4 text-center"
      >
        <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center text-xl font-medium text-white/50">
          {avatarInitial}
        </div>
        <p className="text-sm font-medium text-white mt-3 truncate">{displayName}</p>
        <p className="text-xs text-white/40 mt-0.5">Creator</p>
      </Link>
    );
  }

  return (
    <Link
      href={`/profile/${address}`}
      className="group flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-white/[0.03] transition-all duration-200"
    >
      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center text-sm font-medium text-white/50 flex-shrink-0">
        {avatarInitial}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-base font-medium text-white group-hover:text-white/90">{displayName}</p>
        <p className="text-xs text-white/30">Creator</p>
      </div>
      <svg className="w-4 h-4 text-white/20 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
    </Link>
  );
}

export default function SearchClient() {
  return (
    <Suspense fallback={<SearchLoadingFallback />}>
      <SearchContent />
    </Suspense>
  );
}
