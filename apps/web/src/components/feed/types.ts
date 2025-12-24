import { PublicKey } from "@solana/web3.js";
import { ContentEntry, MintConfig, Bundle, BundleMintConfig, BundleType, ContentType, BundleItem } from "@handcraft/sdk";

export type FeedTab = "foryou" | "your-content";

// NFT type filter for unified feed
export type NftTypeFilter = "all" | "content" | "bundle";

export const NFT_TYPE_FILTERS: { value: NftTypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "content", label: "Content" },
  { value: "bundle", label: "Bundle" },
];

// Bundle metadata for feed display
export interface BundleFeedMetadata {
  name?: string;
  description?: string;
  image?: string;
  bundleType?: string;
  artist?: string;
  genre?: string;
  tags?: string[];
}

// Unified feed item combining content and bundle
export interface UnifiedFeedItem {
  id: string;                    // contentCid or bundleId
  type: "content" | "bundle";
  creator: PublicKey;
  createdAt: bigint;

  // Shared metadata (from IPFS + on-chain)
  metadata?: {
    collectionName?: string;  // On-chain collection name (smaller, secondary)
    title?: string;           // IPFS metadata title (main highlight)
    description?: string;
    image?: string;
    tags?: string[];
  };

  // Content-specific fields
  contentCid?: string;
  contentType?: ContentType;
  previewCid?: string;
  isEncrypted?: boolean;
  visibilityLevel?: number;

  // Bundle-specific fields
  bundleId?: string;
  bundleType?: BundleType;
  itemCount?: number;

  // Shared commerce fields
  mintedCount: bigint;
  isLocked: boolean;
  mintConfig?: MintConfig | BundleMintConfig | null;

  // Original data reference
  contentEntry?: ContentEntry;
  bundleEntry?: Bundle;
}

export interface ContentContext {
  genre?: string;
  category?: string;
  tags?: string[];
  artist?: string;
  album?: string;
  director?: string;
  cast?: string[];
  showName?: string;
  season?: number;
  episode?: number;
  author?: string;
  narrator?: string;
  publisher?: string;
  year?: number;
  duration?: number;
}

export interface BundleReference {
  id?: string;
  position?: number;
}

export interface ContentMetadata {
  name?: string;
  title?: string;
  description?: string;
  image?: string;
  tags?: string[];
  contentType?: string;
  // File info (from type_metadata during upload)
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  createdAt?: string;

  // Content architecture fields
  domain?: string;
  context?: ContentContext;
  bundle?: BundleReference;

  // Legacy flat context fields (for backward compatibility)
  genre?: string;
  artist?: string;
  album?: string;
}

export interface EnrichedContent extends ContentEntry {
  metadata?: ContentMetadata;
  creatorAddress?: string;
  mintConfig?: MintConfig | null;
}

// Bundle item with content for sidebar display
export interface BundleItemWithContent {
  item: BundleItem;
  content: ContentEntry | null;
  metadata?: ContentMetadata | null;
}

// Bundle context for sidebar display when viewing bundled content
export interface BundleContext {
  bundle: Bundle;
  bundleMetadata?: BundleFeedMetadata;
  items: BundleItemWithContent[];
  currentPosition: number;
  mintConfig?: BundleMintConfig | null;
}

// Enriched bundle for feed display
export interface EnrichedBundle extends Bundle {
  metadata?: BundleFeedMetadata;
  creatorAddress?: string;
  mintConfig?: BundleMintConfig | null;
  firstItemPreview?: string; // Preview CID of first item for display
}
