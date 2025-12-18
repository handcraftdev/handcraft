/**
 * Simple in-memory rate limiter for API routes
 *
 * NOTE: This is suitable for single-instance deployments.
 * For distributed deployments, upgrade to Upstash Redis:
 *   npm install @upstash/ratelimit @upstash/redis
 *
 * @example
 * import { rateLimit, RATE_LIMITS } from "@/lib/ratelimit";
 *
 * export async function POST(request: NextRequest) {
 *   const result = await rateLimit(request, RATE_LIMITS.api);
 *   if (!result.success) {
 *     return NextResponse.json(
 *       { error: "Too many requests" },
 *       { status: 429, headers: { "Retry-After": String(result.retryAfter) } }
 *     );
 *   }
 *   // ... handle request
 * }
 */

import { NextRequest } from "next/server";

interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  limit: number;
  /** Time window in seconds */
  window: number;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  retryAfter: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (cleared on server restart)
const store = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) {
      store.delete(key);
    }
  }
}

/**
 * Get client identifier from request
 * Uses X-Forwarded-For (for proxies), X-Real-IP, or falls back to a default
 */
function getClientId(request: NextRequest): string {
  // Check for forwarded IP (common with proxies/load balancers)
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // Take the first IP in the chain (original client)
    return forwarded.split(",")[0].trim();
  }

  // Check for real IP header
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Fallback - in production this should be configured properly
  return "unknown";
}

/**
 * Apply rate limiting to a request
 */
export async function rateLimit(
  request: NextRequest,
  config: RateLimitConfig,
  identifier?: string
): Promise<RateLimitResult> {
  cleanup();

  const clientId = identifier || getClientId(request);
  const path = new URL(request.url).pathname;
  const key = `${clientId}:${path}`;

  const now = Date.now();
  const windowMs = config.window * 1000;

  let entry = store.get(key);

  // If no entry or window expired, create new entry
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 1,
      resetAt: now + windowMs,
    };
    store.set(key, entry);

    return {
      success: true,
      remaining: config.limit - 1,
      retryAfter: 0,
    };
  }

  // Increment count
  entry.count++;

  // Check if over limit
  if (entry.count > config.limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return {
      success: false,
      remaining: 0,
      retryAfter,
    };
  }

  return {
    success: true,
    remaining: config.limit - entry.count,
    retryAfter: 0,
  };
}

/**
 * Rate limit by a custom key (e.g., wallet address)
 */
export async function rateLimitByKey(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  cleanup();

  const now = Date.now();
  const windowMs = config.window * 1000;

  let entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    entry = {
      count: 1,
      resetAt: now + windowMs,
    };
    store.set(key, entry);

    return {
      success: true,
      remaining: config.limit - 1,
      retryAfter: 0,
    };
  }

  entry.count++;

  if (entry.count > config.limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return {
      success: false,
      remaining: 0,
      retryAfter,
    };
  }

  return {
    success: true,
    remaining: config.limit - entry.count,
    retryAfter: 0,
  };
}

/**
 * Pre-configured rate limits for different endpoints
 */
export const RATE_LIMITS = {
  // Session creation - strict to prevent brute force
  session: { limit: 5, window: 60 } as RateLimitConfig, // 5 per minute

  // Content access - moderate
  content: { limit: 60, window: 60 } as RateLimitConfig, // 60 per minute

  // API general - standard
  api: { limit: 30, window: 60 } as RateLimitConfig, // 30 per minute

  // Search - moderate (can be resource intensive)
  search: { limit: 20, window: 60 } as RateLimitConfig, // 20 per minute

  // Upload - strict (resource intensive)
  upload: { limit: 10, window: 60 } as RateLimitConfig, // 10 per minute

  // Webhook - lenient (trusted source but prevent abuse)
  webhook: { limit: 100, window: 60 } as RateLimitConfig, // 100 per minute
} as const;
