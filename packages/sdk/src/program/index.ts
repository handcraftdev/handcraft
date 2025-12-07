// Re-export from modules
export * from "./constants";
export * from "./types";
export * from "./pda";

// Main program code
import { Program, Idl, BN } from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram, TransactionInstruction, Keypair } from "@solana/web3.js";
import idlJson from "./content_registry.json";

import {
  PROGRAM_ID,
  PROGRAM_ID_STRING,
  MPL_CORE_PROGRAM_ID,
  ContentType,
  PaymentCurrency,
  RentTier,
  getContentCategory,
} from "./constants";

import {
  ContentEntry,
  MintConfig,
  EcosystemConfig,
  ContentRewardPool,
  WalletContentState,
  ContentCollection,
  NftRewardState,
  WalletNftMetadata,
  RentConfig,
  RentEntry,
  PendingMint,
  NftRarity,
  Rarity,
  parseAnchorRarity,
} from "./types";

import {
  hashCid,
  getContentPda,
  getCidRegistryPda,
  getEcosystemConfigPda,
  getMintConfigPda,
  getContentRewardPoolPda,
  getWalletContentStatePda,
  getContentCollectionPda,
  getNftRewardStatePda,
  getRentConfigPda,
  getRentEntryPda,
  getPendingMintPda,
  getNftRarityPda,
  calculatePendingRewardForNft,
  calculateWeightedPendingReward,
} from "./pda";

// Convert ContentType enum to Anchor format
function contentTypeToAnchor(type: ContentType): object {
  switch (type) {
    // Video domain
    case ContentType.Video: return { video: {} };
    case ContentType.Movie: return { movie: {} };
    case ContentType.Television: return { television: {} };
    case ContentType.MusicVideo: return { musicVideo: {} };
    case ContentType.Short: return { short: {} };
    // Audio domain
    case ContentType.Music: return { music: {} };
    case ContentType.Podcast: return { podcast: {} };
    case ContentType.Audiobook: return { audiobook: {} };
    // Image domain
    case ContentType.Photo: return { photo: {} };
    case ContentType.Artwork: return { artwork: {} };
    // Document domain
    case ContentType.Book: return { book: {} };
    case ContentType.Comic: return { comic: {} };
    // File domain
    case ContentType.Asset: return { asset: {} };
    case ContentType.Game: return { game: {} };
    case ContentType.Software: return { software: {} };
    case ContentType.Dataset: return { dataset: {} };
    // Text domain
    case ContentType.Post: return { post: {} };
    default: return { video: {} };
  }
}

// Convert Anchor format to ContentType enum
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function anchorToContentType(anchorType: any): ContentType {
  // Video domain
  if (anchorType.video) return ContentType.Video;
  if (anchorType.movie) return ContentType.Movie;
  if (anchorType.television) return ContentType.Television;
  if (anchorType.musicVideo) return ContentType.MusicVideo;
  if (anchorType.short) return ContentType.Short;
  // Audio domain
  if (anchorType.music) return ContentType.Music;
  if (anchorType.podcast) return ContentType.Podcast;
  if (anchorType.audiobook) return ContentType.Audiobook;
  // Image domain
  if (anchorType.photo) return ContentType.Photo;
  if (anchorType.artwork) return ContentType.Artwork;
  // Document domain
  if (anchorType.book) return ContentType.Book;
  if (anchorType.comic) return ContentType.Comic;
  // File domain
  if (anchorType.asset) return ContentType.Asset;
  if (anchorType.game) return ContentType.Game;
  if (anchorType.software) return ContentType.Software;
  if (anchorType.dataset) return ContentType.Dataset;
  // Text domain
  if (anchorType.post) return ContentType.Post;
  return ContentType.Video;
}

// Create Anchor program instance (read-only, no wallet)
// In Anchor 0.30+, use { connection } instead of a full AnchorProvider for read-only access
export function createProgram(connection: Connection): Program {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Program(idlJson as any, { connection });
}

// ============================================
// INSTRUCTION BUILDERS
// ============================================

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

export interface RegisterContentWithMintResult {
  instruction: TransactionInstruction;
  collectionAssetKeypair: Keypair;
}

export async function registerContentWithMintInstruction(
  program: Program,
  authority: PublicKey,
  contentCid: string,
  metadataCid: string,
  contentType: ContentType,
  price: bigint,
  maxSupply: bigint | null,
  creatorRoyaltyBps: number,
  platform: PublicKey,
  isEncrypted: boolean = false,
  previewCid: string = "",
  encryptionMetaCid: string = ""
): Promise<RegisterContentWithMintResult> {
  const cidHash = hashCid(contentCid);
  const [contentPda] = getContentPda(contentCid);
  const [cidRegistryPda] = getCidRegistryPda(contentCid);
  const [mintConfigPda] = getMintConfigPda(contentPda);
  const [contentCollectionPda] = getContentCollectionPda(contentPda);
  const [ecosystemConfigPda] = getEcosystemConfigPda();

  const collectionAssetKeypair = Keypair.generate();

  const instruction = await program.methods
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
      contentCollection: contentCollectionPda,
      collectionAsset: collectionAssetKeypair.publicKey,
      mplCoreProgram: MPL_CORE_PROGRAM_ID,
      ecosystemConfig: ecosystemConfigPda,
      platform: platform,
      authority: authority,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  return { instruction, collectionAssetKeypair };
}

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

export async function initializeEcosystemInstruction(
  program: Program,
  admin: PublicKey,
  treasury: PublicKey,
  usdcMint: PublicKey
): Promise<TransactionInstruction> {
  const [ecosystemConfigPda] = getEcosystemConfigPda();

  return await program.methods
    .initializeEcosystem(usdcMint)
    .accounts({
      ecosystemConfig: ecosystemConfigPda,
      treasury: treasury,
      admin: admin,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

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

export interface MintNftResult {
  instruction: TransactionInstruction;
  nftAssetKeypair: Keypair;
}

export async function mintNftSolInstruction(
  program: Program,
  buyer: PublicKey,
  contentCid: string,
  creator: PublicKey,
  treasury: PublicKey,
  platform: PublicKey,
  collectionAsset: PublicKey
): Promise<MintNftResult> {
  const [contentPda] = getContentPda(contentCid);
  const [mintConfigPda] = getMintConfigPda(contentPda);
  const [ecosystemConfigPda] = getEcosystemConfigPda();
  const [contentRewardPoolPda] = getContentRewardPoolPda(contentPda);
  const [buyerWalletStatePda] = getWalletContentStatePda(buyer, contentPda);
  const [contentCollectionPda] = getContentCollectionPda(contentPda);

  const nftAssetKeypair = Keypair.generate();
  const [nftRewardStatePda] = getNftRewardStatePda(nftAssetKeypair.publicKey);

  const instruction = await program.methods
    .mintNftSol()
    .accounts({
      ecosystemConfig: ecosystemConfigPda,
      content: contentPda,
      mintConfig: mintConfigPda,
      contentCollection: contentCollectionPda,
      collectionAsset: collectionAsset,
      contentRewardPool: contentRewardPoolPda,
      buyerWalletState: buyerWalletStatePda,
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

// ============================================
// VRF-BASED MINT WITH RARITY (Two-step flow)
// ============================================

/**
 * Step 1: Commit to mint with VRF randomness
 * Takes payment and commits to a future slot for randomness determination
 * User must call revealMintInstruction after randomness is available (~1-2 slots / 0.4-0.8 seconds)
 */
export async function commitMintInstruction(
  program: Program,
  buyer: PublicKey,
  contentCid: string,
  creator: PublicKey,
  treasury: PublicKey,
  randomnessAccount: PublicKey,
  platform: PublicKey
): Promise<TransactionInstruction> {
  const [contentPda] = getContentPda(contentCid);
  const [mintConfigPda] = getMintConfigPda(contentPda);
  const [ecosystemConfigPda] = getEcosystemConfigPda();
  const [contentRewardPoolPda] = getContentRewardPoolPda(contentPda);
  const [pendingMintPda] = getPendingMintPda(buyer, contentPda);

  return await program.methods
    .commitMint()
    .accounts({
      ecosystemConfig: ecosystemConfigPda,
      content: contentPda,
      mintConfig: mintConfigPda,
      pendingMint: pendingMintPda,
      contentRewardPool: contentRewardPoolPda,
      randomnessAccount: randomnessAccount,
      creator: creator,
      platform: platform,
      treasury: treasury,
      buyer: buyer,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

/**
 * Step 2: Reveal randomness and complete mint with rarity
 * Called after the committed slot has passed and VRF randomness is available
 * Returns { instruction, nftAssetKeypair } - the keypair MUST be added as signer
 */
export async function revealMintInstruction(
  program: Program,
  buyer: PublicKey,
  contentCid: string,
  creator: PublicKey,
  collectionAsset: PublicKey,
  randomnessAccount: PublicKey,
  treasury: PublicKey,
  platform: PublicKey
): Promise<MintNftResult> {
  const [contentPda] = getContentPda(contentCid);
  const [mintConfigPda] = getMintConfigPda(contentPda);
  const [ecosystemConfigPda] = getEcosystemConfigPda();
  const [contentRewardPoolPda] = getContentRewardPoolPda(contentPda);
  const [buyerWalletStatePda] = getWalletContentStatePda(buyer, contentPda);
  const [contentCollectionPda] = getContentCollectionPda(contentPda);
  const [pendingMintPda] = getPendingMintPda(buyer, contentPda);

  const nftAssetKeypair = Keypair.generate();
  const [nftRewardStatePda] = getNftRewardStatePda(nftAssetKeypair.publicKey);
  const [nftRarityPda] = getNftRarityPda(nftAssetKeypair.publicKey);

  const instruction = await program.methods
    .revealMint()
    .accounts({
      ecosystemConfig: ecosystemConfigPda,
      content: contentPda,
      mintConfig: mintConfigPda,
      pendingMint: pendingMintPda,
      contentCollection: contentCollectionPda,
      collectionAsset: collectionAsset,
      contentRewardPool: contentRewardPoolPda,
      buyerWalletState: buyerWalletStatePda,
      nftRewardState: nftRewardStatePda,
      nftRarity: nftRarityPda,
      randomnessAccount: randomnessAccount,
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

/**
 * Cancel an expired pending mint and get refund
 * Can only be called after 10 minutes if the oracle failed to provide randomness
 * Refunds the escrowed payment and frees the reserved mint slot
 */
export async function cancelExpiredMintInstruction(
  program: Program,
  buyer: PublicKey,
  contentCid: string
): Promise<TransactionInstruction> {
  const [contentPda] = getContentPda(contentCid);
  const [pendingMintPda] = getPendingMintPda(buyer, contentPda);

  return await program.methods
    .cancelExpiredMint()
    .accounts({
      content: contentPda,
      pendingMint: pendingMintPda,
      buyer: buyer,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function claimContentRewardsInstruction(
  program: Program,
  holder: PublicKey,
  contentCid: string
): Promise<TransactionInstruction> {
  const [contentPda] = getContentPda(contentCid);
  const [contentRewardPoolPda] = getContentRewardPoolPda(contentPda);
  const [walletContentStatePda] = getWalletContentStatePda(holder, contentPda);

  return await program.methods
    .claimContentRewards()
    .accounts({
      contentRewardPool: contentRewardPoolPda,
      walletContentState: walletContentStatePda,
      holder: holder,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function claimAllRewardsInstruction(
  program: Program,
  holder: PublicKey,
  contentCids: string[]
): Promise<TransactionInstruction> {
  const remainingAccounts = contentCids.flatMap(cid => {
    const [contentPda] = getContentPda(cid);
    const [rewardPoolPda] = getContentRewardPoolPda(contentPda);
    const [walletStatePda] = getWalletContentStatePda(holder, contentPda);
    return [
      { pubkey: rewardPoolPda, isSigner: false, isWritable: true },
      { pubkey: walletStatePda, isSigner: false, isWritable: true },
    ];
  });

  return await program.methods
    .claimAllRewards()
    .accounts({
      holder: holder,
      systemProgram: SystemProgram.programId,
    })
    .remainingAccounts(remainingAccounts)
    .instruction();
}

export async function claimRewardsVerifiedInstruction(
  program: Program,
  holder: PublicKey,
  contentCid: string,
  nftAssets: PublicKey[]
): Promise<TransactionInstruction> {
  const [contentPda] = getContentPda(contentCid);
  const [contentRewardPoolPda] = getContentRewardPoolPda(contentPda);
  const [walletContentStatePda] = getWalletContentStatePda(holder, contentPda);
  const [contentCollectionPda] = getContentCollectionPda(contentPda);

  const remainingAccounts = nftAssets.flatMap(nftAsset => {
    const [nftRewardStatePda] = getNftRewardStatePda(nftAsset);
    return [
      { pubkey: nftAsset, isSigner: false, isWritable: false },
      { pubkey: nftRewardStatePda, isSigner: false, isWritable: true },
    ];
  });

  return await program.methods
    .claimRewardsVerified()
    .accounts({
      contentRewardPool: contentRewardPoolPda,
      walletContentState: walletContentStatePda,
      contentCollection: contentCollectionPda,
      holder: holder,
      systemProgram: SystemProgram.programId,
    })
    .remainingAccounts(remainingAccounts)
    .instruction();
}

export async function syncNftTransferInstruction(
  program: Program,
  sender: PublicKey,
  receiver: PublicKey,
  contentCid: string
): Promise<TransactionInstruction> {
  const [contentPda] = getContentPda(contentCid);
  const [contentRewardPoolPda] = getContentRewardPoolPda(contentPda);
  const [senderWalletStatePda] = getWalletContentStatePda(sender, contentPda);
  const [receiverWalletStatePda] = getWalletContentStatePda(receiver, contentPda);

  return await program.methods
    .syncNftTransfer()
    .accounts({
      contentRewardPool: contentRewardPoolPda,
      senderWalletState: senderWalletStatePda,
      receiverWalletState: receiverWalletStatePda,
      sender: sender,
      receiver: receiver,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function syncNftTransfersBatchInstruction(
  program: Program,
  sender: PublicKey,
  receiver: PublicKey,
  contentCid: string,
  count: number
): Promise<TransactionInstruction> {
  const [contentPda] = getContentPda(contentCid);
  const [contentRewardPoolPda] = getContentRewardPoolPda(contentPda);
  const [senderWalletStatePda] = getWalletContentStatePda(sender, contentPda);
  const [receiverWalletStatePda] = getWalletContentStatePda(receiver, contentPda);

  return await program.methods
    .syncNftTransfersBatch(count)
    .accounts({
      contentRewardPool: contentRewardPoolPda,
      senderWalletState: senderWalletStatePda,
      receiverWalletState: receiverWalletStatePda,
      sender: sender,
      receiver: receiver,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

// ============================================
// RENT INSTRUCTION BUILDERS
// ============================================

// Convert RentTier enum to Anchor format
function rentTierToAnchor(tier: RentTier): object {
  switch (tier) {
    case RentTier.SixHours: return { sixHours: {} };
    case RentTier.OneDay: return { oneDay: {} };
    case RentTier.SevenDays: return { sevenDays: {} };
  }
}

export async function configureRentInstruction(
  program: Program,
  creator: PublicKey,
  contentCid: string,
  rentFee6h: bigint,
  rentFee1d: bigint,
  rentFee7d: bigint
): Promise<TransactionInstruction> {
  const [contentPda] = getContentPda(contentCid);
  const [rentConfigPda] = getRentConfigPda(contentPda);

  console.log("[configureRentInstruction] Building instruction:");
  console.log("  contentCid:", contentCid);
  console.log("  contentPda:", contentPda.toBase58());
  console.log("  rentConfigPda:", rentConfigPda.toBase58());
  console.log("  creator:", creator.toBase58());
  console.log("  rentFee6h:", rentFee6h.toString());
  console.log("  rentFee1d:", rentFee1d.toString());
  console.log("  rentFee7d:", rentFee7d.toString());

  const ix = await program.methods
    .configureRent(
      new BN(rentFee6h.toString()),
      new BN(rentFee1d.toString()),
      new BN(rentFee7d.toString())
    )
    .accounts({
      content: contentPda,
      rentConfig: rentConfigPda,
      creator: creator,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  console.log("[configureRentInstruction] Instruction built:");
  console.log("  programId:", ix.programId.toBase58());
  console.log("  keys:", ix.keys.map(k => ({
    pubkey: k.pubkey.toBase58(),
    isSigner: k.isSigner,
    isWritable: k.isWritable
  })));
  console.log("  data:", Array.from(ix.data));

  return ix;
}

export async function updateRentConfigInstruction(
  program: Program,
  creator: PublicKey,
  contentCid: string,
  rentFee6h: bigint | null,
  rentFee1d: bigint | null,
  rentFee7d: bigint | null,
  isActive: boolean | null
): Promise<TransactionInstruction> {
  const [contentPda] = getContentPda(contentCid);
  const [rentConfigPda] = getRentConfigPda(contentPda);

  return await program.methods
    .updateRentConfig(
      rentFee6h !== null ? new BN(rentFee6h.toString()) : null,
      rentFee1d !== null ? new BN(rentFee1d.toString()) : null,
      rentFee7d !== null ? new BN(rentFee7d.toString()) : null,
      isActive
    )
    .accounts({
      content: contentPda,
      rentConfig: rentConfigPda,
      creator: creator,
    })
    .instruction();
}

export interface RentContentResult {
  instruction: TransactionInstruction;
  nftAssetKeypair: Keypair;
}

export async function rentContentSolInstruction(
  program: Program,
  renter: PublicKey,
  contentCid: string,
  creator: PublicKey,
  treasury: PublicKey,
  platform: PublicKey,
  collectionAsset: PublicKey,
  tier: RentTier
): Promise<RentContentResult> {
  const [contentPda] = getContentPda(contentCid);
  const [ecosystemConfigPda] = getEcosystemConfigPda();
  const [rentConfigPda] = getRentConfigPda(contentPda);
  const [contentCollectionPda] = getContentCollectionPda(contentPda);
  const [contentRewardPoolPda] = getContentRewardPoolPda(contentPda);

  const nftAssetKeypair = Keypair.generate();
  const [rentEntryPda] = getRentEntryPda(nftAssetKeypair.publicKey);

  const instruction = await program.methods
    .rentContentSol(rentTierToAnchor(tier))
    .accounts({
      ecosystemConfig: ecosystemConfigPda,
      content: contentPda,
      rentConfig: rentConfigPda,
      contentCollection: contentCollectionPda,
      collectionAsset: collectionAsset,
      contentRewardPool: contentRewardPoolPda,
      rentEntry: rentEntryPda,
      nftAsset: nftAssetKeypair.publicKey,
      creator: creator,
      platform: platform,
      treasury: treasury,
      renter: renter,
      mplCoreProgram: MPL_CORE_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  return { instruction, nftAssetKeypair };
}

export async function checkRentExpiryInstruction(
  program: Program,
  nftAsset: PublicKey
): Promise<TransactionInstruction> {
  const [rentEntryPda] = getRentEntryPda(nftAsset);

  return await program.methods
    .checkRentExpiry()
    .accounts({
      rentEntry: rentEntryPda,
      nftAsset: nftAsset,
    })
    .instruction();
}

// ============================================
// BURN NFT
// ============================================

/**
 * Burn an NFT with proper reward state cleanup
 * - Decrements totalWeight and totalNfts in ContentRewardPool
 * - Closes NftRewardState account (refunds rent to owner)
 * - Burns the NFT via Metaplex Core CPI
 */
export async function burnNftInstruction(
  program: Program,
  owner: PublicKey,
  nftAsset: PublicKey,
  collectionAsset: PublicKey,
  contentCid: string
): Promise<TransactionInstruction> {
  // Derive all required PDAs
  const [contentPda] = getContentPda(contentCid);
  const [contentCollectionPda] = getContentCollectionPda(contentPda);
  const [contentRewardPoolPda] = getContentRewardPoolPda(contentPda);
  const [nftRewardStatePda] = getNftRewardStatePda(nftAsset);

  return await program.methods
    .burnNft()
    .accounts({
      content: contentPda,
      contentCollection: contentCollectionPda,
      contentRewardPool: contentRewardPoolPda,
      nftRewardState: nftRewardStatePda,
      nftAsset: nftAsset,
      collectionAsset: collectionAsset,
      owner: owner,
      mplCoreProgram: MPL_CORE_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

// ============================================
// FETCH FUNCTIONS
// ============================================

export async function fetchContent(
  connection: Connection,
  contentCid: string
): Promise<ContentEntry | null> {
  try {
    const program = createProgram(connection);
    const [contentPda] = getContentPda(contentCid);

    // Use program.account.<name>.fetch() - the proper Anchor 0.30+ approach
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decoded = await (program.account as any).contentEntry.fetch(contentPda);

    // Anchor auto-converts snake_case to camelCase in returned objects
    return {
      creator: decoded.creator,
      contentCid: decoded.contentCid,
      metadataCid: decoded.metadataCid,
      contentType: anchorToContentType(decoded.contentType),
      tipsReceived: BigInt(decoded.tipsReceived.toString()),
      createdAt: BigInt(decoded.createdAt.toString()),
      isLocked: decoded.isLocked ?? false,
      mintedCount: BigInt(decoded.mintedCount?.toString() || "0"),
      pendingCount: BigInt(decoded.pendingCount?.toString() || "0"),
      isEncrypted: decoded.isEncrypted ?? false,
      previewCid: decoded.previewCid ?? "",
      encryptionMetaCid: decoded.encryptionMetaCid ?? "",
    };
  } catch {
    return null;
  }
}

export async function fetchContentByPda(
  connection: Connection,
  pda: PublicKey
): Promise<ContentEntry | null> {
  try {
    const program = createProgram(connection);

    // Use program.account.<name>.fetch() - the proper Anchor 0.30+ approach
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decoded = await (program.account as any).contentEntry.fetch(pda);

    // Anchor auto-converts snake_case to camelCase in returned objects
    return {
      creator: decoded.creator,
      contentCid: decoded.contentCid,
      metadataCid: decoded.metadataCid,
      contentType: anchorToContentType(decoded.contentType),
      tipsReceived: BigInt(decoded.tipsReceived.toString()),
      createdAt: BigInt(decoded.createdAt.toString()),
      isLocked: decoded.isLocked ?? false,
      mintedCount: BigInt(decoded.mintedCount?.toString() || "0"),
      pendingCount: BigInt(decoded.pendingCount?.toString() || "0"),
      isEncrypted: decoded.isEncrypted ?? false,
      previewCid: decoded.previewCid ?? "",
      encryptionMetaCid: decoded.encryptionMetaCid ?? "",
    };
  } catch {
    return null;
  }
}

export async function fetchMintConfig(
  connection: Connection,
  contentCid: string
): Promise<MintConfig | null> {
  try {
    const program = createProgram(connection);
    const [contentPda] = getContentPda(contentCid);
    const [mintConfigPda] = getMintConfigPda(contentPda);

    // Use program.account.<name>.fetch() - the proper Anchor 0.30+ approach
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decoded = await (program.account as any).mintConfig.fetch(mintConfigPda);

    // Anchor auto-converts snake_case to camelCase in returned objects
    return {
      content: decoded.content,
      creator: decoded.creator,
      priceSol: BigInt(decoded.price.toString()),
      maxSupply: decoded.maxSupply ? BigInt(decoded.maxSupply.toString()) : null,
      creatorRoyaltyBps: decoded.creatorRoyaltyBps,
      isActive: decoded.isActive,
      createdAt: BigInt(decoded.createdAt.toString()),
    };
  } catch {
    return null;
  }
}

/**
 * Batch fetch all mint configs in a single RPC call.
 * Returns a Map keyed by content PDA base58 string.
 */
export async function fetchAllMintConfigs(
  connection: Connection
): Promise<Map<string, MintConfig>> {
  const configs = new Map<string, MintConfig>();
  try {
    const program = createProgram(connection);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allConfigs = await (program.account as any).mintConfig.all();

    for (const { account } of allConfigs) {
      const contentKey = account.content.toBase58();
      configs.set(contentKey, {
        content: account.content,
        creator: account.creator,
        priceSol: BigInt(account.price.toString()),
        maxSupply: account.maxSupply ? BigInt(account.maxSupply.toString()) : null,
        creatorRoyaltyBps: account.creatorRoyaltyBps,
        isActive: account.isActive,
        createdAt: BigInt(account.createdAt.toString()),
      });
    }
  } catch (err) {
    console.error("[fetchAllMintConfigs] Error:", err);
  }
  return configs;
}

/**
 * Batch fetch all rent configs in a single RPC call.
 * Returns a Map keyed by content PDA base58 string.
 */
export async function fetchAllRentConfigs(
  connection: Connection
): Promise<Map<string, RentConfig>> {
  const configs = new Map<string, RentConfig>();
  try {
    const program = createProgram(connection);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allConfigs = await (program.account as any).rentConfig.all();

    for (const { account } of allConfigs) {
      const contentKey = account.content.toBase58();
      // Anchor converts rent_fee_6h -> rentFee6H (capital H, D)
      configs.set(contentKey, {
        content: account.content,
        creator: account.creator,
        rentFee6h: BigInt(account.rentFee6H.toString()),
        rentFee1d: BigInt(account.rentFee1D.toString()),
        rentFee7d: BigInt(account.rentFee7D.toString()),
        isActive: account.isActive,
        totalRentals: BigInt(account.totalRentals.toString()),
        totalFeesCollected: BigInt(account.totalFeesCollected.toString()),
        createdAt: BigInt(account.createdAt.toString()),
        updatedAt: BigInt(account.updatedAt.toString()),
      });
    }
  } catch (err) {
    console.error("[fetchAllRentConfigs] Error:", err);
  }
  return configs;
}

/**
 * Batch fetch all content collections in a single RPC call.
 * Returns a Map keyed by content PDA base58 string.
 */
export async function fetchAllContentCollections(
  connection: Connection
): Promise<Map<string, ContentCollection>> {
  const collections = new Map<string, ContentCollection>();
  try {
    const program = createProgram(connection);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allCollections = await (program.account as any).contentCollection.all();

    for (const { account } of allCollections) {
      const contentKey = account.content.toBase58();
      collections.set(contentKey, {
        content: account.content,
        collectionAsset: account.collectionAsset,
        createdAt: BigInt(account.createdAt.toString()),
      });
    }
  } catch (err) {
    console.error("[fetchAllContentCollections] Error:", err);
  }
  return collections;
}

/**
 * Batch fetch all content reward pools in a single RPC call.
 * Returns a Map keyed by content PDA base58 string.
 */
export async function fetchAllContentRewardPools(
  connection: Connection
): Promise<Map<string, ContentRewardPool>> {
  const pools = new Map<string, ContentRewardPool>();
  try {
    const program = createProgram(connection);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allPools = await (program.account as any).contentRewardPool.all();

    for (const { account } of allPools) {
      const contentKey = account.content.toBase58();
      pools.set(contentKey, {
        content: account.content,
        rewardPerShare: BigInt(account.rewardPerShare.toString()),
        totalNfts: BigInt(account.totalNfts.toString()),
        totalWeight: BigInt(account.totalWeight?.toString() || "0"),
        totalDeposited: BigInt(account.totalDeposited.toString()),
        totalClaimed: BigInt(account.totalClaimed.toString()),
        createdAt: BigInt(account.createdAt.toString()),
      });
    }
  } catch (err) {
    console.error("[fetchAllContentRewardPools] Error:", err);
  }
  return pools;
}

/**
 * Batch fetch NFT reward states for multiple NFT assets using getMultipleAccountsInfo.
 * Returns a Map keyed by NFT asset base58 string.
 */
export async function fetchNftRewardStatesBatch(
  connection: Connection,
  nftAssets: PublicKey[]
): Promise<Map<string, NftRewardState>> {
  const states = new Map<string, NftRewardState>();
  if (nftAssets.length === 0) return states;

  try {
    const program = createProgram(connection);
    const nftRewardStatePdas = nftAssets.map(nft => getNftRewardStatePda(nft)[0]);

    // Batch fetch all accounts in a single RPC call
    const accounts = await connection.getMultipleAccountsInfo(nftRewardStatePdas);

    for (let i = 0; i < nftAssets.length; i++) {
      const accountInfo = accounts[i];
      if (accountInfo) {
        try {
          // Decode the account data using Anchor
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const decoded = (program.account as any).nftRewardState.coder.accounts.decode(
            "nftRewardState",
            accountInfo.data
          );

          states.set(nftAssets[i].toBase58(), {
            nftAsset: decoded.nftAsset,
            content: decoded.content,
            rewardDebt: BigInt(decoded.rewardDebt.toString()),
            weight: decoded.weight || 100,
            createdAt: BigInt(decoded.createdAt.toString()),
          });
        } catch {
          // Skip invalid account data
        }
      }
    }
  } catch (err) {
    console.error("[fetchNftRewardStatesBatch] Error:", err);
  }
  return states;
}

export async function fetchEcosystemConfig(
  connection: Connection
): Promise<EcosystemConfig | null> {
  try {
    const program = createProgram(connection);
    const [ecosystemConfigPda] = getEcosystemConfigPda();

    // Use program.account.<name>.fetch() - the proper Anchor 0.30+ approach
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decoded = await (program.account as any).ecosystemConfig.fetch(ecosystemConfigPda);

    // Anchor auto-converts snake_case to camelCase in returned objects
    return {
      admin: decoded.admin,
      treasury: decoded.treasury,
      usdcMint: decoded.usdcMint,
      totalFeesSol: BigInt(decoded.totalFeesSol.toString()),
      totalFeesUsdc: BigInt(decoded.totalFeesUsdc.toString()),
      totalNftsMinted: BigInt(decoded.totalNftsMinted.toString()),
      isPaused: decoded.isPaused,
      createdAt: BigInt(decoded.createdAt.toString()),
    };
  } catch {
    return null;
  }
}

export async function fetchContentRewardPool(
  connection: Connection,
  contentCid: string
): Promise<ContentRewardPool | null> {
  try {
    const program = createProgram(connection);
    const [contentPda] = getContentPda(contentCid);
    const [rewardPoolPda] = getContentRewardPoolPda(contentPda);

    // Use program.account.<name>.fetch() - the proper Anchor 0.30+ approach
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decoded = await (program.account as any).contentRewardPool.fetch(rewardPoolPda);

    // Anchor auto-converts snake_case to camelCase in returned objects
    return {
      content: decoded.content,
      rewardPerShare: BigInt(decoded.rewardPerShare.toString()),
      totalNfts: BigInt(decoded.totalNfts.toString()),
      totalWeight: BigInt(decoded.totalWeight?.toString() || "0"),
      totalDeposited: BigInt(decoded.totalDeposited.toString()),
      totalClaimed: BigInt(decoded.totalClaimed.toString()),
      createdAt: BigInt(decoded.createdAt.toString()),
    };
  } catch {
    return null;
  }
}

export async function fetchContentCollection(
  connection: Connection,
  contentCid: string
): Promise<ContentCollection | null> {
  try {
    const program = createProgram(connection);
    const [contentPda] = getContentPda(contentCid);
    const [contentCollectionPda] = getContentCollectionPda(contentPda);

    // Use program.account.<name>.fetch() - the proper Anchor 0.30+ approach
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decoded = await (program.account as any).contentCollection.fetch(contentCollectionPda);

    // Anchor auto-converts snake_case to camelCase in returned objects
    return {
      content: decoded.content,
      collectionAsset: decoded.collectionAsset,
      createdAt: BigInt(decoded.createdAt.toString()),
    };
  } catch {
    return null;
  }
}

export async function fetchWalletContentState(
  connection: Connection,
  wallet: PublicKey,
  contentCid: string
): Promise<WalletContentState | null> {
  try {
    const program = createProgram(connection);
    const [contentPda] = getContentPda(contentCid);
    const [walletStatePda] = getWalletContentStatePda(wallet, contentPda);

    // Use program.account.<name>.fetch() - the proper Anchor 0.30+ approach
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decoded = await (program.account as any).walletContentState.fetch(walletStatePda);

    // Anchor auto-converts snake_case to camelCase in returned objects
    return {
      wallet: decoded.wallet,
      content: decoded.content,
      nftCount: BigInt(decoded.nftCount.toString()),
      rewardDebt: BigInt(decoded.rewardDebt.toString()),
      totalClaimed: BigInt(decoded.totalClaimed.toString()),
      lastUpdated: BigInt(decoded.lastUpdated.toString()),
    };
  } catch {
    return null;
  }
}

export async function fetchNftRewardState(
  connection: Connection,
  nftAsset: PublicKey
): Promise<NftRewardState | null> {
  try {
    const program = createProgram(connection);
    const [nftRewardStatePda] = getNftRewardStatePda(nftAsset);

    // Use program.account.<name>.fetch() - the proper Anchor 0.30+ approach
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decoded = await (program.account as any).nftRewardState.fetch(nftRewardStatePda);

    // Anchor auto-converts snake_case to camelCase in returned objects
    return {
      nftAsset: decoded.nftAsset,
      content: decoded.content,
      rewardDebt: BigInt(decoded.rewardDebt.toString()),
      weight: decoded.weight || 100,
      createdAt: BigInt(decoded.createdAt.toString()),
    };
  } catch {
    return null;
  }
}

export async function fetchNftRarity(
  connection: Connection,
  nftAsset: PublicKey
): Promise<NftRarity | null> {
  try {
    const program = createProgram(connection);
    const [nftRarityPda] = getNftRarityPda(nftAsset);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decoded = await (program.account as any).nftRarity.fetch(nftRarityPda);

    return {
      nftAsset: decoded.nftAsset,
      content: decoded.content,
      rarity: parseAnchorRarity(decoded.rarity),
      weight: decoded.weight,
      randomnessAccount: decoded.randomnessAccount,
      commitSlot: BigInt(decoded.commitSlot.toString()),
      revealedAt: BigInt(decoded.revealedAt.toString()),
    };
  } catch {
    return null;
  }
}

export async function fetchNftRaritiesBatch(
  connection: Connection,
  nftAssets: PublicKey[]
): Promise<Map<string, NftRarity>> {
  const results = new Map<string, NftRarity>();
  if (nftAssets.length === 0) return results;

  try {
    const program = createProgram(connection);
    const pdas = nftAssets.map((nft) => getNftRarityPda(nft)[0]);

    // Batch fetch all NftRarity accounts
    const accounts = await connection.getMultipleAccountsInfo(pdas);

    for (let i = 0; i < nftAssets.length; i++) {
      const accountInfo = accounts[i];
      if (!accountInfo) continue;

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const decoded = (program.account as any).nftRarity.coder.accounts.decode(
          "nftRarity",
          accountInfo.data
        );

        results.set(nftAssets[i].toBase58(), {
          nftAsset: decoded.nftAsset,
          content: decoded.content,
          rarity: parseAnchorRarity(decoded.rarity),
          weight: decoded.weight,
          randomnessAccount: decoded.randomnessAccount,
          commitSlot: BigInt(decoded.commitSlot.toString()),
          revealedAt: BigInt(decoded.revealedAt.toString()),
        });
      } catch {
        // Skip invalid accounts
      }
    }
  } catch (err) {
    console.error("[fetchNftRaritiesBatch] Error:", err);
  }

  return results;
}

export async function fetchRentConfig(
  connection: Connection,
  contentCid: string
): Promise<RentConfig | null> {
  try {
    const program = createProgram(connection);
    const [contentPda] = getContentPda(contentCid);
    const [rentConfigPda] = getRentConfigPda(contentPda);

    // Use program.account.<name>.fetch() - the proper Anchor 0.30+ approach
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decoded = await (program.account as any).rentConfig.fetch(rentConfigPda);

    // Anchor converts rent_fee_6h -> rentFee6H (capital H, D)
    return {
      content: decoded.content,
      creator: decoded.creator,
      rentFee6h: BigInt(decoded.rentFee6H.toString()),
      rentFee1d: BigInt(decoded.rentFee1D.toString()),
      rentFee7d: BigInt(decoded.rentFee7D.toString()),
      isActive: decoded.isActive,
      totalRentals: BigInt(decoded.totalRentals.toString()),
      totalFeesCollected: BigInt(decoded.totalFeesCollected.toString()),
      createdAt: BigInt(decoded.createdAt.toString()),
      updatedAt: BigInt(decoded.updatedAt.toString()),
    };
  } catch {
    // Account doesn't exist = no rent config for this content (expected)
    return null;
  }
}

export async function fetchRentEntry(
  connection: Connection,
  nftAsset: PublicKey
): Promise<RentEntry | null> {
  try {
    const program = createProgram(connection);
    const [rentEntryPda] = getRentEntryPda(nftAsset);

    // Use program.account.<name>.fetch() - the proper Anchor 0.30+ approach
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decoded = await (program.account as any).rentEntry.fetch(rentEntryPda);

    // Anchor auto-converts snake_case to camelCase in returned objects
    return {
      renter: decoded.renter,
      content: decoded.content,
      nftAsset: decoded.nftAsset,
      rentedAt: BigInt(decoded.rentedAt.toString()),
      expiresAt: BigInt(decoded.expiresAt.toString()),
      isActive: decoded.isActive,
      feePaid: BigInt(decoded.feePaid.toString()),
    };
  } catch {
    return null;
  }
}

/**
 * Fetch a pending mint by buyer and content
 * Returns null if no pending mint exists
 */
export async function fetchPendingMint(
  connection: Connection,
  buyer: PublicKey,
  contentCid: string
): Promise<PendingMint | null> {
  try {
    const program = createProgram(connection);
    const [contentPda] = getContentPda(contentCid);
    const [pendingMintPda] = getPendingMintPda(buyer, contentPda);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decoded = await (program.account as any).pendingMint.fetch(pendingMintPda);

    return {
      buyer: decoded.buyer,
      content: decoded.content,
      creator: decoded.creator,
      randomnessAccount: decoded.randomnessAccount,
      commitSlot: BigInt(decoded.commitSlot.toString()),
      amountPaid: BigInt(decoded.amountPaid.toString()),
      createdAt: BigInt(decoded.createdAt.toString()),
      hadExistingNfts: decoded.hadExistingNfts ?? false,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch all pending mints for a wallet across all content
 * This is useful for recovery - finding any mints that were started but not completed
 */
export async function fetchAllPendingMintsForWallet(
  connection: Connection,
  wallet: PublicKey
): Promise<Array<{ pendingMint: PendingMint; contentCid: string }>> {
  try {
    const program = createProgram(connection);

    // Fetch all pending mints
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allPendingMints = await (program.account as any).pendingMint.all([
      { memcmp: { offset: 8, bytes: wallet.toBase58() } }
    ]);

    // Also fetch all content entries to map content PDA -> contentCid
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allContentEntries = await (program.account as any).contentEntry.all();

    // Build content PDA -> contentCid map
    const contentPdaToContentCid = new Map<string, string>();
    for (const { publicKey, account } of allContentEntries) {
      contentPdaToContentCid.set(publicKey.toBase58(), account.contentCid);
    }

    const results: Array<{ pendingMint: PendingMint; contentCid: string }> = [];

    for (const { account } of allPendingMints) {
      const contentCid = contentPdaToContentCid.get(account.content.toBase58());
      if (contentCid) {
        results.push({
          pendingMint: {
            buyer: account.buyer,
            content: account.content,
            creator: account.creator,
            randomnessAccount: account.randomnessAccount,
            commitSlot: BigInt(account.commitSlot.toString()),
            amountPaid: BigInt(account.amountPaid.toString()),
            createdAt: BigInt(account.createdAt.toString()),
            hadExistingNfts: account.hadExistingNfts ?? false,
          },
          contentCid,
        });
      }
    }

    return results;
  } catch (err) {
    console.error("[fetchAllPendingMintsForWallet] Error:", err);
    return [];
  }
}

export async function checkRentalAccess(
  connection: Connection,
  nftAsset: PublicKey
): Promise<{ hasAccess: boolean; expiresAt: bigint | null; remainingSeconds: number }> {
  const rentEntry = await fetchRentEntry(connection, nftAsset);
  if (!rentEntry || !rentEntry.isActive) {
    return { hasAccess: false, expiresAt: null, remainingSeconds: 0 };
  }

  const now = BigInt(Math.floor(Date.now() / 1000));
  const hasAccess = now < rentEntry.expiresAt;
  const remainingSeconds = hasAccess ? Number(rentEntry.expiresAt - now) : 0;

  return { hasAccess, expiresAt: rentEntry.expiresAt, remainingSeconds };
}

export async function getPendingRewardForContent(
  connection: Connection,
  wallet: PublicKey,
  contentCid: string
): Promise<bigint> {
  // Get reward pool and collection info
  const rewardPool = await fetchContentRewardPool(connection, contentCid);
  const contentCollection = await fetchContentCollection(connection, contentCid);

  if (!rewardPool || !contentCollection) return BigInt(0);

  // Get all NFTs owned by wallet in this collection
  const nftAssets = await fetchWalletNftsForCollection(connection, wallet, contentCollection.collectionAsset);
  if (nftAssets.length === 0) return BigInt(0);

  // Calculate pending rewards for each NFT using per-NFT tracking
  let totalPending = BigInt(0);
  for (const nftAsset of nftAssets) {
    const nftRewardState = await fetchNftRewardState(connection, nftAsset);
    if (nftRewardState) {
      // pending = (rewardPerShare - nftRewardDebt) / PRECISION
      const pending = rewardPool.rewardPerShare > nftRewardState.rewardDebt
        ? (rewardPool.rewardPerShare - nftRewardState.rewardDebt) / BigInt("1000000000000")
        : BigInt(0);
      totalPending += pending;
    }
  }

  return totalPending;
}

export async function getPendingRewardsForWallet(
  connection: Connection,
  wallet: PublicKey,
  contentCids: string[]
): Promise<Array<{ contentCid: string; pending: bigint; nftCount: bigint }>> {
  const detailed = await getPendingRewardsForWalletDetailed(connection, wallet, contentCids);
  return detailed.map(d => ({ contentCid: d.contentCid, pending: d.pending, nftCount: d.nftCount }));
}

export async function getPendingRewardsForWalletDetailed(
  connection: Connection,
  wallet: PublicKey,
  contentCids: string[]
): Promise<Array<{ contentCid: string; pending: bigint; nftCount: bigint; nftRewards: Array<{ nftAsset: PublicKey; pending: bigint; rewardDebt: bigint }> }>> {
  const results: Array<{ contentCid: string; pending: bigint; nftCount: bigint; nftRewards: Array<{ nftAsset: PublicKey; pending: bigint; rewardDebt: bigint }> }> = [];

  for (const contentCid of contentCids) {
    // Get reward pool and collection info
    const rewardPool = await fetchContentRewardPool(connection, contentCid);
    const contentCollection = await fetchContentCollection(connection, contentCid);

    if (!rewardPool || !contentCollection) {
      results.push({ contentCid, pending: BigInt(0), nftCount: BigInt(0), nftRewards: [] });
      continue;
    }

    // Get all NFTs owned by wallet in this collection
    const nftAssets = await fetchWalletNftsForCollection(connection, wallet, contentCollection.collectionAsset);
    const nftCount = BigInt(nftAssets.length);

    if (nftAssets.length === 0) {
      results.push({ contentCid, pending: BigInt(0), nftCount, nftRewards: [] });
      continue;
    }

    // Calculate pending rewards for each NFT using per-NFT tracking
    let totalPending = BigInt(0);
    const nftRewards: Array<{ nftAsset: PublicKey; pending: bigint; rewardDebt: bigint }> = [];

    for (const nftAsset of nftAssets) {
      const nftRewardState = await fetchNftRewardState(connection, nftAsset);
      if (nftRewardState) {
        // pending = (rewardPerShare - nftRewardDebt) / PRECISION
        const pending = rewardPool.rewardPerShare > nftRewardState.rewardDebt
          ? (rewardPool.rewardPerShare - nftRewardState.rewardDebt) / BigInt("1000000000000")
          : BigInt(0);
        totalPending += pending;
        nftRewards.push({ nftAsset, pending, rewardDebt: nftRewardState.rewardDebt });
      }
    }

    results.push({ contentCid, pending: totalPending, nftCount, nftRewards });
  }

  return results;
}

/**
 * Optimized version of getPendingRewardsForWalletDetailed that accepts pre-fetched batch data.
 * Uses batch fetching for NFT reward states to minimize RPC calls.
 *
 * Instead of N*M individual calls, this uses:
 * - Pre-fetched rewardPools and collections (0 calls - passed in)
 * - 1 call per unique collection to get NFTs (via getProgramAccounts filter)
 * - 1 batch call for all NFT reward states
 */
export async function getPendingRewardsOptimized(
  connection: Connection,
  wallet: PublicKey,
  walletNfts: WalletNftMetadata[],
  rewardPools: Map<string, ContentRewardPool>,
  contentCollections: Map<string, ContentCollection>
): Promise<Array<{ contentCid: string; pending: bigint; nftCount: bigint; nftRewards: Array<{ nftAsset: PublicKey; pending: bigint; rewardDebt: bigint }> }>> {
  const results: Array<{ contentCid: string; pending: bigint; nftCount: bigint; nftRewards: Array<{ nftAsset: PublicKey; pending: bigint; rewardDebt: bigint }> }> = [];

  // Group NFTs by contentCid
  const nftsByContent = new Map<string, WalletNftMetadata[]>();
  for (const nft of walletNfts) {
    if (nft.contentCid) {
      const existing = nftsByContent.get(nft.contentCid) || [];
      existing.push(nft);
      nftsByContent.set(nft.contentCid, existing);
    }
  }

  // Get all NFT assets that need reward state lookup
  const allNftAssets: PublicKey[] = [];
  for (const nfts of nftsByContent.values()) {
    for (const nft of nfts) {
      allNftAssets.push(nft.nftAsset);
    }
  }

  // Batch fetch all NFT reward states in a single call
  const nftRewardStates = await fetchNftRewardStatesBatch(connection, allNftAssets);

  // Calculate pending rewards for each content
  for (const [contentCid, nfts] of nftsByContent) {
    const [contentPda] = getContentPda(contentCid);
    const contentKey = contentPda.toBase58();

    const rewardPool = rewardPools.get(contentKey);
    if (!rewardPool) {
      results.push({ contentCid, pending: BigInt(0), nftCount: BigInt(nfts.length), nftRewards: [] });
      continue;
    }

    let totalPending = BigInt(0);
    const nftRewards: Array<{ nftAsset: PublicKey; pending: bigint; rewardDebt: bigint }> = [];

    for (const nft of nfts) {
      const nftRewardState = nftRewardStates.get(nft.nftAsset.toBase58());
      if (nftRewardState) {
        const pending = rewardPool.rewardPerShare > nftRewardState.rewardDebt
          ? (rewardPool.rewardPerShare - nftRewardState.rewardDebt) / BigInt("1000000000000")
          : BigInt(0);
        totalPending += pending;
        nftRewards.push({ nftAsset: nft.nftAsset, pending, rewardDebt: nftRewardState.rewardDebt });
      }
    }

    results.push({
      contentCid,
      pending: totalPending,
      nftCount: BigInt(nfts.length),
      nftRewards,
    });
  }

  return results;
}

export async function fetchWalletNftMetadata(
  connection: Connection,
  wallet: PublicKey
): Promise<WalletNftMetadata[]> {
  // Fetch collections and content entries once upfront
  const collections = await fetchAllContentCollections(connection);
  const program = createProgram(connection);

  // Fetch content entries using getProgramAccounts with manual decoding
  // This allows graceful handling of old-format accounts that fail to decode
  const contentAccounts = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [
      // Filter by ContentEntry discriminator
      { memcmp: { offset: 0, bytes: "2UDvbZBL6Si" } },
    ],
  });

  const allContentEntries: Array<{ contentCid: string; creator: PublicKey }> = [];
  for (const { account } of contentAccounts) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const decoded = (program.account as any).contentEntry.coder.accounts.decode(
        "contentEntry",
        account.data
      );
      allContentEntries.push({
        contentCid: decoded.contentCid,
        creator: decoded.creator,
      });
    } catch {
      // Skip accounts that fail to decode (old format)
    }
  }

  // Build a map from collectionAsset -> contentCid for quick lookup
  const collectionToContentCid = new Map<string, string>();
  for (const collection of collections.values()) {
    // Find the content entry for this collection
    for (const entry of allContentEntries) {
      if (entry.creator && collection.content.equals(getContentPda(entry.contentCid)[0])) {
        collectionToContentCid.set(collection.collectionAsset.toBase58(), entry.contentCid);
        break;
      }
    }
  }

  return fetchWalletNftMetadataWithCollections(connection, wallet, collectionToContentCid);
}

/**
 * Optimized version that accepts pre-built collection->contentCid map.
 * This avoids re-fetching collections for each NFT.
 */
export async function fetchWalletNftMetadataWithCollections(
  connection: Connection,
  wallet: PublicKey,
  collectionToContentCid: Map<string, string>
): Promise<WalletNftMetadata[]> {
  try {
    const accounts = await connection.getProgramAccounts(MPL_CORE_PROGRAM_ID, {
      filters: [
        { memcmp: { offset: 1, bytes: wallet.toBase58() } },
      ],
    });

    const results: WalletNftMetadata[] = [];

    for (const { pubkey, account } of accounts) {
      try {
        const data = account.data;
        if (data.length < 66 || data[0] !== 1) continue;

        let name = "NFT";
        let collectionAsset: PublicKey | null = null;

        const updateAuthorityType = data[33];
        if (updateAuthorityType === 2) {
          const collectionBytes = data.slice(34, 66);
          collectionAsset = new PublicKey(collectionBytes);
        }

        try {
          let offset = 66;
          if (data.length > offset + 4) {
            const nameLen = data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24);
            offset += 4;
            if (data.length >= offset + nameLen) {
              name = Buffer.from(data.slice(offset, offset + nameLen)).toString("utf8");
            }
          }
        } catch {
          // Use default name
        }

        // Use pre-fetched collection map instead of fetching for each NFT
        const contentCid = collectionAsset
          ? collectionToContentCid.get(collectionAsset.toBase58()) || null
          : null;

        // Only include NFTs that belong to Handcraft content collections
        if (contentCid) {
          results.push({
            nftAsset: pubkey,
            contentCid,
            collectionAsset,
            name,
          });
        }
      } catch {
        // Skip invalid account
      }
    }

    return results;
  } catch {
    return [];
  }
}

export async function countNftsOwned(
  connection: Connection,
  wallet: PublicKey,
  contentCid: string
): Promise<number> {
  const walletState = await fetchWalletContentState(connection, wallet, contentCid);
  return walletState ? Number(walletState.nftCount) : 0;
}

export async function checkNftOwnership(
  connection: Connection,
  wallet: PublicKey,
  contentCid: string
): Promise<boolean> {
  return (await countNftsOwned(connection, wallet, contentCid)) > 0;
}

export async function getContentNftHolders(
  connection: Connection,
  contentCid: string
): Promise<Array<{ wallet: PublicKey; nftCount: bigint }>> {
  try {
    const program = createProgram(connection);
    const [contentPda] = getContentPda(contentCid);

    // Use program.account.<name>.all() to fetch all WalletContentState accounts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allWalletStates = await (program.account as any).walletContentState.all();
    const holders: Array<{ wallet: PublicKey; nftCount: bigint }> = [];

    for (const { account } of allWalletStates) {
      // Anchor auto-converts to camelCase
      if (account.content.equals(contentPda) && account.nftCount > 0) {
        holders.push({
          wallet: account.wallet,
          nftCount: BigInt(account.nftCount.toString()),
        });
      }
    }

    return holders.sort((a, b) => Number(b.nftCount - a.nftCount));
  } catch {
    return [];
  }
}

export async function fetchWalletNftsForCollection(
  connection: Connection,
  wallet: PublicKey,
  collectionAsset: PublicKey
): Promise<PublicKey[]> {
  try {
    const accounts = await connection.getProgramAccounts(MPL_CORE_PROGRAM_ID, {
      filters: [
        { memcmp: { offset: 1, bytes: wallet.toBase58() } },
      ],
    });

    const nftAssets: PublicKey[] = [];

    for (const { pubkey, account } of accounts) {
      try {
        const data = account.data;
        if (data.length < 66 || data[0] !== 1) continue;

        const updateAuthorityType = data[33];
        if (updateAuthorityType !== 2) continue;

        const collectionBytes = data.slice(34, 66);
        const assetCollection = new PublicKey(collectionBytes);

        if (assetCollection.equals(collectionAsset)) {
          nftAssets.push(pubkey);
        }
      } catch {
        // Skip invalid account
      }
    }

    return nftAssets;
  } catch {
    return [];
  }
}

export async function fetchActiveRentalForContent(
  connection: Connection,
  wallet: PublicKey,
  contentCid: string
): Promise<RentEntry | null> {
  try {
    // First get the content collection to find NFTs in this collection
    const contentCollection = await fetchContentCollection(connection, contentCid);
    if (!contentCollection) return null;

    // Get all NFTs owned by wallet in this collection
    const nftAssets = await fetchWalletNftsForCollection(connection, wallet, contentCollection.collectionAsset);
    if (nftAssets.length === 0) return null;

    const now = BigInt(Math.floor(Date.now() / 1000));
    let latestActiveRental: RentEntry | null = null;

    // Check each NFT for an active rent entry
    for (const nftAsset of nftAssets) {
      const rentEntry = await fetchRentEntry(connection, nftAsset);
      if (rentEntry && rentEntry.isActive && rentEntry.expiresAt > now) {
        // Keep track of the rental with the latest expiry
        if (!latestActiveRental || rentEntry.expiresAt > latestActiveRental.expiresAt) {
          latestActiveRental = rentEntry;
        }
      }
    }

    return latestActiveRental;
  } catch {
    return null;
  }
}

export async function fetchWalletRentalNfts(
  connection: Connection,
  wallet: PublicKey
): Promise<Set<string>> {
  try {
    // Get all NFTs owned by wallet
    const nftMetadata = await fetchWalletNftMetadata(connection, wallet);
    return fetchRentalNftsFromMetadata(connection, nftMetadata);
  } catch {
    return new Set();
  }
}

/**
 * Optimized version that accepts pre-fetched NFT metadata to avoid redundant RPC calls.
 * Uses batch fetching via getMultipleAccountsInfo instead of individual calls.
 */
export async function fetchRentalNftsFromMetadata(
  connection: Connection,
  nftMetadata: WalletNftMetadata[]
): Promise<Set<string>> {
  try {
    if (nftMetadata.length === 0) return new Set<string>();

    // Get all rent entry PDAs in one go
    const rentEntryPdas = nftMetadata.map(nft => getRentEntryPda(nft.nftAsset)[0]);

    // Batch fetch all rent entries in a single RPC call
    const rentEntryAccounts = await connection.getMultipleAccountsInfo(rentEntryPdas);

    const rentalNftAssets = new Set<string>();

    // Check which NFTs have rent entries (account exists = is a rental NFT)
    for (let i = 0; i < nftMetadata.length; i++) {
      if (rentEntryAccounts[i] !== null) {
        rentalNftAssets.add(nftMetadata[i].nftAsset.toBase58());
      }
    }

    return rentalNftAssets;
  } catch {
    return new Set();
  }
}

export async function countTotalMintedNfts(
  connection: Connection,
  contentCid: string
): Promise<number> {
  const content = await fetchContent(connection, contentCid);
  if (!content) return 0;
  return Number(content.mintedCount);
}

// ============================================
// HIGH-LEVEL CLIENT
// ============================================

export function createContentRegistryClient(connection: Connection) {
  const program = createProgram(connection);

  return {
    program,
    getContentPda,
    getCidRegistryPda,
    getEcosystemConfigPda,
    getMintConfigPda,
    getContentRewardPoolPda,
    getWalletContentStatePda,
    getContentCollectionPda,
    getNftRewardStatePda,
    getRentConfigPda,
    getRentEntryPda,
    getPendingMintPda,
    getNftRarityPda,
    hashCid,
    calculateWeightedPendingReward,

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
      platform: PublicKey,
      isEncrypted: boolean = false,
      previewCid: string = "",
      encryptionMetaCid: string = ""
    ) => registerContentWithMintInstruction(
      program, authority, contentCid, metadataCid, contentType, price, maxSupply, creatorRoyaltyBps, platform, isEncrypted, previewCid, encryptionMetaCid
    ),

    updateContentInstruction: (creator: PublicKey, contentCid: string, metadataCid: string) =>
      updateContentInstruction(program, creator, contentCid, metadataCid),

    deleteContentInstruction: (creator: PublicKey, contentCid: string) =>
      deleteContentInstruction(program, creator, contentCid),

    deleteContentWithMintInstruction: (creator: PublicKey, contentCid: string) =>
      deleteContentWithMintInstruction(program, creator, contentCid),

    tipContentInstruction: (tipper: PublicKey, contentCid: string, creator: PublicKey, amount: bigint | number) =>
      tipContentInstruction(program, tipper, contentCid, creator, amount),

    // Mint configuration
    configureMintInstruction: (creator: PublicKey, contentCid: string, price: bigint, maxSupply: bigint | null, creatorRoyaltyBps: number) =>
      configureMintInstruction(program, creator, contentCid, price, maxSupply, creatorRoyaltyBps),

    updateMintSettingsInstruction: (creator: PublicKey, contentCid: string, price: bigint | null, maxSupply: bigint | null | undefined, creatorRoyaltyBps: number | null, isActive: boolean | null) =>
      updateMintSettingsInstruction(program, creator, contentCid, price, maxSupply, creatorRoyaltyBps, isActive),

    // NFT minting (legacy - without rarity)
    mintNftSolInstruction: (buyer: PublicKey, contentCid: string, creator: PublicKey, treasury: PublicKey, platform: PublicKey, collectionAsset: PublicKey): Promise<MintNftResult> =>
      mintNftSolInstruction(program, buyer, contentCid, creator, treasury, platform, collectionAsset),

    // VRF-based minting with rarity (two-step flow)
    commitMintInstruction: (buyer: PublicKey, contentCid: string, creator: PublicKey, treasury: PublicKey, randomnessAccount: PublicKey, platform: PublicKey): Promise<TransactionInstruction> =>
      commitMintInstruction(program, buyer, contentCid, creator, treasury, randomnessAccount, platform),

    revealMintInstruction: (buyer: PublicKey, contentCid: string, creator: PublicKey, collectionAsset: PublicKey, randomnessAccount: PublicKey, treasury: PublicKey, platform: PublicKey): Promise<MintNftResult> =>
      revealMintInstruction(program, buyer, contentCid, creator, collectionAsset, randomnessAccount, treasury, platform),

    // Cancel expired pending mint (refund if oracle failed)
    cancelExpiredMintInstruction: (buyer: PublicKey, contentCid: string): Promise<TransactionInstruction> =>
      cancelExpiredMintInstruction(program, buyer, contentCid),

    // Claim rewards
    claimContentRewardsInstruction: (holder: PublicKey, contentCid: string) =>
      claimContentRewardsInstruction(program, holder, contentCid),

    claimAllRewardsInstruction: (holder: PublicKey, contentCids: string[]) =>
      claimAllRewardsInstruction(program, holder, contentCids),

    claimRewardsVerifiedInstruction: (holder: PublicKey, contentCid: string, nftAssets: PublicKey[]) =>
      claimRewardsVerifiedInstruction(program, holder, contentCid, nftAssets),

    // Sync NFT transfers
    syncNftTransferInstruction: (sender: PublicKey, receiver: PublicKey, contentCid: string) =>
      syncNftTransferInstruction(program, sender, receiver, contentCid),

    syncNftTransfersBatchInstruction: (sender: PublicKey, receiver: PublicKey, contentCid: string, count: number) =>
      syncNftTransfersBatchInstruction(program, sender, receiver, contentCid, count),

    // Rent management (3-tier pricing)
    configureRentInstruction: (creator: PublicKey, contentCid: string, rentFee6h: bigint, rentFee1d: bigint, rentFee7d: bigint) =>
      configureRentInstruction(program, creator, contentCid, rentFee6h, rentFee1d, rentFee7d),

    updateRentConfigInstruction: (creator: PublicKey, contentCid: string, rentFee6h: bigint | null, rentFee1d: bigint | null, rentFee7d: bigint | null, isActive: boolean | null) =>
      updateRentConfigInstruction(program, creator, contentCid, rentFee6h, rentFee1d, rentFee7d, isActive),

    rentContentSolInstruction: (renter: PublicKey, contentCid: string, creator: PublicKey, treasury: PublicKey, platform: PublicKey, collectionAsset: PublicKey, tier: RentTier): Promise<RentContentResult> =>
      rentContentSolInstruction(program, renter, contentCid, creator, treasury, platform, collectionAsset, tier),

    checkRentExpiryInstruction: (nftAsset: PublicKey) =>
      checkRentExpiryInstruction(program, nftAsset),

    // Burn NFT (with reward state cleanup)
    burnNftInstruction: (owner: PublicKey, nftAsset: PublicKey, collectionAsset: PublicKey, contentCid: string) =>
      burnNftInstruction(program, owner, nftAsset, collectionAsset, contentCid),

    // Ecosystem management
    initializeEcosystemInstruction: (admin: PublicKey, treasury: PublicKey, usdcMint: PublicKey) =>
      initializeEcosystemInstruction(program, admin, treasury, usdcMint),

    updateEcosystemInstruction: (admin: PublicKey, newTreasury: PublicKey | null, newUsdcMint: PublicKey | null, isPaused: boolean | null) =>
      updateEcosystemInstruction(program, admin, newTreasury, newUsdcMint, isPaused),

    // Fetching
    fetchContent: (contentCid: string) => fetchContent(connection, contentCid),
    fetchContentByPda: (pda: PublicKey) => fetchContentByPda(connection, pda),
    fetchMintConfig: (contentCid: string) => fetchMintConfig(connection, contentCid),
    fetchAllMintConfigs: () => fetchAllMintConfigs(connection),
    fetchAllRentConfigs: () => fetchAllRentConfigs(connection),
    fetchAllContentCollections: () => fetchAllContentCollections(connection),
    fetchAllContentRewardPools: () => fetchAllContentRewardPools(connection),
    fetchNftRewardStatesBatch: (nftAssets: PublicKey[]) => fetchNftRewardStatesBatch(connection, nftAssets),
    fetchEcosystemConfig: () => fetchEcosystemConfig(connection),
    fetchContentRewardPool: (contentCid: string) => fetchContentRewardPool(connection, contentCid),
    fetchContentCollection: (contentCid: string) => fetchContentCollection(connection, contentCid),
    fetchWalletContentState: (wallet: PublicKey, contentCid: string) => fetchWalletContentState(connection, wallet, contentCid),
    fetchNftRewardState: (nftAsset: PublicKey) => fetchNftRewardState(connection, nftAsset),

    // NFT Rarity fetching
    fetchNftRarity: (nftAsset: PublicKey) => fetchNftRarity(connection, nftAsset),
    fetchNftRaritiesBatch: (nftAssets: PublicKey[]) => fetchNftRaritiesBatch(connection, nftAssets),

    // Rent fetching
    fetchRentConfig: (contentCid: string) => fetchRentConfig(connection, contentCid),
    fetchRentEntry: (nftAsset: PublicKey) => fetchRentEntry(connection, nftAsset),
    checkRentalAccess: (nftAsset: PublicKey) => checkRentalAccess(connection, nftAsset),
    fetchActiveRentalForContent: (wallet: PublicKey, contentCid: string) => fetchActiveRentalForContent(connection, wallet, contentCid),
    fetchWalletRentalNfts: (wallet: PublicKey) => fetchWalletRentalNfts(connection, wallet),
    fetchRentalNftsFromMetadata: (nftMetadata: WalletNftMetadata[]) => fetchRentalNftsFromMetadata(connection, nftMetadata),

    // Pending mint recovery (VRF mints)
    fetchPendingMint: (buyer: PublicKey, contentCid: string) => fetchPendingMint(connection, buyer, contentCid),
    fetchAllPendingMintsForWallet: (wallet: PublicKey) => fetchAllPendingMintsForWallet(connection, wallet),

    // Reward calculations
    getPendingRewardForContent: (wallet: PublicKey, contentCid: string) => getPendingRewardForContent(connection, wallet, contentCid),
    getPendingRewardsForWallet: (wallet: PublicKey, contentCids: string[]) => getPendingRewardsForWallet(connection, wallet, contentCids),
    getPendingRewardsForWalletDetailed: (wallet: PublicKey, contentCids: string[]) => getPendingRewardsForWalletDetailed(connection, wallet, contentCids),
    getPendingRewardsOptimized: (
      wallet: PublicKey,
      walletNfts: WalletNftMetadata[],
      rewardPools: Map<string, ContentRewardPool>,
      contentCollections: Map<string, ContentCollection>
    ) => getPendingRewardsOptimized(connection, wallet, walletNfts, rewardPools, contentCollections),

    // NFT ownership
    checkNftOwnership: (wallet: PublicKey, contentCid: string) => checkNftOwnership(connection, wallet, contentCid),
    countNftsOwned: (wallet: PublicKey, contentCid: string) => countNftsOwned(connection, wallet, contentCid),
    countTotalMintedNfts: (contentCid: string) => countTotalMintedNfts(connection, contentCid),
    fetchWalletNftMetadata: (wallet: PublicKey) => fetchWalletNftMetadata(connection, wallet),
    fetchWalletNftMetadataWithCollections: (wallet: PublicKey, collectionToContentCid: Map<string, string>) =>
      fetchWalletNftMetadataWithCollections(connection, wallet, collectionToContentCid),
    getContentNftHolders: (contentCid: string) => getContentNftHolders(connection, contentCid),
    fetchWalletNftsForCollection: (wallet: PublicKey, collectionAsset: PublicKey) => fetchWalletNftsForCollection(connection, wallet, collectionAsset),

    // Fetch all content
    async fetchGlobalContent(): Promise<ContentEntry[]> {
      try {
        // Use getProgramAccounts to get raw account data, then decode individually
        // This allows graceful handling of old-format accounts that may be missing new fields
        const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
          filters: [
            // Filter by ContentEntry discriminator (first 8 bytes)
            // Discriminator for "ContentEntry" account is sha256("account:ContentEntry")[0..8] = 08c8e3af03bebe1f
            { memcmp: { offset: 0, bytes: "2UDvbZBL6Si" } }, // base58 of discriminator
          ],
        });

        const entries: ContentEntry[] = [];

        for (const { account } of accounts) {
          try {
            // Decode using Anchor's coder with error handling per account
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const decoded = (program.account as any).contentEntry.coder.accounts.decode(
              "contentEntry",
              account.data
            );

            entries.push({
              creator: decoded.creator,
              contentCid: decoded.contentCid,
              metadataCid: decoded.metadataCid,
              contentType: anchorToContentType(decoded.contentType),
              tipsReceived: BigInt(decoded.tipsReceived.toString()),
              createdAt: BigInt(decoded.createdAt.toString()),
              isLocked: decoded.isLocked ?? false,
              mintedCount: BigInt(decoded.mintedCount?.toString() || "0"),
              pendingCount: BigInt(decoded.pendingCount?.toString() || "0"),
              isEncrypted: decoded.isEncrypted ?? false,
              previewCid: decoded.previewCid ?? "",
              encryptionMetaCid: decoded.encryptionMetaCid ?? "",
            });
          } catch {
            // Skip accounts that fail to decode (old format without pendingCount)
            // This allows the feed to show new content while ignoring incompatible old accounts
            console.warn("[fetchGlobalContent] Skipping account with incompatible format");
          }
        }

        return entries.sort((a, b) => Number(b.createdAt - a.createdAt));
      } catch (err) {
        console.error("[fetchGlobalContent] Error fetching content:", err);
        return [];
      }
    },

    async fetchContentByCreator(creator: PublicKey): Promise<ContentEntry[]> {
      try {
        // Use getProgramAccounts with creator filter for efficiency
        const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
          filters: [
            // Filter by ContentEntry discriminator
            { memcmp: { offset: 0, bytes: "2UDvbZBL6Si" } },
            // Filter by creator pubkey (after 8-byte discriminator)
            { memcmp: { offset: 8, bytes: creator.toBase58() } },
          ],
        });

        const entries: ContentEntry[] = [];

        for (const { account } of accounts) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const decoded = (program.account as any).contentEntry.coder.accounts.decode(
              "contentEntry",
              account.data
            );

            entries.push({
              creator: decoded.creator,
              contentCid: decoded.contentCid,
              metadataCid: decoded.metadataCid,
              contentType: anchorToContentType(decoded.contentType),
              tipsReceived: BigInt(decoded.tipsReceived.toString()),
              createdAt: BigInt(decoded.createdAt.toString()),
              isLocked: decoded.isLocked ?? false,
              mintedCount: BigInt(decoded.mintedCount?.toString() || "0"),
              pendingCount: BigInt(decoded.pendingCount?.toString() || "0"),
              isEncrypted: decoded.isEncrypted ?? false,
              previewCid: decoded.previewCid ?? "",
              encryptionMetaCid: decoded.encryptionMetaCid ?? "",
            });
          } catch {
            // Skip accounts that fail to decode
            console.warn("[fetchContentByCreator] Skipping account with incompatible format");
          }
        }

        return entries.sort((a, b) => Number(b.createdAt - a.createdAt));
      } catch (err) {
        console.error("[fetchContentByCreator] Error:", err);
        return [];
      }
    },

    async fetchMintableContent(): Promise<Array<{ content: ContentEntry; mintConfig: MintConfig }>> {
      try {
        // Fetch content entries with per-account error handling
        const contentAccounts = await connection.getProgramAccounts(PROGRAM_ID, {
          filters: [
            { memcmp: { offset: 0, bytes: "2UDvbZBL6Si" } },
          ],
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allMintConfigs = await (program.account as any).mintConfig.all();

        const results: Array<{ content: ContentEntry; mintConfig: MintConfig }> = [];

        // Build content entries map with error handling per account
        const contentEntries: Map<string, ContentEntry> = new Map();
        for (const { account } of contentAccounts) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const decoded = (program.account as any).contentEntry.coder.accounts.decode(
              "contentEntry",
              account.data
            );

            contentEntries.set(decoded.contentCid, {
              creator: decoded.creator,
              contentCid: decoded.contentCid,
              metadataCid: decoded.metadataCid,
              contentType: anchorToContentType(decoded.contentType),
              tipsReceived: BigInt(decoded.tipsReceived.toString()),
              createdAt: BigInt(decoded.createdAt.toString()),
              isLocked: decoded.isLocked ?? false,
              mintedCount: BigInt(decoded.mintedCount?.toString() || "0"),
              pendingCount: BigInt(decoded.pendingCount?.toString() || "0"),
              isEncrypted: decoded.isEncrypted ?? false,
              previewCid: decoded.previewCid ?? "",
              encryptionMetaCid: decoded.encryptionMetaCid ?? "",
            });
          } catch {
            // Skip accounts that fail to decode
          }
        }

        // Match mint configs with content entries
        for (const { account: mintConfig } of allMintConfigs) {
          for (const [cid, content] of contentEntries) {
            const [contentPda] = getContentPda(cid);
            if (contentPda.equals(mintConfig.content)) {
              // Anchor auto-converts to camelCase
              results.push({
                content,
                mintConfig: {
                  content: mintConfig.content,
                  creator: mintConfig.creator,
                  priceSol: BigInt(mintConfig.price.toString()),
                  maxSupply: mintConfig.maxSupply ? BigInt(mintConfig.maxSupply.toString()) : null,
                  creatorRoyaltyBps: mintConfig.creatorRoyaltyBps,
                  isActive: mintConfig.isActive,
                  createdAt: BigInt(mintConfig.createdAt.toString()),
                },
              });
              break;
            }
          }
        }

        return results.sort((a, b) => Number(b.content.createdAt - a.content.createdAt));
      } catch {
        return [];
      }
    },
  };
}

export const idl = idlJson;
