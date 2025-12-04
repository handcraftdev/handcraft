import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import { createSessionToken } from "@/lib/session";

/**
 * Session API - Create a session after wallet signature verification
 *
 * POST body:
 * - wallet: The wallet address
 * - signature: Signature proving wallet ownership
 * - timestamp: Timestamp that was signed
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet, signature, timestamp } = body;

    if (!wallet || !signature || !timestamp) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Verify signature is recent (within 5 minutes)
    const timestampNum = parseInt(timestamp);
    const now = Date.now();
    if (Math.abs(now - timestampNum) > 5 * 60 * 1000) {
      return NextResponse.json(
        { error: "Signature expired" },
        { status: 401 }
      );
    }

    // Verify wallet signature
    const message = `Handcraft Session\nTimestamp: ${timestamp}`;
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = Uint8Array.from(Buffer.from(signature, "base64"));
    const walletPubkey = new PublicKey(wallet);

    const isValidSignature = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      walletPubkey.toBytes()
    );

    if (!isValidSignature) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Create session token
    const sessionToken = createSessionToken(wallet);

    return NextResponse.json({
      token: sessionToken,
      expiresIn: 24 * 60 * 60 * 1000, // 24 hours in ms
    });
  } catch (error) {
    console.error("Session creation error:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}
