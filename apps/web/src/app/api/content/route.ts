import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import {
  deriveContentKey,
  decryptContent,
  decodeBase64,
  NETWORKS,
  getContentPda,
  PROGRAM_ID,
} from "@handcraft/sdk";
import { verifySessionToken } from "@/lib/session";

const MASTER_SECRET = process.env.CONTENT_ENCRYPTION_SECRET;
const IPFS_GATEWAY = "https://ipfs.filebase.io/ipfs";
const SOLANA_NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet") as keyof typeof NETWORKS;

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

  if (!contentCid || !metaCid || !sessionToken) {
    return NextResponse.json(
      { error: "Missing required parameters" },
      { status: 400 }
    );
  }

  try {
    // 1. Verify session token and extract wallet
    const wallet = verifySessionToken(sessionToken);
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
 * Check if wallet is authorized to access content
 * Returns true if wallet is creator OR owns an NFT for this content
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

    // Parse account data to get creator
    const data = accountInfo.data;
    const creatorBytes = data.slice(8, 40);
    const creator = new PublicKey(creatorBytes);

    // Check if requester is creator
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
    return hasBundleAccess;
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

    // 1. Find all BundleItem accounts for this content
    // BundleItem accounts have the contentCid stored as a hash
    const bundleItemAccounts = await connection.getProgramAccounts(PROGRAM_ID, {
      filters: [
        // Filter by BundleItem discriminator
        { memcmp: { offset: 0, bytes: "GLe4oZPLqZw" } }, // base58 of BundleItem discriminator
      ],
    });

    // Map content CID to bundles that contain it
    const bundlesWithContent: Array<{ bundlePda: PublicKey; creator: PublicKey }> = [];

    for (const { account } of bundleItemAccounts) {
      const data = account.data;
      if (data.length < 100) continue;

      // Parse BundleItem: discriminator(8) + bundle(32) + contentCid(string with 4-byte length prefix)
      const bundlePda = new PublicKey(data.slice(8, 40));

      // Read contentCid string (4-byte length prefix + string)
      const contentCidLen = data.readUInt32LE(40);
      const itemContentCid = data.slice(44, 44 + contentCidLen).toString('utf8');

      if (itemContentCid === contentCid) {
        // Find the bundle to get its creator
        const bundleAccount = await connection.getAccountInfo(bundlePda);
        if (bundleAccount) {
          // Bundle: discriminator(8) + creator(32)
          const creator = new PublicKey(bundleAccount.data.slice(8, 40));
          bundlesWithContent.push({ bundlePda, creator });
        }
      }
    }

    if (bundlesWithContent.length === 0) {
      return false;
    }

    // 2. Find BundleCollection accounts for these bundles
    const bundleCollectionAccounts = await connection.getProgramAccounts(PROGRAM_ID, {
      filters: [
        // Filter by BundleCollection discriminator
        { memcmp: { offset: 0, bytes: "4CqhbQFPvDm" } }, // base58 of BundleCollection discriminator
      ],
    });

    const bundleToCollection = new Map<string, PublicKey>();
    for (const { account } of bundleCollectionAccounts) {
      const data = account.data;
      if (data.length < 72) continue;
      // BundleCollection: discriminator(8) + bundle(32) + collectionAsset(32)
      const bundlePdaKey = new PublicKey(data.slice(8, 40)).toBase58();
      const collectionAsset = new PublicKey(data.slice(40, 72));
      bundleToCollection.set(bundlePdaKey, collectionAsset);
    }

    // 3. Get collection addresses for bundles containing this content
    const collectionAddresses = new Set<string>();
    for (const bundle of bundlesWithContent) {
      const collection = bundleToCollection.get(bundle.bundlePda.toBase58());
      if (collection) {
        collectionAddresses.add(collection.toBase58());
      }
    }

    if (collectionAddresses.size === 0) {
      return false;
    }

    // 4. Check if wallet owns any NFTs from these collections
    const walletAssets = await connection.getProgramAccounts(MPL_CORE_PROGRAM_ID, {
      filters: [
        { memcmp: { offset: 0, bytes: "2" } }, // Asset type
        { memcmp: { offset: 1, bytes: walletPubkey.toBase58() } }, // Owner
      ],
    });

    for (const { account } of walletAssets) {
      const data = account.data;
      // Check update authority type for collection
      // offset 33 = updateAuthorityType, if 2 = collection
      if (data.length > 65 && data[33] === 2) {
        // Collection address is at offset 34 (32 bytes)
        const collectionPubkey = new PublicKey(data.slice(34, 66));
        if (collectionAddresses.has(collectionPubkey.toBase58())) {
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    console.error("Bundle ownership check error:", error);
    return false;
  }
}
