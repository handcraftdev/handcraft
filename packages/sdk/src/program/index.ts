import { Connection, PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";

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

export function getContentPda(authority: PublicKey, index: bigint): [PublicKey, number] {
  const indexBuffer = Buffer.alloc(8);
  indexBuffer.writeBigUInt64LE(index);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("content"), authority.toBuffer(), indexBuffer],
    PROGRAM_ID
  );
}

// Instruction discriminators (from IDL)
const DISCRIMINATORS = {
  createProfile: Buffer.from([225, 205, 234, 143, 17, 186, 50, 220]),
  createContent: Buffer.from([196, 78, 200, 14, 158, 190, 68, 223]),
  tipContent: Buffer.from([12, 29, 43, 141, 181, 42, 144, 92]),
  updateContent: Buffer.from([201, 145, 238, 112, 36, 231, 69, 8]),
};

// Serialization helpers
function serializeString(str: string): Buffer {
  const strBuffer = Buffer.from(str, "utf-8");
  const lenBuffer = Buffer.alloc(4);
  lenBuffer.writeUInt32LE(strBuffer.length);
  return Buffer.concat([lenBuffer, strBuffer]);
}

function serializeU64(value: bigint | number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(value));
  return buf;
}

// Create profile instruction
export function createProfileInstruction(
  authority: PublicKey,
  username: string
): TransactionInstruction {
  const [profilePda] = getProfilePda(authority);

  const data = Buffer.concat([
    DISCRIMINATORS.createProfile,
    serializeString(username),
  ]);

  return new TransactionInstruction({
    keys: [
      { pubkey: profilePda, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });
}

// Create content instruction
export function createContentInstruction(
  authority: PublicKey,
  contentIndex: bigint,
  contentCid: string,
  metadataCid: string,
  contentType: ContentType
): TransactionInstruction {
  const [profilePda] = getProfilePda(authority);
  const [contentPda] = getContentPda(authority, contentIndex);

  const data = Buffer.concat([
    DISCRIMINATORS.createContent,
    serializeString(contentCid),
    serializeString(metadataCid),
    Buffer.from([contentType]),
  ]);

  return new TransactionInstruction({
    keys: [
      { pubkey: contentPda, isSigner: false, isWritable: true },
      { pubkey: profilePda, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });
}

// Tip content instruction
export function tipContentInstruction(
  tipper: PublicKey,
  contentPda: PublicKey,
  creator: PublicKey,
  amount: bigint | number
): TransactionInstruction {
  const [creatorProfilePda] = getProfilePda(creator);

  const data = Buffer.concat([
    DISCRIMINATORS.tipContent,
    serializeU64(amount),
  ]);

  return new TransactionInstruction({
    keys: [
      { pubkey: contentPda, isSigner: false, isWritable: true },
      { pubkey: creatorProfilePda, isSigner: false, isWritable: true },
      { pubkey: creator, isSigner: false, isWritable: true },
      { pubkey: tipper, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });
}

// Update content instruction
export function updateContentInstruction(
  creator: PublicKey,
  contentPda: PublicKey,
  metadataCid: string
): TransactionInstruction {
  const data = Buffer.concat([
    DISCRIMINATORS.updateContent,
    serializeString(metadataCid),
  ]);

  return new TransactionInstruction({
    keys: [
      { pubkey: contentPda, isSigner: false, isWritable: true },
      { pubkey: creator, isSigner: true, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });
}

// Account fetching helpers
export async function fetchProfile(
  connection: Connection,
  authority: PublicKey
): Promise<CreatorProfile | null> {
  const [pda] = getProfilePda(authority);
  const account = await connection.getAccountInfo(pda);
  if (!account) return null;

  const data = account.data;
  // Skip 8-byte discriminator
  let offset = 8;

  const authorityPubkey = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  const usernameLen = data.readUInt32LE(offset);
  offset += 4;
  const username = data.subarray(offset, offset + usernameLen).toString("utf-8");
  offset += usernameLen;

  const contentCount = data.readBigUInt64LE(offset);
  offset += 8;

  const totalTips = data.readBigUInt64LE(offset);
  offset += 8;

  const createdAt = data.readBigInt64LE(offset);

  return {
    authority: authorityPubkey,
    username,
    contentCount,
    totalTips,
    createdAt,
  };
}

export async function fetchContent(
  connection: Connection,
  authority: PublicKey,
  index: bigint
): Promise<ContentEntry | null> {
  const [pda] = getContentPda(authority, index);
  const account = await connection.getAccountInfo(pda);
  if (!account) return null;

  const data = account.data;
  // Skip 8-byte discriminator
  let offset = 8;

  const creator = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  const contentCidLen = data.readUInt32LE(offset);
  offset += 4;
  const contentCid = data.subarray(offset, offset + contentCidLen).toString("utf-8");
  offset += contentCidLen;

  const metadataCidLen = data.readUInt32LE(offset);
  offset += 4;
  const metadataCid = data.subarray(offset, offset + metadataCidLen).toString("utf-8");
  offset += metadataCidLen;

  const contentType = data.readUInt8(offset) as ContentType;
  offset += 1;

  const tipsReceived = data.readBigUInt64LE(offset);
  offset += 8;

  const createdAt = data.readBigInt64LE(offset);
  offset += 8;

  const contentIndex = data.readBigUInt64LE(offset);

  return {
    creator,
    contentCid,
    metadataCid,
    contentType,
    tipsReceived,
    createdAt,
    index: contentIndex,
  };
}

// High-level client
export function createContentRegistryClient(connection: Connection) {
  return {
    getProfilePda,
    getContentPda,

    createProfileInstruction,
    createContentInstruction,
    tipContentInstruction,
    updateContentInstruction,

    fetchProfile: (authority: PublicKey) => fetchProfile(connection, authority),
    fetchContent: (authority: PublicKey, index: bigint) => fetchContent(connection, authority, index),

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

export { idl } from "./idl";
