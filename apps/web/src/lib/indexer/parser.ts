import { Connection, PublicKey } from "@solana/web3.js";
import {
  ContentEntry,
  Bundle,
  BundleItem,
  ContentType,
  BundleType,
  getContentDomain,
  getBundleTypeLabel,
} from "@handcraft/sdk";

const IPFS_GATEWAY = "https://ipfs.filebase.io/ipfs";

/**
 * Parse ContentEntry account data from on-chain
 */
export interface ParsedContent {
  address: string;
  creator: string;
  contentCid: string;
  metadataCid: string;
  contentType: number;
  contentDomain: string;
  visibilityLevel: number;
  isEncrypted: boolean;
  previewCid: string;
  encryptionMetaCid: string;
  isLocked: boolean;
  mintedCount: number;
  pendingCount: number;
  tipsReceived: number;
  createdAt: Date;
}

/**
 * Parse Bundle account data from on-chain
 */
export interface ParsedBundle {
  address: string;
  creator: string;
  bundleId: string;
  metadataCid: string;
  bundleType: number;
  bundleTypeLabel: string;
  itemCount: number;
  isActive: boolean;
  isLocked: boolean;
  mintedCount: number;
  pendingCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Parse BundleItem account data from on-chain
 */
export interface ParsedBundleItem {
  bundleAddress: string;
  contentAddress: string;
  position: number;
  addedAt: Date;
}

/**
 * Parse ContentEntry from raw account data
 * Handles variable-length Borsh encoded strings
 */
export function parseContentAccount(
  address: PublicKey,
  data: Buffer
): ParsedContent | null {
  try {
    let offset = 8; // Skip discriminator

    // Read creator (32 bytes)
    const creator = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    // Read content_cid (4-byte length + string)
    const contentCidLen = data.readUInt32LE(offset);
    offset += 4;
    const contentCid = data.slice(offset, offset + contentCidLen).toString("utf8");
    offset += contentCidLen;

    // Read metadata_cid (4-byte length + string)
    const metadataCidLen = data.readUInt32LE(offset);
    offset += 4;
    const metadataCid = data.slice(offset, offset + metadataCidLen).toString("utf8");
    offset += metadataCidLen;

    // Read content_type (u8)
    const contentType = data.readUInt8(offset);
    offset += 1;

    // Read tips_received (u64)
    const tipsReceived = Number(data.readBigUInt64LE(offset));
    offset += 8;

    // Read created_at (i64)
    const createdAt = new Date(Number(data.readBigInt64LE(offset)) * 1000);
    offset += 8;

    // Read is_locked (bool)
    const isLocked = data.readUInt8(offset) === 1;
    offset += 1;

    // Read minted_count (u64)
    const mintedCount = Number(data.readBigUInt64LE(offset));
    offset += 8;

    // Read pending_count (u64)
    const pendingCount = Number(data.readBigUInt64LE(offset));
    offset += 8;

    // Read is_encrypted (bool)
    const isEncrypted = data.readUInt8(offset) === 1;
    offset += 1;

    // Read preview_cid (4-byte length + string)
    const previewCidLen = data.readUInt32LE(offset);
    offset += 4;
    const previewCid = data.slice(offset, offset + previewCidLen).toString("utf8");
    offset += previewCidLen;

    // Read encryption_meta_cid (4-byte length + string)
    const encryptionMetaCidLen = data.readUInt32LE(offset);
    offset += 4;
    const encryptionMetaCid = data
      .slice(offset, offset + encryptionMetaCidLen)
      .toString("utf8");
    offset += encryptionMetaCidLen;

    // Read visibility_level (u8)
    const visibilityLevel = data.readUInt8(offset);

    return {
      address: address.toBase58(),
      creator: creator.toBase58(),
      contentCid,
      metadataCid,
      contentType,
      contentDomain: getContentDomain(contentType as ContentType),
      visibilityLevel,
      isEncrypted,
      previewCid,
      encryptionMetaCid,
      isLocked,
      mintedCount,
      pendingCount,
      tipsReceived,
      createdAt,
    };
  } catch (error) {
    console.error("Failed to parse content account:", error);
    return null;
  }
}

/**
 * Parse Bundle from raw account data
 * Handles variable-length Borsh encoded strings
 */
export function parseBundleAccount(
  address: PublicKey,
  data: Buffer
): ParsedBundle | null {
  try {
    let offset = 8; // Skip discriminator

    // Read creator (32 bytes)
    const creator = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    // Read bundle_id (4-byte length + string)
    const bundleIdLen = data.readUInt32LE(offset);
    offset += 4;
    const bundleId = data.slice(offset, offset + bundleIdLen).toString("utf8");
    offset += bundleIdLen;

    // Read metadata_cid (4-byte length + string)
    const metadataCidLen = data.readUInt32LE(offset);
    offset += 4;
    const metadataCid = data.slice(offset, offset + metadataCidLen).toString("utf8");
    offset += metadataCidLen;

    // Read bundle_type (u8)
    const bundleType = data.readUInt8(offset);
    offset += 1;

    // Read item_count (u32)
    const itemCount = data.readUInt32LE(offset);
    offset += 4;

    // Read is_active (bool)
    const isActive = data.readUInt8(offset) === 1;
    offset += 1;

    // Read created_at (i64)
    const createdAt = new Date(Number(data.readBigInt64LE(offset)) * 1000);
    offset += 8;

    // Read updated_at (i64)
    const updatedAt = new Date(Number(data.readBigInt64LE(offset)) * 1000);
    offset += 8;

    // Read minted_count (u64)
    const mintedCount = Number(data.readBigUInt64LE(offset));
    offset += 8;

    // Read pending_count (u64)
    const pendingCount = Number(data.readBigUInt64LE(offset));
    offset += 8;

    // Read is_locked (bool)
    const isLocked = data.readUInt8(offset) === 1;

    return {
      address: address.toBase58(),
      creator: creator.toBase58(),
      bundleId,
      metadataCid,
      bundleType,
      bundleTypeLabel: getBundleTypeLabel(bundleType as BundleType),
      itemCount,
      isActive,
      isLocked,
      mintedCount,
      pendingCount,
      createdAt,
      updatedAt,
    };
  } catch (error) {
    console.error("Failed to parse bundle account:", error);
    return null;
  }
}

/**
 * Parse BundleItem from raw account data
 */
export function parseBundleItemAccount(
  data: Buffer
): ParsedBundleItem | null {
  try {
    let offset = 8; // Skip discriminator

    // Read bundle (32 bytes)
    const bundle = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    // Read content (32 bytes)
    const content = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    // Read position (u32)
    const position = data.readUInt32LE(offset);
    offset += 4;

    // Read added_at (i64)
    const addedAt = new Date(Number(data.readBigInt64LE(offset)) * 1000);

    return {
      bundleAddress: bundle.toBase58(),
      contentAddress: content.toBase58(),
      position,
      addedAt,
    };
  } catch (error) {
    console.error("Failed to parse bundle item account:", error);
    return null;
  }
}

/**
 * Parse NFT asset to extract content/bundle reference
 */
export interface ParsedNftAsset {
  address: string;
  owner: string;
  name: string;
  uri: string;
  collectionAddress: string | null;
}

/**
 * Parse Metaplex Core Asset account
 * Asset account structure:
 * - discriminator: 1 byte (value = 1 for Asset)
 * - owner: 32 bytes
 * - update_authority: 1 byte (type) + 32 bytes (address if Collection)
 * - name: 4 bytes (length) + string
 * - uri: 4 bytes (length) + string
 */
export function parseNftAsset(
  address: PublicKey,
  data: Buffer
): ParsedNftAsset | null {
  try {
    // Check discriminator (should be 1 for Asset)
    if (data[0] !== 1) {
      return null;
    }

    let offset = 1;

    // Read owner (32 bytes)
    const owner = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    // Read update_authority type (1 byte)
    const updateAuthorityType = data[offset];
    offset += 1;

    let collectionAddress: string | null = null;
    if (updateAuthorityType === 2) {
      // Collection update authority
      collectionAddress = new PublicKey(data.slice(offset, offset + 32)).toBase58();
    }
    offset += 32; // Skip authority address

    // Read name (4-byte length + string)
    const nameLen = data.readUInt32LE(offset);
    offset += 4;
    const name = data.slice(offset, offset + nameLen).toString("utf8");
    offset += nameLen;

    // Read uri (4-byte length + string)
    const uriLen = data.readUInt32LE(offset);
    offset += 4;
    const uri = data.slice(offset, offset + uriLen).toString("utf8");

    return {
      address: address.toBase58(),
      owner: owner.toBase58(),
      name,
      uri,
      collectionAddress,
    };
  } catch (error) {
    console.error("Failed to parse NFT asset:", error);
    return null;
  }
}

/**
 * Extract content CID from NFT metadata URI or JSON
 */
export function extractContentCidFromNft(
  uri: string,
  metadata?: any
): string | null {
  // Check if URI directly contains a CID
  const uriMatch = uri.match(/Qm[1-9A-HJ-NP-Za-km-z]{44}|baf[a-z2-7]+/);
  if (uriMatch) {
    return uriMatch[0];
  }

  // Check metadata for content CID
  if (metadata) {
    if (metadata.contentCid) return metadata.contentCid;
    if (metadata.content_cid) return metadata.content_cid;
    if (metadata.properties?.content_cid) return metadata.properties.content_cid;

    // Check image/animation URLs
    const imageMatch = metadata.image?.match(/Qm[1-9A-HJ-NP-Za-km-z]{44}|baf[a-z2-7]+/);
    if (imageMatch) return imageMatch[0];

    const animationMatch = metadata.animation_url?.match(/Qm[1-9A-HJ-NP-Za-km-z]{44}|baf[a-z2-7]+/);
    if (animationMatch) return animationMatch[0];
  }

  return null;
}

/**
 * Extract bundle ID from NFT metadata URI or JSON
 */
export function extractBundleIdFromNft(
  uri: string,
  metadata?: any
): string | null {
  if (metadata) {
    if (metadata.bundleId) return metadata.bundleId;
    if (metadata.bundle_id) return metadata.bundle_id;
    if (metadata.properties?.bundle_id) return metadata.properties.bundle_id;
  }

  return null;
}
