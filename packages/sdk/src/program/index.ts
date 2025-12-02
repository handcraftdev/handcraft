import { Program, AnchorProvider, Idl, BN } from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import idlJson from "./content_registry.json";

export const PROGRAM_ID = new PublicKey("25WLThAnXWyNZcTLJpXkx6Gh7b7Go9DNNiZrZdWEKabi");

export enum ContentType {
  Video = 0,
  Audio = 1,
  Image = 2,
  Post = 3,
  Stream = 4,
}

export interface CreatorProfile {
  authority: PublicKey;
  username: string;
  contentCount: bigint;
  totalTips: bigint;
  createdAt: bigint;
}

export interface ContentEntry {
  creator: PublicKey;
  contentCid: string;
  metadataCid: string;
  contentType: ContentType;
  tipsReceived: bigint;
  createdAt: bigint;
  index: bigint;
}

// PDA derivation helpers
export function getProfilePda(authority: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("profile"), authority.toBuffer()],
    PROGRAM_ID
  );
}

export function getContentPda(authority: PublicKey, index: bigint | number): [PublicKey, number] {
  const indexBuffer = Buffer.alloc(8);
  indexBuffer.writeBigUInt64LE(BigInt(index));
  return PublicKey.findProgramAddressSync(
    [Buffer.from("content"), authority.toBuffer(), indexBuffer],
    PROGRAM_ID
  );
}

// Convert ContentType enum to Anchor format
function contentTypeToAnchor(type: ContentType): object {
  switch (type) {
    case ContentType.Video: return { video: {} };
    case ContentType.Audio: return { audio: {} };
    case ContentType.Image: return { image: {} };
    case ContentType.Post: return { post: {} };
    case ContentType.Stream: return { stream: {} };
    default: return { post: {} };
  }
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

// Create profile instruction using Anchor
export async function createProfileInstruction(
  program: Program,
  authority: PublicKey,
  username: string
): Promise<TransactionInstruction> {
  const [profilePda] = getProfilePda(authority);

  return await program.methods
    .createProfile(username)
    .accounts({
      profile: profilePda,
      authority: authority,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

// Create content instruction using Anchor
export async function createContentInstruction(
  program: Program,
  authority: PublicKey,
  contentIndex: bigint | number,
  contentCid: string,
  metadataCid: string,
  contentType: ContentType
): Promise<TransactionInstruction> {
  const [profilePda] = getProfilePda(authority);
  const [contentPda] = getContentPda(authority, contentIndex);

  return await program.methods
    .createContent(contentCid, metadataCid, contentTypeToAnchor(contentType))
    .accounts({
      content: contentPda,
      profile: profilePda,
      authority: authority,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

// Tip content instruction using Anchor
export async function tipContentInstruction(
  program: Program,
  tipper: PublicKey,
  contentPda: PublicKey,
  creator: PublicKey,
  amount: bigint | number
): Promise<TransactionInstruction> {
  const [creatorProfilePda] = getProfilePda(creator);

  return await program.methods
    .tipContent(new BN(amount.toString()))
    .accounts({
      content: contentPda,
      profile: creatorProfilePda,
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
  contentPda: PublicKey,
  metadataCid: string
): Promise<TransactionInstruction> {
  return await program.methods
    .updateContent(metadataCid)
    .accounts({
      content: contentPda,
      creator: creator,
    })
    .instruction();
}

// Account fetching helpers
export async function fetchProfile(
  connection: Connection,
  authority: PublicKey
): Promise<CreatorProfile | null> {
  const program = createProgram(connection);
  const [pda] = getProfilePda(authority);

  try {
    const account = await (program.account as any).creatorProfile.fetch(pda);
    return {
      authority: account.authority,
      username: account.username,
      contentCount: BigInt(account.contentCount.toString()),
      totalTips: BigInt(account.totalTips.toString()),
      createdAt: BigInt(account.createdAt.toString()),
    };
  } catch {
    return null;
  }
}

export async function fetchContent(
  connection: Connection,
  authority: PublicKey,
  index: bigint | number
): Promise<ContentEntry | null> {
  const program = createProgram(connection);
  const [pda] = getContentPda(authority, index);

  try {
    const account = await (program.account as any).contentEntry.fetch(pda);

    // Convert Anchor enum to our enum
    let contentType = ContentType.Post;
    if (account.contentType.video) contentType = ContentType.Video;
    else if (account.contentType.audio) contentType = ContentType.Audio;
    else if (account.contentType.image) contentType = ContentType.Image;
    else if (account.contentType.stream) contentType = ContentType.Stream;

    return {
      creator: account.creator,
      contentCid: account.contentCid,
      metadataCid: account.metadataCid,
      contentType,
      tipsReceived: BigInt(account.tipsReceived.toString()),
      createdAt: BigInt(account.createdAt.toString()),
      index: BigInt(account.index.toString()),
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
    getProfilePda,
    getContentPda,

    createProfileInstruction: (authority: PublicKey, username: string) =>
      createProfileInstruction(program, authority, username),
    createContentInstruction: (
      authority: PublicKey,
      contentIndex: bigint | number,
      contentCid: string,
      metadataCid: string,
      contentType: ContentType
    ) => createContentInstruction(program, authority, contentIndex, contentCid, metadataCid, contentType),
    tipContentInstruction: (
      tipper: PublicKey,
      contentPda: PublicKey,
      creator: PublicKey,
      amount: bigint | number
    ) => tipContentInstruction(program, tipper, contentPda, creator, amount),
    updateContentInstruction: (
      creator: PublicKey,
      contentPda: PublicKey,
      metadataCid: string
    ) => updateContentInstruction(program, creator, contentPda, metadataCid),

    fetchProfile: (authority: PublicKey) => fetchProfile(connection, authority),
    fetchContent: (authority: PublicKey, index: bigint | number) => fetchContent(connection, authority, index),

    // Convenience method to get all content for a creator
    async fetchAllContent(authority: PublicKey): Promise<ContentEntry[]> {
      const profile = await fetchProfile(connection, authority);
      if (!profile) return [];

      const entries: ContentEntry[] = [];
      for (let i = BigInt(0); i < profile.contentCount; i++) {
        const entry = await fetchContent(connection, authority, i);
        if (entry) entries.push(entry);
      }
      return entries;
    },
  };
}

export const idl = idlJson;
