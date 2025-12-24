import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import {
  getEcosystemSubConfigPda,
  getEcosystemSubscriptionPda,
  getEcosystemStreamingTreasuryPda,
  StreamflowClient,
} from "@handcraft/sdk";

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const SOLANA_NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet") as "mainnet" | "devnet" | "testnet";

export interface EcosystemConfigResponse {
  price: string; // bigint as string
  isActive: boolean;
  authority: string;
}

export interface EcosystemMembershipResponse {
  subscriber: string;
  streamId: string;
  startedAt: string; // bigint as string
  isActive: boolean;
  isValid: boolean;
}

/**
 * GET /api/membership/ecosystem
 * Without subscriber param: returns ecosystem config
 * With subscriber param: returns membership status for that subscriber
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subscriberAddress = searchParams.get("subscriber");

    const connection = new Connection(RPC_URL, "confirmed");

    // If no subscriber, return ecosystem config
    if (!subscriberAddress) {
      const [configPda] = getEcosystemSubConfigPda();
      const accountInfo = await connection.getAccountInfo(configPda);

      if (!accountInfo || !accountInfo.data) {
        return NextResponse.json({ data: null });
      }

      const data = accountInfo.data;
      if (data.length < 49) {
        return NextResponse.json({ data: null });
      }

      // EcosystemSubConfig layout:
      // discriminator: 8, price: 8, isActive: 1, authority: 32
      const price = data.readBigUInt64LE(8);
      const isActive = data[16] === 1;
      const authorityBytes = data.slice(17, 49);
      const authority = new PublicKey(authorityBytes);

      const response: EcosystemConfigResponse = {
        price: price.toString(),
        isActive,
        authority: authority.toBase58(),
      };

      return NextResponse.json({ data: response, type: "config" });
    }

    // Validate subscriber pubkey
    let subscriber: PublicKey;
    try {
      subscriber = new PublicKey(subscriberAddress);
    } catch {
      return NextResponse.json({ error: "Invalid subscriber address" }, { status: 400 });
    }

    // Check membership status
    const [treasuryPda] = getEcosystemStreamingTreasuryPda();
    const [subscriptionPda] = getEcosystemSubscriptionPda(subscriber);

    console.log("=== ECOSYSTEM MEMBERSHIP CHECK (API) ===");
    console.log("Treasury PDA:", treasuryPda.toBase58());
    console.log("Subscription PDA:", subscriptionPda.toBase58());

    // PRIMARY: Check on-chain subscription account (created by CPI)
    const subscriptionAccount = await connection.getAccountInfo(subscriptionPda);
    const streamflowClient = new StreamflowClient({
      cluster: SOLANA_NETWORK,
      rpcUrl: RPC_URL,
    });

    if (subscriptionAccount && subscriptionAccount.data.length >= 8 + 32 + 32 + 8 + 1) {
      // EcosystemSubscription layout:
      // discriminator: 8, subscriber: 32, stream_id: 32, started_at: 8, is_active: 1
      const data = subscriptionAccount.data;
      const streamIdBytes = data.slice(40, 72);
      const streamId = new PublicKey(streamIdBytes);
      const startedAt = data.readBigInt64LE(72);
      const isActive = data[80] === 1;

      console.log("On-chain subscription found:", {
        streamId: streamId.toBase58(),
        startedAt: startedAt.toString(),
        isActive,
      });

      if (isActive) {
        // Verify stream is still valid via Streamflow
        try {
          const stream = await streamflowClient.getStream(streamId.toBase58());
          if (stream) {
            const now = Math.floor(Date.now() / 1000);
            const hasTimeRemaining = stream.endTime > now;
            const wasFunded = stream.depositedAmount.toNumber() > 0;
            const isNotCancelled = stream.canceledAt === 0;
            const recipientMatches = stream.recipient === treasuryPda.toBase58();

            console.log("Stream verification:", {
              id: stream.id,
              recipient: stream.recipient,
              hasTimeRemaining,
              wasFunded,
              isNotCancelled,
              recipientMatches,
            });

            if (hasTimeRemaining && wasFunded && isNotCancelled && recipientMatches) {
              const response: EcosystemMembershipResponse = {
                subscriber: subscriberAddress,
                streamId: streamId.toBase58(),
                startedAt: stream.startTime.toString(),
                isActive: true,
                isValid: true,
              };
              return NextResponse.json({ data: response, type: "membership" });
            }
          }
        } catch (err) {
          console.log("Stream fetch error (may be indexer delay):", err);
          // If we can't fetch but account exists, still show as member
          const response: EcosystemMembershipResponse = {
            subscriber: subscriberAddress,
            streamId: streamId.toBase58(),
            startedAt: startedAt.toString(),
            isActive: true,
            isValid: true,
          };
          return NextResponse.json({ data: response, type: "membership" });
        }
      }
    } else {
      console.log("No on-chain subscription account found");
    }

    // FALLBACK: Check Streamflow directly (for legacy/non-CPI streams)
    const streams = await streamflowClient.getStreamsForWallet(subscriber);
    console.log("Fallback: checking", streams.length, "streams from Streamflow");

    const now = Math.floor(Date.now() / 1000);
    const activeStream = streams.find(stream => {
      const isToTreasury = stream.recipient === treasuryPda.toBase58();
      const hasTimeRemaining = stream.endTime > now;
      const wasFunded = stream.depositedAmount.toNumber() > 0;
      const isNotCancelled = stream.canceledAt === 0;
      return isToTreasury && hasTimeRemaining && wasFunded && isNotCancelled;
    });

    if (activeStream) {
      console.log("Found active stream via fallback:", activeStream.id);
      const response: EcosystemMembershipResponse = {
        subscriber: subscriberAddress,
        streamId: activeStream.id,
        startedAt: activeStream.startTime.toString(),
        isActive: true,
        isValid: true,
      };
      return NextResponse.json({ data: response, type: "membership" });
    }

    console.log("No active ecosystem membership found");
    return NextResponse.json({ data: null, type: "membership" });
  } catch (error) {
    console.error("Error fetching ecosystem membership:", error);
    return NextResponse.json(
      { error: "Failed to fetch ecosystem membership" },
      { status: 500 }
    );
  }
}
