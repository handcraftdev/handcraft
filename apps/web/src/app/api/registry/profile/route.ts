import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { createContentRegistryClient } from "@handcraft/sdk";

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

export interface UserProfileResponse {
  owner: string;
  username: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * GET /api/registry/profile
 * Fetches user profile for a wallet address
 *
 * Query params:
 * - address (required): Wallet address to fetch profile for
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");

    if (!address) {
      return NextResponse.json({ error: "Missing address parameter" }, { status: 400 });
    }

    // Validate pubkey format
    let walletPubkey: PublicKey;
    try {
      walletPubkey = new PublicKey(address);
    } catch {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
    }

    const connection = new Connection(RPC_URL, "confirmed");
    const client = createContentRegistryClient(connection);

    const profile = await client.fetchUserProfile(walletPubkey);

    if (!profile) {
      return NextResponse.json({ data: null });
    }

    const response: UserProfileResponse = {
      owner: profile.owner.toBase58(),
      username: profile.username,
      createdAt: profile.createdAt.toString(),
      updatedAt: profile.updatedAt.toString(),
    };

    return NextResponse.json({ data: response });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}
