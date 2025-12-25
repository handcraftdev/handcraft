import { PublicKey } from "@solana/web3.js";
import idl from "./content_registry.json";

// Program ID from IDL (single source of truth - updated by `anchor build`)
export const PROGRAM_ID_STRING = idl.address;

// Metaplex Core Program ID as string
export const MPL_CORE_PROGRAM_ID_STRING = "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d";

// Lazy getters for PublicKey instances to avoid SSR/bundling issues
let _PROGRAM_ID: PublicKey | null = null;
export function getProgramId(): PublicKey {
  if (!_PROGRAM_ID) _PROGRAM_ID = new PublicKey(PROGRAM_ID_STRING);
  return _PROGRAM_ID;
}
// Legacy export - calls getter
export const PROGRAM_ID = {
  toString: () => PROGRAM_ID_STRING,
  toBase58: () => PROGRAM_ID_STRING,
  toBuffer: () => getProgramId().toBuffer(),
  toBytes: () => getProgramId().toBytes(),
  equals: (other: PublicKey) => getProgramId().equals(other),
} as unknown as PublicKey;

let _MPL_CORE_PROGRAM_ID: PublicKey | null = null;
export function getMplCoreProgramId(): PublicKey {
  if (!_MPL_CORE_PROGRAM_ID) _MPL_CORE_PROGRAM_ID = new PublicKey(MPL_CORE_PROGRAM_ID_STRING);
  return _MPL_CORE_PROGRAM_ID;
}
export const MPL_CORE_PROGRAM_ID = {
  toString: () => MPL_CORE_PROGRAM_ID_STRING,
  toBase58: () => MPL_CORE_PROGRAM_ID_STRING,
  toBuffer: () => getMplCoreProgramId().toBuffer(),
  toBytes: () => getMplCoreProgramId().toBytes(),
  equals: (other: PublicKey) => getMplCoreProgramId().equals(other),
} as unknown as PublicKey;

// Seeds for PDA derivation
export const ECOSYSTEM_CONFIG_SEED = "ecosystem";
export const MINT_CONFIG_SEED = "mint_config";
export const CONTENT_REWARD_POOL_SEED = "content_reward_pool";
export const WALLET_CONTENT_STATE_SEED = "wallet_content";
export const USER_PROFILE_SEED = "user_profile";
// Unified reward pool seed (for bundles that now use unified types)
export const REWARD_POOL_SEED = "reward_pool";
export const WALLET_ITEM_STATE_SEED = "wallet_item";

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

// Rent tier (matches program) - using const object for Turbopack compatibility
export const RentTier = {
  SixHours: 0,
  OneDay: 1,
  SevenDays: 2,
} as const;
export type RentTier = typeof RentTier[keyof typeof RentTier];

// Helper to get period seconds for a tier
export function getRentTierPeriod(tier: RentTier): number {
  switch (tier) {
    case 0: return RENT_PERIOD_6H;  // SixHours
    case 1: return RENT_PERIOD_1D;  // OneDay
    case 2: return RENT_PERIOD_7D;  // SevenDays
    default: return RENT_PERIOD_1D;
  }
}

// Helper to get tier label
export function getRentTierLabel(tier: RentTier): string {
  switch (tier) {
    case 0: return "6 Hours";  // SixHours
    case 1: return "1 Day";    // OneDay
    case 2: return "7 Days";   // SevenDays
    default: return "1 Day";
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

// Using const object for Turbopack compatibility
export const ContentType = {
  // Video domain (0-4)
  Video: 0,
  Movie: 1,
  Television: 2,
  MusicVideo: 3,
  Short: 4,
  // Audio domain (5-7)
  Music: 5,
  Podcast: 6,
  Audiobook: 7,
  // Image domain (8-9)
  Photo: 8,
  Artwork: 9,
  // Document domain (10-11)
  Book: 10,
  Comic: 11,
  // File domain (12-15)
  Asset: 12,
  Game: 13,
  Software: 14,
  Dataset: 15,
  // Text domain (16)
  Post: 16,
} as const;
export type ContentType = typeof ContentType[keyof typeof ContentType];

// Domain helpers
export type ContentDomain = "video" | "audio" | "image" | "document" | "file" | "text";

// Using numeric values for Turbopack compatibility
export function getContentDomain(type: ContentType): ContentDomain {
  switch (type) {
    case 0: case 1: case 2: case 3: case 4: // Video, Movie, Television, MusicVideo, Short
      return "video";
    case 5: case 6: case 7: // Music, Podcast, Audiobook
      return "audio";
    case 8: case 9: // Photo, Artwork
      return "image";
    case 10: case 11: // Book, Comic
      return "document";
    case 12: case 13: case 14: case 15: // Asset, Game, Software, Dataset
      return "file";
    case 16: // Post
      return "text";
    default:
      return "video";
  }
}

export function getContentTypeLabel(type: ContentType): string {
  switch (type) {
    case 0: return "Video";
    case 1: return "Movie";
    case 2: return "Television";
    case 3: return "Music Video";
    case 4: return "Short";
    case 5: return "Music";
    case 6: return "Podcast";
    case 7: return "Audiobook";
    case 8: return "Photo";
    case 9: return "Artwork";
    case 10: return "Book";
    case 11: return "Comic";
    case 12: return "Asset";
    case 13: return "Game";
    case 14: return "Software";
    case 15: return "Dataset";
    case 16: return "Post";
    default: return "Content";
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

// Payment currency (SOL only now) - using const object for Turbopack compatibility
export const PaymentCurrency = {
  Sol: 0,
} as const;
export type PaymentCurrency = typeof PaymentCurrency[keyof typeof PaymentCurrency];

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
let _MAGICBLOCK_VRF_PROGRAM_ID: PublicKey | null = null;
export const MAGICBLOCK_VRF_PROGRAM_ID = {
  get toBase58() { return () => { if (!_MAGICBLOCK_VRF_PROGRAM_ID) _MAGICBLOCK_VRF_PROGRAM_ID = new PublicKey(MAGICBLOCK_VRF_PROGRAM_ID_STRING); return _MAGICBLOCK_VRF_PROGRAM_ID.toBase58(); }; },
  get toBuffer() { return () => { if (!_MAGICBLOCK_VRF_PROGRAM_ID) _MAGICBLOCK_VRF_PROGRAM_ID = new PublicKey(MAGICBLOCK_VRF_PROGRAM_ID_STRING); return _MAGICBLOCK_VRF_PROGRAM_ID.toBuffer(); }; },
  get equals() { return (other: PublicKey) => { if (!_MAGICBLOCK_VRF_PROGRAM_ID) _MAGICBLOCK_VRF_PROGRAM_ID = new PublicKey(MAGICBLOCK_VRF_PROGRAM_ID_STRING); return _MAGICBLOCK_VRF_PROGRAM_ID.equals(other); }; },
} as unknown as PublicKey;

// MagicBlock Default Queue
export const MAGICBLOCK_DEFAULT_QUEUE_STRING = "Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh";
let _MAGICBLOCK_DEFAULT_QUEUE: PublicKey | null = null;
export const MAGICBLOCK_DEFAULT_QUEUE = {
  get toBase58() { return () => { if (!_MAGICBLOCK_DEFAULT_QUEUE) _MAGICBLOCK_DEFAULT_QUEUE = new PublicKey(MAGICBLOCK_DEFAULT_QUEUE_STRING); return _MAGICBLOCK_DEFAULT_QUEUE.toBase58(); }; },
  get toBuffer() { return () => { if (!_MAGICBLOCK_DEFAULT_QUEUE) _MAGICBLOCK_DEFAULT_QUEUE = new PublicKey(MAGICBLOCK_DEFAULT_QUEUE_STRING); return _MAGICBLOCK_DEFAULT_QUEUE.toBuffer(); }; },
  get equals() { return (other: PublicKey) => { if (!_MAGICBLOCK_DEFAULT_QUEUE) _MAGICBLOCK_DEFAULT_QUEUE = new PublicKey(MAGICBLOCK_DEFAULT_QUEUE_STRING); return _MAGICBLOCK_DEFAULT_QUEUE.equals(other); }; },
} as unknown as PublicKey;

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

// Bundle type labels - using numeric values for Turbopack compatibility
export function getBundleTypeLabel(type: import("./types").BundleType): string {
  switch (type) {
    case 0: return "Album";       // Album
    case 1: return "Series";      // Series
    case 2: return "Playlist";    // Playlist
    case 3: return "Course";      // Course
    case 4: return "Newsletter";  // Newsletter
    case 5: return "Collection";  // Collection
    case 6: return "Product Pack"; // ProductPack
    default: return "Unknown";
  }
}

// Get bundle type from string - using numeric values for Turbopack compatibility
export function getBundleTypeFromString(str: string): import("./types").BundleType {
  const normalized = str.toLowerCase();
  switch (normalized) {
    case "album": return 0;       // Album
    case "series": return 1;      // Series
    case "playlist": return 2;    // Playlist
    case "course": return 3;      // Course
    case "newsletter": return 4;  // Newsletter
    case "collection": return 5;  // Collection
    case "productpack":
    case "product_pack":
    case "product-pack": return 6; // ProductPack
    default: return 5; // Collection
  }
}

// Suggested bundle types per content domain - using numeric values for Turbopack compatibility
export function getSuggestedBundleTypes(domain: ContentDomain): import("./types").BundleType[] {
  switch (domain) {
    case "audio":
      return [0, 2];  // Album, Playlist
    case "video":
      return [1, 2, 3];  // Series, Playlist, Course
    case "image":
      return [5];  // Collection
    case "document":
      return [3, 5];  // Course, Collection
    case "file":
      return [6, 3];  // ProductPack, Course
    case "text":
      return [4, 3];  // Newsletter, Course
    default:
      return [5, 2];  // Collection, Playlist
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

// Patron tier (matches program) - using const object for Turbopack compatibility
export const PatronTier = {
  Membership: 0,   // Support only, no content access
  Subscription: 1, // Support + Level 2 content access
} as const;
export type PatronTier = typeof PatronTier[keyof typeof PatronTier];

// Visibility levels (matches program) - using const object for Turbopack compatibility
// Access is CUMULATIVE: higher levels grant access to all lower levels
// Level 0: Anyone can access
// Level 1: Ecosystem sub OR Creator sub OR NFT/Rental
// Level 2: Creator sub OR NFT/Rental (ecosystem sub NOT enough)
// Level 3: NFT/Rental ONLY (no subscription grants access)
export const VisibilityLevel = {
  Public: 0,           // No access requirement (free content)
  Ecosystem: 1,        // Ecosystem sub + Creator sub + NFT/Rental can access
  Subscriber: 2,       // Creator sub + NFT/Rental only (ecosystem sub NOT enough)
  NftOnly: 3,          // ONLY NFT owners or active renters (no subscribers)
} as const;
export type VisibilityLevel = typeof VisibilityLevel[keyof typeof VisibilityLevel];

// Helper to get visibility level label - using numeric values for Turbopack compatibility
export function getVisibilityLevelLabel(level: VisibilityLevel): string {
  switch (level) {
    case 0: return "Public";           // Public
    case 1: return "Ecosystem Access"; // Ecosystem
    case 2: return "Subscriber Only";  // Subscriber
    case 3: return "NFT/Rental Only";  // NftOnly
    default: return "Public";
  }
}

// Helper to get visibility level description - using numeric values for Turbopack compatibility
export function getVisibilityLevelDescription(level: VisibilityLevel): string {
  switch (level) {
    case 0: // Public
      return "Anyone can access this content for free";
    case 1: // Ecosystem
      return "Requires ecosystem subscription, creator subscription, or NFT ownership";
    case 2: // Subscriber
      return "Requires creator subscription or NFT ownership (ecosystem sub not enough)";
    case 3: // NftOnly
      return "Only NFT owners or active renters can access (subscriptions don't grant access)";
    default:
      return "Anyone can access this content for free";
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
let _STREAMFLOW_PROGRAM_ID: PublicKey | null = null;
export function getStreamflowProgramId(): PublicKey {
  if (!_STREAMFLOW_PROGRAM_ID) _STREAMFLOW_PROGRAM_ID = new PublicKey(STREAMFLOW_PROGRAM_ID_STRING);
  return _STREAMFLOW_PROGRAM_ID;
}
export const STREAMFLOW_PROGRAM_ID = {
  get toBase58() { return () => { if (!_STREAMFLOW_PROGRAM_ID) _STREAMFLOW_PROGRAM_ID = new PublicKey(STREAMFLOW_PROGRAM_ID_STRING); return _STREAMFLOW_PROGRAM_ID.toBase58(); }; },
  get toBuffer() { return () => { if (!_STREAMFLOW_PROGRAM_ID) _STREAMFLOW_PROGRAM_ID = new PublicKey(STREAMFLOW_PROGRAM_ID_STRING); return _STREAMFLOW_PROGRAM_ID.toBuffer(); }; },
  get equals() { return (other: PublicKey) => { if (!_STREAMFLOW_PROGRAM_ID) _STREAMFLOW_PROGRAM_ID = new PublicKey(STREAMFLOW_PROGRAM_ID_STRING); return _STREAMFLOW_PROGRAM_ID.equals(other); }; },
} as unknown as PublicKey;

// Streamflow Treasury (for their 0.25% fee)
export const STREAMFLOW_TREASURY_STRING = "5SEpbdjFK5FxwTvfsGMXVQTD2v4M2c5tyRTxhdsPkgDw";
let _STREAMFLOW_TREASURY: PublicKey | null = null;
export const STREAMFLOW_TREASURY = {
  get toBase58() { return () => { if (!_STREAMFLOW_TREASURY) _STREAMFLOW_TREASURY = new PublicKey(STREAMFLOW_TREASURY_STRING); return _STREAMFLOW_TREASURY.toBase58(); }; },
  get toBuffer() { return () => { if (!_STREAMFLOW_TREASURY) _STREAMFLOW_TREASURY = new PublicKey(STREAMFLOW_TREASURY_STRING); return _STREAMFLOW_TREASURY.toBuffer(); }; },
  get equals() { return (other: PublicKey) => { if (!_STREAMFLOW_TREASURY) _STREAMFLOW_TREASURY = new PublicKey(STREAMFLOW_TREASURY_STRING); return _STREAMFLOW_TREASURY.equals(other); }; },
} as unknown as PublicKey;

// Streamflow Withdrawor (for automatic withdrawals - not used by us)
export const STREAMFLOW_WITHDRAWOR_STRING = "wdrwhnCv4pzW8beKsbPa4S2UDZrXenjg16KJdKSpb5u";
let _STREAMFLOW_WITHDRAWOR: PublicKey | null = null;
export const STREAMFLOW_WITHDRAWOR = {
  get toBase58() { return () => { if (!_STREAMFLOW_WITHDRAWOR) _STREAMFLOW_WITHDRAWOR = new PublicKey(STREAMFLOW_WITHDRAWOR_STRING); return _STREAMFLOW_WITHDRAWOR.toBase58(); }; },
  get toBuffer() { return () => { if (!_STREAMFLOW_WITHDRAWOR) _STREAMFLOW_WITHDRAWOR = new PublicKey(STREAMFLOW_WITHDRAWOR_STRING); return _STREAMFLOW_WITHDRAWOR.toBuffer(); }; },
  get equals() { return (other: PublicKey) => { if (!_STREAMFLOW_WITHDRAWOR) _STREAMFLOW_WITHDRAWOR = new PublicKey(STREAMFLOW_WITHDRAWOR_STRING); return _STREAMFLOW_WITHDRAWOR.equals(other); }; },
} as unknown as PublicKey;

// Streamflow Fee Oracle
export const STREAMFLOW_FEE_ORACLE_STRING = "B743wFVk2pCYhV91cn287e1xY7f1vt4gdY48hhNiuQmT";
let _STREAMFLOW_FEE_ORACLE: PublicKey | null = null;
export const STREAMFLOW_FEE_ORACLE = {
  get toBase58() { return () => { if (!_STREAMFLOW_FEE_ORACLE) _STREAMFLOW_FEE_ORACLE = new PublicKey(STREAMFLOW_FEE_ORACLE_STRING); return _STREAMFLOW_FEE_ORACLE.toBase58(); }; },
  get toBuffer() { return () => { if (!_STREAMFLOW_FEE_ORACLE) _STREAMFLOW_FEE_ORACLE = new PublicKey(STREAMFLOW_FEE_ORACLE_STRING); return _STREAMFLOW_FEE_ORACLE.toBuffer(); }; },
  get equals() { return (other: PublicKey) => { if (!_STREAMFLOW_FEE_ORACLE) _STREAMFLOW_FEE_ORACLE = new PublicKey(STREAMFLOW_FEE_ORACLE_STRING); return _STREAMFLOW_FEE_ORACLE.equals(other); }; },
} as unknown as PublicKey;

// WSOL Mint (Native SOL wrapped)
export const WSOL_MINT_STRING = "So11111111111111111111111111111111111111112";
let _WSOL_MINT: PublicKey | null = null;
export const WSOL_MINT = {
  get toBase58() { return () => { if (!_WSOL_MINT) _WSOL_MINT = new PublicKey(WSOL_MINT_STRING); return _WSOL_MINT.toBase58(); }; },
  get toBuffer() { return () => { if (!_WSOL_MINT) _WSOL_MINT = new PublicKey(WSOL_MINT_STRING); return _WSOL_MINT.toBuffer(); }; },
  get equals() { return (other: PublicKey) => { if (!_WSOL_MINT) _WSOL_MINT = new PublicKey(WSOL_MINT_STRING); return _WSOL_MINT.equals(other); }; },
} as unknown as PublicKey;

// Note: SECONDS_PER_DAY, SECONDS_PER_MONTH, SECONDS_PER_YEAR are exported from ./streamflow

// Duration type (matches program) - using const object for Turbopack compatibility
export const MembershipDurationType = {
  Monthly: 0,
  Yearly: 1,
} as const;
export type MembershipDurationType = typeof MembershipDurationType[keyof typeof MembershipDurationType];

// Membership tier (matches program - for creator membership) - using const object for Turbopack compatibility
export const MembershipTier = {
  Membership: 0,   // Support only, no content access
  Subscription: 1, // Support + Level 2 content access
} as const;
export type MembershipTier = typeof MembershipTier[keyof typeof MembershipTier];

// ========== TRIBUNALCRAFT CONSTANTS (for CPI-based content moderation) ==========

// Tribunalcraft Program ID (devnet)
export const TRIBUNALCRAFT_PROGRAM_ID_STRING = "YxF3CEwUr5Nhk8FjzZDhKFcSHfgRHYA31Ccm3vd2Mrz";
// Lazy getter to avoid SSR _bn issues
let _TRIBUNALCRAFT_PROGRAM_ID: PublicKey | null = null;
export function getTribunalcraftProgramId(): PublicKey {
  if (!_TRIBUNALCRAFT_PROGRAM_ID) _TRIBUNALCRAFT_PROGRAM_ID = new PublicKey(TRIBUNALCRAFT_PROGRAM_ID_STRING);
  return _TRIBUNALCRAFT_PROGRAM_ID;
}
export const TRIBUNALCRAFT_PROGRAM_ID = {
  toString: () => TRIBUNALCRAFT_PROGRAM_ID_STRING,
  toBase58: () => TRIBUNALCRAFT_PROGRAM_ID_STRING,
  toBuffer: () => getTribunalcraftProgramId().toBuffer(),
  toBytes: () => getTribunalcraftProgramId().toBytes(),
  equals: (other: PublicKey) => getTribunalcraftProgramId().equals(other),
} as unknown as PublicKey;

// Tribunalcraft PDA seeds
export const TC_SUBJECT_SEED = "subject";
export const TC_DISPUTE_SEED = "dispute";
export const TC_ESCROW_SEED = "escrow";
export const TC_DEFENDER_POOL_SEED = "defender_pool";
export const TC_DEFENDER_RECORD_SEED = "defender_record";

// Handcraft namespace seed for deriving Tribunalcraft subject IDs
// This ensures Handcraft content subjects are unique to our platform
export const HANDCRAFT_TC_SEED = "handcraft";
