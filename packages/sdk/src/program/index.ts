import { Program, AnchorProvider, Idl, BN } from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram, TransactionInstruction, Keypair } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import { sha256 } from "js-sha256";
import idlJson from "./content_registry.json";

export const PROGRAM_ID = new PublicKey("A5xdpZf8AKfmmWP5wsH7T8Ea8GhSKRnbaxe5eWANVcHN");

// Metaplex Core Program ID
export const MPL_CORE_PROGRAM_ID = new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");

// Seeds for PDA derivation
export const ECOSYSTEM_CONFIG_SEED = "ecosystem";
export const MINT_CONFIG_SEED = "mint_config";

// Fee constants (basis points)
// Primary sale: Creator 80%, Platform 5%, Ecosystem 3%, Existing Holders 12%
export const PLATFORM_FEE_PRIMARY_BPS = 500;   // 5%
export const ECOSYSTEM_FEE_PRIMARY_BPS = 300;  // 3%
export const CREATOR_FEE_PRIMARY_BPS = 8000;   // 80%
export const HOLDER_REWARD_PRIMARY_BPS = 1200; // 12% - distributed equally to existing NFT holders
export const PLATFORM_FEE_SECONDARY_BPS = 100; // 1%
export const ECOSYSTEM_FEE_SECONDARY_BPS = 50; // 0.5%
export const MIN_CREATOR_ROYALTY_BPS = 200;    // 2%
export const MAX_CREATOR_ROYALTY_BPS = 1000;   // 10%

// Minimum prices
export const MIN_PRICE_LAMPORTS = 1_000_000;   // 0.001 SOL
export const MIN_PRICE_USDC = 10_000;          // 0.01 USDC (6 decimals)

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

// Payment currency enum
export enum PaymentCurrency {
  Sol = 0,
  Usdc = 1,
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
  // Access control fields
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

// Hash a CID string using SHA-256 (matches Solana's hash function)
export function hashCid(cid: string): Uint8Array {
  return new Uint8Array(sha256.array(cid));
}

// PDA derivation helpers - uses CID hash as seeds (32 bytes)
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

// Get ecosystem config PDA
export function getEcosystemConfigPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(ECOSYSTEM_CONFIG_SEED)],
    PROGRAM_ID
  );
}

// Get mint config PDA for a content entry
export function getMintConfigPda(contentPda: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(MINT_CONFIG_SEED), contentPda.toBuffer()],
    PROGRAM_ID
  );
}

// Convert PaymentCurrency enum to Anchor format
function paymentCurrencyToAnchor(currency: PaymentCurrency): object {
  switch (currency) {
    case PaymentCurrency.Sol: return { sol: {} };
    case PaymentCurrency.Usdc: return { usdc: {} };
    default: return { sol: {} };
  }
}

// Convert Anchor enum format to PaymentCurrency
function anchorToPaymentCurrency(anchorCurrency: Record<string, unknown>): PaymentCurrency {
  if (anchorCurrency.usdc) return PaymentCurrency.Usdc;
  return PaymentCurrency.Sol;
}

// Calculate primary sale split
// Returns { creator, platform, ecosystem, holderReward }
// If no existing holders, holderReward should be added to creator
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

// Convert ContentType enum to Anchor format
function contentTypeToAnchor(type: ContentType): object {
  switch (type) {
    // Video types
    case ContentType.Movie: return { movie: {} };
    case ContentType.TvSeries: return { tvSeries: {} };
    case ContentType.MusicVideo: return { musicVideo: {} };
    case ContentType.ShortVideo: return { shortVideo: {} };
    case ContentType.GeneralVideo: return { generalVideo: {} };
    // Book types
    case ContentType.Comic: return { comic: {} };
    case ContentType.GeneralBook: return { generalBook: {} };
    // Audio types
    case ContentType.Podcast: return { podcast: {} };
    case ContentType.Audiobook: return { audiobook: {} };
    case ContentType.GeneralAudio: return { generalAudio: {} };
    // Image types
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
  // Create a dummy provider for read-only operations
  const provider = {
    connection,
    publicKey: null,
  } as unknown as AnchorProvider;

  return new Program(idlJson as Idl, provider);
}

// Register content instruction using Anchor
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

// Register content with NFT mint config in one transaction
export async function registerContentWithMintInstruction(
  program: Program,
  authority: PublicKey,
  contentCid: string,
  metadataCid: string,
  contentType: ContentType,
  price: bigint,
  currency: PaymentCurrency,
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

  const currencyArg = currency === PaymentCurrency.Sol ? { sol: {} } : { usdc: {} };

  return await program.methods
    .registerContentWithMint(
      Array.from(cidHash),
      contentCid,
      metadataCid,
      contentTypeToAnchor(contentType),
      new BN(price.toString()),
      currencyArg,
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

// Tip content instruction using Anchor
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

// Update content instruction using Anchor
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

// Delete content instruction (only before first mint)
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

// Delete content with mint config instruction (only before first mint)
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

// Initialize ecosystem config (admin only, one-time)
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

// Update ecosystem config (admin only)
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

// Configure mint settings for content
export async function configureMintInstruction(
  program: Program,
  creator: PublicKey,
  contentCid: string,
  price: bigint,
  currency: PaymentCurrency,
  maxSupply: bigint | null,
  creatorRoyaltyBps: number
): Promise<TransactionInstruction> {
  const [contentPda] = getContentPda(contentCid);
  const [mintConfigPda] = getMintConfigPda(contentPda);

  return await program.methods
    .configureMint(
      new BN(price.toString()),
      paymentCurrencyToAnchor(currency),
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
  maxSupply: bigint | null | undefined, // undefined = don't change, null = unlimited
  creatorRoyaltyBps: number | null,
  isActive: boolean | null
): Promise<TransactionInstruction> {
  const [contentPda] = getContentPda(contentCid);
  const [mintConfigPda] = getMintConfigPda(contentPda);

  // For Option<Option<u64>> in Anchor:
  // - undefined in JS = don't change (pass null to Anchor = outer None)
  // - bigint in JS = set to value (Some(Some(value)))
  // - null in JS = set to unlimited (Some(None)) - NOT SUPPORTED by Anchor TS client
  //
  // Due to Anchor TypeScript client limitations, we cannot easily represent Some(None).
  // So we only support: undefined = don't change, bigint = set specific value

  let maxSupplyArg: BN | null;
  if (maxSupply === undefined || maxSupply === null) {
    // Don't change - passing null means outer None in Anchor
    // Note: null from JS would mean "set unlimited" but we can't represent that,
    // so we treat it as "don't change" for safety
    maxSupplyArg = null;
  } else {
    maxSupplyArg = new BN(maxSupply.toString()); // Some(Some(value))
  }

  console.log("updateMintSettings - maxSupply input:", maxSupply, "-> arg:", maxSupplyArg);

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

// Result type for mint NFT instructions (includes the NFT asset keypair that must sign)
export interface MintNftResult {
  instruction: TransactionInstruction;
  nftAssetKeypair: Keypair;
}

// Mint NFT with SOL payment
// existingHolders: Array of wallet addresses that own NFTs for this content
// They will receive 12% of the sale price distributed equally
export async function mintNftSolInstruction(
  program: Program,
  buyer: PublicKey,
  contentCid: string,
  creator: PublicKey,
  treasury: PublicKey,
  platform: PublicKey,
  existingHolders: PublicKey[] = []
): Promise<MintNftResult> {
  const [contentPda] = getContentPda(contentCid);
  const [mintConfigPda] = getMintConfigPda(contentPda);
  const [ecosystemConfigPda] = getEcosystemConfigPda();

  // Generate a new keypair for the NFT asset
  const nftAssetKeypair = Keypair.generate();

  // Build remaining accounts for existing holders (they receive 12% holder reward)
  const remainingAccounts = existingHolders.map((holder) => ({
    pubkey: holder,
    isWritable: true,
    isSigner: false,
  }));

  const instruction = await program.methods
    .mintNftSol()
    .accounts({
      ecosystemConfig: ecosystemConfigPda,
      content: contentPda,
      mintConfig: mintConfigPda,
      creator: creator,
      platform: platform,
      treasury: treasury,
      buyer: buyer,
      nftAsset: nftAssetKeypair.publicKey,
      mplCoreProgram: MPL_CORE_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .remainingAccounts(remainingAccounts)
    .instruction();

  return { instruction, nftAssetKeypair };
}

// Mint NFT with USDC payment
// existingHolderTokenAccounts: Array of USDC token accounts of existing NFT holders
// They will receive 12% of the sale price distributed equally
export async function mintNftUsdcInstruction(
  program: Program,
  buyer: PublicKey,
  contentCid: string,
  creator: PublicKey,
  usdcMint: PublicKey,
  buyerTokenAccount: PublicKey,
  creatorTokenAccount: PublicKey,
  platformTokenAccount: PublicKey,
  treasuryTokenAccount: PublicKey,
  existingHolderTokenAccounts: PublicKey[] = []
): Promise<MintNftResult> {
  const [contentPda] = getContentPda(contentCid);
  const [mintConfigPda] = getMintConfigPda(contentPda);
  const [ecosystemConfigPda] = getEcosystemConfigPda();

  // Generate a new keypair for the NFT asset
  const nftAssetKeypair = Keypair.generate();

  // Build remaining accounts for existing holder token accounts (they receive 12% holder reward)
  const remainingAccounts = existingHolderTokenAccounts.map((tokenAccount) => ({
    pubkey: tokenAccount,
    isWritable: true,
    isSigner: false,
  }));

  const instruction = await program.methods
    .mintNftUsdc()
    .accounts({
      ecosystemConfig: ecosystemConfigPda,
      content: contentPda,
      mintConfig: mintConfigPda,
      creator: creator,
      buyer: buyer,
      buyerTokenAccount: buyerTokenAccount,
      creatorTokenAccount: creatorTokenAccount,
      platformTokenAccount: platformTokenAccount,
      treasuryTokenAccount: treasuryTokenAccount,
      nftAsset: nftAssetKeypair.publicKey,
      mplCoreProgram: MPL_CORE_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .remainingAccounts(remainingAccounts)
    .instruction();

  return { instruction, nftAssetKeypair };
}

// Account fetching helpers
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

// Fetch mint config for content
export async function fetchMintConfig(
  connection: Connection,
  contentCid: string
): Promise<MintConfig | null> {
  const program = createProgram(connection);
  const [contentPda] = getContentPda(contentCid);
  const [mintConfigPda] = getMintConfigPda(contentPda);

  console.log("fetchMintConfig for CID:", contentCid);
  console.log("Content PDA:", contentPda.toBase58());
  console.log("MintConfig PDA:", mintConfigPda.toBase58());

  try {
    const account = await (program.account as any).mintConfig.fetch(mintConfigPda);

    console.log("Raw mint config account:", {
      price: account.price?.toString(),
      currency: account.currency,
      maxSupply: account.maxSupply?.toString(),
      creatorRoyaltyBps: account.creatorRoyaltyBps,
      isActive: account.isActive,
    });

    const result = {
      content: account.content,
      creator: account.creator,
      price: BigInt(account.price.toString()),
      currency: anchorToPaymentCurrency(account.currency),
      maxSupply: account.maxSupply ? BigInt(account.maxSupply.toString()) : null,
      creatorRoyaltyBps: account.creatorRoyaltyBps,
      isActive: account.isActive,
      createdAt: BigInt(account.createdAt.toString()),
      updatedAt: BigInt(account.updatedAt.toString()),
    };

    console.log("Parsed mint config:", {
      price: result.price.toString(),
      currency: result.currency,
      maxSupply: result.maxSupply?.toString(),
      creatorRoyaltyBps: result.creatorRoyaltyBps,
    });

    return result;
  } catch (err) {
    console.error("Error fetching mint config:", err);
    return null;
  }
}

// Fetch ecosystem config
export async function fetchEcosystemConfig(
  connection: Connection
): Promise<EcosystemConfig | null> {
  const program = createProgram(connection);
  const [ecosystemConfigPda] = getEcosystemConfigPda();

  console.log("Fetching ecosystem config from PDA:", ecosystemConfigPda.toBase58());

  try {
    const account = await (program.account as any).ecosystemConfig.fetch(ecosystemConfigPda);

    const config = {
      admin: account.admin,
      treasury: account.treasury,
      usdcMint: account.usdcMint,
      totalFeesSol: BigInt(account.totalFeesSol.toString()),
      totalFeesUsdc: BigInt(account.totalFeesUsdc.toString()),
      totalNftsMinted: BigInt(account.totalNftsMinted.toString()),
      isPaused: account.isPaused,
      createdAt: BigInt(account.createdAt.toString()),
    };

    console.log("Ecosystem config loaded:", {
      admin: config.admin.toBase58(),
      treasury: config.treasury.toBase58(),
    });

    return config;
  } catch (err) {
    console.error("Error fetching ecosystem config:", err);
    return null;
  }
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
      currency: PaymentCurrency,
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
      currency,
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

    // Mint configuration
    configureMintInstruction: (
      creator: PublicKey,
      contentCid: string,
      price: bigint,
      currency: PaymentCurrency,
      maxSupply: bigint | null,
      creatorRoyaltyBps: number
    ) => configureMintInstruction(program, creator, contentCid, price, currency, maxSupply, creatorRoyaltyBps),

    updateMintSettingsInstruction: (
      creator: PublicKey,
      contentCid: string,
      price: bigint | null,
      maxSupply: bigint | null | undefined,
      creatorRoyaltyBps: number | null,
      isActive: boolean | null
    ) => updateMintSettingsInstruction(program, creator, contentCid, price, maxSupply, creatorRoyaltyBps, isActive),

    // NFT minting - returns { instruction, nftAssetKeypair }
    // The nftAssetKeypair MUST be added as a signer to the transaction
    // existingHolders: Array of wallet addresses that own NFTs for this content
    // They will receive 12% of the sale price distributed equally
    mintNftSolInstruction: (
      buyer: PublicKey,
      contentCid: string,
      creator: PublicKey,
      treasury: PublicKey,
      platform: PublicKey,
      existingHolders: PublicKey[] = []
    ): Promise<MintNftResult> => mintNftSolInstruction(program, buyer, contentCid, creator, treasury, platform, existingHolders),

    // existingHolderTokenAccounts: Array of USDC token accounts of existing NFT holders
    mintNftUsdcInstruction: (
      buyer: PublicKey,
      contentCid: string,
      creator: PublicKey,
      usdcMint: PublicKey,
      buyerTokenAccount: PublicKey,
      creatorTokenAccount: PublicKey,
      platformTokenAccount: PublicKey,
      treasuryTokenAccount: PublicKey,
      existingHolderTokenAccounts: PublicKey[] = []
    ): Promise<MintNftResult> => mintNftUsdcInstruction(program, buyer, contentCid, creator, usdcMint, buyerTokenAccount, creatorTokenAccount, platformTokenAccount, treasuryTokenAccount, existingHolderTokenAccounts),

    // Ecosystem management (admin)
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

    // NFT ownership check and counting
    checkNftOwnership: (wallet: PublicKey, contentCid: string) =>
      checkNftOwnership(connection, wallet, contentCid),
    countNftsOwned: (wallet: PublicKey, contentCid: string) =>
      countNftsOwned(connection, wallet, contentCid),
    countTotalMintedNfts: (contentCid: string) =>
      countTotalMintedNfts(connection, contentCid),
    // Batch fetch all wallet NFT metadata (more efficient)
    fetchWalletNftMetadata: (wallet: PublicKey) =>
      fetchWalletNftMetadata(connection, wallet),
    // Get unique NFT holders for a content (for holder reward distribution)
    getContentNftHolders: (contentCid: string) =>
      getContentNftHolders(connection, contentCid),

    // Fetch all content from all creators (global feed)
    async fetchGlobalContent(): Promise<ContentEntry[]> {
      console.log("Fetching global content...");
      try {
        const accounts = await connection.getProgramAccounts(PROGRAM_ID);
        console.log("Found", accounts.length, "total program accounts");

        const entries: ContentEntry[] = [];
        for (const { pubkey, account } of accounts) {
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
            // Not a content entry, skip
          }
        }

        entries.sort((a, b) => Number(b.createdAt - a.createdAt));
        console.log("Total content entries:", entries.length);
        return entries;
      } catch (err) {
        console.error("Error fetching global content:", err);
        return [];
      }
    },

    // Fetch all content by a specific creator
    async fetchContentByCreator(creator: PublicKey): Promise<ContentEntry[]> {
      console.log("Fetching content for creator:", creator.toBase58());
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
            // Not a content entry, skip
          }
        }

        entries.sort((a, b) => Number(b.createdAt - a.createdAt));
        console.log("Total entries for creator:", entries.length);
        return entries;
      } catch (err) {
        console.error("Error fetching creator content:", err);
        return [];
      }
    },

    // Fetch all mintable content (content with mint config)
    async fetchMintableContent(): Promise<Array<{ content: ContentEntry; mintConfig: MintConfig }>> {
      console.log("Fetching mintable content...");
      try {
        const accounts = await connection.getProgramAccounts(PROGRAM_ID);
        const results: Array<{ content: ContentEntry; mintConfig: MintConfig }> = [];

        // First, collect all content entries
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

        // Then, find mint configs and match with content
        for (const { account } of accounts) {
          try {
            const decoded = program.coder.accounts.decode("mintConfig", account.data);

            // Find matching content
            for (const [cid, content] of contentEntries) {
              const [contentPda] = getContentPda(cid);
              if (contentPda.equals(decoded.content)) {
                results.push({
                  content,
                  mintConfig: {
                    content: decoded.content,
                    creator: decoded.creator,
                    price: BigInt(decoded.price.toString()),
                    currency: anchorToPaymentCurrency(decoded.currency),
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

        // Sort by creation date (newest first)
        results.sort((a, b) => Number(b.content.createdAt - a.content.createdAt));
        console.log("Total mintable content:", results.length);
        return results;
      } catch (err) {
        console.error("Error fetching mintable content:", err);
        return [];
      }
    },
  };
}

/**
 * NFT metadata with content CID for ownership tracking
 */
export interface WalletNftMetadata {
  assetPubkey: string;
  uri: string;
  contentCid: string | null;
}

/**
 * Fetch all NFT metadata for a wallet in one batch
 * This is more efficient than calling countNftsOwned for each content
 */
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

    console.log(`fetchWalletNftMetadata: Found ${accounts.length} assets for wallet ${wallet.toBase58()}`);

    // Parse URIs from all assets
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

    // Fetch all metadata in parallel (with concurrency limit)
    const results: WalletNftMetadata[] = [];
    const BATCH_SIZE = 5;

    for (let i = 0; i < assetsWithUris.length; i += BATCH_SIZE) {
      const batch = assetsWithUris.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async ({ pubkey, uri }) => {
          let contentCid: string | null = null;

          // Try to extract contentCid from URI or metadata
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
  } catch (err) {
    console.error("Error fetching wallet NFT metadata:", err);
    return [];
  }
}

// Helper to extract CID from IPFS URL
function extractCidFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const match = url.match(/Qm[a-zA-Z0-9]{44,}/);
  return match ? match[0] : null;
}

// Check if a wallet owns an NFT for a specific content
// This queries Metaplex Core assets owned by the wallet and checks if any reference this content
/**
 * Count how many NFTs the wallet owns for a specific content
 * Returns the count (0 if none)
 * @deprecated Use fetchWalletNftMetadata for batch queries instead
 */
export async function countNftsOwned(
  connection: Connection,
  wallet: PublicKey,
  contentCid: string
): Promise<number> {
  try {
    // Get all Metaplex Core assets owned by the wallet
    // AssetV1 account structure:
    // - Byte 0: Key discriminator (1 = AssetV1)
    // - Bytes 1-32: Owner (32 bytes)
    // - Bytes 33-65: UpdateAuthority (33 bytes - includes type prefix)
    // - Then: name, uri, etc.
    const accounts = await connection.getProgramAccounts(MPL_CORE_PROGRAM_ID, {
      filters: [
        {
          // Filter for AssetV1 accounts (key = 1)
          memcmp: {
            offset: 0,
            bytes: "2", // base58 encoding of byte value 1
          },
        },
        {
          // Owner pubkey at offset 1 (right after the 1-byte key discriminator)
          memcmp: {
            offset: 1,
            bytes: wallet.toBase58(),
          },
        },
      ],
    });

    console.log(`countNftsOwned: Found ${accounts.length} assets for wallet ${wallet.toBase58()}`);

    let count = 0;

    // Check each asset's URI to see if it references our content
    for (const { pubkey, account } of accounts) {
      const data = account.data;

      try {
        // Parse URI from asset data
        // AssetV1 structure:
        // - key(1) + owner(32) + updateAuthority(33) + name(4+len) + uri(4+len)
        // UpdateAuthority has a 1-byte type prefix + 32-byte address = 33 bytes
        const nameOffset = 1 + 32 + 33; // 66
        const nameLen = data.readUInt32LE(nameOffset);
        const uriOffset = nameOffset + 4 + nameLen;
        const uriLen = data.readUInt32LE(uriOffset);
        const uri = data.slice(uriOffset + 4, uriOffset + 4 + uriLen).toString("utf8");

        console.log(`  Asset ${pubkey.toBase58()}: URI = ${uri}`);

        // Check if URI contains the content CID
        if (uri.includes(contentCid)) {
          count++;
          continue;
        }

        // Also fetch metadata to check contentCid property
        if (uri.startsWith("https://")) {
          try {
            const response = await fetch(uri, { signal: AbortSignal.timeout(5000) });
            if (response.ok) {
              const metadata = await response.json();
              console.log(`    Metadata contentCid: ${metadata.contentCid}, looking for: ${contentCid}`);
              if (
                metadata.contentCid === contentCid ||
                metadata.properties?.content_cid === contentCid ||
                metadata.image?.includes(contentCid) ||
                metadata.animation_url?.includes(contentCid) ||
                metadata.contentUrl?.includes(contentCid)
              ) {
                console.log(`    MATCH FOUND!`);
                count++;
              }
            }
          } catch (err) {
            console.log(`    Fetch error:`, err);
            // Ignore fetch errors, continue checking
          }
        }
      } catch {
        // Skip malformed assets
      }
    }

    return count;
  } catch (err) {
    console.error("Error counting NFT ownership:", err);
    return 0;
  }
}

/**
 * Check if wallet owns at least one NFT for a content (convenience wrapper)
 */
export async function checkNftOwnership(
  connection: Connection,
  wallet: PublicKey,
  contentCid: string
): Promise<boolean> {
  const count = await countNftsOwned(connection, wallet, contentCid);
  return count > 0;
}

/**
 * Get all unique NFT holder addresses for a specific content
 * Used to distribute holder rewards during minting
 */
export async function getContentNftHolders(
  connection: Connection,
  contentCid: string
): Promise<PublicKey[]> {
  try {
    // Get ALL Metaplex Core AssetV1 accounts
    const accounts = await connection.getProgramAccounts(MPL_CORE_PROGRAM_ID, {
      filters: [
        { memcmp: { offset: 0, bytes: "2" } }, // AssetV1
      ],
    });

    console.log(`getContentNftHolders: Checking ${accounts.length} total assets for contentCid ${contentCid}`);

    const holders = new Set<string>();

    // Check each asset to see if it references our content
    for (const { account } of accounts) {
      const data = account.data;

      try {
        // Parse owner from asset data (bytes 1-32)
        const ownerBytes = data.slice(1, 33);
        const owner = new PublicKey(ownerBytes);

        // Parse URI from asset data
        const nameOffset = 1 + 32 + 33;
        const nameLen = data.readUInt32LE(nameOffset);
        const uriOffset = nameOffset + 4 + nameLen;
        const uriLen = data.readUInt32LE(uriOffset);
        const uri = data.slice(uriOffset + 4, uriOffset + 4 + uriLen).toString("utf8");

        // Check if URI contains the content CID
        if (uri.includes(contentCid)) {
          holders.add(owner.toBase58());
          continue;
        }

        // Also fetch metadata to check contentCid property
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

    console.log(`getContentNftHolders: Found ${holders.size} unique holders for contentCid ${contentCid}`);
    return Array.from(holders).map(addr => new PublicKey(addr));
  } catch (err) {
    console.error("Error getting content NFT holders:", err);
    return [];
  }
}

/**
 * Count total NFTs minted for a content by checking all Metaplex Core assets
 * This provides accurate on-chain count regardless of program state
 */
export async function countTotalMintedNfts(
  connection: Connection,
  contentCid: string
): Promise<number> {
  try {
    // Get ALL Metaplex Core AssetV1 accounts
    const accounts = await connection.getProgramAccounts(MPL_CORE_PROGRAM_ID, {
      filters: [
        {
          // Filter for AssetV1 accounts (key = 1)
          memcmp: {
            offset: 0,
            bytes: "2", // base58 encoding of byte value 1
          },
        },
      ],
    });

    console.log(`countTotalMintedNfts: Checking ${accounts.length} total assets for contentCid ${contentCid}`);

    let count = 0;

    // Check each asset's URI to see if it references our content
    for (const { pubkey, account } of accounts) {
      const data = account.data;

      try {
        // Parse URI from asset data
        const nameOffset = 1 + 32 + 33; // 66
        const nameLen = data.readUInt32LE(nameOffset);
        const uriOffset = nameOffset + 4 + nameLen;
        const uriLen = data.readUInt32LE(uriOffset);
        const uri = data.slice(uriOffset + 4, uriOffset + 4 + uriLen).toString("utf8");

        // Check if URI contains the content CID
        if (uri.includes(contentCid)) {
          count++;
          continue;
        }

        // Also fetch metadata to check contentCid property
        if (uri.startsWith("https://")) {
          try {
            const response = await fetch(uri, { signal: AbortSignal.timeout(5000) });
            if (response.ok) {
              const metadata = await response.json();
              if (
                metadata.contentCid === contentCid ||
                metadata.properties?.content_cid === contentCid ||
                metadata.image?.includes(contentCid) ||
                metadata.animation_url?.includes(contentCid) ||
                metadata.contentUrl?.includes(contentCid)
              ) {
                count++;
              }
            }
          } catch {
            // Ignore fetch errors, continue checking
          }
        }
      } catch {
        // Skip malformed assets
      }
    }

    console.log(`countTotalMintedNfts: Found ${count} NFTs for content ${contentCid}`);
    return count;
  } catch (err) {
    console.error("Error counting total minted NFTs:", err);
    return 0;
  }
}

export const idl = idlJson;
