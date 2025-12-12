import { PublicKey } from "@solana/web3.js";
import { sha256 } from "js-sha256";
import {
  PROGRAM_ID,
  ECOSYSTEM_CONFIG_SEED,
  MINT_CONFIG_SEED,
  CONTENT_REWARD_POOL_SEED,
  WALLET_CONTENT_STATE_SEED,
  CONTENT_COLLECTION_SEED,
  NFT_REWARD_STATE_SEED,
  RENT_CONFIG_SEED,
  RENT_ENTRY_SEED,
  NFT_RARITY_SEED,
  PENDING_MINT_SEED,
  MB_MINT_REQUEST_SEED,
  MB_NFT_SEED,
  BUNDLE_SEED,
  BUNDLE_ITEM_SEED,
  BUNDLE_MINT_CONFIG_SEED,
  BUNDLE_RENT_CONFIG_SEED,
  BUNDLE_COLLECTION_SEED,
  BUNDLE_REWARD_POOL_SEED,
  BUNDLE_WALLET_STATE_SEED,
  BUNDLE_NFT_REWARD_STATE_SEED,
  BUNDLE_NFT_RARITY_SEED,
  BUNDLE_RENT_ENTRY_SEED,
  BUNDLE_DIRECT_NFT_SEED,
  MB_BUNDLE_MINT_REQUEST_SEED,
  MB_BUNDLE_NFT_SEED,
  PRECISION,
  CREATOR_FEE_PRIMARY_BPS,
  PLATFORM_FEE_PRIMARY_BPS,
  ECOSYSTEM_FEE_PRIMARY_BPS,
  HOLDER_REWARD_PRIMARY_BPS,
} from "./constants";

export function hashCid(cid: string): Uint8Array {
  const hash = sha256.array(cid);
  return new Uint8Array(hash);
}

export function getContentPda(contentCid: string): [PublicKey, number] {
  const cidHash = hashCid(contentCid);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("content"), cidHash],
    PROGRAM_ID
  );
}

export function getCidRegistryPda(contentCid: string): [PublicKey, number] {
  const cidHash = hashCid(contentCid);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("cid"), cidHash],
    PROGRAM_ID
  );
}

export function getEcosystemConfigPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(ECOSYSTEM_CONFIG_SEED)],
    PROGRAM_ID
  );
}

export function getMintConfigPda(contentPda: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(MINT_CONFIG_SEED), contentPda.toBuffer()],
    PROGRAM_ID
  );
}

export function getContentRewardPoolPda(contentPda: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(CONTENT_REWARD_POOL_SEED), contentPda.toBuffer()],
    PROGRAM_ID
  );
}

export function getWalletContentStatePda(wallet: PublicKey, contentPda: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(WALLET_CONTENT_STATE_SEED), wallet.toBuffer(), contentPda.toBuffer()],
    PROGRAM_ID
  );
}

export function getContentCollectionPda(contentPda: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(CONTENT_COLLECTION_SEED), contentPda.toBuffer()],
    PROGRAM_ID
  );
}

export function getNftRewardStatePda(nftAsset: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(NFT_REWARD_STATE_SEED), nftAsset.toBuffer()],
    PROGRAM_ID
  );
}

export function calculatePrimarySplit(price: bigint): { creator: bigint; platform: bigint; ecosystem: bigint; holderReward: bigint } {
  const creator = (price * BigInt(CREATOR_FEE_PRIMARY_BPS)) / BigInt(10000);
  const platform = (price * BigInt(PLATFORM_FEE_PRIMARY_BPS)) / BigInt(10000);
  const ecosystem = (price * BigInt(ECOSYSTEM_FEE_PRIMARY_BPS)) / BigInt(10000);
  const holderReward = (price * BigInt(HOLDER_REWARD_PRIMARY_BPS)) / BigInt(10000);

  return { creator, platform, ecosystem, holderReward };
}

export function calculatePendingReward(nftCount: bigint, rewardPerShare: bigint, rewardDebt: bigint): bigint {
  if (nftCount === BigInt(0)) return BigInt(0);
  const accumulated = (nftCount * rewardPerShare) / PRECISION;
  return accumulated > rewardDebt ? accumulated - rewardDebt : BigInt(0);
}

export function calculatePendingRewardForNft(rewardPerShare: bigint, nftRewardDebt: bigint): bigint {
  if (rewardPerShare <= nftRewardDebt) return BigInt(0);
  return (rewardPerShare - nftRewardDebt) / PRECISION;
}

export function getRentConfigPda(contentPda: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(RENT_CONFIG_SEED), contentPda.toBuffer()],
    PROGRAM_ID
  );
}

export function getRentEntryPda(nftAsset: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(RENT_ENTRY_SEED), nftAsset.toBuffer()],
    PROGRAM_ID
  );
}

export function getPendingMintPda(buyer: PublicKey, contentPda: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PENDING_MINT_SEED), buyer.toBuffer(), contentPda.toBuffer()],
    PROGRAM_ID
  );
}

export function getNftRarityPda(nftAsset: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(NFT_RARITY_SEED), nftAsset.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Calculate pending reward for an NFT using weighted formula
 * @param weight NFT's rarity weight (100=Common, 150=Uncommon, 200=Rare, 300=Epic, 500=Legendary)
 * @param rewardPerShare Current reward_per_share from pool
 * @param nftRewardDebt The NFT's reward_debt
 */
export function calculateWeightedPendingReward(weight: number, rewardPerShare: bigint, nftRewardDebt: bigint): bigint {
  const entitled = BigInt(weight) * rewardPerShare;
  if (entitled <= nftRewardDebt) return BigInt(0);
  return (entitled - nftRewardDebt) / PRECISION;
}

// ========== MagicBlock VRF PDAs ==========

/**
 * Get the MagicBlock mint request PDA for a buyer, content, and edition
 * This is used for the 2-step VRF minting flow
 * @param buyer - The buyer's public key
 * @param contentPda - The content PDA
 * @param edition - The edition number (minted_count + pending_count + 1)
 */
export function getMbMintRequestPda(buyer: PublicKey, contentPda: PublicKey, edition: bigint): [PublicKey, number] {
  // Convert edition to little-endian u64 bytes (cross-platform)
  const editionBytes = new Uint8Array(8);
  let value = edition;
  for (let i = 0; i < 8; i++) {
    editionBytes[i] = Number(value & BigInt(0xff));
    value = value >> BigInt(8);
  }

  return PublicKey.findProgramAddressSync(
    [Buffer.from(MB_MINT_REQUEST_SEED), buyer.toBuffer(), contentPda.toBuffer(), editionBytes],
    PROGRAM_ID
  );
}

/**
 * Get the MagicBlock NFT asset PDA derived from the mint request
 * This allows the VRF oracle to create the NFT without user signature
 */
export function getMbNftAssetPda(mintRequestPda: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(MB_NFT_SEED), mintRequestPda.toBuffer()],
    PROGRAM_ID
  );
}

// ========== Bundle PDAs ==========

/**
 * Get the Bundle PDA for a creator and bundle ID
 * @param creator - The bundle creator's public key
 * @param bundleId - The unique bundle identifier (slug or ID string)
 */
export function getBundlePda(creator: PublicKey, bundleId: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(BUNDLE_SEED), creator.toBuffer(), Buffer.from(bundleId)],
    PROGRAM_ID
  );
}

/**
 * Get the BundleItem PDA for a bundle and content
 * @param bundlePda - The bundle's PDA
 * @param contentPda - The content's PDA
 */
export function getBundleItemPda(bundlePda: PublicKey, contentPda: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(BUNDLE_ITEM_SEED), bundlePda.toBuffer(), contentPda.toBuffer()],
    PROGRAM_ID
  );
}

// ========== Bundle Mint/Rent PDAs ==========

/**
 * Get the BundleMintConfig PDA for a bundle
 * @param bundlePda - The bundle's PDA
 */
export function getBundleMintConfigPda(bundlePda: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(BUNDLE_MINT_CONFIG_SEED), bundlePda.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Get the BundleRentConfig PDA for a bundle
 * @param bundlePda - The bundle's PDA
 */
export function getBundleRentConfigPda(bundlePda: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(BUNDLE_RENT_CONFIG_SEED), bundlePda.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Get the BundleCollection PDA for a bundle
 * @param bundlePda - The bundle's PDA
 */
export function getBundleCollectionPda(bundlePda: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(BUNDLE_COLLECTION_SEED), bundlePda.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Get the BundleRewardPool PDA for a bundle
 * @param bundlePda - The bundle's PDA
 */
export function getBundleRewardPoolPda(bundlePda: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(BUNDLE_REWARD_POOL_SEED), bundlePda.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Get the BundleWalletState PDA for a wallet and bundle
 * @param wallet - The wallet's public key
 * @param bundlePda - The bundle's PDA
 */
export function getBundleWalletStatePda(wallet: PublicKey, bundlePda: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(BUNDLE_WALLET_STATE_SEED), wallet.toBuffer(), bundlePda.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Get the BundleNftRewardState PDA for an NFT
 * @param nftAsset - The NFT asset's public key
 */
export function getBundleNftRewardStatePda(nftAsset: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(BUNDLE_NFT_REWARD_STATE_SEED), nftAsset.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Get the BundleNftRarity PDA for an NFT
 * @param nftAsset - The NFT asset's public key
 */
export function getBundleNftRarityPda(nftAsset: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(BUNDLE_NFT_RARITY_SEED), nftAsset.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Get the BundleRentEntry PDA for an NFT
 * @param nftAsset - The rental NFT asset's public key
 */
export function getBundleRentEntryPda(nftAsset: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(BUNDLE_RENT_ENTRY_SEED), nftAsset.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Get the Bundle Direct NFT PDA for a buyer and bundle
 * @param buyer - The buyer's public key
 * @param bundlePda - The bundle's PDA
 * @param edition - The edition number
 */
export function getBundleDirectNftPda(buyer: PublicKey, bundlePda: PublicKey, edition: bigint): [PublicKey, number] {
  // Convert edition to little-endian u64 bytes
  const editionBytes = new Uint8Array(8);
  let value = edition;
  for (let i = 0; i < 8; i++) {
    editionBytes[i] = Number(value & BigInt(0xff));
    value = value >> BigInt(8);
  }

  return PublicKey.findProgramAddressSync(
    [Buffer.from(BUNDLE_DIRECT_NFT_SEED), buyer.toBuffer(), bundlePda.toBuffer(), editionBytes],
    PROGRAM_ID
  );
}

// ========== MagicBlock VRF Bundle PDAs ==========

/**
 * Get the MagicBlock bundle mint request PDA for a buyer, bundle, and edition
 * This is used for the 2-step VRF bundle minting flow
 * @param buyer - The buyer's public key
 * @param bundlePda - The bundle PDA
 * @param edition - The edition number (minted_count + pending_count + 1)
 */
export function getMbBundleMintRequestPda(buyer: PublicKey, bundlePda: PublicKey, edition: bigint): [PublicKey, number] {
  // Convert edition to little-endian u64 bytes (cross-platform)
  const editionBytes = new Uint8Array(8);
  let value = edition;
  for (let i = 0; i < 8; i++) {
    editionBytes[i] = Number(value & BigInt(0xff));
    value = value >> BigInt(8);
  }

  return PublicKey.findProgramAddressSync(
    [Buffer.from(MB_BUNDLE_MINT_REQUEST_SEED), buyer.toBuffer(), bundlePda.toBuffer(), editionBytes],
    PROGRAM_ID
  );
}

/**
 * Get the MagicBlock Bundle NFT asset PDA derived from the mint request
 * This allows the VRF oracle to create the NFT without user signature
 */
export function getMbBundleNftAssetPda(mintRequestPda: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(MB_BUNDLE_NFT_SEED), mintRequestPda.toBuffer()],
    PROGRAM_ID
  );
}
