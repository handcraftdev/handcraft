import { useQuery } from "@tanstack/react-query";
import { IndexedContent, IndexedBundle } from "@/lib/supabase";

export interface SearchFilters {
  type?: "content" | "bundle";
  domain?: string;
  creator?: string;
  tags?: string[];
  category?: string;
  visibility?: number;
  sort?: "relevance" | "recent" | "popular" | "mints";
  limit?: number;
  offset?: number;
}

export interface SearchResponse<T> {
  results: T[];
  total: number;
  limit: number;
  offset: number;
  type: string;
}

/**
 * Hook for searching content and bundles
 */
export function useSearch(query: string, filters: SearchFilters = {}) {
  const {
    type = "content",
    domain,
    creator,
    tags,
    category,
    visibility,
    sort = "relevance",
    limit = 20,
    offset = 0,
  } = filters;

  return useQuery({
    queryKey: ["search", query, type, domain, creator, tags, category, visibility, sort, limit, offset],
    queryFn: async () => {
      const params = new URLSearchParams({
        q: query,
        type,
        sort,
        limit: String(limit),
        offset: String(offset),
      });

      if (domain) params.append("domain", domain);
      if (creator) params.append("creator", creator);
      if (tags?.length) params.append("tags", tags.join(","));
      if (category) params.append("category", category);
      if (visibility !== undefined) params.append("visibility", String(visibility));

      const response = await fetch(`/api/search?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Search failed");
      }

      return response.json() as Promise<
        SearchResponse<IndexedContent | IndexedBundle>
      >;
    },
    enabled: query.length > 0,
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook for searching content only
 */
export function useSearchContent(query: string, filters: Omit<SearchFilters, "type"> = {}) {
  return useSearch(query, { ...filters, type: "content" }) as ReturnType<
    typeof useQuery<SearchResponse<IndexedContent>>
  >;
}

/**
 * Hook for searching bundles only
 */
export function useSearchBundles(query: string, filters: Omit<SearchFilters, "type"> = {}) {
  return useSearch(query, { ...filters, type: "bundle" }) as ReturnType<
    typeof useQuery<SearchResponse<IndexedBundle>>
  >;
}
