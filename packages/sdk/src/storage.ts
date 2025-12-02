import { STORAGE } from "./constants";

/**
 * Storage utility functions for IPFS and Arweave
 */

/**
 * Get the full URL for an IPFS CID
 */
export function getIpfsUrl(cid: string): string {
  if (!cid) return "";
  // Handle already-full URLs
  if (cid.startsWith("http")) return cid;
  // Handle ipfs:// protocol
  if (cid.startsWith("ipfs://")) {
    return `${STORAGE.IPFS_GATEWAY}${cid.replace("ipfs://", "")}`;
  }
  return `${STORAGE.IPFS_GATEWAY}${cid}`;
}

/**
 * Get the full URL for an Arweave transaction ID
 */
export function getArweaveUrl(txId: string): string {
  if (!txId) return "";
  if (txId.startsWith("http")) return txId;
  if (txId.startsWith("ar://")) {
    return `${STORAGE.ARWEAVE_GATEWAY}${txId.replace("ar://", "")}`;
  }
  return `${STORAGE.ARWEAVE_GATEWAY}${txId}`;
}

/**
 * Determine storage type from CID/URL
 */
export function getStorageType(uri: string): "ipfs" | "arweave" | "http" | "unknown" {
  if (!uri) return "unknown";
  if (uri.startsWith("ipfs://") || uri.startsWith("Qm") || uri.startsWith("bafy")) {
    return "ipfs";
  }
  if (uri.startsWith("ar://") || uri.length === 43) {
    return "arweave";
  }
  if (uri.startsWith("http")) {
    return "http";
  }
  return "unknown";
}

/**
 * Get the best URL for a content reference
 */
export function getContentUrl(uri: string): string {
  const type = getStorageType(uri);
  switch (type) {
    case "ipfs":
      return getIpfsUrl(uri);
    case "arweave":
      return getArweaveUrl(uri);
    case "http":
      return uri;
    default:
      return uri;
  }
}

/**
 * Calculate upload cost estimate (placeholder)
 */
export function estimateUploadCost(sizeBytes: number, permanent: boolean): {
  sol: number;
  usd: number;
} {
  // Rough estimates - will be replaced with actual pricing
  const mbSize = sizeBytes / (1024 * 1024);

  if (permanent) {
    // Arweave pricing (~$5/GB as rough estimate)
    const usd = (mbSize / 1024) * 5;
    return { sol: usd / 200, usd }; // Assuming ~$200/SOL
  } else {
    // IPFS pinning (~$0.20/GB/month)
    const usd = (mbSize / 1024) * 0.2;
    return { sol: usd / 200, usd };
  }
}
