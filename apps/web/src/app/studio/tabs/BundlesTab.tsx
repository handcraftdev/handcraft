"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { BundleListItem } from "@/components/studio/shared";
import { BundleType, getBundleTypeLabel } from "@handcraft/sdk";

type SortOption = "recent" | "name" | "items" | "minted";
type StatusFilter = "all" | "active" | "inactive" | "locked";
type BundleTypeFilter = "all" | BundleType;
type ViewMode = "list" | "grid";

const BUNDLE_TYPES: { value: BundleType; label: string }[] = [
  { value: BundleType.Album, label: "Album" },
  { value: BundleType.Series, label: "Series" },
  { value: BundleType.Playlist, label: "Playlist" },
  { value: BundleType.Course, label: "Course" },
  { value: BundleType.Newsletter, label: "Newsletter" },
  { value: BundleType.Collection, label: "Collection" },
  { value: BundleType.ProductPack, label: "Product Pack" },
];

interface Bundle {
  bundleId: string;
  bundleType: BundleType;
  itemCount: number;
  isActive: boolean;
  isLocked: boolean;
  mintedCount?: bigint | number;
  createdAt: bigint | number;
  metadataCid?: string;
  creator: { toBase58: () => string };
}

interface BundlesTabProps {
  bundles: Bundle[];
  onBundleClick: (bundle: Bundle) => void;
  onCreateBundle: () => void;
}

export function BundlesTab({ bundles, onBundleClick, onCreateBundle }: BundlesTabProps) {
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [bundleTypeFilter, setBundleTypeFilter] = useState<BundleTypeFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [groupBy, setGroupBy] = useState<"none" | "type" | "domain">("none");
  const [searchQuery, setSearchQuery] = useState("");

  const [showSort, setShowSort] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  const hasActiveFilters = statusFilter !== "all" || bundleTypeFilter !== "all";

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setShowSort(false);
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilter(false);
    };
    if (showSort || showFilter) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSort, showFilter]);

  // Filter and sort bundles
  const groupedBundles = useMemo(() => {
    let result = [...bundles];

    // Search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      result = result.filter((b) => b.bundleId.toLowerCase().includes(searchLower));
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((b) => {
        const isLocked = b.isLocked || Number(b.mintedCount ?? 0) > 0;
        if (statusFilter === "locked") return isLocked;
        if (statusFilter === "active") return b.isActive && !isLocked;
        if (statusFilter === "inactive") return !b.isActive && !isLocked;
        return true;
      });
    }

    // Bundle type filter
    if (bundleTypeFilter !== "all") {
      result = result.filter((b) => b.bundleType === bundleTypeFilter);
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.bundleId.localeCompare(b.bundleId);
        case "items":
          return b.itemCount - a.itemCount;
        case "minted":
          return Number(b.mintedCount ?? 0) - Number(a.mintedCount ?? 0);
        case "recent":
        default:
          return Number(b.createdAt) - Number(a.createdAt);
      }
    });

    // Group by
    if (groupBy === "none") {
      return [{ label: null as string | null, items: result }];
    }

    const groups = new Map<string, typeof result>();
    for (const item of result) {
      const key = getBundleTypeLabel(item.bundleType);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }

    return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
  }, [bundles, searchQuery, statusFilter, bundleTypeFilter, sortBy, groupBy]);

  const filteredBundles = groupedBundles.flatMap(g => g.items);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-medium tracking-tight text-white/90">My Bundles</h2>
          <p className="text-sm text-white/40 mt-0.5">{filteredBundles.length} of {bundles.length} bundles</p>
        </div>
        <button
          onClick={onCreateBundle}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 hover:border-purple-500/50 rounded-lg text-sm font-medium transition-all duration-300"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Bundle
        </button>
      </div>

      {/* Controls Bar */}
      <div className="flex items-center justify-end gap-2 mb-4">
        {/* Search */}
        <div className="relative flex-1 max-w-xs mr-auto">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="w-full pl-8 pr-3 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 transition-all"
          />
        </div>

        <div className="flex items-center gap-1">
          {/* Sort dropdown */}
          <div className="relative" ref={sortRef}>
            <button
              onClick={() => setShowSort(!showSort)}
              className={`p-1.5 rounded-lg transition-all duration-200 ${showSort ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}
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
                    {(["recent", "name", "items", "minted"] as SortOption[]).map((opt) => (
                      <button
                        key={opt}
                        onClick={() => { setSortBy(opt); setShowSort(false); }}
                        className={`px-2 py-1.5 text-sm font-medium rounded-md capitalize transition-all duration-200 text-left ${sortBy === opt ? "bg-white text-black" : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"}`}
                      >
                        {opt === "recent" ? "Recent" : opt === "name" ? "Name" : opt === "items" ? "Items" : "Sold"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Filter dropdown */}
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setShowFilter(!showFilter)}
              className={`p-1.5 rounded-lg transition-all duration-200 ${hasActiveFilters ? "bg-purple-500/20 text-purple-300" : showFilter ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}
              title="Filter"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              {hasActiveFilters && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-purple-400 rounded-full" />}
            </button>
            {showFilter && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-black/95 backdrop-blur-xl border border-white/[0.08] rounded-lg shadow-xl z-50 overflow-hidden max-h-[70vh] overflow-y-auto">
                {/* Status filter */}
                <div className="p-2 border-b border-white/[0.06]">
                  <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1.5 px-1">Status</p>
                  <div className="flex flex-wrap gap-1">
                    {(["all", "active", "inactive", "locked"] as StatusFilter[]).map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setStatusFilter(opt)}
                        className={`px-2 py-1.5 text-sm font-medium rounded-md capitalize transition-all duration-200 ${statusFilter === opt ? "bg-white text-black" : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Bundle type filter */}
                <div className="p-2 border-b border-white/[0.06]">
                  <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1.5 px-1">Bundle Type</p>
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => setBundleTypeFilter("all")}
                      className={`px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${bundleTypeFilter === "all" ? "bg-white text-black" : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"}`}
                    >
                      All
                    </button>
                    {BUNDLE_TYPES.map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => setBundleTypeFilter(value)}
                        className={`px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${bundleTypeFilter === value ? "bg-white text-black" : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Clear */}
                {hasActiveFilters && (
                  <div className="p-2">
                    <button
                      onClick={() => { setStatusFilter("all"); setBundleTypeFilter("all"); }}
                      className="w-full px-2 py-1.5 text-sm font-medium text-white/50 hover:text-white/70 hover:bg-white/[0.04] rounded-md transition-all"
                    >
                      Clear all filters
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Group toggle */}
          <button
            onClick={() => setGroupBy(groupBy === "none" ? "type" : groupBy === "type" ? "domain" : "none")}
            className={`p-1.5 rounded-lg transition-all duration-200 ${groupBy !== "none" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}
            title={`Group by: ${groupBy}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
          </button>

          {/* View toggle */}
          <div className="flex items-center bg-white/[0.03] rounded-lg p-0.5 ml-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-all duration-200 ${viewMode === "grid" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
                <path d="M1 2.5A1.5 1.5 0 012.5 1h3A1.5 1.5 0 017 2.5v3A1.5 1.5 0 015.5 7h-3A1.5 1.5 0 011 5.5v-3zm8 0A1.5 1.5 0 0110.5 1h3A1.5 1.5 0 0115 2.5v3A1.5 1.5 0 0113.5 7h-3A1.5 1.5 0 019 5.5v-3zm-8 8A1.5 1.5 0 012.5 9h3A1.5 1.5 0 017 10.5v3A1.5 1.5 0 015.5 15h-3A1.5 1.5 0 011 13.5v-3zm8 0A1.5 1.5 0 0110.5 9h3a1.5 1.5 0 011.5 1.5v3a1.5 1.5 0 01-1.5 1.5h-3A1.5 1.5 0 019 13.5v-3z"/>
              </svg>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md transition-all duration-200 ${viewMode === "list" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
                <path fillRule="evenodd" d="M2.5 12a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5zm0-4a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5zm0-4a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Bundles List/Grid */}
      {bundles.length === 0 ? (
        <div className="relative p-8 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center">
          <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-base font-medium mb-1 text-white/90">No bundles yet</h3>
          <p className="text-white/40 text-sm mb-4">Create a bundle to group your content together</p>
          <button
            onClick={onCreateBundle}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/[0.08] hover:border-white/20 rounded-lg text-sm font-medium transition-all duration-300"
          >
            Create Your First Bundle
          </button>
        </div>
      ) : filteredBundles.length === 0 ? (
        <div className="relative p-8 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center">
          <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <h3 className="text-base font-medium mb-1 text-white/90">No matching bundles</h3>
          <p className="text-white/40 text-sm">Try adjusting your filters</p>
          <button
            onClick={() => { setStatusFilter("all"); setBundleTypeFilter("all"); setSearchQuery(""); }}
            className="mt-3 px-3 py-1.5 text-sm text-purple-400 hover:text-purple-300 transition-colors"
          >
            Clear filters
          </button>
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
              {viewMode === "grid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.items.map((bundle) => (
                    <BundleListItem
                      key={bundle.bundleId}
                      bundle={bundle}
                      onClick={() => onBundleClick(bundle)}
                      viewMode="grid"
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {group.items.map((bundle) => (
                    <BundleListItem
                      key={bundle.bundleId}
                      bundle={bundle}
                      onClick={() => onBundleClick(bundle)}
                      viewMode="list"
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
