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
  mintedCount: bigint;    // Number of NFTs successfully minted (used for edition numbering)
  pendingCount: bigint;   // Number of pending VRF mints (for max_supply checking)
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
  totalWeight: bigint;  // Sum of all NFT rarity weights
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
  weight: number;  // Rarity weight (1=Common, 5=Uncommon, 20=Rare, 60=Epic, 120=Legendary)
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
  weight: number;
  createdAt: bigint;  // Timestamp when NFT was minted (for sorting)
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

// ========== RARITY TYPES (NFT Rarity System) ==========

/**
 * NFT Rarity tiers with associated weights for reward distribution
 */
export enum Rarity {
  Common = 0,      // 55% probability, weight 100
  Uncommon = 1,    // 27% probability, weight 150
  Rare = 2,        // 13% probability, weight 200
  Epic = 3,        //  4% probability, weight 300
  Legendary = 4,   //  1% probability, weight 500
}

/**
 * Get the weight for a rarity tier
 */
export function getRarityWeight(rarity: Rarity): number {
  switch (rarity) {
    case Rarity.Common: return 100;
    case Rarity.Uncommon: return 150;
    case Rarity.Rare: return 200;
    case Rarity.Epic: return 300;
    case Rarity.Legendary: return 500;
    default: return 100;
  }
}

/**
 * Get the display name for a rarity tier
 */
export function getRarityName(rarity: Rarity): string {
  switch (rarity) {
    case Rarity.Common: return "Common";
    case Rarity.Uncommon: return "Uncommon";
    case Rarity.Rare: return "Rare";
    case Rarity.Epic: return "Epic";
    case Rarity.Legendary: return "Legendary";
    default: return "Unknown";
  }
}

/**
 * Get rarity from weight value
 */
export function getRarityFromWeight(weight: number): Rarity {
  if (weight >= 500) return Rarity.Legendary;
  if (weight >= 300) return Rarity.Epic;
  if (weight >= 200) return Rarity.Rare;
  if (weight >= 150) return Rarity.Uncommon;
  return Rarity.Common;
}

/**
 * Parse rarity from Anchor's enum format
 * Anchor returns enums as objects like { common: {} }, { uncommon: {} }, etc.
 * This function converts them to the numeric Rarity enum
 */
export function parseAnchorRarity(anchorRarity: unknown): Rarity {
  // If it's already a number, return it directly
  if (typeof anchorRarity === "number") {
    return anchorRarity as Rarity;
  }

  // Handle Anchor's object enum format
  if (typeof anchorRarity === "object" && anchorRarity !== null) {
    const keys = Object.keys(anchorRarity);
    if (keys.length > 0) {
      const key = keys[0].toLowerCase();
      switch (key) {
        case "common": return Rarity.Common;
        case "uncommon": return Rarity.Uncommon;
        case "rare": return Rarity.Rare;
        case "epic": return Rarity.Epic;
        case "legendary": return Rarity.Legendary;
      }
    }
  }

  // Default to Common if parsing fails
  console.warn("Failed to parse rarity, defaulting to Common:", anchorRarity);
  return Rarity.Common;
}

/**
 * On-chain NftRarity account
 * Stores the rarity information for each minted NFT
 */
export interface NftRarity {
  nftAsset: PublicKey;
  content: PublicKey;
  rarity: Rarity;
  weight: number;
  randomnessAccount: PublicKey;
  commitSlot: bigint;
  revealedAt: bigint;
}

/**
 * Pending mint request - tracks state between commit and reveal
 * Also acts as escrow vault - payment is held here until reveal
 * NOTE: Edition number is assigned at reveal time (minted_count + 1) to avoid gaps
 */
export interface PendingMint {
  buyer: PublicKey;
  content: PublicKey;
  creator: PublicKey;  // Creator to receive payment on reveal
  randomnessAccount: PublicKey;
  commitSlot: bigint;
  amountPaid: bigint;  // Payment held in escrow
  createdAt: bigint;
  hadExistingNfts: boolean;  // Whether there were existing NFTs at commit time
}

/** MagicBlock VRF mint request - 2-step flow with fallback */
export interface MbMintRequest {
  buyer: PublicKey;
  content: PublicKey;
  creator: PublicKey;
  amountPaid: bigint;
  createdAt: bigint;
  hadExistingNfts: boolean;
  bump: number;
  nftBump: number;
  isFulfilled: boolean;
  collectionAsset: PublicKey;
  treasury: PublicKey;
  platform: PublicKey;
  contentCollectionBump: number;
  metadataCid: string;
  mintedCount: bigint;
  edition: bigint;
}

/** Minimum time (in seconds) before a pending mint can be cancelled */
export const MIN_CANCEL_DELAY_SECONDS = 600;  // 10 minutes

/**
 * NFT with rarity information (for UI display)
 */
export interface NftWithRarity {
  nftAsset: PublicKey;
  content: PublicKey;
  rarity: Rarity;
  rarityName: string;
  weight: number;
  rewardDebt: bigint;
  pendingReward: bigint;
}

/**
 * Rarity distribution statistics
 */
export interface RarityStats {
  common: number;
  uncommon: number;
  rare: number;
  epic: number;
  legendary: number;
  totalWeight: bigint;
}
