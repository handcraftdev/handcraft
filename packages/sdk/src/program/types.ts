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
