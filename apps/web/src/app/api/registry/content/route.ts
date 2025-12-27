import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { createContentRegistryClient } from "@handcraft/sdk";

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

export interface ContentEntryResponse {
  pubkey: string;
  creator: string;
  collectionAsset: string;
  contentCid: string;
  metadataCid: string | null;
  previewCid: string | null;
  encryptionMetaCid: string | null;
  contentType: number;
  tipsReceived: string;
  isLocked: boolean;
  mintedCount: string;
  pendingCount: string;
  isEncrypted: boolean;
  visibilityLevel: number;
  collectionName: string | null;
  creatorAddress: string;
  thumbnail: string | null;
}

/**
 * GET /api/registry/content
 * Fetches all global content with Metaplex metadata enrichment
 *
 * Query params:
 * - creator (optional): Filter by creator address
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const creatorAddress = searchParams.get("creator");

    const connection = new Connection(RPC_URL, "confirmed");
    const client = createContentRegistryClient(connection);

    // Fetch all global content with metadata
    const content = await client.fetchGlobalContentWithMetadata();

    // Filter by creator if specified
    let filteredContent = content;
    if (creatorAddress) {
      try {
        const creatorPubkey = new PublicKey(creatorAddress);
        filteredContent = content.filter(c => c.creator.equals(creatorPubkey));
      } catch {
        return NextResponse.json({ error: "Invalid creator address" }, { status: 400 });
      }
    }

    // Convert to serializable format
    const response: ContentEntryResponse[] = filteredContent.map(c => ({
      pubkey: c.pubkey?.toBase58() || "",
      creator: c.creator.toBase58(),
      collectionAsset: c.collectionAsset?.toBase58() || "",
      contentCid: c.contentCid || "",
      metadataCid: c.metadataCid || null,
      previewCid: c.previewCid || null,
      encryptionMetaCid: c.encryptionMetaCid || null,
      contentType: c.contentType ?? 0,
      tipsReceived: (c.tipsReceived ?? BigInt(0)).toString(),
      isLocked: c.isLocked ?? false,
      mintedCount: (c.mintedCount ?? BigInt(0)).toString(),
      pendingCount: (c.pendingCount ?? BigInt(0)).toString(),
      isEncrypted: c.isEncrypted ?? false,
      visibilityLevel: c.visibilityLevel ?? 0,
      collectionName: c.collectionName || null,
      creatorAddress: c.creator.toBase58(),
      thumbnail: c.thumbnail || null,
    }));

    return NextResponse.json({
      data: response,
      count: response.length,
    });
  } catch (error) {
    console.error("Error fetching content registry:", error);
    return NextResponse.json(
      { error: "Failed to fetch content" },
      { status: 500 }
    );
  }
}
