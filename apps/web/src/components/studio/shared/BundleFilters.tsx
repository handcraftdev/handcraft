"use client";

import { useState } from "react";
import { BundleType } from "@handcraft/sdk";

export type BundleSortOption = "recent" | "name" | "items" | "minted";
export type BundleStatusFilter = "all" | "active" | "inactive" | "locked";
export type BundleTypeFilter = "all" | BundleType;

export interface BundleFilterValues {
  search: string;
  status: BundleStatusFilter;
  bundleType: BundleTypeFilter;
  sort: BundleSortOption;
}

interface BundleFiltersProps {
  filters: BundleFilterValues;
  onChange: (filters: BundleFilterValues) => void;
  showAdvanced?: boolean;
}

const BUNDLE_TYPES: { value: BundleTypeFilter; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: 0 as BundleType, label: "Album" },
  { value: 1 as BundleType, label: "Series" },
  { value: 2 as BundleType, label: "Playlist" },
  { value: 3 as BundleType, label: "Course" },
  { value: 4 as BundleType, label: "Newsletter" },
  { value: 5 as BundleType, label: "Collection" },
  { value: 6 as BundleType, label: "Pack" },
];

const STATUS_OPTIONS: { value: BundleStatusFilter; label: string }[] = [
  { value: "all", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "locked", label: "Locked" },
];

const SORT_OPTIONS: { value: BundleSortOption; label: string }[] = [
  { value: "recent", label: "Most Recent" },
  { value: "name", label: "Name" },
  { value: "items", label: "Item Count" },
  { value: "minted", label: "Most Sold" },
];

export function BundleFilters({ filters, onChange, showAdvanced = true }: BundleFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateFilter = <K extends keyof BundleFilterValues>(key: K, value: BundleFilterValues[K]) => {
    onChange({ ...filters, [key]: value });
  };

  const hasActiveFilters = filters.status !== "all" || filters.bundleType !== "all";

  const clearFilters = () => {
    onChange({
      ...filters,
      status: "all",
      bundleType: "all",
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
            placeholder="Search bundles..."
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-white/5 border border-white/[0.08] rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/20 transition-colors"
          />
        </div>

        {/* Sort Dropdown */}
        <select
          value={filters.sort}
          onChange={(e) => updateFilter("sort", e.target.value as BundleSortOption)}
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
          {/* Bundle Type */}
          <select
            value={filters.bundleType === "all" ? "all" : filters.bundleType.toString()}
            onChange={(e) => updateFilter("bundleType", e.target.value === "all" ? "all" : parseInt(e.target.value) as BundleType)}
            className="px-2.5 py-1.5 bg-white/5 border border-white/[0.08] rounded-md text-white text-sm focus:outline-none focus:border-white/20 cursor-pointer min-w-[100px]"
          >
            {BUNDLE_TYPES.map((opt) => (
              <option key={opt.value === "all" ? "all" : opt.value} value={opt.value === "all" ? "all" : opt.value} className="bg-black">
                {opt.label}
              </option>
            ))}
          </select>

          {/* Status */}
          <select
            value={filters.status}
            onChange={(e) => updateFilter("status", e.target.value as BundleStatusFilter)}
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

export const defaultBundleFilters: BundleFilterValues = {
  search: "",
  status: "all",
  bundleType: "all",
  sort: "recent",
};
