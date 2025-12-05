// Re-export from modules
export * from "./constants";
export * from "./types";
export * from "./pda";

// Main program code
import { Program, AnchorProvider, Idl, BN } from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram, TransactionInstruction, Keypair } from "@solana/web3.js";
import idlJson from "./content_registry.json";

import {
  PROGRAM_ID,
  MPL_CORE_PROGRAM_ID,
  ContentType,
  PaymentCurrency,
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
  calculatePendingRewardForNft,
} from "./pda";

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
  }
}

// Convert Anchor format to ContentType enum
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function anchorToContentType(anchorType: any): ContentType {
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
  isEncrypted: boolean = false,
  previewCid: string = "",
  encryptionMetaCid: string = ""
): Promise<RegisterContentWithMintResult> {
  const cidHash = hashCid(contentCid);
  const [contentPda] = getContentPda(contentCid);
  const [cidRegistryPda] = getCidRegistryPda(contentCid);
  const [mintConfigPda] = getMintConfigPda(contentPda);
  const [contentCollectionPda] = getContentCollectionPda(contentPda);

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
// FETCH FUNCTIONS
// ============================================

export async function fetchContent(
  connection: Connection,
  contentCid: string
): Promise<ContentEntry | null> {
  try {
    const program = createProgram(connection);
    const [contentPda] = getContentPda(contentCid);

    const account = await connection.getAccountInfo(contentPda);
    if (!account) return null;

    const decoded = program.coder.accounts.decode("contentEntry", account.data);

    return {
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
    const account = await connection.getAccountInfo(pda);
    if (!account) return null;

    const decoded = program.coder.accounts.decode("contentEntry", account.data);

    return {
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

    const account = await connection.getAccountInfo(mintConfigPda);
    if (!account) return null;

    const decoded = program.coder.accounts.decode("mintConfig", account.data);

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

export async function fetchEcosystemConfig(
  connection: Connection
): Promise<EcosystemConfig | null> {
  try {
    const program = createProgram(connection);
    const [ecosystemConfigPda] = getEcosystemConfigPda();

    const account = await connection.getAccountInfo(ecosystemConfigPda);
    if (!account) return null;

    const decoded = program.coder.accounts.decode("ecosystemConfig", account.data);

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

    const account = await connection.getAccountInfo(rewardPoolPda);
    if (!account) return null;

    const decoded = program.coder.accounts.decode("contentRewardPool", account.data);

    return {
      content: decoded.content,
      rewardPerShare: BigInt(decoded.rewardPerShare.toString()),
      totalNfts: BigInt(decoded.totalNfts.toString()),
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

    const account = await connection.getAccountInfo(contentCollectionPda);
    if (!account) return null;

    const decoded = program.coder.accounts.decode("contentCollection", account.data);

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

    const account = await connection.getAccountInfo(walletStatePda);
    if (!account) return null;

    const decoded = program.coder.accounts.decode("walletContentState", account.data);

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

    const account = await connection.getAccountInfo(nftRewardStatePda);
    if (!account) return null;

    const decoded = program.coder.accounts.decode("nftRewardState", account.data);

    return {
      nftAsset: decoded.nftAsset,
      content: decoded.content,
      rewardDebt: BigInt(decoded.rewardDebt.toString()),
      createdAt: BigInt(decoded.createdAt.toString()),
    };
  } catch {
    return null;
  }
}

export async function getPendingRewardForContent(
  connection: Connection,
  wallet: PublicKey,
  contentCid: string
): Promise<bigint> {
  const rewardPool = await fetchContentRewardPool(connection, contentCid);
  const walletState = await fetchWalletContentState(connection, wallet, contentCid);

  if (!rewardPool || !walletState) return BigInt(0);
  if (walletState.nftCount === BigInt(0)) return BigInt(0);

  const accumulated = (walletState.nftCount * rewardPool.rewardPerShare) / BigInt("1000000000000");
  return accumulated > walletState.rewardDebt ? accumulated - walletState.rewardDebt : BigInt(0);
}

export async function getPendingRewardsForWallet(
  connection: Connection,
  wallet: PublicKey,
  contentCids: string[]
): Promise<Array<{ contentCid: string; pending: bigint; nftCount: bigint }>> {
  const results: Array<{ contentCid: string; pending: bigint; nftCount: bigint }> = [];

  for (const contentCid of contentCids) {
    const rewardPool = await fetchContentRewardPool(connection, contentCid);
    const walletState = await fetchWalletContentState(connection, wallet, contentCid);

    if (!rewardPool || !walletState) {
      results.push({ contentCid, pending: BigInt(0), nftCount: BigInt(0) });
      continue;
    }

    const nftCount = walletState.nftCount;
    if (nftCount === BigInt(0)) {
      results.push({ contentCid, pending: BigInt(0), nftCount });
      continue;
    }

    const accumulated = (nftCount * rewardPool.rewardPerShare) / BigInt("1000000000000");
    const pending = accumulated > walletState.rewardDebt ? accumulated - walletState.rewardDebt : BigInt(0);
    results.push({ contentCid, pending, nftCount });
  }

  return results;
}

export async function fetchWalletNftMetadata(
  connection: Connection,
  wallet: PublicKey
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

        let contentCid: string | null = null;
        if (collectionAsset) {
          const program = createProgram(connection);
          const allAccounts = await connection.getProgramAccounts(PROGRAM_ID);
          for (const { account: acc } of allAccounts) {
            try {
              const decoded = program.coder.accounts.decode("contentCollection", acc.data);
              if (decoded.collectionAsset.equals(collectionAsset)) {
                const contentAccount = await connection.getAccountInfo(decoded.content);
                if (contentAccount) {
                  const contentDecoded = program.coder.accounts.decode("contentEntry", contentAccount.data);
                  contentCid = contentDecoded.contentCid;
                }
                break;
              }
            } catch {
              // Not a content collection
            }
          }
        }

        results.push({
          nftAsset: pubkey,
          contentCid,
          collectionAsset,
          name,
        });
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

    const accounts = await connection.getProgramAccounts(PROGRAM_ID);
    const holders: Array<{ wallet: PublicKey; nftCount: bigint }> = [];

    for (const { account } of accounts) {
      try {
        const decoded = program.coder.accounts.decode("walletContentState", account.data);
        if (decoded.content.equals(contentPda) && decoded.nftCount > 0) {
          holders.push({
            wallet: decoded.wallet,
            nftCount: BigInt(decoded.nftCount.toString()),
          });
        }
      } catch {
        // Not a wallet content state
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
      program, authority, contentCid, metadataCid, contentType, price, maxSupply, creatorRoyaltyBps, isEncrypted, previewCid, encryptionMetaCid
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

    // NFT minting
    mintNftSolInstruction: (buyer: PublicKey, contentCid: string, creator: PublicKey, treasury: PublicKey, platform: PublicKey, collectionAsset: PublicKey): Promise<MintNftResult> =>
      mintNftSolInstruction(program, buyer, contentCid, creator, treasury, platform, collectionAsset),

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

    // Ecosystem management
    initializeEcosystemInstruction: (admin: PublicKey, treasury: PublicKey, usdcMint: PublicKey) =>
      initializeEcosystemInstruction(program, admin, treasury, usdcMint),

    updateEcosystemInstruction: (admin: PublicKey, newTreasury: PublicKey | null, newUsdcMint: PublicKey | null, isPaused: boolean | null) =>
      updateEcosystemInstruction(program, admin, newTreasury, newUsdcMint, isPaused),

    // Fetching
    fetchContent: (contentCid: string) => fetchContent(connection, contentCid),
    fetchContentByPda: (pda: PublicKey) => fetchContentByPda(connection, pda),
    fetchMintConfig: (contentCid: string) => fetchMintConfig(connection, contentCid),
    fetchEcosystemConfig: () => fetchEcosystemConfig(connection),
    fetchContentRewardPool: (contentCid: string) => fetchContentRewardPool(connection, contentCid),
    fetchContentCollection: (contentCid: string) => fetchContentCollection(connection, contentCid),
    fetchWalletContentState: (wallet: PublicKey, contentCid: string) => fetchWalletContentState(connection, wallet, contentCid),
    fetchNftRewardState: (nftAsset: PublicKey) => fetchNftRewardState(connection, nftAsset),

    // Reward calculations
    getPendingRewardForContent: (wallet: PublicKey, contentCid: string) => getPendingRewardForContent(connection, wallet, contentCid),
    getPendingRewardsForWallet: (wallet: PublicKey, contentCids: string[]) => getPendingRewardsForWallet(connection, wallet, contentCids),

    // NFT ownership
    checkNftOwnership: (wallet: PublicKey, contentCid: string) => checkNftOwnership(connection, wallet, contentCid),
    countNftsOwned: (wallet: PublicKey, contentCid: string) => countNftsOwned(connection, wallet, contentCid),
    countTotalMintedNfts: (contentCid: string) => countTotalMintedNfts(connection, contentCid),
    fetchWalletNftMetadata: (wallet: PublicKey) => fetchWalletNftMetadata(connection, wallet),
    getContentNftHolders: (contentCid: string) => getContentNftHolders(connection, contentCid),
    fetchWalletNftsForCollection: (wallet: PublicKey, collectionAsset: PublicKey) => fetchWalletNftsForCollection(connection, wallet, collectionAsset),

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

        return entries.sort((a, b) => Number(b.createdAt - a.createdAt));
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

        return entries.sort((a, b) => Number(b.createdAt - a.createdAt));
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
                    priceSol: BigInt(decoded.price.toString()),
                    maxSupply: decoded.maxSupply ? BigInt(decoded.maxSupply.toString()) : null,
                    creatorRoyaltyBps: decoded.creatorRoyaltyBps,
                    isActive: decoded.isActive,
                    createdAt: BigInt(decoded.createdAt.toString()),
                  },
                });
                break;
              }
            }
          } catch {
            // Not a mint config
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
