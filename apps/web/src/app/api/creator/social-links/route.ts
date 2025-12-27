import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import { supabase, getServiceSupabase, CreatorSocialLink } from "@/lib/supabase";

const VALID_PLATFORMS = [
  "twitter",
  "discord",
  "youtube",
  "instagram",
  "tiktok",
  "twitch",
  "spotify",
  "soundcloud",
  "github",
  "linkedin",
  "website",
  "other",
];

/**
 * GET /api/creator/social-links?creator=<address>
 * Fetch social links for a creator (public)
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
      .from("creator_social_links")
      .select("*")
      .eq("creator_address", creator)
      .eq("is_active", true)
      .order("position", { ascending: true });

    if (error) {
      console.error("Error fetching social links:", error);
      return NextResponse.json(
        { error: "Failed to fetch links" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error("Error fetching social links:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/creator/social-links
 * Create or update social links (requires wallet signature)
 * Body: { creator, signature, timestamp, links: [...] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { creator, signature, timestamp, links } = body as {
      creator: string;
      signature: string;
      timestamp: string;
      links: Array<{
        platform: string;
        url: string;
        display_name?: string | null;
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
    const message = `Update Social Links\nCreator: ${creator}\nTimestamp: ${timestamp}`;
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

    // Validate links
    if (!Array.isArray(links)) {
      return NextResponse.json(
        { error: "Links must be an array" },
        { status: 400 }
      );
    }

    if (links.length > 10) {
      return NextResponse.json(
        { error: "Maximum 10 social links allowed" },
        { status: 400 }
      );
    }

    for (const link of links) {
      if (!link.platform || !link.url) {
        return NextResponse.json(
          { error: "Each link must have platform and url" },
          { status: 400 }
        );
      }
      if (!VALID_PLATFORMS.includes(link.platform)) {
        return NextResponse.json(
          { error: `Invalid platform: ${link.platform}` },
          { status: 400 }
        );
      }
      // Basic URL validation
      try {
        new URL(link.url);
      } catch {
        return NextResponse.json(
          { error: `Invalid URL for ${link.platform}` },
          { status: 400 }
        );
      }
    }

    const serverSupabase = getServiceSupabase();

    // Delete existing links for this creator
    await serverSupabase
      .from("creator_social_links")
      .delete()
      .eq("creator_address", creator);

    // Insert new links with positions
    if (links.length > 0) {
      const linksToInsert = links.map((link, index) => ({
        creator_address: creator,
        platform: link.platform,
        url: link.url,
        display_name: link.display_name || null,
        position: index,
        is_active: true,
      }));

      const { error: insertError } = await serverSupabase
        .from("creator_social_links")
        .insert(linksToInsert);

      if (insertError) {
        console.error("Error inserting social links:", insertError);
        return NextResponse.json(
          { error: "Failed to save links" },
          { status: 500 }
        );
      }
    }

    // Fetch and return updated links
    const { data, error } = await serverSupabase
      .from("creator_social_links")
      .select("*")
      .eq("creator_address", creator)
      .eq("is_active", true)
      .order("position", { ascending: true });

    if (error) {
      console.error("Error fetching updated links:", error);
      return NextResponse.json(
        { error: "Failed to fetch updated links" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error("Error updating social links:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
