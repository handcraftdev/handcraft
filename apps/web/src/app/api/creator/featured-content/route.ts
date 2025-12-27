import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import { supabase, getServiceSupabase, CreatorFeaturedContent } from "@/lib/supabase";

const MAX_FEATURED_ITEMS = 6;

/**
 * GET /api/creator/featured-content?creator=<address>
 * Fetch featured content for a creator (public)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const creator = searchParams.get("creator");

  if (!creator) {
    return NextResponse.json(
      { error: "Creator address required" },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await supabase
      .from("creator_featured_content")
      .select("*")
      .eq("creator_address", creator)
      .order("position", { ascending: true });

    if (error) {
      console.error("Error fetching featured content:", error);
      return NextResponse.json(
        { error: "Failed to fetch featured content" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error("Error fetching featured content:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/creator/featured-content
 * Update featured content list (requires wallet signature)
 * Replaces all featured content with the provided list
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { creator, signature, timestamp, featured } = body as {
      creator: string;
      signature: string;
      timestamp: string;
      featured: Array<{
        content_type: "content" | "bundle";
        content_cid: string;
        custom_title?: string | null;
        custom_description?: string | null;
      }>;
    };

    // Validate required fields
    if (!creator || !signature || !timestamp) {
      return NextResponse.json(
        { error: "Missing required fields: creator, signature, timestamp" },
        { status: 400 }
      );
    }

    // Verify timestamp is recent (within 5 minutes)
    const timestampNum = parseInt(timestamp);
    const now = Date.now();
    if (Math.abs(now - timestampNum) > 5 * 60 * 1000) {
      return NextResponse.json(
        { error: "Signature expired" },
        { status: 401 }
      );
    }

    // Verify wallet signature
    const message = `Update Featured Content\nCreator: ${creator}\nTimestamp: ${timestamp}`;
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = Uint8Array.from(Buffer.from(signature, "base64"));
    const creatorPubkey = new PublicKey(creator);

    const isValidSignature = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      creatorPubkey.toBytes()
    );

    if (!isValidSignature) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Validate featured items
    if (!Array.isArray(featured)) {
      return NextResponse.json(
        { error: "Featured must be an array" },
        { status: 400 }
      );
    }

    if (featured.length > MAX_FEATURED_ITEMS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_FEATURED_ITEMS} featured items allowed` },
        { status: 400 }
      );
    }

    for (const item of featured) {
      if (!item.content_type || !item.content_cid) {
        return NextResponse.json(
          { error: "Each item must have content_type and content_cid" },
          { status: 400 }
        );
      }
      if (!["content", "bundle"].includes(item.content_type)) {
        return NextResponse.json(
          { error: "content_type must be 'content' or 'bundle'" },
          { status: 400 }
        );
      }
    }

    // Check for duplicates
    const cids = featured.map((f) => `${f.content_type}:${f.content_cid}`);
    if (new Set(cids).size !== cids.length) {
      return NextResponse.json(
        { error: "Duplicate content not allowed" },
        { status: 400 }
      );
    }

    const serverSupabase = getServiceSupabase();

    // Delete existing featured content for this creator
    await serverSupabase
      .from("creator_featured_content")
      .delete()
      .eq("creator_address", creator);

    // Insert new featured content with positions
    if (featured.length > 0) {
      const itemsToInsert = featured.map((item, index) => ({
        creator_address: creator,
        content_type: item.content_type,
        content_cid: item.content_cid,
        position: index,
        is_hero: index === 0,
        custom_title: item.custom_title || null,
        custom_description: item.custom_description || null,
      }));

      const { error: insertError } = await serverSupabase
        .from("creator_featured_content")
        .insert(itemsToInsert);

      if (insertError) {
        console.error("Error inserting featured content:", insertError);
        return NextResponse.json(
          { error: "Failed to save featured content" },
          { status: 500 }
        );
      }
    }

    // Fetch and return updated featured content
    const { data, error } = await serverSupabase
      .from("creator_featured_content")
      .select("*")
      .eq("creator_address", creator)
      .order("position", { ascending: true });

    if (error) {
      console.error("Error fetching updated featured content:", error);
      return NextResponse.json(
        { error: "Failed to fetch updated content" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error("Error updating featured content:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
