import crypto from "crypto";

export interface ReviewToken {
  contentCid: string;
  expiresAt: number;
  signature: string;
}

function getSecret(): string | undefined {
  if (typeof window !== "undefined") return undefined; // Client-side
  return process.env.SESSION_SECRET || process.env.CONTENT_ENCRYPTION_SECRET;
}

/**
 * Verify a review token (server-side only)
 * Returns the contentCid if valid, null if invalid/expired
 */
export function verifyReviewToken(token: string): string | null {
  const secret = getSecret();
  if (!secret) return null;

  try {
    const decoded = JSON.parse(
      Buffer.from(token, "base64url").toString("utf-8")
    ) as ReviewToken;

    // Check expiration
    if (decoded.expiresAt < Date.now()) {
      return null;
    }

    // Verify signature
    const payload = `review:${decoded.contentCid}:${decoded.expiresAt}`;
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    const signatureBuffer = Buffer.from(decoded.signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (signatureBuffer.length !== expectedBuffer.length) {
      return null;
    }

    if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
      return null;
    }

    return decoded.contentCid;
  } catch {
    return null;
  }
}

/**
 * Parse review token without verification (client-side check)
 * Returns contentCid and whether it appears unexpired
 */
export function parseReviewToken(token: string): { contentCid: string; valid: boolean } | null {
  try {
    const decoded = JSON.parse(
      Buffer.from(token, "base64url").toString("utf-8")
    ) as ReviewToken;
    return {
      contentCid: decoded.contentCid,
      valid: decoded.expiresAt > Date.now(),
    };
  } catch {
    return null;
  }
}
