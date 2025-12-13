import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import { createFilebaseClient } from "@handcraft/sdk";

interface CustomMembershipTier {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  benefits: string[];
  isActive: boolean;
}

interface CustomMembershipsMetadata {
  version: 1;
  creator: string;
  tiers: CustomMembershipTier[];
  updatedAt: number;
}

const filebase =
  process.env.FILEBASE_KEY &&
  process.env.FILEBASE_SECRET &&
  process.env.FILEBASE_BUCKET
    ? createFilebaseClient({
        accessKey: process.env.FILEBASE_KEY,
        secretKey: process.env.FILEBASE_SECRET,
        bucket: process.env.FILEBASE_BUCKET,
      })
    : null;

/**
 * Get the S3 key for a creator's custom memberships
 */
function getMembershipKey(creator: string): string {
  return `custom-memberships/${creator}.json`;
}

/**
 * GET /api/memberships/custom?creator=<address>
 * Fetch custom membership tiers for a creator
 */
export async function GET(request: NextRequest) {
  if (!filebase) {
    return NextResponse.json(
      { error: "Storage not configured" },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const creator = searchParams.get("creator");

  if (!creator) {
    return NextResponse.json(
      { error: "Creator address required" },
      { status: 400 }
    );
  }

  try {
    const key = getMembershipKey(creator);
    const result = await filebase.getJSONByKey<CustomMembershipsMetadata>(key);

    if (!result || result.data.creator !== creator) {
      // No custom memberships configured yet
      return NextResponse.json({ tiers: [], cid: null });
    }

    return NextResponse.json({
      tiers: result.data.tiers,
      cid: result.cid,
      updatedAt: result.data.updatedAt,
    });
  } catch (error) {
    console.error("Error fetching custom memberships:", error);
    return NextResponse.json(
      { error: "Failed to fetch memberships" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/memberships/custom
 * Create or update custom membership tiers for a creator
 * Requires wallet signature for authentication
 */
export async function POST(request: NextRequest) {
  if (!filebase) {
    return NextResponse.json(
      { error: "Storage not configured" },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { creator, tiers, signature, timestamp } = body as {
      creator: string;
      tiers: CustomMembershipTier[];
      signature: string;
      timestamp: string;
    };

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
    const message = `Update Custom Memberships\nCreator: ${creator}\nTimestamp: ${timestamp}`;
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

    if (!Array.isArray(tiers)) {
      return NextResponse.json(
        { error: "Tiers must be an array" },
        { status: 400 }
      );
    }

    // Validate tiers
    for (const tier of tiers) {
      if (!tier.id || !tier.name || typeof tier.monthlyPrice !== "number") {
        return NextResponse.json(
          { error: "Invalid tier data" },
          { status: 400 }
        );
      }
      if (tier.monthlyPrice < 0) {
        return NextResponse.json(
          { error: "Price cannot be negative" },
          { status: 400 }
        );
      }
    }

    // Create metadata
    const metadata: CustomMembershipsMetadata = {
      version: 1,
      creator,
      tiers,
      updatedAt: Date.now(),
    };

    // Upload to S3/IPFS with fixed key for persistence
    const key = getMembershipKey(creator);
    const result = await filebase.uploadJSONWithKey(
      metadata as unknown as Record<string, unknown>,
      key
    );

    return NextResponse.json({
      success: true,
      cid: result.cid,
      tiers,
    });
  } catch (error) {
    console.error("Error saving custom memberships:", error);
    return NextResponse.json(
      { error: "Failed to save memberships" },
      { status: 500 }
    );
  }
}
