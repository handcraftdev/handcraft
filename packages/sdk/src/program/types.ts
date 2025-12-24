import { PublicKey } from "@solana/web3.js";

/**
 * Optimized ContentEntry - stores only data needed for on-chain logic
 * Content metadata (CID, type) is stored in Metaplex Core collection/NFT metadata
 * PDA seeds: ["content", cid_hash] - uniqueness enforced by PDA derivation
 */
export interface ContentEntry {
  pubkey?: PublicKey;          // Account pubkey (content PDA) - included when fetching
  creator: PublicKey;
  collectionAsset: PublicKey;  // Metaplex Core collection for this content's NFTs
  tipsReceived: bigint;
  isLocked: boolean;           // Locked after first mint
  mintedCount: bigint;         // Number of NFTs successfully minted
  pendingCount: bigint;        // Number of pending VRF mints
  isEncrypted: boolean;
  previewCid: string;          // Preview CID for non-owners
  encryptionMetaCid: string;   // Encryption metadata CID
  visibilityLevel: number;     // 0=Public, 1=Ecosystem, 2=Subscriber, 3=NFT Only
  // Optional metadata fields - populated from Metaplex collection
  collectionName?: string;     // On-chain name from Metaplex collection (fast, no IPFS fetch)
  contentCid?: string;         // Content CID from collection metadata
  metadataCid?: string;        // Metadata CID (collection URI CID)
  contentType?: number;        // Content type enum value
  createdAt?: bigint;          // Creation timestamp (from collection metadata or on-chain)
  thumbnail?: string;          // Thumbnail image URL from IPFS metadata
}

/**
 * Collection metadata JSON structure (stored on IPFS, referenced by collection URI)
 */
export interface CollectionMetadata {
  name?: string;
  description?: string;
  image?: string;
  animation_url?: string;
  contentCid?: string;
  metadataCid?: string;
  contentType?: number;
  content_type?: number;       // Alternative naming (snake_case)
  createdAt?: number;
  created_at?: number;         // Alternative naming (snake_case)
  properties?: {
    // camelCase (used by UploadStudio)
    contentCid?: string;
    metadataCid?: string;
    contentType?: number;
    createdAt?: number;
    // snake_case (legacy)
    content_cid?: string;
    metadata_cid?: string;
    content_type?: number;
    created_at?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// NOTE: CidRegistry removed - uniqueness now enforced by PDA derivation
// NOTE: ContentCollection removed - collectionAsset now stored in ContentEntry

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

// ContentCollection removed - collectionAsset now stored directly in ContentEntry

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

// RentEntry removed - rental expiry now stored in NFT Attributes plugin

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
 * Optimized Bundle account
 * Bundle metadata is stored in Metaplex Core collection metadata
 * PDA seeds: ["bundle", creator, bundle_id]
 */
export interface Bundle {
  creator: PublicKey;
  bundleId: string;          // Unique identifier
  collectionAsset: PublicKey; // Metaplex Core collection for this bundle's NFTs
  bundleType: BundleType;
  itemCount: number;         // Number of items in the bundle
  isActive: boolean;
  createdAt: bigint;
  updatedAt: bigint;
  mintedCount: bigint;       // Number of NFTs minted for this bundle
  pendingCount: bigint;      // Number of pending VRF mints
  isLocked: boolean;         // Locked after first mint
  // Optional metadata fields - populated from Metaplex collection
  collectionName?: string;   // On-chain name from Metaplex collection (fast, no IPFS fetch)
  metadataCid?: string;      // Extracted from collection URI (ipfs.filebase.io/ipfs/{cid})
  thumbnail?: string;        // Thumbnail image URL from IPFS metadata
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
 * Item in bundle metadata with optional per-item details
 */
export interface BundleMetadataItem {
  contentCid: string;        // Reference to content
  title?: string;            // Custom title override (e.g., track name)
  description?: string;      // Per-item description
  duration?: number;         // Duration in seconds (for audio/video)
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

  // Item ordering (source of truth for display order)
  items?: BundleMetadataItem[];  // Ordered list of items

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
 * Must match on-chain enum in programs/content-registry/src/state/rarity.rs
 */
export enum Rarity {
  Common = 0,      // 55% probability, weight 1
  Uncommon = 1,    // 27% probability, weight 5
  Rare = 2,        // 13% probability, weight 20
  Epic = 3,        //  4% probability, weight 60
  Legendary = 4,   //  1% probability, weight 120
}

/**
 * Get the weight for a rarity tier
 * Must match on-chain weights in programs/content-registry/src/state/rarity.rs
 */
export function getRarityWeight(rarity: Rarity): number {
  switch (rarity) {
    case Rarity.Common: return 1;
    case Rarity.Uncommon: return 5;
    case Rarity.Rare: return 20;
    case Rarity.Epic: return 60;
    case Rarity.Legendary: return 120;
    default: return 1;
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
 * Must match on-chain weights in programs/content-registry/src/state/rarity.rs
 */
export function getRarityFromWeight(weight: number): Rarity {
  if (weight >= 120) return Rarity.Legendary;
  if (weight >= 60) return Rarity.Epic;
  if (weight >= 20) return Rarity.Rare;
  if (weight >= 5) return Rarity.Uncommon;
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

/** MagicBlock VRF bundle mint request - 2-step flow with fallback */
export interface MbBundleMintRequest {
  buyer: PublicKey;
  bundle: PublicKey;
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
  bundleCollectionBump: number;
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

// ========== BUNDLE MINT/RENT TYPES ==========

/**
 * Bundle mint configuration
 */
export interface BundleMintConfig {
  bundle: PublicKey;
  creator: PublicKey;
  price: bigint;
  maxSupply: bigint | null;
  creatorRoyaltyBps: number;
  isActive: boolean;
  createdAt: bigint;
  updatedAt: bigint;
}

/**
 * Bundle rent configuration
 */
export interface BundleRentConfig {
  bundle: PublicKey;
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

// BundleCollection removed - collectionAsset now stored directly in Bundle

/**
 * Bundle reward pool for holder rewards
 */
export interface BundleRewardPool {
  bundle: PublicKey;
  rewardPerShare: bigint;
  totalNfts: bigint;
  totalWeight: bigint;
  totalDeposited: bigint;
  totalClaimed: bigint;
  createdAt: bigint;
}

/**
 * Bundle wallet state (tracks NFT ownership per wallet)
 */
export interface BundleWalletState {
  wallet: PublicKey;
  bundle: PublicKey;
  nftCount: bigint;
  rewardDebt: bigint;
  createdAt: bigint;
  updatedAt: bigint;
}

/**
 * Bundle NFT reward state (per-NFT reward tracking)
 */
export interface BundleNftRewardState {
  nftAsset: PublicKey;
  bundle: PublicKey;
  rewardDebt: bigint;
  weight: number;
  createdAt: bigint;
}

/**
 * Bundle NFT rarity
 */
export interface BundleNftRarity {
  nftAsset: PublicKey;
  bundle: PublicKey;
  rarity: Rarity;
  weight: number;
  revealedAt: bigint;
}

// BundleRentEntry removed - rental expiry now stored in NFT Attributes plugin

/**
 * Bundle NFT with rarity information (for UI display)
 */
export interface BundleNftWithRarity {
  nftAsset: PublicKey;
  bundle: PublicKey;
  rarity: Rarity;
  rarityName: string;
  weight: number;
  rewardDebt: bigint;
  pendingReward: bigint;
}

/**
 * Bundle pending reward details
 */
export interface BundlePendingRewardDetails {
  bundleId: string;
  pending: bigint;
  nftCount: bigint;
  nftRewards: Array<{
    nftAsset: PublicKey;
    pending: bigint;
    weight: number;
  }>;
}

/**
 * Wallet bundle NFT metadata - used for displaying owned bundle NFTs
 */
export interface WalletBundleNftMetadata {
  nftAsset: PublicKey;
  bundleId: string | null;
  creator: PublicKey | null;
  collectionAsset: PublicKey | null;
  name: string;
}

// ========== SUBSCRIPTION SYSTEM TYPES (Phase 1-3) ==========

// Note: PatronTier and VisibilityLevel enums are defined in constants.ts
import { PatronTier, VisibilityLevel } from "./constants";
export { PatronTier, VisibilityLevel };

/**
 * Parse PatronTier from Anchor's enum format
 */
export function parsePatronTier(anchorTier: unknown): PatronTier {
  if (typeof anchorTier === "number") {
    return anchorTier as PatronTier;
  }
  if (typeof anchorTier === "object" && anchorTier !== null) {
    const keys = Object.keys(anchorTier);
    if (keys.length > 0) {
      const key = keys[0].toLowerCase();
      switch (key) {
        case "membership": return PatronTier.Membership;
        case "subscription": return PatronTier.Subscription;
      }
    }
  }
  return PatronTier.Membership;
}

/**
 * Unified NFT reward state - single account per NFT tracking all pool debts
 */
export interface UnifiedNftRewardState {
  nftAsset: PublicKey;
  creator: PublicKey;
  weight: number;
  isBundle: boolean;
  contentOrBundle: PublicKey;
  contentOrBundleDebt: bigint;
  patronDebt: bigint;
  globalDebt: bigint;
  createdAt: bigint;
}

/**
 * Creator patron pool - holds SOL for NFT holder claims (12% of patron subscriptions)
 */
export interface CreatorPatronPool {
  creator: PublicKey;
  rewardPerShare: bigint;
  totalWeight: bigint;
  totalDeposited: bigint;
  totalClaimed: bigint;
  lastDistributionAt: bigint;
  epochDuration: bigint;
  createdAt: bigint;
}

/**
 * Global holder pool - holds SOL for NFT holder claims (12% of ecosystem subscriptions)
 */
export interface GlobalHolderPool {
  rewardPerShare: bigint;
  totalWeight: bigint;
  totalDeposited: bigint;
  totalClaimed: bigint;
  createdAt: bigint;
}

/**
 * Creator distribution pool - holds SOL for creator claims (80% of ecosystem subscriptions)
 */
export interface CreatorDistPool {
  rewardPerShare: bigint;
  totalWeight: bigint;
  totalDeposited: bigint;
  totalClaimed: bigint;
  createdAt: bigint;
}

/**
 * Ecosystem epoch state - shared epoch tracking for lazy distribution
 */
export interface EcosystemEpochState {
  lastDistributionAt: bigint;
  epochDuration: bigint;
}

/**
 * Creator weight - tracks total weight of creator's NFTs for ecosystem payouts
 */
export interface CreatorWeight {
  creator: PublicKey;
  totalWeight: bigint;
  rewardDebt: bigint;
  totalClaimed: bigint;
  createdAt: bigint;
}

/**
 * Creator patron config - creator's subscription/membership tier configuration
 */
export interface CreatorPatronConfig {
  creator: PublicKey;
  membershipPrice: bigint;
  subscriptionPrice: bigint;
  isActive: boolean;
  createdAt: bigint;
  updatedAt: bigint;
}

/**
 * Creator patron subscription - user's subscription to a specific creator
 */
export interface CreatorPatronSubscription {
  subscriber: PublicKey;
  creator: PublicKey;
  tier: PatronTier;
  streamId: PublicKey;
  startedAt: bigint;
  isActive: boolean;
}

/**
 * Ecosystem subscription config - platform-wide subscription configuration
 */
export interface EcosystemSubConfig {
  price: bigint;
  isActive: boolean;
  authority: PublicKey;
  createdAt: bigint;
  updatedAt: bigint;
}

/**
 * Ecosystem subscription - user's platform subscription
 */
export interface EcosystemSubscription {
  subscriber: PublicKey;
  streamId: PublicKey;
  startedAt: bigint;
  isActive: boolean;
}

/**
 * Check if a subscription is valid (within 30 days of start)
 * @param startedAt - Subscription start timestamp in seconds
 * @param now - Current timestamp in seconds (defaults to Date.now() / 1000)
 */
export function isSubscriptionValid(startedAt: bigint, now?: number): boolean {
  const currentTime = now ?? Math.floor(Date.now() / 1000);
  const epochDuration = 30 * 24 * 60 * 60; // 30 days in seconds
  return currentTime < Number(startedAt) + epochDuration;
}

/**
 * Calculate pending reward from a subscription pool using saturating subtraction
 * @param weight - NFT's rarity weight
 * @param rewardPerShare - Current pool reward_per_share
 * @param debt - NFT's debt for this pool
 * @param precision - Precision constant (default: 10^12)
 */
export function calculateSubscriptionPendingReward(
  weight: number,
  rewardPerShare: bigint,
  debt: bigint,
  precision: bigint = BigInt(1_000_000_000_000)
): bigint {
  const weightedRps = BigInt(weight) * rewardPerShare;
  if (weightedRps <= debt) return BigInt(0);
  return (weightedRps - debt) / precision;
}

// ========== USER PROFILE TYPES ==========

/**
 * User profile storing username and settings
 * Required for content creators to set collection names
 */
export interface UserProfile {
  owner: PublicKey;
  username: string;
  createdAt: bigint;
  updatedAt: bigint;
}
