"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useContentRegistry } from "@/hooks/useContentRegistry";
import { getIpfsUrl, getContentTypeLabel, getBundleTypeLabel, ContentType, BundleType } from "@handcraft/sdk";
import { SidebarPanel } from "@/components/sidebar";

const SEARCH_HISTORY_KEY = "handcraft-search-history";
const MAX_HISTORY = 10;

type SearchTab = "all" | "content" | "bundles" | "creators";

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
  // Optional metadata fields - populated from Metaplex collection or database
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
  // Optional metadata fields - populated from Metaplex collection or database
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

  useEffect(() => {
    if (!globalContent.length && !globalBundles.length) return;

    async function enrichData() {
      setIsEnriching(true);

      // Fetch metadata from IPFS using metadataCid (populated by SDK enrichment)
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

      // Fetch bundle metadata from IPFS using metadataCid
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

    const matchedContent = enrichedContent.filter((item) => {
      // Hide content that is under review or dismissed
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

    const matchedBundles = enrichedBundles.filter((bundle) => {
      const name = bundle.metadata?.name?.toLowerCase() || "";
      const description = bundle.metadata?.description?.toLowerCase() || "";
      const creator = bundle.creator.toLowerCase();

      return (
        name.includes(lowerQuery) ||
        description.includes(lowerQuery) ||
        creator.includes(lowerQuery)
      );
    });

    const creatorSet = new Set<string>();
    matchedContent.forEach((c) => creatorSet.add(c.creator));
    matchedBundles.forEach((b) => creatorSet.add(b.creator));
    enrichedContent.forEach((c) => {
      if (c.creator.toLowerCase().includes(lowerQuery)) {
        creatorSet.add(c.creator);
      }
    });

    return {
      content: matchedContent,
      bundles: matchedBundles,
      creators: Array.from(creatorSet),
    };
  }, [query, enrichedContent, enrichedBundles]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (localQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(localQuery.trim())}`);
    }
  };

  const isLoading = isLoadingGlobalContent || isEnriching;
  const totalResults = searchResults.content.length + searchResults.bundles.length + searchResults.creators.length;

  return (
    <div className="min-h-screen bg-black text-white">
      <SidebarPanel isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Menu Button */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className={`fixed top-4 z-50 p-3 bg-white/5 backdrop-blur-md rounded-full border border-white/10 hover:border-white/20 transition-all duration-300 ${isSidebarOpen ? 'left-[304px]' : 'left-4'}`}
      >
        <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Search Header */}
      <div className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <form onSubmit={handleSearch} className="mb-5">
            <div className="relative">
              <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={localQuery}
                onChange={(e) => setLocalQuery(e.target.value)}
                placeholder="Search content, bundles, creators..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl pl-14 pr-14 py-4 text-base placeholder:text-white/30 focus:outline-none focus:border-white/20 focus:bg-white/[0.07] transition-all"
                autoFocus
              />
              <button
                type="submit"
                className="absolute inset-y-2 right-2 px-5 bg-white/10 hover:bg-white/20 rounded-xl transition-colors flex items-center justify-center"
              >
                <span className="text-sm font-medium text-white/70">Search</span>
              </button>
            </div>
          </form>

          {/* Tabs */}
          {query && (
            <div className="flex gap-2">
              {(["all", "content", "bundles", "creators"] as SearchTab[]).map((tab) => {
                const count =
                  tab === "all" ? totalResults :
                  tab === "content" ? searchResults.content.length :
                  tab === "bundles" ? searchResults.bundles.length :
                  searchResults.creators.length;

                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                      activeTab === tab
                        ? "bg-white text-black"
                        : "bg-white/5 text-white/50 hover:text-white/70 hover:bg-white/10"
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    <span className="ml-1.5 opacity-60">({count})</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="max-w-3xl mx-auto px-6 py-8">
        {!query ? (
          /* No query - show search history */
          <div>
            {history.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-sm text-white/40 uppercase tracking-wider">Recent Searches</h2>
                  <button
                    onClick={clearHistory}
                    className="text-sm text-white/30 hover:text-white/50 transition-colors"
                  >
                    Clear all
                  </button>
                </div>
                <div className="space-y-2">
                  {history.map((q, i) => (
                    <Link
                      key={i}
                      href={`/search?q=${encodeURIComponent(q)}`}
                      className="group flex items-center gap-4 px-5 py-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all"
                    >
                      <svg className="w-4 h-4 text-white/20 group-hover:text-white/40 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-white/70 group-hover:text-white/90 transition-colors">{q}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {history.length === 0 && (
              <div className="text-center py-20">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-white/60 mb-2">Search for content</h3>
                <p className="text-white/30">Find videos, music, bundles, and creators</p>
              </div>
            )}
          </div>
        ) : isLoading ? (
          /* Loading */
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4 p-5 rounded-xl bg-white/[0.02] border border-white/5 animate-pulse">
                <div className="w-16 h-16 bg-white/5 rounded-lg" />
                <div className="flex-1 space-y-3">
                  <div className="h-4 bg-white/5 rounded w-3/4" />
                  <div className="h-3 bg-white/5 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : totalResults === 0 ? (
          /* No results */
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-white/60 mb-2">No results found</h3>
            <p className="text-white/30">Try a different search term</p>
          </div>
        ) : (
          /* Results */
          <div className="space-y-8">
            {/* Content Results */}
            {(activeTab === "all" || activeTab === "content") && searchResults.content.length > 0 && (
              <div>
                {activeTab === "all" && (
                  <h2 className="text-sm text-white/40 uppercase tracking-wider mb-4">Content</h2>
                )}
                <div className="space-y-2">
                  {searchResults.content.map((item) => (
                    <ContentResultCard key={item.contentCid} content={item} getCreatorUsername={getCreatorUsername} />
                  ))}
                </div>
              </div>
            )}

            {/* Bundle Results */}
            {(activeTab === "all" || activeTab === "bundles") && searchResults.bundles.length > 0 && (
              <div>
                {activeTab === "all" && (
                  <h2 className="text-sm text-white/40 uppercase tracking-wider mb-4">Bundles</h2>
                )}
                <div className="space-y-2">
                  {searchResults.bundles.map((bundle) => (
                    <BundleResultCard key={`${bundle.creator}-${bundle.bundleId}`} bundle={bundle} getCreatorUsername={getCreatorUsername} />
                  ))}
                </div>
              </div>
            )}

            {/* Creator Results */}
            {(activeTab === "all" || activeTab === "creators") && searchResults.creators.length > 0 && (
              <div>
                {activeTab === "all" && (
                  <h2 className="text-sm text-white/40 uppercase tracking-wider mb-4">Creators</h2>
                )}
                <div className="space-y-2">
                  {searchResults.creators.map((creator) => (
                    <CreatorResultCard key={creator} address={creator} getCreatorUsername={getCreatorUsername} />
                  ))}
                </div>
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
      <div className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <div className="h-14 bg-white/5 rounded-2xl animate-pulse" />
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-4 p-5 rounded-xl bg-white/[0.02] border border-white/5 animate-pulse">
              <div className="w-16 h-16 bg-white/5 rounded-lg" />
              <div className="flex-1 space-y-3">
                <div className="h-4 bg-white/5 rounded w-3/4" />
                <div className="h-3 bg-white/5 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ContentResultCard({ content, getCreatorUsername }: { content: EnrichedContent; getCreatorUsername: (address: string) => string | null }) {
  const thumbnailUrl = content.metadata?.image || null;
  const creatorUsername = getCreatorUsername(content.creator);
  const displayName = creatorUsername || `${content.creator.slice(0, 4)}...${content.creator.slice(-4)}`;

  return (
    <div className="group relative flex gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all duration-300 cursor-pointer">
      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="relative w-16 h-16 bg-white/5 rounded-lg overflow-hidden flex-shrink-0">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={content.metadata?.name || "Content"}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      <div className="relative flex-1 min-w-0">
        <h3 className="font-medium truncate text-white/90">{content.metadata?.name || "Untitled"}</h3>
        <p className="text-sm text-white/40 truncate mt-0.5">
          {content.metadata?.description || "No description"}
        </p>
        <div className="flex items-center gap-3 mt-2">
          <span className="px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider bg-white/5 text-white/50 border border-white/10">
            {content.contentType !== undefined ? getContentTypeLabel(content.contentType as ContentType) : "Content"}
          </span>
          <Link href={`/profile/${content.creator}`} className="text-white/30 hover:text-white/50 text-xs transition-colors">
            {displayName}
          </Link>
        </div>
      </div>
    </div>
  );
}

function BundleResultCard({ bundle, getCreatorUsername }: { bundle: EnrichedBundle; getCreatorUsername: (address: string) => string | null }) {
  const creatorUsername = getCreatorUsername(bundle.creator);
  const displayName = creatorUsername || `${bundle.creator.slice(0, 4)}...${bundle.creator.slice(-4)}`;

  return (
    <Link
      href={`/content/${bundle.bundleId}`}
      className="group relative flex gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all duration-300"
    >
      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="relative w-16 h-16 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
        <svg className="w-7 h-7 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      </div>

      <div className="relative flex-1 min-w-0">
        <h3 className="font-medium truncate text-white/90">{bundle.metadata?.name || `Bundle #${bundle.bundleId}`}</h3>
        <p className="text-sm text-white/40 truncate mt-0.5">
          {bundle.metadata?.description || "No description"}
        </p>
        <div className="flex items-center gap-3 mt-2">
          <span className="px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider bg-white/5 text-white/50 border border-white/10">
            {getBundleTypeLabel(bundle.bundleType)}
          </span>
          <span className="text-white/30 text-xs">{bundle.itemCount} items</span>
          <span className="text-white/25 text-xs">{displayName}</span>
        </div>
      </div>
    </Link>
  );
}

function CreatorResultCard({ address, getCreatorUsername }: { address: string; getCreatorUsername: (address: string) => string | null }) {
  const creatorUsername = getCreatorUsername(address);
  const displayName = creatorUsername || `${address.slice(0, 4)}...${address.slice(-4)}`;
  const avatarInitial = (creatorUsername || address).charAt(0).toUpperCase();

  return (
    <Link
      href={`/profile/${address}`}
      className="group relative flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all duration-300"
    >
      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center text-lg font-semibold text-white/60">
        {avatarInitial}
      </div>

      <div className="relative">
        <h3 className="font-medium text-white/90">{displayName}</h3>
        <p className="text-sm text-white/40">Creator</p>
      </div>
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
