import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * Search API - Full-text search with filters
 *
 * Query params:
 * - q: Search query (full-text search)
 * - type: content | bundle
 * - domain: video | audio | image | document | file | text
 * - creator: Creator wallet address
 * - tags: Comma-separated tags
 * - category: Category filter
 * - visibility: 0 (public) | 1 (ecosystem) | 2 (subscriber) | 3 (nft_only)
 * - sort: relevance | recent | popular | mints
 * - limit: Number of results (default 20, max 100)
 * - offset: Pagination offset (default 0)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const query = searchParams.get("q") || "";
    const type = searchParams.get("type") || "content"; // content | bundle
    const domain = searchParams.get("domain");
    const creator = searchParams.get("creator");
    const tags = searchParams.get("tags")?.split(",").filter(Boolean);
    const category = searchParams.get("category");
    const visibility = searchParams.get("visibility");
    const sort = searchParams.get("sort") || "relevance"; // relevance | recent | popular | mints
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Search content
    if (type === "content") {
      let queryBuilder = supabase
        .from("indexed_content")
        .select("*", { count: "exact" });

      // Full-text search
      if (query) {
        // Use plainto_tsquery for simple text search
        queryBuilder = queryBuilder.textSearch("search_vector", query, {
          type: "plain",
        });
      }

      // Filters
      if (domain) {
        queryBuilder = queryBuilder.eq("content_domain", domain);
      }
      if (creator) {
        queryBuilder = queryBuilder.eq("creator_address", creator);
      }
      if (tags && tags.length > 0) {
        queryBuilder = queryBuilder.contains("tags", tags);
      }
      if (category) {
        queryBuilder = queryBuilder.eq("category", category);
      }
      if (visibility !== null && visibility !== undefined) {
        queryBuilder = queryBuilder.eq("visibility_level", parseInt(visibility));
      }

      // Sorting
      switch (sort) {
        case "recent":
          queryBuilder = queryBuilder.order("created_at", { ascending: false });
          break;
        case "popular":
          queryBuilder = queryBuilder.order("minted_count", { ascending: false });
          break;
        case "mints":
          queryBuilder = queryBuilder.order("minted_count", { ascending: false });
          break;
        case "relevance":
        default:
          // When searching, relevance is default (handled by textSearch)
          // Otherwise, fall back to recent
          if (!query) {
            queryBuilder = queryBuilder.order("created_at", { ascending: false });
          }
          break;
      }

      // Pagination
      queryBuilder = queryBuilder.range(offset, offset + limit - 1);

      const { data, error, count } = await queryBuilder;

      if (error) {
        console.error("Search error:", error);
        return NextResponse.json(
          { error: "Search failed" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        results: data || [],
        total: count || 0,
        limit,
        offset,
        type: "content",
      });
    }

    // Search bundles
    if (type === "bundle") {
      let queryBuilder = supabase
        .from("indexed_bundles")
        .select("*", { count: "exact" });

      // Full-text search
      if (query) {
        queryBuilder = queryBuilder.textSearch("search_vector", query, {
          type: "plain",
        });
      }

      // Filters
      if (creator) {
        queryBuilder = queryBuilder.eq("creator_address", creator);
      }
      if (tags && tags.length > 0) {
        queryBuilder = queryBuilder.contains("tags", tags);
      }
      if (category) {
        queryBuilder = queryBuilder.eq("category", category);
      }

      // Sorting
      switch (sort) {
        case "recent":
          queryBuilder = queryBuilder.order("created_at", { ascending: false });
          break;
        case "popular":
        case "mints":
          queryBuilder = queryBuilder.order("minted_count", { ascending: false });
          break;
        case "relevance":
        default:
          if (!query) {
            queryBuilder = queryBuilder.order("created_at", { ascending: false });
          }
          break;
      }

      // Pagination
      queryBuilder = queryBuilder.range(offset, offset + limit - 1);

      const { data, error, count } = await queryBuilder;

      if (error) {
        console.error("Search error:", error);
        return NextResponse.json(
          { error: "Search failed" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        results: data || [],
        total: count || 0,
        limit,
        offset,
        type: "bundle",
      });
    }

    return NextResponse.json(
      { error: "Invalid type parameter" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
