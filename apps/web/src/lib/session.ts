import crypto from "crypto";

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const IS_SERVER = typeof window === "undefined";

// SECURITY: SESSION_SECRET MUST be separate from CONTENT_ENCRYPTION_SECRET
// Using the same secret for both purposes violates cryptographic key separation

/**
 * Get the session secret, validating security requirements.
 * In production, SESSION_SECRET must be explicitly set.
 * In development, falls back to CONTENT_ENCRYPTION_SECRET with warning.
 */
function getSessionSecret(): string | undefined {
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }

  const IS_PRODUCTION = process.env.NODE_ENV === "production";
  const IS_BUILD = process.env.NEXT_PHASE === "phase-production-build";

  if (IS_PRODUCTION && !IS_BUILD) {
    // In production runtime, refuse to operate without proper session secret
    throw new Error(
      "[SECURITY ERROR] SESSION_SECRET environment variable is required in production.\n" +
      "Do NOT reuse CONTENT_ENCRYPTION_SECRET for session management.\n" +
      "Generate a unique secret: openssl rand -hex 32"
    );
  }

  if (process.env.CONTENT_ENCRYPTION_SECRET) {
    // In development/build, allow fallback with warning
    if (!IS_BUILD) {
      console.warn(
        "[SECURITY WARNING] SESSION_SECRET not set - using CONTENT_ENCRYPTION_SECRET.\n" +
        "This is NOT allowed in production. Set a separate SESSION_SECRET."
      );
    }
    return process.env.CONTENT_ENCRYPTION_SECRET;
  }

  if (!IS_BUILD) {
    console.error(
      "[SECURITY ERROR] Neither SESSION_SECRET nor CONTENT_ENCRYPTION_SECRET is set.\n" +
      "Session authentication will not work."
    );
  }

  return undefined;
}

// Lazy-load secret on first use (avoids build-time errors)
let _sessionSecret: string | undefined | null = null;
function getSecret(): string | undefined {
  if (_sessionSecret === null) {
    _sessionSecret = IS_SERVER ? getSessionSecret() : undefined;
  }
  return _sessionSecret;
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
  const secret = getSecret();
  if (!secret) {
    throw new Error("Session secret not configured");
  }

  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const payload = `${wallet}:${expiresAt}`;
  const signature = crypto
    .createHmac("sha256", secret)
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
  const secret = getSecret();
  if (!secret) {
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
      .createHmac("sha256", secret)
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
