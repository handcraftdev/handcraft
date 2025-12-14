import crypto from "crypto";

// SECURITY: SESSION_SECRET should be separate from CONTENT_ENCRYPTION_SECRET
// Using the same secret for both purposes violates cryptographic key separation
const SESSION_SECRET = process.env.SESSION_SECRET || process.env.CONTENT_ENCRYPTION_SECRET;
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Warn if SESSION_SECRET is not explicitly set (falling back to encryption secret)
if (typeof window === "undefined" && !process.env.SESSION_SECRET && process.env.CONTENT_ENCRYPTION_SECRET) {
  console.warn(
    "[SECURITY WARNING] SESSION_SECRET not set - falling back to CONTENT_ENCRYPTION_SECRET.\n" +
    "This violates cryptographic key separation principle.\n" +
    "Set a separate SESSION_SECRET environment variable in production."
  );
}

// Error if no secret is available at all
if (typeof window === "undefined" && !SESSION_SECRET) {
  console.error(
    "[SECURITY ERROR] Neither SESSION_SECRET nor CONTENT_ENCRYPTION_SECRET is set.\n" +
    "Session authentication will not work."
  );
}

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

    // Verify signature using constant-time comparison to prevent timing attacks
    const payload = `${decoded.wallet}:${decoded.expiresAt}`;
    const expectedSignature = crypto
      .createHmac("sha256", SESSION_SECRET)
      .update(payload)
      .digest("hex");

    // SECURITY: Use constant-time comparison to prevent timing attacks
    const signatureBuffer = Buffer.from(decoded.signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    // Ensure both buffers are the same length (prevents timing leak from length check)
    if (signatureBuffer.length !== expectedBuffer.length) {
      return null;
    }

    if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
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
