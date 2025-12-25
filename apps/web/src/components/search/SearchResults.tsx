"use client";

import { IndexedContent, IndexedBundle } from "@/lib/supabase";
import { getContentTypeLabel, getBundleTypeLabel, ContentType, BundleType } from "@handcraft/sdk";

export interface SearchResultsProps {
  results: (IndexedContent | IndexedBundle)[];
  type: "content" | "bundle";
  isLoading?: boolean;
  onItemClick?: (item: IndexedContent | IndexedBundle) => void;
}

export function SearchResults({
  results,
  type,
  isLoading,
  onItemClick,
}: SearchResultsProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">No results found</p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
          Try adjusting your search or filters
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {results.map((item) => {
        const isContent = "content_cid" in item;
        const content = isContent ? (item as IndexedContent) : null;
        const bundle = !isContent ? (item as IndexedBundle) : null;

        return (
          <div
            key={isContent ? content?.content_address : bundle?.bundle_address}
            onClick={() => onItemClick?.(item)}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
          >
            {/* Thumbnail */}
            <div className="aspect-video bg-gray-200 dark:bg-gray-700 relative">
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt={item.name || "Content"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <svg
                    className="w-16 h-16 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              )}

              {/* Type badge */}
              <div className="absolute top-2 right-2">
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-500 text-white">
                  {isContent
                    ? getContentTypeLabel(content!.content_type as ContentType)
                    : getBundleTypeLabel(bundle!.bundle_type as BundleType)}
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1 line-clamp-2">
                {item.name || "Untitled"}
              </h3>

              {item.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                  {item.description}
                </p>
              )}

              {/* Stats */}
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-500">
                <span>{item.minted_count} mints</span>
                {isContent && content?.category && (
                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                    {content.category}
                  </span>
                )}
              </div>

              {/* Tags */}
              {item.tags && item.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {item.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                  {item.tags.length > 3 && (
                    <span className="px-2 py-0.5 text-xs text-gray-500 dark:text-gray-500">
                      +{item.tags.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
