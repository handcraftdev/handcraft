import { PublicKey } from "@solana/web3.js";
import { sha256 } from "js-sha256";
import {
  PROGRAM_ID,
  ECOSYSTEM_CONFIG_SEED,
  MINT_CONFIG_SEED,
  CONTENT_REWARD_POOL_SEED,
  WALLET_CONTENT_STATE_SEED,
  USER_PROFILE_SEED,
  RENT_CONFIG_SEED,
  PENDING_MINT_SEED,
  MB_MINT_REQUEST_SEED,
  MB_NFT_SEED,
  BUNDLE_SEED,
  BUNDLE_ITEM_SEED,
  BUNDLE_MINT_CONFIG_SEED,
  BUNDLE_RENT_CONFIG_SEED,
  BUNDLE_REWARD_POOL_SEED,
  BUNDLE_WALLET_STATE_SEED,
  BUNDLE_DIRECT_NFT_SEED,
  MB_BUNDLE_MINT_REQUEST_SEED,
  MB_BUNDLE_NFT_SEED,
  PRECISION,
  CREATOR_FEE_PRIMARY_BPS,
  PLATFORM_FEE_PRIMARY_BPS,
  ECOSYSTEM_FEE_PRIMARY_BPS,
  HOLDER_REWARD_PRIMARY_BPS,
  // Subscription system seeds
  UNIFIED_NFT_REWARD_STATE_SEED,
  CREATOR_PATRON_POOL_SEED,
  CREATOR_PATRON_TREASURY_SEED,
  CREATOR_PATRON_CONFIG_SEED,
  CREATOR_PATRON_SUB_SEED,
  GLOBAL_HOLDER_POOL_SEED,
  CREATOR_DIST_POOL_SEED,
  ECOSYSTEM_EPOCH_STATE_SEED,
  CREATOR_WEIGHT_SEED,
  ECOSYSTEM_STREAMING_TREASURY_SEED,
  ECOSYSTEM_SUB_CONFIG_SEED,
  ECOSYSTEM_SUB_SEED,
  SIMPLE_NFT_SEED,
  // Streamflow constants
  STREAMFLOW_PROGRAM_ID,
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

// NOTE: CidRegistry PDA removed - CID uniqueness is now enforced by ContentEntry PDA seed
// getCidRegistryPda is no longer needed

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

// NOTE: ContentCollection PDA removed - collection_asset is now stored directly in ContentEntry
// getContentCollectionPda is no longer needed

export function getUserProfilePda(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(USER_PROFILE_SEED), owner.toBuffer()],
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

// NOTE: RentEntry PDA removed - rental expiry is now stored in NFT Attributes plugin
// getRentEntryPda is no longer needed

export function getPendingMintPda(buyer: PublicKey, contentPda: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PENDING_MINT_SEED), buyer.toBuffer(), contentPda.toBuffer()],
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

// NOTE: BundleCollection PDA removed - collection_asset is now stored directly in Bundle

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

// NOTE: BundleRentEntry PDA removed - rental expiry is now stored in NFT Attributes plugin
// getBundleRentEntryPda is no longer needed

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

// ========== SUBSCRIPTION SYSTEM PDAs (Phase 1) ==========

/**
 * Get the UnifiedNftRewardState PDA for an NFT
 * Single account per NFT tracking all pool debts
 * @param nftAsset - The NFT asset's public key
 */
export function getUnifiedNftRewardStatePda(nftAsset: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(UNIFIED_NFT_REWARD_STATE_SEED), nftAsset.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Get the CreatorPatronPool PDA for a creator
 * Holds SOL for NFT holder claims (12% of patron subscriptions)
 * @param creator - The creator's public key
 */
export function getCreatorPatronPoolPda(creator: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(CREATOR_PATRON_POOL_SEED), creator.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Get the CreatorPatronStreamingTreasury PDA for a creator
 * Receives Streamflow payments from patron subscribers
 * @param creator - The creator's public key
 */
export function getCreatorPatronTreasuryPda(creator: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(CREATOR_PATRON_TREASURY_SEED), creator.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Get the CreatorPatronConfig PDA for a creator
 * Creator's subscription/membership tier configuration
 * @param creator - The creator's public key
 */
export function getCreatorPatronConfigPda(creator: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(CREATOR_PATRON_CONFIG_SEED), creator.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Get the CreatorPatronSubscription PDA for a subscriber and creator
 * Tracks a user's subscription to a specific creator
 * @param subscriber - The subscriber's public key
 * @param creator - The creator's public key
 */
export function getCreatorPatronSubscriptionPda(subscriber: PublicKey, creator: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(CREATOR_PATRON_SUB_SEED), subscriber.toBuffer(), creator.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Get the GlobalHolderPool PDA (singleton)
 * Holds SOL for NFT holder claims (12% of ecosystem subscriptions)
 */
export function getGlobalHolderPoolPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(GLOBAL_HOLDER_POOL_SEED)],
    PROGRAM_ID
  );
}

/**
 * Get the CreatorDistPool PDA (singleton)
 * Holds SOL for creator claims (80% of ecosystem subscriptions)
 */
export function getCreatorDistPoolPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(CREATOR_DIST_POOL_SEED)],
    PROGRAM_ID
  );
}

/**
 * Get the EcosystemEpochState PDA (singleton)
 * Shared epoch tracking for GlobalHolderPool and CreatorDistPool
 */
export function getEcosystemEpochStatePda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(ECOSYSTEM_EPOCH_STATE_SEED)],
    PROGRAM_ID
  );
}

/**
 * Get the CreatorWeight PDA for a creator
 * Tracks total weight of creator's NFTs for ecosystem payouts
 * @param creator - The creator's public key
 */
export function getCreatorWeightPda(creator: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(CREATOR_WEIGHT_SEED), creator.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Get the EcosystemStreamingTreasury PDA (singleton)
 * Receives Streamflow payments from ecosystem subscribers
 */
export function getEcosystemStreamingTreasuryPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(ECOSYSTEM_STREAMING_TREASURY_SEED)],
    PROGRAM_ID
  );
}

/**
 * Get the EcosystemSubConfig PDA (singleton)
 * Platform-wide ecosystem subscription configuration
 */
export function getEcosystemSubConfigPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(ECOSYSTEM_SUB_CONFIG_SEED)],
    PROGRAM_ID
  );
}

/**
 * Get the EcosystemSubscription PDA for a subscriber
 * Tracks a user's ecosystem subscription
 * @param subscriber - The subscriber's public key
 */
export function getEcosystemSubscriptionPda(subscriber: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(ECOSYSTEM_SUB_SEED), subscriber.toBuffer()],
    PROGRAM_ID
  );
}

// ========== SIMPLE MINT PDAs ==========

/**
 * Get the Simple NFT PDA for a buyer, content, and edition
 * Used for unified mint with subscription pool tracking
 * @param buyer - The buyer's public key
 * @param contentPda - The content's PDA
 * @param edition - The edition number
 */
export function getSimpleNftPda(buyer: PublicKey, contentPda: PublicKey, edition: bigint): [PublicKey, number] {
  // Convert edition to little-endian u64 bytes
  const editionBytes = new Uint8Array(8);
  let value = edition;
  for (let i = 0; i < 8; i++) {
    editionBytes[i] = Number(value & BigInt(0xff));
    value = value >> BigInt(8);
  }

  return PublicKey.findProgramAddressSync(
    [Buffer.from(SIMPLE_NFT_SEED), buyer.toBuffer(), contentPda.toBuffer(), editionBytes],
    PROGRAM_ID
  );
}

/**
 * Get the Simple Bundle NFT PDA for a buyer, bundle, and edition
 * Used for unified bundle mint with subscription pool tracking
 * @param buyer - The buyer's public key
 * @param bundlePda - The bundle's PDA
 * @param edition - The edition number
 */
export function getSimpleBundleNftPda(buyer: PublicKey, bundlePda: PublicKey, edition: bigint): [PublicKey, number] {
  // Convert edition to little-endian u64 bytes
  const editionBytes = new Uint8Array(8);
  let value = edition;
  for (let i = 0; i < 8; i++) {
    editionBytes[i] = Number(value & BigInt(0xff));
    value = value >> BigInt(8);
  }

  return PublicKey.findProgramAddressSync(
    [Buffer.from(SIMPLE_NFT_SEED), buyer.toBuffer(), bundlePda.toBuffer(), editionBytes],
    PROGRAM_ID
  );
}

// ========== STREAMFLOW PDAs ==========

/**
 * Get the Streamflow escrow tokens PDA
 * This is where streamed tokens are held until claimed
 * @param streamMetadata - The stream metadata account (stream ID)
 */
export function getStreamflowEscrowTokensPda(streamMetadata: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("strm"), streamMetadata.toBuffer()],
    STREAMFLOW_PROGRAM_ID
  );
}
