"use client";

import { useState } from "react";
import { ContentType, getContentTypeLabel } from "@handcraft/sdk";

export type ContentSortOption = "recent" | "name" | "minted" | "visibility";
export type ContentStatusFilter = "all" | "active" | "locked";
export type ContentVisibilityFilter = "all" | 0 | 1 | 2 | 3;
export type ContentTypeFilter = "all" | ContentType;

export interface ContentFilterValues {
  search: string;
  status: ContentStatusFilter;
  visibility: ContentVisibilityFilter;
  contentType: ContentTypeFilter;
  sort: ContentSortOption;
}

interface ContentFiltersProps {
  filters: ContentFilterValues;
  onChange: (filters: ContentFilterValues) => void;
  showAdvanced?: boolean;
}

const CONTENT_TYPES: { value: ContentTypeFilter; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: 0 as ContentType, label: "Music" },
  { value: 1 as ContentType, label: "Video" },
  { value: 2 as ContentType, label: "Image" },
  { value: 3 as ContentType, label: "Audio" },
  { value: 4 as ContentType, label: "Document" },
  { value: 5 as ContentType, label: "eBook" },
  { value: 6 as ContentType, label: "Model 3D" },
  { value: 7 as ContentType, label: "Software" },
];

const VISIBILITY_OPTIONS: { value: ContentVisibilityFilter; label: string }[] = [
  { value: "all", label: "All Visibility" },
  { value: 0, label: "Public" },
  { value: 1, label: "Subscriber" },
  { value: 2, label: "Members" },
  { value: 3, label: "Buy/Rent Only" },
];

const STATUS_OPTIONS: { value: ContentStatusFilter; label: string }[] = [
  { value: "all", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "locked", label: "Locked" },
];

const SORT_OPTIONS: { value: ContentSortOption; label: string }[] = [
  { value: "recent", label: "Most Recent" },
  { value: "name", label: "Name" },
  { value: "minted", label: "Most Sold" },
  { value: "visibility", label: "Visibility" },
];

export function ContentFilters({ filters, onChange, showAdvanced = true }: ContentFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateFilter = <K extends keyof ContentFilterValues>(key: K, value: ContentFilterValues[K]) => {
    onChange({ ...filters, [key]: value });
  };

  const hasActiveFilters = filters.status !== "all" || filters.visibility !== "all" || filters.contentType !== "all";

  const clearFilters = () => {
    onChange({
      ...filters,
      status: "all",
      visibility: "all",
      contentType: "all",
    });
  };

  return (
    <div className="space-y-2">
      {/* Primary Controls Row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search content..."
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-white/5 border border-white/[0.08] rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/20 transition-colors"
          />
        </div>

        {/* Sort Dropdown */}
        <select
          value={filters.sort}
          onChange={(e) => updateFilter("sort", e.target.value as ContentSortOption)}
          className="px-3 py-2 bg-white/5 border border-white/[0.08] rounded-lg text-white text-sm focus:outline-none focus:border-white/20 cursor-pointer appearance-none min-w-[120px]"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(255,255,255,0.4)'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`, backgroundPosition: "right 0.5rem center", backgroundSize: "0.875rem", backgroundRepeat: "no-repeat", paddingRight: "2rem" }}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-black">
              {opt.label}
            </option>
          ))}
        </select>

        {/* Filter Toggle */}
        {showAdvanced && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              hasActiveFilters
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                : "bg-white/5 text-white/60 border border-white/[0.08] hover:border-white/20"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters
            {hasActiveFilters && (
              <span className="w-1 h-1 rounded-full bg-purple-400" />
            )}
            <svg
              className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Expanded Filters */}
      {showAdvanced && isExpanded && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
          {/* Content Type */}
          <select
            value={filters.contentType === "all" ? "all" : filters.contentType.toString()}
            onChange={(e) => updateFilter("contentType", e.target.value === "all" ? "all" : parseInt(e.target.value) as ContentType)}
            className="px-2.5 py-1.5 bg-white/5 border border-white/[0.08] rounded-md text-white text-sm focus:outline-none focus:border-white/20 cursor-pointer min-w-[100px]"
          >
            {CONTENT_TYPES.map((opt) => (
              <option key={opt.value === "all" ? "all" : opt.value} value={opt.value === "all" ? "all" : opt.value} className="bg-black">
                {opt.label}
              </option>
            ))}
          </select>

          {/* Visibility */}
          <select
            value={filters.visibility === "all" ? "all" : filters.visibility.toString()}
            onChange={(e) => updateFilter("visibility", e.target.value === "all" ? "all" : parseInt(e.target.value) as 0 | 1 | 2 | 3)}
            className="px-2.5 py-1.5 bg-white/5 border border-white/[0.08] rounded-md text-white text-sm focus:outline-none focus:border-white/20 cursor-pointer min-w-[110px]"
          >
            {VISIBILITY_OPTIONS.map((opt) => (
              <option key={opt.value === "all" ? "all" : opt.value} value={opt.value === "all" ? "all" : opt.value} className="bg-black">
                {opt.label}
              </option>
            ))}
          </select>

          {/* Status */}
          <select
            value={filters.status}
            onChange={(e) => updateFilter("status", e.target.value as ContentStatusFilter)}
            className="px-2.5 py-1.5 bg-white/5 border border-white/[0.08] rounded-md text-white text-sm focus:outline-none focus:border-white/20 cursor-pointer min-w-[90px]"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-black">
                {opt.label}
              </option>
            ))}
          </select>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-2 py-1.5 text-white/50 hover:text-white/70 text-sm transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export const defaultContentFilters: ContentFilterValues = {
  search: "",
  status: "all",
  visibility: "all",
  contentType: "all",
  sort: "recent",
};
