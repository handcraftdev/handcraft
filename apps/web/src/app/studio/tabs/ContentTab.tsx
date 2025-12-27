"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { ContentEntry } from "@/hooks/useContentRegistry";
import { ContentListItem } from "@/components/studio/shared";
import { DraftsList } from "@/components/studio/DraftsList";
import { ContentType, getContentTypeLabel } from "@handcraft/sdk";

type SortOption = "recent" | "name" | "minted" | "visibility";
type StatusFilter = "all" | "active" | "locked";
type ContentTypeFilter = "all" | ContentType;
type ViewMode = "list" | "grid";

const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: ContentType.Video, label: "Video" },
  { value: ContentType.Movie, label: "Movie" },
  { value: ContentType.Television, label: "TV" },
  { value: ContentType.MusicVideo, label: "Music Video" },
  { value: ContentType.Short, label: "Short" },
  { value: ContentType.Music, label: "Music" },
  { value: ContentType.Podcast, label: "Podcast" },
  { value: ContentType.Audiobook, label: "Audiobook" },
  { value: ContentType.Photo, label: "Photo" },
  { value: ContentType.Artwork, label: "Artwork" },
  { value: ContentType.Book, label: "Book" },
  { value: ContentType.Comic, label: "Comic" },
  { value: ContentType.Asset, label: "Asset" },
  { value: ContentType.Game, label: "Game" },
  { value: ContentType.Software, label: "Software" },
  { value: ContentType.Dataset, label: "Dataset" },
  { value: ContentType.Post, label: "Post" },
];

interface ContentTabProps {
  content: ContentEntry[];
  onContentClick: (content: ContentEntry) => void;
}

export function ContentTab({ content, onContentClick }: ContentTabProps) {
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [contentTypeFilter, setContentTypeFilter] = useState<ContentTypeFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [groupBy, setGroupBy] = useState<"none" | "type" | "domain">("none");
  const [searchQuery, setSearchQuery] = useState("");

  const [showSort, setShowSort] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  const hasActiveFilters = statusFilter !== "all" || contentTypeFilter !== "all";

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setShowSort(false);
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilter(false);
    };
    if (showSort || showFilter) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSort, showFilter]);

  // Filter and sort content
  const groupedContent = useMemo(() => {
    let result = [...content];

    // Search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      result = result.filter((c) => {
        const cid = c.contentCid?.toLowerCase() || "";
        const pubkey = c.pubkey?.toBase58().toLowerCase() || "";
        return cid.includes(searchLower) || pubkey.includes(searchLower);
      });
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((c) => {
        const isLocked = c.isLocked || Number(c.mintedCount ?? 0) > 0;
        if (statusFilter === "locked") return isLocked;
        if (statusFilter === "active") return !isLocked;
        return true;
      });
    }

    // Content type filter
    if (contentTypeFilter !== "all") {
      result = result.filter((c) => c.contentType === contentTypeFilter);
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return (a.contentCid || "").localeCompare(b.contentCid || "");
        case "minted":
          return Number(b.mintedCount ?? 0) - Number(a.mintedCount ?? 0);
        case "visibility":
          return (b.visibilityLevel ?? 0) - (a.visibilityLevel ?? 0);
        case "recent":
        default:
          return Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0);
      }
    });

    // Group by
    if (groupBy === "none") {
      return [{ label: null as string | null, items: result }];
    }

    const groups = new Map<string, typeof result>();
    for (const item of result) {
      const key = groupBy === "type"
        ? getContentTypeLabel(item.contentType as ContentType)
        : getContentTypeLabel(item.contentType as ContentType); // domain uses same for content

      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }

    return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
  }, [content, searchQuery, statusFilter, contentTypeFilter, sortBy, groupBy]);

  const filteredContent = groupedContent.flatMap(g => g.items);

  return (
    <div className="space-y-8">
      {/* Drafts Section */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium tracking-tight text-white/90">Drafts</h2>
        </div>
        <DraftsList excludeStatuses={["published"]} />
      </section>

      {/* Published Section */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-medium tracking-tight text-white/90">Published</h2>
            <p className="text-sm text-white/40 mt-0.5">{filteredContent.length} of {content.length} items</p>
          </div>
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
                      {(["recent", "name", "minted", "visibility"] as SortOption[]).map((opt) => (
                        <button
                          key={opt}
                          onClick={() => { setSortBy(opt); setShowSort(false); }}
                          className={`px-2 py-1.5 text-sm font-medium rounded-md capitalize transition-all duration-200 text-left ${sortBy === opt ? "bg-white text-black" : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"}`}
                        >
                          {opt === "recent" ? "Recent" : opt === "name" ? "Name" : opt === "minted" ? "Sold" : "Visibility"}
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
                    <div className="flex items-center gap-1">
                      {(["all", "active", "locked"] as StatusFilter[]).map((opt) => (
                        <button
                          key={opt}
                          onClick={() => setStatusFilter(opt)}
                          className={`flex-1 px-2 py-1.5 text-sm font-medium rounded-md capitalize transition-all duration-200 ${statusFilter === opt ? "bg-white text-black" : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"}`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Content type filter */}
                  <div className="p-2 border-b border-white/[0.06]">
                    <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1.5 px-1">Content Type</p>
                    <div className="flex flex-wrap gap-1">
                      <button
                        onClick={() => setContentTypeFilter("all")}
                        className={`px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${contentTypeFilter === "all" ? "bg-white text-black" : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"}`}
                      >
                        All
                      </button>
                      {CONTENT_TYPES.map(({ value, label }) => (
                        <button
                          key={value}
                          onClick={() => setContentTypeFilter(value)}
                          className={`px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${contentTypeFilter === value ? "bg-white text-black" : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"}`}
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
                        onClick={() => { setStatusFilter("all"); setContentTypeFilter("all"); }}
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

        {/* Content List/Grid */}
        {content.length === 0 ? (
          <div className="relative p-8 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center">
            <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-base font-medium mb-1 text-white/90">No published content yet</h3>
            <p className="text-white/40 text-sm">Publish your drafts to start earning</p>
          </div>
        ) : filteredContent.length === 0 ? (
          <div className="relative p-8 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center">
            <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <h3 className="text-base font-medium mb-1 text-white/90">No matching content</h3>
            <p className="text-white/40 text-sm">Try adjusting your filters</p>
            <button
              onClick={() => { setStatusFilter("all"); setContentTypeFilter("all"); setSearchQuery(""); }}
              className="mt-3 px-3 py-1.5 text-sm text-purple-400 hover:text-purple-300 transition-colors"
            >
              Clear filters
            </button>
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
                {viewMode === "grid" ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {group.items.map((item) => (
                      <ContentListItem
                        key={item.pubkey?.toBase58() || item.contentCid || item.previewCid}
                        content={item}
                        onClick={() => onContentClick(item)}
                        viewMode="grid"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {group.items.map((item) => (
                      <ContentListItem
                        key={item.pubkey?.toBase58() || item.contentCid || item.previewCid}
                        content={item}
                        onClick={() => onContentClick(item)}
                        viewMode="list"
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
