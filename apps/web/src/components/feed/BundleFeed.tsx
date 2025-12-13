"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import Link from "next/link";
import { useContentRegistry, Bundle, Rarity } from "@/hooks/useContentRegistry";
import { getIpfsUrl, getBundleTypeLabel, BundleType, getBundlePda } from "@handcraft/sdk";
import { BuyBundleModal, RentBundleModal } from "@/components/bundle";

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

const ITEMS_PER_PAGE = 10;

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

// Generate consistent hash for an item based on seed + item ID
function getItemHash(seed: number, itemId: string): number {
  let hash = seed;
  for (let i = 0; i < itemId.length; i++) {
    hash = ((hash << 5) - hash + itemId.charCodeAt(i)) | 0;
  }
  return hash;
}

// Parse filter from URL param
function parseFilter(param: string | null): BundleTypeFilter {
  if (!param || param === "all") return "all";
  const num = Number(param);
  if (!isNaN(num) && Object.values(BundleType).includes(num)) {
    return num as BundleType;
  }
  return "all";
}

// Parse sort type from URL param
function parseSortType(param: string | null): SortType {
  if (param && ["date", "minted", "items", "price", "random"].includes(param)) {
    return param as SortType;
  }
  return "date";
}

// Parse sort direction from URL param
function parseSortDir(param: string | null): SortDirection {
  if (param === "asc") return "asc";
  return "desc";
}

export function BundleFeed() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Read from URL params
  const typeFilter = parseFilter(searchParams.get("filter"));
  const sortType = parseSortType(searchParams.get("sort"));
  const sortDir = parseSortDir(searchParams.get("dir"));

  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [randomSeed] = useState(() => Date.now()); // Consistent seed for session
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE); // For infinite scroll
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const {
    globalBundles,
    isLoadingGlobalBundles,
    client,
    allBundleMintConfigs,
  } = useContentRegistry();

  // Helper to get price from bundle mint config
  const getPrice = useCallback((bundle: Bundle): bigint => {
    if (!allBundleMintConfigs) return BigInt(0);
    const [bundlePda] = getBundlePda(bundle.creator, bundle.bundleId);
    const config = allBundleMintConfigs.get(bundlePda.toBase58());
    return config?.price ?? BigInt(0);
  }, [allBundleMintConfigs]);

  // Update URL params
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
      // Clear dir when switching to random
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

  const setTypeFilter = useCallback((filter: BundleTypeFilter) => {
    setVisibleCount(ITEMS_PER_PAGE); // Reset on filter change
    updateParams({ filter: String(filter) });
  }, [updateParams]);

  const setSortType = useCallback((sort: SortType) => {
    setVisibleCount(ITEMS_PER_PAGE); // Reset on sort change
    updateParams({ sort });
  }, [updateParams]);

  const toggleSortDir = useCallback(() => {
    setVisibleCount(ITEMS_PER_PAGE); // Reset on sort change
    updateParams({ dir: sortDir === "desc" ? "asc" : "desc" });
  }, [updateParams, sortDir]);

  // Enriched bundles state
  const [enrichedGlobalBundles, setEnrichedGlobalBundles] = useState<EnrichedBundle[]>([]);
  const [isEnrichingGlobal, setIsEnrichingGlobal] = useState(false);

  const lastGlobalFetchRef = useRef<string>("");

  // Enrich global bundles with metadata
  useEffect(() => {
    const bundleKey = globalBundles.map(b => b.bundleId).join(",");
    if (bundleKey === lastGlobalFetchRef.current || !bundleKey) return;
    lastGlobalFetchRef.current = bundleKey;

    async function enrichBundles() {
      setIsEnrichingGlobal(true);
      try {
        const enriched = await Promise.all(
          globalBundles.map(async (bundle) => {
            const creatorAddress = bundle.creator.toBase58();
            try {
              const metadataUrl = getIpfsUrl(bundle.metadataCid);
              const res = await fetch(metadataUrl);
              const metadata = await res.json();
              return {
                ...bundle,
                metadata,
                creatorAddress,
              };
            } catch {
              return {
                ...bundle,
                creatorAddress,
              };
            }
          })
        );
        setEnrichedGlobalBundles(enriched);
      } catch (err) {
        console.error("Error enriching global bundles:", err);
      } finally {
        setIsEnrichingGlobal(false);
      }
    }

    enrichBundles();
  }, [globalBundles]);

  const isLoading = !client || isLoadingGlobalBundles || isEnrichingGlobal;
  const baseBundles = enrichedGlobalBundles;

  // Apply type filter, sort, and infinite scroll slicing
  const { displayBundles, totalItems, hasMore } = useMemo(() => {
    // Filter
    const filtered = typeFilter === "all"
      ? baseBundles
      : baseBundles.filter(bundle => bundle.bundleType === typeFilter);

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortType) {
        case "minted":
          return dir * (Number(a.mintedCount ?? 0) - Number(b.mintedCount ?? 0));
        case "items":
          return dir * (Number(a.itemCount ?? 0) - Number(b.itemCount ?? 0));
        case "price": {
          const priceA = getPrice(a);
          const priceB = getPrice(b);
          return dir * Number(priceA - priceB);
        }
        case "random":
          // Use consistent hash per item for stable random order
          return getItemHash(randomSeed, a.bundleId) - getItemHash(randomSeed, b.bundleId);
        case "date":
        default:
          return dir * (Number(a.createdAt) - Number(b.createdAt));
      }
    });

    // Infinite scroll - show items up to visibleCount
    const totalItems = sorted.length;
    const displayed = sorted.slice(0, visibleCount);
    const hasMore = visibleCount < totalItems;

    return { displayBundles: displayed, totalItems, hasMore };
  }, [baseBundles, typeFilter, sortType, sortDir, visibleCount, randomSeed, getPrice]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          setVisibleCount(prev => prev + ITEMS_PER_PAGE);
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading]);

  return (
    <div className="pb-20">
      {/* Type Filter & Sort */}
      <div className="sticky top-[57px] z-30 bg-black/95 backdrop-blur-sm border-b border-gray-800">
        <div className="flex flex-wrap justify-center items-center gap-1.5 px-4 py-3">
          {/* Sort Type Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              </svg>
              {SORT_TYPES.find(s => s.value === sortType)?.label}
              <svg className={`w-3 h-3 transition-transform ${showSortDropdown ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showSortDropdown && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowSortDropdown(false)}
                />
                <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 min-w-[100px] overflow-hidden">
                  {SORT_TYPES.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setSortType(option.value);
                        setShowSortDropdown(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-xs transition-colors ${
                        sortType === option.value
                          ? "bg-secondary-500/20 text-secondary-400"
                          : "text-gray-300 hover:bg-gray-800"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {/* Sort Direction Toggle - hidden for random */}
          {sortType !== "random" && (
            <button
              onClick={toggleSortDir}
              className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
              title={sortDir === "desc" ? "Descending (newest/most first)" : "Ascending (oldest/least first)"}
            >
              {sortDir === "desc" ? (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              )}
            </button>
          )}
          {/* Divider */}
          <div className="w-px h-4 bg-gray-700 mx-1" />
          {/* Type Filters */}
          {BUNDLE_TYPE_FILTERS.map((filter) => (
            <button
              key={String(filter.value)}
              onClick={() => setTypeFilter(filter.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                typeFilter === filter.value
                  ? "bg-secondary-500 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Feed Content */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {isLoading ? (
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-900 rounded-xl p-4 animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gray-800 rounded-full" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-800 rounded w-24 mb-2" />
                    <div className="h-3 bg-gray-800 rounded w-16" />
                  </div>
                </div>
                <div className="aspect-video bg-gray-800 rounded-lg" />
              </div>
            ))}
          </div>
        ) : displayBundles.length > 0 ? (
          <>
            {displayBundles.map((bundle) => (
              <BundleCard key={`${bundle.creatorAddress}-${bundle.bundleId}`} bundle={bundle} />
            ))}

            {/* Infinite scroll sentinel */}
            <div ref={loadMoreRef} className="h-10 flex items-center justify-center">
              {hasMore && (
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Loading more...
                </div>
              )}
            </div>
          </>
        ) : (
          <EmptyBundleState
            hasFilter={typeFilter !== "all"}
            onClearFilter={() => setTypeFilter("all")}
          />
        )}
      </div>
    </div>
  );
}

function BundleCard({ bundle }: { bundle: EnrichedBundle }) {
  const { publicKey } = useWallet();
  const { useBundleMintConfig, useBundleRentConfig, walletBundleNfts, bundleNftRarities } = useContentRegistry();

  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showRentModal, setShowRentModal] = useState(false);
  const [showCopied, setShowCopied] = useState(false);

  const mintConfigQuery = useBundleMintConfig(bundle.creator, bundle.bundleId);
  const rentConfigQuery = useBundleRentConfig(bundle.creator, bundle.bundleId);

  const mintConfig = mintConfigQuery.data;
  const rentConfig = rentConfigQuery.data;
  const isLoadingConfig = mintConfigQuery.isLoading || rentConfigQuery.isLoading;

  const isCreator = publicKey?.toBase58() === bundle.creatorAddress;
  const hasMintConfig = mintConfig && mintConfig.isActive;
  const hasRentConfig = rentConfig && rentConfig.isActive;

  // Get owned NFTs for this bundle from cached wallet bundle NFTs
  const ownedNftsForBundle = walletBundleNfts.filter(nft =>
    nft.bundleId === bundle.bundleId &&
    nft.creator?.toBase58() === bundle.creatorAddress
  );
  const ownedNftCount = ownedNftsForBundle.length;
  const ownsNft = ownedNftCount > 0;

  // Get rarities for owned NFTs of this bundle
  const ownedRarities: Rarity[] = ownedNftsForBundle
    .map(nft => bundleNftRarities.get(nft.nftAsset.toBase58()))
    .filter((r): r is Rarity => r !== undefined);

  const shortAddress = bundle.creatorAddress
    ? `${bundle.creatorAddress.slice(0, 4)}...${bundle.creatorAddress.slice(-4)}`
    : "Unknown";

  const bundleTypeLabel = getBundleTypeLabel(bundle.bundleType);
  const timeAgo = getTimeAgo(Number(bundle.createdAt) * 1000);
  const coverImage = bundle.metadata?.image ? getIpfsUrl(bundle.metadata.image.replace("https://ipfs.io/ipfs/", "")) : null;
  const mintedCount = Number(bundle.mintedCount ?? 0);

  return (
    <article className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800 hover:border-gray-700 transition-colors">
      {/* Creator Info */}
      <div className="flex items-center gap-3 p-4">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary-500 to-primary-500 flex items-center justify-center text-white font-bold">
          {bundle.creatorAddress?.charAt(0).toUpperCase() || "?"}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{shortAddress}</span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-green-500/20 text-green-400">
              On-chain
            </span>
          </div>
          <span className="text-xs text-gray-500">{timeAgo}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-secondary-400 bg-secondary-500/10 px-2 py-1 rounded-full">
            {bundleTypeLabel}
          </span>
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-full">
            {bundle.itemCount} items
          </span>
          {bundle.isLocked && (
            <span className="text-xs text-amber-500 bg-amber-500/20 px-2 py-1 rounded-full flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Locked
            </span>
          )}
        </div>
      </div>

      {/* Bundle Cover */}
      <Link href={`/bundle/${bundle.creatorAddress}/${bundle.bundleId}`}>
        <div className="relative aspect-video bg-gradient-to-br from-secondary-900/50 to-primary-900/50 cursor-pointer hover:opacity-90 transition-opacity">
          {coverImage ? (
            <img
              src={coverImage}
              alt={bundle.metadata?.name || bundle.bundleId}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-20 h-20 text-secondary-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          )}
        </div>
      </Link>

      {/* Title & Description */}
      <div className="px-4 py-3">
        <Link href={`/bundle/${bundle.creatorAddress}/${bundle.bundleId}`}>
          <h2 className="font-medium line-clamp-2 hover:text-primary-400 transition-colors cursor-pointer">
            {bundle.metadata?.name || bundle.bundleId}
          </h2>
        </Link>
        {bundle.metadata?.description && (
          <p className="text-sm text-gray-400 mt-1 line-clamp-2">
            {bundle.metadata.description}
          </p>
        )}
      </div>

      {/* Stats & Actions */}
      <div className="flex items-center gap-4 px-4 py-3 border-t border-gray-800">
        {isLoadingConfig ? (
          <>
            <div className="h-4 w-20 bg-gray-800 rounded animate-pulse" />
            <div className="ml-auto flex items-center gap-2">
              <div className="h-8 w-16 bg-gray-800 rounded-full animate-pulse" />
            </div>
          </>
        ) : (
          <>
            {/* Minted Count */}
            {hasMintConfig && (
              <div className="flex items-center gap-2 text-gray-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span className="text-sm">{mintedCount}</span>
              </div>
            )}

            {/* Owned NFTs by Rarity - show count in colored bubble */}
            {!isCreator && ownedNftCount > 0 && ownedRarities.length > 0 && (
              <div className="flex items-center gap-1.5">
                {(() => {
                  // Group rarities by count
                  const rarityCounts = ownedRarities.reduce((acc, rarity) => {
                    acc[rarity] = (acc[rarity] || 0) + 1;
                    return acc;
                  }, {} as Record<Rarity, number>);

                  // Sort by rarity (highest first)
                  const sortedRarities = Object.entries(rarityCounts)
                    .map(([r, count]) => ({ rarity: Number(r) as Rarity, count }))
                    .sort((a, b) => b.rarity - a.rarity);

                  // Rarity colors for bubbles
                  const rarityColors: Record<Rarity, string> = {
                    [Rarity.Common]: "bg-gray-500/30 text-gray-300",
                    [Rarity.Uncommon]: "bg-green-500/30 text-green-400",
                    [Rarity.Rare]: "bg-blue-500/30 text-blue-400",
                    [Rarity.Epic]: "bg-purple-500/30 text-purple-400",
                    [Rarity.Legendary]: "bg-yellow-500/30 text-yellow-400",
                  };

                  return sortedRarities.map(({ rarity, count }) => (
                    <span
                      key={rarity}
                      className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-medium ${rarityColors[rarity]}`}
                      title={`${count} ${Rarity[rarity]}`}
                    >
                      {count}
                    </span>
                  ));
                })()}
              </div>
            )}

            <div className="ml-auto flex items-center gap-2">
              {/* Price Display */}
              {hasMintConfig && mintConfig && (
                <span className="text-sm text-primary-400 font-medium">
                  {(Number(mintConfig.price) / LAMPORTS_PER_SOL).toFixed(2)} SOL
                </span>
              )}

              {/* Buy Button - for non-creators when mint config exists */}
              {!isCreator && hasMintConfig && mintConfig && (
                <button
                  onClick={() => setShowBuyModal(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-primary-500/10 hover:bg-primary-500/20 text-primary-400 rounded-full transition-colors text-sm font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Buy
                </button>
              )}

              {/* Rent Button - for non-creators when rent config exists */}
              {!isCreator && hasRentConfig && rentConfig && (
                <button
                  onClick={() => setShowRentModal(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-full transition-colors text-sm font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Rent
                </button>
              )}

              {/* View Button */}
              <Link href={`/bundle/${bundle.creatorAddress}/${bundle.bundleId}`}>
                <button className="flex items-center gap-2 px-3 py-1.5 bg-secondary-500/10 hover:bg-secondary-500/20 text-secondary-400 rounded-full transition-colors text-sm font-medium">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  View
                </button>
              </Link>

              {/* Share/Copy Link Button */}
              <button
                onClick={() => {
                  const url = `${window.location.origin}/bundle/${bundle.creatorAddress}/${bundle.bundleId}`;
                  navigator.clipboard.writeText(url).then(() => {
                    setShowCopied(true);
                    setTimeout(() => setShowCopied(false), 2000);
                  });
                }}
                className="flex items-center gap-1.5 p-1.5 text-gray-400 hover:text-gray-300 hover:bg-gray-800 rounded-full transition-colors"
                title="Copy share link"
              >
                {showCopied ? (
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                )}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Buy Bundle Modal */}
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
          onSuccess={() => {
            mintConfigQuery.refetch();
          }}
        />
      )}

      {/* Rent Bundle Modal */}
      {showRentModal && rentConfig && (
        <RentBundleModal
          isOpen={showRentModal}
          onClose={() => setShowRentModal(false)}
          bundleId={bundle.bundleId}
          bundleName={bundle.metadata?.name}
          creator={bundle.creator}
          rentConfig={rentConfig}
          onSuccess={() => {
            rentConfigQuery.refetch();
          }}
          onBuyClick={hasMintConfig ? () => setShowBuyModal(true) : undefined}
        />
      )}

    </article>
  );
}

function EmptyBundleState({
  hasFilter,
  onClearFilter,
}: {
  hasFilter: boolean;
  onClearFilter: () => void;
}) {
  return (
    <div className="text-center py-16">
      <svg
        className="w-16 h-16 mx-auto text-gray-600 mb-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
        />
      </svg>
      <h3 className="text-lg font-medium text-gray-400 mb-2">
        {hasFilter ? "No bundles match this filter" : "No bundles yet"}
      </h3>
      <p className="text-gray-500 text-sm">
        {hasFilter ? (
          <button
            onClick={onClearFilter}
            className="text-secondary-400 hover:text-secondary-300 underline"
          >
            Clear filter to see all bundles
          </button>
        ) : (
          "Be the first to create a bundle!"
        )}
      </p>
    </div>
  );
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
