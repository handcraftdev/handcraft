import { Program, AnchorProvider, Idl, BN } from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import { sha256 } from "js-sha256";
import idlJson from "./content_registry.json";

export const PROGRAM_ID = new PublicKey("A5xdpZf8AKfmmWP5wsH7T8Ea8GhSKRnbaxe5eWANVcHN");

// Seeds for PDA derivation
export const ECOSYSTEM_CONFIG_SEED = "ecosystem";
export const MINT_CONFIG_SEED = "mint_config";

// Fee constants (basis points)
export const PLATFORM_FEE_PRIMARY_BPS = 500;   // 5%
export const ECOSYSTEM_FEE_PRIMARY_BPS = 300;  // 3%
export const CREATOR_FEE_PRIMARY_BPS = 9200;   // 92%
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
export function calculatePrimarySplit(price: bigint): { creator: bigint; platform: bigint; ecosystem: bigint } {
  const zero = BigInt(0);
  if (price === zero) {
    return { creator: zero, platform: zero, ecosystem: zero };
  }
  const divisor = BigInt(10000);
  const platform = (price * BigInt(PLATFORM_FEE_PRIMARY_BPS)) / divisor;
  const ecosystem = (price * BigInt(ECOSYSTEM_FEE_PRIMARY_BPS)) / divisor;
  const creator = price - platform - ecosystem;
  return { creator, platform, ecosystem };
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
  contentType: ContentType
): Promise<TransactionInstruction> {
  const cidHash = hashCid(contentCid);
  const [contentPda] = getContentPda(contentCid);
  const [cidRegistryPda] = getCidRegistryPda(contentCid);

  return await program.methods
    .registerContent(Array.from(cidHash), contentCid, metadataCid, contentTypeToAnchor(contentType))
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
  creatorRoyaltyBps: number
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
      creatorRoyaltyBps
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

// Mint NFT with SOL payment
export async function mintNftSolInstruction(
  program: Program,
  buyer: PublicKey,
  contentCid: string,
  creator: PublicKey,
  treasury: PublicKey,
  platform: PublicKey | null
): Promise<TransactionInstruction> {
  const [contentPda] = getContentPda(contentCid);
  const [mintConfigPda] = getMintConfigPda(contentPda);
  const [ecosystemConfigPda] = getEcosystemConfigPda();

  const accounts: Record<string, PublicKey> = {
    ecosystemConfig: ecosystemConfigPda,
    content: contentPda,
    mintConfig: mintConfigPda,
    creator: creator,
    treasury: treasury,
    buyer: buyer,
    systemProgram: SystemProgram.programId,
  };

  // Add platform if provided
  if (platform) {
    accounts.platform = platform;
  }

  return await program.methods
    .mintNftSol()
    .accounts(accounts)
    .instruction();
}

// Mint NFT with USDC payment
export async function mintNftUsdcInstruction(
  program: Program,
  buyer: PublicKey,
  contentCid: string,
  creator: PublicKey,
  usdcMint: PublicKey,
  buyerTokenAccount: PublicKey,
  creatorTokenAccount: PublicKey,
  platformTokenAccount: PublicKey,
  treasuryTokenAccount: PublicKey
): Promise<TransactionInstruction> {
  const [contentPda] = getContentPda(contentCid);
  const [mintConfigPda] = getMintConfigPda(contentPda);
  const [ecosystemConfigPda] = getEcosystemConfigPda();

  return await program.methods
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
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
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
      contentType: ContentType
    ) => registerContentInstruction(program, authority, contentCid, metadataCid, contentType),

    registerContentWithMintInstruction: (
      authority: PublicKey,
      contentCid: string,
      metadataCid: string,
      contentType: ContentType,
      price: bigint,
      currency: PaymentCurrency,
      maxSupply: bigint | null,
      creatorRoyaltyBps: number
    ) => registerContentWithMintInstruction(
      program,
      authority,
      contentCid,
      metadataCid,
      contentType,
      price,
      currency,
      maxSupply,
      creatorRoyaltyBps
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

    // NFT minting
    mintNftSolInstruction: (
      buyer: PublicKey,
      contentCid: string,
      creator: PublicKey,
      treasury: PublicKey,
      platform: PublicKey | null
    ) => mintNftSolInstruction(program, buyer, contentCid, creator, treasury, platform),

    mintNftUsdcInstruction: (
      buyer: PublicKey,
      contentCid: string,
      creator: PublicKey,
      usdcMint: PublicKey,
      buyerTokenAccount: PublicKey,
      creatorTokenAccount: PublicKey,
      platformTokenAccount: PublicKey,
      treasuryTokenAccount: PublicKey
    ) => mintNftUsdcInstruction(program, buyer, contentCid, creator, usdcMint, buyerTokenAccount, creatorTokenAccount, platformTokenAccount, treasuryTokenAccount),

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

export const idl = idlJson;
