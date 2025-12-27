import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import { supabase, getServiceSupabase, CreatorAnnouncement } from "@/lib/supabase";

/**
 * GET /api/creator/announcements?creator=<address>
 * Fetch active announcements for a creator (public)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const creator = searchParams.get("creator");
  const includeExpired = searchParams.get("includeExpired") === "true";

  if (!creator) {
    return NextResponse.json(
      { error: "Creator address required" },
      { status: 400 }
    );
  }

  try {
    let query = supabase
      .from("creator_announcements")
      .select("*")
      .eq("creator_address", creator)
      .eq("is_active", true)
      .order("is_pinned", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(10);

    // Filter expired announcements unless includeExpired is set
    if (!includeExpired) {
      query = query.or("expires_at.is.null,expires_at.gt.now()");
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching announcements:", error);
      return NextResponse.json(
        { error: "Failed to fetch announcements" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error("Error fetching announcements:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/creator/announcements
 * Create a new announcement (requires wallet signature)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { creator, signature, timestamp, ...announcement } = body as {
      creator: string;
      signature: string;
      timestamp: string;
      title: string;
      content: string;
      link_url?: string | null;
      link_text?: string | null;
      is_pinned?: boolean;
      expires_at?: string | null;
    };

    // Validate required fields
    if (!creator || !signature || !timestamp) {
      return NextResponse.json(
        { error: "Missing required fields: creator, signature, timestamp" },
        { status: 400 }
      );
    }

    if (!announcement.title || !announcement.content) {
      return NextResponse.json(
        { error: "Title and content are required" },
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
    const message = `Create Announcement\nCreator: ${creator}\nTimestamp: ${timestamp}`;
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

    // Validate input lengths
    if (announcement.title.length > 200) {
      return NextResponse.json(
        { error: "Title must be 200 characters or less" },
        { status: 400 }
      );
    }
    if (announcement.content.length > 2000) {
      return NextResponse.json(
        { error: "Content must be 2000 characters or less" },
        { status: 400 }
      );
    }

    // Validate link if provided
    if (announcement.link_url) {
      try {
        new URL(announcement.link_url);
      } catch {
        return NextResponse.json(
          { error: "Invalid link URL" },
          { status: 400 }
        );
      }
    }

    const serverSupabase = getServiceSupabase();

    // If pinning, unpin other announcements first
    if (announcement.is_pinned) {
      await serverSupabase
        .from("creator_announcements")
        .update({ is_pinned: false })
        .eq("creator_address", creator)
        .eq("is_pinned", true);
    }

    // Insert new announcement
    const { data, error } = await serverSupabase
      .from("creator_announcements")
      .insert({
        creator_address: creator,
        title: announcement.title,
        content: announcement.content,
        link_url: announcement.link_url || null,
        link_text: announcement.link_text || null,
        is_pinned: announcement.is_pinned || false,
        is_active: true,
        published_at: new Date().toISOString(),
        expires_at: announcement.expires_at || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating announcement:", error);
      return NextResponse.json(
        { error: "Failed to create announcement" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error creating announcement:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/creator/announcements
 * Delete an announcement (requires wallet signature)
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { creator, signature, timestamp, announcement_id } = body as {
      creator: string;
      signature: string;
      timestamp: string;
      announcement_id: number;
    };

    // Validate required fields
    if (!creator || !signature || !timestamp || !announcement_id) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify timestamp is recent
    const timestampNum = parseInt(timestamp);
    const now = Date.now();
    if (Math.abs(now - timestampNum) > 5 * 60 * 1000) {
      return NextResponse.json(
        { error: "Signature expired" },
        { status: 401 }
      );
    }

    // Verify wallet signature
    const message = `Delete Announcement\nCreator: ${creator}\nTimestamp: ${timestamp}`;
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

    const serverSupabase = getServiceSupabase();

    // Soft delete by setting is_active = false
    const { error } = await serverSupabase
      .from("creator_announcements")
      .update({ is_active: false })
      .eq("id", announcement_id)
      .eq("creator_address", creator);

    if (error) {
      console.error("Error deleting announcement:", error);
      return NextResponse.json(
        { error: "Failed to delete announcement" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting announcement:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
