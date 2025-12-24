import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { getCreatorPatronConfigPda } from "@handcraft/sdk";

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

export interface MembershipConfigResponse {
  creator: string;
  monthlyPrice: string; // bigint as string
  isActive: boolean;
}

/**
 * GET /api/membership/config?creator=<pubkey>
 * Fetches membership config for a creator
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const creatorAddress = searchParams.get("creator");

    if (!creatorAddress) {
      return NextResponse.json({ error: "Missing creator parameter" }, { status: 400 });
    }

    // Validate pubkey format
    let creator: PublicKey;
    try {
      creator = new PublicKey(creatorAddress);
    } catch {
      return NextResponse.json({ error: "Invalid creator address" }, { status: 400 });
    }

    const connection = new Connection(RPC_URL, "confirmed");
    const [configPda] = getCreatorPatronConfigPda(creator);
    const accountInfo = await connection.getAccountInfo(configPda);

    if (!accountInfo || !accountInfo.data) {
      return NextResponse.json({ data: null });
    }

    const data = accountInfo.data;
    // CreatorPatronConfig layout (73 bytes total):
    // discriminator: 8, creator: 32, membershipPrice: 8, subscriptionPrice: 8,
    // isActive: 1, createdAt: 8, updatedAt: 8
    if (data.length < 57) {
      return NextResponse.json({ data: null });
    }

    // We use subscriptionPrice as the monthly price (membershipPrice is deprecated)
    const subscriptionPrice = data.readBigUInt64LE(48);
    const isActive = data[56] === 1;

    const response: MembershipConfigResponse = {
      creator: creatorAddress,
      monthlyPrice: subscriptionPrice.toString(),
      isActive,
    };

    return NextResponse.json({ data: response });
  } catch (error) {
    console.error("Error fetching membership config:", error);
    return NextResponse.json(
      { error: "Failed to fetch membership config" },
      { status: 500 }
    );
  }
}
