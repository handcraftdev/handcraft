import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { createContentRegistryClient } from "@handcraft/sdk";
import type { UserProfileResponse } from "../profile/route";

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

/**
 * POST /api/registry/profiles
 * Batch fetches user profiles for multiple wallet addresses
 *
 * Body:
 * - addresses (required): Array of wallet addresses to fetch profiles for
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const addresses: string[] = body.addresses;

    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
      return NextResponse.json({ error: "Missing or invalid addresses array" }, { status: 400 });
    }

    // Validate all pubkeys
    const pubkeys: PublicKey[] = [];
    for (const address of addresses) {
      try {
        pubkeys.push(new PublicKey(address));
      } catch {
        return NextResponse.json({ error: `Invalid wallet address: ${address}` }, { status: 400 });
      }
    }

    const connection = new Connection(RPC_URL, "confirmed");
    const client = createContentRegistryClient(connection);

    const profilesMap = await client.fetchUserProfilesBatch(pubkeys);

    // Convert Map to serializable object
    const result: Record<string, UserProfileResponse | null> = {};
    for (const address of addresses) {
      const profile = profilesMap.get(address);
      if (profile) {
        result[address] = {
          owner: profile.owner.toBase58(),
          username: profile.username,
          createdAt: profile.createdAt.toString(),
          updatedAt: profile.updatedAt.toString(),
        };
      } else {
        result[address] = null;
      }
    }

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("Error fetching user profiles batch:", error);
    return NextResponse.json(
      { error: "Failed to fetch profiles" },
      { status: 500 }
    );
  }
}
