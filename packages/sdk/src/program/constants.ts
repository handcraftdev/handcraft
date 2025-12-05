import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey("EvnyqtTHHeNYoeauSgXMAUSu4EFeEsbxUxVzhC2NaDHU");

// Metaplex Core Program ID
export const MPL_CORE_PROGRAM_ID = new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");

// Seeds for PDA derivation
export const ECOSYSTEM_CONFIG_SEED = "ecosystem";
export const MINT_CONFIG_SEED = "mint_config";
export const CONTENT_REWARD_POOL_SEED = "content_reward_pool";
export const WALLET_CONTENT_STATE_SEED = "wallet_content";
export const CONTENT_COLLECTION_SEED = "content_collection";

// Legacy seeds (for migration)
export const GLOBAL_REWARD_POOL_SEED = "global_reward_pool";
export const NFT_REWARD_STATE_SEED = "nft_reward";

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
  // Video types
  Movie = 0,
  TvSeries = 1,
  MusicVideo = 2,
  ShortVideo = 3,
  GeneralVideo = 4,
  // Book types
  Comic = 5,
  GeneralBook = 6,
  // Audio types
  Podcast = 7,
  Audiobook = 8,
  GeneralAudio = 9,
  // Image types
  Photo = 10,
  Art = 11,
  GeneralImage = 12,
}

// Category helpers
export type ContentCategory = "video" | "book" | "audio" | "image";

export function getContentCategory(type: ContentType): ContentCategory {
  switch (type) {
    case ContentType.Movie:
    case ContentType.TvSeries:
    case ContentType.MusicVideo:
    case ContentType.ShortVideo:
    case ContentType.GeneralVideo:
      return "video";
    case ContentType.Comic:
    case ContentType.GeneralBook:
      return "book";
    case ContentType.Podcast:
    case ContentType.Audiobook:
    case ContentType.GeneralAudio:
      return "audio";
    case ContentType.Photo:
    case ContentType.Art:
    case ContentType.GeneralImage:
      return "image";
  }
}

export function getContentTypeLabel(type: ContentType): string {
  switch (type) {
    case ContentType.Movie: return "Movie";
    case ContentType.TvSeries: return "TV Series";
    case ContentType.MusicVideo: return "Music Video";
    case ContentType.ShortVideo: return "Short Video";
    case ContentType.GeneralVideo: return "Video";
    case ContentType.Comic: return "Comic";
    case ContentType.GeneralBook: return "Book";
    case ContentType.Podcast: return "Podcast";
    case ContentType.Audiobook: return "Audiobook";
    case ContentType.GeneralAudio: return "Audio";
    case ContentType.Photo: return "Photo";
    case ContentType.Art: return "Art";
    case ContentType.GeneralImage: return "Image";
  }
}

// Payment currency enum (SOL only now)
export enum PaymentCurrency {
  Sol = 0,
}
