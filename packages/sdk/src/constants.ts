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

// Token mint addresses as strings (to avoid SSR/bundling issues)
export const TOKEN_MINT_STRINGS = {
  USDC_DEVNET: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  USDC_MAINNET: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  CRAFT_DEVNET: "11111111111111111111111111111111",
  CRAFT_MAINNET: "11111111111111111111111111111111",
} as const;

// Token mints - lazily create PublicKey objects
export function getTokenMint(key: keyof typeof TOKEN_MINT_STRINGS): PublicKey {
  return new PublicKey(TOKEN_MINT_STRINGS[key]);
}

// Legacy export for backwards compatibility (lazy)
export const TOKEN_MINTS = {
  get USDC_DEVNET() { return getTokenMint("USDC_DEVNET"); },
  get USDC_MAINNET() { return getTokenMint("USDC_MAINNET"); },
  get CRAFT_DEVNET() { return getTokenMint("CRAFT_DEVNET"); },
  get CRAFT_MAINNET() { return getTokenMint("CRAFT_MAINNET"); },
};

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
