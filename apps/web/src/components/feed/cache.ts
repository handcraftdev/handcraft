// Global cache for decrypted content URLs (persists across component re-renders)
// Key: `${walletAddress}:${contentCid}`, Value: blob URL
const decryptedContentCache = new Map<string, string>();

export function getCachedDecryptedUrl(wallet: string, contentCid: string): string | null {
  return decryptedContentCache.get(`${wallet}:${contentCid}`) || null;
}

export function setCachedDecryptedUrl(wallet: string, contentCid: string, url: string): void {
  decryptedContentCache.set(`${wallet}:${contentCid}`, url);
}
