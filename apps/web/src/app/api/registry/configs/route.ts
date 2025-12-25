import { NextRequest, NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";
import { createContentRegistryClient } from "@handcraft/sdk";

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

export interface MintConfigResponse {
  content: string;
  creator: string;
  priceSol: string;
  maxSupply: string | null;
  creatorRoyaltyBps: number;
  isActive: boolean;
  createdAt: string;
}

export interface RentConfigResponse {
  content: string;
  creator: string;
  rentFee6h: string;
  rentFee1d: string;
  rentFee7d: string;
  isActive: boolean;
  totalRentals: string;
  totalFeesCollected: string;
  createdAt: string;
  updatedAt: string;
}

export interface BundleMintConfigResponse {
  bundle: string;
  creator: string;
  price: string;
  maxSupply: string | null;
  creatorRoyaltyBps: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BundleRentConfigResponse {
  bundle: string;
  creator: string;
  rentFee6h: string;
  rentFee1d: string;
  rentFee7d: string;
  isActive: boolean;
  totalRentals: string;
  totalFeesCollected: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * GET /api/registry/configs
 * Fetches mint and rent configs
 *
 * Query params:
 * - type: "mint" | "rent" | "bundleMint" | "bundleRent" | "all"
 * - contentCid (optional): Filter mint/rent configs by content CID
 * - bundleId (optional): Filter bundle configs by bundle ID
 * - creator (optional): Filter bundle configs by creator
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "all";

    const connection = new Connection(RPC_URL, "confirmed");
    const client = createContentRegistryClient(connection);

    const result: {
      mintConfigs?: MintConfigResponse[];
      rentConfigs?: RentConfigResponse[];
      bundleMintConfigs?: BundleMintConfigResponse[];
      bundleRentConfigs?: BundleRentConfigResponse[];
    } = {};

    // Fetch mint configs (returns Map, convert to array)
    if (type === "mint" || type === "all") {
      const configsMap = await client.fetchAllMintConfigs();
      result.mintConfigs = Array.from(configsMap.values()).map(c => ({
        content: c.content.toBase58(),
        creator: c.creator.toBase58(),
        priceSol: c.priceSol.toString(),
        maxSupply: c.maxSupply?.toString() || null,
        creatorRoyaltyBps: c.creatorRoyaltyBps,
        isActive: c.isActive,
        createdAt: c.createdAt.toString(),
      }));
    }

    // Fetch rent configs (returns Map, convert to array)
    if (type === "rent" || type === "all") {
      const configsMap = await client.fetchAllRentConfigs();
      result.rentConfigs = Array.from(configsMap.values()).map(c => ({
        content: c.content.toBase58(),
        creator: c.creator.toBase58(),
        rentFee6h: c.rentFee6h.toString(),
        rentFee1d: c.rentFee1d.toString(),
        rentFee7d: c.rentFee7d.toString(),
        isActive: c.isActive,
        totalRentals: c.totalRentals.toString(),
        totalFeesCollected: c.totalFeesCollected.toString(),
        createdAt: c.createdAt.toString(),
        updatedAt: c.updatedAt.toString(),
      }));
    }

    // Fetch bundle mint configs (returns Map, convert to array)
    if (type === "bundleMint" || type === "all") {
      const configsMap = await client.fetchAllBundleMintConfigs();
      result.bundleMintConfigs = Array.from(configsMap.values()).map(c => ({
        bundle: c.bundle.toBase58(),
        creator: c.creator.toBase58(),
        price: c.price.toString(),
        maxSupply: c.maxSupply?.toString() || null,
        creatorRoyaltyBps: c.creatorRoyaltyBps,
        isActive: c.isActive,
        createdAt: c.createdAt.toString(),
        updatedAt: c.updatedAt.toString(),
      }));
    }

    // NOTE: Bundle rent configs not yet implemented in SDK
    // If type === "bundleRent", no data will be returned

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("Error fetching configs:", error);
    return NextResponse.json(
      { error: "Failed to fetch configs" },
      { status: 500 }
    );
  }
}
