import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import {
  getCreatorPatronTreasuryPda,
  StreamflowClient,
} from "@handcraft/sdk";

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const SOLANA_NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet") as "mainnet" | "devnet" | "testnet";

export type BillingPeriod = "monthly" | "yearly";

export interface CreatorMembershipResponse {
  subscriber: string;
  creator: string;
  billingPeriod: BillingPeriod;
  streamId: string;
  startedAt: string; // bigint as string
  isActive: boolean;
  isValid: boolean;
}

/**
 * GET /api/membership/creator?subscriber=<pubkey>&creator=<pubkey>
 * Fetches creator membership status for a subscriber
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subscriberAddress = searchParams.get("subscriber");
    const creatorAddress = searchParams.get("creator");

    if (!subscriberAddress || !creatorAddress) {
      return NextResponse.json(
        { error: "Missing subscriber or creator parameter" },
        { status: 400 }
      );
    }

    // Validate pubkeys
    let subscriber: PublicKey;
    let creator: PublicKey;
    try {
      subscriber = new PublicKey(subscriberAddress);
      creator = new PublicKey(creatorAddress);
    } catch {
      return NextResponse.json({ error: "Invalid address format" }, { status: 400 });
    }

    const connection = new Connection(RPC_URL, "confirmed");
    const streamflowClient = new StreamflowClient({
      cluster: SOLANA_NETWORK,
      rpcUrl: RPC_URL,
    });

    // Get creator's patron treasury PDA (where streams should go)
    const [treasuryPda] = getCreatorPatronTreasuryPda(creator);

    // Get all streams from this user
    const streams = await streamflowClient.getStreamsForWallet(subscriber);

    console.log("=== CREATOR MEMBERSHIP CHECK (API) ===");
    console.log("Creator:", creatorAddress);
    console.log("Treasury PDA:", treasuryPda.toBase58());
    console.log("Total streams:", streams.length);

    // Find active stream to creator's treasury PDA
    const now = Math.floor(Date.now() / 1000);
    const activeStream = streams.find(stream => {
      const isToTreasury = stream.recipient === treasuryPda.toBase58();
      const hasTimeRemaining = stream.endTime > now;
      const wasFunded = stream.depositedAmount.toNumber() > 0;
      // Stream is active if canceledAt is 0 (not cancelled)
      const isNotCancelled = stream.canceledAt === 0;

      return isToTreasury && hasTimeRemaining && wasFunded && isNotCancelled;
    });

    if (!activeStream) {
      console.log("No active stream to treasury found");
      return NextResponse.json({ data: null });
    }

    console.log("Active stream:", activeStream.id);

    // Determine billing period from duration
    const duration = activeStream.endTime - activeStream.startTime;
    const billingPeriod: BillingPeriod = duration > 60 * 24 * 60 * 60 ? "yearly" : "monthly";

    const response: CreatorMembershipResponse = {
      subscriber: subscriberAddress,
      creator: creatorAddress,
      billingPeriod,
      streamId: activeStream.id,
      startedAt: activeStream.startTime.toString(),
      isActive: true,
      isValid: true,
    };

    return NextResponse.json({ data: response });
  } catch (error) {
    console.error("Error fetching creator membership:", error);
    return NextResponse.json(
      { error: "Failed to fetch creator membership" },
      { status: 500 }
    );
  }
}
