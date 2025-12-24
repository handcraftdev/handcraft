import { NextRequest, NextResponse } from "next/server";
import { StreamflowClient } from "@handcraft/sdk";

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const SOLANA_NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet") as "mainnet" | "devnet" | "testnet";

export interface StreamInfoResponse {
  id: string;
  sender: string;
  recipient: string;
  name: string;
  depositedAmount: string;
  withdrawnAmount: string;
  startTime: number;
  endTime: number;
  canceledAt: number;
  cancelableBySender: boolean;
  cancelableByRecipient: boolean;
}

/**
 * GET /api/membership/stream?id=<streamId>
 * Fetches stream info from Streamflow
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const streamId = searchParams.get("id");

    if (!streamId) {
      return NextResponse.json({ error: "Missing stream id parameter" }, { status: 400 });
    }

    const streamflowClient = new StreamflowClient({
      cluster: SOLANA_NETWORK,
      rpcUrl: RPC_URL,
    });

    const stream = await streamflowClient.getStream(streamId);

    if (!stream) {
      return NextResponse.json({ data: null });
    }

    const response: StreamInfoResponse = {
      id: stream.id,
      sender: stream.sender,
      recipient: stream.recipient,
      name: stream.name,
      depositedAmount: stream.depositedAmount.toString(),
      withdrawnAmount: stream.withdrawnAmount.toString(),
      startTime: stream.startTime,
      endTime: stream.endTime,
      canceledAt: stream.canceledAt,
      cancelableBySender: stream.cancelableBySender,
      cancelableByRecipient: stream.cancelableByRecipient,
    };

    return NextResponse.json({ data: response });
  } catch (error) {
    console.error("Error fetching stream info:", error);
    return NextResponse.json(
      { error: "Failed to fetch stream info" },
      { status: 500 }
    );
  }
}
