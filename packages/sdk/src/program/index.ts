// Re-export from modules
export * from "./constants";
export * from "./types";
export * from "./pda";

// Main program code
import { Program, Idl, BN } from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram, TransactionInstruction, Keypair, SYSVAR_RENT_PUBKEY, SYSVAR_SLOT_HASHES_PUBKEY } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, NATIVE_MINT } from "@solana/spl-token";
import idlJson from "./content_registry.json";

import {
  PROGRAM_ID,
  PROGRAM_ID_STRING,
  MPL_CORE_PROGRAM_ID,
  MAGICBLOCK_VRF_PROGRAM_ID,
  ContentType,
  PaymentCurrency,
  RentTier,
  getContentDomain,
  // Streamflow constants for CPI-based membership
  STREAMFLOW_PROGRAM_ID,
  STREAMFLOW_TREASURY,
  STREAMFLOW_WITHDRAWOR,
  STREAMFLOW_FEE_ORACLE,
  WSOL_MINT,
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
  MbMintRequest,
  MbBundleMintRequest,
  NftRarity,
  Rarity,
  parseAnchorRarity,
  Bundle,
  BundleItem,
  BundleType,
  BundleWithItems,
  BundleMintConfig,
  BundleRentConfig,
  BundleCollection,
  BundleRewardPool,
  BundleWalletState,
  BundleNftRarity,
  BundleNftRewardState,
  WalletBundleNftMetadata,
  // Subscription system types
  PatronTier,
  VisibilityLevel,
  parsePatronTier,
  UnifiedNftRewardState,
  CreatorPatronPool,
  GlobalHolderPool,
  CreatorDistPool,
  EcosystemEpochState,
  CreatorWeight,
  CreatorPatronConfig,
  CreatorPatronSubscription,
  EcosystemSubConfig,
  EcosystemSubscription,
  isSubscriptionValid,
  calculateSubscriptionPendingReward,
  UserProfile,
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
  getRentConfigPda,
  getRentEntryPda,
  getPendingMintPda,
  getMbMintRequestPda,
  getMbNftAssetPda,
  getMbBundleMintRequestPda,
  getMbBundleNftAssetPda,
  getBundlePda,
  getBundleItemPda,
  getBundleMintConfigPda,
  getBundleRentConfigPda,
  getBundleCollectionPda,
  getBundleRewardPoolPda,
  getBundleWalletStatePda,
  getBundleRentEntryPda,
  getBundleDirectNftPda,
  calculatePendingRewardForNft,
  calculateWeightedPendingReward,
  // Subscription system PDAs
  getUnifiedNftRewardStatePda,
  getCreatorPatronPoolPda,
  getCreatorPatronTreasuryPda,
  getCreatorPatronConfigPda,
  getCreatorPatronSubscriptionPda,
  getGlobalHolderPoolPda,
  getCreatorDistPoolPda,
  getEcosystemEpochStatePda,
  getCreatorWeightPda,
  getEcosystemStreamingTreasuryPda,
  getEcosystemSubConfigPda,
  getEcosystemSubscriptionPda,
  getSimpleNftPda,
  getSimpleBundleNftPda,
  getUserProfilePda,
  // Streamflow PDAs
  getStreamflowEscrowTokensPda,
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
  encryptionMetaCid: string = "",
  visibilityLevel: number = 0
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
      encryptionMetaCid,
      visibilityLevel
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
  encryptionMetaCid: string = "",
  visibilityLevel: number = 0,
  collectionName: string | null = null
): Promise<RegisterContentWithMintResult> {
  const cidHash = hashCid(contentCid);
  const [contentPda] = getContentPda(contentCid);
  const [cidRegistryPda] = getCidRegistryPda(contentCid);
  const [mintConfigPda] = getMintConfigPda(contentPda);
  const [contentCollectionPda] = getContentCollectionPda(contentPda);
  const [ecosystemConfigPda] = getEcosystemConfigPda();
  const [userProfilePda] = getUserProfilePda(authority);

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
      encryptionMetaCid,
      visibilityLevel,
      collectionName
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
      userProfile: userProfilePda,
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
  const [nftRewardStatePda] = getUnifiedNftRewardStatePda(nftAssetKeypair.publicKey);

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

// NOTE: VRF-BASED MINT functions removed - use simpleMintInstruction instead

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
    const [nftRewardStatePda] = getUnifiedNftRewardStatePda(nftAsset);
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
  const [nftRewardStatePda] = getUnifiedNftRewardStatePda(nftAsset);

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

// NOTE: MAGICBLOCK VRF MINT functions removed - use simpleMintInstruction instead

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
      visibilityLevel: decoded.visibilityLevel ?? 0,
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
      visibilityLevel: decoded.visibilityLevel ?? 0,
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
 * Batch fetch all bundle collections in a single RPC call.
 * Returns a Map keyed by bundle PDA base58 string.
 */
export async function fetchAllBundleCollections(
  connection: Connection
): Promise<Map<string, BundleCollection>> {
  const collections = new Map<string, BundleCollection>();
  try {
    const program = createProgram(connection);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allCollections = await (program.account as any).bundleCollection.all();

    for (const { account } of allCollections) {
      const bundleKey = account.bundle.toBase58();
      collections.set(bundleKey, {
        bundle: account.bundle,
        collectionAsset: account.collectionAsset,
        creator: account.creator,
        createdAt: BigInt(account.createdAt.toString()),
      });
    }
  } catch (err) {
    console.error("[fetchAllBundleCollections] Error:", err);
  }
  return collections;
}

/**
 * Batch fetch all bundle reward pools in a single RPC call.
 * Returns a Map keyed by bundle PDA base58 string.
 */
export async function fetchAllBundleRewardPools(
  connection: Connection
): Promise<Map<string, BundleRewardPool>> {
  const pools = new Map<string, BundleRewardPool>();
  try {
    const program = createProgram(connection);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allPools = await (program.account as any).bundleRewardPool.all();

    for (const { account } of allPools) {
      const bundleKey = account.bundle.toBase58();
      pools.set(bundleKey, {
        bundle: account.bundle,
        rewardPerShare: BigInt(account.rewardPerShare.toString()),
        totalNfts: BigInt(account.totalNfts.toString()),
        totalWeight: BigInt(account.totalWeight?.toString() || "0"),
        totalDeposited: BigInt(account.totalDeposited.toString()),
        totalClaimed: BigInt(account.totalClaimed.toString()),
        createdAt: BigInt(account.createdAt.toString()),
      });
    }
  } catch (err) {
    console.error("[fetchAllBundleRewardPools] Error:", err);
  }
  return pools;
}

/**
 * Batch fetch bundle NFT reward states for multiple NFT assets using getMultipleAccountsInfo.
 * Returns a Map keyed by NFT asset base58 string.
 */
export async function fetchBundleNftRewardStatesBatch(
  connection: Connection,
  nftAssets: PublicKey[]
): Promise<Map<string, BundleNftRewardState>> {
  const states = new Map<string, BundleNftRewardState>();
  if (nftAssets.length === 0) return states;

  try {
    const program = createProgram(connection);
    const nftRewardStatePdas = nftAssets.map(nft => getUnifiedNftRewardStatePda(nft)[0]);

    // Batch fetch all accounts in a single RPC call
    const accounts = await connection.getMultipleAccountsInfo(nftRewardStatePdas);

    for (let i = 0; i < nftAssets.length; i++) {
      const accountInfo = accounts[i];
      const nftAssetKey = nftAssets[i].toBase58();
      if (accountInfo) {
        try {
          // Decode the account data using Anchor - now uses UnifiedNftRewardState (simple_mint)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const decoded = (program.account as any).unifiedNftRewardState.coder.accounts.decode(
            "unifiedNftRewardState",
            accountInfo.data
          );

          // Map UnifiedNftRewardState to BundleNftRewardState format for backwards compatibility
          states.set(nftAssetKey, {
            nftAsset: decoded.nftAsset,
            bundle: decoded.contentOrBundle, // UnifiedNftRewardState uses contentOrBundle
            rewardDebt: BigInt(decoded.contentOrBundleDebt?.toString() || "0"),
            weight: decoded.weight || 100,
            createdAt: BigInt(decoded.createdAt.toString()),
          });
        } catch (decodeErr) {
          // Log decode errors for debugging
          console.warn(`[fetchBundleNftRewardStatesBatch] Failed to decode state for ${nftAssetKey}:`, decodeErr);
        }
      } else {
        // Log when account doesn't exist
        console.warn(`[fetchBundleNftRewardStatesBatch] No account found for NFT ${nftAssetKey}, PDA: ${nftRewardStatePdas[i].toBase58()}`);
      }
    }
  } catch (err) {
    console.error("[fetchBundleNftRewardStatesBatch] Error:", err);
  }
  return states;
}

/**
 * Bundle pending reward info
 */
export interface BundlePendingReward {
  bundleId: string;
  creator: PublicKey;
  pending: bigint;
  nftCount: bigint;
  nftRewards: Array<{
    nftAsset: PublicKey;
    pending: bigint;
    rewardDebt: bigint;
    weight: number;
    createdAt: bigint;
  }>;
}

/**
 * Optimized pending rewards calculation for bundles.
 * Similar to getPendingRewardsOptimized but for bundle NFTs.
 */
export async function getBundlePendingRewardsOptimized(
  connection: Connection,
  wallet: PublicKey,
  walletBundleNfts: WalletBundleNftMetadata[],
  bundleRewardPools: Map<string, BundleRewardPool>,
  bundleCollections: Map<string, BundleCollection>
): Promise<BundlePendingReward[]> {
  const results: BundlePendingReward[] = [];

  // Group NFTs by bundleId + creator
  const nftsByBundle = new Map<string, { bundleId: string; creator: PublicKey; nfts: WalletBundleNftMetadata[] }>();
  for (const nft of walletBundleNfts) {
    if (nft.bundleId && nft.creator) {
      const key = `${nft.creator.toBase58()}-${nft.bundleId}`;
      const existing = nftsByBundle.get(key) || { bundleId: nft.bundleId, creator: nft.creator, nfts: [] };
      existing.nfts.push(nft);
      nftsByBundle.set(key, existing);
    }
  }

  // Get all NFT assets that need reward state lookup
  const allNftAssets: PublicKey[] = [];
  for (const { nfts } of nftsByBundle.values()) {
    for (const nft of nfts) {
      allNftAssets.push(nft.nftAsset);
    }
  }

  // Batch fetch all bundle NFT reward states in a single call
  const nftRewardStates = await fetchBundleNftRewardStatesBatch(connection, allNftAssets);

  // Calculate pending rewards for each bundle
  for (const [, { bundleId, creator, nfts }] of nftsByBundle) {
    const [bundlePda] = getBundlePda(creator, bundleId);
    const bundleKey = bundlePda.toBase58();

    const rewardPool = bundleRewardPools.get(bundleKey);
    if (!rewardPool) {
      results.push({ bundleId, creator, pending: BigInt(0), nftCount: BigInt(nfts.length), nftRewards: [] });
      continue;
    }

    let totalPending = BigInt(0);
    const nftRewards: Array<{ nftAsset: PublicKey; pending: bigint; rewardDebt: bigint; weight: number; createdAt: bigint }> = [];

    for (const nft of nfts) {
      const nftRewardState = nftRewardStates.get(nft.nftAsset.toBase58());
      if (nftRewardState) {
        // pending = (weight * rewardPerShare - nftRewardDebt) / PRECISION
        const pending = calculateWeightedPendingReward(
          nftRewardState.weight,
          rewardPool.rewardPerShare,
          nftRewardState.rewardDebt
        );
        totalPending += pending;
        nftRewards.push({
          nftAsset: nft.nftAsset,
          pending,
          rewardDebt: nftRewardState.rewardDebt,
          weight: nftRewardState.weight,
          createdAt: nftRewardState.createdAt,
        });
      }
    }

    // Sort by createdAt (mint sequence)
    nftRewards.sort((a, b) => Number(a.createdAt - b.createdAt));

    results.push({
      bundleId,
      creator,
      pending: totalPending,
      nftCount: BigInt(nfts.length),
      nftRewards,
    });
  }

  return results;
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
    const nftRewardStatePdas = nftAssets.map(nft => getUnifiedNftRewardStatePda(nft)[0]);

    // Batch fetch all accounts in a single RPC call
    const accounts = await connection.getMultipleAccountsInfo(nftRewardStatePdas);

    for (let i = 0; i < nftAssets.length; i++) {
      const accountInfo = accounts[i];
      if (accountInfo) {
        try {
          // Decode the account data using Anchor - now uses UnifiedNftRewardState (simple_mint)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const decoded = (program.account as any).unifiedNftRewardState.coder.accounts.decode(
            "unifiedNftRewardState",
            accountInfo.data
          );

          // Map UnifiedNftRewardState to NftRewardState format for backwards compatibility
          states.set(nftAssets[i].toBase58(), {
            nftAsset: decoded.nftAsset,
            content: decoded.contentOrBundle, // UnifiedNftRewardState uses contentOrBundle
            rewardDebt: BigInt(decoded.contentOrBundleDebt?.toString() || "0"),
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
    const [nftRewardStatePda] = getUnifiedNftRewardStatePda(nftAsset);

    // Use program.account.<name>.fetch() - now uses UnifiedNftRewardState (simple_mint)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decoded = await (program.account as any).unifiedNftRewardState.fetch(nftRewardStatePda);

    // Map UnifiedNftRewardState to NftRewardState format for backwards compatibility
    return {
      nftAsset: decoded.nftAsset,
      content: decoded.contentOrBundle, // UnifiedNftRewardState uses contentOrBundle
      rewardDebt: BigInt(decoded.contentOrBundleDebt?.toString() || "0"),
      weight: decoded.weight || 100,
      createdAt: BigInt(decoded.createdAt.toString()),
    };
  } catch {
    return null;
  }
}

// NOTE: fetchNftRarity and fetchNftRaritiesBatch removed - rarity data is now in UnifiedNftRewardState

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

export async function fetchMbMintRequest(
  connection: Connection,
  buyer: PublicKey,
  contentCid: string,
  edition: bigint
): Promise<MbMintRequest | null> {
  try {
    const program = createProgram(connection);
    const [contentPda] = getContentPda(contentCid);
    const [mintRequestPda] = getMbMintRequestPda(buyer, contentPda, edition);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decoded = await (program.account as any).magicBlockMintRequest.fetch(mintRequestPda);

    return {
      buyer: decoded.buyer,
      content: decoded.content,
      creator: decoded.creator,
      amountPaid: BigInt(decoded.amountPaid.toString()),
      createdAt: BigInt(decoded.createdAt.toString()),
      hadExistingNfts: decoded.hadExistingNfts ?? false,
      bump: decoded.bump,
      nftBump: decoded.nftBump,
      isFulfilled: decoded.isFulfilled ?? false,
      collectionAsset: decoded.collectionAsset,
      treasury: decoded.treasury,
      platform: decoded.platform,
      contentCollectionBump: decoded.contentCollectionBump,
      metadataCid: decoded.metadataCid,
      mintedCount: BigInt(decoded.mintedCount.toString()),
      edition: BigInt(decoded.edition?.toString() ?? "0"),
    };
  } catch {
    return null;
  }
}

/**
 * Fetch MagicBlock bundle mint request by PDA
 */
export async function fetchMbBundleMintRequest(
  connection: Connection,
  buyer: PublicKey,
  bundleId: string,
  creator: PublicKey,
  edition: bigint
): Promise<MbBundleMintRequest | null> {
  try {
    const program = createProgram(connection);
    const [bundlePda] = getBundlePda(creator, bundleId);
    const [mintRequestPda] = getMbBundleMintRequestPda(buyer, bundlePda, edition);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decoded = await (program.account as any).magicBlockBundleMintRequest.fetch(mintRequestPda);

    return {
      buyer: decoded.buyer,
      bundle: decoded.bundle,
      creator: decoded.creator,
      amountPaid: BigInt(decoded.amountPaid.toString()),
      createdAt: BigInt(decoded.createdAt.toString()),
      hadExistingNfts: decoded.hadExistingNfts ?? false,
      bump: decoded.bump,
      nftBump: decoded.nftBump,
      isFulfilled: decoded.isFulfilled ?? false,
      collectionAsset: decoded.collectionAsset,
      treasury: decoded.treasury,
      platform: decoded.platform,
      bundleCollectionBump: decoded.bundleCollectionBump,
      metadataCid: decoded.metadataCid,
      mintedCount: BigInt(decoded.mintedCount.toString()),
      edition: BigInt(decoded.edition?.toString() ?? "0"),
    };
  } catch {
    return null;
  }
}

/**
 * Find all unfulfilled MagicBlock bundle mint requests for a wallet and bundle
 * Searches through possible editions to find pending requests
 */
export async function findPendingBundleMintRequests(
  connection: Connection,
  buyer: PublicKey,
  bundleId: string,
  creator: PublicKey,
  maxEditionToCheck: bigint
): Promise<Array<{ edition: bigint; mintRequest: MbBundleMintRequest; mintRequestPda: PublicKey; nftAssetPda: PublicKey }>> {
  const results: Array<{ edition: bigint; mintRequest: MbBundleMintRequest; mintRequestPda: PublicKey; nftAssetPda: PublicKey }> = [];
  const [bundlePda] = getBundlePda(creator, bundleId);

  for (let i = BigInt(1); i <= maxEditionToCheck; i++) {
    try {
      const mintRequest = await fetchMbBundleMintRequest(connection, buyer, bundleId, creator, i);
      if (mintRequest && !mintRequest.isFulfilled) {
        const [mintRequestPda] = getMbBundleMintRequestPda(buyer, bundlePda, i);
        const [nftAssetPda] = getMbBundleNftAssetPda(mintRequestPda);
        results.push({
          edition: i,
          mintRequest,
          mintRequestPda,
          nftAssetPda,
        });
      }
    } catch {
      // No mint request for this edition, continue
    }
  }

  return results;
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
      // pending = (weight * rewardPerShare - nftRewardDebt) / PRECISION
      const pending = calculateWeightedPendingReward(
        nftRewardState.weight,
        rewardPool.rewardPerShare,
        nftRewardState.rewardDebt
      );
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
): Promise<Array<{ contentCid: string; pending: bigint; nftCount: bigint; nftRewards: Array<{ nftAsset: PublicKey; pending: bigint; rewardDebt: bigint; weight: number; createdAt: bigint }> }>> {
  const results: Array<{ contentCid: string; pending: bigint; nftCount: bigint; nftRewards: Array<{ nftAsset: PublicKey; pending: bigint; rewardDebt: bigint; weight: number; createdAt: bigint }> }> = [];

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
    const nftRewards: Array<{ nftAsset: PublicKey; pending: bigint; rewardDebt: bigint; weight: number; createdAt: bigint }> = [];

    for (const nftAsset of nftAssets) {
      const nftRewardState = await fetchNftRewardState(connection, nftAsset);
      if (nftRewardState) {
        // pending = (weight * rewardPerShare - nftRewardDebt) / PRECISION
        const pending = calculateWeightedPendingReward(
          nftRewardState.weight,
          rewardPool.rewardPerShare,
          nftRewardState.rewardDebt
        );
        totalPending += pending;
        nftRewards.push({
          nftAsset,
          pending,
          rewardDebt: nftRewardState.rewardDebt,
          weight: nftRewardState.weight,
          createdAt: nftRewardState.createdAt
        });
      }
    }

    // Sort by createdAt (mint sequence)
    nftRewards.sort((a, b) => Number(a.createdAt - b.createdAt));

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
): Promise<Array<{ contentCid: string; pending: bigint; nftCount: bigint; nftRewards: Array<{ nftAsset: PublicKey; pending: bigint; rewardDebt: bigint; weight: number; createdAt: bigint }> }>> {
  const results: Array<{ contentCid: string; pending: bigint; nftCount: bigint; nftRewards: Array<{ nftAsset: PublicKey; pending: bigint; rewardDebt: bigint; weight: number; createdAt: bigint }> }> = [];

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
    const nftRewards: Array<{ nftAsset: PublicKey; pending: bigint; rewardDebt: bigint; weight: number; createdAt: bigint }> = [];

    for (const nft of nfts) {
      const nftRewardState = nftRewardStates.get(nft.nftAsset.toBase58());
      if (nftRewardState) {
        // pending = (weight * rewardPerShare - nftRewardDebt) / PRECISION
        const pending = calculateWeightedPendingReward(
          nftRewardState.weight,
          rewardPool.rewardPerShare,
          nftRewardState.rewardDebt
        );
        totalPending += pending;
        nftRewards.push({
          nftAsset: nft.nftAsset,
          pending,
          rewardDebt: nftRewardState.rewardDebt,
          weight: nftRewardState.weight,
          createdAt: nftRewardState.createdAt
        });
      }
    }

    // Sort by createdAt (mint sequence)
    nftRewards.sort((a, b) => Number(a.createdAt - b.createdAt));

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

/**
 * Fetch all bundle NFTs owned by a wallet.
 * Similar to fetchWalletNftMetadata but for bundles.
 */
export async function fetchWalletBundleNftMetadata(
  connection: Connection,
  wallet: PublicKey
): Promise<WalletBundleNftMetadata[]> {
  // Fetch bundle collections and bundle entries once upfront
  const bundleCollections = await fetchAllBundleCollections(connection);
  const program = createProgram(connection);

  // Fetch bundle entries using getProgramAccounts with manual decoding
  const bundleAccounts = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [
      // Filter by Bundle discriminator (sha256("account:Bundle")[0..8])
      { memcmp: { offset: 0, bytes: "3ZemDneRrKh" } }, // base58 of Bundle discriminator
    ],
  });

  const allBundleEntries: Array<{ bundleId: string; creator: PublicKey; bundlePda: PublicKey }> = [];
  for (const { pubkey, account } of bundleAccounts) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const decoded = (program.account as any).bundle.coder.accounts.decode(
        "bundle",
        account.data
      );
      allBundleEntries.push({
        bundleId: decoded.bundleId,
        creator: decoded.creator,
        bundlePda: pubkey,
      });
    } catch {
      // Skip accounts that fail to decode
    }
  }

  // Build a map from collectionAsset -> { bundleId, creator } for quick lookup
  const collectionToBundleInfo = new Map<string, { bundleId: string; creator: PublicKey }>();
  for (const collection of bundleCollections.values()) {
    // Find the bundle entry for this collection
    for (const entry of allBundleEntries) {
      if (collection.bundle.equals(entry.bundlePda)) {
        collectionToBundleInfo.set(collection.collectionAsset.toBase58(), {
          bundleId: entry.bundleId,
          creator: entry.creator,
        });
        break;
      }
    }
  }

  return fetchWalletBundleNftMetadataWithCollections(connection, wallet, collectionToBundleInfo);
}

/**
 * Optimized version that accepts pre-built collection->bundleInfo map.
 * This avoids re-fetching collections for each NFT.
 */
export async function fetchWalletBundleNftMetadataWithCollections(
  connection: Connection,
  wallet: PublicKey,
  collectionToBundleInfo: Map<string, { bundleId: string; creator: PublicKey }>
): Promise<WalletBundleNftMetadata[]> {
  try {
    const accounts = await connection.getProgramAccounts(MPL_CORE_PROGRAM_ID, {
      filters: [
        { memcmp: { offset: 1, bytes: wallet.toBase58() } },
      ],
    });

    const results: WalletBundleNftMetadata[] = [];

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
        const bundleInfo = collectionAsset
          ? collectionToBundleInfo.get(collectionAsset.toBase58()) || null
          : null;

        // Only include NFTs that belong to Handcraft bundle collections
        if (bundleInfo) {
          results.push({
            nftAsset: pubkey,
            bundleId: bundleInfo.bundleId,
            creator: bundleInfo.creator,
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
// BUNDLE MANAGEMENT
// ============================================

/**
 * Convert BundleType enum to Anchor format
 */
function bundleTypeToAnchor(type: BundleType): object {
  switch (type) {
    case BundleType.Album: return { album: {} };
    case BundleType.Series: return { series: {} };
    case BundleType.Playlist: return { playlist: {} };
    case BundleType.Course: return { course: {} };
    case BundleType.Newsletter: return { newsletter: {} };
    case BundleType.Collection: return { collection: {} };
    case BundleType.ProductPack: return { productPack: {} };
    default: return { collection: {} };
  }
}

/**
 * Convert Anchor bundle type to BundleType enum
 */
function anchorToBundleType(anchorType: object): BundleType {
  if ("album" in anchorType) return BundleType.Album;
  if ("series" in anchorType) return BundleType.Series;
  if ("playlist" in anchorType) return BundleType.Playlist;
  if ("course" in anchorType) return BundleType.Course;
  if ("newsletter" in anchorType) return BundleType.Newsletter;
  if ("collection" in anchorType) return BundleType.Collection;
  if ("productPack" in anchorType) return BundleType.ProductPack;
  return BundleType.Collection;
}

/**
 * Create a new bundle
 */
export async function createBundleInstruction(
  program: Program,
  creator: PublicKey,
  bundleId: string,
  metadataCid: string,
  bundleType: BundleType
): Promise<TransactionInstruction> {
  const [bundlePda] = getBundlePda(creator, bundleId);

  return await program.methods
    .createBundle(bundleId, metadataCid, bundleTypeToAnchor(bundleType))
    .accounts({
      creator,
      bundle: bundlePda,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export interface CreateBundleWithMintAndRentResult {
  instruction: TransactionInstruction;
  collectionAsset: PublicKey;
  collectionAssetKeypair: Keypair;
}

/**
 * Create a bundle with mint and rent configuration in a single transaction
 * This is the recommended way to create bundles - single signature flow
 */
export async function createBundleWithMintAndRentInstruction(
  program: Program,
  creator: PublicKey,
  bundleId: string,
  metadataCid: string,
  bundleType: BundleType,
  mintPrice: bigint,
  mintMaxSupply: bigint | null,
  creatorRoyaltyBps: number,
  rentFee6h: bigint,
  rentFee1d: bigint,
  rentFee7d: bigint,
  platform: PublicKey,
  collectionName: string | null = null
): Promise<CreateBundleWithMintAndRentResult> {
  const [bundlePda] = getBundlePda(creator, bundleId);
  const [mintConfigPda] = getBundleMintConfigPda(bundlePda);
  const [rentConfigPda] = getBundleRentConfigPda(bundlePda);
  const [bundleCollectionPda] = getBundleCollectionPda(bundlePda);
  const [ecosystemConfigPda] = getEcosystemConfigPda();
  const [userProfilePda] = getUserProfilePda(creator);
  const collectionAsset = Keypair.generate();

  const instruction = await program.methods
    .createBundleWithMintAndRent(
      bundleId,
      metadataCid,
      bundleTypeToAnchor(bundleType),
      new BN(mintPrice.toString()),
      mintMaxSupply !== null ? new BN(mintMaxSupply.toString()) : null,
      creatorRoyaltyBps,
      new BN(rentFee6h.toString()),
      new BN(rentFee1d.toString()),
      new BN(rentFee7d.toString()),
      collectionName
    )
    .accounts({
      creator,
      bundle: bundlePda,
      mintConfig: mintConfigPda,
      rentConfig: rentConfigPda,
      bundleCollection: bundleCollectionPda,
      collectionAsset: collectionAsset.publicKey,
      ecosystemConfig: ecosystemConfigPda,
      platform,
      userProfile: userProfilePda,
      mplCoreProgram: MPL_CORE_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  return {
    instruction,
    collectionAsset: collectionAsset.publicKey,
    collectionAssetKeypair: collectionAsset,
  };
}

/**
 * Add content to a bundle
 */
export async function addBundleItemInstruction(
  program: Program,
  creator: PublicKey,
  bundleId: string,
  contentCid: string,
  position?: number
): Promise<TransactionInstruction> {
  const [bundlePda] = getBundlePda(creator, bundleId);
  const [contentPda] = getContentPda(contentCid);
  const [bundleItemPda] = getBundleItemPda(bundlePda, contentPda);

  return await program.methods
    .addBundleItem(position !== undefined ? position : null)
    .accounts({
      creator,
      bundle: bundlePda,
      content: contentPda,
      bundleItem: bundleItemPda,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

/**
 * Remove content from a bundle
 */
export async function removeBundleItemInstruction(
  program: Program,
  creator: PublicKey,
  bundleId: string,
  contentCid: string
): Promise<TransactionInstruction> {
  const [bundlePda] = getBundlePda(creator, bundleId);
  const [contentPda] = getContentPda(contentCid);
  const [bundleItemPda] = getBundleItemPda(bundlePda, contentPda);

  return await program.methods
    .removeBundleItem()
    .accounts({
      creator,
      bundle: bundlePda,
      bundleItem: bundleItemPda,
    })
    .instruction();
}

/**
 * Update bundle metadata or status
 */
export async function updateBundleInstruction(
  program: Program,
  creator: PublicKey,
  bundleId: string,
  metadataCid?: string,
  isActive?: boolean
): Promise<TransactionInstruction> {
  const [bundlePda] = getBundlePda(creator, bundleId);

  return await program.methods
    .updateBundle(metadataCid ?? null, isActive ?? null)
    .accounts({
      creator,
      bundle: bundlePda,
    })
    .instruction();
}

/**
 * Delete an empty bundle
 */
export async function deleteBundleInstruction(
  program: Program,
  creator: PublicKey,
  bundleId: string
): Promise<TransactionInstruction> {
  const [bundlePda] = getBundlePda(creator, bundleId);

  return await program.methods
    .deleteBundle()
    .accounts({
      creator,
      bundle: bundlePda,
    })
    .instruction();
}

/**
 * Fetch a bundle by creator and bundle ID
 */
export async function fetchBundle(
  connection: Connection,
  creator: PublicKey,
  bundleId: string
): Promise<Bundle | null> {
  try {
    const program = createProgram(connection);
    const [bundlePda] = getBundlePda(creator, bundleId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decoded = await (program.account as any).bundle.fetch(bundlePda);

    return {
      creator: decoded.creator,
      bundleId: decoded.bundleId,
      metadataCid: decoded.metadataCid,
      bundleType: anchorToBundleType(decoded.bundleType),
      itemCount: decoded.itemCount,
      isActive: decoded.isActive,
      createdAt: BigInt(decoded.createdAt.toString()),
      updatedAt: BigInt(decoded.updatedAt.toString()),
      mintedCount: BigInt(decoded.mintedCount?.toString() || "0"),
      pendingCount: BigInt(decoded.pendingCount?.toString() || "0"),
      isLocked: decoded.isLocked ?? false,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch a bundle by PDA
 */
export async function fetchBundleByPda(
  connection: Connection,
  bundlePda: PublicKey
): Promise<Bundle | null> {
  try {
    const program = createProgram(connection);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decoded = await (program.account as any).bundle.fetch(bundlePda);

    return {
      creator: decoded.creator,
      bundleId: decoded.bundleId,
      metadataCid: decoded.metadataCid,
      bundleType: anchorToBundleType(decoded.bundleType),
      itemCount: decoded.itemCount,
      isActive: decoded.isActive,
      createdAt: BigInt(decoded.createdAt.toString()),
      updatedAt: BigInt(decoded.updatedAt.toString()),
      mintedCount: BigInt(decoded.mintedCount?.toString() || "0"),
      pendingCount: BigInt(decoded.pendingCount?.toString() || "0"),
      isLocked: decoded.isLocked ?? false,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch all bundles (global feed)
 */
export async function fetchAllBundles(
  connection: Connection
): Promise<Bundle[]> {
  try {
    const program = createProgram(connection);

    // Fetch all bundle accounts (no filter - we filter in JS)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accounts = await (program.account as any).bundle.all();

    // Filter to only active bundles and sort by createdAt descending
    const bundles = accounts
      .map((acc: { account: Record<string, unknown> }) => ({
        creator: acc.account.creator as PublicKey,
        bundleId: acc.account.bundleId as string,
        metadataCid: acc.account.metadataCid as string,
        bundleType: anchorToBundleType(acc.account.bundleType as object),
        itemCount: acc.account.itemCount as number,
        isActive: acc.account.isActive as boolean,
        createdAt: BigInt((acc.account.createdAt as { toString(): string }).toString()),
        updatedAt: BigInt((acc.account.updatedAt as { toString(): string }).toString()),
        mintedCount: BigInt((acc.account.mintedCount as { toString(): string })?.toString() || "0"),
        pendingCount: BigInt((acc.account.pendingCount as { toString(): string })?.toString() || "0"),
        isLocked: (acc.account.isLocked as boolean) ?? false,
      }))
      .filter((b: Bundle) => b.isActive)
      .sort((a: Bundle, b: Bundle) => Number(b.createdAt - a.createdAt));

    return bundles;
  } catch {
    return [];
  }
}

/**
 * Fetch all bundles created by a wallet
 */
export async function fetchBundlesByCreator(
  connection: Connection,
  creator: PublicKey
): Promise<Bundle[]> {
  try {
    const program = createProgram(connection);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accounts = await (program.account as any).bundle.all([
      {
        memcmp: {
          offset: 8, // After discriminator
          bytes: creator.toBase58(),
        },
      },
    ]);

    return accounts.map((acc: { account: Record<string, unknown> }) => ({
      creator: acc.account.creator as PublicKey,
      bundleId: acc.account.bundleId as string,
      metadataCid: acc.account.metadataCid as string,
      bundleType: anchorToBundleType(acc.account.bundleType as object),
      itemCount: acc.account.itemCount as number,
      isActive: acc.account.isActive as boolean,
      createdAt: BigInt((acc.account.createdAt as { toString(): string }).toString()),
      updatedAt: BigInt((acc.account.updatedAt as { toString(): string }).toString()),
      mintedCount: BigInt((acc.account.mintedCount as { toString(): string })?.toString() || "0"),
      pendingCount: BigInt((acc.account.pendingCount as { toString(): string })?.toString() || "0"),
      isLocked: (acc.account.isLocked as boolean) ?? false,
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch all items in a bundle
 */
export async function fetchBundleItems(
  connection: Connection,
  creator: PublicKey,
  bundleId: string
): Promise<BundleItem[]> {
  try {
    const program = createProgram(connection);
    const [bundlePda] = getBundlePda(creator, bundleId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accounts = await (program.account as any).bundleItem.all([
      {
        memcmp: {
          offset: 8, // After discriminator
          bytes: bundlePda.toBase58(),
        },
      },
    ]);

    return accounts
      .map((acc: { account: Record<string, unknown> }) => ({
        bundle: acc.account.bundle as PublicKey,
        content: acc.account.content as PublicKey,
        position: acc.account.position as number,
        addedAt: BigInt((acc.account.addedAt as { toString(): string }).toString()),
      }))
      .sort((a: BundleItem, b: BundleItem) => a.position - b.position);
  } catch {
    return [];
  }
}

/**
 * Find all bundles that contain a specific content
 * Returns bundle info with metadata for each bundle containing this content
 */
export async function findBundlesForContent(
  connection: Connection,
  contentCid: string
): Promise<Array<{ bundle: Bundle; bundleId: string; creator: PublicKey; position: number }>> {
  try {
    const program = createProgram(connection);
    const [contentPda] = getContentPda(contentCid);

    // Fetch all bundle items that reference this content
    // BundleItem layout: discriminator (8) + bundle (32) + content (32) + position (2) + addedAt (8)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bundleItemAccounts = await (program.account as any).bundleItem.all([
      {
        memcmp: {
          offset: 8 + 32, // After discriminator + bundle pubkey
          bytes: contentPda.toBase58(),
        },
      },
    ]);

    if (bundleItemAccounts.length === 0) return [];

    // Fetch bundle details for each bundle item
    const results: Array<{ bundle: Bundle; bundleId: string; creator: PublicKey; position: number }> = [];

    for (const { account } of bundleItemAccounts) {
      const bundlePda = account.bundle as PublicKey;
      const position = account.position as number;

      try {
        const bundle = await fetchBundleByPda(connection, bundlePda);
        if (bundle) {
          results.push({
            bundle,
            bundleId: bundle.bundleId,
            creator: bundle.creator,
            position,
          });
        }
      } catch {
        // Skip if bundle fetch fails
      }
    }

    return results;
  } catch {
    return [];
  }
}

/**
 * Batch find bundles for multiple content CIDs
 * Only fetches the specific bundles referenced by content items (scalable)
 */
export async function findBundlesForContentBatch(
  connection: Connection,
  contentCids: string[]
): Promise<Map<string, Array<{ bundleId: string; creator: PublicKey; bundleName?: string }>>> {
  const result = new Map<string, Array<{ bundleId: string; creator: PublicKey; bundleName?: string }>>();
  if (contentCids.length === 0) return result;

  try {
    const program = createProgram(connection);

    // Fetch ALL bundle items at once (this scales with number of bundle items, not bundles)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allBundleItems = await (program.account as any).bundleItem.all();

    // Build content PDA -> CID map for quick lookup
    const contentPdaToCid = new Map<string, string>();
    for (const cid of contentCids) {
      const [contentPda] = getContentPda(cid);
      contentPdaToCid.set(contentPda.toBase58(), cid);
    }

    // Group bundle items by content and collect unique bundle PDAs
    const contentToBundlePdas = new Map<string, PublicKey[]>();
    const uniqueBundlePdas = new Set<string>();

    for (const { account } of allBundleItems) {
      const contentKey = (account.content as PublicKey).toBase58();
      const cid = contentPdaToCid.get(contentKey);
      if (cid) {
        const bundlePda = account.bundle as PublicKey;
        const existing = contentToBundlePdas.get(cid) || [];
        existing.push(bundlePda);
        contentToBundlePdas.set(cid, existing);
        uniqueBundlePdas.add(bundlePda.toBase58());
      }
    }

    // Only fetch the bundles we actually need (not all bundles!)
    if (uniqueBundlePdas.size === 0) return result;

    const bundlePdasToFetch = Array.from(uniqueBundlePdas).map(s => new PublicKey(s));
    const bundleAccounts = await connection.getMultipleAccountsInfo(bundlePdasToFetch);

    // Decode bundle accounts
    const bundlePdaToBundle = new Map<string, Bundle>();
    for (let i = 0; i < bundlePdasToFetch.length; i++) {
      const accountInfo = bundleAccounts[i];
      if (!accountInfo) continue;

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const decoded = (program.account as any).bundle.coder.accounts.decode(
          "bundle",
          accountInfo.data
        );
        bundlePdaToBundle.set(bundlePdasToFetch[i].toBase58(), {
          creator: decoded.creator,
          bundleId: decoded.bundleId,
          metadataCid: decoded.metadataCid,
          bundleType: decoded.bundleType,
          itemCount: decoded.itemCount,
          isActive: decoded.isActive,
          createdAt: BigInt(decoded.createdAt.toString()),
          updatedAt: BigInt(decoded.updatedAt.toString()),
          mintedCount: BigInt(decoded.mintedCount?.toString() || "0"),
          pendingCount: BigInt(decoded.pendingCount?.toString() || "0"),
          isLocked: decoded.isLocked ?? false,
        });
      } catch {
        // Skip invalid accounts
      }
    }

    // Build result map
    for (const [cid, bundlePdas] of contentToBundlePdas) {
      const bundles: Array<{ bundleId: string; creator: PublicKey; bundleName?: string }> = [];
      for (const bundlePda of bundlePdas) {
        const bundle = bundlePdaToBundle.get(bundlePda.toBase58());
        if (bundle) {
          bundles.push({
            bundleId: bundle.bundleId,
            creator: bundle.creator,
          });
        }
      }
      if (bundles.length > 0) {
        result.set(cid, bundles);
      }
    }

    return result;
  } catch {
    return result;
  }
}

/**
 * Fetch bundle with all items and their content details
 */
export async function fetchBundleWithItems(
  connection: Connection,
  creator: PublicKey,
  bundleId: string
): Promise<BundleWithItems | null> {
  try {
    const bundle = await fetchBundle(connection, creator, bundleId);
    if (!bundle) return null;

    const items = await fetchBundleItems(connection, creator, bundleId);

    // Fetch content for each item
    const itemsWithContent = await Promise.all(
      items.map(async (item) => {
        const content = await fetchContentByPda(connection, item.content);
        return {
          item,
          content,
          contentMetadata: null as Record<string, unknown> | null,
        };
      })
    );

    return {
      bundle,
      metadata: null, // Caller can fetch from IPFS separately
      items: itemsWithContent,
    };
  } catch {
    return null;
  }
}

// ============================================
// BUNDLE MINT/RENT INSTRUCTIONS & TYPES
// ============================================

// NOTE: DirectMintBundleResult removed - use SimpleMintResult instead

export interface RentBundleResult {
  instruction: TransactionInstruction;
  nftAsset: PublicKey;
  nftAssetKeypair: Keypair;
  rentEntryPda: PublicKey;
}

export interface ConfigureBundleMintResult {
  instruction: TransactionInstruction;
  collectionAsset: PublicKey;
  collectionAssetKeypair: Keypair;
}

/**
 * Configure minting for a bundle (creates collection)
 */
export async function configureBundleMintInstruction(
  program: Program,
  creator: PublicKey,
  bundleId: string,
  price: bigint,
  maxSupply: bigint | null,
  creatorRoyaltyBps: number,
  platform: PublicKey
): Promise<ConfigureBundleMintResult> {
  const [bundlePda] = getBundlePda(creator, bundleId);
  const [mintConfigPda] = getBundleMintConfigPda(bundlePda);
  const [bundleCollectionPda] = getBundleCollectionPda(bundlePda);
  const [ecosystemConfigPda] = getEcosystemConfigPda();
  const collectionAsset = Keypair.generate();

  const instruction = await program.methods
    .configureBundleMint(
      new BN(price.toString()),
      maxSupply !== null ? new BN(maxSupply.toString()) : null,
      creatorRoyaltyBps
    )
    .accounts({
      creator,
      bundle: bundlePda,
      mintConfig: mintConfigPda,
      bundleCollection: bundleCollectionPda,
      collectionAsset: collectionAsset.publicKey,
      ecosystemConfig: ecosystemConfigPda,
      platform,
      mplCoreProgram: MPL_CORE_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  return {
    instruction,
    collectionAsset: collectionAsset.publicKey,
    collectionAssetKeypair: collectionAsset,
  };
}

/**
 * Update bundle mint settings
 */
export async function updateBundleMintSettingsInstruction(
  program: Program,
  creator: PublicKey,
  bundleId: string,
  price: bigint | null,
  maxSupply: bigint | null | undefined,
  creatorRoyaltyBps: number | null,
  isActive: boolean | null
): Promise<TransactionInstruction> {
  const [bundlePda] = getBundlePda(creator, bundleId);
  const [mintConfigPda] = getBundleMintConfigPda(bundlePda);

  // For Option<Option<u64>> in Anchor:
  // - undefined/null → None (don't change the field)
  // - explicitly pass null wrapped → Some(None) (set to unlimited)
  // - BN value → Some(Some(value)) (set to specific value)
  // Since we're using null to mean "don't change", we pass null directly
  const maxSupplyArg = maxSupply === undefined || maxSupply === null
    ? null  // Don't change
    : new BN(maxSupply.toString());  // Set to specific value

  return await program.methods
    .updateBundleMintSettings(
      price !== null ? new BN(price.toString()) : null,
      maxSupplyArg,
      creatorRoyaltyBps,
      isActive
    )
    .accounts({
      creator,
      bundle: bundlePda,
      mintConfig: mintConfigPda,
    })
    .instruction();
}

// NOTE: directMintBundleInstruction removed - use simpleMintBundleInstruction instead

// ============================================
// SIMPLE MINT - Unified mint with subscription pool tracking
// ============================================

export interface SimpleMintResult {
  instruction: TransactionInstruction;
  nftAsset: PublicKey;
  edition: bigint;
}

/**
 * Simple mint content NFT with slot hash randomness + full subscription pool tracking
 * Single transaction - no VRF, immediate mint, tracks all reward pools
 * @param program Anchor program instance
 * @param buyer The buyer's public key
 * @param contentCid The content CID
 * @param creator The content creator's public key
 * @param treasury Ecosystem treasury
 * @param platform Platform wallet for commission
 * @param collectionAsset The Metaplex Core collection asset
 */
export async function simpleMintInstruction(
  program: Program,
  buyer: PublicKey,
  contentCid: string,
  creator: PublicKey,
  treasury: PublicKey,
  platform: PublicKey,
  collectionAsset: PublicKey,
  contentName: string
): Promise<SimpleMintResult> {
  const [contentPda] = getContentPda(contentCid);
  const [ecosystemConfigPda] = getEcosystemConfigPda();
  const [mintConfigPda] = getMintConfigPda(contentPda);
  const [contentRewardPoolPda] = getContentRewardPoolPda(contentPda);
  const [contentCollectionPda] = getContentCollectionPda(contentPda);

  // Fetch current minted count to calculate edition
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contentAccount = await (program.account as any).contentEntry.fetch(contentPda);
  const currentMinted = BigInt(contentAccount.mintedCount?.toString() || "0");
  const edition = currentMinted + BigInt(1);

  const [nftAssetPda] = getSimpleNftPda(buyer, contentPda, edition);
  const [unifiedNftStatePda] = getUnifiedNftRewardStatePda(nftAssetPda);
  const [globalHolderPoolPda] = getGlobalHolderPoolPda();
  const [creatorDistPoolPda] = getCreatorDistPoolPda();
  const [creatorPatronPoolPda] = getCreatorPatronPoolPda(creator);
  const [creatorWeightPda] = getCreatorWeightPda(creator);

  // Streaming treasury accounts for lazy distribution
  const [creatorPatronTreasuryPda] = getCreatorPatronTreasuryPda(creator);
  const [ecosystemStreamingTreasuryPda] = getEcosystemStreamingTreasuryPda();
  const [ecosystemEpochStatePda] = getEcosystemEpochStatePda();

  const instruction = await program.methods
    .simpleMint(contentName)
    .accounts({
      ecosystemConfig: ecosystemConfigPda,
      content: contentPda,
      mintConfig: mintConfigPda,
      contentRewardPool: contentRewardPoolPda,
      contentCollection: contentCollectionPda,
      collectionAsset,
      creator,
      treasury,
      platform,
      nftAsset: nftAssetPda,
      unifiedNftState: unifiedNftStatePda,
      globalHolderPool: globalHolderPoolPda,
      creatorDistPool: creatorDistPoolPda,
      creatorPatronPool: creatorPatronPoolPda,
      creatorWeight: creatorWeightPda,
      creatorPatronTreasury: creatorPatronTreasuryPda,
      ecosystemStreamingTreasury: ecosystemStreamingTreasuryPda,
      ecosystemEpochState: ecosystemEpochStatePda,
      payer: buyer,
      slotHashes: SYSVAR_SLOT_HASHES_PUBKEY,
      mplCoreProgram: MPL_CORE_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  return { instruction, nftAsset: nftAssetPda, edition };
}

/**
 * Simple mint bundle NFT with slot hash randomness + full subscription pool tracking
 * Single transaction - grants access to all bundle content
 * Distributes 50% of holder rewards to BundleRewardPool and 50% to ContentRewardPools
 * @param program Anchor program instance
 * @param buyer The buyer's public key
 * @param bundleId The bundle ID
 * @param creator The bundle creator's public key
 * @param treasury Ecosystem treasury
 * @param platform Platform wallet for commission
 * @param collectionAsset The Metaplex Core collection asset
 * @param contentCids Array of content CIDs in the bundle (for 50/50 distribution to ContentRewardPools)
 */
export async function simpleMintBundleInstruction(
  program: Program,
  buyer: PublicKey,
  bundleId: string,
  creator: PublicKey,
  treasury: PublicKey,
  platform: PublicKey,
  collectionAsset: PublicKey,
  bundleName: string,
  contentCids: string[] = []
): Promise<SimpleMintResult> {
  const [bundlePda] = getBundlePda(creator, bundleId);
  const [ecosystemConfigPda] = getEcosystemConfigPda();
  const [mintConfigPda] = getBundleMintConfigPda(bundlePda);
  const [bundleRewardPoolPda] = getBundleRewardPoolPda(bundlePda);
  const [bundleCollectionPda] = getBundleCollectionPda(bundlePda);

  // Fetch current minted count to calculate edition
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bundleAccount = await (program.account as any).bundle.fetch(bundlePda);
  const currentMinted = BigInt(bundleAccount.mintedCount?.toString() || "0");
  const edition = currentMinted + BigInt(1);

  const [nftAssetPda] = getSimpleBundleNftPda(buyer, bundlePda, edition);
  const [unifiedNftStatePda] = getUnifiedNftRewardStatePda(nftAssetPda);
  const [globalHolderPoolPda] = getGlobalHolderPoolPda();
  const [creatorDistPoolPda] = getCreatorDistPoolPda();
  const [creatorPatronPoolPda] = getCreatorPatronPoolPda(creator);
  const [creatorWeightPda] = getCreatorWeightPda(creator);

  // Streaming treasury accounts for lazy distribution
  const [creatorPatronTreasuryPda] = getCreatorPatronTreasuryPda(creator);
  const [ecosystemStreamingTreasuryPda] = getEcosystemStreamingTreasuryPda();
  const [ecosystemEpochStatePda] = getEcosystemEpochStatePda();

  // Derive ContentRewardPool PDAs for 50/50 distribution
  const contentRewardPoolAccounts = contentCids.map(cid => {
    const [contentPda] = getContentPda(cid);
    const [rewardPoolPda] = getContentRewardPoolPda(contentPda);
    return { pubkey: rewardPoolPda, isSigner: false, isWritable: true };
  });

  const instruction = await program.methods
    .simpleMintBundle(bundleName)
    .accounts({
      ecosystemConfig: ecosystemConfigPda,
      bundle: bundlePda,
      bundleMintConfig: mintConfigPda,
      bundleRewardPool: bundleRewardPoolPda,
      bundleCollection: bundleCollectionPda,
      collectionAsset,
      creator,
      treasury,
      platform,
      nftAsset: nftAssetPda,
      unifiedNftState: unifiedNftStatePda,
      globalHolderPool: globalHolderPoolPda,
      creatorDistPool: creatorDistPoolPda,
      creatorPatronPool: creatorPatronPoolPda,
      creatorWeight: creatorWeightPda,
      creatorPatronTreasury: creatorPatronTreasuryPda,
      ecosystemStreamingTreasury: ecosystemStreamingTreasuryPda,
      ecosystemEpochState: ecosystemEpochStatePda,
      payer: buyer,
      slotHashes: SYSVAR_SLOT_HASHES_PUBKEY,
      mplCoreProgram: MPL_CORE_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .remainingAccounts(contentRewardPoolAccounts)
    .instruction();

  return { instruction, nftAsset: nftAssetPda, edition };
}

// NOTE: MAGICBLOCK VRF BUNDLE MINT functions removed - use simpleMintBundleInstruction instead

// ========== USER PROFILE INSTRUCTIONS ==========

/**
 * Create a user profile with username
 * Required before creating content/bundles with the new naming convention
 * @param program Anchor program instance
 * @param owner The profile owner's public key
 * @param username Display name (max 20 chars)
 */
export async function createUserProfileInstruction(
  program: Program,
  owner: PublicKey,
  username: string
): Promise<TransactionInstruction> {
  const [userProfilePda] = getUserProfilePda(owner);

  return await program.methods
    .createUserProfile(username)
    .accounts({
      userProfile: userProfilePda,
      owner,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

/**
 * Update user profile username
 * @param program Anchor program instance
 * @param owner The profile owner's public key
 * @param username New display name (max 20 chars)
 */
export async function updateUserProfileInstruction(
  program: Program,
  owner: PublicKey,
  username: string
): Promise<TransactionInstruction> {
  const [userProfilePda] = getUserProfilePda(owner);

  return await program.methods
    .updateUserProfile(username)
    .accounts({
      userProfile: userProfilePda,
      owner,
    })
    .instruction();
}

/**
 * Fetch user profile by owner
 * @param connection Solana connection
 * @param owner Owner's public key
 * @returns UserProfile or null if not found
 */
export async function fetchUserProfile(
  connection: Connection,
  owner: PublicKey
): Promise<UserProfile | null> {
  try {
    const program = createProgram(connection);
    const [userProfilePda] = getUserProfilePda(owner);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decoded = await (program.account as any).userProfile.fetch(userProfilePda);

    if (!decoded) return null;

    return {
      owner: decoded.owner,
      username: decoded.username,
      createdAt: BigInt(decoded.createdAt.toString()),
      updatedAt: BigInt(decoded.updatedAt.toString()),
    };
  } catch {
    // Account doesn't exist
    return null;
  }
}

/**
 * Configure rental for a bundle
 */
export async function configureBundleRentInstruction(
  program: Program,
  creator: PublicKey,
  bundleId: string,
  rentFee6h: bigint,
  rentFee1d: bigint,
  rentFee7d: bigint
): Promise<TransactionInstruction> {
  const [bundlePda] = getBundlePda(creator, bundleId);
  const [rentConfigPda] = getBundleRentConfigPda(bundlePda);

  return await program.methods
    .configureBundleRent(
      new BN(rentFee6h.toString()),
      new BN(rentFee1d.toString()),
      new BN(rentFee7d.toString())
    )
    .accounts({
      creator,
      bundle: bundlePda,
      rentConfig: rentConfigPda,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

/**
 * Update bundle rent config
 */
export async function updateBundleRentConfigInstruction(
  program: Program,
  creator: PublicKey,
  bundleId: string,
  rentFee6h: bigint | null,
  rentFee1d: bigint | null,
  rentFee7d: bigint | null,
  isActive: boolean | null
): Promise<TransactionInstruction> {
  const [bundlePda] = getBundlePda(creator, bundleId);
  const [rentConfigPda] = getBundleRentConfigPda(bundlePda);

  return await program.methods
    .updateBundleRentConfig(
      rentFee6h !== null ? new BN(rentFee6h.toString()) : null,
      rentFee1d !== null ? new BN(rentFee1d.toString()) : null,
      rentFee7d !== null ? new BN(rentFee7d.toString()) : null,
      isActive
    )
    .accounts({
      creator,
      bundle: bundlePda,
      rentConfig: rentConfigPda,
    })
    .instruction();
}

/**
 * Rent a bundle with SOL
 */
export async function rentBundleSolInstruction(
  program: Program,
  renter: PublicKey,
  bundleId: string,
  creator: PublicKey,
  treasury: PublicKey,
  platform: PublicKey,
  collectionAsset: PublicKey,
  tier: RentTier
): Promise<RentBundleResult> {
  const [bundlePda] = getBundlePda(creator, bundleId);
  const [ecosystemConfigPda] = getEcosystemConfigPda();
  const [rentConfigPda] = getBundleRentConfigPda(bundlePda);
  const [bundleRewardPoolPda] = getBundleRewardPoolPda(bundlePda);
  const [bundleCollectionPda] = getBundleCollectionPda(bundlePda);

  const nftAsset = Keypair.generate();
  const [rentEntryPda] = getBundleRentEntryPda(nftAsset.publicKey);

  // Convert tier to Anchor format
  const anchorTier = tier === RentTier.SixHours ? { sixHours: {} }
    : tier === RentTier.OneDay ? { oneDay: {} }
    : { sevenDays: {} };

  const instruction = await program.methods
    .rentBundleSol(anchorTier)
    .accounts({
      ecosystemConfig: ecosystemConfigPda,
      bundle: bundlePda,
      rentConfig: rentConfigPda,
      bundleRewardPool: bundleRewardPoolPda,
      bundleCollection: bundleCollectionPda,
      collectionAsset,
      creator,
      treasury,
      platform,
      nftAsset: nftAsset.publicKey,
      rentEntry: rentEntryPda,
      renter,
      mplCoreProgram: MPL_CORE_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  return { instruction, nftAsset: nftAsset.publicKey, nftAssetKeypair: nftAsset, rentEntryPda };
}

/**
 * Claim holder rewards for a bundle NFT (single NFT)
 */
export async function claimBundleRewardsInstruction(
  program: Program,
  claimer: PublicKey,
  bundleId: string,
  creator: PublicKey,
  nftAsset: PublicKey
): Promise<TransactionInstruction> {
  const [bundlePda] = getBundlePda(creator, bundleId);
  const [bundleRewardPoolPda] = getBundleRewardPoolPda(bundlePda);
  const [nftRewardStatePda] = getUnifiedNftRewardStatePda(nftAsset);

  return await program.methods
    .claimBundleRewards()
    .accounts({
      claimer,
      bundle: bundlePda,
      bundleRewardPool: bundleRewardPoolPda,
      nftAsset,
      nftRewardState: nftRewardStatePda,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

/**
 * Batch claim holder rewards for multiple bundle NFTs in one instruction
 * All NFTs must be from the same bundle
 */
export async function batchClaimBundleRewardsInstruction(
  program: Program,
  claimer: PublicKey,
  bundleId: string,
  creator: PublicKey,
  nftAssets: PublicKey[]
): Promise<TransactionInstruction> {
  const [bundlePda] = getBundlePda(creator, bundleId);
  const [bundleRewardPoolPda] = getBundleRewardPoolPda(bundlePda);

  // Build remaining accounts: pairs of (nft_asset, nft_reward_state)
  const remainingAccounts: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[] = [];
  for (const nftAsset of nftAssets) {
    const [nftRewardStatePda] = getUnifiedNftRewardStatePda(nftAsset);
    remainingAccounts.push(
      { pubkey: nftAsset, isSigner: false, isWritable: false },
      { pubkey: nftRewardStatePda, isSigner: false, isWritable: true }
    );
  }

  return await program.methods
    .batchClaimBundleRewards()
    .accounts({
      claimer,
      bundle: bundlePda,
      bundleRewardPool: bundleRewardPoolPda,
      systemProgram: SystemProgram.programId,
    })
    .remainingAccounts(remainingAccounts)
    .instruction();
}

/**
 * Fetch bundle mint config
 */
export async function fetchBundleMintConfig(
  connection: Connection,
  creator: PublicKey,
  bundleId: string
): Promise<BundleMintConfig | null> {
  try {
    const program = createProgram(connection);
    const [bundlePda] = getBundlePda(creator, bundleId);
    const [mintConfigPda] = getBundleMintConfigPda(bundlePda);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decoded = await (program.account as any).bundleMintConfig.fetch(mintConfigPda);

    return {
      bundle: decoded.bundle,
      creator: decoded.creator,
      price: BigInt(decoded.price.toString()),
      maxSupply: decoded.maxSupply ? BigInt(decoded.maxSupply.toString()) : null,
      creatorRoyaltyBps: decoded.creatorRoyaltyBps,
      isActive: decoded.isActive,
      createdAt: BigInt(decoded.createdAt.toString()),
      updatedAt: BigInt(decoded.updatedAt.toString()),
    };
  } catch {
    return null;
  }
}

/**
 * Batch fetch all bundle mint configs in a single RPC call.
 * Returns a Map keyed by bundle PDA base58 string.
 */
export async function fetchAllBundleMintConfigs(
  connection: Connection
): Promise<Map<string, BundleMintConfig>> {
  const configs = new Map<string, BundleMintConfig>();
  try {
    const program = createProgram(connection);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allConfigs = await (program.account as any).bundleMintConfig.all();

    for (const { account } of allConfigs) {
      const bundleKey = account.bundle.toBase58();
      configs.set(bundleKey, {
        bundle: account.bundle,
        creator: account.creator,
        price: BigInt(account.price.toString()),
        maxSupply: account.maxSupply ? BigInt(account.maxSupply.toString()) : null,
        creatorRoyaltyBps: account.creatorRoyaltyBps,
        isActive: account.isActive,
        createdAt: BigInt(account.createdAt.toString()),
        updatedAt: BigInt(account.updatedAt.toString()),
      });
    }
  } catch (err) {
    console.error("[fetchAllBundleMintConfigs] Error:", err);
  }
  return configs;
}

/**
 * Fetch bundle rent config
 */
export async function fetchBundleRentConfig(
  connection: Connection,
  creator: PublicKey,
  bundleId: string
): Promise<BundleRentConfig | null> {
  try {
    const program = createProgram(connection);
    const [bundlePda] = getBundlePda(creator, bundleId);
    const [rentConfigPda] = getBundleRentConfigPda(bundlePda);

    console.log("[fetchBundleRentConfig] Fetching rent config for:", {
      creator: creator.toBase58(),
      bundleId,
      bundlePda: bundlePda.toBase58(),
      rentConfigPda: rentConfigPda.toBase58(),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decoded = await (program.account as any).bundleRentConfig.fetch(rentConfigPda);

    console.log("[fetchBundleRentConfig] Found rent config:", decoded);

    return {
      bundle: decoded.bundle,
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
  } catch (error) {
    console.error("[fetchBundleRentConfig] Error fetching rent config:", error);
    return null;
  }
}

/**
 * Fetch bundle collection
 */
export async function fetchBundleCollection(
  connection: Connection,
  creator: PublicKey,
  bundleId: string
): Promise<BundleCollection | null> {
  try {
    const program = createProgram(connection);
    const [bundlePda] = getBundlePda(creator, bundleId);
    const [bundleCollectionPda] = getBundleCollectionPda(bundlePda);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decoded = await (program.account as any).bundleCollection.fetch(bundleCollectionPda);

    return {
      bundle: decoded.bundle,
      collectionAsset: decoded.collectionAsset,
      creator: decoded.creator,
      createdAt: BigInt(decoded.createdAt.toString()),
    };
  } catch {
    return null;
  }
}

/**
 * Fetch bundle reward pool
 */
export async function fetchBundleRewardPool(
  connection: Connection,
  creator: PublicKey,
  bundleId: string
): Promise<BundleRewardPool | null> {
  try {
    const program = createProgram(connection);
    const [bundlePda] = getBundlePda(creator, bundleId);
    const [bundleRewardPoolPda] = getBundleRewardPoolPda(bundlePda);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decoded = await (program.account as any).bundleRewardPool.fetch(bundleRewardPoolPda);

    return {
      bundle: decoded.bundle,
      rewardPerShare: BigInt(decoded.rewardPerShare.toString()),
      totalNfts: BigInt(decoded.totalNfts.toString()),
      totalWeight: BigInt(decoded.totalWeight.toString()),
      totalDeposited: BigInt(decoded.totalDeposited.toString()),
      totalClaimed: BigInt(decoded.totalClaimed.toString()),
      createdAt: BigInt(decoded.createdAt.toString()),
    };
  } catch {
    return null;
  }
}

/**
 * Fetch bundle wallet state (NFT ownership for a wallet)
 */
export async function fetchBundleWalletState(
  connection: Connection,
  wallet: PublicKey,
  creator: PublicKey,
  bundleId: string
): Promise<BundleWalletState | null> {
  try {
    const program = createProgram(connection);
    const [bundlePda] = getBundlePda(creator, bundleId);
    const [walletStatePda] = getBundleWalletStatePda(wallet, bundlePda);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decoded = await (program.account as any).bundleWalletState.fetch(walletStatePda);

    return {
      wallet: decoded.wallet,
      bundle: decoded.bundle,
      nftCount: BigInt(decoded.nftCount.toString()),
      rewardDebt: BigInt(decoded.rewardDebt?.toString() || "0"),
      createdAt: BigInt(decoded.createdAt.toString()),
      updatedAt: BigInt(decoded.updatedAt.toString()),
    };
  } catch {
    return null;
  }
}

// NOTE: fetchBundleNftRarity and fetchBundleNftRarities removed - rarity data is now in UnifiedNftRewardState

// ============================================
// EPOCH & SUBSCRIPTION POOL FETCHING
// ============================================

/**
 * Fetch ecosystem epoch state (singleton)
 * Tracks last distribution time and epoch duration
 */
export async function fetchEcosystemEpochState(
  connection: Connection
): Promise<EcosystemEpochState | null> {
  try {
    const program = createProgram(connection);
    const [epochStatePda] = getEcosystemEpochStatePda();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decoded = await (program.account as any).ecosystemEpochState.fetch(epochStatePda);

    return {
      lastDistributionAt: BigInt(decoded.lastDistributionAt.toString()),
      epochDuration: BigInt(decoded.epochDuration.toString()),
    };
  } catch {
    return null;
  }
}

/**
 * Fetch global holder pool (singleton)
 * Holds SOL for NFT holder claims (12% of ecosystem subscriptions)
 */
export async function fetchGlobalHolderPool(
  connection: Connection
): Promise<GlobalHolderPool | null> {
  try {
    const program = createProgram(connection);
    const [globalHolderPoolPda] = getGlobalHolderPoolPda();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decoded = await (program.account as any).globalHolderPool.fetch(globalHolderPoolPda);

    return {
      rewardPerShare: BigInt(decoded.rewardPerShare.toString()),
      totalWeight: BigInt(decoded.totalWeight.toString()),
      totalDeposited: BigInt(decoded.totalDeposited.toString()),
      totalClaimed: BigInt(decoded.totalClaimed.toString()),
      createdAt: BigInt(decoded.createdAt.toString()),
    };
  } catch {
    return null;
  }
}

/**
 * Fetch creator distribution pool (singleton)
 * Holds SOL for creator claims (80% of ecosystem subscriptions)
 */
export async function fetchCreatorDistPool(
  connection: Connection
): Promise<CreatorDistPool | null> {
  try {
    const program = createProgram(connection);
    const [creatorDistPoolPda] = getCreatorDistPoolPda();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decoded = await (program.account as any).creatorDistPool.fetch(creatorDistPoolPda);

    return {
      rewardPerShare: BigInt(decoded.rewardPerShare.toString()),
      totalWeight: BigInt(decoded.totalWeight.toString()),
      totalDeposited: BigInt(decoded.totalDeposited.toString()),
      totalClaimed: BigInt(decoded.totalClaimed.toString()),
      createdAt: BigInt(decoded.createdAt.toString()),
    };
  } catch {
    return null;
  }
}

/**
 * Helper to get WSOL ATA for a given owner
 * Used to check treasury WSOL balances
 */
function getWsolAtaAddress(owner: PublicKey): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [
      owner.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      WSOL_MINT.toBuffer(),
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return ata;
}

/**
 * Fetch token account balance (WSOL)
 * Returns 0 if account doesn't exist
 */
async function fetchTokenAccountBalance(
  connection: Connection,
  tokenAccount: PublicKey
): Promise<bigint> {
  try {
    const accountInfo = await connection.getAccountInfo(tokenAccount);
    if (!accountInfo || accountInfo.data.length < 72) {
      return BigInt(0);
    }
    // Token account data layout: amount is at offset 64 (8 bytes, little-endian u64)
    const amount = accountInfo.data.readBigUInt64LE(64);
    return amount;
  } catch {
    return BigInt(0);
  }
}

/**
 * Fetch ecosystem streaming treasury balance
 * This is the undistributed WSOL from ecosystem subscriptions (Streamflow streams)
 * Checks the Treasury PDA's WSOL ATA where Streamflow deposits vested payments
 *
 * NOTE: This only shows WSOL already withdrawn from Streamflow escrow.
 * Use fetchEcosystemPendingDistribution for the complete picture including escrow.
 */
export async function fetchEcosystemStreamingTreasuryBalance(
  connection: Connection
): Promise<bigint> {
  try {
    const [treasuryPda] = getEcosystemStreamingTreasuryPda();
    const wsolAta = getWsolAtaAddress(treasuryPda);
    return await fetchTokenAccountBalance(connection, wsolAta);
  } catch {
    return BigInt(0);
  }
}

/**
 * Result of pending distribution calculation
 */
export interface PendingDistributionResult {
  /** WSOL in treasury's WSOL ATA (withdrawn from escrow, ready to unwrap) */
  inTreasuryWsolAta: bigint;
  /** WSOL in stream escrows (released but not yet withdrawn) */
  inStreamEscrows: bigint;
  /** Total pending = inTreasuryWsolAta + inStreamEscrows */
  totalPending: bigint;
  /** Active stream IDs that have available funds to withdraw */
  streamsWithFunds: Array<{
    streamId: string;
    available: bigint;
  }>;
}

/**
 * Fetch complete pending distribution including both:
 * 1. WSOL in treasury's WSOL ATA (already withdrawn from escrow)
 * 2. WSOL in stream escrows (released but not yet withdrawn)
 *
 * This gives the full picture of funds pending distribution.
 *
 * @param connection Solana connection
 * @param streamflowClient StreamflowClient instance for querying streams
 */
export async function fetchEcosystemPendingDistribution(
  connection: Connection,
  streamflowClient: { getIncomingStreams: (recipient: PublicKey) => Promise<Array<{ id: string; depositedAmount: { toString(): string }; withdrawnAmount: { toString(): string }; startTime: number; cliff: number; period: number; amountPerPeriod: { toString(): string }; cliffAmount: { toString(): string }; canceledAt: number }>> }
): Promise<PendingDistributionResult> {
  const [treasuryPda] = getEcosystemStreamingTreasuryPda();

  // Fetch WSOL ATA balance
  const wsolAta = getWsolAtaAddress(treasuryPda);
  const inTreasuryWsolAta = await fetchTokenAccountBalance(connection, wsolAta);

  // Fetch all incoming streams for the treasury
  const streams = await streamflowClient.getIncomingStreams(treasuryPda);
  const now = Math.floor(Date.now() / 1000);

  // Calculate available for each stream
  const streamsWithFunds: Array<{ streamId: string; available: bigint }> = [];
  let inStreamEscrows = BigInt(0);

  for (const stream of streams) {
    // Skip cancelled streams
    if (stream.canceledAt > 0) continue;

    // Calculate available
    const available = calculateStreamAvailableAmount(stream, now);
    if (available > BigInt(0)) {
      streamsWithFunds.push({
        streamId: stream.id,
        available,
      });
      inStreamEscrows += available;
    }
  }

  return {
    inTreasuryWsolAta,
    inStreamEscrows,
    totalPending: inTreasuryWsolAta + inStreamEscrows,
    streamsWithFunds,
  };
}

/**
 * Helper to calculate available amount from a stream info object
 */
function calculateStreamAvailableAmount(
  stream: {
    depositedAmount: { toString(): string };
    withdrawnAmount: { toString(): string };
    startTime: number;
    cliff: number;
    period: number;
    amountPerPeriod: { toString(): string };
    cliffAmount: { toString(): string };
  },
  nowSeconds: number
): bigint {
  // If stream hasn't started yet, nothing is released
  if (nowSeconds < stream.startTime) {
    return BigInt(0);
  }

  // Calculate elapsed time since cliff (when streaming starts)
  const elapsedSinceCliff = Math.max(0, nowSeconds - stream.cliff);

  // Calculate released amount
  const periodsElapsed = Math.floor(elapsedSinceCliff / stream.period);
  const streamedAmount = BigInt(stream.amountPerPeriod.toString()) * BigInt(periodsElapsed);
  const cliffAmount = BigInt(stream.cliffAmount.toString());
  const depositedAmount = BigInt(stream.depositedAmount.toString());

  // Released is min of (cliff + streamed, deposited)
  const released = streamedAmount + cliffAmount;
  const actualReleased = released > depositedAmount ? depositedAmount : released;

  // Available = Released - Withdrawn
  const withdrawn = BigInt(stream.withdrawnAmount.toString());
  const available = actualReleased - withdrawn;

  return available > BigInt(0) ? available : BigInt(0);
}

/**
 * Fetch creator patron pool for a specific creator
 * Holds SOL for NFT holder claims (12% of patron subscriptions)
 */
export async function fetchCreatorPatronPool(
  connection: Connection,
  creator: PublicKey
): Promise<CreatorPatronPool | null> {
  try {
    const program = createProgram(connection);
    const [creatorPatronPoolPda] = getCreatorPatronPoolPda(creator);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decoded = await (program.account as any).creatorPatronPool.fetch(creatorPatronPoolPda);

    return {
      creator: decoded.creator,
      rewardPerShare: BigInt(decoded.rewardPerShare.toString()),
      totalWeight: BigInt(decoded.totalWeight.toString()),
      totalDeposited: BigInt(decoded.totalDeposited.toString()),
      totalClaimed: BigInt(decoded.totalClaimed.toString()),
      lastDistributionAt: BigInt(decoded.lastDistributionAt.toString()),
      epochDuration: BigInt(decoded.epochDuration.toString()),
      createdAt: BigInt(decoded.createdAt.toString()),
    };
  } catch {
    return null;
  }
}

/**
 * Fetch creator patron config for a specific creator
 * Contains membership/subscription pricing and active status
 */
export async function fetchCreatorPatronConfig(
  connection: Connection,
  creator: PublicKey
): Promise<CreatorPatronConfig | null> {
  try {
    const program = createProgram(connection);
    const [patronConfigPda] = getCreatorPatronConfigPda(creator);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decoded = await (program.account as any).creatorPatronConfig.fetch(patronConfigPda);

    return {
      creator: decoded.creator,
      membershipPrice: BigInt(decoded.membershipPrice.toString()),
      subscriptionPrice: BigInt(decoded.subscriptionPrice.toString()),
      isActive: decoded.isActive,
      createdAt: BigInt(decoded.createdAt.toString()),
      updatedAt: BigInt(decoded.updatedAt.toString()),
    };
  } catch {
    return null;
  }
}

/**
 * Fetch creator patron streaming treasury balance
 * This is the undistributed WSOL from patron subscriptions for this creator (Streamflow streams)
 * Checks the Treasury PDA's WSOL ATA where Streamflow deposits vested payments
 */
export async function fetchCreatorPatronTreasuryBalance(
  connection: Connection,
  creator: PublicKey
): Promise<bigint> {
  try {
    const [treasuryPda] = getCreatorPatronTreasuryPda(creator);
    const wsolAta = getWsolAtaAddress(treasuryPda);
    return await fetchTokenAccountBalance(connection, wsolAta);
  } catch {
    return BigInt(0);
  }
}

// ============================================
// SUBSCRIPTION INSTRUCTIONS
// ============================================

/**
 * Initialize patron config for a creator
 * Allows creators to set membership and subscription tier prices
 */
export async function initPatronConfigInstruction(
  program: Program,
  creator: PublicKey,
  membershipPrice: bigint,
  subscriptionPrice: bigint
): Promise<TransactionInstruction> {
  const [patronConfigPda] = getCreatorPatronConfigPda(creator);
  const [creatorPatronPoolPda] = getCreatorPatronPoolPda(creator);

  return await program.methods
    .initPatronConfig(
      new BN(membershipPrice.toString()),
      new BN(subscriptionPrice.toString())
    )
    .accounts({
      patronConfig: patronConfigPda,
      creatorPatronPool: creatorPatronPoolPda,
      creator,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

/**
 * Update patron config for a creator
 * Allows creators to update membership/subscription prices and active status
 */
export async function updatePatronConfigInstruction(
  program: Program,
  creator: PublicKey,
  membershipPrice: bigint | null,
  subscriptionPrice: bigint | null,
  isActive: boolean | null
): Promise<TransactionInstruction> {
  const [patronConfigPda] = getCreatorPatronConfigPda(creator);

  return await program.methods
    .updatePatronConfig(
      membershipPrice !== null ? new BN(membershipPrice.toString()) : null,
      subscriptionPrice !== null ? new BN(subscriptionPrice.toString()) : null,
      isActive
    )
    .accounts({
      patronConfig: patronConfigPda,
      creator,
    })
    .instruction();
}

/**
 * Subscribe to a creator's patron tier (Streamflow payment)
 * @param tier - 'membership' or 'subscription'
 * @param streamId - Streamflow stream ID for payment
 */
export async function subscribePatronInstruction(
  program: Program,
  subscriber: PublicKey,
  creator: PublicKey,
  tier: 'membership' | 'subscription',
  streamId: PublicKey
): Promise<TransactionInstruction> {
  const [patronConfigPda] = getCreatorPatronConfigPda(creator);
  const [patronSubscriptionPda] = getCreatorPatronSubscriptionPda(subscriber, creator);

  const tierArg = tier === 'membership' ? { membership: {} } : { subscription: {} };

  return await program.methods
    .subscribePatron(tierArg, streamId)
    .accounts({
      patronConfig: patronConfigPda,
      patronSubscription: patronSubscriptionPda,
      creator,
      subscriber,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

/**
 * Cancel patron subscription
 */
export async function cancelPatronSubscriptionInstruction(
  program: Program,
  subscriber: PublicKey,
  creator: PublicKey
): Promise<TransactionInstruction> {
  const [patronSubscriptionPda] = getCreatorPatronSubscriptionPda(subscriber, creator);

  return await program.methods
    .cancelPatronSubscription()
    .accounts({
      patronSubscription: patronSubscriptionPda,
      creator,
      subscriber,
    })
    .instruction();
}

/**
 * Subscribe to ecosystem (Streamflow payment)
 * Creates subscription record - payment handled via Streamflow stream
 * stream_id: The Streamflow stream ID for this subscription's payment
 */
export async function subscribeEcosystemInstruction(
  program: Program,
  subscriber: PublicKey,
  streamId: PublicKey
): Promise<TransactionInstruction> {
  const [ecosystemSubConfigPda] = getEcosystemSubConfigPda();
  const [ecosystemSubscriptionPda] = getEcosystemSubscriptionPda(subscriber);

  return await program.methods
    .subscribeEcosystem(streamId)
    .accounts({
      ecosystemSubConfig: ecosystemSubConfigPda,
      ecosystemSubscription: ecosystemSubscriptionPda,
      subscriber,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

/**
 * Cancel ecosystem subscription
 */
export async function cancelEcosystemSubscriptionInstruction(
  program: Program,
  subscriber: PublicKey
): Promise<TransactionInstruction> {
  const [ecosystemSubscriptionPda] = getEcosystemSubscriptionPda(subscriber);

  return await program.methods
    .cancelEcosystemSubscription()
    .accounts({
      ecosystemSubscription: ecosystemSubscriptionPda,
      subscriber,
    })
    .instruction();
}

/**
 * Renew patron subscription (Streamflow topup extends the stream)
 * Updates subscription timestamp - stream_id stays the same
 */
export async function renewPatronSubscriptionInstruction(
  program: Program,
  subscriber: PublicKey,
  creator: PublicKey
): Promise<TransactionInstruction> {
  const [patronConfigPda] = getCreatorPatronConfigPda(creator);
  const [patronSubscriptionPda] = getCreatorPatronSubscriptionPda(subscriber, creator);

  return await program.methods
    .renewPatronSubscription()
    .accounts({
      patronConfig: patronConfigPda,
      patronSubscription: patronSubscriptionPda,
      creator,
      subscriber,
    })
    .instruction();
}

/**
 * Renew ecosystem subscription (Streamflow topup extends the stream)
 * Updates subscription timestamp - stream_id stays the same
 */
export async function renewEcosystemSubscriptionInstruction(
  program: Program,
  subscriber: PublicKey
): Promise<TransactionInstruction> {
  const [ecosystemSubConfigPda] = getEcosystemSubConfigPda();
  const [ecosystemSubscriptionPda] = getEcosystemSubscriptionPda(subscriber);

  return await program.methods
    .renewEcosystemSubscription()
    .accounts({
      ecosystemSubConfig: ecosystemSubConfigPda,
      ecosystemSubscription: ecosystemSubscriptionPda,
      subscriber,
    })
    .instruction();
}

// ============================================
// TREASURY WSOL UNWRAP INSTRUCTIONS
// ============================================

/**
 * Unwrap WSOL from ecosystem streaming treasury to native SOL
 * Anyone can call this - it converts accumulated WSOL from Streamflow to native SOL
 * Must be called before epoch distribution can work with the accumulated funds
 *
 * @param program - The Anchor program instance
 * @param payer - The wallet paying for the transaction
 */
export async function unwrapEcosystemTreasuryWsolInstruction(
  program: Program,
  payer: PublicKey
): Promise<TransactionInstruction> {
  const [ecosystemTreasuryPda] = getEcosystemStreamingTreasuryPda();
  const treasuryWsolAta = getWsolAtaAddress(ecosystemTreasuryPda);

  return await program.methods
    .unwrapEcosystemTreasuryWsol()
    .accounts({
      ecosystemStreamingTreasury: ecosystemTreasuryPda,
      treasuryWsolAta,
      payer,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

/**
 * Unwrap WSOL from creator patron streaming treasury to native SOL
 * Anyone can call this - it converts accumulated WSOL from Streamflow to native SOL
 *
 * @param program - The Anchor program instance
 * @param creator - The creator whose treasury to unwrap
 * @param payer - The wallet paying for the transaction
 */
export async function unwrapCreatorPatronTreasuryWsolInstruction(
  program: Program,
  creator: PublicKey,
  payer: PublicKey
): Promise<TransactionInstruction> {
  const [creatorPatronTreasuryPda] = getCreatorPatronTreasuryPda(creator);
  const treasuryWsolAta = getWsolAtaAddress(creatorPatronTreasuryPda);

  return await program.methods
    .unwrapCreatorPatronTreasuryWsol()
    .accounts({
      creator,
      creatorPatronTreasury: creatorPatronTreasuryPda,
      treasuryWsolAta,
      payer,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

// ============================================
// STREAMFLOW WITHDRAW INSTRUCTIONS
// ============================================
// These instructions pull funds from Streamflow escrow to treasury's WSOL ATA
// Step 1: Call withdraw to get WSOL from escrow
// Step 2: Call unwrap to convert WSOL to native SOL

/**
 * Withdraw accumulated WSOL from Streamflow stream to ecosystem treasury
 * Anyone can call this - pulls released funds from any ecosystem subscription stream
 * This is Step 1 - after this, call unwrapEcosystemTreasuryWsol to convert WSOL to SOL
 *
 * @param program - The Anchor program instance
 * @param streamMetadata - The stream ID (metadata account) to withdraw from
 * @param partner - The partner account used when creating the stream
 * @param payer - The wallet paying for the transaction
 */
export async function withdrawEcosystemStreamToTreasuryInstruction(
  program: Program,
  streamMetadata: PublicKey,
  partner: PublicKey,
  payer: PublicKey
): Promise<TransactionInstruction> {
  const [ecosystemTreasuryPda] = getEcosystemStreamingTreasuryPda();
  const treasuryWsolAta = getWsolAtaAddress(ecosystemTreasuryPda);
  const [escrowTokensPda] = getStreamflowEscrowTokensPda(streamMetadata);
  const streamflowTreasuryWsol = getWsolAtaAddress(STREAMFLOW_TREASURY);
  const partnerWsol = getWsolAtaAddress(partner);

  return await program.methods
    .withdrawEcosystemStreamToTreasury()
    .accounts({
      ecosystemStreamingTreasury: ecosystemTreasuryPda,
      treasuryWsolAta,
      streamMetadata,
      escrowTokens: escrowTokensPda,
      streamflowTreasury: STREAMFLOW_TREASURY,
      streamflowTreasuryWsol,
      partner,
      partnerWsol,
      wsolMint: WSOL_MINT,
      streamflowProgram: STREAMFLOW_PROGRAM_ID,
      payer,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
}

/**
 * Withdraw accumulated WSOL from Streamflow stream to creator patron treasury
 * Anyone can call this to enable permissionless distribution
 *
 * @param program - The Anchor program instance
 * @param creator - The creator whose treasury to receive funds
 * @param streamMetadata - The stream ID (metadata account) to withdraw from
 * @param partner - The partner account used when creating the stream
 * @param payer - The wallet paying for the transaction
 */
export async function withdrawCreatorStreamToTreasuryInstruction(
  program: Program,
  creator: PublicKey,
  streamMetadata: PublicKey,
  partner: PublicKey,
  payer: PublicKey
): Promise<TransactionInstruction> {
  const [creatorPatronTreasuryPda] = getCreatorPatronTreasuryPda(creator);
  const treasuryWsolAta = getWsolAtaAddress(creatorPatronTreasuryPda);
  const [escrowTokensPda] = getStreamflowEscrowTokensPda(streamMetadata);
  const streamflowTreasuryWsol = getWsolAtaAddress(STREAMFLOW_TREASURY);
  const partnerWsol = getWsolAtaAddress(partner);

  return await program.methods
    .withdrawCreatorStreamToTreasury()
    .accounts({
      creator,
      creatorPatronTreasury: creatorPatronTreasuryPda,
      treasuryWsolAta,
      streamMetadata,
      escrowTokens: escrowTokensPda,
      streamflowTreasury: STREAMFLOW_TREASURY,
      streamflowTreasuryWsol,
      partner,
      partnerWsol,
      wsolMint: WSOL_MINT,
      streamflowProgram: STREAMFLOW_PROGRAM_ID,
      payer,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
}

// ============================================
// STREAMFLOW CPI MEMBERSHIP INSTRUCTIONS
// ============================================

/**
 * Helper to derive WSOL ATA address
 */
function getWsolAta(owner: PublicKey): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [
      owner.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      WSOL_MINT.toBuffer(),
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return ata;
}

/**
 * Join ecosystem membership via Streamflow CPI (secure on-chain stream creation)
 * The program enforces the treasury PDA as recipient - no fund redirection possible
 *
 * @param program - The Anchor program instance
 * @param subscriber - The wallet joining the membership
 * @param streamMetadata - A new keypair for the stream (will be the stream ID)
 * @param partner - Partner account for referrals (can be our program ID for 0 fee)
 * @param durationType - 0 = monthly, 1 = yearly (10 months for 12 months access)
 */
export async function joinEcosystemMembershipInstruction(
  program: Program,
  subscriber: PublicKey,
  streamMetadata: Keypair,
  partner: PublicKey,
  durationType: number
): Promise<TransactionInstruction> {
  const [ecosystemConfigPda] = getEcosystemSubConfigPda();
  const [ecosystemSubscriptionPda] = getEcosystemSubscriptionPda(subscriber);
  const [ecosystemTreasuryPda] = getEcosystemStreamingTreasuryPda();
  const [escrowTokensPda] = getStreamflowEscrowTokensPda(streamMetadata.publicKey);

  // Derive all WSOL ATAs
  const subscriberWsol = getWsolAta(subscriber);
  const ecosystemTreasuryWsol = getWsolAta(ecosystemTreasuryPda);
  const streamflowTreasuryWsol = getWsolAta(STREAMFLOW_TREASURY);
  const partnerWsol = getWsolAta(partner);

  return await program.methods
    .joinEcosystemMembership(durationType)
    .accounts({
      subscriber,
      subscriberWsol,
      ecosystemConfig: ecosystemConfigPda,
      ecosystemSubscription: ecosystemSubscriptionPda,
      ecosystemTreasury: ecosystemTreasuryPda,
      ecosystemTreasuryWsol,
      streamMetadata: streamMetadata.publicKey,
      escrowTokens: escrowTokensPda,
      streamflowTreasury: STREAMFLOW_TREASURY,
      streamflowTreasuryWsol,
      streamflowWithdrawor: STREAMFLOW_WITHDRAWOR,
      partner,
      partnerWsol,
      wsolMint: WSOL_MINT,
      feeOracle: STREAMFLOW_FEE_ORACLE,
      streamflowProgram: STREAMFLOW_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

/**
 * Join creator membership via Streamflow CPI (secure on-chain stream creation)
 * The program enforces the creator's treasury PDA as recipient
 *
 * @param program - The Anchor program instance
 * @param subscriber - The wallet joining the membership
 * @param creator - The creator being subscribed to
 * @param streamMetadata - A new keypair for the stream (will be the stream ID)
 * @param partner - Partner account for referrals (can be our program ID for 0 fee)
 * @param tier - 0 = membership (support only), 1 = subscription (support + access)
 * @param durationType - 0 = monthly, 1 = yearly (10 months for 12 months access)
 */
export async function joinCreatorMembershipInstruction(
  program: Program,
  subscriber: PublicKey,
  creator: PublicKey,
  streamMetadata: Keypair,
  partner: PublicKey,
  tier: number,
  durationType: number
): Promise<TransactionInstruction> {
  const [patronConfigPda] = getCreatorPatronConfigPda(creator);
  const [patronSubscriptionPda] = getCreatorPatronSubscriptionPda(subscriber, creator);
  const [creatorTreasuryPda] = getCreatorPatronTreasuryPda(creator);
  const [escrowTokensPda] = getStreamflowEscrowTokensPda(streamMetadata.publicKey);

  // Derive all WSOL ATAs
  const subscriberWsol = getWsolAta(subscriber);
  const creatorTreasuryWsol = getWsolAta(creatorTreasuryPda);
  const streamflowTreasuryWsol = getWsolAta(STREAMFLOW_TREASURY);
  const partnerWsol = getWsolAta(partner);

  return await program.methods
    .joinCreatorMembership(tier, durationType)
    .accounts({
      subscriber,
      subscriberWsol,
      creator,
      patronConfig: patronConfigPda,
      patronSubscription: patronSubscriptionPda,
      creatorTreasury: creatorTreasuryPda,
      creatorTreasuryWsol,
      streamMetadata: streamMetadata.publicKey,
      escrowTokens: escrowTokensPda,
      streamflowTreasury: STREAMFLOW_TREASURY,
      streamflowTreasuryWsol,
      streamflowWithdrawor: STREAMFLOW_WITHDRAWOR,
      partner,
      partnerWsol,
      wsolMint: WSOL_MINT,
      feeOracle: STREAMFLOW_FEE_ORACLE,
      streamflowProgram: STREAMFLOW_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

/**
 * Cancel ecosystem membership stream via Streamflow CPI
 * Returns remaining funds to subscriber
 *
 * @param program - The Anchor program instance
 * @param subscriber - The wallet cancelling the membership
 * @param streamMetadata - The stream ID (from the subscription record)
 * @param partner - Partner account that was used at creation
 */
export async function cancelEcosystemMembershipStreamInstruction(
  program: Program,
  subscriber: PublicKey,
  streamMetadata: PublicKey,
  partner: PublicKey
): Promise<TransactionInstruction> {
  const [ecosystemSubscriptionPda] = getEcosystemSubscriptionPda(subscriber);
  const [ecosystemTreasuryPda] = getEcosystemStreamingTreasuryPda();
  const [escrowTokensPda] = getStreamflowEscrowTokensPda(streamMetadata);

  // Derive all WSOL ATAs
  const subscriberWsol = getWsolAta(subscriber);
  const ecosystemTreasuryWsol = getWsolAta(ecosystemTreasuryPda);
  const streamflowTreasuryWsol = getWsolAta(STREAMFLOW_TREASURY);
  const partnerWsol = getWsolAta(partner);

  return await program.methods
    .cancelEcosystemMembershipStream()
    .accounts({
      subscriber,
      subscriberWsol,
      ecosystemSubscription: ecosystemSubscriptionPda,
      ecosystemTreasury: ecosystemTreasuryPda,
      ecosystemTreasuryWsol,
      streamMetadata,
      escrowTokens: escrowTokensPda,
      streamflowTreasury: STREAMFLOW_TREASURY,
      streamflowTreasuryWsol,
      partner,
      partnerWsol,
      wsolMint: WSOL_MINT,
      streamflowProgram: STREAMFLOW_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
}

/**
 * Topup ecosystem membership stream via Streamflow CPI
 * Extends the membership duration
 *
 * @param program - The Anchor program instance
 * @param subscriber - The wallet extending the membership
 * @param streamMetadata - The stream ID (from the subscription record)
 * @param partner - Partner account that was used at creation
 * @param durationType - 0 = add 1 month, 1 = add 1 year (at yearly price)
 */
export async function topupEcosystemMembershipInstruction(
  program: Program,
  subscriber: PublicKey,
  streamMetadata: PublicKey,
  partner: PublicKey,
  durationType: number
): Promise<TransactionInstruction> {
  const [ecosystemConfigPda] = getEcosystemSubConfigPda();
  const [ecosystemSubscriptionPda] = getEcosystemSubscriptionPda(subscriber);
  const [escrowTokensPda] = getStreamflowEscrowTokensPda(streamMetadata);

  // Derive all WSOL ATAs
  const subscriberWsol = getWsolAta(subscriber);
  const streamflowTreasuryWsol = getWsolAta(STREAMFLOW_TREASURY);
  const partnerWsol = getWsolAta(partner);

  return await program.methods
    .topupEcosystemMembership(durationType)
    .accounts({
      subscriber,
      subscriberWsol,
      ecosystemConfig: ecosystemConfigPda,
      ecosystemSubscription: ecosystemSubscriptionPda,
      streamMetadata,
      escrowTokens: escrowTokensPda,
      streamflowTreasury: STREAMFLOW_TREASURY,
      streamflowTreasuryWsol,
      streamflowWithdrawor: STREAMFLOW_WITHDRAWOR,
      partner,
      partnerWsol,
      wsolMint: WSOL_MINT,
      streamflowProgram: STREAMFLOW_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

/**
 * Claim content rewards for an NFT (uses UnifiedNftRewardState for subscription system)
 */
export async function claimUnifiedContentRewardsInstruction(
  program: Program,
  claimer: PublicKey,
  contentCid: string,
  nftAsset: PublicKey
): Promise<TransactionInstruction> {
  const [contentPda] = getContentPda(contentCid);
  const [contentRewardPoolPda] = getContentRewardPoolPda(contentPda);
  const [nftRewardStatePda] = getUnifiedNftRewardStatePda(nftAsset);

  return await program.methods
    .claimUnifiedContentRewards()
    .accounts({
      claimer,
      content: contentPda,
      contentRewardPool: contentRewardPoolPda,
      nftAsset,
      nftRewardState: nftRewardStatePda,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

/**
 * Claim patron rewards for an NFT (from creator's patron pool)
 */
export async function claimPatronRewardsInstruction(
  program: Program,
  claimer: PublicKey,
  creator: PublicKey,
  nftAsset: PublicKey
): Promise<TransactionInstruction> {
  const [creatorPatronPoolPda] = getCreatorPatronPoolPda(creator);
  const [nftRewardStatePda] = getUnifiedNftRewardStatePda(nftAsset);

  return await program.methods
    .claimPatronRewards()
    .accounts({
      claimer,
      creatorPatronPool: creatorPatronPoolPda,
      nftAsset,
      nftRewardState: nftRewardStatePda,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

/**
 * Claim global holder rewards for an NFT (from ecosystem subscriptions)
 */
export async function claimGlobalHolderRewardsInstruction(
  program: Program,
  claimer: PublicKey,
  nftAsset: PublicKey
): Promise<TransactionInstruction> {
  const [globalHolderPoolPda] = getGlobalHolderPoolPda();
  const [nftRewardStatePda] = getUnifiedNftRewardStatePda(nftAsset);

  return await program.methods
    .claimGlobalHolderRewards()
    .accounts({
      claimer,
      globalHolderPool: globalHolderPoolPda,
      nftAsset,
      nftRewardState: nftRewardStatePda,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
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
    getUnifiedNftRewardStatePda,
    getRentConfigPda,
    getRentEntryPda,
    getPendingMintPda,
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
      encryptionMetaCid: string = "",
      visibilityLevel: number = 0
    ) => registerContentInstruction(program, authority, contentCid, metadataCid, contentType, isEncrypted, previewCid, encryptionMetaCid, visibilityLevel),

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
      encryptionMetaCid: string = "",
      visibilityLevel: number = 0,
      collectionName: string | null = null
    ) => registerContentWithMintInstruction(
      program, authority, contentCid, metadataCid, contentType, price, maxSupply, creatorRoyaltyBps, platform, isEncrypted, previewCid, encryptionMetaCid, visibilityLevel, collectionName
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

    // NOTE: VRF mint functions removed - use simpleMintInstruction instead

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

    // Bundle management
    createBundleInstruction: (creator: PublicKey, bundleId: string, metadataCid: string, bundleType: BundleType) =>
      createBundleInstruction(program, creator, bundleId, metadataCid, bundleType),

    createBundleWithMintAndRentInstruction: (
      creator: PublicKey,
      bundleId: string,
      metadataCid: string,
      bundleType: BundleType,
      mintPrice: bigint,
      mintMaxSupply: bigint | null,
      creatorRoyaltyBps: number,
      rentFee6h: bigint,
      rentFee1d: bigint,
      rentFee7d: bigint,
      platform: PublicKey,
      collectionName: string | null = null
    ) => createBundleWithMintAndRentInstruction(
      program, creator, bundleId, metadataCid, bundleType,
      mintPrice, mintMaxSupply, creatorRoyaltyBps,
      rentFee6h, rentFee1d, rentFee7d, platform, collectionName
    ),

    addBundleItemInstruction: (creator: PublicKey, bundleId: string, contentCid: string, position?: number) =>
      addBundleItemInstruction(program, creator, bundleId, contentCid, position),

    removeBundleItemInstruction: (creator: PublicKey, bundleId: string, contentCid: string) =>
      removeBundleItemInstruction(program, creator, bundleId, contentCid),

    updateBundleInstruction: (creator: PublicKey, bundleId: string, metadataCid?: string, isActive?: boolean) =>
      updateBundleInstruction(program, creator, bundleId, metadataCid, isActive),

    deleteBundleInstruction: (creator: PublicKey, bundleId: string) =>
      deleteBundleInstruction(program, creator, bundleId),

    // Bundle PDA helpers
    getBundlePda,
    getBundleItemPda,

    // Bundle fetching
    fetchBundle: (creator: PublicKey, bundleId: string) => fetchBundle(connection, creator, bundleId),
    fetchBundleByPda: (bundlePda: PublicKey) => fetchBundleByPda(connection, bundlePda),
    fetchAllBundles: () => fetchAllBundles(connection),
    fetchBundlesByCreator: (creator: PublicKey) => fetchBundlesByCreator(connection, creator),
    fetchBundleItems: (creator: PublicKey, bundleId: string) => fetchBundleItems(connection, creator, bundleId),
    fetchBundleWithItems: (creator: PublicKey, bundleId: string) => fetchBundleWithItems(connection, creator, bundleId),
    findBundlesForContent: (contentCid: string) => findBundlesForContent(connection, contentCid),
    findBundlesForContentBatch: (contentCids: string[]) => findBundlesForContentBatch(connection, contentCids),

    // Bundle mint/rent configuration
    configureBundleMintInstruction: (
      creator: PublicKey,
      bundleId: string,
      price: bigint,
      maxSupply: bigint | null,
      creatorRoyaltyBps: number,
      platform: PublicKey
    ) => configureBundleMintInstruction(program, creator, bundleId, price, maxSupply, creatorRoyaltyBps, platform),

    updateBundleMintSettingsInstruction: (
      creator: PublicKey,
      bundleId: string,
      price: bigint | null,
      maxSupply: bigint | null | undefined,
      creatorRoyaltyBps: number | null,
      isActive: boolean | null
    ) => updateBundleMintSettingsInstruction(program, creator, bundleId, price, maxSupply, creatorRoyaltyBps, isActive),

    // Simple mint with subscription pool tracking (replaces VRF and direct mint)
    simpleMintInstruction: (
      buyer: PublicKey,
      contentCid: string,
      creator: PublicKey,
      treasury: PublicKey,
      platform: PublicKey,
      collectionAsset: PublicKey,
      contentName: string
    ): Promise<SimpleMintResult> => simpleMintInstruction(program, buyer, contentCid, creator, treasury, platform, collectionAsset, contentName),

    simpleMintBundleInstruction: (
      buyer: PublicKey,
      bundleId: string,
      creator: PublicKey,
      treasury: PublicKey,
      platform: PublicKey,
      collectionAsset: PublicKey,
      bundleName: string,
      contentCids: string[] = []
    ): Promise<SimpleMintResult> => simpleMintBundleInstruction(program, buyer, bundleId, creator, treasury, platform, collectionAsset, bundleName, contentCids),

    // User profile management
    fetchUserProfile: (owner: PublicKey) => fetchUserProfile(connection, owner),

    createUserProfileInstruction: (owner: PublicKey, username: string) =>
      createUserProfileInstruction(program, owner, username),

    updateUserProfileInstruction: (owner: PublicKey, username: string) =>
      updateUserProfileInstruction(program, owner, username),

    configureBundleRentInstruction: (
      creator: PublicKey,
      bundleId: string,
      rentFee6h: bigint,
      rentFee1d: bigint,
      rentFee7d: bigint
    ) => configureBundleRentInstruction(program, creator, bundleId, rentFee6h, rentFee1d, rentFee7d),

    updateBundleRentConfigInstruction: (
      creator: PublicKey,
      bundleId: string,
      rentFee6h: bigint | null,
      rentFee1d: bigint | null,
      rentFee7d: bigint | null,
      isActive: boolean | null
    ) => updateBundleRentConfigInstruction(program, creator, bundleId, rentFee6h, rentFee1d, rentFee7d, isActive),

    rentBundleSolInstruction: (
      renter: PublicKey,
      bundleId: string,
      creator: PublicKey,
      treasury: PublicKey,
      platform: PublicKey,
      collectionAsset: PublicKey,
      tier: RentTier
    ): Promise<RentBundleResult> => rentBundleSolInstruction(program, renter, bundleId, creator, treasury, platform, collectionAsset, tier),

    claimBundleRewardsInstruction: (
      claimer: PublicKey,
      bundleId: string,
      creator: PublicKey,
      nftAsset: PublicKey
    ) => claimBundleRewardsInstruction(program, claimer, bundleId, creator, nftAsset),

    batchClaimBundleRewardsInstruction: (
      claimer: PublicKey,
      bundleId: string,
      creator: PublicKey,
      nftAssets: PublicKey[]
    ) => batchClaimBundleRewardsInstruction(program, claimer, bundleId, creator, nftAssets),

    // Subscription management
    initPatronConfigInstruction: (
      creator: PublicKey,
      membershipPrice: bigint,
      subscriptionPrice: bigint
    ) => initPatronConfigInstruction(program, creator, membershipPrice, subscriptionPrice),

    updatePatronConfigInstruction: (
      creator: PublicKey,
      membershipPrice: bigint | null,
      subscriptionPrice: bigint | null,
      isActive: boolean | null
    ) => updatePatronConfigInstruction(program, creator, membershipPrice, subscriptionPrice, isActive),

    subscribePatronInstruction: (
      subscriber: PublicKey,
      creator: PublicKey,
      tier: 'membership' | 'subscription',
      streamId: PublicKey
    ) => subscribePatronInstruction(program, subscriber, creator, tier, streamId),

    cancelPatronSubscriptionInstruction: (
      subscriber: PublicKey,
      creator: PublicKey
    ) => cancelPatronSubscriptionInstruction(program, subscriber, creator),

    subscribeEcosystemInstruction: (
      subscriber: PublicKey,
      streamId: PublicKey
    ) => subscribeEcosystemInstruction(program, subscriber, streamId),

    cancelEcosystemSubscriptionInstruction: (
      subscriber: PublicKey
    ) => cancelEcosystemSubscriptionInstruction(program, subscriber),

    renewPatronSubscriptionInstruction: (
      subscriber: PublicKey,
      creator: PublicKey
    ) => renewPatronSubscriptionInstruction(program, subscriber, creator),

    renewEcosystemSubscriptionInstruction: (
      subscriber: PublicKey
    ) => renewEcosystemSubscriptionInstruction(program, subscriber),

    // Treasury WSOL unwrap instructions
    unwrapEcosystemTreasuryWsolInstruction: (
      payer: PublicKey
    ) => unwrapEcosystemTreasuryWsolInstruction(program, payer),

    unwrapCreatorPatronTreasuryWsolInstruction: (
      creator: PublicKey,
      payer: PublicKey
    ) => unwrapCreatorPatronTreasuryWsolInstruction(program, creator, payer),

    // Streamflow withdraw instructions (pull funds from escrow to treasury)
    withdrawEcosystemStreamToTreasuryInstruction: (
      streamMetadata: PublicKey,
      partner: PublicKey,
      payer: PublicKey
    ) => withdrawEcosystemStreamToTreasuryInstruction(program, streamMetadata, partner, payer),

    withdrawCreatorStreamToTreasuryInstruction: (
      creator: PublicKey,
      streamMetadata: PublicKey,
      partner: PublicKey,
      payer: PublicKey
    ) => withdrawCreatorStreamToTreasuryInstruction(program, creator, streamMetadata, partner, payer),

    // Streamflow CPI membership instructions (secure on-chain stream creation)
    joinEcosystemMembershipInstruction: (
      subscriber: PublicKey,
      streamMetadata: Keypair,
      partner: PublicKey,
      durationType: number
    ) => joinEcosystemMembershipInstruction(program, subscriber, streamMetadata, partner, durationType),

    joinCreatorMembershipInstruction: (
      subscriber: PublicKey,
      creator: PublicKey,
      streamMetadata: Keypair,
      partner: PublicKey,
      tier: number,
      durationType: number
    ) => joinCreatorMembershipInstruction(program, subscriber, creator, streamMetadata, partner, tier, durationType),

    cancelEcosystemMembershipStreamInstruction: (
      subscriber: PublicKey,
      streamMetadata: PublicKey,
      partner: PublicKey
    ) => cancelEcosystemMembershipStreamInstruction(program, subscriber, streamMetadata, partner),

    topupEcosystemMembershipInstruction: (
      subscriber: PublicKey,
      streamMetadata: PublicKey,
      partner: PublicKey,
      durationType: number
    ) => topupEcosystemMembershipInstruction(program, subscriber, streamMetadata, partner, durationType),

    // Subscription claim instructions (use UnifiedNftRewardState)
    claimUnifiedContentRewardsInstruction: (
      claimer: PublicKey,
      contentCid: string,
      nftAsset: PublicKey
    ) => claimUnifiedContentRewardsInstruction(program, claimer, contentCid, nftAsset),

    claimPatronRewardsInstruction: (
      claimer: PublicKey,
      creator: PublicKey,
      nftAsset: PublicKey
    ) => claimPatronRewardsInstruction(program, claimer, creator, nftAsset),

    claimGlobalHolderRewardsInstruction: (
      claimer: PublicKey,
      nftAsset: PublicKey
    ) => claimGlobalHolderRewardsInstruction(program, claimer, nftAsset),

    // Subscription PDA helpers
    getCreatorPatronConfigPda,
    getCreatorPatronPoolPda,
    getCreatorPatronSubscriptionPda,
    getGlobalHolderPoolPda,
    getCreatorDistPoolPda,
    getCreatorWeightPda,
    getCreatorPatronTreasuryPda,
    getEcosystemStreamingTreasuryPda,
    getEcosystemEpochStatePda,
    getEcosystemSubConfigPda,
    getEcosystemSubscriptionPda,

    // Bundle mint/rent PDA helpers
    getBundleMintConfigPda,
    getBundleRentConfigPda,
    getBundleCollectionPda,
    getBundleRewardPoolPda,
    getBundleWalletStatePda,
    getBundleRentEntryPda,
    getBundleDirectNftPda,

    // Bundle mint/rent fetching
    fetchBundleMintConfig: (creator: PublicKey, bundleId: string) => fetchBundleMintConfig(connection, creator, bundleId),
    fetchAllBundleMintConfigs: () => fetchAllBundleMintConfigs(connection),
    fetchBundleRentConfig: (creator: PublicKey, bundleId: string) => fetchBundleRentConfig(connection, creator, bundleId),
    fetchBundleCollection: (creator: PublicKey, bundleId: string) => fetchBundleCollection(connection, creator, bundleId),
    fetchBundleRewardPool: (creator: PublicKey, bundleId: string) => fetchBundleRewardPool(connection, creator, bundleId),
    fetchBundleWalletState: (wallet: PublicKey, creator: PublicKey, bundleId: string) => fetchBundleWalletState(connection, wallet, creator, bundleId),

    // NOTE: fetchBundleNftRarity and fetchBundleNftRarities removed - rarity now in UnifiedNftRewardState
    // NOTE: MagicBlock bundle mint request fetching removed

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

    // Epoch & subscription pool fetching
    fetchEcosystemEpochState: () => fetchEcosystemEpochState(connection),
    fetchGlobalHolderPool: () => fetchGlobalHolderPool(connection),
    fetchCreatorDistPool: () => fetchCreatorDistPool(connection),
    fetchEcosystemStreamingTreasuryBalance: () => fetchEcosystemStreamingTreasuryBalance(connection),
    fetchEcosystemPendingDistribution: (
      streamflowClient: Parameters<typeof fetchEcosystemPendingDistribution>[1]
    ) => fetchEcosystemPendingDistribution(connection, streamflowClient),
    fetchCreatorPatronPool: (creator: PublicKey) => fetchCreatorPatronPool(connection, creator),
    fetchCreatorPatronConfig: (creator: PublicKey) => fetchCreatorPatronConfig(connection, creator),
    fetchCreatorPatronTreasuryBalance: (creator: PublicKey) => fetchCreatorPatronTreasuryBalance(connection, creator),

    fetchContentRewardPool: (contentCid: string) => fetchContentRewardPool(connection, contentCid),
    fetchContentCollection: (contentCid: string) => fetchContentCollection(connection, contentCid),
    fetchWalletContentState: (wallet: PublicKey, contentCid: string) => fetchWalletContentState(connection, wallet, contentCid),
    fetchNftRewardState: (nftAsset: PublicKey) => fetchNftRewardState(connection, nftAsset),

    // NOTE: fetchNftRarity and fetchNftRaritiesBatch removed - rarity now in UnifiedNftRewardState

    // Rent fetching
    fetchRentConfig: (contentCid: string) => fetchRentConfig(connection, contentCid),
    fetchRentEntry: (nftAsset: PublicKey) => fetchRentEntry(connection, nftAsset),
    checkRentalAccess: (nftAsset: PublicKey) => checkRentalAccess(connection, nftAsset),
    fetchActiveRentalForContent: (wallet: PublicKey, contentCid: string) => fetchActiveRentalForContent(connection, wallet, contentCid),
    fetchWalletRentalNfts: (wallet: PublicKey) => fetchWalletRentalNfts(connection, wallet),
    fetchRentalNftsFromMetadata: (nftMetadata: WalletNftMetadata[]) => fetchRentalNftsFromMetadata(connection, nftMetadata),

    // NOTE: Pending mint recovery and MagicBlock mint request fetching removed

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

    // Bundle NFT ownership
    fetchAllBundleCollections: () => fetchAllBundleCollections(connection),
    fetchAllBundleRewardPools: () => fetchAllBundleRewardPools(connection),
    fetchBundleNftRewardStatesBatch: (nftAssets: PublicKey[]) => fetchBundleNftRewardStatesBatch(connection, nftAssets),
    fetchWalletBundleNftMetadata: (wallet: PublicKey) => fetchWalletBundleNftMetadata(connection, wallet),
    fetchWalletBundleNftMetadataWithCollections: (
      wallet: PublicKey,
      collectionToBundleInfo: Map<string, { bundleId: string; creator: PublicKey }>
    ) => fetchWalletBundleNftMetadataWithCollections(connection, wallet, collectionToBundleInfo),
    getBundlePendingRewardsOptimized: (
      wallet: PublicKey,
      walletBundleNfts: WalletBundleNftMetadata[],
      bundleRewardPools: Map<string, BundleRewardPool>,
      bundleCollections: Map<string, BundleCollection>
    ) => getBundlePendingRewardsOptimized(connection, wallet, walletBundleNfts, bundleRewardPools, bundleCollections),

    // Pending mint request helpers
    findPendingBundleMintRequests: (
      buyer: PublicKey,
      bundleId: string,
      creator: PublicKey,
      maxEdition: bigint
    ) => findPendingBundleMintRequests(connection, buyer, bundleId, creator, maxEdition),

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
              visibilityLevel: decoded.visibilityLevel,
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
              visibilityLevel: decoded.visibilityLevel,
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
              visibilityLevel: decoded.visibilityLevel ?? 0,
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
