import { Connection, PublicKey } from "@solana/web3.js";
import { PROGRAM_ID } from "@handcraft/sdk";
import { getServiceSupabase } from "../supabase";
import {
  parseContentAccount,
  parseBundleAccount,
  parseBundleItemAccount,
  ParsedContent,
  ParsedBundle,
  ParsedBundleItem,
} from "./parser";
import {
  fetchContentMetadata,
  fetchBundleMetadata,
  buildIndexableContentMetadata,
  buildIndexableBundleMetadata,
} from "./metadata";

/**
 * Sync a single content account to database
 */
export async function syncContent(
  connection: Connection,
  contentAddress: PublicKey
): Promise<boolean> {
  try {
    const supabase = getServiceSupabase();

    // Fetch on-chain account
    const accountInfo = await connection.getAccountInfo(contentAddress);
    if (!accountInfo) {
      console.error("Content account not found:", contentAddress.toBase58());
      return false;
    }

    // Parse account data
    const parsed = parseContentAccount(contentAddress, accountInfo.data);
    if (!parsed) {
      console.error("Failed to parse content account:", contentAddress.toBase58());
      return false;
    }

    // Fetch metadata from IPFS
    const metadata = await fetchContentMetadata(parsed.metadataCid);
    const indexableMetadata = buildIndexableContentMetadata(metadata);

    // Upsert to database
    const { error } = await supabase.from("indexed_content").upsert(
      {
        content_address: parsed.address,
        content_cid: parsed.contentCid,
        metadata_cid: parsed.metadataCid,
        creator_address: parsed.creator,
        name: indexableMetadata.name,
        description: indexableMetadata.description,
        image_url: indexableMetadata.imageUrl,
        animation_url: indexableMetadata.animationUrl,
        content_type: parsed.contentType,
        content_domain: parsed.contentDomain,
        visibility_level: parsed.visibilityLevel,
        is_encrypted: parsed.isEncrypted,
        preview_cid: parsed.previewCid || null,
        encryption_meta_cid: parsed.encryptionMetaCid || null,
        is_locked: parsed.isLocked,
        minted_count: parsed.mintedCount,
        pending_count: parsed.pendingCount,
        tips_received: parsed.tipsReceived,
        tags: indexableMetadata.tags,
        category: indexableMetadata.category,
        genre: indexableMetadata.genre,
        created_at: parsed.createdAt.toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "content_address",
      }
    );

    if (error) {
      console.error("Failed to upsert content:", error);
      return false;
    }

    // Update creator stats
    await supabase.rpc("update_creator_stats", {
      p_creator_address: parsed.creator,
    });

    console.log("Synced content:", parsed.contentCid);
    return true;
  } catch (error) {
    console.error("Error syncing content:", error);
    return false;
  }
}

/**
 * Sync a single bundle account to database
 */
export async function syncBundle(
  connection: Connection,
  bundleAddress: PublicKey
): Promise<boolean> {
  try {
    const supabase = getServiceSupabase();

    // Fetch on-chain account
    const accountInfo = await connection.getAccountInfo(bundleAddress);
    if (!accountInfo) {
      console.error("Bundle account not found:", bundleAddress.toBase58());
      return false;
    }

    // Parse account data
    const parsed = parseBundleAccount(bundleAddress, accountInfo.data);
    if (!parsed) {
      console.error("Failed to parse bundle account:", bundleAddress.toBase58());
      return false;
    }

    // Fetch metadata from IPFS
    const metadata = await fetchBundleMetadata(parsed.metadataCid);
    const indexableMetadata = buildIndexableBundleMetadata(metadata);

    // Upsert to database
    const { error } = await supabase.from("indexed_bundles").upsert(
      {
        bundle_address: parsed.address,
        bundle_id: parsed.bundleId,
        metadata_cid: parsed.metadataCid,
        creator_address: parsed.creator,
        name: indexableMetadata.name,
        description: indexableMetadata.description,
        image_url: indexableMetadata.imageUrl,
        bundle_type: parsed.bundleType,
        bundle_type_label: parsed.bundleTypeLabel,
        item_count: parsed.itemCount,
        is_locked: parsed.isLocked,
        is_active: parsed.isActive,
        minted_count: parsed.mintedCount,
        pending_count: parsed.pendingCount,
        artist: indexableMetadata.artist,
        show_name: indexableMetadata.showName,
        instructor: indexableMetadata.instructor,
        season_number: indexableMetadata.seasonNumber,
        total_seasons: indexableMetadata.totalSeasons,
        tags: indexableMetadata.tags,
        category: indexableMetadata.category,
        genre: indexableMetadata.genre,
        year: indexableMetadata.year,
        created_at: parsed.createdAt.toISOString(),
        updated_at: parsed.updatedAt.toISOString(),
      },
      {
        onConflict: "bundle_address",
      }
    );

    if (error) {
      console.error("Failed to upsert bundle:", error);
      return false;
    }

    // Update creator stats
    await supabase.rpc("update_creator_stats", {
      p_creator_address: parsed.creator,
    });

    console.log("Synced bundle:", parsed.bundleId);
    return true;
  } catch (error) {
    console.error("Error syncing bundle:", error);
    return false;
  }
}

/**
 * Sync bundle items for a bundle
 */
export async function syncBundleItems(
  connection: Connection,
  bundleAddress: PublicKey
): Promise<boolean> {
  try {
    const supabase = getServiceSupabase();

    // Get bundle ID from database
    const { data: bundle, error: bundleError } = await supabase
      .from("indexed_bundles")
      .select("id, bundle_id")
      .eq("bundle_address", bundleAddress.toBase58())
      .single();

    if (bundleError || !bundle) {
      console.error("Bundle not found in database:", bundleAddress.toBase58());
      return false;
    }

    // Fetch all bundle item accounts
    // BundleItem accounts have bundle as first field after discriminator
    const accounts = await connection.getProgramAccounts(new PublicKey(PROGRAM_ID), {
      filters: [
        {
          memcmp: {
            offset: 8, // After discriminator
            bytes: bundleAddress.toBase58(),
          },
        },
      ],
    });

    console.log(`Found ${accounts.length} bundle items for bundle ${bundle.bundle_id}`);

    // Parse and insert/update each item
    for (const { pubkey, account } of accounts) {
      const parsed = parseBundleItemAccount(account.data);
      if (!parsed) continue;

      // Get content ID from database
      const { data: content } = await supabase
        .from("indexed_content")
        .select("id")
        .eq("content_address", parsed.contentAddress)
        .single();

      if (!content) {
        console.warn("Content not indexed yet:", parsed.contentAddress);
        continue;
      }

      // Upsert bundle content relationship
      await supabase.from("bundle_content").upsert(
        {
          bundle_id: bundle.id,
          content_id: content.id,
          position: parsed.position,
          added_at: parsed.addedAt.toISOString(),
        },
        {
          onConflict: "bundle_id,content_id",
        }
      );
    }

    return true;
  } catch (error) {
    console.error("Error syncing bundle items:", error);
    return false;
  }
}

/**
 * Backfill all content accounts from the program
 */
export async function backfillAllContent(
  connection: Connection,
  batchSize: number = 50
): Promise<number> {
  try {
    console.log("Starting content backfill...");

    // Fetch all content accounts (discriminator = content_entry)
    // We'll need to filter by discriminator once we know the exact value
    const accounts = await connection.getProgramAccounts(new PublicKey(PROGRAM_ID));

    console.log(`Found ${accounts.length} total program accounts`);

    let synced = 0;
    let failed = 0;

    // Process in batches
    for (let i = 0; i < accounts.length; i += batchSize) {
      const batch = accounts.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async ({ pubkey, account }) => {
          // Try to parse as content account
          const parsed = parseContentAccount(pubkey, account.data);
          if (parsed) {
            const success = await syncContent(connection, pubkey);
            if (success) {
              synced++;
            } else {
              failed++;
            }
          }
        })
      );

      console.log(`Processed ${Math.min(i + batchSize, accounts.length)}/${accounts.length}`);
    }

    console.log(`Content backfill complete: ${synced} synced, ${failed} failed`);
    return synced;
  } catch (error) {
    console.error("Error during content backfill:", error);
    return 0;
  }
}

/**
 * Backfill all bundle accounts from the program
 */
export async function backfillAllBundles(
  connection: Connection,
  batchSize: number = 50
): Promise<number> {
  try {
    console.log("Starting bundle backfill...");

    const accounts = await connection.getProgramAccounts(new PublicKey(PROGRAM_ID));

    console.log(`Found ${accounts.length} total program accounts`);

    let synced = 0;
    let failed = 0;

    // Process in batches
    for (let i = 0; i < accounts.length; i += batchSize) {
      const batch = accounts.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async ({ pubkey, account }) => {
          // Try to parse as bundle account
          const parsed = parseBundleAccount(pubkey, account.data);
          if (parsed) {
            const success = await syncBundle(connection, pubkey);
            if (success) {
              synced++;
              // Also sync bundle items
              await syncBundleItems(connection, pubkey);
            } else {
              failed++;
            }
          }
        })
      );

      console.log(`Processed ${Math.min(i + batchSize, accounts.length)}/${accounts.length}`);
    }

    console.log(`Bundle backfill complete: ${synced} synced, ${failed} failed`);
    return synced;
  } catch (error) {
    console.error("Error during bundle backfill:", error);
    return 0;
  }
}

/**
 * Update content stats (minted_count, tips_received) from on-chain
 */
export async function updateContentStats(
  connection: Connection,
  contentAddress: PublicKey
): Promise<boolean> {
  try {
    const supabase = getServiceSupabase();

    // Fetch on-chain account
    const accountInfo = await connection.getAccountInfo(contentAddress);
    if (!accountInfo) {
      return false;
    }

    // Parse account data
    const parsed = parseContentAccount(contentAddress, accountInfo.data);
    if (!parsed) {
      return false;
    }

    // Update stats only
    const { error } = await supabase
      .from("indexed_content")
      .update({
        minted_count: parsed.mintedCount,
        pending_count: parsed.pendingCount,
        tips_received: parsed.tipsReceived,
        is_locked: parsed.isLocked,
        updated_at: new Date().toISOString(),
      })
      .eq("content_address", parsed.address);

    if (error) {
      console.error("Failed to update content stats:", error);
      return false;
    }

    // Update creator stats
    await supabase.rpc("update_creator_stats", {
      p_creator_address: parsed.creator,
    });

    return true;
  } catch (error) {
    console.error("Error updating content stats:", error);
    return false;
  }
}

/**
 * Update bundle stats (minted_count) from on-chain
 */
export async function updateBundleStats(
  connection: Connection,
  bundleAddress: PublicKey
): Promise<boolean> {
  try {
    const supabase = getServiceSupabase();

    // Fetch on-chain account
    const accountInfo = await connection.getAccountInfo(bundleAddress);
    if (!accountInfo) {
      return false;
    }

    // Parse account data
    const parsed = parseBundleAccount(bundleAddress, accountInfo.data);
    if (!parsed) {
      return false;
    }

    // Update stats only
    const { error } = await supabase
      .from("indexed_bundles")
      .update({
        minted_count: parsed.mintedCount,
        pending_count: parsed.pendingCount,
        is_locked: parsed.isLocked,
        is_active: parsed.isActive,
        updated_at: parsed.updatedAt.toISOString(),
      })
      .eq("bundle_address", parsed.address);

    if (error) {
      console.error("Failed to update bundle stats:", error);
      return false;
    }

    // Update creator stats
    await supabase.rpc("update_creator_stats", {
      p_creator_address: parsed.creator,
    });

    return true;
  } catch (error) {
    console.error("Error updating bundle stats:", error);
    return false;
  }
}
