import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { createContentRegistryClient, getBundlePda } from "@handcraft/sdk";

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

export interface BundleResponse {
  pubkey: string;
  creator: string;
  bundleId: string;
  bundleType: number;
  collectionAsset: string | null;
  itemCount: number;
  isActive: boolean;
  metadataCid: string | null;
  creatorAddress: string;
  collectionName: string | null;
}

export interface BundleItemResponse {
  pubkey: string;
  bundle: string;
  contentCid: string;
  position: number;
  addedAt: string;
}

/**
 * GET /api/registry/bundles
 * Fetches all global bundles
 *
 * Query params:
 * - creator (optional): Filter by creator address
 * - bundleId (optional): Get specific bundle with items
 * - withItems (optional): Include bundle items in response
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const creatorAddress = searchParams.get("creator");
    const bundleId = searchParams.get("bundleId");
    const withItems = searchParams.get("withItems") === "true";

    const connection = new Connection(RPC_URL, "confirmed");
    const client = createContentRegistryClient(connection);

    // If specific bundle requested with items
    if (bundleId && creatorAddress) {
      try {
        const creatorPubkey = new PublicKey(creatorAddress);
        const bundleWithItems = await client.fetchBundleWithItems(creatorPubkey, bundleId);

        if (!bundleWithItems) {
          return NextResponse.json({ data: null });
        }

        const { bundle, items } = bundleWithItems;
        const [bundlePda] = getBundlePda(bundle.creator, bundle.bundleId);
        const response = {
          bundle: {
            pubkey: bundlePda.toBase58(),
            creator: bundle.creator.toBase58(),
            bundleId: bundle.bundleId,
            bundleType: bundle.bundleType,
            collectionAsset: bundle.collectionAsset?.toBase58() || null,
            itemCount: bundle.itemCount,
            isActive: bundle.isActive,
            metadataCid: bundle.metadataCid || null,
            creatorAddress: bundle.creator.toBase58(),
            collectionName: bundle.collectionName || null,
          } as BundleResponse,
          items: items.map(({ item, content }) => ({
            pubkey: item.content?.toBase58() || "", // Use content PDA as pubkey
            bundle: item.bundle?.toBase58() || "",
            contentCid: content?.contentCid || "",
            position: item.position,
            addedAt: item.addedAt?.toString() || "0",
          })) as BundleItemResponse[],
        };

        return NextResponse.json({ data: response });
      } catch {
        return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
      }
    }

    // Fetch all bundles
    const bundles = await client.fetchAllBundles();

    // Filter by creator if specified
    let filteredBundles = bundles;
    if (creatorAddress) {
      try {
        const creatorPubkey = new PublicKey(creatorAddress);
        filteredBundles = bundles.filter(b => b.creator.equals(creatorPubkey));
      } catch {
        return NextResponse.json({ error: "Invalid creator address" }, { status: 400 });
      }
    }

    // Convert to serializable format
    const response: BundleResponse[] = filteredBundles.map(b => {
      const [bundlePda] = getBundlePda(b.creator, b.bundleId);
      return {
        pubkey: bundlePda.toBase58(),
        creator: b.creator.toBase58(),
        bundleId: b.bundleId,
        bundleType: b.bundleType,
        collectionAsset: b.collectionAsset?.toBase58() || null,
        itemCount: b.itemCount,
        isActive: b.isActive,
        metadataCid: b.metadataCid || null,
        creatorAddress: b.creator.toBase58(),
        collectionName: b.collectionName || null,
      };
    });

    // Optionally fetch items for each bundle
    if (withItems) {
      const bundlesWithItems = await Promise.all(
        filteredBundles.map(async b => {
          const bundleWithItems = await client.fetchBundleWithItems(b.creator, b.bundleId);
          const [bundlePda] = getBundlePda(b.creator, b.bundleId);
          return {
            bundle: {
              pubkey: bundlePda.toBase58(),
              creator: b.creator.toBase58(),
              bundleId: b.bundleId,
              bundleType: b.bundleType,
              collectionAsset: b.collectionAsset?.toBase58() || null,
              itemCount: b.itemCount,
              isActive: b.isActive,
              metadataCid: b.metadataCid || null,
              creatorAddress: b.creator.toBase58(),
              collectionName: b.collectionName || null,
            } as BundleResponse,
            items: (bundleWithItems?.items || []).map(({ item, content }) => ({
              pubkey: item.content?.toBase58() || "", // Use content PDA as pubkey
              bundle: item.bundle?.toBase58() || "",
              contentCid: content?.contentCid || "",
              position: item.position,
              addedAt: item.addedAt?.toString() || "0",
            })) as BundleItemResponse[],
          };
        })
      );

      return NextResponse.json({
        data: bundlesWithItems,
        count: bundlesWithItems.length,
      });
    }

    return NextResponse.json({
      data: response,
      count: response.length,
    });
  } catch (error) {
    console.error("Error fetching bundles:", error);
    return NextResponse.json(
      { error: "Failed to fetch bundles" },
      { status: 500 }
    );
  }
}
