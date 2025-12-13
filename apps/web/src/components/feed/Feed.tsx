"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useContentRegistry } from "@/hooks/useContentRegistry";
import { useSession } from "@/hooks/useSession";
import { getIpfsUrl, getContentDomain, getDomainLabel, getContentTypeLabel as getSDKContentTypeLabel, ContentType as SDKContentType, getContentPda } from "@handcraft/sdk";
import { BuyContentModal, SellNftModal } from "@/components/mint";
import { EditContentModal, DeleteContentModal } from "@/components/content";
import { RentContentModal } from "@/components/rent";
import { RarityBadge } from "@/components/rarity";
import { Rarity } from "@handcraft/sdk";
import { type EnrichedContent } from "./types";
import { getCachedDecryptedUrl, setCachedDecryptedUrl } from "./cache";
import { getContentTypeLabel, getTimeAgo, formatDuration } from "./helpers";
import { EmptyState, LockedOverlay, NeedsSessionOverlay } from "./Overlays";

type ContentTypeFilter = "all" | SDKContentType;
type SortType = "date" | "minted" | "price" | "random";
type SortDirection = "desc" | "asc";

const SORT_TYPES: { value: SortType; label: string }[] = [
  { value: "date", label: "Date" },
  { value: "minted", label: "Minted" },
  { value: "price", label: "Price" },
  { value: "random", label: "Random" },
];

const ITEMS_PER_PAGE = 20;

const CONTENT_TYPE_FILTERS: { value: ContentTypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: SDKContentType.Video, label: "Video" },
  { value: SDKContentType.Movie, label: "Movie" },
  { value: SDKContentType.Television, label: "TV" },
  { value: SDKContentType.MusicVideo, label: "MV" },
  { value: SDKContentType.Short, label: "Short" },
  { value: SDKContentType.Music, label: "Music" },
  { value: SDKContentType.Podcast, label: "Podcast" },
  { value: SDKContentType.Audiobook, label: "Audiobook" },
  { value: SDKContentType.Photo, label: "Photo" },
  { value: SDKContentType.Artwork, label: "Art" },
  { value: SDKContentType.Book, label: "Book" },
  { value: SDKContentType.Comic, label: "Comic" },
  { value: SDKContentType.Asset, label: "Asset" },
  { value: SDKContentType.Game, label: "Game" },
  { value: SDKContentType.Software, label: "Software" },
  { value: SDKContentType.Dataset, label: "Dataset" },
  { value: SDKContentType.Post, label: "Post" },
];

function getItemHash(seed: number, itemId: string): number {
  let hash = seed;
  for (let i = 0; i < itemId.length; i++) {
    hash = ((hash << 5) - hash + itemId.charCodeAt(i)) | 0;
  }
  return hash;
}

function parseFilter(param: string | null): ContentTypeFilter {
  if (!param || param === "all") return "all";
  const num = Number(param);
  if (!isNaN(num) && Object.values(SDKContentType).includes(num)) {
    return num as SDKContentType;
  }
  return "all";
}

function parseSortType(param: string | null): SortType {
  if (param && ["date", "minted", "price", "random"].includes(param)) {
    return param as SortType;
  }
  return "date";
}

function parseSortDir(param: string | null): SortDirection {
  if (param === "asc") return "asc";
  return "desc";
}

interface FeedProps {
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export function Feed({ isSidebarOpen = false, onToggleSidebar }: FeedProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const typeFilter = parseFilter(searchParams.get("filter"));
  const sortType = parseSortType(searchParams.get("sort"));
  const sortDir = parseSortDir(searchParams.get("dir"));

  const [showFilters, setShowFilters] = useState(false);

  // When either panel is open, buttons shift inside
  const panelOpen = isSidebarOpen || showFilters;
  const [randomSeed] = useState(() => Date.now());
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [currentIndex, setCurrentIndex] = useState(0);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { globalContent: rawGlobalContent, isLoadingGlobalContent, allMintConfigs, client } = useContentRegistry();

  const updateParams = useCallback((updates: { filter?: string; sort?: string; dir?: string }) => {
    const params = new URLSearchParams(searchParams.toString());

    if (updates.filter !== undefined) {
      if (updates.filter === "all") {
        params.delete("filter");
      } else {
        params.set("filter", updates.filter);
      }
    }

    if (updates.sort !== undefined) {
      if (updates.sort === "date") {
        params.delete("sort");
      } else {
        params.set("sort", updates.sort);
      }
      if (updates.sort === "random") {
        params.delete("dir");
      }
    }

    if (updates.dir !== undefined) {
      if (updates.dir === "desc") {
        params.delete("dir");
      } else {
        params.set("dir", updates.dir);
      }
    }

    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    router.push(newUrl, { scroll: false });
  }, [searchParams, router]);

  const setTypeFilter = useCallback((filter: ContentTypeFilter) => {
    setVisibleCount(ITEMS_PER_PAGE);
    setCurrentIndex(0);
    updateParams({ filter: String(filter) });
  }, [updateParams]);

  const setSortType = useCallback((sort: SortType) => {
    setVisibleCount(ITEMS_PER_PAGE);
    setCurrentIndex(0);
    updateParams({ sort });
  }, [updateParams]);

  const toggleSortDir = useCallback(() => {
    setVisibleCount(ITEMS_PER_PAGE);
    setCurrentIndex(0);
    updateParams({ dir: sortDir === "desc" ? "asc" : "desc" });
  }, [updateParams, sortDir]);

  const [globalContent, setGlobalContent] = useState<EnrichedContent[]>([]);
  const [isEnrichingGlobal, setIsEnrichingGlobal] = useState(false);
  const lastGlobalFetchRef = useRef<string>("");

  useEffect(() => {
    const contentKey = rawGlobalContent.map(c => c.contentCid).join(",");
    if (contentKey === lastGlobalFetchRef.current || !contentKey) return;
    lastGlobalFetchRef.current = contentKey;

    async function enrichGlobalFeed() {
      setIsEnrichingGlobal(true);
      try {
        const enriched = await Promise.all(
          rawGlobalContent.map(async (item) => {
            const creatorAddress = item.creator.toBase58();
            try {
              const metadataUrl = getIpfsUrl(item.metadataCid);
              const res = await fetch(metadataUrl);
              const metadata = await res.json();
              return { ...item, metadata, creatorAddress };
            } catch {
              return { ...item, creatorAddress };
            }
          })
        );
        setGlobalContent(enriched);
      } catch (err) {
        console.error("Error enriching global feed:", err);
      } finally {
        setIsEnrichingGlobal(false);
      }
    }

    enrichGlobalFeed();
  }, [rawGlobalContent]);

  const isLoading = !client || isLoadingGlobalContent || isEnrichingGlobal;
  const baseContent = globalContent;

  const getPrice = useCallback((contentCid: string): bigint => {
    if (!allMintConfigs) return BigInt(0);
    const [contentPda] = getContentPda(contentCid);
    const config = allMintConfigs.get(contentPda.toBase58());
    return config?.priceSol ?? BigInt(0);
  }, [allMintConfigs]);

  const { displayContent, totalItems, hasMore } = useMemo(() => {
    const filtered = typeFilter === "all"
      ? baseContent
      : baseContent.filter(item => item.contentType === typeFilter);

    const sorted = [...filtered].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortType) {
        case "minted":
          return dir * (Number(a.mintedCount ?? 0) - Number(b.mintedCount ?? 0));
        case "price": {
          const priceA = getPrice(a.contentCid);
          const priceB = getPrice(b.contentCid);
          return dir * Number(priceA - priceB);
        }
        case "random":
          return getItemHash(randomSeed, a.contentCid) - getItemHash(randomSeed, b.contentCid);
        case "date":
        default:
          return dir * (Number(a.createdAt) - Number(b.createdAt));
      }
    });

    const totalItems = sorted.length;
    const displayed = sorted.slice(0, visibleCount);
    const hasMore = visibleCount < totalItems;

    return { displayContent: displayed, totalItems, hasMore };
  }, [baseContent, typeFilter, sortType, sortDir, visibleCount, randomSeed, getPrice]);

  // Intersection Observer for loading more content
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
        setCurrentIndex(prev => Math.min(prev + 1, displayContent.length - 1));
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        setCurrentIndex(prev => Math.max(prev - 1, 0));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [displayContent.length]);

  // Scroll snap to current item when navigating via keyboard
  useEffect(() => {
    const container = containerRef.current;
    if (!container || displayContent.length === 0) return;

    const items = container.querySelectorAll("[data-feed-item]");
    const targetItem = items[currentIndex];
    if (targetItem) {
      targetItem.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [currentIndex, displayContent.length]);

  // Intersection observer for scroll-based index updates
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            const index = Number(entry.target.getAttribute("data-index"));
            if (!isNaN(index)) {
              setCurrentIndex(index);
            }
          }
        });
      },
      { root: container, threshold: 0.5 }
    );

    const items = container.querySelectorAll("[data-feed-item]");
    items.forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, [displayContent]);

  // Full screen immersive container
  const containerClass = "h-screen bg-black relative";

  if (isLoading) {
    return (
      <div className={`${containerClass} flex items-center justify-center`}>
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/60 font-light tracking-wide">Loading feed...</p>
        </div>
      </div>
    );
  }

  if (displayContent.length === 0) {
    return (
      <div className={`${containerClass} flex items-center justify-center p-8`}>
        <EmptyState
          showExplore={true}
          hasFilter={typeFilter !== "all"}
          onClearFilter={() => setTypeFilter("all")}
        />
      </div>
    );
  }

  return (
    <div className={containerClass}>
      {/* Navigation Buttons - shift inside when panel opens */}
      <div className={`fixed z-50 flex flex-col gap-2 transition-all duration-300 ${panelOpen ? "left-[296px]" : "left-4"}`} style={{ top: "1rem" }}>
        {/* Menu Button */}
        {onToggleSidebar && (
          <button
            onClick={() => {
              if (showFilters) setShowFilters(false); // Close filter when opening sidebar
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
            if (isSidebarOpen && onToggleSidebar) onToggleSidebar(); // Close sidebar when opening filter
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
            <label className="text-white/60 text-sm mb-3 block">Content Type</label>
            <div className="flex flex-wrap gap-2">
              {CONTENT_TYPE_FILTERS.map((filter) => (
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

      {showFilters && <div className="absolute inset-0 bg-black/50 z-30" onClick={() => setShowFilters(false)} />}

      {/* Progress Indicator */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-1.5">
        {displayContent.slice(Math.max(0, currentIndex - 3), Math.min(displayContent.length, currentIndex + 4)).map((_, idx) => {
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

      {/* Main Feed Container */}
      <div ref={containerRef} className="h-full overflow-y-auto snap-y snap-mandatory scroll-smooth" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
        <style jsx>{`div::-webkit-scrollbar { display: none; }`}</style>
        {displayContent.map((item, index) => (
          <ContentSlide key={item.contentCid} content={item} index={index} isActive={index === currentIndex} />
        ))}
        {/* Load more sentinel */}
        <div ref={loadMoreRef} className="h-1" />
      </div>
    </div>
  );
}

// ============== CONTENT SLIDE (immersive mode) ==============
export function ContentSlide({ content, index, isActive }: { content: EnrichedContent; index: number; isActive: boolean }) {
  const [showOverlay, setShowOverlay] = useState(true);
  const [showBuyContentModal, setShowBuyContentModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRentModal, setShowRentModal] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [decryptedUrl, setDecryptedUrl] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const { publicKey } = useWallet();
  const { token: sessionToken, createSession, isCreating: isCreatingSession } = useSession();
  const { useMintConfig, useRentConfig, useNftOwnership, useActiveRental, walletNfts, nftRarities, getBundlesForContent, walletBundleNfts } = useContentRegistry();

  const { data: mintConfig, refetch: refetchMintConfig } = useMintConfig(content.contentCid);
  const { data: rentConfig, refetch: refetchRentConfig } = useRentConfig(content.contentCid);
  const { data: ownedNftCount = 0, refetch: refetchOwnership } = useNftOwnership(content.contentCid);
  const { data: activeRental, refetch: refetchActiveRental } = useActiveRental(content.contentCid);

  const ownsNft = ownedNftCount > 0;
  const ownedNftsForContent = walletNfts.filter(nft => nft.contentCid === content.contentCid);
  const ownedRarities: Rarity[] = ownedNftsForContent.map(nft => nftRarities.get(nft.nftAsset.toBase58())).filter((r): r is Rarity => r !== undefined);

  const isEncrypted = content.isEncrypted === true;
  const previewUrl = content.previewCid ? getIpfsUrl(content.previewCid) : null;
  const fullContentUrl = getIpfsUrl(content.contentCid);
  const contentTypeLabel = getContentTypeLabel(content.contentType);
  const contentDomain = getContentDomain(content.contentType);
  const domainLabel = getDomainLabel(contentDomain);
  const timeAgo = getTimeAgo(Number(content.createdAt) * 1000);

  const contextData = content.metadata?.context || {};
  const genre = contextData.genre || content.metadata?.genre;
  const artist = contextData.artist || content.metadata?.artist;
  const album = contextData.album || content.metadata?.album;
  const duration = contextData.duration;

  const contentBundles = getBundlesForContent(content.contentCid);
  const ownsNftFromBundle = contentBundles.length > 0 && walletBundleNfts.some(nft => nft.bundleId && nft.creator && contentBundles.some(bundle => bundle.bundleId === nft.bundleId && bundle.creator.toBase58() === nft.creator?.toBase58()));

  const shortAddress = content.creatorAddress ? `${content.creatorAddress.slice(0, 4)}...${content.creatorAddress.slice(-4)}` : "Unknown";
  const isCreator = publicKey?.toBase58() === content.creatorAddress;
  const hasMintConfig = mintConfig && mintConfig.isActive;
  const hasRentConfig = rentConfig && rentConfig.isActive;

  const mintPrice = hasMintConfig ? mintConfig.priceSol : undefined;
  const lowestRentPrice = hasRentConfig ? Math.min(Number(rentConfig.rentFee6h ?? Infinity), Number(rentConfig.rentFee1d ?? Infinity), Number(rentConfig.rentFee7d ?? Infinity)) : undefined;

  const actualMintedCount = Number(content.mintedCount ?? 0);
  const isLocked = content.isLocked || actualMintedCount > 0;
  const canEdit = isCreator && !isLocked;
  const canDelete = isCreator && !isLocked;

  const contentUrl = !isEncrypted ? fullContentUrl : decryptedUrl || previewUrl || null;
  const showLockedOverlay = isEncrypted && !isCreator && hasAccess !== true && !ownsNft && !ownsNftFromBundle;
  const needsSession = isEncrypted && (isCreator || ownsNft || ownsNftFromBundle) && !decryptedUrl && !sessionToken;
  const showPlaceholder = isEncrypted && !contentUrl;

  const requestDecryptedContent = useCallback(async () => {
    if (!publicKey || !content.encryptionMetaCid || isDecrypting || !sessionToken) return;
    const walletAddress = publicKey.toBase58();
    const cachedContent = getCachedDecryptedUrl(walletAddress, content.contentCid, sessionToken);
    if (cachedContent) { setDecryptedUrl(cachedContent); setHasAccess(true); return; }
    setIsDecrypting(true);
    try {
      const params = new URLSearchParams({ contentCid: content.contentCid, metaCid: content.encryptionMetaCid, sessionToken });
      const response = await fetch(`/api/content?${params}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setDecryptedUrl(url);
        setCachedDecryptedUrl(walletAddress, content.contentCid, url, sessionToken);
        setHasAccess(true);
      } else { setHasAccess(false); }
    } catch { setHasAccess(false); } finally { setIsDecrypting(false); }
  }, [publicKey, content.contentCid, content.encryptionMetaCid, isDecrypting, sessionToken]);

  useEffect(() => {
    if (!isEncrypted) { setHasAccess(true); return; }
    if (!publicKey) { setHasAccess(false); return; }
    if (!sessionToken) { if (decryptedUrl) { setDecryptedUrl(null); setHasAccess(null); } return; }
    const cached = getCachedDecryptedUrl(publicKey.toBase58(), content.contentCid, sessionToken);
    if (cached) { setDecryptedUrl(cached); setHasAccess(true); return; }
    if ((isCreator || ownsNft || ownsNftFromBundle) && !decryptedUrl && !isDecrypting) { requestDecryptedContent(); }
  }, [isEncrypted, publicKey, isCreator, ownsNft, ownsNftFromBundle, decryptedUrl, isDecrypting, content.contentCid, requestDecryptedContent, sessionToken]);

  const handleContentClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, a, video, audio")) return;
    setShowOverlay(prev => !prev);
  }, []);

  const rarityColors: Record<Rarity, string> = {
    [Rarity.Common]: "bg-gray-500/40 text-gray-200",
    [Rarity.Uncommon]: "bg-green-500/40 text-green-300",
    [Rarity.Rare]: "bg-blue-500/40 text-blue-300",
    [Rarity.Epic]: "bg-purple-500/40 text-purple-300",
    [Rarity.Legendary]: "bg-yellow-500/40 text-yellow-300",
  };

  return (
    <div data-feed-item data-index={index} className="h-screen w-full snap-start snap-always relative flex items-center justify-center bg-black" onClick={handleContentClick}>
      <div className="absolute inset-0 flex items-center justify-center">
        {contentDomain === "video" && (
          showPlaceholder ? (
            <div className="w-full h-full flex items-center justify-center"><svg className="w-24 h-24 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg></div>
          ) : (
            <video src={contentUrl!} className={`max-w-full max-h-full object-contain ${showLockedOverlay || needsSession ? "blur-xl scale-105" : ""} transition-all duration-500`} controls={!showLockedOverlay && !needsSession && showOverlay} preload="metadata" autoPlay={isActive} loop muted />
          )
        )}
        {contentDomain === "audio" && (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/5 to-transparent">
            <div className={`text-center ${showLockedOverlay || needsSession ? "blur-xl" : ""} transition-all duration-500`}>
              <div className="w-32 h-32 mx-auto mb-8 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm"><svg className="w-16 h-16 text-white/60" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" /></svg></div>
              {!showLockedOverlay && !needsSession && !showPlaceholder && contentUrl && showOverlay && <audio src={contentUrl} controls className="w-80" autoPlay={isActive} />}
            </div>
          </div>
        )}
        {contentDomain === "image" && (
          showPlaceholder ? (
            <div className="w-full h-full flex items-center justify-center"><svg className="w-24 h-24 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>
          ) : (
            <img src={contentUrl!} alt={content.metadata?.title || "Content"} className={`max-w-full max-h-full object-contain ${showLockedOverlay || needsSession ? "blur-xl scale-105" : ""} transition-all duration-500`} />
          )
        )}
        {(contentDomain === "document" || contentDomain === "text" || contentDomain === "file") && (
          <div className="w-full h-full flex items-center justify-center">
            <div className={`text-center ${showLockedOverlay || needsSession ? "blur-xl" : ""} transition-all duration-500`}>
              <svg className="w-24 h-24 mx-auto text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            </div>
          </div>
        )}

        {showLockedOverlay && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="text-center p-8 max-w-md">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-white/10 flex items-center justify-center"><svg className="w-8 h-8 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg></div>
              <p className="text-white/60 text-sm mb-6">This content requires ownership</p>
              <div className="flex justify-center gap-3">
                {hasMintConfig && <button onClick={(e) => { e.stopPropagation(); setShowBuyContentModal(true); }} className="px-6 py-2.5 bg-white text-black rounded-full text-sm font-medium hover:bg-white/90 transition-colors">Buy {mintPrice && `· ${Number(mintPrice) / 1e9} SOL`}</button>}
                {hasRentConfig && <button onClick={(e) => { e.stopPropagation(); setShowRentModal(true); }} className="px-6 py-2.5 bg-white/10 text-white rounded-full text-sm font-medium hover:bg-white/20 transition-colors border border-white/20">Rent {lowestRentPrice && `· ${lowestRentPrice / 1e9} SOL`}</button>}
              </div>
            </div>
          </div>
        )}

        {needsSession && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="text-center p-8">
              <p className="text-white/60 text-sm mb-4">Sign in to decrypt content</p>
              <button onClick={(e) => { e.stopPropagation(); createSession(); }} disabled={isCreatingSession} className="px-6 py-2.5 bg-white text-black rounded-full text-sm font-medium hover:bg-white/90 transition-colors disabled:opacity-50">{isCreatingSession ? "Signing..." : "Sign Message"}</button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Overlay */}
      <div className={`absolute bottom-0 left-0 right-0 p-6 pb-20 bg-gradient-to-t from-black via-black/80 to-transparent transition-all duration-500 ${showOverlay ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-white/20 to-white/5 flex items-center justify-center text-white font-medium border border-white/10">{content.creatorAddress?.charAt(0).toUpperCase() || "?"}</div>
          <div><p className="text-white font-medium">{shortAddress}</p><p className="text-white/40 text-xs">{timeAgo}</p></div>
        </div>
        <h2 className="text-white text-xl font-medium mb-2 line-clamp-2">{content.metadata?.title || content.metadata?.name || `Content ${content.contentCid.slice(0, 12)}...`}</h2>
        {(artist || album) && <p className="text-white/50 text-sm mb-2">{artist}{artist && album && " · "}{album}</p>}
        {content.metadata?.description && <p className="text-white/40 text-sm line-clamp-2 mb-4">{content.metadata.description}</p>}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="px-2.5 py-1 rounded-full text-xs bg-white/10 text-white/60">{domainLabel}</span>
          <span className="px-2.5 py-1 rounded-full text-xs bg-white/10 text-white/60">{contentTypeLabel}</span>
          {genre && <span className="px-2.5 py-1 rounded-full text-xs bg-white/10 text-white/60">{genre}</span>}
          {duration && duration > 0 && <span className="px-2.5 py-1 rounded-full text-xs bg-white/10 text-white/60">{formatDuration(duration)}</span>}
        </div>
        <div className="flex items-center gap-4 text-white/40 text-sm">
          {hasMintConfig && <span className="flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>{actualMintedCount} minted</span>}
          {!isCreator && ownedRarities.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-white/40">Owned:</span>
              {Object.entries(ownedRarities.reduce((acc, r) => { acc[r] = (acc[r] || 0) + 1; return acc; }, {} as Record<Rarity, number>)).sort(([a], [b]) => Number(b) - Number(a)).map(([rarity, count]) => (
                <span key={rarity} className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-medium ${rarityColors[Number(rarity) as Rarity]}`}>{count}</span>
              ))}
            </div>
          )}
          {activeRental && <span className="text-amber-400/80 text-xs">Rental expires {new Date(Number(activeRental.expiresAt) * 1000).toLocaleDateString()}</span>}
        </div>
      </div>

      {/* Right Actions */}
      <div className={`absolute right-4 bottom-32 flex flex-col items-center gap-4 transition-all duration-500 ${showOverlay ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4 pointer-events-none"}`} onClick={(e) => e.stopPropagation()}>
        {!isCreator && hasMintConfig && <button onClick={() => setShowBuyContentModal(true)} className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors border border-white/10" title="Buy NFT"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg></button>}
        {!isCreator && hasRentConfig && <button onClick={() => setShowRentModal(true)} className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors border border-white/10" title={activeRental ? "Extend" : "Rent"}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></button>}
        {!isCreator && ownedNftCount > 0 && <button onClick={() => setShowSellModal(true)} className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors border border-white/10" title="Sell NFT"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></button>}
        <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/content/${content.contentCid}`).then(() => { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }); }} className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors border border-white/10" title="Share">
          {showCopied ? <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" /></svg> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>}
        </button>
        {isCreator && (
          <>
            <button onClick={() => setShowEditModal(true)} disabled={!canEdit} className={`w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center transition-colors border border-white/10 ${canEdit ? "text-white hover:bg-white/20" : "text-white/30 cursor-not-allowed"}`} title={canEdit ? "Edit" : "Locked"}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
            <button onClick={() => setShowDeleteModal(true)} disabled={!canDelete} className={`w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center transition-colors border border-white/10 ${canDelete ? "text-red-400 hover:bg-red-500/20" : "text-white/30 cursor-not-allowed"}`} title={canDelete ? "Delete" : "Locked"}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
          </>
        )}
      </div>

      {/* Modals */}
      {showBuyContentModal && mintConfig && <BuyContentModal isOpen={showBuyContentModal} onClose={() => setShowBuyContentModal(false)} contentCid={content.contentCid} contentTitle={content.metadata?.title || content.metadata?.name} creator={content.creator} mintConfig={mintConfig} mintedCount={BigInt(actualMintedCount)} ownedCount={ownedNftCount} onSuccess={() => { refetchMintConfig(); refetchOwnership(); }} />}
      {showEditModal && <EditContentModal isOpen={showEditModal} onClose={() => setShowEditModal(false)} contentCid={content.contentCid} currentTitle={content.metadata?.title || content.metadata?.name} currentDescription={content.metadata?.description} currentTags={content.metadata?.tags} />}
      {showDeleteModal && <DeleteContentModal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} contentCid={content.contentCid} contentTitle={content.metadata?.title || content.metadata?.name} hasMintConfig={!!mintConfig} />}
      {showRentModal && rentConfig && <RentContentModal isOpen={showRentModal} onClose={() => setShowRentModal(false)} contentCid={content.contentCid} contentTitle={content.metadata?.title || content.metadata?.name} creator={content.creator} rentConfig={rentConfig} activeRental={activeRental} onSuccess={() => { refetchRentConfig(); refetchOwnership(); refetchActiveRental(); }} onBuyClick={mintConfig ? () => setShowBuyContentModal(true) : undefined} />}
      {showSellModal && <SellNftModal isOpen={showSellModal} onClose={() => setShowSellModal(false)} contentCid={content.contentCid} contentTitle={content.metadata?.title || content.metadata?.name} ownedCount={ownedNftCount} userNfts={walletNfts} />}
    </div>
  );
}
