import { useQuery } from "@tanstack/react-query";
import { TrendingContent, TrendingBundle } from "@/lib/supabase";

export type TrendingPeriod = "1d" | "7d" | "30d" | "all";
export type TrendingType = "content" | "bundle";

export interface TrendingResponse<T> {
  results: T[];
  type: string;
  period: string;
}

/**
 * Hook for fetching trending content and bundles
 */
export function useTrending(
  type: TrendingType = "content",
  period: TrendingPeriod = "7d",
  limit: number = 20
) {
  return useQuery({
    queryKey: ["trending", type, period, limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        type,
        period,
        limit: String(limit),
      });

      const response = await fetch(`/api/trending?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch trending");
      }

      return response.json() as Promise<
        TrendingResponse<TrendingContent | TrendingBundle>
      >;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchInterval: 1000 * 60 * 5, // Auto-refetch every 5 minutes
  });
}

/**
 * Hook for fetching trending content only
 */
export function useTrendingContent(period: TrendingPeriod = "7d", limit: number = 20) {
  return useTrending("content", period, limit) as ReturnType<
    typeof useQuery<TrendingResponse<TrendingContent>>
  >;
}

/**
 * Hook for fetching trending bundles only
 */
export function useTrendingBundles(period: TrendingPeriod = "7d", limit: number = 20) {
  return useTrending("bundle", period, limit) as ReturnType<
    typeof useQuery<TrendingResponse<TrendingBundle>>
  >;
}
