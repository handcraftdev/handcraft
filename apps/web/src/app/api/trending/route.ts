import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * Trending API - Get trending content and bundles
 *
 * Query params:
 * - type: content | bundle (default: content)
 * - period: 1d | 7d | 30d | all (default: 7d)
 * - limit: Number of results (default 20, max 100)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const type = searchParams.get("type") || "content";
    const period = searchParams.get("period") || "7d";
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);

    // Calculate time threshold
    const now = new Date();
    let timeThreshold: Date;

    switch (period) {
      case "1d":
        timeThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "7d":
        timeThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        timeThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "all":
        timeThreshold = new Date(0); // Beginning of time
        break;
      default:
        timeThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Get trending content
    if (type === "content") {
      // Query: Content with most mints in the period
      const { data, error } = await supabase
        .from("indexed_content")
        .select(
          `
          *,
          ownership:indexed_ownership!content_id(
            id,
            minted_at
          )
        `
        )
        .gte("indexed_ownership.minted_at", timeThreshold.toISOString())
        .order("minted_count", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("Trending content error:", error);
        return NextResponse.json(
          { error: "Failed to fetch trending content" },
          { status: 500 }
        );
      }

      // Calculate recent mints for each item
      const results = (data || []).map((item: any) => {
        const recentMints = item.ownership?.filter((o: any) => {
          const mintedAt = new Date(o.minted_at);
          return mintedAt >= timeThreshold;
        }).length || 0;

        const lastMint = item.ownership?.length > 0
          ? item.ownership.reduce((latest: any, current: any) => {
              const currentDate = new Date(current.minted_at);
              const latestDate = new Date(latest.minted_at);
              return currentDate > latestDate ? current : latest;
            }).minted_at
          : null;

        // Remove ownership array from response
        const { ownership, ...content } = item;

        return {
          ...content,
          recent_mints: recentMints,
          last_mint_at: lastMint,
        };
      });

      // Sort by recent_mints
      results.sort((a: any, b: any) => b.recent_mints - a.recent_mints);

      return NextResponse.json({
        results: results.slice(0, limit),
        type: "content",
        period,
      });
    }

    // Get trending bundles
    if (type === "bundle") {
      const { data, error } = await supabase
        .from("indexed_bundles")
        .select(
          `
          *,
          ownership:indexed_ownership!bundle_id(
            id,
            minted_at
          )
        `
        )
        .gte("indexed_ownership.minted_at", timeThreshold.toISOString())
        .order("minted_count", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("Trending bundles error:", error);
        return NextResponse.json(
          { error: "Failed to fetch trending bundles" },
          { status: 500 }
        );
      }

      // Calculate recent mints for each item
      const results = (data || []).map((item: any) => {
        const recentMints = item.ownership?.filter((o: any) => {
          const mintedAt = new Date(o.minted_at);
          return mintedAt >= timeThreshold;
        }).length || 0;

        const lastMint = item.ownership?.length > 0
          ? item.ownership.reduce((latest: any, current: any) => {
              const currentDate = new Date(current.minted_at);
              const latestDate = new Date(latest.minted_at);
              return currentDate > latestDate ? current : latest;
            }).minted_at
          : null;

        // Remove ownership array from response
        const { ownership, ...bundle } = item;

        return {
          ...bundle,
          recent_mints: recentMints,
          last_mint_at: lastMint,
        };
      });

      // Sort by recent_mints
      results.sort((a: any, b: any) => b.recent_mints - a.recent_mints);

      return NextResponse.json({
        results: results.slice(0, limit),
        type: "bundle",
        period,
      });
    }

    return NextResponse.json(
      { error: "Invalid type parameter" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Trending API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
