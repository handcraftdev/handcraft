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
