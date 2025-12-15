import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import {
  deriveContentKey,
  decryptContent,
  decodeBase64,
  NETWORKS,
  getContentPda,
  getBundlePda,
  findBundlesForContent,
  fetchAllBundleCollections,
  getEcosystemSubscriptionPda,
  getCreatorPatronSubscriptionPda,
  isSubscriptionValid,
} from "@handcraft/sdk";
import { verifySessionToken } from "@/lib/session";
import { createAuthenticatedClient, getAccessTokenFromHeader } from "@/lib/supabase";

const MASTER_SECRET = process.env.CONTENT_ENCRYPTION_SECRET;
const IPFS_GATEWAY = "https://ipfs.filebase.io/ipfs";
const SOLANA_NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet") as keyof typeof NETWORKS;

/**
 * Validate CID format
 * CIDv0: Starts with "Qm" and is 46 characters (base58btc)
 * CIDv1: Starts with various prefixes like "bafy" (base32), "bafk", etc.
 */
function isValidCid(cid: string): boolean {
  if (!cid || typeof cid !== "string") return false;

  // CIDv0: 46 character base58btc starting with Qm
  if (cid.startsWith("Qm") && cid.length === 46) {
    return /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(cid);
  }

  // CIDv1: base32 encoded, typically starts with "bafy" or "bafk"
  if (cid.startsWith("baf") && cid.length >= 50) {
    return /^[a-z2-7]+$/.test(cid);
  }

  return false;
}

interface EncryptedContentMeta {
  version: number;
  algorithm: string;
  nonce: string;
  contentId: string;
}

/**
 * Content Access API
 *
 * Verifies session token, then checks on-chain authorization.
 *
 * Query params:
 * - contentCid: The content CID
 * - metaCid: The encryption metadata CID
 * - sessionToken: Session token proving wallet ownership (created via /api/session)
 */
export async function GET(request: NextRequest) {
  if (!MASTER_SECRET) {
    return NextResponse.json(
      { error: "Encryption not configured" },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const contentCid = searchParams.get("contentCid");
  const metaCid = searchParams.get("metaCid");
  const sessionToken = searchParams.get("sessionToken");

  if (!contentCid || !metaCid) {
    return NextResponse.json(
      { error: "Missing required parameters (contentCid, metaCid)" },
      { status: 400 }
    );
  }

  // Validate CID formats to prevent SSRF and injection attacks
  if (!isValidCid(contentCid) || !isValidCid(metaCid)) {
    return NextResponse.json(
      { error: "Invalid CID format" },
      { status: 400 }
    );
  }

  try {
    // 1. Verify authentication - try Supabase JWT first, fall back to legacy session token
    let wallet: string | null = null;

    // Try Supabase JWT from Authorization header
    const accessToken = getAccessTokenFromHeader(request.headers.get("authorization"));
    if (accessToken) {
      try {
        const supabase = createAuthenticatedClient(accessToken);
        const { data: { user }, error } = await supabase.auth.getUser();
        if (!error && user) {
          // Extract wallet address from Supabase Web3 auth
          wallet =
            user.user_metadata?.custom_claims?.address ||
            user.user_metadata?.wallet_address ||
            user.app_metadata?.address ||
            user.identities?.[0]?.identity_data?.custom_claims?.address ||
            user.identities?.[0]?.identity_data?.address ||
            null;
        }
      } catch {
        // Supabase auth failed, try legacy token
      }
    }

    // Fall back to legacy session token if Supabase auth didn't work
    if (!wallet && sessionToken) {
      wallet = verifySessionToken(sessionToken);
    }

    if (!wallet) {
      return NextResponse.json(
        { error: "Invalid or expired session" },
        { status: 401 }
      );
    }

    // 2. Check authorization ON-CHAIN (creator or NFT owner)
    const isAuthorized = await checkAuthorization(wallet, contentCid);
    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Not authorized to access this content" },
        { status: 403 }
      );
    }

    // 3. Fetch encryption metadata from IPFS
    const metaResponse = await fetch(`${IPFS_GATEWAY}/${metaCid}`);
    if (!metaResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch encryption metadata" },
        { status: 500 }
      );
    }
    const meta: EncryptedContentMeta = await metaResponse.json();

    // 4. Fetch encrypted content from IPFS
    const contentResponse = await fetch(`${IPFS_GATEWAY}/${contentCid}`);
    if (!contentResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch content" },
        { status: 500 }
      );
    }
    const encryptedBuffer = await contentResponse.arrayBuffer();
    const encryptedContent = new Uint8Array(encryptedBuffer);

    // 5. Derive the content key and decrypt
    const contentKey = deriveContentKey(MASTER_SECRET, meta.contentId);
    const nonce = decodeBase64(meta.nonce);
    const decryptedContent = decryptContent(encryptedContent, nonce, contentKey);

    if (!decryptedContent) {
      return NextResponse.json(
        { error: "Failed to decrypt content" },
        { status: 500 }
      );
    }

    // 6. Return decrypted content
    return new NextResponse(Buffer.from(decryptedContent), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Content access error:", error);
    return NextResponse.json(
      { error: "Failed to access content" },
      { status: 500 }
    );
  }
}

/**
 * Parse visibility level from content account data
 * Handles variable-length Borsh strings
 */
function parseVisibilityLevel(data: Buffer): number {
  let offset = 8; // Skip discriminator
  offset += 32; // Skip creator

  // Skip content_cid (4-byte length + string bytes)
  const contentCidLen = data.readUInt32LE(offset);
  offset += 4 + contentCidLen;

  // Skip metadata_cid
  const metadataCidLen = data.readUInt32LE(offset);
  offset += 4 + metadataCidLen;

  // Skip content_type (1 byte enum)
  offset += 1;
  // Skip tips_received (u64)
  offset += 8;
  // Skip created_at (i64)
  offset += 8;
  // Skip is_locked (bool)
  offset += 1;
  // Skip minted_count (u64)
  offset += 8;
  // Skip pending_count (u64)
  offset += 8;
  // Skip is_encrypted (bool)
  offset += 1;

  // Skip preview_cid
  const previewCidLen = data.readUInt32LE(offset);
  offset += 4 + previewCidLen;

  // Skip encryption_meta_cid
  const encryptionMetaCidLen = data.readUInt32LE(offset);
  offset += 4 + encryptionMetaCidLen;

  // Read visibility_level (u8)
  return data.readUInt8(offset);
}

/**
 * Check if wallet has valid ecosystem subscription
 */
async function checkEcosystemSubscription(
  connection: Connection,
  wallet: string
): Promise<boolean> {
  try {
    const walletPubkey = new PublicKey(wallet);
    const [subscriptionPda] = getEcosystemSubscriptionPda(walletPubkey);

    const accountInfo = await connection.getAccountInfo(subscriptionPda);
    if (!accountInfo || !accountInfo.data) {
      return false;
    }

    // EcosystemSubscription layout:
    // - discriminator: 8 bytes
    // - subscriber: 32 bytes (offset 8)
    // - stream_id: 32 bytes (offset 40)
    // - started_at: 8 bytes (offset 72)
    // - is_active: 1 byte (offset 80)
    const data = accountInfo.data;
    if (data.length < 81) {
      return false;
    }

    const isActive = data[80] === 1;
    if (!isActive) {
      return false;
    }

    // Read started_at (i64 at offset 72)
    const startedAt = data.readBigInt64LE(72);
    return isSubscriptionValid(startedAt);
  } catch (error) {
    console.error("Ecosystem subscription check error:", error);
    return false;
  }
}

/**
 * Check if wallet has valid patron subscription to a specific creator
 */
async function checkPatronSubscription(
  connection: Connection,
  wallet: string,
  creator: PublicKey
): Promise<boolean> {
  try {
    const walletPubkey = new PublicKey(wallet);
    const [subscriptionPda] = getCreatorPatronSubscriptionPda(walletPubkey, creator);

    const accountInfo = await connection.getAccountInfo(subscriptionPda);
    if (!accountInfo || !accountInfo.data) {
      return false;
    }

    // CreatorPatronSubscription layout:
    // - discriminator: 8 bytes
    // - subscriber: 32 bytes (offset 8)
    // - creator: 32 bytes (offset 40)
    // - tier: 1 byte (offset 72)
    // - stream_id: 32 bytes (offset 73)
    // - started_at: 8 bytes (offset 105)
    // - is_active: 1 byte (offset 113)
    const data = accountInfo.data;
    if (data.length < 114) {
      return false;
    }

    const isActive = data[113] === 1;
    if (!isActive) {
      return false;
    }

    // Read started_at (i64 at offset 105)
    const startedAt = data.readBigInt64LE(105);
    return isSubscriptionValid(startedAt);
  } catch (error) {
    console.error("Patron subscription check error:", error);
    return false;
  }
}

/**
 * Check if wallet is authorized to access content
 * Implements 4-tier visibility model:
 * - Level 0: Public - anyone can access
 * - Level 1: Ecosystem - ecosystem sub OR creator sub OR NFT/Rental
 * - Level 2: Subscriber - creator sub OR NFT/Rental (ecosystem sub NOT enough)
 * - Level 3: NFT Only - ONLY NFT owners or renters
 */
async function checkAuthorization(
  wallet: string,
  contentCid: string
): Promise<boolean> {
  try {
    const connection = new Connection(
      NETWORKS[SOLANA_NETWORK].rpcUrl,
      "confirmed"
    );

    // Get content PDA
    const [contentPDA] = getContentPda(contentCid);

    // Fetch content account
    const accountInfo = await connection.getAccountInfo(contentPDA);
    if (!accountInfo) {
      return false;
    }

    // Parse account data
    const data = accountInfo.data;
    const creatorBytes = data.slice(8, 40);
    const creator = new PublicKey(creatorBytes);

    // Parse visibility level - FAIL CLOSED on parse error
    let visibilityLevel: number;
    try {
      visibilityLevel = parseVisibilityLevel(data);
      // Validate visibility level is in valid range (0-3)
      if (visibilityLevel < 0 || visibilityLevel > 3) {
        console.error("Invalid visibility level:", visibilityLevel);
        return false; // Deny access on invalid level
      }
    } catch (parseError) {
      // SECURITY: Fail closed - deny access if we can't parse visibility
      console.error("Failed to parse visibility level, denying access:", parseError);
      return false;
    }

    // Level 0: Public - anyone can access
    if (visibilityLevel === 0) {
      return true;
    }

    // Creator always has access
    if (creator.toString() === wallet) {
      return true;
    }

    // Check if requester owns an NFT for this content
    const hasNFT = await checkNFTOwnership(connection, wallet, contentCid);
    if (hasNFT) {
      return true;
    }

    // Check if requester owns an NFT from any bundle containing this content
    const hasBundleAccess = await checkBundleOwnership(connection, wallet, contentCid);
    if (hasBundleAccess) {
      return true;
    }

    // Level 3: NFT Only - no subscription access
    if (visibilityLevel === 3) {
      return false;
    }

    // Levels 1-2: Check subscription access
    // Level 1: Ecosystem subscription OR creator subscription
    // Level 2: Creator subscription only

    // Check patron subscription (works for both level 1 and 2)
    const hasPatronSub = await checkPatronSubscription(connection, wallet, creator);
    if (hasPatronSub) {
      return true;
    }

    // Level 1 only: Check ecosystem subscription
    if (visibilityLevel === 1) {
      const hasEcosystemSub = await checkEcosystemSubscription(connection, wallet);
      if (hasEcosystemSub) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error("Authorization check error:", error);
    return false;
  }
}

const MPL_CORE_PROGRAM_ID = new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");
const IPFS_GATEWAY_BASE = "https://ipfs.filebase.io/ipfs";

async function checkNFTOwnership(
  connection: Connection,
  wallet: string,
  contentCid: string
): Promise<boolean> {
  try {
    const walletPubkey = new PublicKey(wallet);

    const accounts = await connection.getProgramAccounts(MPL_CORE_PROGRAM_ID, {
      filters: [
        { memcmp: { offset: 0, bytes: "2" } },
        { memcmp: { offset: 1, bytes: walletPubkey.toBase58() } },
      ],
    });

    for (const { account } of accounts) {
      const data = account.data;
      const nameOffset = 1 + 32 + 33;
      const nameLen = data.readUInt32LE(nameOffset);
      const uriOffset = nameOffset + 4 + nameLen;
      const uriLen = data.readUInt32LE(uriOffset);
      const uri = data.slice(uriOffset + 4, uriOffset + 4 + uriLen).toString("utf8");

      if (uri.includes(contentCid)) {
        return true;
      }

      if (uri.startsWith(IPFS_GATEWAY_BASE)) {
        try {
          const metadataResponse = await fetch(uri, { signal: AbortSignal.timeout(5000) });
          if (metadataResponse.ok) {
            const metadata = await metadataResponse.json();
            if (
              metadata.contentCid === contentCid ||
              metadata.properties?.content_cid === contentCid ||
              metadata.image?.includes(contentCid) ||
              metadata.animation_url?.includes(contentCid)
            ) {
              return true;
            }
          }
        } catch {
          // Continue checking
        }
      }
    }

    return false;
  } catch (error) {
    console.error("NFT ownership check error:", error);
    return false;
  }
}

/**
 * Check if wallet owns an NFT from any bundle containing this content
 */
async function checkBundleOwnership(
  connection: Connection,
  wallet: string,
  contentCid: string
): Promise<boolean> {
  try {
    const walletPubkey = new PublicKey(wallet);

    // 1. Find all bundles that contain this content
    const bundlesWithContent = await findBundlesForContent(connection, contentCid);
    if (bundlesWithContent.length === 0) {
      return false;
    }

    // 2. Get all bundle collections to find collection addresses for these bundles
    const allBundleCollections = await fetchAllBundleCollections(connection);

    // 3. Get collection addresses for bundles containing this content
    const collectionAddresses = new Set<string>();
    for (const bundle of bundlesWithContent) {
      // Compute bundle PDA from creator and bundleId
      const [bundlePda] = getBundlePda(bundle.creator, bundle.bundleId);
      const bundleKey = bundlePda.toBase58();
      const collection = allBundleCollections.get(bundleKey);
      if (collection) {
        collectionAddresses.add(collection.collectionAsset.toBase58());
      }
    }

    if (collectionAddresses.size === 0) {
      return false;
    }

    // 4. Check if wallet owns any NFTs from these collections
    const walletAssets = await connection.getProgramAccounts(MPL_CORE_PROGRAM_ID, {
      filters: [
        { memcmp: { offset: 1, bytes: walletPubkey.toBase58() } }, // Owner at offset 1
      ],
    });

    for (const { account } of walletAssets) {
      const data = account.data;
      // Check if this is an Asset (byte 0 = 1 for Asset v1)
      if (data.length > 65 && data[0] === 1) {
        // Check update authority type for collection (offset 33)
        // updateAuthorityType: 0 = None, 1 = Address, 2 = Collection
        if (data[33] === 2) {
          // Collection address is at offset 34 (32 bytes)
          const collectionPubkey = new PublicKey(data.slice(34, 66));
          if (collectionAddresses.has(collectionPubkey.toBase58())) {
            return true;
          }
        }
      }
    }

    return false;
  } catch (error) {
    console.error("Bundle ownership check error:", error);
    return false;
  }
}
