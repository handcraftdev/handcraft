import { BundleMetadata } from "@handcraft/sdk";

const IPFS_GATEWAY = process.env.IPFS_GATEWAY || "https://ipfs.filebase.io/ipfs";
const FETCH_TIMEOUT_MS = 10000; // 10 second timeout

/**
 * Content metadata structure (stored on IPFS)
 */
export interface ContentMetadata {
  name: string;
  description?: string;
  image?: string;
  animation_url?: string;
  external_url?: string;

  // Discovery
  tags?: string[];
  category?: string;
  genre?: string;

  // Content-specific
  contentType?: string;
  domain?: string;
  duration?: number; // Duration in seconds
  fileSize?: number; // File size in bytes
  mimeType?: string;

  // Additional properties
  properties?: Record<string, any>;
  attributes?: Array<{ trait_type: string; value: string | number }>;
}

/**
 * Fetch metadata from IPFS with timeout
 */
async function fetchWithTimeout(
  url: string,
  timeoutMs: number = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
      },
    });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

/**
 * Fetch and parse content metadata from IPFS
 */
export async function fetchContentMetadata(
  metadataCid: string
): Promise<ContentMetadata | null> {
  try {
    const url = `${IPFS_GATEWAY}/${metadataCid}`;
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      console.error(`Failed to fetch content metadata: ${response.status}`);
      return null;
    }

    const metadata: ContentMetadata = await response.json();
    return metadata;
  } catch (error) {
    console.error("Error fetching content metadata:", error);
    return null;
  }
}

/**
 * Fetch and parse bundle metadata from IPFS
 */
export async function fetchBundleMetadata(
  metadataCid: string
): Promise<BundleMetadata | null> {
  try {
    const url = `${IPFS_GATEWAY}/${metadataCid}`;
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      console.error(`Failed to fetch bundle metadata: ${response.status}`);
      return null;
    }

    const metadata: BundleMetadata = await response.json();
    return metadata;
  } catch (error) {
    console.error("Error fetching bundle metadata:", error);
    return null;
  }
}

/**
 * Fetch NFT metadata from URI
 */
export async function fetchNftMetadata(uri: string): Promise<any | null> {
  try {
    // Handle IPFS URIs
    let url = uri;
    if (uri.startsWith("ipfs://")) {
      const cid = uri.replace("ipfs://", "");
      url = `${IPFS_GATEWAY}/${cid}`;
    }

    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      console.error(`Failed to fetch NFT metadata: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching NFT metadata:", error);
    return null;
  }
}

/**
 * Extract tags from metadata
 */
export function extractTags(metadata: ContentMetadata | BundleMetadata): string[] {
  const tags: string[] = [];

  // Direct tags field
  if (metadata.tags && Array.isArray(metadata.tags)) {
    tags.push(...metadata.tags.filter((t) => typeof t === "string"));
  }

  // Extract from attributes
  if ("attributes" in metadata && Array.isArray(metadata.attributes)) {
    for (const attr of metadata.attributes) {
      if (
        attr.trait_type?.toLowerCase() === "tag" ||
        attr.trait_type?.toLowerCase() === "tags"
      ) {
        if (typeof attr.value === "string") {
          tags.push(attr.value);
        }
      }
    }
  }

  // Deduplicate and normalize
  return Array.from(new Set(tags.map((t) => t.toLowerCase().trim())));
}

/**
 * Extract category from metadata
 */
export function extractCategory(
  metadata: ContentMetadata | BundleMetadata
): string | null {
  if (metadata.category) return metadata.category;

  // Check attributes
  if ("attributes" in metadata && Array.isArray(metadata.attributes)) {
    for (const attr of metadata.attributes) {
      if (attr.trait_type?.toLowerCase() === "category") {
        return String(attr.value);
      }
    }
  }

  return null;
}

/**
 * Extract genre from metadata
 */
export function extractGenre(
  metadata: ContentMetadata | BundleMetadata
): string | null {
  if (metadata.genre) return metadata.genre;

  // Check attributes
  if ("attributes" in metadata && Array.isArray(metadata.attributes)) {
    for (const attr of metadata.attributes) {
      if (attr.trait_type?.toLowerCase() === "genre") {
        return String(attr.value);
      }
    }
  }

  return null;
}

/**
 * Normalize image URL from metadata
 */
export function normalizeImageUrl(imageUrl: string | undefined): string | null {
  if (!imageUrl) return null;

  // Handle IPFS URLs
  if (imageUrl.startsWith("ipfs://")) {
    const cid = imageUrl.replace("ipfs://", "");
    return `${IPFS_GATEWAY}/${cid}`;
  }

  return imageUrl;
}

/**
 * Normalize animation URL from metadata
 */
export function normalizeAnimationUrl(
  animationUrl: string | undefined
): string | null {
  if (!animationUrl) return null;

  // Handle IPFS URLs
  if (animationUrl.startsWith("ipfs://")) {
    const cid = animationUrl.replace("ipfs://", "");
    return `${IPFS_GATEWAY}/${cid}`;
  }

  return animationUrl;
}

/**
 * Build full metadata object for indexing
 */
export interface IndexableContentMetadata {
  name: string | null;
  description: string | null;
  imageUrl: string | null;
  animationUrl: string | null;
  tags: string[];
  category: string | null;
  genre: string | null;
}

export function buildIndexableContentMetadata(
  metadata: ContentMetadata | null
): IndexableContentMetadata {
  if (!metadata) {
    return {
      name: null,
      description: null,
      imageUrl: null,
      animationUrl: null,
      tags: [],
      category: null,
      genre: null,
    };
  }

  return {
    name: metadata.name || null,
    description: metadata.description || null,
    imageUrl: normalizeImageUrl(metadata.image),
    animationUrl: normalizeAnimationUrl(metadata.animation_url),
    tags: extractTags(metadata),
    category: extractCategory(metadata),
    genre: extractGenre(metadata),
  };
}

/**
 * Build full metadata object for bundle indexing
 */
export interface IndexableBundleMetadata extends IndexableContentMetadata {
  artist: string | null;
  showName: string | null;
  instructor: string | null;
  seasonNumber: number | null;
  totalSeasons: number | null;
  year: string | null;
}

export function buildIndexableBundleMetadata(
  metadata: BundleMetadata | null
): IndexableBundleMetadata {
  const base = buildIndexableContentMetadata(metadata);

  if (!metadata) {
    return {
      ...base,
      artist: null,
      showName: null,
      instructor: null,
      seasonNumber: null,
      totalSeasons: null,
      year: null,
    };
  }

  return {
    ...base,
    artist: metadata.artist || null,
    showName: metadata.showName || null,
    instructor: metadata.instructor || null,
    seasonNumber: metadata.seasonNumber || null,
    totalSeasons: metadata.totalSeasons || null,
    year: metadata.year || null,
  };
}
