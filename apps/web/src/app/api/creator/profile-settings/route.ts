import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import { supabase, getServiceSupabase, CreatorProfileSettings } from "@/lib/supabase";

/**
 * GET /api/creator/profile-settings?creator=<address>
 * Fetch profile settings for a creator (public)
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
      .from("creator_profile_settings")
      .select("*")
      .eq("creator_address", creator)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows found (acceptable)
      console.error("Error fetching profile settings:", error);
      return NextResponse.json(
        { error: "Failed to fetch settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || null });
  } catch (error) {
    console.error("Error fetching profile settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/creator/profile-settings
 * Update profile settings (requires wallet signature)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { creator, signature, timestamp, ...settings } = body as {
      creator: string;
      signature: string;
      timestamp: string;
      banner_cid?: string | null;
      banner_url?: string | null;
      bio?: string | null;
      tagline?: string | null;
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
    const message = `Update Creator Profile\nCreator: ${creator}\nTimestamp: ${timestamp}`;
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
    if (settings.bio && settings.bio.length > 1000) {
      return NextResponse.json(
        { error: "Bio must be 1000 characters or less" },
        { status: 400 }
      );
    }
    if (settings.tagline && settings.tagline.length > 150) {
      return NextResponse.json(
        { error: "Tagline must be 150 characters or less" },
        { status: 400 }
      );
    }

    // Upsert using service role
    const serverSupabase = getServiceSupabase();
    const { data, error } = await serverSupabase
      .from("creator_profile_settings")
      .upsert(
        {
          creator_address: creator,
          banner_cid: settings.banner_cid,
          banner_url: settings.banner_url,
          bio: settings.bio,
          tagline: settings.tagline,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "creator_address",
        }
      )
      .select()
      .single();

    if (error) {
      console.error("Error saving profile settings:", error);
      return NextResponse.json(
        { error: "Failed to save settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error updating profile settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
