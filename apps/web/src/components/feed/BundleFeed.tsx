"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";
import { useContentRegistry, Bundle, BundleWithItems, Rarity } from "@/hooks/useContentRegistry";
import { getIpfsUrl, getBundleTypeLabel, BundleType, getBundlePda } from "@handcraft/sdk";
import { BuyBundleModal, RentBundleModal } from "@/components/bundle";
import { ContentSlide } from "./Feed";
import { type EnrichedContent } from "./types";

type BundleTypeFilter = "all" | BundleType;
type SortType = "date" | "minted" | "items" | "price" | "random";
type SortDirection = "desc" | "asc";

const SORT_TYPES: { value: SortType; label: string }[] = [
  { value: "date", label: "Date" },
  { value: "minted", label: "Minted" },
  { value: "items", label: "Items" },
  { value: "price", label: "Price" },
  { value: "random", label: "Random" },
];

const ITEMS_PER_PAGE = 20;

const BUNDLE_TYPE_FILTERS: { value: BundleTypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: BundleType.Album, label: "Albums" },
  { value: BundleType.Series, label: "Series" },
  { value: BundleType.Playlist, label: "Playlists" },
  { value: BundleType.Course, label: "Courses" },
  { value: BundleType.Newsletter, label: "Newsletters" },
  { value: BundleType.Collection, label: "Collections" },
  { value: BundleType.ProductPack, label: "Products" },
];

interface BundleMetadata {
  name?: string;
  description?: string;
  image?: string;
  bundleType?: string;
  createdAt?: string;
}

interface EnrichedBundle extends Bundle {
  metadata?: BundleMetadata;
  creatorAddress: string;
}

function getItemHash(seed: number, itemId: string): number {
  let hash = seed;
  for (let i = 0; i < itemId.length; i++) {
    hash = ((hash << 5) - hash + itemId.charCodeAt(i)) | 0;
  }
  return hash;
}

function parseFilter(param: string | null): BundleTypeFilter {
  if (!param || param === "all") return "all";
  const num = Number(param);
  if (!isNaN(num) && Object.values(BundleType).includes(num)) {
    return num as BundleType;
  }
  return "all";
}

function parseSortType(param: string | null): SortType {
  if (param && ["date", "minted", "items", "price", "random"].includes(param)) {
    return param as SortType;
  }
  return "date";
}

function parseSortDir(param: string | null): SortDirection {
  if (param === "asc") return "asc";
  return "desc";
}

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

interface BundleFeedProps {
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export function BundleFeed({ isSidebarOpen = false, onToggleSidebar }: BundleFeedProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const typeFilter = parseFilter(searchParams.get("filter"));
  const sortType = parseSortType(searchParams.get("sort"));
  const sortDir = parseSortDir(searchParams.get("dir"));

  const [showFilters, setShowFilters] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  // Track selected content index for each bundle (bundleId -> contentIndex)
  const [selectedContentIndex, setSelectedContentIndex] = useState<Map<string, number>>(new Map());

  // When left panel is open, left buttons shift inside
  const leftPanelOpen = isSidebarOpen || showFilters;
  // When right panel is open, right button shifts inside
  const rightPanelOpen = showPlaylist;

  // Get/set selected content index for current bundle
  const getCurrentContentIndex = useCallback((bundleId: string) => {
    return selectedContentIndex.get(bundleId) ?? 0;
  }, [selectedContentIndex]);

  const setCurrentContentIndex = useCallback((bundleId: string, index: number) => {
    setSelectedContentIndex(prev => new Map(prev).set(bundleId, index));
  }, []);

  // Bundle items cache (bundleId -> items data)
  const [bundleItemsCache, setBundleItemsCache] = useState<Map<string, { items: BundleWithItems | null; metadata: Map<string, any>; loading: boolean }>>(new Map());

  const [randomSeed] = useState(() => Date.now());
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [currentIndex, setCurrentIndex] = useState(0);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { globalBundles, isLoadingGlobalBundles, client, allBundleMintConfigs } = useContentRegistry();

  const getPrice = useCallback((bundle: Bundle): bigint => {
    if (!allBundleMintConfigs) return BigInt(0);
    const [bundlePda] = getBundlePda(bundle.creator, bundle.bundleId);
    const config = allBundleMintConfigs.get(bundlePda.toBase58());
    return config?.price ?? BigInt(0);
  }, [allBundleMintConfigs]);

  const updateParams = useCallback((updates: { filter?: string; sort?: string; dir?: string }) => {
    const params = new URLSearchParams(searchParams.toString());
    if (updates.filter !== undefined) {
      if (updates.filter === "all") params.delete("filter");
      else params.set("filter", updates.filter);
    }
    if (updates.sort !== undefined) {
      if (updates.sort === "date") params.delete("sort");
      else params.set("sort", updates.sort);
      if (updates.sort === "random") params.delete("dir");
    }
    if (updates.dir !== undefined) {
      if (updates.dir === "desc") params.delete("dir");
      else params.set("dir", updates.dir);
    }
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    router.push(newUrl, { scroll: false });
  }, [searchParams, router]);

  const setTypeFilter = useCallback((filter: BundleTypeFilter) => {
    setVisibleCount(ITEMS_PER_PAGE);
    updateParams({ filter: String(filter) });
  }, [updateParams]);

  const setSortType = useCallback((sort: SortType) => {
    setVisibleCount(ITEMS_PER_PAGE);
    updateParams({ sort });
  }, [updateParams]);

  const toggleSortDir = useCallback(() => {
    setVisibleCount(ITEMS_PER_PAGE);
    updateParams({ dir: sortDir === "desc" ? "asc" : "desc" });
  }, [updateParams, sortDir]);

  const [enrichedBundles, setEnrichedBundles] = useState<EnrichedBundle[]>([]);
  const [isEnriching, setIsEnriching] = useState(false);
  const lastFetchRef = useRef<string>("");

  useEffect(() => {
    const bundleKey = globalBundles.map(b => b.bundleId).join(",");
    if (bundleKey === lastFetchRef.current || !bundleKey) return;
    lastFetchRef.current = bundleKey;

    async function enrichBundles() {
      setIsEnriching(true);
      try {
        const enriched = await Promise.all(
          globalBundles.map(async (bundle) => {
            const creatorAddress = bundle.creator.toBase58();
            try {
              const metadataUrl = getIpfsUrl(bundle.metadataCid);
              const res = await fetch(metadataUrl);
              const metadata = await res.json();
              return { ...bundle, metadata, creatorAddress };
            } catch {
              return { ...bundle, creatorAddress };
            }
          })
        );
        setEnrichedBundles(enriched);
      } catch (err) {
        console.error("Error enriching bundles:", err);
      } finally {
        setIsEnriching(false);
      }
    }
    enrichBundles();
  }, [globalBundles]);

  const isLoading = !client || isLoadingGlobalBundles || isEnriching;

  const { displayBundles, hasMore } = useMemo(() => {
    const filtered = typeFilter === "all"
      ? enrichedBundles
      : enrichedBundles.filter(bundle => bundle.bundleType === typeFilter);

    const sorted = [...filtered].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortType) {
        case "minted": return dir * (Number(a.mintedCount ?? 0) - Number(b.mintedCount ?? 0));
        case "items": return dir * (Number(a.itemCount ?? 0) - Number(b.itemCount ?? 0));
        case "price": return dir * Number(getPrice(a) - getPrice(b));
        case "random": return getItemHash(randomSeed, a.bundleId) - getItemHash(randomSeed, b.bundleId);
        case "date":
        default: return dir * (Number(a.createdAt) - Number(b.createdAt));
      }
    });

    const displayed = sorted.slice(0, visibleCount);
    return { displayBundles: displayed, totalItems: sorted.length, hasMore: visibleCount < sorted.length };
  }, [enrichedBundles, typeFilter, sortType, sortDir, visibleCount, randomSeed, getPrice]);

  // Current bundle and its cache
  const currentBundle = displayBundles[currentIndex];
  const currentBundleKey = currentBundle ? `${currentBundle.creatorAddress}-${currentBundle.bundleId}` : null;
  const currentBundleCache = currentBundleKey ? bundleItemsCache.get(currentBundleKey) : null;

  // Fetch bundle items when current bundle changes
  useEffect(() => {
    if (!client || !currentBundle) return;

    const bundleKey = `${currentBundle.creatorAddress}-${currentBundle.bundleId}`;
    const cached = bundleItemsCache.get(bundleKey);

    // Skip if already loaded or loading
    if (cached?.items || cached?.loading) return;

    // Mark as loading
    setBundleItemsCache(prev => new Map(prev).set(bundleKey, { items: null, metadata: new Map(), loading: true }));

    async function fetchBundleItems() {
      try {
        const bundleWithItems = await client!.fetchBundleWithItems(currentBundle!.creator, currentBundle!.bundleId);

        // Fetch metadata for each item
        const metadataMap = new Map<string, any>();
        if (bundleWithItems?.items) {
          await Promise.all(
            bundleWithItems.items.map(async (item: any) => {
              const content = item.content;
              if (content?.metadataCid) {
                try {
                  const res = await fetch(getIpfsUrl(content.metadataCid));
                  if (res.ok) {
                    const meta = await res.json();
                    metadataMap.set(content.contentCid, meta);
                  }
                } catch {}
              }
            })
          );
        }

        setBundleItemsCache(prev => new Map(prev).set(bundleKey, { items: bundleWithItems, metadata: metadataMap, loading: false }));
      } catch (err) {
        console.error("Error fetching bundle items:", err);
        setBundleItemsCache(prev => new Map(prev).set(bundleKey, { items: null, metadata: new Map(), loading: false }));
      }
    }

    fetchBundleItems();
  }, [client, currentBundle, bundleItemsCache]);

  // Intersection Observer for loading more
  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          setVisibleCount(prev => prev + ITEMS_PER_PAGE);
        }
      },
      { rootMargin: "400px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        setCurrentIndex(prev => Math.min(prev + 1, displayBundles.length - 1));
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        setCurrentIndex(prev => Math.max(prev - 1, 0));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [displayBundles.length]);

  // Scroll snap to current item
  useEffect(() => {
    const container = containerRef.current;
    if (!container || displayBundles.length === 0) return;
    const items = container.querySelectorAll("[data-feed-item]");
    const targetItem = items[currentIndex];
    if (targetItem) targetItem.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [currentIndex, displayBundles.length]);

  // Intersection observer for scroll-based index updates
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            const index = Number(entry.target.getAttribute("data-index"));
            if (!isNaN(index)) setCurrentIndex(index);
          }
        });
      },
      { root: container, threshold: 0.5 }
    );
    const items = container.querySelectorAll("[data-feed-item]");
    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [displayBundles]);

  const containerClass = "h-screen bg-black relative";

  if (isLoading) {
    return (
      <div className={`${containerClass} flex items-center justify-center`}>
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/60 font-light tracking-wide">Loading bundles...</p>
        </div>
      </div>
    );
  }

  if (displayBundles.length === 0) {
    return (
      <div className={`${containerClass} flex items-center justify-center p-8`}>
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto text-white/20 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h3 className="text-white/60 text-lg font-light mb-2">
            {typeFilter !== "all" ? "No bundles match this filter" : "No bundles yet"}
          </h3>
          {typeFilter !== "all" && (
            <button onClick={() => setTypeFilter("all")} className="text-secondary-400 hover:text-secondary-300 text-sm">
              Clear filter
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      {/* Left Navigation Buttons - shift inside when left panel opens */}
      <div className={`fixed z-50 flex flex-col gap-2 transition-all duration-300 ${leftPanelOpen ? "left-[296px]" : "left-4"}`} style={{ top: "1rem" }}>
        {/* Menu Button */}
        {onToggleSidebar && (
          <button
            onClick={() => {
              if (showFilters) setShowFilters(false);
              onToggleSidebar();
            }}
            className="p-3 bg-black/60 backdrop-blur-md rounded-full border border-white/10 hover:border-white/30 transition-all group"
            title="Menu"
          >
            <svg className="w-5 h-5 text-white/70 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}

        {/* Filter Toggle */}
        <button
          onClick={() => {
            if (isSidebarOpen && onToggleSidebar) onToggleSidebar();
            setShowFilters(!showFilters);
          }}
          className="p-3 bg-black/60 backdrop-blur-md rounded-full border border-white/10 hover:border-white/30 transition-all group"
          title="Filter"
        >
          <svg className="w-5 h-5 text-white/70 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
        </button>
      </div>

      {/* Right Playlist Button - shift inside when right panel opens */}
      <div className={`fixed z-50 flex flex-col gap-2 transition-all duration-300 ${rightPanelOpen ? "right-[436px]" : "right-4"}`} style={{ top: "1rem" }}>
        <button
          onClick={() => setShowPlaylist(!showPlaylist)}
          className={`p-3 bg-black/60 backdrop-blur-md rounded-full border transition-all group ${showPlaylist ? "border-white/40 bg-white/10" : "border-white/10 hover:border-white/30"}`}
          title="Playlist"
        >
          <svg className="w-5 h-5 text-white/70 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h10M4 18h10" />
          </svg>
        </button>
      </div>

      {/* Filters Panel */}
      <div className={`absolute top-0 left-0 h-full w-72 bg-black/95 backdrop-blur-xl border-r border-white/10 z-40 transform transition-transform duration-300 ${showFilters ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="p-6 pt-20">
          <h3 className="text-white/40 text-xs uppercase tracking-[0.2em] mb-6">Filters</h3>
          <div className="mb-8">
            <label className="text-white/60 text-sm mb-3 block">Sort by</label>
            <div className="space-y-1">
              {SORT_TYPES.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSortType(option.value)}
                  className={`w-full px-4 py-2.5 text-left text-sm rounded-lg transition-all ${
                    sortType === option.value ? "bg-white text-black font-medium" : "text-white/60 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {sortType !== "random" && (
              <button onClick={toggleSortDir} className="mt-3 flex items-center gap-2 text-white/40 hover:text-white text-sm transition-colors">
                {sortDir === "desc" ? "↓ Descending" : "↑ Ascending"}
              </button>
            )}
          </div>
          <div>
            <label className="text-white/60 text-sm mb-3 block">Bundle Type</label>
            <div className="flex flex-wrap gap-2">
              {BUNDLE_TYPE_FILTERS.map((filter) => (
                <button
                  key={String(filter.value)}
                  onClick={() => setTypeFilter(filter.value)}
                  className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                    typeFilter === filter.value ? "bg-white text-black font-medium" : "bg-white/10 text-white/60 hover:text-white hover:bg-white/20"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Immersive Playlist Panel (Right Side) */}
      <div className={`fixed top-0 right-0 h-full w-[420px] bg-black/98 backdrop-blur-2xl border-l border-white/10 z-40 transform transition-transform duration-300 ${showPlaylist ? "translate-x-0" : "translate-x-full"}`}>
        {currentBundle && (
          <BundleSidebarPanel
            bundle={currentBundle}
            bundleItems={currentBundleCache?.items ?? null}
            itemMetadata={currentBundleCache?.metadata ?? new Map()}
            isLoadingItems={currentBundleCache?.loading ?? true}
            selectedContentIndex={getCurrentContentIndex(currentBundleKey!)}
            onSelectContent={(index) => setCurrentContentIndex(currentBundleKey!, index)}
          />
        )}
      </div>

      {/* Progress Indicator - hide when playlist is open */}
      {!showPlaylist && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1.5">
          {displayBundles.slice(Math.max(0, currentIndex - 3), Math.min(displayBundles.length, currentIndex + 4)).map((_, idx) => {
            const actualIndex = Math.max(0, currentIndex - 3) + idx;
            return (
              <button
                key={actualIndex}
                onClick={() => setCurrentIndex(actualIndex)}
                className={`transition-all duration-300 rounded-full ${actualIndex === currentIndex ? "w-1.5 h-6 bg-white" : "w-1.5 h-1.5 bg-white/30 hover:bg-white/60"}`}
              />
            );
          })}
        </div>
      )}

      {/* Main Feed Container - click to close panels */}
      <div
        ref={containerRef}
        className="h-full overflow-y-auto snap-y snap-mandatory scroll-smooth"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        onClick={() => {
          if (showFilters) setShowFilters(false);
          if (showPlaylist) setShowPlaylist(false);
          if (isSidebarOpen && onToggleSidebar) onToggleSidebar();
        }}
      >
        <style jsx>{`div::-webkit-scrollbar { display: none; }`}</style>
        {displayBundles.map((bundle, index) => {
          const bundleKey = `${bundle.creatorAddress}-${bundle.bundleId}`;
          const cache = bundleItemsCache.get(bundleKey);
          return (
            <BundleSlide
              key={bundleKey}
              bundle={bundle}
              index={index}
              isActive={index === currentIndex}
              contentIndex={getCurrentContentIndex(bundleKey)}
              bundleItems={cache?.items ?? null}
              isLoadingItems={cache?.loading ?? true}
              rightPanelOpen={showPlaylist}
            />
          );
        })}
        <div ref={loadMoreRef} className="h-1" />
      </div>
    </div>
  );
}

// ============== BUNDLE SLIDE (immersive mode) ==============
interface BundleSlideProps {
  bundle: EnrichedBundle;
  index: number;
  isActive: boolean;
  contentIndex: number;
  bundleItems: BundleWithItems | null;
  isLoadingItems: boolean;
  rightPanelOpen?: boolean;
}

function BundleSlide({ bundle, index, isActive, contentIndex, bundleItems, isLoadingItems, rightPanelOpen = false }: BundleSlideProps) {
  const [enrichedContent, setEnrichedContent] = useState<EnrichedContent | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const lastContentIndexRef = useRef<number>(-1);

  // Fetch content at the specified index
  useEffect(() => {
    async function fetchContent() {
      if (!bundleItems?.items || bundleItems.items.length === 0) return;
      if (contentIndex === lastContentIndexRef.current && enrichedContent) return;

      const item = bundleItems.items[contentIndex];
      if (!item) return;

      const content = item.content;
      if (!content) return;

      setIsLoadingContent(true);
      lastContentIndexRef.current = contentIndex;

      try {
        // Fetch metadata
        let metadata: any = undefined;
        if (content.metadataCid) {
          try {
            const res = await fetch(getIpfsUrl(content.metadataCid));
            if (res.ok) {
              metadata = await res.json();
            }
          } catch {}
        }

        // Convert to EnrichedContent format
        const enriched: EnrichedContent = {
          contentCid: content.contentCid,
          creator: content.creator,
          contentType: content.contentType,
          createdAt: content.createdAt,
          metadataCid: content.metadataCid,
          previewCid: content.previewCid,
          encryptionMetaCid: content.encryptionMetaCid,
          isLocked: content.isLocked || false,
          isEncrypted: content.isEncrypted || false,
          visibilityLevel: content.visibilityLevel || 0,
          tipsReceived: content.tipsReceived || BigInt(0),
          mintedCount: content.mintedCount || BigInt(0),
          pendingCount: content.pendingCount || BigInt(0),
          metadata,
          creatorAddress: content.creator.toBase58(),
        };
        setEnrichedContent(enriched);
      } catch (err) {
        console.error("Error fetching content:", err);
      } finally {
        setIsLoadingContent(false);
      }
    }
    fetchContent();
  }, [bundleItems, contentIndex, enrichedContent]);

  // Show loading state
  if (isLoadingItems || isLoadingContent || !enrichedContent) {
    const coverImage = bundle.metadata?.image ? getIpfsUrl(bundle.metadata.image.replace("https://ipfs.io/ipfs/", "")) : null;
    return (
      <div
        data-feed-item
        data-index={index}
        className="h-screen w-full snap-start snap-always relative flex items-center justify-center bg-black"
      >
        {coverImage && (
          <div className="absolute inset-0">
            <img src={coverImage} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20 blur-2xl scale-110" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/50" />
          </div>
        )}
        <div className="relative z-10 text-center">
          <div className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/40 text-sm">Loading content...</p>
        </div>
      </div>
    );
  }

  // Use ContentSlide to display the content with full layout
  return <ContentSlide content={enrichedContent} index={index} isActive={isActive} rightPanelOpen={rightPanelOpen} />;
}

// ============== PLAYLIST PANEL ==============
interface PlaylistPanelProps {
  bundle: EnrichedBundle;
  bundleItems: BundleWithItems | null;
  itemMetadata: Map<string, any>;
  isLoading: boolean;
  selectedIndex: number;
  onSelectItem: (index: number) => void;
}

function PlaylistPanel({ bundle, bundleItems, itemMetadata, isLoading, selectedIndex, onSelectItem }: PlaylistPanelProps) {
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="relative">
          <div className="w-8 h-8 border border-white/20 rounded-full" />
          <div className="absolute inset-0 w-8 h-8 border border-transparent border-t-white/60 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!bundleItems?.items || bundleItems.items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        </div>
        <p className="text-white/30 text-sm tracking-wide">No tracks yet</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-2 pr-1" style={{ scrollbarWidth: "none" }}>
      <style jsx>{`div::-webkit-scrollbar { display: none; }`}</style>
      {bundleItems.items.map((item: any, index: number) => {
        const content = item.content;
        const meta = itemMetadata.get(content?.contentCid);
        const title = meta?.title || meta?.name || `Track ${index + 1}`;
        const thumbnailUrl = content?.previewCid ? getIpfsUrl(content.previewCid) : null;
        const isSelected = index === selectedIndex;

        return (
          <div
            key={item.contentCid || index}
            onClick={() => onSelectItem(index)}
            className={`group relative flex items-center gap-3 p-3 rounded-xl transition-all duration-300 cursor-pointer ${
              isSelected
                ? "bg-white/10 backdrop-blur-sm"
                : "hover:bg-white/5"
            }`}
          >
            {/* Selection indicator line */}
            <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-8 rounded-full transition-all duration-300 ${
              isSelected ? "bg-white" : "bg-transparent group-hover:bg-white/20"
            }`} />

            {/* Track number / Playing indicator */}
            <div className={`w-5 text-center flex-shrink-0 transition-all duration-300 ${
              isSelected ? "text-white" : "text-white/25 group-hover:text-white/40"
            }`}>
              {isSelected ? (
                <div className="flex items-center justify-center gap-0.5">
                  <span className="w-0.5 h-3 bg-white rounded-full animate-pulse" style={{ animationDelay: "0ms" }} />
                  <span className="w-0.5 h-4 bg-white rounded-full animate-pulse" style={{ animationDelay: "150ms" }} />
                  <span className="w-0.5 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: "300ms" }} />
                </div>
              ) : (
                <span className="text-[11px] font-light">{String(index + 1).padStart(2, '0')}</span>
              )}
            </div>

            {/* Thumbnail */}
            <div className={`w-11 h-11 rounded-lg flex-shrink-0 overflow-hidden transition-all duration-300 ${
              isSelected ? "ring-1 ring-white/30" : ""
            }`}>
              {thumbnailUrl ? (
                <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-white/5 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white/15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className={`text-[13px] font-medium truncate transition-colors duration-300 ${
                isSelected ? "text-white" : "text-white/70 group-hover:text-white/90"
              }`}>{title}</p>
              {meta?.artist && (
                <p className="text-white/30 text-[11px] truncate mt-0.5">{meta.artist}</p>
              )}
            </div>

            {/* Duration placeholder or play icon on hover */}
            <div className={`flex-shrink-0 transition-all duration-300 ${
              isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}>
              <svg className="w-4 h-4 text-white/40" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============== BUNDLE SIDEBAR PANEL ==============
interface BundleSidebarPanelProps {
  bundle: EnrichedBundle;
  bundleItems: BundleWithItems | null;
  itemMetadata: Map<string, any>;
  isLoadingItems: boolean;
  selectedContentIndex: number;
  onSelectContent: (index: number) => void;
}

function BundleSidebarPanel({ bundle, bundleItems, itemMetadata, isLoadingItems, selectedContentIndex, onSelectContent }: BundleSidebarPanelProps) {
  const { publicKey } = useWallet();
  const { useBundleMintConfig, useBundleRentConfig, walletBundleNfts, bundleNftRarities } = useContentRegistry();
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showRentModal, setShowRentModal] = useState(false);

  const { data: mintConfig, refetch: refetchMintConfig } = useBundleMintConfig(bundle.creator, bundle.bundleId);
  const { data: rentConfig } = useBundleRentConfig(bundle.creator, bundle.bundleId);

  const isCreator = publicKey?.toBase58() === bundle.creatorAddress;
  const hasMintConfig = mintConfig && mintConfig.isActive;
  const hasRentConfig = rentConfig && rentConfig.isActive;
  const mintedCount = Number(bundle.mintedCount ?? 0);

  const ownedNftsForBundle = walletBundleNfts.filter(nft =>
    nft.bundleId === bundle.bundleId && nft.creator?.toBase58() === bundle.creatorAddress
  );
  const ownedNftCount = ownedNftsForBundle.length;
  const ownedRarities: Rarity[] = ownedNftsForBundle
    .map(nft => bundleNftRarities.get(nft.nftAsset.toBase58()))
    .filter((r): r is Rarity => r !== undefined);

  const rarityGlow: Record<Rarity, string> = {
    [Rarity.Common]: "from-gray-400/20 to-gray-500/10",
    [Rarity.Uncommon]: "from-emerald-400/20 to-emerald-500/10",
    [Rarity.Rare]: "from-blue-400/20 to-blue-500/10",
    [Rarity.Epic]: "from-violet-400/20 to-violet-500/10",
    [Rarity.Legendary]: "from-amber-400/20 to-amber-500/10",
  };

  const rarityText: Record<Rarity, string> = {
    [Rarity.Common]: "text-gray-300",
    [Rarity.Uncommon]: "text-emerald-400",
    [Rarity.Rare]: "text-blue-400",
    [Rarity.Epic]: "text-violet-400",
    [Rarity.Legendary]: "text-amber-400",
  };

  return (
    <div className="h-full flex flex-col">
      {/* Cinematic Hero Section */}
      <div className="relative flex-shrink-0 overflow-hidden">
        {/* Background atmosphere */}
        {bundle.metadata?.image && (
          <div className="absolute inset-0">
            <img
              src={getIpfsUrl(bundle.metadata.image.replace("https://ipfs.io/ipfs/", ""))}
              alt=""
              className="w-full h-full object-cover blur-3xl scale-150 opacity-40"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black" />
          </div>
        )}

        <div className="relative p-6 pt-16">
          {/* Album art + info */}
          <div className="flex gap-5">
            {/* Cover with glow */}
            <div className="relative flex-shrink-0">
              {bundle.metadata?.image ? (
                <>
                  <div className="absolute -inset-1 bg-white/10 rounded-2xl blur-xl opacity-50" />
                  <img
                    src={getIpfsUrl(bundle.metadata.image.replace("https://ipfs.io/ipfs/", ""))}
                    alt=""
                    className="relative w-28 h-28 object-cover rounded-xl shadow-2xl"
                  />
                </>
              ) : (
                <div className="w-28 h-28 bg-white/5 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/10">
                  <svg className="w-12 h-12 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 pt-1">
              {/* Type badge */}
              <span className="inline-block px-2.5 py-1 rounded-full text-[10px] uppercase tracking-[0.15em] bg-white/5 backdrop-blur-sm text-white/50 border border-white/10 mb-2">
                {getBundleTypeLabel(bundle.bundleType)}
              </span>
              {/* Title */}
              <h2 className="text-white font-semibold text-xl mb-2 line-clamp-2 leading-snug tracking-tight">
                {bundle.metadata?.name || bundle.bundleId}
              </h2>
              {/* Creator */}
              <Link
                href={`/profile/${bundle.creatorAddress}`}
                className="inline-flex items-center gap-1.5 text-white/40 text-sm hover:text-white/60 transition-colors"
              >
                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-white/20 to-white/5" />
                <span>{bundle.creatorAddress.slice(0, 6)}...{bundle.creatorAddress.slice(-4)}</span>
              </Link>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-5 mt-5">
            <div className="flex items-center gap-1.5 text-white/40">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
              </svg>
              <span className="text-white/70 text-sm font-medium">{bundle.itemCount}</span>
              <span className="text-xs">tracks</span>
            </div>
            {mintedCount > 0 && (
              <div className="flex items-center gap-1.5 text-white/40">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2" />
                </svg>
                <span className="text-white/70 text-sm font-medium">{mintedCount}</span>
                <span className="text-xs">minted</span>
              </div>
            )}
            {!isCreator && ownedNftCount > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-white/40 text-xs">Owned</span>
                {Object.entries(ownedRarities.reduce((acc, r) => { acc[r] = (acc[r] || 0) + 1; return acc; }, {} as Record<Rarity, number>))
                  .map(([rarity, count]) => (
                    <span
                      key={rarity}
                      className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-semibold bg-gradient-to-br ${rarityGlow[Number(rarity) as Rarity]} ${rarityText[Number(rarity) as Rarity]} border border-white/10`}
                    >
                      {count}
                    </span>
                  ))}
              </div>
            )}
          </div>

          {/* Description */}
          {bundle.metadata?.description && (
            <p className="text-white/30 text-sm mt-4 line-clamp-2 leading-relaxed">{bundle.metadata.description}</p>
          )}

          {/* Glassmorphic Action Buttons */}
          <div className="flex items-center gap-3 mt-6">
            {!isCreator && hasMintConfig && mintConfig && (
              <button
                onClick={() => setShowBuyModal(true)}
                className="group flex-1 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-white/5 rounded-xl" />
                <div className="relative flex items-center justify-center gap-2 px-5 py-3 backdrop-blur-sm rounded-xl border border-white/20 hover:border-white/40 transition-all duration-300">
                  <svg className="w-4 h-4 text-white/70 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span className="text-white/90 text-sm font-medium">
                    Collect · {(Number(mintConfig.price) / LAMPORTS_PER_SOL).toFixed(2)} SOL
                  </span>
                </div>
              </button>
            )}
            {!isCreator && hasRentConfig && (
              <button
                onClick={() => setShowRentModal(true)}
                className="group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-amber-600/5 rounded-xl" />
                <div className="relative flex items-center justify-center gap-2 px-5 py-3 backdrop-blur-sm rounded-xl border border-amber-500/30 hover:border-amber-400/50 transition-all duration-300">
                  <svg className="w-4 h-4 text-amber-400/70 group-hover:text-amber-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-amber-400/90 text-sm font-medium">Rent</span>
                </div>
              </button>
            )}
            <Link href={`/bundle/${bundle.creatorAddress}/${bundle.bundleId}`}>
              <button className="group p-3 bg-white/5 hover:bg-white/10 backdrop-blur-sm rounded-xl border border-white/10 hover:border-white/20 transition-all duration-300">
                <svg className="w-4 h-4 text-white/50 group-hover:text-white/80 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Tracklist Section */}
      <div className="flex-1 flex flex-col min-h-0 px-6 pb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white/30 text-[11px] uppercase tracking-[0.2em] font-medium">Tracklist</h3>
          <span className="text-white/20 text-[11px]">{bundleItems?.items?.length || 0} tracks</span>
        </div>
        <PlaylistPanel
          bundle={bundle}
          bundleItems={bundleItems}
          itemMetadata={itemMetadata}
          isLoading={isLoadingItems}
          selectedIndex={selectedContentIndex}
          onSelectItem={onSelectContent}
        />
      </div>

      {/* Modals */}
      {showBuyModal && mintConfig && (
        <BuyBundleModal
          isOpen={showBuyModal}
          onClose={() => setShowBuyModal(false)}
          bundleId={bundle.bundleId}
          bundleName={bundle.metadata?.name}
          creator={bundle.creator}
          mintConfig={mintConfig}
          mintedCount={BigInt(mintedCount)}
          pendingCount={bundle.pendingCount}
          ownedCount={ownedNftCount}
          onSuccess={() => refetchMintConfig()}
        />
      )}

      {showRentModal && rentConfig && (
        <RentBundleModal
          isOpen={showRentModal}
          onClose={() => setShowRentModal(false)}
          bundleId={bundle.bundleId}
          bundleName={bundle.metadata?.name}
          creator={bundle.creator}
          rentConfig={rentConfig}
          onSuccess={() => {}}
          onBuyClick={hasMintConfig ? () => setShowBuyModal(true) : undefined}
        />
      )}
    </div>
  );
}
