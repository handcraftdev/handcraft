import { PublicKey } from "@solana/web3.js";
import { ContentType } from "./constants";

export interface ContentEntry {
  creator: PublicKey;
  contentCid: string;
  metadataCid: string;
  contentType: ContentType;
  tipsReceived: bigint;
  createdAt: bigint;
  isLocked: boolean;
  mintedCount: bigint;
  isEncrypted: boolean;
  previewCid: string;
  encryptionMetaCid: string;
}

export interface CidRegistry {
  cid: string;
  content: PublicKey;
  registeredAt: bigint;
}

export interface MintConfig {
  content: PublicKey;
  creator: PublicKey;
  priceSol: bigint;
  maxSupply: bigint | null;
  creatorRoyaltyBps: number;
  isActive: boolean;
  createdAt: bigint;
}

export interface EcosystemConfig {
  admin: PublicKey;
  treasury: PublicKey;
  usdcMint: PublicKey;
  totalFeesSol: bigint;
  totalFeesUsdc: bigint;
  totalNftsMinted: bigint;
  isPaused: boolean;
  createdAt: bigint;
}

export interface ContentRewardPool {
  content: PublicKey;
  rewardPerShare: bigint;
  totalNfts: bigint;
  totalDeposited: bigint;
  totalClaimed: bigint;
  createdAt: bigint;
}

export interface WalletContentState {
  wallet: PublicKey;
  content: PublicKey;
  nftCount: bigint;
  rewardDebt: bigint;
  totalClaimed: bigint;
  lastUpdated: bigint;
}

export interface ContentCollection {
  content: PublicKey;
  collectionAsset: PublicKey;
  createdAt: bigint;
}

export interface NftRewardState {
  nftAsset: PublicKey;
  content: PublicKey;
  rewardDebt: bigint;
  createdAt: bigint;
}

export interface WalletNftMetadata {
  nftAsset: PublicKey;
  contentCid: string | null;
  collectionAsset: PublicKey | null;
  name: string;
}

export interface NftPendingReward {
  nftAsset: PublicKey;
  pending: bigint;
  rewardDebt: bigint;
}

export interface ContentPendingRewardDetails {
  contentCid: string;
  pending: bigint;
  nftCount: bigint;
  nftRewards: NftPendingReward[];
}

export interface RentConfig {
  content: PublicKey;
  creator: PublicKey;
  rentFee6h: bigint;
  rentFee1d: bigint;
  rentFee7d: bigint;
  isActive: boolean;
  totalRentals: bigint;
  totalFeesCollected: bigint;
  createdAt: bigint;
  updatedAt: bigint;
}

export interface RentEntry {
  renter: PublicKey;
  content: PublicKey;
  nftAsset: PublicKey;
  rentedAt: bigint;
  expiresAt: bigint;
  isActive: boolean;
  feePaid: bigint;
}

// ========== BUNDLE TYPES (Layer 4 of Content Architecture) ==========

/**
 * Bundle types define what kind of collection this is.
 * Each type has different semantics for how content is organized and consumed.
 */
export enum BundleType {
  // Entertainment bundles
  Album = 0,        // Music album (ordered tracks)
  Series = 1,       // TV series (seasons/episodes)
  Playlist = 2,     // User-curated collection (any order)

  // Educational bundles
  Course = 3,       // Learning content (ordered lessons)

  // Publication bundles
  Newsletter = 4,   // Recurring posts (chronological)
  Collection = 5,   // Photo/art collection (any order)

  // Product bundles
  ProductPack = 6,  // Assets/software sold together
}

/**
 * On-chain Bundle account
 * Stores the bundle metadata reference and items
 */
export interface Bundle {
  creator: PublicKey;
  bundleId: string;          // Unique identifier (could be CID or slug)
  metadataCid: string;       // Points to off-chain bundle metadata JSON
  bundleType: BundleType;
  itemCount: number;         // Number of items in the bundle
  isActive: boolean;
  createdAt: bigint;
  updatedAt: bigint;
}

/**
 * On-chain BundleItem account
 * Links content to a bundle with ordering
 */
export interface BundleItem {
  bundle: PublicKey;
  content: PublicKey;        // Reference to ContentEntry
  position: number;          // Order within bundle (0-indexed)
  addedAt: bigint;
}

/**
 * Off-chain Bundle metadata (stored on IPFS)
 */
export interface BundleMetadata {
  // Standard fields
  name: string;
  description: string;
  image?: string;            // Cover/thumbnail

  // Bundle info
  bundleType: string;        // "album", "series", "course", etc.

  // Type-specific fields
  artist?: string;           // For albums
  showName?: string;         // For series
  instructor?: string;       // For courses
  seasonNumber?: number;     // For series
  totalSeasons?: number;     // For series

  // Discovery
  genre?: string;
  category?: string;
  tags?: string[];
  year?: string;

  // Technical
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Bundle with full item details (for UI display)
 */
export interface BundleWithItems {
  bundle: Bundle;
  metadata: BundleMetadata | null;
  items: Array<{
    item: BundleItem;
    content: ContentEntry | null;
    contentMetadata: Record<string, unknown> | null;
  }>;
}
