import { PublicKey } from "@solana/web3.js";

// Network configuration
export const NETWORKS = {
  devnet: {
    name: "devnet",
    rpcUrl: "https://api.devnet.solana.com",
    wsUrl: "wss://api.devnet.solana.com",
  },
  mainnet: {
    name: "mainnet-beta",
    rpcUrl: "https://api.mainnet-beta.solana.com",
    wsUrl: "wss://api.mainnet-beta.solana.com",
  },
} as const;

// Token mints (will be updated with actual addresses)
export const TOKEN_MINTS = {
  // USDC on devnet/mainnet
  USDC_DEVNET: new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"),
  USDC_MAINNET: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),

  // $CRAFT token (placeholder - will be deployed)
  CRAFT_DEVNET: new PublicKey("11111111111111111111111111111111"), // placeholder
  CRAFT_MAINNET: new PublicKey("11111111111111111111111111111111"), // placeholder
} as const;

// IPFS/Storage configuration
export const STORAGE = {
  IPFS_GATEWAY: "https://ipfs.filebase.io/ipfs/",
  ARWEAVE_GATEWAY: "https://arweave.net/",
} as const;

// Content limits
export const LIMITS = {
  MAX_VIDEO_SIZE_MB: 500,
  MAX_AUDIO_SIZE_MB: 100,
  MAX_IMAGE_SIZE_MB: 10,
  MAX_TITLE_LENGTH: 200,
  MAX_DESCRIPTION_LENGTH: 5000,
  MAX_BIO_LENGTH: 500,
  MAX_USERNAME_LENGTH: 30,
  SHORT_VIDEO_MAX_SECONDS: 180, // 3 minutes
} as const;

// Fee configuration (in basis points, 100 = 1%)
export const FEES = {
  PLATFORM_FEE_BPS: 250, // 2.5% platform fee on tips
  CREATOR_SHARE_BPS: 9750, // 97.5% goes to creator
} as const;
