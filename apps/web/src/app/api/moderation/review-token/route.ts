import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const REVIEW_TOKEN_DURATION_MS = 60 * 60 * 1000; // 1 hour

function getSecret(): string | undefined {
  return process.env.SESSION_SECRET || process.env.CONTENT_ENCRYPTION_SECRET;
}

export interface ReviewToken {
  contentCid: string;
  expiresAt: number;
  signature: string;
}

/**
 * POST /api/moderation/review-token
 * Generate a signed review token for jurors to view disputed content
 */
export async function POST(request: NextRequest) {
  try {
    const { contentCid } = await request.json();

    if (!contentCid || typeof contentCid !== "string") {
      return NextResponse.json(
        { error: "contentCid is required" },
        { status: 400 }
      );
    }

    const secret = getSecret();
    if (!secret) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const expiresAt = Date.now() + REVIEW_TOKEN_DURATION_MS;
    const payload = `review:${contentCid}:${expiresAt}`;
    const signature = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    const token: ReviewToken = { contentCid, expiresAt, signature };
    const encodedToken = Buffer.from(JSON.stringify(token)).toString("base64url");

    return NextResponse.json({ token: encodedToken });
  } catch (error) {
    console.error("Error generating review token:", error);
    return NextResponse.json(
      { error: "Failed to generate token" },
      { status: 500 }
    );
  }
}
