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
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      {/* Type toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => handleTypeChange("content")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filters.type === "content"
              ? "bg-blue-500 text-white"
              : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
          }`}
        >
          Content
        </button>
        <button
          onClick={() => handleTypeChange("bundle")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filters.type === "bundle"
              ? "bg-blue-500 text-white"
              : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
          }`}
        >
          Bundles
        </button>
      </div>

      {/* Expandable filters */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
      >
        <span>Filters</span>
        <svg
          className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="space-y-4 pt-2">
          {/* Domain filter (only for content) */}
          {filters.type === "content" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Domain
              </label>
              <select
                value={filters.domain || "all"}
                onChange={(e) => handleDomainChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Visibility
              </label>
              <select
                value={filters.visibility?.toString() || "all"}
                onChange={(e) => handleVisibilityChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Sort By
            </label>
            <select
              value={filters.sort}
              onChange={(e) => handleSortChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
