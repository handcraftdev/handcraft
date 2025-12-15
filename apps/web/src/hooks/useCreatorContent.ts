import { useQuery } from "@tanstack/react-query";
import { IndexedContent, IndexedBundle, IndexedCreator } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";

/**
 * Hook for fetching creator profile and stats
 */
export function useCreatorProfile(creatorAddress: string) {
  return useQuery({
    queryKey: ["creator", creatorAddress],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("indexed_creators")
        .select("*")
        .eq("creator_address", creatorAddress)
        .single();

      if (error) {
        throw error;
      }

      return data as IndexedCreator;
    },
    enabled: Boolean(creatorAddress),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook for fetching creator's content
 */
export function useCreatorContent(
  creatorAddress: string,
  options: {
    limit?: number;
    offset?: number;
    sort?: "recent" | "popular";
  } = {}
) {
  const { limit = 20, offset = 0, sort = "recent" } = options;

  return useQuery({
    queryKey: ["creator-content", creatorAddress, limit, offset, sort],
    queryFn: async () => {
      let query = supabase
        .from("indexed_content")
        .select("*", { count: "exact" })
        .eq("creator_address", creatorAddress);

      // Sorting
      if (sort === "recent") {
        query = query.order("created_at", { ascending: false });
      } else if (sort === "popular") {
        query = query.order("minted_count", { ascending: false });
      }

      // Pagination
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        throw error;
      }

      return {
        results: data as IndexedContent[],
        total: count || 0,
        limit,
        offset,
      };
    },
    enabled: Boolean(creatorAddress),
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook for fetching creator's bundles
 */
export function useCreatorBundles(
  creatorAddress: string,
  options: {
    limit?: number;
    offset?: number;
    sort?: "recent" | "popular";
  } = {}
) {
  const { limit = 20, offset = 0, sort = "recent" } = options;

  return useQuery({
    queryKey: ["creator-bundles", creatorAddress, limit, offset, sort],
    queryFn: async () => {
      let query = supabase
        .from("indexed_bundles")
        .select("*", { count: "exact" })
        .eq("creator_address", creatorAddress);

      // Sorting
      if (sort === "recent") {
        query = query.order("created_at", { ascending: false });
      } else if (sort === "popular") {
        query = query.order("minted_count", { ascending: false });
      }

      // Pagination
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        throw error;
      }

      return {
        results: data as IndexedBundle[],
        total: count || 0,
        limit,
        offset,
      };
    },
    enabled: Boolean(creatorAddress),
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook for fetching user's owned content (NFTs)
 */
export function useOwnedContent(walletAddress: string) {
  return useQuery({
    queryKey: ["owned-content", walletAddress],
    queryFn: async () => {
      // Get all NFT ownership records for this wallet
      const { data: ownership, error: ownershipError } = await supabase
        .from("indexed_ownership")
        .select(
          `
          *,
          content:indexed_content(*),
          bundle:indexed_bundles(*)
        `
        )
        .eq("owner_address", walletAddress);

      if (ownershipError) {
        throw ownershipError;
      }

      return ownership;
    },
    enabled: Boolean(walletAddress),
    staleTime: 1000 * 60, // 1 minute
  });
}
