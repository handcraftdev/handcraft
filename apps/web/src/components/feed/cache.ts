// Global cache for decrypted content URLs (persists across component re-renders)
// Key: `${walletAddress}:${contentCid}`, Value: blob URL
const decryptedContentCache = new Map<string, string>();

// Track which session token the cache was populated with
let cachedSessionToken: string | null = null;

export function getCachedDecryptedUrl(wallet: string, contentCid: string, sessionToken?: string | null): string | null {
  // If session token changed or is missing, cache is invalid
  if (sessionToken !== cachedSessionToken) {
    return null;
  }
  return decryptedContentCache.get(`${wallet}:${contentCid}`) || null;
}

export function setCachedDecryptedUrl(wallet: string, contentCid: string, url: string, sessionToken?: string | null): void {
  // Store the session token this cache entry is valid for
  if (sessionToken && sessionToken !== cachedSessionToken) {
    // New session - clear old cache and update token
    clearDecryptedContentCache();
    cachedSessionToken = sessionToken;
  }
  decryptedContentCache.set(`${wallet}:${contentCid}`, url);
}

export function clearDecryptedContentCache(): void {
  // Revoke all blob URLs to free memory
  decryptedContentCache.forEach((url) => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Ignore errors revoking URLs
    }
  });
  decryptedContentCache.clear();
  cachedSessionToken = null;
}

export function clearCacheForWallet(wallet: string): void {
  // Clear cache entries for a specific wallet
  const keysToDelete: string[] = [];
  decryptedContentCache.forEach((url, key) => {
    if (key.startsWith(`${wallet}:`)) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Ignore errors revoking URLs
      }
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => decryptedContentCache.delete(key));
}
