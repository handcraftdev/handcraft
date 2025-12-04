import crypto from "crypto";

const SESSION_SECRET = process.env.SESSION_SECRET || process.env.CONTENT_ENCRYPTION_SECRET;
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface SessionToken {
  wallet: string;
  expiresAt: number;
  signature: string;
}

/**
 * Create a session token for a wallet after signature verification
 */
export function createSessionToken(wallet: string): string {
  if (!SESSION_SECRET) {
    throw new Error("Session secret not configured");
  }

  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const payload = `${wallet}:${expiresAt}`;
  const signature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payload)
    .digest("hex");

  // Return as base64-encoded JSON
  const token: SessionToken = { wallet, expiresAt, signature };
  return Buffer.from(JSON.stringify(token)).toString("base64");
}

/**
 * Verify and decode a session token
 * Returns the wallet address if valid, null if invalid/expired
 */
export function verifySessionToken(token: string): string | null {
  if (!SESSION_SECRET) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(token, "base64").toString("utf-8")
    ) as SessionToken;

    // Check expiration
    if (decoded.expiresAt < Date.now()) {
      return null;
    }

    // Verify signature
    const payload = `${decoded.wallet}:${decoded.expiresAt}`;
    const expectedSignature = crypto
      .createHmac("sha256", SESSION_SECRET)
      .update(payload)
      .digest("hex");

    if (decoded.signature !== expectedSignature) {
      return null;
    }

    return decoded.wallet;
  } catch {
    return null;
  }
}

/**
 * Check if a session token is valid (for client-side pre-check)
 */
export function isSessionValid(token: string): boolean {
  try {
    const decoded = JSON.parse(
      Buffer.from(token, "base64").toString("utf-8")
    ) as SessionToken;
    return decoded.expiresAt > Date.now();
  } catch {
    return false;
  }
}

/**
 * Get wallet from token without full verification (client-side use)
 */
export function getWalletFromToken(token: string): string | null {
  try {
    const decoded = JSON.parse(
      Buffer.from(token, "base64").toString("utf-8")
    ) as SessionToken;
    return decoded.wallet;
  } catch {
    return null;
  }
}
