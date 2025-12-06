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
export const CONTENT_COLLECTION_SEED = "content_collection";

// Legacy seeds (for migration)
export const GLOBAL_REWARD_POOL_SEED = "global_reward_pool";
export const NFT_REWARD_STATE_SEED = "nft_reward";

// Rent seeds
export const RENT_CONFIG_SEED = "rent_config";
export const RENT_ENTRY_SEED = "rent_entry";

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
export const PLATFORM_FEE_SECONDARY_BPS = 100; // 1%
export const ECOSYSTEM_FEE_SECONDARY_BPS = 50; // 0.5%
export const MIN_CREATOR_ROYALTY_BPS = 200;    // 2%
export const MAX_CREATOR_ROYALTY_BPS = 1000;   // 10%

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

// Legacy alias for backward compatibility
export type ContentCategory = ContentDomain;
export const getContentCategory = getContentDomain;

// Payment currency enum (SOL only now)
export enum PaymentCurrency {
  Sol = 0,
}
