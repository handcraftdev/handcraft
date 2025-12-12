"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useContentRegistry } from "@/hooks/useContentRegistry";
import { getIpfsUrl, getContentTypeLabel, getBundleTypeLabel, ContentType, BundleType } from "@handcraft/sdk";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";

const SEARCH_HISTORY_KEY = "handcraft-search-history";
const MAX_HISTORY = 10;

type SearchTab = "all" | "content" | "bundles" | "creators";

interface ContentMetadata {
  name?: string;
  description?: string;
  tags?: string[];
}

interface BundleMetadata {
  name?: string;
  description?: string;
}

interface EnrichedContent {
  contentCid: string;
  metadataCid: string;
  contentType: ContentType;
  creator: string;
  createdAt: bigint;
  metadata?: ContentMetadata;
}

interface EnrichedBundle {
  bundleId: string;
  creator: string;
  bundleType: BundleType;
  metadataCid: string;
  itemCount: number;
  createdAt: bigint;
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

  const {
    globalContent,
    globalBundles,
    isLoadingGlobalContent,
  } = useContentRegistry();

  // Enrich content with metadata
  const [enrichedContent, setEnrichedContent] = useState<EnrichedContent[]>([]);
  const [enrichedBundles, setEnrichedBundles] = useState<EnrichedBundle[]>([]);
  const [isEnriching, setIsEnriching] = useState(false);

  // Add to history when query changes
  useEffect(() => {
    if (query) {
      addToHistory(query);
      setLocalQuery(query);
    }
  }, [query, addToHistory]);

  // Enrich content with IPFS metadata
  useEffect(() => {
    if (!globalContent.length && !globalBundles.length) return;

    async function enrichData() {
      setIsEnriching(true);

      // Enrich content
      const contentPromises = globalContent.map(async (item) => {
        try {
          const res = await fetch(getIpfsUrl(item.metadataCid));
          const metadata = await res.json();
          return {
            contentCid: item.contentCid,
            metadataCid: item.metadataCid,
            contentType: item.contentType,
            creator: item.creator.toBase58(),
            createdAt: item.createdAt,
            metadata,
          };
        } catch {
          return {
            contentCid: item.contentCid,
            metadataCid: item.metadataCid,
            contentType: item.contentType,
            creator: item.creator.toBase58(),
            createdAt: item.createdAt,
          };
        }
      });

      // Enrich bundles
      const bundlePromises = globalBundles.map(async (bundle) => {
        try {
          const res = await fetch(getIpfsUrl(bundle.metadataCid));
          const metadata = await res.json();
          return {
            bundleId: bundle.bundleId,
            creator: bundle.creator.toBase58(),
            bundleType: bundle.bundleType,
            metadataCid: bundle.metadataCid,
            itemCount: bundle.itemCount,
            createdAt: bundle.createdAt,
            metadata,
          };
        } catch {
          return {
            bundleId: bundle.bundleId,
            creator: bundle.creator.toBase58(),
            bundleType: bundle.bundleType,
            metadataCid: bundle.metadataCid,
            itemCount: bundle.itemCount,
            createdAt: bundle.createdAt,
          };
        }
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

  // Filter results based on query
  const searchResults = useMemo(() => {
    if (!query) return { content: [], bundles: [], creators: [] };

    const lowerQuery = query.toLowerCase();

    const matchedContent = enrichedContent.filter((item) => {
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

    // Get unique creators from matched content and bundles
    const creatorSet = new Set<string>();
    matchedContent.forEach((c) => creatorSet.add(c.creator));
    matchedBundles.forEach((b) => creatorSet.add(b.creator));

    // Also match creators directly by address
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

  const totalResults =
    searchResults.content.length +
    searchResults.bundles.length +
    searchResults.creators.length;

  return (
    <>
      {/* Search Header */}
      <div className="sticky top-16 z-40 bg-black border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-4">
          {/* Search Input */}
          <form onSubmit={handleSearch} className="mb-4">
            <div className="relative">
              <input
                type="text"
                value={localQuery}
                onChange={(e) => setLocalQuery(e.target.value)}
                placeholder="Search content, bundles, creators..."
                className="w-full bg-gray-900 border border-gray-700 rounded-full px-4 py-3 text-base focus:outline-none focus:border-primary-500 transition-colors"
                autoFocus
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-primary-600 hover:bg-primary-700 rounded-full transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </form>

          {/* Tabs */}
          {query && (
            <div className="flex gap-2">
              {(["all", "content", "bundles", "creators"] as SearchTab[]).map((tab) => {
                const count =
                  tab === "all"
                    ? totalResults
                    : tab === "content"
                    ? searchResults.content.length
                    : tab === "bundles"
                    ? searchResults.bundles.length
                    : searchResults.creators.length;

                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      activeTab === tab
                        ? "bg-white text-black"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    <span className="ml-1.5 text-xs opacity-70">({count})</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {!query ? (
          /* No query - show search history */
          <div>
            {history.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-medium">Recent Searches</h2>
                  <button
                    onClick={clearHistory}
                    className="text-sm text-gray-500 hover:text-gray-300"
                  >
                    Clear all
                  </button>
                </div>
                <div className="space-y-2">
                  {history.map((q, i) => (
                    <Link
                      key={i}
                      href={`/search?q=${encodeURIComponent(q)}`}
                      className="flex items-center gap-3 px-4 py-3 bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
                    >
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{q}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {history.length === 0 && (
              <div className="text-center py-12">
                <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-400 mb-2">Search for content</h3>
                <p className="text-gray-500">Find videos, music, bundles, and creators</p>
              </div>
            )}
          </div>
        ) : isLoading ? (
          /* Loading */
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-gray-900 rounded-lg p-4 animate-pulse">
                <div className="flex gap-4">
                  <div className="w-24 h-24 bg-gray-800 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-800 rounded w-3/4" />
                    <div className="h-3 bg-gray-800 rounded w-1/2" />
                    <div className="h-3 bg-gray-800 rounded w-1/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : totalResults === 0 ? (
          /* No results */
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-400 mb-2">No results found</h3>
            <p className="text-gray-500">Try a different search term</p>
          </div>
        ) : (
          /* Results */
          <div className="space-y-6">
            {/* Content Results */}
            {(activeTab === "all" || activeTab === "content") &&
              searchResults.content.length > 0 && (
                <div>
                  {activeTab === "all" && (
                    <h2 className="text-lg font-medium mb-4">Content</h2>
                  )}
                  <div className="space-y-3">
                    {searchResults.content.map((item) => (
                      <ContentResultCard key={item.contentCid} content={item} />
                    ))}
                  </div>
                </div>
              )}

            {/* Bundle Results */}
            {(activeTab === "all" || activeTab === "bundles") &&
              searchResults.bundles.length > 0 && (
                <div>
                  {activeTab === "all" && (
                    <h2 className="text-lg font-medium mb-4">Bundles</h2>
                  )}
                  <div className="space-y-3">
                    {searchResults.bundles.map((bundle) => (
                      <BundleResultCard key={`${bundle.creator}-${bundle.bundleId}`} bundle={bundle} />
                    ))}
                  </div>
                </div>
              )}

            {/* Creator Results */}
            {(activeTab === "all" || activeTab === "creators") &&
              searchResults.creators.length > 0 && (
                <div>
                  {activeTab === "all" && (
                    <h2 className="text-lg font-medium mb-4">Creators</h2>
                  )}
                  <div className="space-y-3">
                    {searchResults.creators.map((creator) => (
                      <CreatorResultCard key={creator} address={creator} />
                    ))}
                  </div>
                </div>
              )}
          </div>
        )}
      </div>
    </>
  );
}

function SearchLoadingFallback() {
  return (
    <>
      <div className="sticky top-16 z-40 bg-black border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="h-12 bg-gray-900 rounded-full animate-pulse" />
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-gray-900 rounded-lg p-4 animate-pulse">
              <div className="flex gap-4">
                <div className="w-24 h-24 bg-gray-800 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-800 rounded w-3/4" />
                  <div className="h-3 bg-gray-800 rounded w-1/2" />
                  <div className="h-3 bg-gray-800 rounded w-1/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default function SearchPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <div className="flex pt-16">
        <Sidebar />
        <main className="flex-1 ml-0 md:ml-64">
          <Suspense fallback={<SearchLoadingFallback />}>
            <SearchContent />
          </Suspense>
        </main>
      </div>
    </div>
  );
}

function ContentResultCard({ content }: { content: EnrichedContent }) {
  const thumbnailUrl = content.metadata?.name
    ? getIpfsUrl(content.metadataCid).replace("/metadata.json", "/thumbnail.jpg")
    : null;

  return (
    <div className="flex gap-4 p-4 bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors">
      <div className="w-24 h-24 bg-gray-800 rounded-lg overflow-hidden flex-shrink-0">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={content.metadata?.name || "Content"}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-medium truncate">{content.metadata?.name || "Untitled"}</h3>
        <p className="text-sm text-gray-400 truncate">
          {content.metadata?.description || "No description"}
        </p>
        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
          <span className="px-2 py-0.5 bg-gray-800 rounded">{getContentTypeLabel(content.contentType)}</span>
          <Link href={`/profile/${content.creator}`} className="hover:text-primary-400">
            {content.creator.slice(0, 4)}...{content.creator.slice(-4)}
          </Link>
        </div>
      </div>
    </div>
  );
}

function BundleResultCard({ bundle }: { bundle: EnrichedBundle }) {
  return (
    <Link
      href={`/bundle/${bundle.creator}/${bundle.bundleId}`}
      className="flex gap-4 p-4 bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
    >
      <div className="w-24 h-24 bg-gradient-to-br from-secondary-500/20 to-secondary-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
        <svg className="w-10 h-10 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-medium truncate">{bundle.metadata?.name || `Bundle #${bundle.bundleId}`}</h3>
        <p className="text-sm text-gray-400 truncate">
          {bundle.metadata?.description || "No description"}
        </p>
        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
          <span className="px-2 py-0.5 bg-secondary-500/20 text-secondary-400 rounded">
            {getBundleTypeLabel(bundle.bundleType)}
          </span>
          <span>{bundle.itemCount} items</span>
          <span>{bundle.creator.slice(0, 4)}...{bundle.creator.slice(-4)}</span>
        </div>
      </div>
    </Link>
  );
}

function CreatorResultCard({ address }: { address: string }) {
  return (
    <Link
      href={`/profile/${address}`}
      className="flex items-center gap-4 p-4 bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
    >
      <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center text-lg font-bold">
        {address.charAt(0).toUpperCase()}
      </div>
      <div>
        <h3 className="font-medium">{address.slice(0, 4)}...{address.slice(-4)}</h3>
        <p className="text-sm text-gray-500">Creator</p>
      </div>
    </Link>
  );
}
