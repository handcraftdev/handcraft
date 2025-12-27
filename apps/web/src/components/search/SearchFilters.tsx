"use client";

import { useState } from "react";
import { getContentDomain, ContentType, getContentTypeLabel } from "@handcraft/sdk";

export interface SearchFilterValues {
  type: "content" | "bundle";
  domain?: string;
  category?: string;
  visibility?: number;
  sort: "relevance" | "recent" | "popular" | "mints";
}

export interface SearchFiltersProps {
  filters: SearchFilterValues;
  onChange: (filters: SearchFilterValues) => void;
  showVisibilityFilter?: boolean;
}

const DOMAINS = ["video", "audio", "image", "document", "file", "text"];
const VISIBILITY_LEVELS = [
  { value: 0, label: "Public" },
  { value: 1, label: "Ecosystem" },
  { value: 2, label: "Subscriber" },
  { value: 3, label: "NFT Only" },
];
const SORT_OPTIONS = [
  { value: "relevance", label: "Relevance" },
  { value: "recent", label: "Recent" },
  { value: "popular", label: "Popular" },
  { value: "mints", label: "Most Minted" },
];

export function SearchFilters({
  filters,
  onChange,
  showVisibilityFilter = false,
}: SearchFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleTypeChange = (type: "content" | "bundle") => {
    onChange({ ...filters, type, domain: undefined });
  };

  const handleDomainChange = (domain: string) => {
    onChange({ ...filters, domain: domain === "all" ? undefined : domain });
  };

  const handleVisibilityChange = (visibility: string) => {
    onChange({
      ...filters,
      visibility: visibility === "all" ? undefined : parseInt(visibility),
    });
  };

  const handleSortChange = (sort: string) => {
    onChange({ ...filters, sort: sort as SearchFilterValues["sort"] });
  };

  return (
    <div className="bg-white/[0.02] rounded-lg border border-white/[0.06] p-3">
      {/* Type toggle */}
      <div className="flex gap-1.5 mb-3">
        <button
          onClick={() => handleTypeChange("content")}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            filters.type === "content"
              ? "bg-white text-black"
              : "bg-white/[0.04] text-white/50 hover:bg-white/[0.08]"
          }`}
        >
          Content
        </button>
        <button
          onClick={() => handleTypeChange("bundle")}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            filters.type === "bundle"
              ? "bg-white text-black"
              : "bg-white/[0.04] text-white/50 hover:bg-white/[0.08]"
          }`}
        >
          Bundles
        </button>
      </div>

      {/* Expandable filters */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left text-sm font-medium text-white/40 mb-2"
      >
        <span>Filters</span>
        <svg
          className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="space-y-3 pt-2">
          {/* Domain filter (only for content) */}
          {filters.type === "content" && (
            <div>
              <label className="block text-2xs uppercase tracking-[0.15em] text-white/30 mb-1.5">
                Domain
              </label>
              <select
                value={filters.domain || "all"}
                onChange={(e) => handleDomainChange(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-white/[0.08] rounded-lg bg-white/[0.04] text-white/90 text-sm focus:outline-none focus:border-purple-500/50"
              >
                <option value="all">All Domains</option>
                {DOMAINS.map((domain) => (
                  <option key={domain} value={domain}>
                    {domain.charAt(0).toUpperCase() + domain.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Visibility filter */}
          {showVisibilityFilter && filters.type === "content" && (
            <div>
              <label className="block text-2xs uppercase tracking-[0.15em] text-white/30 mb-1.5">
                Visibility
              </label>
              <select
                value={filters.visibility?.toString() || "all"}
                onChange={(e) => handleVisibilityChange(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-white/[0.08] rounded-lg bg-white/[0.04] text-white/90 text-sm focus:outline-none focus:border-purple-500/50"
              >
                <option value="all">All Visibility Levels</option>
                {VISIBILITY_LEVELS.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Sort */}
          <div>
            <label className="block text-2xs uppercase tracking-[0.15em] text-white/30 mb-1.5">
              Sort By
            </label>
            <select
              value={filters.sort}
              onChange={(e) => handleSortChange(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-white/[0.08] rounded-lg bg-white/[0.04] text-white/90 text-sm focus:outline-none focus:border-purple-500/50"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
