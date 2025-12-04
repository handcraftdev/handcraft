import { Program, AnchorProvider, Idl, BN } from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram, TransactionInstruction, Keypair } from "@solana/web3.js";
import { sha256 } from "js-sha256";
import idlJson from "./content_registry.json";

export const PROGRAM_ID = new PublicKey("EvnyqtTHHeNYoeauSgXMAUSu4EFeEsbxUxVzhC2NaDHU");

// Metaplex Core Program ID
export const MPL_CORE_PROGRAM_ID = new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");

// Seeds for PDA derivation
export const ECOSYSTEM_CONFIG_SEED = "ecosystem";
export const MINT_CONFIG_SEED = "mint_config";
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
  owner: PublicKey;
  contentPda: PublicKey;
  registeredAt: bigint;
}

export interface MintConfig {
  content: PublicKey;
  creator: PublicKey;
  price: bigint;
  currency: PaymentCurrency;
  maxSupply: bigint | null;
  creatorRoyaltyBps: number;
  isActive: boolean;
  createdAt: bigint;
  updatedAt: bigint;
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

// Global accumulated reward pool interface
export interface GlobalRewardPool {
  rewardPerShare: bigint;   // Scaled by PRECISION (1e12)
  totalNfts: bigint;        // Total NFTs minted across all content
  totalDeposited: bigint;
  totalClaimed: bigint;
  createdAt: bigint;
}

// Per-NFT reward state interface
export interface NftRewardState {
  nftAsset: PublicKey;
  rewardDebt: bigint;       // global reward_per_share at mint/last claim
  createdAt: bigint;
}

// Hash a CID string using SHA-256 (matches Solana's hash function)
export function hashCid(cid: string): Uint8Array {
  return new Uint8Array(sha256.array(cid));
}

// PDA derivation helpers
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

export function getGlobalRewardPoolPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(GLOBAL_REWARD_POOL_SEED)],
    PROGRAM_ID
  );
}

export function getNftRewardStatePda(nftAsset: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(NFT_REWARD_STATE_SEED), nftAsset.toBuffer()],
    PROGRAM_ID
  );
}

// Calculate primary sale split
export function calculatePrimarySplit(price: bigint): { creator: bigint; platform: bigint; ecosystem: bigint; holderReward: bigint } {
  const zero = BigInt(0);
  if (price === zero) {
    return { creator: zero, platform: zero, ecosystem: zero, holderReward: zero };
  }
  const divisor = BigInt(10000);
  const platform = (price * BigInt(PLATFORM_FEE_PRIMARY_BPS)) / divisor;
  const ecosystem = (price * BigInt(ECOSYSTEM_FEE_PRIMARY_BPS)) / divisor;
  const holderReward = (price * BigInt(HOLDER_REWARD_PRIMARY_BPS)) / divisor;
  const creator = price - platform - ecosystem - holderReward;
  return { creator, platform, ecosystem, holderReward };
}

// Calculate pending rewards for an NFT
export function calculatePendingReward(rewardPerShare: bigint, rewardDebt: bigint): bigint {
  if (rewardPerShare <= rewardDebt) {
    return BigInt(0);
  }
  return (rewardPerShare - rewardDebt) / PRECISION;
}

// Convert ContentType enum to Anchor format
function contentTypeToAnchor(type: ContentType): object {
  switch (type) {
    case ContentType.Movie: return { movie: {} };
    case ContentType.TvSeries: return { tvSeries: {} };
    case ContentType.MusicVideo: return { musicVideo: {} };
    case ContentType.ShortVideo: return { shortVideo: {} };
    case ContentType.GeneralVideo: return { generalVideo: {} };
    case ContentType.Comic: return { comic: {} };
    case ContentType.GeneralBook: return { generalBook: {} };
    case ContentType.Podcast: return { podcast: {} };
    case ContentType.Audiobook: return { audiobook: {} };
    case ContentType.GeneralAudio: return { generalAudio: {} };
    case ContentType.Photo: return { photo: {} };
    case ContentType.Art: return { art: {} };
    case ContentType.GeneralImage: return { generalImage: {} };
    default: return { generalVideo: {} };
  }
}

// Convert Anchor enum format to ContentType
function anchorToContentType(anchorType: Record<string, unknown>): ContentType {
  if (anchorType.movie) return ContentType.Movie;
  if (anchorType.tvSeries) return ContentType.TvSeries;
  if (anchorType.musicVideo) return ContentType.MusicVideo;
  if (anchorType.shortVideo) return ContentType.ShortVideo;
  if (anchorType.generalVideo) return ContentType.GeneralVideo;
  if (anchorType.comic) return ContentType.Comic;
  if (anchorType.generalBook) return ContentType.GeneralBook;
  if (anchorType.podcast) return ContentType.Podcast;
  if (anchorType.audiobook) return ContentType.Audiobook;
  if (anchorType.generalAudio) return ContentType.GeneralAudio;
  if (anchorType.photo) return ContentType.Photo;
  if (anchorType.art) return ContentType.Art;
  if (anchorType.generalImage) return ContentType.GeneralImage;
  return ContentType.GeneralVideo;
}

// Create Anchor program instance (read-only, no wallet)
export function createProgram(connection: Connection): Program {
  const provider = {
    connection,
    publicKey: null,
  } as unknown as AnchorProvider;

  return new Program(idlJson as Idl, provider);
}

// Register content instruction
export async function registerContentInstruction(
  program: Program,
  authority: PublicKey,
  contentCid: string,
  metadataCid: string,
  contentType: ContentType,
  isEncrypted: boolean = false,
  previewCid: string = "",
  encryptionMetaCid: string = ""
): Promise<TransactionInstruction> {
  const cidHash = hashCid(contentCid);
  const [contentPda] = getContentPda(contentCid);
  const [cidRegistryPda] = getCidRegistryPda(contentCid);

  return await program.methods
    .registerContent(
      Array.from(cidHash),
      contentCid,
      metadataCid,
      contentTypeToAnchor(contentType),
      isEncrypted,
      previewCid,
      encryptionMetaCid
    )
    .accounts({
      content: contentPda,
      cidRegistry: cidRegistryPda,
      authority: authority,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

// Register content with mint config (SOL only)
export async function registerContentWithMintInstruction(
  program: Program,
  authority: PublicKey,
  contentCid: string,
  metadataCid: string,
  contentType: ContentType,
  price: bigint,
  maxSupply: bigint | null,
  creatorRoyaltyBps: number,
  isEncrypted: boolean = false,
  previewCid: string = "",
  encryptionMetaCid: string = ""
): Promise<TransactionInstruction> {
  const cidHash = hashCid(contentCid);
  const [contentPda] = getContentPda(contentCid);
  const [cidRegistryPda] = getCidRegistryPda(contentCid);
  const [mintConfigPda] = getMintConfigPda(contentPda);

  return await program.methods
    .registerContentWithMint(
      Array.from(cidHash),
      contentCid,
      metadataCid,
      contentTypeToAnchor(contentType),
      new BN(price.toString()),
      maxSupply !== null ? new BN(maxSupply.toString()) : null,
      creatorRoyaltyBps,
      isEncrypted,
      previewCid,
      encryptionMetaCid
    )
    .accounts({
      content: contentPda,
      cidRegistry: cidRegistryPda,
      mintConfig: mintConfigPda,
      authority: authority,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

// Tip content instruction
export async function tipContentInstruction(
  program: Program,
  tipper: PublicKey,
  contentCid: string,
  creator: PublicKey,
  amount: bigint | number
): Promise<TransactionInstruction> {
  const [contentPda] = getContentPda(contentCid);

  return await program.methods
    .tipContent(new BN(amount.toString()))
    .accounts({
      content: contentPda,
      creator: creator,
      tipper: tipper,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

// Update content instruction
export async function updateContentInstruction(
  program: Program,
  creator: PublicKey,
  contentCid: string,
  metadataCid: string
): Promise<TransactionInstruction> {
  const [contentPda] = getContentPda(contentCid);

  return await program.methods
    .updateContent(metadataCid)
    .accounts({
      content: contentPda,
      creator: creator,
    })
    .instruction();
}

// Delete content instruction
export async function deleteContentInstruction(
  program: Program,
  creator: PublicKey,
  contentCid: string
): Promise<TransactionInstruction> {
  const [contentPda] = getContentPda(contentCid);
  const [cidRegistryPda] = getCidRegistryPda(contentCid);

  return await program.methods
    .deleteContent()
    .accounts({
      content: contentPda,
      cidRegistry: cidRegistryPda,
      creator: creator,
    })
    .instruction();
}

// Delete content with mint config instruction
export async function deleteContentWithMintInstruction(
  program: Program,
  creator: PublicKey,
  contentCid: string
): Promise<TransactionInstruction> {
  const [contentPda] = getContentPda(contentCid);
  const [cidRegistryPda] = getCidRegistryPda(contentCid);
  const [mintConfigPda] = getMintConfigPda(contentPda);

  return await program.methods
    .deleteContentWithMint()
    .accounts({
      content: contentPda,
      cidRegistry: cidRegistryPda,
      mintConfig: mintConfigPda,
      creator: creator,
    })
    .instruction();
}

// Initialize ecosystem config and global reward pool
export async function initializeEcosystemInstruction(
  program: Program,
  admin: PublicKey,
  treasury: PublicKey,
  usdcMint: PublicKey
): Promise<TransactionInstruction> {
  const [ecosystemConfigPda] = getEcosystemConfigPda();
  const [globalRewardPoolPda] = getGlobalRewardPoolPda();

  return await program.methods
    .initializeEcosystem(usdcMint)
    .accounts({
      ecosystemConfig: ecosystemConfigPda,
      globalRewardPool: globalRewardPoolPda,
      treasury: treasury,
      admin: admin,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

// Update ecosystem config
export async function updateEcosystemInstruction(
  program: Program,
  admin: PublicKey,
  newTreasury: PublicKey | null,
  newUsdcMint: PublicKey | null,
  isPaused: boolean | null
): Promise<TransactionInstruction> {
  const [ecosystemConfigPda] = getEcosystemConfigPda();

  return await program.methods
    .updateEcosystem(newTreasury, newUsdcMint, isPaused)
    .accounts({
      ecosystemConfig: ecosystemConfigPda,
      admin: admin,
    })
    .instruction();
}

// Configure mint settings (SOL only)
export async function configureMintInstruction(
  program: Program,
  creator: PublicKey,
  contentCid: string,
  price: bigint,
  maxSupply: bigint | null,
  creatorRoyaltyBps: number
): Promise<TransactionInstruction> {
  const [contentPda] = getContentPda(contentCid);
  const [mintConfigPda] = getMintConfigPda(contentPda);

  return await program.methods
    .configureMint(
      new BN(price.toString()),
      maxSupply !== null ? new BN(maxSupply.toString()) : null,
      creatorRoyaltyBps
    )
    .accounts({
      content: contentPda,
      mintConfig: mintConfigPda,
      creator: creator,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

// Update mint settings
export async function updateMintSettingsInstruction(
  program: Program,
  creator: PublicKey,
  contentCid: string,
  price: bigint | null,
  maxSupply: bigint | null | undefined,
  creatorRoyaltyBps: number | null,
  isActive: boolean | null
): Promise<TransactionInstruction> {
  const [contentPda] = getContentPda(contentCid);
  const [mintConfigPda] = getMintConfigPda(contentPda);

  let maxSupplyArg: BN | null;
  if (maxSupply === undefined || maxSupply === null) {
    maxSupplyArg = null;
  } else {
    maxSupplyArg = new BN(maxSupply.toString());
  }

  return await program.methods
    .updateMintSettings(
      price !== null ? new BN(price.toString()) : null,
      maxSupplyArg,
      creatorRoyaltyBps,
      isActive
    )
    .accounts({
      content: contentPda,
      mintConfig: mintConfigPda,
      creator: creator,
    })
    .instruction();
}

// Result type for mint NFT instruction
export interface MintNftResult {
  instruction: TransactionInstruction;
  nftAssetKeypair: Keypair;
}

// Mint NFT with SOL payment (global reward pool model)
export async function mintNftSolInstruction(
  program: Program,
  buyer: PublicKey,
  contentCid: string,
  creator: PublicKey,
  treasury: PublicKey,
  platform: PublicKey
): Promise<MintNftResult> {
  const [contentPda] = getContentPda(contentCid);
  const [mintConfigPda] = getMintConfigPda(contentPda);
  const [ecosystemConfigPda] = getEcosystemConfigPda();
  const [globalRewardPoolPda] = getGlobalRewardPoolPda();

  // Generate a new keypair for the NFT asset
  const nftAssetKeypair = Keypair.generate();

  // Get NFT reward state PDA for the new NFT
  const [nftRewardStatePda] = getNftRewardStatePda(nftAssetKeypair.publicKey);

  const instruction = await program.methods
    .mintNftSol()
    .accounts({
      ecosystemConfig: ecosystemConfigPda,
      content: contentPda,
      mintConfig: mintConfigPda,
      globalRewardPool: globalRewardPoolPda,
      nftRewardState: nftRewardStatePda,
      creator: creator,
      platform: platform,
      treasury: treasury,
      buyer: buyer,
      nftAsset: nftAssetKeypair.publicKey,
      mplCoreProgram: MPL_CORE_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  return { instruction, nftAssetKeypair };
}

// Claim rewards instruction (global pool model)
export async function claimRewardsInstruction(
  program: Program,
  holder: PublicKey,
  nftAsset: PublicKey
): Promise<TransactionInstruction> {
  const [globalRewardPoolPda] = getGlobalRewardPoolPda();
  const [nftRewardStatePda] = getNftRewardStatePda(nftAsset);

  return await program.methods
    .claimRewards()
    .accounts({
      globalRewardPool: globalRewardPoolPda,
      nftRewardState: nftRewardStatePda,
      nftAsset: nftAsset,
      holder: holder,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

// Fetch content
export async function fetchContent(
  connection: Connection,
  contentCid: string
): Promise<ContentEntry | null> {
  const program = createProgram(connection);
  const [pda] = getContentPda(contentCid);

  try {
    const account = await (program.account as any).contentEntry.fetch(pda);

    return {
      creator: account.creator,
      contentCid: account.contentCid,
      metadataCid: account.metadataCid,
      contentType: anchorToContentType(account.contentType),
      tipsReceived: BigInt(account.tipsReceived.toString()),
      createdAt: BigInt(account.createdAt.toString()),
      isLocked: account.isLocked,
      mintedCount: BigInt(account.mintedCount?.toString() || "0"),
      isEncrypted: account.isEncrypted ?? false,
      previewCid: account.previewCid ?? "",
      encryptionMetaCid: account.encryptionMetaCid ?? "",
    };
  } catch {
    return null;
  }
}

export async function fetchContentByPda(
  connection: Connection,
  pda: PublicKey
): Promise<ContentEntry | null> {
  const program = createProgram(connection);

  try {
    const account = await (program.account as any).contentEntry.fetch(pda);

    return {
      creator: account.creator,
      contentCid: account.contentCid,
      metadataCid: account.metadataCid,
      contentType: anchorToContentType(account.contentType),
      tipsReceived: BigInt(account.tipsReceived.toString()),
      createdAt: BigInt(account.createdAt.toString()),
      isLocked: account.isLocked,
      mintedCount: BigInt(account.mintedCount?.toString() || "0"),
      isEncrypted: account.isEncrypted ?? false,
      previewCid: account.previewCid ?? "",
      encryptionMetaCid: account.encryptionMetaCid ?? "",
    };
  } catch {
    return null;
  }
}

// Fetch mint config
export async function fetchMintConfig(
  connection: Connection,
  contentCid: string
): Promise<MintConfig | null> {
  const program = createProgram(connection);
  const [contentPda] = getContentPda(contentCid);
  const [mintConfigPda] = getMintConfigPda(contentPda);

  try {
    const account = await (program.account as any).mintConfig.fetch(mintConfigPda);

    return {
      content: account.content,
      creator: account.creator,
      price: BigInt(account.price.toString()),
      currency: PaymentCurrency.Sol,
      maxSupply: account.maxSupply ? BigInt(account.maxSupply.toString()) : null,
      creatorRoyaltyBps: account.creatorRoyaltyBps,
      isActive: account.isActive,
      createdAt: BigInt(account.createdAt.toString()),
      updatedAt: BigInt(account.updatedAt.toString()),
    };
  } catch {
    return null;
  }
}

// Fetch ecosystem config
export async function fetchEcosystemConfig(
  connection: Connection
): Promise<EcosystemConfig | null> {
  const program = createProgram(connection);
  const [ecosystemConfigPda] = getEcosystemConfigPda();

  try {
    const account = await (program.account as any).ecosystemConfig.fetch(ecosystemConfigPda);

    return {
      admin: account.admin,
      treasury: account.treasury,
      usdcMint: account.usdcMint,
      totalFeesSol: BigInt(account.totalFeesSol.toString()),
      totalFeesUsdc: BigInt(account.totalFeesUsdc.toString()),
      totalNftsMinted: BigInt(account.totalNftsMinted.toString()),
      isPaused: account.isPaused,
      createdAt: BigInt(account.createdAt.toString()),
    };
  } catch {
    return null;
  }
}

// Fetch global reward pool
export async function fetchGlobalRewardPool(
  connection: Connection
): Promise<GlobalRewardPool | null> {
  const program = createProgram(connection);
  const [globalRewardPoolPda] = getGlobalRewardPoolPda();

  try {
    const account = await (program.account as any).globalRewardPool.fetch(globalRewardPoolPda);
    return {
      rewardPerShare: BigInt(account.rewardPerShare.toString()),
      totalNfts: BigInt(account.totalNfts.toString()),
      totalDeposited: BigInt(account.totalDeposited.toString()),
      totalClaimed: BigInt(account.totalClaimed.toString()),
      createdAt: BigInt(account.createdAt.toString()),
    };
  } catch {
    return null;
  }
}

// Fetch NFT reward state
export async function fetchNftRewardState(
  connection: Connection,
  nftAsset: PublicKey
): Promise<NftRewardState | null> {
  const program = createProgram(connection);
  const [nftRewardStatePda] = getNftRewardStatePda(nftAsset);

  try {
    const account = await (program.account as any).nftRewardState.fetch(nftRewardStatePda);
    return {
      nftAsset: account.nftAsset,
      rewardDebt: BigInt(account.rewardDebt.toString()),
      createdAt: BigInt(account.createdAt.toString()),
    };
  } catch {
    return null;
  }
}

// Get pending rewards for a specific NFT (from global pool)
export async function getPendingReward(
  connection: Connection,
  nftAsset: PublicKey
): Promise<bigint> {
  const globalRewardPool = await fetchGlobalRewardPool(connection);
  if (!globalRewardPool) return BigInt(0);

  const nftRewardState = await fetchNftRewardState(connection, nftAsset);
  if (!nftRewardState) return BigInt(0);

  return calculatePendingReward(globalRewardPool.rewardPerShare, nftRewardState.rewardDebt);
}

// Get all pending rewards for a wallet's NFTs (from global pool)
export async function getPendingRewardsForWallet(
  connection: Connection,
  nftAssets: PublicKey[]
): Promise<Array<{ nftAsset: PublicKey; pending: bigint }>> {
  const globalRewardPool = await fetchGlobalRewardPool(connection);
  if (!globalRewardPool) return [];

  const results: Array<{ nftAsset: PublicKey; pending: bigint }> = [];

  for (const nftAsset of nftAssets) {
    const nftRewardState = await fetchNftRewardState(connection, nftAsset);
    if (!nftRewardState) continue;

    const pending = calculatePendingReward(globalRewardPool.rewardPerShare, nftRewardState.rewardDebt);
    if (pending > BigInt(0)) {
      results.push({ nftAsset, pending });
    }
  }

  return results;
}

// NFT metadata with content CID for ownership tracking
export interface WalletNftMetadata {
  assetPubkey: string;
  uri: string;
  contentCid: string | null;
}

// Fetch all NFT metadata for a wallet in one batch
export async function fetchWalletNftMetadata(
  connection: Connection,
  wallet: PublicKey
): Promise<WalletNftMetadata[]> {
  try {
    const accounts = await connection.getProgramAccounts(MPL_CORE_PROGRAM_ID, {
      filters: [
        { memcmp: { offset: 0, bytes: "2" } }, // AssetV1
        { memcmp: { offset: 1, bytes: wallet.toBase58() } }, // Owner
      ],
    });

    const assetsWithUris: { pubkey: string; uri: string }[] = [];
    for (const { pubkey, account } of accounts) {
      try {
        const data = account.data;
        const nameOffset = 1 + 32 + 33;
        const nameLen = data.readUInt32LE(nameOffset);
        const uriOffset = nameOffset + 4 + nameLen;
        const uriLen = data.readUInt32LE(uriOffset);
        const uri = data.slice(uriOffset + 4, uriOffset + 4 + uriLen).toString("utf8");
        assetsWithUris.push({ pubkey: pubkey.toBase58(), uri });
      } catch {
        // Skip malformed assets
      }
    }

    const results: WalletNftMetadata[] = [];
    const BATCH_SIZE = 5;

    for (let i = 0; i < assetsWithUris.length; i += BATCH_SIZE) {
      const batch = assetsWithUris.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async ({ pubkey, uri }) => {
          let contentCid: string | null = null;

          if (uri.startsWith("https://")) {
            try {
              const response = await fetch(uri, { signal: AbortSignal.timeout(5000) });
              if (response.ok) {
                const metadata = await response.json();
                contentCid = metadata.contentCid ||
                  metadata.properties?.content_cid ||
                  extractCidFromUrl(metadata.image) ||
                  extractCidFromUrl(metadata.animation_url) ||
                  extractCidFromUrl(metadata.contentUrl) ||
                  null;
              }
            } catch {
              // Ignore fetch errors
            }
          }

          return { assetPubkey: pubkey, uri, contentCid };
        })
      );
      results.push(...batchResults);
    }

    return results;
  } catch {
    return [];
  }
}

// Helper to extract CID from IPFS URL
function extractCidFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const match = url.match(/Qm[a-zA-Z0-9]{44,}/);
  return match ? match[0] : null;
}

// Count NFTs owned for a specific content
export async function countNftsOwned(
  connection: Connection,
  wallet: PublicKey,
  contentCid: string
): Promise<number> {
  const nftMetadata = await fetchWalletNftMetadata(connection, wallet);
  return nftMetadata.filter(nft => nft.contentCid === contentCid).length;
}

// Check if wallet owns at least one NFT for a content
export async function checkNftOwnership(
  connection: Connection,
  wallet: PublicKey,
  contentCid: string
): Promise<boolean> {
  const count = await countNftsOwned(connection, wallet, contentCid);
  return count > 0;
}

// Get content NFT holders
export async function getContentNftHolders(
  connection: Connection,
  contentCid: string
): Promise<PublicKey[]> {
  try {
    const accounts = await connection.getProgramAccounts(MPL_CORE_PROGRAM_ID, {
      filters: [
        { memcmp: { offset: 0, bytes: "2" } },
      ],
    });

    const holders = new Set<string>();

    for (const { account } of accounts) {
      try {
        const data = account.data;
        const ownerBytes = data.slice(1, 33);
        const owner = new PublicKey(ownerBytes);

        const nameOffset = 1 + 32 + 33;
        const nameLen = data.readUInt32LE(nameOffset);
        const uriOffset = nameOffset + 4 + nameLen;
        const uriLen = data.readUInt32LE(uriOffset);
        const uri = data.slice(uriOffset + 4, uriOffset + 4 + uriLen).toString("utf8");

        if (uri.includes(contentCid)) {
          holders.add(owner.toBase58());
          continue;
        }

        if (uri.startsWith("https://")) {
          try {
            const response = await fetch(uri, { signal: AbortSignal.timeout(3000) });
            if (response.ok) {
              const metadata = await response.json();
              if (
                metadata.contentCid === contentCid ||
                metadata.properties?.content_cid === contentCid ||
                metadata.image?.includes(contentCid) ||
                metadata.animation_url?.includes(contentCid) ||
                metadata.contentUrl?.includes(contentCid)
              ) {
                holders.add(owner.toBase58());
              }
            }
          } catch {
            // Ignore fetch errors
          }
        }
      } catch {
        // Skip malformed assets
      }
    }

    return Array.from(holders).map(addr => new PublicKey(addr));
  } catch {
    return [];
  }
}

// Count total NFTs minted for a content
export async function countTotalMintedNfts(
  connection: Connection,
  contentCid: string
): Promise<number> {
  // Just fetch from content entry - it tracks minted_count
  const content = await fetchContent(connection, contentCid);
  if (!content) return 0;
  return Number(content.mintedCount);
}

// High-level client
export function createContentRegistryClient(connection: Connection) {
  const program = createProgram(connection);

  return {
    program,
    getContentPda,
    getCidRegistryPda,
    getEcosystemConfigPda,
    getMintConfigPda,
    getGlobalRewardPoolPda,
    getNftRewardStatePda,
    hashCid,

    // Content management
    registerContentInstruction: (
      authority: PublicKey,
      contentCid: string,
      metadataCid: string,
      contentType: ContentType,
      isEncrypted: boolean = false,
      previewCid: string = "",
      encryptionMetaCid: string = ""
    ) => registerContentInstruction(program, authority, contentCid, metadataCid, contentType, isEncrypted, previewCid, encryptionMetaCid),

    registerContentWithMintInstruction: (
      authority: PublicKey,
      contentCid: string,
      metadataCid: string,
      contentType: ContentType,
      price: bigint,
      maxSupply: bigint | null,
      creatorRoyaltyBps: number,
      isEncrypted: boolean = false,
      previewCid: string = "",
      encryptionMetaCid: string = ""
    ) => registerContentWithMintInstruction(
      program,
      authority,
      contentCid,
      metadataCid,
      contentType,
      price,
      maxSupply,
      creatorRoyaltyBps,
      isEncrypted,
      previewCid,
      encryptionMetaCid
    ),

    updateContentInstruction: (
      creator: PublicKey,
      contentCid: string,
      metadataCid: string
    ) => updateContentInstruction(program, creator, contentCid, metadataCid),

    deleteContentInstruction: (
      creator: PublicKey,
      contentCid: string
    ) => deleteContentInstruction(program, creator, contentCid),

    deleteContentWithMintInstruction: (
      creator: PublicKey,
      contentCid: string
    ) => deleteContentWithMintInstruction(program, creator, contentCid),

    tipContentInstruction: (
      tipper: PublicKey,
      contentCid: string,
      creator: PublicKey,
      amount: bigint | number
    ) => tipContentInstruction(program, tipper, contentCid, creator, amount),

    // Mint configuration (SOL only)
    configureMintInstruction: (
      creator: PublicKey,
      contentCid: string,
      price: bigint,
      maxSupply: bigint | null,
      creatorRoyaltyBps: number
    ) => configureMintInstruction(program, creator, contentCid, price, maxSupply, creatorRoyaltyBps),

    updateMintSettingsInstruction: (
      creator: PublicKey,
      contentCid: string,
      price: bigint | null,
      maxSupply: bigint | null | undefined,
      creatorRoyaltyBps: number | null,
      isActive: boolean | null
    ) => updateMintSettingsInstruction(program, creator, contentCid, price, maxSupply, creatorRoyaltyBps, isActive),

    // NFT minting (SOL only, accumulated reward pool)
    mintNftSolInstruction: (
      buyer: PublicKey,
      contentCid: string,
      creator: PublicKey,
      treasury: PublicKey,
      platform: PublicKey
    ): Promise<MintNftResult> => mintNftSolInstruction(program, buyer, contentCid, creator, treasury, platform),

    // Claim rewards (global pool - single transaction per NFT)
    claimRewardsInstruction: (
      holder: PublicKey,
      nftAsset: PublicKey
    ) => claimRewardsInstruction(program, holder, nftAsset),

    // Ecosystem management
    initializeEcosystemInstruction: (
      admin: PublicKey,
      treasury: PublicKey,
      usdcMint: PublicKey
    ) => initializeEcosystemInstruction(program, admin, treasury, usdcMint),

    updateEcosystemInstruction: (
      admin: PublicKey,
      newTreasury: PublicKey | null,
      newUsdcMint: PublicKey | null,
      isPaused: boolean | null
    ) => updateEcosystemInstruction(program, admin, newTreasury, newUsdcMint, isPaused),

    // Fetching
    fetchContent: (contentCid: string) => fetchContent(connection, contentCid),
    fetchContentByPda: (pda: PublicKey) => fetchContentByPda(connection, pda),
    fetchMintConfig: (contentCid: string) => fetchMintConfig(connection, contentCid),
    fetchEcosystemConfig: () => fetchEcosystemConfig(connection),
    fetchGlobalRewardPool: () => fetchGlobalRewardPool(connection),
    fetchNftRewardState: (nftAsset: PublicKey) => fetchNftRewardState(connection, nftAsset),

    // Reward calculations (global pool)
    getPendingReward: (nftAsset: PublicKey) =>
      getPendingReward(connection, nftAsset),
    getPendingRewardsForWallet: (nftAssets: PublicKey[]) =>
      getPendingRewardsForWallet(connection, nftAssets),

    // NFT ownership
    checkNftOwnership: (wallet: PublicKey, contentCid: string) =>
      checkNftOwnership(connection, wallet, contentCid),
    countNftsOwned: (wallet: PublicKey, contentCid: string) =>
      countNftsOwned(connection, wallet, contentCid),
    countTotalMintedNfts: (contentCid: string) =>
      countTotalMintedNfts(connection, contentCid),
    fetchWalletNftMetadata: (wallet: PublicKey) =>
      fetchWalletNftMetadata(connection, wallet),
    getContentNftHolders: (contentCid: string) =>
      getContentNftHolders(connection, contentCid),

    // Fetch all content
    async fetchGlobalContent(): Promise<ContentEntry[]> {
      try {
        const accounts = await connection.getProgramAccounts(PROGRAM_ID);

        const entries: ContentEntry[] = [];
        for (const { account } of accounts) {
          try {
            const decoded = program.coder.accounts.decode("contentEntry", account.data);

            entries.push({
              creator: decoded.creator,
              contentCid: decoded.contentCid,
              metadataCid: decoded.metadataCid,
              contentType: anchorToContentType(decoded.contentType),
              tipsReceived: BigInt(decoded.tipsReceived.toString()),
              createdAt: BigInt(decoded.createdAt.toString()),
              isLocked: decoded.isLocked ?? false,
              mintedCount: BigInt(decoded.mintedCount?.toString() || "0"),
              isEncrypted: decoded.isEncrypted ?? false,
              previewCid: decoded.previewCid ?? "",
              encryptionMetaCid: decoded.encryptionMetaCid ?? "",
            });
          } catch {
            // Not a content entry
          }
        }

        entries.sort((a, b) => Number(b.createdAt - a.createdAt));
        return entries;
      } catch {
        return [];
      }
    },

    async fetchContentByCreator(creator: PublicKey): Promise<ContentEntry[]> {
      try {
        const accounts = await connection.getProgramAccounts(PROGRAM_ID);
        const entries: ContentEntry[] = [];

        for (const { account } of accounts) {
          try {
            const decoded = program.coder.accounts.decode("contentEntry", account.data);

            if (!decoded.creator.equals(creator)) continue;

            entries.push({
              creator: decoded.creator,
              contentCid: decoded.contentCid,
              metadataCid: decoded.metadataCid,
              contentType: anchorToContentType(decoded.contentType),
              tipsReceived: BigInt(decoded.tipsReceived.toString()),
              createdAt: BigInt(decoded.createdAt.toString()),
              isLocked: decoded.isLocked ?? false,
              mintedCount: BigInt(decoded.mintedCount?.toString() || "0"),
              isEncrypted: decoded.isEncrypted ?? false,
              previewCid: decoded.previewCid ?? "",
              encryptionMetaCid: decoded.encryptionMetaCid ?? "",
            });
          } catch {
            // Not a content entry
          }
        }

        entries.sort((a, b) => Number(b.createdAt - a.createdAt));
        return entries;
      } catch {
        return [];
      }
    },

    async fetchMintableContent(): Promise<Array<{ content: ContentEntry; mintConfig: MintConfig }>> {
      try {
        const accounts = await connection.getProgramAccounts(PROGRAM_ID);
        const results: Array<{ content: ContentEntry; mintConfig: MintConfig }> = [];

        const contentEntries: Map<string, ContentEntry> = new Map();
        for (const { account } of accounts) {
          try {
            const decoded = program.coder.accounts.decode("contentEntry", account.data);
            contentEntries.set(decoded.contentCid, {
              creator: decoded.creator,
              contentCid: decoded.contentCid,
              metadataCid: decoded.metadataCid,
              contentType: anchorToContentType(decoded.contentType),
              tipsReceived: BigInt(decoded.tipsReceived.toString()),
              createdAt: BigInt(decoded.createdAt.toString()),
              isLocked: decoded.isLocked ?? false,
              mintedCount: BigInt(decoded.mintedCount?.toString() || "0"),
              isEncrypted: decoded.isEncrypted ?? false,
              previewCid: decoded.previewCid ?? "",
              encryptionMetaCid: decoded.encryptionMetaCid ?? "",
            });
          } catch {
            // Not a content entry
          }
        }

        for (const { account } of accounts) {
          try {
            const decoded = program.coder.accounts.decode("mintConfig", account.data);

            for (const [cid, content] of contentEntries) {
              const [contentPda] = getContentPda(cid);
              if (contentPda.equals(decoded.content)) {
                results.push({
                  content,
                  mintConfig: {
                    content: decoded.content,
                    creator: decoded.creator,
                    price: BigInt(decoded.price.toString()),
                    currency: PaymentCurrency.Sol,
                    maxSupply: decoded.maxSupply ? BigInt(decoded.maxSupply.toString()) : null,
                    creatorRoyaltyBps: decoded.creatorRoyaltyBps,
                    isActive: decoded.isActive,
                    createdAt: BigInt(decoded.createdAt.toString()),
                    updatedAt: BigInt(decoded.updatedAt.toString()),
                  },
                });
                break;
              }
            }
          } catch {
            // Not a mint config
          }
        }

        results.sort((a, b) => Number(b.content.createdAt - a.content.createdAt));
        return results;
      } catch {
        return [];
      }
    },
  };
}

export const idl = idlJson;
