"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useContentRegistry } from "@/hooks/useContentRegistry";

// Helper to safely convert a PublicKey-like object to base58 string
// This handles cases where PublicKey objects lose their prototype during bundling/serialization
function safeToBase58(pk: PublicKey | { toBase58?: () => string } | undefined | null): string {
  if (!pk) return "";
  // If it's a proper PublicKey instance, use toBase58 directly
  if (pk instanceof PublicKey) {
    return pk.toBase58();
  }
  // If it has toBase58 method, try using it
  if (typeof pk.toBase58 === "function") {
    try {
      return pk.toBase58();
    } catch {
      // Fall through to reconstruction
    }
  }
  // Try to reconstruct from the object's internal bytes
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyPk = pk as any;
    if (anyPk._bn) {
      return new PublicKey(anyPk._bn.toArray()).toBase58();
    }
    // Try to create from the object directly (might be serialized bytes)
    return new PublicKey(pk as unknown as Uint8Array).toBase58();
  } catch {
    return "";
  }
}
import { useSession } from "@/hooks/useSession";
import { getIpfsUrl, getContentDomain, getDomainLabel, getContentTypeLabel as getSDKContentTypeLabel, ContentType as SDKContentType, getContentPda, VisibilityLevel, getVisibilityLevelLabel, BundleType, getBundlePda } from "@handcraft/sdk";
import { BuyContentModal, SellNftModal } from "@/components/mint";
import { EditContentModal, DeleteContentModal } from "@/components/content";
import { RentContentModal } from "@/components/rent";
import { BuyBundleModal } from "@/components/bundle/BuyBundleModal";
import { RentBundleModal } from "@/components/bundle/RentBundleModal";
import { ReportDialog, ModerationBadge } from "@/components/moderation";
import { useSubjectStatus } from "@/hooks/useSubjectStatus";
import { RarityBadge } from "@/components/rarity";
import { Rarity } from "@handcraft/sdk";
import { type EnrichedContent, type UnifiedFeedItem, type NftTypeFilter, NFT_TYPE_FILTERS, type EnrichedBundle, type BundleFeedMetadata } from "./types";
import { getCachedDecryptedUrl, setCachedDecryptedUrl } from "./cache";
import { getContentTypeLabel, getTimeAgo, formatDuration } from "./helpers";
import { EmptyState, LockedOverlay, NeedsSessionOverlay } from "./Overlays";
import { ContentViewer, ViewerPlaceholder } from "@/components/viewers";

type ContentTypeFilter = "all" | SDKContentType;
type BundleTypeFilter = "all" | BundleType;
type SortType = "date" | "minted" | "price" | "random";
type SortDirection = "desc" | "asc";

const SORT_TYPES: { value: SortType; label: string }[] = [
  { value: "date", label: "Date" },
  { value: "minted", label: "Sold" },
  { value: "price", label: "Price" },
  { value: "random", label: "Random" },
];

const ITEMS_PER_PAGE = 20;

// Using numeric values to avoid Turbopack module initialization issues
const CONTENT_TYPE_FILTERS: { value: ContentTypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: 0, label: "Video" },
  { value: 1, label: "Movie" },
  { value: 2, label: "TV" },
  { value: 3, label: "MV" },
  { value: 4, label: "Short" },
  { value: 5, label: "Music" },
  { value: 6, label: "Podcast" },
  { value: 7, label: "Audiobook" },
  { value: 8, label: "Photo" },
  { value: 9, label: "Art" },
  { value: 10, label: "Book" },
  { value: 11, label: "Comic" },
  { value: 12, label: "Asset" },
  { value: 13, label: "Game" },
  { value: 14, label: "Software" },
  { value: 15, label: "Dataset" },
  { value: 16, label: "Post" },
];

// Using numeric values to avoid Turbopack module initialization issues
const BUNDLE_TYPE_FILTERS: { value: BundleTypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: 0, label: "Album" },
  { value: 1, label: "Series" },
  { value: 2, label: "Playlist" },
  { value: 3, label: "Course" },
  { value: 4, label: "Newsletter" },
  { value: 5, label: "Collection" },
  { value: 6, label: "Pack" },
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
  if (!isNaN(num) && (Object.values(SDKContentType) as number[]).includes(num)) {
    return num as SDKContentType;
  }
  return "all";
}

function parseBundleTypeFilter(param: string | null): BundleTypeFilter {
  if (!param || param === "all") return "all";
  const num = Number(param);
  if (!isNaN(num) && (Object.values(BundleType) as number[]).includes(num)) {
    return num as BundleType;
  }
  return "all";
}

function parseNftTypeFilter(param: string | null): NftTypeFilter {
  if (param && ["all", "content", "bundle"].includes(param)) {
    return param as NftTypeFilter;
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
  onCloseSidebar?: () => void;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  // When provided, this content/bundle starts first in the feed
  initialCid?: string;
  // For bundles: which item position to start at (1-indexed)
  initialPosition?: number;
  // Callback when overlay visibility changes (for syncing page-level UI)
  onOverlayChange?: (visible: boolean) => void;
}

export function Feed({ isSidebarOpen = false, onCloseSidebar, showFilters, setShowFilters, initialCid, initialPosition = 1, onOverlayChange }: FeedProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const nftTypeFilter = parseNftTypeFilter(searchParams.get("nftType"));
  const typeFilter = parseFilter(searchParams.get("filter"));
  const bundleTypeFilter = parseBundleTypeFilter(searchParams.get("bundleType"));
  const sortType = parseSortType(searchParams.get("sort"));
  const sortDir = parseSortDir(searchParams.get("dir"));
  const [randomSeed] = useState(() => Date.now());
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  const [currentIndex, setCurrentIndex] = useState(0);

  // Track overlay visibility for syncing UI elements
  const [localOverlayVisible, setLocalOverlayVisible] = useState(true);

  // Wrapper to track overlay state locally and pass to parent
  const handleOverlayChange = useCallback((visible: boolean) => {
    setLocalOverlayVisible(visible);
    onOverlayChange?.(visible);
  }, [onOverlayChange]);

  // Queue of items to insert at a specific position
  const [queuedItem, setQueuedItem] = useState<{ cid: string; insertAfter: number } | null>(null);
  const [jumpToQueued, setJumpToQueued] = useState(false);

  // Navigation function to queue content/bundle after current position and jump to it
  const navigateToContent = useCallback((cid: string) => {
    setQueuedItem({ cid, insertAfter: currentIndex });
    setJumpToQueued(true);
  }, [currentIndex]);

  // Flag to prevent intersection observer from overriding keyboard navigation
  const isKeyboardNavigating = useRef(false);
  const keyboardTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadMoreRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { globalContent: rawGlobalContent, isLoadingGlobalContent, globalBundles: rawGlobalBundles, isLoadingGlobalBundles, allMintConfigs, allBundleMintConfigs, client, getCreatorUsername } = useContentRegistry();

  const updateParams = useCallback((updates: { nftType?: string; filter?: string; bundleType?: string; sort?: string; dir?: string }) => {
    const params = new URLSearchParams(searchParams.toString());

    if (updates.nftType !== undefined) {
      if (updates.nftType === "all") {
        params.delete("nftType");
      } else {
        params.set("nftType", updates.nftType);
      }
    }

    if (updates.filter !== undefined) {
      if (updates.filter === "all") {
        params.delete("filter");
      } else {
        params.set("filter", updates.filter);
      }
    }

    if (updates.bundleType !== undefined) {
      if (updates.bundleType === "all") {
        params.delete("bundleType");
      } else {
        params.set("bundleType", updates.bundleType);
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

  const setNftTypeFilter = useCallback((nftType: NftTypeFilter) => {
    setVisibleCount(ITEMS_PER_PAGE);
    setCurrentIndex(0);
    updateParams({ nftType });
  }, [updateParams]);

  const setTypeFilter = useCallback((filter: ContentTypeFilter) => {
    setVisibleCount(ITEMS_PER_PAGE);
    setCurrentIndex(0);
    updateParams({ filter: String(filter) });
  }, [updateParams]);

  const setBundleTypeFilter = useCallback((bundleType: BundleTypeFilter) => {
    setVisibleCount(ITEMS_PER_PAGE);
    setCurrentIndex(0);
    updateParams({ bundleType: String(bundleType) });
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
  const [globalBundles, setGlobalBundles] = useState<EnrichedBundle[]>([]);
  const [isEnrichingGlobal, setIsEnrichingGlobal] = useState(false);
  const [isEnrichingBundles, setIsEnrichingBundles] = useState(false);
  const lastGlobalFetchRef = useRef<string>("");
  const lastBundleFetchRef = useRef<string>("");

  // Enrich content with metadata
  useEffect(() => {
    const contentKey = rawGlobalContent.map(c => c.contentCid).join(",");
    if (contentKey === lastGlobalFetchRef.current || !contentKey) return;
    lastGlobalFetchRef.current = contentKey;

    // Fetch metadata from IPFS for each content item using metadataCid
    async function enrichGlobalFeed() {
      setIsEnrichingGlobal(true);
      try {
        const enriched = await Promise.all(
          rawGlobalContent.map(async (item) => {
            const creatorAddress = safeToBase58(item.creator);
            let metadata: EnrichedContent["metadata"] | undefined;

            // Fetch metadata from IPFS if metadataCid is available
            let metadataCreatedAt: bigint | undefined;
            if (item.metadataCid) {
              try {
                const metadataUrl = getIpfsUrl(item.metadataCid);
                const res = await fetch(metadataUrl);
                if (res.ok) {
                  const json = await res.json();
                  metadata = {
                    name: json.name,
                    title: json.properties?.title || json.name,
                    description: json.description,
                    image: json.image,
                    tags: json.properties?.tags || [],
                    contentType: json.properties?.contentDomain,
                    domain: json.properties?.contentDomain,
                  };
                  // Extract createdAt from metadata properties (stored as unix timestamp in seconds)
                  const createdAtValue = json.properties?.createdAt || json.properties?.created_at;
                  if (createdAtValue) {
                    metadataCreatedAt = BigInt(createdAtValue);
                  }
                }
              } catch {
                // Keep metadata undefined on error
              }
            }

            // Use createdAt from metadata if available, otherwise fall back to on-chain value
            const createdAt = metadataCreatedAt ?? item.createdAt ?? BigInt(0);
            return { ...item, creatorAddress, metadata, createdAt } as EnrichedContent;
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

  // Enrich bundles with metadata
  useEffect(() => {
    const bundleKey = rawGlobalBundles.map(b => b.bundleId).join(",");
    if (bundleKey === lastBundleFetchRef.current || !bundleKey) return;
    lastBundleFetchRef.current = bundleKey;

    async function enrichBundles() {
      setIsEnrichingBundles(true);
      try {
        const enriched = await Promise.all(
          rawGlobalBundles
            .filter(bundle => bundle.isActive) // Only show active bundles
            .map(async (bundle) => {
              const creatorAddress = bundle.creator.toBase58();
              let metadata: BundleFeedMetadata | undefined;
              if (bundle.metadataCid) {
                try {
                  const metadataUrl = getIpfsUrl(bundle.metadataCid);
                  const res = await fetch(metadataUrl);
                  metadata = await res.json();
                } catch {
                  // Keep metadata undefined
                }
              }
              return { ...bundle, metadata, creatorAddress } as EnrichedBundle;
            })
        );
        setGlobalBundles(enriched);
      } catch (err) {
        console.error("Error enriching bundles:", err);
      } finally {
        setIsEnrichingBundles(false);
      }
    }

    enrichBundles();
  }, [rawGlobalBundles]);

  const isLoading = !client || isLoadingGlobalContent || isLoadingGlobalBundles || isEnrichingGlobal || isEnrichingBundles;

  // Create unified feed items combining content and bundles
  const unifiedFeed = useMemo((): UnifiedFeedItem[] => {
    const items: UnifiedFeedItem[] = [];

    // Add content items (filter out disputed/flagged content from public feed)
    for (const content of globalContent) {
      // Hide content that is under review or dismissed
      const status = content.moderationStatus;
      if (status === "disputed" || status === "flagged") {
        continue;
      }

      const contentId = content.contentCid ?? content.pubkey?.toBase58() ?? "";
      const metadataTitle = content.metadata?.title || content.metadata?.name;
      items.push({
        id: contentId,
        type: "content",
        creator: content.creator,
        createdAt: content.createdAt ?? BigInt(0),
        metadata: {
          collectionName: content.collectionName,
          title: metadataTitle,
          description: content.metadata?.description,
          image: content.previewCid ? getIpfsUrl(content.previewCid) : undefined,
          tags: content.metadata?.tags,
        },
        contentCid: content.contentCid ?? contentId,
        contentType: content.contentType,
        previewCid: content.previewCid,
        isEncrypted: content.isEncrypted,
        visibilityLevel: content.visibilityLevel,
        mintedCount: content.mintedCount,
        isLocked: content.isLocked,
        mintConfig: content.mintConfig,
        contentEntry: content,
      });
    }

    // Add bundle items
    for (const bundle of globalBundles) {
      items.push({
        id: bundle.bundleId,
        type: "bundle",
        creator: bundle.creator,
        createdAt: bundle.createdAt,
        metadata: {
          collectionName: bundle.collectionName,
          title: bundle.metadata?.name,
          description: bundle.metadata?.description,
          image: bundle.metadata?.image,
          tags: bundle.metadata?.tags,
        },
        bundleId: bundle.bundleId,
        bundleType: bundle.bundleType,
        itemCount: bundle.itemCount,
        mintedCount: bundle.mintedCount,
        isLocked: bundle.isLocked,
        mintConfig: bundle.mintConfig,
        bundleEntry: bundle,
      });
    }

    return items;
  }, [globalContent, globalBundles]);

  // Get price for content or bundle
  const getItemPrice = useCallback((item: UnifiedFeedItem): bigint => {
    if (item.type === "content" && item.contentCid) {
      if (!allMintConfigs) return BigInt(0);
      const [contentPda] = getContentPda(item.contentCid);
      const config = allMintConfigs.get(contentPda.toBase58());
      return config?.priceSol ?? BigInt(0);
    } else if (item.type === "bundle" && item.bundleId) {
      if (!allBundleMintConfigs) return BigInt(0);
      const [bundlePda] = getBundlePda(item.creator, item.bundleId);
      const config = allBundleMintConfigs.get(bundlePda.toBase58());
      return config?.price ?? BigInt(0);
    }
    return BigInt(0);
  }, [allMintConfigs, allBundleMintConfigs]);

  // Legacy getPrice for ContentSlide compatibility
  const getPrice = useCallback((contentCid: string): bigint => {
    if (!allMintConfigs) return BigInt(0);
    const [contentPda] = getContentPda(contentCid);
    const config = allMintConfigs.get(contentPda.toBase58());
    return config?.priceSol ?? BigInt(0);
  }, [allMintConfigs]);

  const { displayItems, totalItems, hasMore } = useMemo(() => {
    // First filter by NFT type
    let filtered = unifiedFeed;
    if (nftTypeFilter === "content") {
      filtered = filtered.filter(item => item.type === "content");
    } else if (nftTypeFilter === "bundle") {
      filtered = filtered.filter(item => item.type === "bundle");
    }

    // Then filter by content type (only applies to content items)
    if (typeFilter !== "all") {
      filtered = filtered.filter(item =>
        item.type === "bundle" || item.contentType === typeFilter
      );
    }

    // Filter by bundle type (only applies to bundle items)
    if (bundleTypeFilter !== "all") {
      filtered = filtered.filter(item =>
        item.type === "content" || item.bundleType === bundleTypeFilter
      );
    }

    let sorted = [...filtered].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortType) {
        case "minted":
          return dir * (Number(a.mintedCount ?? 0) - Number(b.mintedCount ?? 0));
        case "price": {
          const priceA = getItemPrice(a);
          const priceB = getItemPrice(b);
          return dir * Number(priceA - priceB);
        }
        case "random":
          return getItemHash(randomSeed, a.id) - getItemHash(randomSeed, b.id);
        case "date":
        default:
          return dir * (Number(a.createdAt) - Number(b.createdAt));
      }
    });

    // If initialCid is provided, move that item to the front
    if (initialCid) {
      const initialIndex = sorted.findIndex(item => item.id === initialCid);
      if (initialIndex > 0) {
        const [initialItem] = sorted.splice(initialIndex, 1);
        sorted = [initialItem, ...sorted];
      }
    }

    // If queuedItem is set, insert it at the fixed position
    if (queuedItem) {
      const queuedIndex = sorted.findIndex(item => item.id === queuedItem.cid);
      const targetPos = queuedItem.insertAfter + 1;
      if (queuedIndex >= 0 && queuedIndex !== targetPos) {
        const [item] = sorted.splice(queuedIndex, 1);
        // Insert at the fixed position
        const insertAt = Math.min(targetPos, sorted.length);
        sorted.splice(insertAt, 0, item);
      }
    }

    const totalItems = sorted.length;
    const displayed = sorted.slice(0, visibleCount);
    const hasMore = visibleCount < totalItems;

    return { displayItems: displayed, totalItems, hasMore };
  }, [unifiedFeed, nftTypeFilter, typeFilter, bundleTypeFilter, sortType, sortDir, visibleCount, randomSeed, getItemPrice, initialCid, queuedItem]);

  // For backward compatibility, extract content-only items
  const displayContent = useMemo(() => {
    return displayItems
      .filter((item): item is UnifiedFeedItem & { contentEntry: EnrichedContent } =>
        item.type === "content" && item.contentEntry !== undefined
      )
      .map(item => item.contentEntry);
  }, [displayItems]);

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
      // Ignore if user is typing in an input, textarea, or contenteditable
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        isKeyboardNavigating.current = true;
        setCurrentIndex(prev => Math.min(prev + 1, displayItems.length - 1));
        // Clear previous timeout and set new one
        if (keyboardTimeoutRef.current) clearTimeout(keyboardTimeoutRef.current);
        keyboardTimeoutRef.current = setTimeout(() => { isKeyboardNavigating.current = false; }, 500);
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        isKeyboardNavigating.current = true;
        setCurrentIndex(prev => Math.max(prev - 1, 0));
        // Clear previous timeout and set new one
        if (keyboardTimeoutRef.current) clearTimeout(keyboardTimeoutRef.current);
        keyboardTimeoutRef.current = setTimeout(() => { isKeyboardNavigating.current = false; }, 500);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [displayItems.length]);

  // Scroll snap to current item when navigating via keyboard
  useEffect(() => {
    // Only scroll when keyboard navigation is active
    if (!isKeyboardNavigating.current) return;

    const container = containerRef.current;
    if (!container || displayItems.length === 0) return;

    const items = container.querySelectorAll("[data-feed-item]");
    const targetItem = items[currentIndex];
    if (targetItem) {
      // Use instant scroll for keyboard navigation - snappy response
      targetItem.scrollIntoView({ behavior: "instant", block: "start" });
    }
  }, [currentIndex, displayItems.length]);

  // Pause all media when scroll starts - ensures immediate pause regardless of React batching
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let scrollTimeout: ReturnType<typeof setTimeout>;
    const handleScroll = () => {
      // Pause all media immediately when scrolling starts
      document.querySelectorAll('video, audio').forEach((el) => {
        if (el instanceof HTMLMediaElement) {
          el.pause();
        }
      });
      // Clear any existing timeout
      clearTimeout(scrollTimeout);
      // Set a flag or timeout if needed for scroll end detection
      scrollTimeout = setTimeout(() => {
        // Scroll ended - the active viewer will auto-play via its isActive prop
      }, 150);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, []);

  // Intersection observer for scroll-based index updates
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Skip if keyboard navigation is in progress
        if (isKeyboardNavigating.current) return;

        // Find the most visible item
        let mostVisibleIndex = -1;
        let mostVisibleRatio = 0;
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute("data-index"));
            if (!isNaN(index) && entry.intersectionRatio > mostVisibleRatio) {
              mostVisibleIndex = index;
              mostVisibleRatio = entry.intersectionRatio;
            }
          }
        });

        if (mostVisibleIndex >= 0 && mostVisibleRatio > 0.3) {
          setCurrentIndex(mostVisibleIndex);
        }
      },
      { root: container, threshold: [0, 0.3, 0.5, 0.7, 1] }
    );

    const items = container.querySelectorAll("[data-feed-item]");
    items.forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, [displayItems]);

  // Track if initial URL has been set (for bare /content)
  const initialUrlSet = useRef(false);

  // Update URL when current item changes (only on /content/* routes)
  useEffect(() => {
    if (displayItems.length === 0) return;

    // For bare /content, always use first item and only set once
    const isBareContent = window.location.pathname === "/content" || window.location.pathname === "/content/";
    if (isBareContent && !initialUrlSet.current) {
      const firstItem = displayItems[0];
      if (firstItem) {
        window.history.replaceState({}, "", `/content/${firstItem.id}`);
        initialUrlSet.current = true;
      }
      return;
    }

    const currentItem = displayItems[currentIndex];
    if (!currentItem) return;

    // If initialCid is provided, wait until it's properly positioned at index 0
    if (initialCid && currentIndex === 0 && currentItem.id !== initialCid) {
      return;
    }

    // Update URL if on /content route and URL differs
    if (window.location.pathname.startsWith("/content")) {
      const newUrl = `/content/${currentItem.id}`;
      if (window.location.pathname !== newUrl) {
        window.history.pushState({}, "", newUrl);
      }
    }
  }, [currentIndex, displayItems, initialCid]);

  // Jump to queued item after it's inserted
  useEffect(() => {
    if (!jumpToQueued || !queuedItem) return;

    const queuedIndex = displayItems.findIndex(item => item.id === queuedItem.cid);
    if (queuedIndex >= 0 && containerRef.current) {
      setCurrentIndex(queuedIndex);
      const targetElement = containerRef.current.querySelector(`[data-index="${queuedIndex}"]`);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: "instant" });
      }
      setJumpToQueued(false);
    }
  }, [jumpToQueued, queuedItem, displayItems]);

  // Full screen immersive container
  const containerClass = "h-screen bg-black relative";

  // Check if initialCid is provided but not yet loaded/positioned
  // Wait if: initialCid provided AND (feed still empty OR initialCid not yet at front)
  const initialCidExistsInFeed = initialCid && unifiedFeed.some(item => item.id === initialCid);
  const isWaitingForInitialContent = initialCid && (
    // Feed is empty but we expect content to load
    (unifiedFeed.length === 0) ||
    // initialCid exists in feed but not yet positioned first in displayItems
    (initialCidExistsInFeed && displayItems.length > 0 && displayItems[0]?.id !== initialCid)
  );

  if (isLoading || isWaitingForInitialContent) {
    return (
      <div className={`${containerClass} flex items-center justify-center`}>
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/60 font-light tracking-wide">Loading content...</p>
        </div>
      </div>
    );
  }

  if (displayItems.length === 0) {
    const hasAnyFilter = nftTypeFilter !== "all" || typeFilter !== "all" || bundleTypeFilter !== "all";
    return (
      <div className={`${containerClass} flex items-center justify-center p-8`}>
        <EmptyState
          showExplore={true}
          hasFilter={hasAnyFilter}
          onClearFilter={() => {
            setNftTypeFilter("all");
            setTypeFilter("all");
            setBundleTypeFilter("all");
          }}
        />
      </div>
    );
  }

  return (
    <div className={containerClass}>
      {/* Filter Button - positioned below menu button (handled by page), synced with overlay */}
      <button
        onClick={() => {
          if (isSidebarOpen && onCloseSidebar) onCloseSidebar();
          setShowFilters(!showFilters);
        }}
        className={`fixed z-50 p-3 bg-black/60 backdrop-blur-md rounded-full border border-white/10 hover:border-white/30 transition-all duration-300 ${isSidebarOpen || showFilters ? "left-[304px]" : "left-4"} ${localOverlayVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        style={{ top: "4.5rem" }}
        title="Filter"
      >
        <svg className="w-5 h-5 text-white/70 hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
      </button>

      {/* Filters Panel - synced with overlay */}
      <div className={`absolute top-0 left-0 h-full w-72 bg-black/95 backdrop-blur-xl border-r border-white/10 z-40 transform transition-all duration-300 overflow-y-auto ${showFilters ? "translate-x-0" : "-translate-x-full"} ${localOverlayVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        <div className="p-6 pt-6 pb-12">
          <h3 className="text-white/40 text-xs uppercase tracking-[0.2em] mb-6">Filters</h3>

          {/* NFT Type Filter */}
          <div className="mb-6">
            <label className="text-white/60 text-sm mb-3 block">Type</label>
            <div className="flex gap-2">
              {NFT_TYPE_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setNftTypeFilter(filter.value)}
                  className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                    nftTypeFilter === filter.value ? "bg-white text-black font-medium" : "bg-white/10 text-white/60 hover:text-white hover:bg-white/20"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div className="mb-6">
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

          {/* Content Type Filter - active when showing All or Content */}
          <div className={`mb-6 ${nftTypeFilter === "bundle" ? "opacity-40 pointer-events-none" : ""}`}>
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

          {/* Bundle Type Filter - active when showing All or Bundle */}
          <div className={`${nftTypeFilter === "content" ? "opacity-40 pointer-events-none" : ""}`}>
            <label className="text-white/60 text-sm mb-3 block">Bundle Type</label>
            <div className="flex flex-wrap gap-2">
              {BUNDLE_TYPE_FILTERS.map((filter) => (
                <button
                  key={String(filter.value)}
                  onClick={() => setBundleTypeFilter(filter.value)}
                  className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                    bundleTypeFilter === filter.value ? "bg-white text-black font-medium" : "bg-white/10 text-white/60 hover:text-white hover:bg-white/20"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Progress Indicator - synced with overlay */}
      <div className={`absolute right-4 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-1.5 transition-opacity duration-300 ${localOverlayVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        {displayItems.slice(Math.max(0, currentIndex - 3), Math.min(displayItems.length, currentIndex + 4)).map((item, idx) => {
          const actualIndex = Math.max(0, currentIndex - 3) + idx;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentIndex(actualIndex)}
              className={`transition-all duration-300 rounded-full ${actualIndex === currentIndex ? "w-1.5 h-6 bg-white" : "w-1.5 h-1.5 bg-white/30 hover:bg-white/60"}`}
            />
          );
        })}
      </div>

      {/* Main Feed Container - click to close filter panel */}
      <div
        ref={containerRef}
        className="h-full overflow-y-auto overflow-x-hidden snap-y snap-mandatory scroll-smooth"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        onClick={() => {
          if (showFilters) setShowFilters(false);
        }}
      >
        <style jsx>{`div::-webkit-scrollbar { display: none; }`}</style>
        {displayItems.map((item, index) => (
          item.type === "content" && item.contentEntry ? (
            <ContentSlide key={item.id} content={item.contentEntry} index={index} isActive={index === currentIndex} onNavigateToContent={navigateToContent} onOverlayChange={handleOverlayChange} enrichedBundles={globalBundles} />
          ) : item.type === "bundle" && item.bundleEntry ? (
            <BundleFeedItem
              key={item.id}
              bundle={item.bundleEntry}
              metadata={item.metadata}
              index={index}
              isActive={index === currentIndex}
              initialPosition={initialCid === item.id ? initialPosition : 1}
              onNavigateToContent={navigateToContent}
              onOverlayChange={handleOverlayChange}
              enrichedBundles={globalBundles}
            />
          ) : null
        ))}
        {/* Load more sentinel */}
        <div ref={loadMoreRef} className="h-1" />
      </div>
    </div>
  );
}

// ============== CONTENT SLIDE (immersive mode) ==============
export interface BundleItemDisplay {
  contentCid: string;
  collectionName?: string;
  title?: string;
  description?: string;
  previewCid?: string;
  thumbnail?: string;
  position: number;
  contentType?: number;
  isEncrypted?: boolean;
  artist?: string;
  album?: string;
  duration?: number;
}

export interface BundleContextProps {
  bundle: EnrichedBundle;
  metadata?: { title?: string; description?: string; image?: string; tags?: string[] };
  items: BundleItemDisplay[];
  currentIndex: number;
  onNavigate: (idx: number) => void;
  isLoadingItems: boolean;
}

interface ContentSlideProps {
  content: EnrichedContent;
  index: number;
  isActive: boolean;
  rightPanelOpen?: boolean;
  // Bundle context - when provided, shows bundle sidebar and uses bundle commerce
  bundleContext?: BundleContextProps;
  // Navigation callback for in-feed navigation
  onNavigateToContent?: (cid: string) => void;
  // Callback when overlay visibility changes
  onOverlayChange?: (visible: boolean) => void;
  // Skip rendering the data-feed-item wrapper (used when parent already provides it)
  skipFeedItemWrapper?: boolean;
  // Enriched bundles for "part of bundle" display
  enrichedBundles?: EnrichedBundle[];
}

export function ContentSlide({ content, index, isActive, rightPanelOpen = false, bundleContext, onNavigateToContent, onOverlayChange, skipFeedItemWrapper = false, enrichedBundles = [] }: ContentSlideProps) {
  const [showOverlay, setShowOverlay] = useState(true);

  // Notify parent when overlay visibility changes or slide becomes active
  useEffect(() => {
    if (isActive) {
      onOverlayChange?.(showOverlay);
    }
  }, [showOverlay, isActive, onOverlayChange]);
  const [showBuyContentModal, setShowBuyContentModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRentModal, setShowRentModal] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [decryptedUrl, setDecryptedUrl] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  // Bundle-specific state - user manually opens playlist
  const [showBundleSidebar, setShowBundleSidebar] = useState(false);
  const [showBuyBundleModal, setShowBuyBundleModal] = useState(false);
  const [showRentBundleModal, setShowRentBundleModal] = useState(false);
  // Swipe gesture tracking for bundle navigation
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const slideRef = useRef<HTMLDivElement>(null);

  // Use native event listeners for touch to enable preventDefault
  useEffect(() => {
    const el = slideRef.current;
    if (!el || !bundleContext) return;

    const onTouchStart = (e: TouchEvent) => {
      if ((e.target as HTMLElement).closest("button, a, video, audio")) return;
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!touchStartRef.current) return;
      const deltaX = e.touches[0].clientX - touchStartRef.current.x;
      const deltaY = e.touches[0].clientY - touchStartRef.current.y;

      // Check if we can navigate in the swipe direction
      const canGoNext = bundleContext.currentIndex < bundleContext.items.length - 1;
      const canGoPrev = bundleContext.currentIndex > 0;
      const isSwipingLeft = deltaX < 0;
      const isSwipingRight = deltaX > 0;
      const shouldCapture = (isSwipingLeft && canGoNext) || (isSwipingRight && canGoPrev);

      if (shouldCapture && Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
        e.preventDefault();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current) return;
      const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
      const deltaX = touchEnd.x - touchStartRef.current.x;
      const deltaY = touchEnd.y - touchStartRef.current.y;
      const minSwipeDistance = 50;

      const canGoNext = bundleContext.currentIndex < bundleContext.items.length - 1;
      const canGoPrev = bundleContext.currentIndex > 0;

      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
        if (deltaX < 0 && canGoNext) {
          e.preventDefault();
          bundleContext.onNavigate(bundleContext.currentIndex + 1);
        } else if (deltaX > 0 && canGoPrev) {
          e.preventDefault();
          bundleContext.onNavigate(bundleContext.currentIndex - 1);
        }
        // If can't navigate, let browser handle (back/forward)
      }
      touchStartRef.current = null;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: false });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [bundleContext]);

  // Keyboard navigation (left/right arrows) for bundle items
  useEffect(() => {
    if (!bundleContext || !isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const canGoNext = bundleContext.currentIndex < bundleContext.items.length - 1;
      const canGoPrev = bundleContext.currentIndex > 0;

      if (e.key === "ArrowLeft" && canGoPrev) {
        bundleContext.onNavigate(bundleContext.currentIndex - 1);
      } else if (e.key === "ArrowRight" && canGoNext) {
        bundleContext.onNavigate(bundleContext.currentIndex + 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [bundleContext, isActive]);

  const { publicKey } = useWallet();
  const { token: sessionToken, createSession, isCreating: isCreatingSession } = useSession();
  const { useMintConfig, useRentConfig, useNftOwnership, useActiveRental, walletNfts, nftRarities, getBundlesForContent, walletBundleNfts, useBundleMintConfig, useBundleRentConfig, bundleNftRarities, getCreatorUsername } = useContentRegistry();

  const { data: mintConfig, refetch: refetchMintConfig } = useMintConfig(content.contentCid ?? null);
  const { data: rentConfig, refetch: refetchRentConfig } = useRentConfig(content.contentCid ?? null);
  const { data: ownedNftCount = 0, refetch: refetchOwnership } = useNftOwnership(content.contentCid ?? null);
  const { data: activeRental, refetch: refetchActiveRental } = useActiveRental(content.contentCid ?? null);

  // Moderation status
  const { data: moderationData } = useSubjectStatus(content.contentCid ?? null);
  const isInReview = moderationData?.status === "disputed";

  // Bundle config hooks (only used when bundleContext is provided)
  const { data: bundleMintConfig, refetch: refetchBundleMintConfig } = useBundleMintConfig(
    bundleContext?.bundle.creator ?? null,
    bundleContext?.bundle.bundleId ?? null
  );
  const { data: bundleRentConfig, refetch: refetchBundleRentConfig } = useBundleRentConfig(
    bundleContext?.bundle.creator ?? null,
    bundleContext?.bundle.bundleId ?? null
  );

  // Bundle commerce flags
  const hasBundleMintConfig = bundleContext && bundleMintConfig && bundleMintConfig.isActive;
  const hasBundleRentConfig = bundleContext && bundleRentConfig && bundleRentConfig.isActive;
  const bundleMintPrice = hasBundleMintConfig ? bundleMintConfig.price : undefined;
  const bundleLowestRentPrice = hasBundleRentConfig ? Math.min(
    Number(bundleRentConfig.rentFee6h ?? Infinity),
    Number(bundleRentConfig.rentFee1d ?? Infinity),
    Number(bundleRentConfig.rentFee7d ?? Infinity)
  ) : undefined;

  // Bundle ownership
  const ownedBundleNfts = bundleContext ? walletBundleNfts.filter(nft =>
    nft.bundleId === bundleContext.bundle.bundleId && nft.creator?.toBase58() === bundleContext.bundle.creator.toBase58()
  ) : [];
  const ownsBundleNft = ownedBundleNfts.length > 0;
  const ownedBundleRarities: Rarity[] = ownedBundleNfts
    .map(nft => bundleNftRarities.get(nft.nftAsset.toBase58()))
    .filter((r): r is Rarity => r !== undefined);

  const ownsNft = ownedNftCount > 0;
  const ownedNftsForContent = walletNfts.filter(nft => nft.contentCid === content.contentCid);
  const ownedRarities: Rarity[] = ownedNftsForContent.map(nft => nftRarities.get(nft.nftAsset.toBase58())).filter((r): r is Rarity => r !== undefined);

  const isEncrypted = content.isEncrypted === true;
  const fullContentUrl = content.contentCid ? getIpfsUrl(content.contentCid) : null;
  const contentTypeLabel = content.contentType !== undefined ? getSDKContentTypeLabel(content.contentType as SDKContentType) : "Content";
  const contentDomain = content.contentType !== undefined ? getContentDomain(content.contentType as SDKContentType) : "document";
  const domainLabel = getDomainLabel(contentDomain);
  const timeAgo = content.createdAt && content.createdAt > 0
    ? getTimeAgo(Number(content.createdAt) * 1000)
    : null;

  const contextData = content.metadata?.context || {};
  const genre = contextData.genre || content.metadata?.genre;
  const artist = contextData.artist || content.metadata?.artist;
  const album = contextData.album || content.metadata?.album;
  const duration = contextData.duration;

  // Get bundle refs from hook, then find enriched versions with metadata
  const bundleRefs = content.contentCid ? getBundlesForContent(content.contentCid) : [];
  const contentBundles = bundleRefs.length > 0 && enrichedBundles.length > 0
    ? bundleRefs.map(ref => enrichedBundles.find(b => b.bundleId === ref.bundleId && b.creator.toBase58() === ref.creator.toBase58())).filter((b): b is EnrichedBundle => !!b)
    : bundleRefs;
  const ownsNftFromBundle = contentBundles.length > 0 && walletBundleNfts.some(nft => nft.bundleId && nft.creator && contentBundles.some(bundle => bundle.bundleId === nft.bundleId && bundle.creator.toBase58() === nft.creator?.toBase58()));

  const shortAddress = content.creatorAddress ? `${content.creatorAddress.slice(0, 4)}...${content.creatorAddress.slice(-4)}` : "Unknown";
  const creatorUsername = content.creatorAddress ? getCreatorUsername(content.creatorAddress) : null;
  const displayName = creatorUsername || shortAddress;
  const isCreator = publicKey?.toBase58() === content.creatorAddress;
  const hasMintConfig = mintConfig && mintConfig.isActive;
  const hasRentConfig = rentConfig && rentConfig.isActive;

  const mintPrice = hasMintConfig ? mintConfig.priceSol : undefined;
  const lowestRentPrice = hasRentConfig ? Math.min(Number(rentConfig.rentFee6h ?? Infinity), Number(rentConfig.rentFee1d ?? Infinity), Number(rentConfig.rentFee7d ?? Infinity)) : undefined;

  const actualMintedCount = Number(content.mintedCount ?? 0);
  const isLocked = content.isLocked || actualMintedCount > 0;
  const canEdit = isCreator && !isLocked;
  const canDelete = isCreator && !isLocked;

  // Bundle display helpers
  const bundleTypeLabel = bundleContext ? getBundleTypeLabel(bundleContext.bundle.bundleType) : null;
  const bundleTypeIcon = bundleContext ? getBundleTypeIcon(bundleContext.bundle.bundleType) : null;
  const bundleCreatorAddress = bundleContext?.bundle.creator.toBase58();
  const isBundleCreator = bundleContext && publicKey?.toBase58() === bundleCreatorAddress;
  const bundleMintedCount = bundleContext ? Number(bundleContext.bundle.mintedCount ?? 0) : 0;
  const currentBundleItem = bundleContext?.items[bundleContext.currentIndex];

  const contentUrl = !isEncrypted ? fullContentUrl : decryptedUrl;
  const isPublicContent = (content.visibilityLevel ?? 0) === 0;
  // Access control - consider bundle ownership when viewing bundle content
  const hasAccessViaBundle = bundleContext && ownsBundleNft;
  // Don't show locked overlay for public content (level 0) - anyone can access
  const showLockedOverlay = isEncrypted && !isCreator && hasAccess !== true && !ownsNft && !ownsNftFromBundle && !hasAccessViaBundle && !isPublicContent;
  // Need session if: encrypted AND (has access OR public content) AND no decrypted URL AND no session token
  const needsSession = isEncrypted && (isCreator || ownsNft || ownsNftFromBundle || hasAccessViaBundle || isPublicContent) && !decryptedUrl && !sessionToken;
  const showPlaceholder = isEncrypted && !contentUrl;

  const requestDecryptedContent = useCallback(async () => {
    if (!publicKey || !content.encryptionMetaCid || isDecrypting || !sessionToken || !content.contentCid) return;
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
    if (!content.contentCid) { return; }
    const cached = getCachedDecryptedUrl(publicKey.toBase58(), content.contentCid, sessionToken);
    if (cached) { setDecryptedUrl(cached); setHasAccess(true); return; }
    // Auto-request decryption for: creator, NFT owner, bundle owner, bundle context owner, OR public content (level 0)
    const canAutoDecrypt = isCreator || ownsNft || ownsNftFromBundle || hasAccessViaBundle || isPublicContent;
    if (canAutoDecrypt && !decryptedUrl && !isDecrypting) { requestDecryptedContent(); }
  }, [isEncrypted, publicKey, isCreator, ownsNft, ownsNftFromBundle, hasAccessViaBundle, isPublicContent, decryptedUrl, isDecrypting, content.contentCid, requestDecryptedContent, sessionToken]);

  const handleContentClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, a, video, audio")) return;
    setShowOverlay(prev => !prev);
  }, []);

  // Using numeric keys to avoid module initialization order issues with Turbopack
  const rarityColors: Record<Rarity, string> = {
    0: "bg-gray-500/40 text-gray-200",    // Common
    1: "bg-green-500/40 text-green-300",  // Uncommon
    2: "bg-blue-500/40 text-blue-300",    // Rare
    3: "bg-purple-500/40 text-purple-300", // Epic
    4: "bg-yellow-500/40 text-yellow-300", // Legendary
  };

  // Wrapper props - only add data-feed-item when not skipping (parent provides it)
  const wrapperProps = skipFeedItemWrapper
    ? { className: "h-full w-full relative bg-black overflow-hidden" }
    : { "data-feed-item": true, "data-index": index, className: "h-screen w-full snap-start snap-always relative bg-black overflow-hidden" };

  // Get thumbnail for blurred background
  // Use metadata.image if available, otherwise use content itself for images
  const isImageContent = content.contentType === 8 || content.contentType === 9; // Photo, Artwork
  const thumbnailUrl = content.metadata?.image || (isImageContent && contentUrl ? contentUrl : undefined);

  return (
    <div ref={slideRef} {...wrapperProps} onClick={handleContentClick}>
      {/* Blurred thumbnail background */}
      {thumbnailUrl && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center blur scale-110"
            style={{ backgroundImage: `url(${thumbnailUrl})` }}
          />
          <div className="absolute inset-0 bg-black/60" />
        </>
      )}

      {/* Main content area - full width, sidebar overlays */}
      <div className="absolute inset-0 flex">
        <div className="flex-1 relative flex items-center justify-center">
        {showPlaceholder || !contentUrl ? (
          <div className="w-full h-full flex items-center justify-center">
            <ViewerPlaceholder contentType={content.contentType as SDKContentType | undefined} />
          </div>
        ) : (
          <ContentViewer
            contentUrl={contentUrl}
            contentCid={content.contentCid}
            contentType={content.contentType as SDKContentType | undefined}
            metadata={content.metadata ?? null}
            title={content.metadata?.title || content.metadata?.name}
            isActive={isActive}
            isBlurred={showLockedOverlay || needsSession || isInReview}
            showControls={!showLockedOverlay && !needsSession && !isInReview && showOverlay}
          />
        )}

        {showLockedOverlay && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="text-center p-8 max-w-md">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-white/10 flex items-center justify-center"><svg className="w-8 h-8 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg></div>
              <p className="text-white/60 text-sm mb-6">This content requires ownership</p>
              <div className="flex justify-center gap-3">
                {(bundleContext ? hasBundleMintConfig : hasMintConfig) && <button onClick={() => bundleContext ? setShowBuyBundleModal(true) : setShowBuyContentModal(true)} className="px-6 py-2.5 bg-white text-black rounded-full text-sm font-medium hover:bg-white/90 transition-colors">Buy {bundleContext ? (bundleMintPrice && `· ${Number(bundleMintPrice) / 1e9} SOL`) : (mintPrice && `· ${Number(mintPrice) / 1e9} SOL`)}</button>}
                {(bundleContext ? hasBundleRentConfig : hasRentConfig) && <button onClick={() => bundleContext ? setShowRentBundleModal(true) : setShowRentModal(true)} className="px-6 py-2.5 bg-white/10 text-white rounded-full text-sm font-medium hover:bg-white/20 transition-colors border border-white/20">Rent {bundleContext ? (bundleLowestRentPrice && `· ${bundleLowestRentPrice / 1e9} SOL`) : (lowestRentPrice && `· ${lowestRentPrice / 1e9} SOL`)}</button>}
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

        {isInReview && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="text-center p-8 max-w-md">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-orange-500/20 flex items-center justify-center border border-orange-500/30">
                <svg className="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-white text-lg font-medium mb-2">Content Under Review</h3>
              <p className="text-white/60 text-sm mb-6">
                This content has been challenged and is currently being reviewed by the community.
                Viewing is restricted until the dispute is resolved.
              </p>
              <a
                href="/moderation"
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-orange-500/20 text-orange-400 rounded-full text-sm font-medium hover:bg-orange-500/30 transition-colors border border-orange-500/30"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                </svg>
                Become a Juror
              </a>
            </div>
          </div>
        )}
        </div>
      </div>


      {/* Bottom Overlay */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-20 p-6 pb-20 bg-gradient-to-t from-black via-black/80 to-transparent transition-all duration-500 pointer-events-none ${showOverlay ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-white/20 to-white/5 flex items-center justify-center text-white font-medium border border-white/10">{(creatorUsername || content.creatorAddress)?.charAt(0).toUpperCase() || "?"}</div>
          <div><p className="text-white font-medium">{displayName}</p>{timeAgo && <p className="text-white/40 text-xs">{timeAgo}</p>}</div>
        </div>
        {/* Show content's collection name */}
        {content.collectionName && content.collectionName !== (content.metadata?.title || content.metadata?.name) && (
          <p className="text-white/50 text-[10px] font-medium uppercase tracking-wide mb-1">{content.collectionName}</p>
        )}
        <h2 className="text-white text-xl font-medium mb-2 line-clamp-2">{content.metadata?.title || content.metadata?.name || content.collectionName || `Content ${(content.contentCid ?? content.pubkey?.toBase58() ?? "Unknown").slice(0, 12)}...`}</h2>
        {(artist || album) && <p className="text-white/50 text-sm mb-2">{artist}{artist && album && " · "}{album}</p>}
        {content.metadata?.description && <p className="text-white/40 text-sm line-clamp-2 mb-4">{content.metadata.description}</p>}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="px-2.5 py-1 rounded-full text-xs bg-white/10 text-white/60">{domainLabel}</span>
          <span className="px-2.5 py-1 rounded-full text-xs bg-white/10 text-white/60">{contentTypeLabel}</span>
          {genre && <span className="px-2.5 py-1 rounded-full text-xs bg-white/10 text-white/60">{genre}</span>}
          {duration && duration > 0 && <span className="px-2.5 py-1 rounded-full text-xs bg-white/10 text-white/60">{formatDuration(duration)}</span>}
          {/* Access Level Badge */}
          {content.visibilityLevel !== undefined && content.visibilityLevel > 0 && (
            <span className={`px-2.5 py-1 rounded-full text-xs flex items-center gap-1.5 ${
              content.visibilityLevel === 3 /* NftOnly */
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                : content.visibilityLevel === 2 /* Subscriber */
                ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
            }`}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              {content.visibilityLevel === 3 /* NftOnly */
                ? "Buy/Rent Only"
                : content.visibilityLevel === 2 /* Subscriber */
                ? "Members Only"
                : "Subscriber Only"}
            </span>
          )}
          {/* Moderation Status Badge */}
          {content.contentCid && <ModerationBadge contentCid={content.contentCid} size="sm" />}
        </div>
        <div className="flex items-center gap-4 text-white/40 text-sm">
          {hasMintConfig && <span className="flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>{actualMintedCount} sold</span>}
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

        {/* Bundle Details Section - when viewing content in bundle context */}
        {bundleContext && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={bundleTypeIcon || ""} />
                </svg>
                <span className="text-purple-400 text-sm font-medium">{bundleTypeLabel}</span>
              </div>
              <span className="text-white/30">·</span>
              <span className="text-white/60 text-sm">{bundleContext.currentIndex + 1} of {bundleContext.items.length}</span>
            </div>
            {bundleContext.bundle.collectionName && bundleContext.bundle.collectionName !== bundleContext.metadata?.title && (
              <p className="text-white/50 text-[10px] font-medium uppercase tracking-wide">{bundleContext.bundle.collectionName}</p>
            )}
            <h3 className="text-white font-medium mb-1">{bundleContext.metadata?.title || bundleContext.bundle.collectionName || bundleContext.bundle.bundleId}</h3>
            {bundleContext.metadata?.description && (
              <p className="text-white/40 text-sm line-clamp-1 mb-2">{bundleContext.metadata.description}</p>
            )}
            <div className="flex items-center gap-4 text-white/40 text-sm">
              {hasBundleMintConfig && (
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  {bundleMintedCount} sold
                </span>
              )}
              {!isBundleCreator && ownedBundleRarities.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-white/40">Owned:</span>
                  {Object.entries(ownedBundleRarities.reduce((acc, r) => { acc[r] = (acc[r] || 0) + 1; return acc; }, {} as Record<Rarity, number>)).sort(([a], [b]) => Number(b) - Number(a)).map(([rarity, count]) => (
                    <span key={rarity} className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-medium ${rarityColors[Number(rarity) as Rarity]}`}>{count}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Multi-Bundle Indicator - only for standalone content */}
        {!bundleContext && contentBundles.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-white/40 text-xs mb-2 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Part of {contentBundles.length} {contentBundles.length === 1 ? "bundle" : "bundles"}
            </p>
            <div className="flex flex-wrap gap-2">
              {contentBundles.slice(0, 3).map((bundle) => (
                <button
                  key={bundle.bundleId}
                  onClick={(e) => { e.stopPropagation(); onNavigateToContent?.(bundle.bundleId); }}
                  className="pointer-events-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  {bundle.metadata?.name || bundle.collectionName || bundle.bundleId}
                </button>
              ))}
              {contentBundles.length > 3 && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-white/10 text-white/60">
                  +{contentBundles.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right Actions - shift when bundle sidebar opens */}
      <div className={`absolute bottom-6 z-40 flex flex-col items-center gap-4 transition-all duration-300 ${showBundleSidebar ? "right-[340px]" : "right-4"} ${showOverlay ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4 pointer-events-none"}`} onClick={(e) => e.stopPropagation()}>
        {/* Bundle Sidebar Toggle */}
        {bundleContext && bundleContext.items.length > 0 && (
          <button
            onClick={() => setShowBundleSidebar(prev => !prev)}
            className={`w-12 h-12 rounded-full backdrop-blur-sm flex items-center justify-center text-white transition-colors border border-white/10 ${showBundleSidebar ? "bg-purple-500/30 border-purple-500/50" : "bg-white/10 hover:bg-white/20"}`}
            title="View Playlist"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
        )}
        {/* Bundle Buy/Rent buttons (when viewing bundle) */}
        {bundleContext && !isBundleCreator && hasBundleMintConfig && (
          <button onClick={() => setShowBuyBundleModal(true)} className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors border border-white/10" title={`Buy Bundle · ${Number(bundleMintPrice) / 1e9} SOL`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
          </button>
        )}
        {bundleContext && !isBundleCreator && hasBundleRentConfig && (
          <button onClick={() => setShowRentBundleModal(true)} className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors border border-white/10" title={`Rent Bundle · ${bundleLowestRentPrice! / 1e9} SOL`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </button>
        )}
        {/* Content Buy/Rent buttons (when viewing standalone content) */}
        {!bundleContext && !isCreator && hasMintConfig && <button onClick={() => setShowBuyContentModal(true)} className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors border border-white/10" title="Buy NFT"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg></button>}
        {!bundleContext && !isCreator && hasRentConfig && <button onClick={() => setShowRentModal(true)} className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors border border-white/10" title={activeRental ? "Extend" : "Rent"}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></button>}
        {!bundleContext && !isCreator && ownedNftCount > 0 && <button onClick={() => setShowSellModal(true)} className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors border border-white/10" title="Sell NFT"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></button>}
        <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/content/${content.contentCid}`).then(() => { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }); }} className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors border border-white/10" title="Share">
          {showCopied ? <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" /></svg> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>}
        </button>
        {/* Report button - for non-creators */}
        {!isCreator && !bundleContext && content.contentCid && (
          <button
            onClick={() => setShowReportModal(true)}
            className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white/60 hover:text-red-400 hover:bg-red-500/10 transition-colors border border-white/10"
            title="Report Content"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
            </svg>
          </button>
        )}
        {isCreator && !bundleContext && (
          <>
            <button onClick={() => setShowEditModal(true)} disabled={!canEdit} className={`w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center transition-colors border border-white/10 ${canEdit ? "text-white hover:bg-white/20" : "text-white/30 cursor-not-allowed"}`} title={canEdit ? "Edit" : "Locked"}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
            <button onClick={() => setShowDeleteModal(true)} disabled={!canDelete} className={`w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center transition-colors border border-white/10 ${canDelete ? "text-red-400 hover:bg-red-500/20" : "text-white/30 cursor-not-allowed"}`} title={canDelete ? "Delete" : "Locked"}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
          </>
        )}
      </div>

      {/* Bundle Sidebar - hidden/shown with overlay */}
      {bundleContext && (
        <div
          className={`absolute top-0 right-0 h-full w-80 bg-black/95 backdrop-blur-xl border-l border-white/10 transform transition-all duration-300 z-30 ${showBundleSidebar && showOverlay ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 pointer-events-none"}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Sidebar Header */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between mb-2">
              <div className="min-w-0 flex-1">
                {bundleContext.bundle.collectionName && bundleContext.bundle.collectionName !== bundleContext.metadata?.title && (
                  <p className="text-white/50 text-[10px] font-medium uppercase tracking-wide truncate">{bundleContext.bundle.collectionName}</p>
                )}
                <h3 className="text-white font-medium truncate">{bundleContext.metadata?.title || bundleContext.bundle.collectionName || bundleContext.bundle.bundleId}</h3>
              </div>
              <button onClick={() => setShowBundleSidebar(false)} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
                <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-white/40 text-xs">{bundleTypeLabel} · {bundleContext.items.length} items</p>
          </div>

          {/* Items List */}
          <div className="overflow-y-auto h-[calc(100%-80px)]" style={{ scrollbarWidth: "thin" }}>
            {bundleContext.isLoadingItems ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-white/20 border-t-purple-400 rounded-full animate-spin" />
              </div>
            ) : bundleContext.items.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-white/40 text-sm">No items found</div>
            ) : (
              <div className="py-2">
                {bundleContext.items.map((item, idx) => (
                  <button
                    key={item.contentCid}
                    onClick={() => bundleContext.onNavigate(idx)}
                    className={`w-full px-4 py-3 flex items-center gap-3 transition-colors ${
                      idx === bundleContext.currentIndex ? "bg-purple-500/20 border-l-2 border-purple-400" : "hover:bg-white/5 border-l-2 border-transparent"
                    }`}
                  >
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      idx === bundleContext.currentIndex ? "bg-purple-500 text-white" : "bg-white/10 text-white/60"
                    }`}>{idx + 1}</span>
                    <div className="w-10 h-10 rounded bg-white/5 flex-shrink-0 overflow-hidden">
                      {item.thumbnail ? (
                        <img src={getIpfsUrl(item.thumbnail)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      {item.collectionName && item.collectionName !== item.title && (
                        <p className="text-white/50 text-[10px] font-medium uppercase tracking-wide truncate">{item.collectionName}</p>
                      )}
                      <span className={`text-sm truncate block ${idx === bundleContext.currentIndex ? "text-white" : "text-white/70"}`}>{item.title}</span>
                    </div>
                    {idx === bundleContext.currentIndex && (
                      <div className="flex gap-0.5">
                        <div className="w-0.5 h-3 bg-purple-400 rounded-full animate-pulse" />
                        <div className="w-0.5 h-3 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: "150ms" }} />
                        <div className="w-0.5 h-3 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: "300ms" }} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content Modals */}
      {showBuyContentModal && mintConfig && content.contentCid && <BuyContentModal isOpen={showBuyContentModal} onClose={() => setShowBuyContentModal(false)} contentCid={content.contentCid} contentTitle={content.metadata?.title || content.metadata?.name} creator={content.creator} mintConfig={mintConfig} mintedCount={BigInt(actualMintedCount)} ownedCount={ownedNftCount} onSuccess={() => { refetchMintConfig(); refetchOwnership(); }} />}
      {showEditModal && <EditContentModal isOpen={showEditModal} onClose={() => setShowEditModal(false)} content={content} />}
      {showDeleteModal && content.contentCid && <DeleteContentModal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} contentCid={content.contentCid} contentTitle={content.metadata?.title || content.metadata?.name} hasMintConfig={!!mintConfig} />}
      {showRentModal && rentConfig && content.contentCid && <RentContentModal isOpen={showRentModal} onClose={() => setShowRentModal(false)} contentCid={content.contentCid} contentTitle={content.metadata?.title || content.metadata?.name} creator={content.creator} rentConfig={rentConfig} activeRental={activeRental} onSuccess={() => { refetchRentConfig(); refetchOwnership(); refetchActiveRental(); }} onBuyClick={mintConfig ? () => setShowBuyContentModal(true) : undefined} />}
      {showSellModal && content.contentCid && <SellNftModal isOpen={showSellModal} onClose={() => setShowSellModal(false)} contentCid={content.contentCid} contentTitle={content.metadata?.title || content.metadata?.name} ownedCount={ownedNftCount} userNfts={walletNfts} />}
      {showReportModal && content.contentCid && <ReportDialog isOpen={showReportModal} onClose={() => setShowReportModal(false)} contentCid={content.contentCid} contentTitle={content.metadata?.title || content.metadata?.name} />}

      {/* Bundle Modals */}
      {showBuyBundleModal && bundleContext && bundleMintConfig && (
        <BuyBundleModal
          isOpen={showBuyBundleModal}
          onClose={() => setShowBuyBundleModal(false)}
          bundleId={bundleContext.bundle.bundleId}
          bundleName={bundleContext.metadata?.title}
          creator={bundleContext.bundle.creator}
          mintConfig={bundleMintConfig}
          mintedCount={bundleContext.bundle.mintedCount}
          ownedCount={ownedBundleNfts.length}
          onSuccess={() => { refetchBundleMintConfig(); }}
        />
      )}
      {showRentBundleModal && bundleContext && bundleRentConfig && (
        <RentBundleModal
          isOpen={showRentBundleModal}
          onClose={() => setShowRentBundleModal(false)}
          bundleId={bundleContext.bundle.bundleId}
          bundleName={bundleContext.metadata?.title}
          creator={bundleContext.bundle.creator}
          rentConfig={bundleRentConfig}
          onSuccess={() => { refetchBundleRentConfig(); }}
          onBuyClick={hasBundleMintConfig ? () => { setShowRentBundleModal(false); setShowBuyBundleModal(true); } : undefined}
        />
      )}
    </div>
  );
}

// ============== BUNDLE FEED ITEM (wrapper for bundles using ContentSlide) ==============
interface BundleFeedItemProps {
  bundle: EnrichedBundle;
  metadata?: { title?: string; description?: string; image?: string; tags?: string[] };
  index: number;
  isActive: boolean;
  // For deep links: which item to start at (1-indexed)
  initialPosition?: number;
  // Navigation callback for in-feed navigation
  onNavigateToContent?: (cid: string) => void;
  // Callback when overlay visibility changes
  onOverlayChange?: (visible: boolean) => void;
  // Enriched bundles for "part of bundle" display in content slides
  enrichedBundles?: EnrichedBundle[];
}

function BundleFeedItem({ bundle, metadata, index, isActive, initialPosition = 1, onNavigateToContent, onOverlayChange, enrichedBundles = [] }: BundleFeedItemProps) {
  const [currentItemIndex, setCurrentItemIndex] = useState(Math.max(0, initialPosition - 1));
  const [bundleItems, setBundleItems] = useState<BundleItemDisplay[]>([]);
  const [itemContents, setItemContents] = useState<Map<string, EnrichedContent>>(new Map());
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const { client } = useContentRegistry();

  // Notify parent when bundle becomes active (reset overlay to visible)
  useEffect(() => {
    if (isActive) {
      onOverlayChange?.(true);
    }
  }, [isActive, onOverlayChange]);

  // Fetch bundle items when slide becomes active
  useEffect(() => {
    if (!isActive || !client || bundleItems.length > 0) return;

    async function fetchItems() {
      setIsLoadingItems(true);
      try {
        const bundleWithItems = await client!.fetchBundleWithItems(bundle.creator, bundle.bundleId);
        if (bundleWithItems?.items) {
          const contentsMap = new Map<string, EnrichedContent>();

          // Fetch metadata from IPFS for each item
          const itemsWithMetadata = await Promise.all(
            bundleWithItems.items
              .sort((a, b) => a.item.position - b.item.position)
              .map(async (item) => {
                let meta: Record<string, unknown> | undefined;

                // Fetch metadata from IPFS if content has metadataCid
                if (item.content?.metadataCid) {
                  try {
                    const metadataUrl = getIpfsUrl(item.content.metadataCid);
                    const res = await fetch(metadataUrl);
                    if (res.ok) {
                      meta = await res.json();
                    }
                  } catch (e) {
                    console.error("Failed to fetch content metadata:", e);
                  }
                }

                return { item: item.item, content: item.content, meta };
              })
          );

          const items: BundleItemDisplay[] = itemsWithMetadata
            .map(({ item, content, meta }) => {
              const context = meta?.context as Record<string, unknown> | undefined;
              const itemTitle = (meta?.title as string) || (meta?.name as string) || `Item ${item.position + 1}`;

              // Store the full content entry with enriched metadata
              if (content) {
                const enrichedMetadata = {
                  ...(meta || {}),
                  title: itemTitle,
                  name: itemTitle,
                  description: meta?.description as string | undefined,
                  context: context,
                  artist: (context?.artist as string) || (meta?.artist as string),
                  album: (context?.album as string) || (meta?.album as string),
                };
                const enriched: EnrichedContent = {
                  ...content,
                  metadata: enrichedMetadata as EnrichedContent["metadata"],
                  creatorAddress: content.creator.toBase58(),
                  mintConfig: null,
                };
                const contentKey = content.contentCid ?? content.pubkey?.toBase58() ?? "";
                if (contentKey) contentsMap.set(contentKey, enriched);
              }

              return {
                contentCid: content?.contentCid || "",
                collectionName: content?.collectionName,
                title: itemTitle,
                description: meta?.description as string | undefined,
                previewCid: content?.previewCid,
                thumbnail: meta?.image as string | undefined,
                position: item.position,
                contentType: content?.contentType,
                isEncrypted: content?.isEncrypted,
                artist: (context?.artist as string) || (meta?.artist as string),
                album: (context?.album as string) || (meta?.album as string),
                duration: context?.duration as number | undefined,
              };
            })
            .filter(item => item.contentCid);
          setBundleItems(items);
          setItemContents(contentsMap);
        }
      } catch (err) {
        console.error("Failed to fetch bundle items:", err);
      } finally {
        setIsLoadingItems(false);
      }
    }

    fetchItems();
  }, [isActive, client, bundle.creator, bundle.bundleId, bundleItems.length]);

  const navigateToItem = useCallback((idx: number) => {
    setCurrentItemIndex(idx);
    // Update URL without navigation
    const newUrl = idx === 0 ? `/content/${bundle.bundleId}` : `/content/${bundle.bundleId}/${idx + 1}`;
    window.history.replaceState({}, "", newUrl);
  }, [bundle.bundleId]);

  const currentItem = bundleItems[currentItemIndex];
  const currentContent = currentItem ? itemContents.get(currentItem.contentCid) : null;

  // Create bundle context for ContentSlide
  const bundleContext: BundleContextProps = {
    bundle,
    metadata,
    items: bundleItems,
    currentIndex: currentItemIndex,
    onNavigate: navigateToItem,
    isLoadingItems,
  };

  const bundleTypeLabel = getBundleTypeLabel(bundle.bundleType);

  // Always render a stable wrapper with data-feed-item so IntersectionObserver can track it
  // This fixes the issue where switching from loading to content changes the DOM element
  return (
    <div
      data-feed-item
      data-index={index}
      className="h-screen w-full snap-start snap-always relative"
    >
      {!currentContent ? (
        // Loading state
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="text-center">
            <div className="w-12 h-12 border-2 border-purple-400/20 border-t-purple-400 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white/40 text-sm">Loading {bundleTypeLabel}...</p>
          </div>
        </div>
      ) : (
        // Content loaded - render ContentSlide without its own data-feed-item wrapper
        <ContentSlide
          content={currentContent}
          index={index}
          isActive={isActive}
          bundleContext={bundleContext}
          onNavigateToContent={onNavigateToContent}
          onOverlayChange={onOverlayChange}
          skipFeedItemWrapper
          enrichedBundles={enrichedBundles}
        />
      )}
    </div>
  );
}

// ============== BUNDLE TYPE HELPERS ==============
function getBundleTypeLabel(bundleType: BundleType): string {
  switch (bundleType) {
    case 0: return "Album";
    case 1: return "Series";
    case 2: return "Playlist";
    case 3: return "Course";
    case 4: return "Newsletter";
    case 5: return "Collection";
    case 6: return "Pack";
    default: return "Bundle";
  }
}

function getBundleTypeIcon(bundleType: BundleType): string {
  switch (bundleType) {
    case 0: return "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"; // Album
    case 1: return "M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"; // Series
    case 2: return "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"; // Playlist
    case 3: return "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"; // Course
    case 4: return "M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"; // Newsletter
    case 5: return "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"; // Collection
    case 6: return "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"; // ProductPack
    default: return "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10";
  }
}

