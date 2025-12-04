import nacl from "tweetnacl";
import { encodeBase64, decodeBase64 } from "tweetnacl-util";
import { PublicKey } from "@solana/web3.js";

/**
 * Content encryption utilities for access control
 *
 * Flow (Server-held keys with derived content keys):
 * 1. Creator uploads: content encrypted with contentKey derived from MASTER_SECRET + contentCid
 * 2. Access request: server verifies NFT ownership or creator status
 * 3. If authorized: server derives contentKey, decrypts, and serves content
 * 4. If not authorized: server serves preview only
 */

/**
 * Generate a random content encryption key
 */
export function generateContentKey(): Uint8Array {
  return nacl.randomBytes(nacl.secretbox.keyLength);
}

/**
 * Derive a content key from master secret and content identifier
 * This allows deterministic key generation without storing keys
 *
 * @param masterSecret - Server-held secret (from env variable)
 * @param contentId - Unique content identifier (e.g., contentCid)
 * @returns 32-byte key for nacl.secretbox
 */
export function deriveContentKey(
  masterSecret: string,
  contentId: string
): Uint8Array {
  // Combine master secret and content ID
  const combined = `${masterSecret}:${contentId}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(combined);

  // Hash to get a 32-byte key (nacl.hash returns 64 bytes, take first 32)
  const hash = nacl.hash(data);
  return hash.slice(0, nacl.secretbox.keyLength);
}

/**
 * Generate a nonce for encryption
 */
export function generateNonce(): Uint8Array {
  return nacl.randomBytes(nacl.secretbox.nonceLength);
}

/**
 * Encrypt content with a symmetric key (secretbox)
 * Returns: { encrypted, nonce } - both needed for decryption
 */
export function encryptContent(
  content: Uint8Array,
  contentKey: Uint8Array
): { encrypted: Uint8Array; nonce: Uint8Array } {
  const nonce = generateNonce();
  const encrypted = nacl.secretbox(content, nonce, contentKey);
  return { encrypted, nonce };
}

/**
 * Decrypt content with a symmetric key (secretbox)
 */
export function decryptContent(
  encrypted: Uint8Array,
  nonce: Uint8Array,
  contentKey: Uint8Array
): Uint8Array | null {
  return nacl.secretbox.open(encrypted, nonce, contentKey);
}

/**
 * Encrypt the content key for a specific buyer using their public key
 * Uses nacl.box (asymmetric encryption)
 *
 * Note: Solana uses Ed25519 keys, but nacl.box uses X25519 (Curve25519)
 * We need to convert Ed25519 public key to X25519
 */
export function encryptKeyForBuyer(
  contentKey: Uint8Array,
  buyerPublicKey: PublicKey,
  creatorSecretKey: Uint8Array
): { encryptedKey: Uint8Array; nonce: Uint8Array } {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);

  // Convert Ed25519 keys to X25519 for nacl.box
  const buyerX25519 = ed25519PublicKeyToX25519(buyerPublicKey.toBytes());
  const creatorKeyPair = nacl.box.keyPair.fromSecretKey(
    creatorSecretKey.slice(0, 32) // Use first 32 bytes as seed
  );

  const encryptedKey = nacl.box(
    contentKey,
    nonce,
    buyerX25519,
    creatorKeyPair.secretKey
  );

  return { encryptedKey, nonce };
}

/**
 * Decrypt the content key using buyer's secret key
 */
export function decryptKeyForBuyer(
  encryptedKey: Uint8Array,
  nonce: Uint8Array,
  creatorPublicKey: PublicKey,
  buyerSecretKey: Uint8Array
): Uint8Array | null {
  // Convert Ed25519 keys to X25519 for nacl.box
  const creatorX25519 = ed25519PublicKeyToX25519(creatorPublicKey.toBytes());
  const buyerKeyPair = nacl.box.keyPair.fromSecretKey(
    buyerSecretKey.slice(0, 32) // Use first 32 bytes as seed
  );

  return nacl.box.open(
    encryptedKey,
    nonce,
    creatorX25519,
    buyerKeyPair.secretKey
  );
}

/**
 * Simple Ed25519 to X25519 public key conversion
 * This is a simplified approach - for production, consider using @noble/ed25519
 */
function ed25519PublicKeyToX25519(ed25519PublicKey: Uint8Array): Uint8Array {
  // For simplicity, we'll use a hash-based approach
  // In production, use proper curve conversion from @noble/ed25519
  const hash = nacl.hash(ed25519PublicKey);
  return hash.slice(0, 32);
}

/**
 * Pack encrypted content with nonce for storage
 * Format: [nonce (24 bytes)][encrypted content]
 */
export function packEncryptedContent(
  encrypted: Uint8Array,
  nonce: Uint8Array
): Uint8Array {
  const packed = new Uint8Array(nonce.length + encrypted.length);
  packed.set(nonce, 0);
  packed.set(encrypted, nonce.length);
  return packed;
}

/**
 * Unpack encrypted content from storage
 * Returns: { encrypted, nonce }
 */
export function unpackEncryptedContent(
  packed: Uint8Array
): { encrypted: Uint8Array; nonce: Uint8Array } {
  const nonce = packed.slice(0, nacl.secretbox.nonceLength);
  const encrypted = packed.slice(nacl.secretbox.nonceLength);
  return { encrypted, nonce };
}

/**
 * Pack encrypted key with nonce for storage
 * Format: [nonce (24 bytes)][encrypted key]
 */
export function packEncryptedKey(
  encryptedKey: Uint8Array,
  nonce: Uint8Array
): Uint8Array {
  const packed = new Uint8Array(nonce.length + encryptedKey.length);
  packed.set(nonce, 0);
  packed.set(encryptedKey, nonce.length);
  return packed;
}

/**
 * Unpack encrypted key from storage
 */
export function unpackEncryptedKey(
  packed: Uint8Array
): { encryptedKey: Uint8Array; nonce: Uint8Array } {
  const nonce = packed.slice(0, nacl.box.nonceLength);
  const encryptedKey = packed.slice(nacl.box.nonceLength);
  return { encryptedKey, nonce };
}

// Re-export encoding utilities
export { encodeBase64, decodeBase64 };

/**
 * Encrypted content metadata stored alongside the encrypted file
 */
export interface EncryptedContentMeta {
  version: 1;
  algorithm: "nacl-secretbox";
  nonce: string; // base64 encoded
}

/**
 * Encrypted key file stored per buyer
 */
export interface EncryptedKeyFile {
  version: 1;
  algorithm: "nacl-box";
  creatorPublicKey: string; // base58
  buyerPublicKey: string; // base58
  nonce: string; // base64 encoded
  encryptedKey: string; // base64 encoded
}

/**
 * Create encrypted content bundle ready for IPFS upload
 * Uses random key (legacy) - prefer createEncryptedBundleWithDerivedKey for server-held keys
 */
export function createEncryptedBundle(
  content: Uint8Array
): {
  encryptedContent: Uint8Array;
  contentKey: Uint8Array;
  meta: EncryptedContentMeta;
} {
  const contentKey = generateContentKey();
  const { encrypted, nonce } = encryptContent(content, contentKey);

  return {
    encryptedContent: encrypted,
    contentKey,
    meta: {
      version: 1,
      algorithm: "nacl-secretbox",
      nonce: encodeBase64(nonce),
    },
  };
}

/**
 * Create encrypted content bundle with server-derived key
 * The contentId is returned so it can be used to derive the same key later
 *
 * @param content - Raw content bytes
 * @param masterSecret - Server master secret
 * @param contentId - Unique ID for this content (usually a hash or random ID generated before upload)
 */
export function createEncryptedBundleWithDerivedKey(
  content: Uint8Array,
  masterSecret: string,
  contentId: string
): {
  encryptedContent: Uint8Array;
  meta: EncryptedContentMeta;
  contentId: string;
} {
  const contentKey = deriveContentKey(masterSecret, contentId);
  const { encrypted, nonce } = encryptContent(content, contentKey);

  return {
    encryptedContent: encrypted,
    meta: {
      version: 1,
      algorithm: "nacl-secretbox",
      nonce: encodeBase64(nonce),
    },
    contentId,
  };
}

/**
 * Decrypt content from IPFS
 */
export function decryptBundle(
  encryptedContent: Uint8Array,
  meta: EncryptedContentMeta,
  contentKey: Uint8Array
): Uint8Array | null {
  const nonce = decodeBase64(meta.nonce);
  return decryptContent(encryptedContent, nonce, contentKey);
}

/**
 * Decrypt content using server-derived key
 * Use this on the server side to decrypt content for authorized users
 *
 * @param encryptedContent - Encrypted content bytes from IPFS
 * @param meta - Encryption metadata from IPFS
 * @param masterSecret - Server master secret
 * @param contentId - Content identifier used during encryption
 */
export function decryptBundleWithDerivedKey(
  encryptedContent: Uint8Array,
  meta: EncryptedContentMeta,
  masterSecret: string,
  contentId: string
): Uint8Array | null {
  const contentKey = deriveContentKey(masterSecret, contentId);
  return decryptBundle(encryptedContent, meta, contentKey);
}
