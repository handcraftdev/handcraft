import { PublicKey } from "@solana/web3.js";
import idl from "./content_registry.json";

// Program ID from IDL (single source of truth - updated by `anchor build`)
export const PROGRAM_ID_STRING = idl.address;

// Metaplex Core Program ID as string
export const MPL_CORE_PROGRAM_ID_STRING = "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d";

// PublicKey instances - only use these client-side, not during SSR
export const PROGRAM_ID = new PublicKey(PROGRAM_ID_STRING);
export const MPL_CORE_PROGRAM_ID = new PublicKey(MPL_CORE_PROGRAM_ID_STRING);

// Seeds for PDA derivation
export const ECOSYSTEM_CONFIG_SEED = "ecosystem";
export const MINT_CONFIG_SEED = "mint_config";
export const CONTENT_REWARD_POOL_SEED = "content_reward_pool";
export const WALLET_CONTENT_STATE_SEED = "wallet_content";
export const USER_PROFILE_SEED = "user_profile";

// Rent seeds
// NOTE: CONTENT_COLLECTION_SEED removed - collection_asset now stored in ContentEntry
// NOTE: RENT_ENTRY_SEED removed - rental expiry now stored in NFT Attributes plugin
export const RENT_CONFIG_SEED = "rent_config";

// Rent tier periods (in seconds)
export const RENT_PERIOD_6H = 6 * 3600;        // 6 hours = 21,600 seconds
export const RENT_PERIOD_1D = 24 * 3600;       // 1 day = 86,400 seconds
export const RENT_PERIOD_7D = 7 * 24 * 3600;   // 7 days = 604,800 seconds

// Rent fee minimum
export const MIN_RENT_FEE_LAMPORTS = 1_000_000; // 0.001 SOL

// Rent tier enum (matches program)
export enum RentTier {
  SixHours = 0,
  OneDay = 1,
  SevenDays = 2,
}

// Helper to get period seconds for a tier
export function getRentTierPeriod(tier: RentTier): number {
  switch (tier) {
    case RentTier.SixHours: return RENT_PERIOD_6H;
    case RentTier.OneDay: return RENT_PERIOD_1D;
    case RentTier.SevenDays: return RENT_PERIOD_7D;
  }
}

// Helper to get tier label
export function getRentTierLabel(tier: RentTier): string {
  switch (tier) {
    case RentTier.SixHours: return "6 Hours";
    case RentTier.OneDay: return "1 Day";
    case RentTier.SevenDays: return "7 Days";
  }
}

// Fee constants (basis points)
// Primary sale: Creator 80%, Platform 5%, Ecosystem 3%, Existing Holders 12%
export const PLATFORM_FEE_PRIMARY_BPS = 500;   // 5%
export const ECOSYSTEM_FEE_PRIMARY_BPS = 300;  // 3%
export const CREATOR_FEE_PRIMARY_BPS = 8000;   // 80%
export const HOLDER_REWARD_PRIMARY_BPS = 1200; // 12% - distributed to existing NFT holders

// Secondary sale: Creator 4% (fixed), Platform 1%, Ecosystem 1%, Holders 4% = 10% total
export const PLATFORM_FEE_SECONDARY_BPS = 100; // 1%
export const ECOSYSTEM_FEE_SECONDARY_BPS = 100; // 1%
export const HOLDER_REWARD_SECONDARY_BPS = 400; // 4% - distributed to existing NFT holders
export const FIXED_CREATOR_ROYALTY_BPS = 400;  // 4% (fixed)

// Minimum prices (SOL only)
export const MIN_PRICE_LAMPORTS = 1_000_000;   // 0.001 SOL

// Precision for reward_per_share calculations (matches program)
export const PRECISION = BigInt("1000000000000"); // 1e12

export enum ContentType {
  // Video domain (0-4)
  Video = 0,
  Movie = 1,
  Television = 2,
  MusicVideo = 3,
  Short = 4,
  // Audio domain (5-7)
  Music = 5,
  Podcast = 6,
  Audiobook = 7,
  // Image domain (8-9)
  Photo = 8,
  Artwork = 9,
  // Document domain (10-11)
  Book = 10,
  Comic = 11,
  // File domain (12-15)
  Asset = 12,
  Game = 13,
  Software = 14,
  Dataset = 15,
  // Text domain (16)
  Post = 16,
}

// Domain helpers
export type ContentDomain = "video" | "audio" | "image" | "document" | "file" | "text";

export function getContentDomain(type: ContentType): ContentDomain {
  switch (type) {
    case ContentType.Video:
    case ContentType.Movie:
    case ContentType.Television:
    case ContentType.MusicVideo:
    case ContentType.Short:
      return "video";
    case ContentType.Music:
    case ContentType.Podcast:
    case ContentType.Audiobook:
      return "audio";
    case ContentType.Photo:
    case ContentType.Artwork:
      return "image";
    case ContentType.Book:
    case ContentType.Comic:
      return "document";
    case ContentType.Asset:
    case ContentType.Game:
    case ContentType.Software:
    case ContentType.Dataset:
      return "file";
    case ContentType.Post:
      return "text";
  }
}

export function getContentTypeLabel(type: ContentType): string {
  switch (type) {
    case ContentType.Video: return "Video";
    case ContentType.Movie: return "Movie";
    case ContentType.Television: return "Television";
    case ContentType.MusicVideo: return "Music Video";
    case ContentType.Short: return "Short";
    case ContentType.Music: return "Music";
    case ContentType.Podcast: return "Podcast";
    case ContentType.Audiobook: return "Audiobook";
    case ContentType.Photo: return "Photo";
    case ContentType.Artwork: return "Artwork";
    case ContentType.Book: return "Book";
    case ContentType.Comic: return "Comic";
    case ContentType.Asset: return "Asset";
    case ContentType.Game: return "Game";
    case ContentType.Software: return "Software";
    case ContentType.Dataset: return "Dataset";
    case ContentType.Post: return "Post";
  }
}

export function getDomainLabel(domain: ContentDomain): string {
  switch (domain) {
    case "video": return "Video";
    case "audio": return "Audio";
    case "image": return "Image";
    case "document": return "Document";
    case "file": return "File";
    case "text": return "Text";
  }
}

// Payment currency enum (SOL only now)
export enum PaymentCurrency {
  Sol = 0,
}

// ========== RARITY CONSTANTS ==========
export const PENDING_MINT_SEED = "pending_mint";

// Rarity probabilities (in basis points, out of 10000)
export const RARITY_PROB_COMMON = 5500;      // 55%
export const RARITY_PROB_UNCOMMON = 2700;    // 27%
export const RARITY_PROB_RARE = 1300;        // 13%
export const RARITY_PROB_EPIC = 400;         //  4%
export const RARITY_PROB_LEGENDARY = 100;    //  1%

// Re-export Rarity enum and weight helpers from types
// Weights: Common=1, Uncommon=5, Rare=20, Epic=60, Legendary=120 (matches program)
export { Rarity, getRarityWeight, getRarityName, getRarityFromWeight } from "./types";

// ========== BUNDLE CONSTANTS ==========

// Bundle seeds for PDA derivation
export const BUNDLE_SEED = "bundle";
export const BUNDLE_ITEM_SEED = "bundle_item";

// Bundle mint/rent seeds
// NOTE: BUNDLE_COLLECTION_SEED removed - collection_asset now stored in Bundle
// NOTE: BUNDLE_RENT_ENTRY_SEED removed - rental expiry now stored in NFT Attributes plugin
export const BUNDLE_MINT_CONFIG_SEED = "bundle_mint_config";
export const BUNDLE_RENT_CONFIG_SEED = "bundle_rent_config";
export const BUNDLE_REWARD_POOL_SEED = "bundle_reward_pool";
export const BUNDLE_WALLET_STATE_SEED = "bundle_wallet";
export const BUNDLE_DIRECT_NFT_SEED = "bundle_direct_nft";
export const BUNDLE_RENTAL_NFT_SEED = "bundle_rental_nft";

// ========== MAGICBLOCK VRF CONSTANTS ==========

// MagicBlock VRF Program ID
export const MAGICBLOCK_VRF_PROGRAM_ID_STRING = "Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz";
export const MAGICBLOCK_VRF_PROGRAM_ID = new PublicKey(MAGICBLOCK_VRF_PROGRAM_ID_STRING);

// MagicBlock Default Queue
export const MAGICBLOCK_DEFAULT_QUEUE_STRING = "Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh";
export const MAGICBLOCK_DEFAULT_QUEUE = new PublicKey(MAGICBLOCK_DEFAULT_QUEUE_STRING);

// MagicBlock seeds for PDA derivation
export const MB_MINT_REQUEST_SEED = "mb_mint_request";
export const MB_NFT_SEED = "mb_nft";

// MagicBlock bundle mint seeds
export const MB_BUNDLE_MINT_REQUEST_SEED = "mb_bundle_mint_req";
export const MB_BUNDLE_NFT_SEED = "mb_bundle_nft";

// Simple mint seeds (unified mint with subscription pools)
export const SIMPLE_NFT_SEED = "simple_nft";

// MagicBlock fallback timeout (5 seconds - uses slot hash randomness)
export const MB_FALLBACK_TIMEOUT_SECONDS = 5;

// Re-export BundleType from types for convenience
export { BundleType } from "./types";

// Bundle type labels
export function getBundleTypeLabel(type: import("./types").BundleType): string {
  const { BundleType } = require("./types");
  switch (type) {
    case BundleType.Album: return "Album";
    case BundleType.Series: return "Series";
    case BundleType.Playlist: return "Playlist";
    case BundleType.Course: return "Course";
    case BundleType.Newsletter: return "Newsletter";
    case BundleType.Collection: return "Collection";
    case BundleType.ProductPack: return "Product Pack";
    default: return "Unknown";
  }
}

// Get bundle type from string
export function getBundleTypeFromString(str: string): import("./types").BundleType {
  const { BundleType } = require("./types");
  const normalized = str.toLowerCase();
  switch (normalized) {
    case "album": return BundleType.Album;
    case "series": return BundleType.Series;
    case "playlist": return BundleType.Playlist;
    case "course": return BundleType.Course;
    case "newsletter": return BundleType.Newsletter;
    case "collection": return BundleType.Collection;
    case "productpack":
    case "product_pack":
    case "product-pack": return BundleType.ProductPack;
    default: return BundleType.Collection;
  }
}

// Suggested bundle types per content domain
export function getSuggestedBundleTypes(domain: ContentDomain): import("./types").BundleType[] {
  const { BundleType } = require("./types");
  switch (domain) {
    case "audio":
      return [BundleType.Album, BundleType.Playlist];
    case "video":
      return [BundleType.Series, BundleType.Playlist, BundleType.Course];
    case "image":
      return [BundleType.Collection];
    case "document":
      return [BundleType.Course, BundleType.Collection];
    case "file":
      return [BundleType.ProductPack, BundleType.Course];
    case "text":
      return [BundleType.Newsletter, BundleType.Course];
    default:
      return [BundleType.Collection, BundleType.Playlist];
  }
}

// ========== SUBSCRIPTION SYSTEM CONSTANTS (Phase 1) ==========

// Unified NFT reward state seed (replaces per-pool NftRewardState)
export const UNIFIED_NFT_REWARD_STATE_SEED = "unified_nft_reward";

// Creator patron pool seeds
export const CREATOR_PATRON_POOL_SEED = "creator_patron_pool";
export const CREATOR_PATRON_TREASURY_SEED = "creator_patron_treasury";
export const CREATOR_PATRON_CONFIG_SEED = "creator_patron_config";
export const CREATOR_PATRON_SUB_SEED = "creator_patron_sub";

// Global pools (singletons)
export const GLOBAL_HOLDER_POOL_SEED = "global_holder_pool";
export const CREATOR_DIST_POOL_SEED = "creator_dist_pool";
export const ECOSYSTEM_EPOCH_STATE_SEED = "ecosystem_epoch_state";

// Creator weight tracking
export const CREATOR_WEIGHT_SEED = "creator_weight";

// Ecosystem subscription seeds
export const ECOSYSTEM_STREAMING_TREASURY_SEED = "ecosystem_streaming_treasury";
export const ECOSYSTEM_SUB_CONFIG_SEED = "ecosystem_sub_config";
export const ECOSYSTEM_SUB_SEED = "ecosystem_sub";

// Default epoch duration: 30 days in seconds
export const DEFAULT_EPOCH_DURATION = 30 * 24 * 60 * 60; // 2,592,000 seconds

// Patron tier enum (matches program)
export enum PatronTier {
  Membership = 0,   // Support only, no content access
  Subscription = 1, // Support + Level 2 content access
}

// Visibility levels (matches program)
// Access is CUMULATIVE: higher levels grant access to all lower levels
// Level 0: Anyone can access
// Level 1: Ecosystem sub OR Creator sub OR NFT/Rental
// Level 2: Creator sub OR NFT/Rental (ecosystem sub NOT enough)
// Level 3: NFT/Rental ONLY (no subscription grants access)
export enum VisibilityLevel {
  Public = 0,           // No access requirement (free content)
  Ecosystem = 1,        // Ecosystem sub + Creator sub + NFT/Rental can access
  Subscriber = 2,       // Creator sub + NFT/Rental only (ecosystem sub NOT enough)
  NftOnly = 3,          // ONLY NFT owners or active renters (no subscribers)
}

// Helper to get visibility level label
export function getVisibilityLevelLabel(level: VisibilityLevel): string {
  switch (level) {
    case VisibilityLevel.Public: return "Public";
    case VisibilityLevel.Ecosystem: return "Ecosystem Access";
    case VisibilityLevel.Subscriber: return "Subscriber Only";
    case VisibilityLevel.NftOnly: return "NFT/Rental Only";
  }
}

// Helper to get visibility level description
export function getVisibilityLevelDescription(level: VisibilityLevel): string {
  switch (level) {
    case VisibilityLevel.Public:
      return "Anyone can access this content for free";
    case VisibilityLevel.Ecosystem:
      return "Requires ecosystem subscription, creator subscription, or NFT ownership";
    case VisibilityLevel.Subscriber:
      return "Requires creator subscription or NFT ownership (ecosystem sub not enough)";
    case VisibilityLevel.NftOnly:
      return "Only NFT owners or active renters can access (subscriptions don't grant access)";
  }
}

// Re-export new rarity weights for subscription system
// These are the actual weights used (not multiplied by WEIGHT_PRECISION)
export const SUBSCRIPTION_RARITY_WEIGHT_COMMON = 1;
export const SUBSCRIPTION_RARITY_WEIGHT_UNCOMMON = 5;
export const SUBSCRIPTION_RARITY_WEIGHT_RARE = 20;
export const SUBSCRIPTION_RARITY_WEIGHT_EPIC = 60;
export const SUBSCRIPTION_RARITY_WEIGHT_LEGENDARY = 120;

// ========== STREAMFLOW CONSTANTS (for CPI-based membership) ==========

// Streamflow Program ID (devnet - production uses same ID)
export const STREAMFLOW_PROGRAM_ID_STRING = "HqDGZjaVRXJ9MGRQEw7qDc2rAr6iH1n1kAQdCZaCMfMZ";
export const STREAMFLOW_PROGRAM_ID = new PublicKey(STREAMFLOW_PROGRAM_ID_STRING);

// Streamflow Treasury (for their 0.25% fee)
export const STREAMFLOW_TREASURY_STRING = "5SEpbdjFK5FxwTvfsGMXVQTD2v4M2c5tyRTxhdsPkgDw";
export const STREAMFLOW_TREASURY = new PublicKey(STREAMFLOW_TREASURY_STRING);

// Streamflow Withdrawor (for automatic withdrawals - not used by us)
export const STREAMFLOW_WITHDRAWOR_STRING = "wdrwhnCv4pzW8beKsbPa4S2UDZrXenjg16KJdKSpb5u";
export const STREAMFLOW_WITHDRAWOR = new PublicKey(STREAMFLOW_WITHDRAWOR_STRING);

// Streamflow Fee Oracle (same as PROGRAM_ID)
export const STREAMFLOW_FEE_ORACLE_STRING = "5r5Le8NEtokFbkzcYmdKuq1mjLnQeTaFm3oavUMbyAG7";
export const STREAMFLOW_FEE_ORACLE = new PublicKey(STREAMFLOW_FEE_ORACLE_STRING);

// WSOL Mint (Native SOL wrapped)
export const WSOL_MINT_STRING = "So11111111111111111111111111111111111111112";
export const WSOL_MINT = new PublicKey(WSOL_MINT_STRING);

// Note: SECONDS_PER_DAY, SECONDS_PER_MONTH, SECONDS_PER_YEAR are exported from ./streamflow

// Duration type enum (matches program)
export enum MembershipDurationType {
  Monthly = 0,
  Yearly = 1,
}

// Membership tier enum (matches program - for creator membership)
export enum MembershipTier {
  Membership = 0,   // Support only, no content access
  Subscription = 1, // Support + Level 2 content access
}
