"use client";

import { useState, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useContentRegistry } from "@/hooks/useContentRegistry";
import { getIpfsUrl, getContentDomain, getDomainLabel, BundleType, ContentDomain } from "@handcraft/sdk";
import { SidebarPanel } from "@/components/sidebar";
import Link from "next/link";

type SortOption = "recent" | "name" | "type";
type GroupOption = "none" | "type" | "domain";
type ViewMode = "grid" | "list";

// Bundle type labels
const BUNDLE_TYPE_LABELS: Record<BundleType, string> = {
  [BundleType.Album]: "Album",
  [BundleType.Series]: "Series",
  [BundleType.Playlist]: "Playlist",
  [BundleType.Course]: "Course",
  [BundleType.Newsletter]: "Newsletter",
  [BundleType.Collection]: "Collection",
  [BundleType.ProductPack]: "Pack",
};

export default function LibraryClient() {
  const { publicKey } = useWallet();
  const { walletNfts, walletBundleNfts, globalContent, globalBundles, isLoadingGlobalContent, isLoadingGlobalBundles } = useContentRegistry();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [groupBy, setGroupBy] = useState<GroupOption>("none");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");

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
          domain: content.contentType !== undefined ? getContentDomain(content.contentType) : "file" as ContentDomain,
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
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = items.filter(item =>
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
  }, [ownedContent, ownedBundles, sortBy, groupBy, searchQuery]);

  const totalItems = ownedContent.length + ownedBundles.length;
  const isLoading = isLoadingGlobalContent || isLoadingGlobalBundles;

  if (!publicKey) {
    return (
      <div className="min-h-screen bg-black">
        <SidebarPanel isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className={`fixed top-4 z-50 p-3 bg-black/60 backdrop-blur-md rounded-full border border-white/10 hover:border-white/30 transition-all duration-300 ${isSidebarOpen ? 'left-[304px]' : 'left-4'}`}
        >
          <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-white/5 flex items-center justify-center">
              <svg className="w-8 h-8 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6" />
              </svg>
            </div>
            <h2 className="text-xl font-medium text-white mb-2">Your Library</h2>
            <p className="text-white/50 text-sm">Connect your wallet to view your owned content</p>
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
        className={`fixed top-4 z-50 p-3 bg-black/60 backdrop-blur-md rounded-full border border-white/10 hover:border-white/30 transition-all duration-300 ${isSidebarOpen ? 'left-[304px]' : 'left-4'}`}
      >
        <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="max-w-7xl mx-auto px-6 py-20">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Library</h1>
          <p className="text-white/50">{totalItems} items in your collection</p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4 mb-8">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Search library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/20"
            />
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-white/20 cursor-pointer"
          >
            <option value="recent">Recent</option>
            <option value="name">Name</option>
            <option value="type">Type</option>
          </select>

          {/* Group */}
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupOption)}
            className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-white/20 cursor-pointer"
          >
            <option value="none">No grouping</option>
            <option value="type">Group by type</option>
            <option value="domain">Group by category</option>
          </select>

          {/* View Mode */}
          <div className="flex border border-white/10 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2.5 ${viewMode === "grid" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2.5 ${viewMode === "list" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        ) : totalItems === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-white/5 flex items-center justify-center">
              <svg className="w-8 h-8 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Your library is empty</h3>
            <p className="text-white/50 text-sm mb-6">Start collecting content to build your library</p>
            <Link href="/content" className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-white/90 transition-colors">
              Browse Content
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {libraryItems.map((group, groupIndex) => (
              <div key={group.label || groupIndex}>
                {group.label && (
                  <h2 className="text-lg font-medium text-white mb-4">{group.label}</h2>
                )}

                {viewMode === "grid" ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {group.items.map((item) => (
                      <Link
                        key={`${item.type}-${item.id}`}
                        href={`/content/${item.id}`}
                        className="group relative aspect-square rounded-xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/20 transition-all"
                      >
                        {(item.thumbnail || item.previewCid) ? (
                          <img
                            src={item.thumbnail || (item.previewCid ? getIpfsUrl(item.previewCid) : '')}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg className="w-12 h-12 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              {item.type === "bundle" ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                              ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                              )}
                            </svg>
                          </div>
                        )}

                        {/* Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="absolute bottom-0 left-0 right-0 p-3">
                            <p className="text-white text-sm font-medium truncate">{item.title}</p>
                            <p className="text-white/50 text-xs capitalize">
                              {item.type === "bundle"
                                ? (item.bundleType !== undefined ? BUNDLE_TYPE_LABELS[item.bundleType] : "Bundle")
                                : getDomainLabel(item.domain as ContentDomain)}
                            </p>
                          </div>
                        </div>

                        {/* Type badge */}
                        <div className="absolute top-2 right-2 flex items-center gap-1">
                          {item.count > 1 && (
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/90 text-white">
                              x{item.count}
                            </span>
                          )}
                          <span className={`px-2 py-1 rounded-md text-[10px] font-medium ${
                            item.type === "bundle"
                              ? "bg-purple-500/80 text-white"
                              : "bg-white/20 text-white/80 backdrop-blur-sm"
                          }`}>
                            {item.type === "bundle" ? "Bundle" : getDomainLabel(item.domain as ContentDomain)}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {group.items.map((item) => (
                      <Link
                        key={`${item.type}-${item.id}`}
                        href={`/content/${item.id}`}
                        className="flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all"
                      >
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
                          {(item.thumbnail || item.previewCid) ? (
                            <img
                              src={item.thumbnail || (item.previewCid ? getIpfsUrl(item.previewCid) : '')}
                              alt={item.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <svg className="w-6 h-6 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13" />
                              </svg>
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">{item.title}</p>
                          <p className="text-white/50 text-sm capitalize">
                            {item.type === "bundle"
                              ? (item.bundleType !== undefined ? BUNDLE_TYPE_LABELS[item.bundleType] : "Bundle")
                              : getDomainLabel(item.domain as ContentDomain)}
                            {item.type === "bundle" && item.itemCount && ` · ${item.itemCount} items`}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {item.count > 1 && (
                            <span className="px-1.5 py-0.5 rounded-md text-xs font-bold bg-amber-500/90 text-white">
                              x{item.count}
                            </span>
                          )}
                          <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                            item.type === "bundle"
                              ? "bg-purple-500/20 text-purple-300"
                              : "bg-white/10 text-white/60"
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
