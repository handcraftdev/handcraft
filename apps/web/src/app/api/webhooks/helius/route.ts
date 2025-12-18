import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { BorshCoder, Event, EventParser } from "@coral-xyz/anchor";
import { timingSafeEqual } from "crypto";
import { idl } from "@handcraft/sdk";
import { getServiceSupabase } from "@/lib/supabase";
import { rateLimit, RATE_LIMITS } from "@/lib/ratelimit";

// Helius webhook secret for verification
const WEBHOOK_SECRET = process.env.HELIUS_WEBHOOK_SECRET;

/**
 * Constant-time comparison for webhook authentication
 * Prevents timing attacks on the webhook secret
 */
function verifyWebhookAuth(authHeader: string | null): boolean {
  if (!WEBHOOK_SECRET) return true; // No secret configured, skip verification
  if (!authHeader) return false;

  const expected = `Bearer ${WEBHOOK_SECRET}`;

  // Ensure both strings are the same length for timingSafeEqual
  if (authHeader.length !== expected.length) {
    return false;
  }

  try {
    return timingSafeEqual(
      Buffer.from(authHeader, "utf8"),
      Buffer.from(expected, "utf8")
    );
  } catch {
    return false;
  }
}

/**
 * Safely convert BigInt/number to Number with overflow check
 * Throws if value exceeds Number.MAX_SAFE_INTEGER
 */
function safeToNumber(value: bigint | number | string, fieldName: string): number {
  const bigValue = typeof value === "bigint" ? value : BigInt(value);
  if (bigValue > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${fieldName} exceeds safe integer range: ${bigValue}`);
  }
  if (bigValue < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new Error(`${fieldName} below safe integer range: ${bigValue}`);
  }
  return Number(bigValue);
}

// Content Registry Program ID - lazy loaded to avoid build-time errors
let _programId: PublicKey | null = null;
function getProgramId(): PublicKey {
  if (!_programId) {
    const programIdStr = process.env.CONTENT_REGISTRY_PROGRAM_ID;
    if (!programIdStr) {
      throw new Error("CONTENT_REGISTRY_PROGRAM_ID environment variable is required");
    }
    _programId = new PublicKey(programIdStr);
  }
  return _programId;
}

/**
 * Helius Webhook Handler for Reward Accounting
 *
 * This endpoint receives transaction notifications from Helius and processes
 * reward-related events to build the transaction ledger.
 *
 * Expected webhook configuration:
 * - Account addresses: [PROGRAM_ID]
 * - Transaction types: All
 * - Webhook type: Enhanced
 */
export async function POST(request: NextRequest) {
  // Apply rate limiting to prevent abuse
  const rateLimitResult = await rateLimit(request, RATE_LIMITS.webhook);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rateLimitResult.retryAfter) } }
    );
  }

  try {
    // Verify webhook secret using constant-time comparison
    const authHeader = request.headers.get("authorization");
    if (!verifyWebhookAuth(authHeader)) {
      console.error("Unauthorized webhook request");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Helius sends an array of transactions
    const transactions = Array.isArray(body) ? body : [body];

    let processedCount = 0;
    let errorCount = 0;

    for (const tx of transactions) {
      try {
        await processTransaction(tx);
        processedCount++;
      } catch (error) {
        console.error("Error processing transaction:", error);
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      processed: processedCount,
      errors: errorCount,
    });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Process a single transaction from Helius webhook
 */
async function processTransaction(tx: any) {
  const signature = tx.signature;
  const blockTime = tx.timestamp ? new Date(tx.timestamp * 1000) : new Date();
  const slot = tx.slot || 0;

  // Parse events from transaction logs
  const events = parseEventsFromLogs(tx.meta?.logMessages || []);

  for (const event of events) {
    try {
      await processEvent(event, signature, blockTime, slot);
    } catch (error) {
      console.error(`Error processing event ${event.name}:`, error);
    }
  }
}

/**
 * Parse Anchor events from transaction logs
 */
function parseEventsFromLogs(logs: string[]): Event[] {
  const events: Event[] = [];
  const eventParser = new EventParser(getProgramId(), new BorshCoder(idl as any));

  // EventParser.parseLogs expects the full log array
  const generator = eventParser.parseLogs(logs);
  for (const event of generator) {
    events.push(event);
  }

  return events;
}

/**
 * Process a single parsed event and insert into database
 */
async function processEvent(
  event: Event,
  signature: string,
  blockTime: Date,
  slot: number
) {
  const eventName = event.name;
  const data = event.data as any;

  switch (eventName) {
    case "RewardDepositEvent":
      await handleRewardDeposit(data, signature, blockTime, slot);
      break;

    case "RewardDistributionEvent":
      await handleRewardDistribution(data, signature, blockTime, slot);
      break;

    case "RewardClaimEvent":
      await handleRewardClaim(data, signature, blockTime, slot);
      break;

    case "RewardTransferEvent":
      await handleRewardTransfer(data, signature, blockTime, slot);
      break;

    case "SubscriptionCreatedEvent":
      await handleSubscriptionCreated(data, signature, blockTime, slot);
      break;

    case "SubscriptionCancelledEvent":
      await handleSubscriptionCancelled(data, signature, blockTime, slot);
      break;

    case "NftMintEvent":
      // Also track mints for completeness (already has creator_share in event)
      await handleNftMint(data, signature, blockTime, slot);
      break;

    default:
      // Ignore other events
      break;
  }
}

/**
 * Handle RewardDepositEvent
 */
async function handleRewardDeposit(
  data: any,
  signature: string,
  blockTime: Date,
  slot: number
) {
  const supabase = getServiceSupabase();
  const { error } = await supabase.from("reward_transactions").insert({
    signature,
    block_time: blockTime.toISOString(),
    slot,
    transaction_type: "mint", // or map from data.source_type
    pool_type: data.pool_type,
    pool_id: data.pool_id.toString(),
    amount: safeToNumber(data.amount, "amount"),
    creator_share: data.fee_split ? safeToNumber(data.fee_split.creator_share, "creator_share") : null,
    platform_share: data.fee_split ? safeToNumber(data.fee_split.platform_share, "platform_share") : null,
    ecosystem_share: data.fee_split ? safeToNumber(data.fee_split.ecosystem_share, "ecosystem_share") : null,
    holder_share: data.fee_split ? safeToNumber(data.fee_split.holder_share, "holder_share") : null,
    source_wallet: data.source.toString(),
    creator_wallet: data.creator ? data.creator.toString() : null,
    content_pubkey: data.content_or_bundle ? data.content_or_bundle.toString() : null,
    reward_per_share: data.new_reward_per_share?.toString(),
    event_data: data,
  });

  if (error) {
    console.error("Error inserting reward deposit:", error);
    throw error;
  }

  // Also create pool snapshot
  await createPoolSnapshot(data.pool_type, data.pool_id?.toString(), blockTime);
}

/**
 * Handle RewardDistributionEvent
 */
async function handleRewardDistribution(
  data: any,
  signature: string,
  blockTime: Date,
  slot: number
) {
  const supabase = getServiceSupabase();
  const transactionType =
    data.distribution_type === "patron_pool"
      ? "patron_subscription"
      : "ecosystem_subscription";

  const { error } = await supabase.from("reward_transactions").insert({
    signature,
    block_time: blockTime.toISOString(),
    slot,
    transaction_type: transactionType,
    pool_type: null, // Distribution affects multiple pools
    pool_id: data.pool_id ? data.pool_id.toString() : null,
    amount: safeToNumber(data.total_amount, "total_amount"),
    creator_share: data.creator_amount ? safeToNumber(data.creator_amount, "creator_amount") : null,
    platform_share: safeToNumber(data.platform_amount, "platform_amount"),
    ecosystem_share: safeToNumber(data.ecosystem_amount, "ecosystem_amount"),
    holder_share: safeToNumber(data.holder_pool_amount, "holder_pool_amount"),
    creator_dist_pool_amount: data.creator_dist_pool_amount ? safeToNumber(data.creator_dist_pool_amount, "creator_dist_pool_amount") : null,
    source_wallet: "STREAMING_TREASURY", // Placeholder for treasury
    creator_wallet: data.pool_id ? data.pool_id.toString() : null,
    event_data: data,
  });

  if (error) {
    console.error("Error inserting reward distribution:", error);
    throw error;
  }
}

/**
 * Handle RewardClaimEvent
 */
async function handleRewardClaim(
  data: any,
  signature: string,
  blockTime: Date,
  slot: number
) {
  const supabase = getServiceSupabase();
  const { error } = await supabase.from("reward_transactions").insert({
    signature,
    block_time: blockTime.toISOString(),
    slot,
    transaction_type: "reward_claim",
    pool_type: data.pool_type,
    pool_id: data.pool_id ? data.pool_id.toString() : null,
    amount: safeToNumber(data.amount, "claim_amount"),
    source_wallet: data.claimer.toString(),
    nft_asset: data.nft_asset ? data.nft_asset.toString() : null,
    nft_weight: data.nft_weight ? safeToNumber(data.nft_weight, "nft_weight") : null,
    debt_before: data.debt_before?.toString(),
    debt_after: data.debt_after?.toString(),
    event_data: data,
  });

  if (error) {
    console.error("Error inserting reward claim:", error);
    throw error;
  }
}

/**
 * Handle RewardTransferEvent
 */
async function handleRewardTransfer(
  data: any,
  signature: string,
  blockTime: Date,
  slot: number
) {
  const supabase = getServiceSupabase();
  const { error } = await supabase.from("reward_transactions").insert({
    signature,
    block_time: blockTime.toISOString(),
    slot,
    transaction_type: "reward_transfer",
    pool_type: data.pool_type,
    pool_id: data.pool_id.toString(),
    amount: safeToNumber(data.sender_claimed, "sender_claimed"),
    source_wallet: data.sender.toString(),
    receiver_wallet: data.receiver.toString(),
    nft_asset: data.nft_asset.toString(),
    debt_before: data.sender_new_debt?.toString(),
    debt_after: data.receiver_new_debt?.toString(),
    event_data: data,
  });

  if (error) {
    console.error("Error inserting reward transfer:", error);
    throw error;
  }
}

/**
 * Handle SubscriptionCreatedEvent
 */
async function handleSubscriptionCreated(
  data: any,
  signature: string,
  blockTime: Date,
  slot: number
) {
  const supabase = getServiceSupabase();
  const { error } = await supabase.from("subscriptions").insert({
    subscriber_wallet: data.subscriber.toString(),
    creator_wallet: data.creator ? data.creator.toString() : null,
    subscription_type: data.subscription_type,
    stream_id: data.stream_id.toString(),
    monthly_price: safeToNumber(data.price, "subscription_price"),
    is_active: true,
    started_at: new Date(safeToNumber(data.started_at, "started_at") * 1000).toISOString(),
    created_signature: signature,
  });

  if (error) {
    console.error("Error inserting subscription:", error);
    throw error;
  }
}

/**
 * Handle SubscriptionCancelledEvent
 */
async function handleSubscriptionCancelled(
  data: any,
  signature: string,
  blockTime: Date,
  slot: number
) {
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from("subscriptions")
    .update({
      is_active: false,
      cancelled_at: new Date(safeToNumber(data.cancelled_at, "cancelled_at") * 1000).toISOString(),
      cancelled_signature: signature,
      updated_at: new Date().toISOString(),
    })
    .eq("stream_id", data.stream_id.toString());

  if (error) {
    console.error("Error updating subscription:", error);
    throw error;
  }
}

/**
 * Handle NftMintEvent (for primary sales tracking)
 */
async function handleNftMint(
  data: any,
  signature: string,
  blockTime: Date,
  slot: number
) {
  // NftMintEvent contains price but not fee splits
  // Fee splits should come from RewardDepositEvent
  // This is just for reference/completeness
  console.log(`NFT minted: ${data.nft_asset.toString()} for ${data.price} lamports`);
}

/**
 * Create a pool snapshot for analytics
 */
async function createPoolSnapshot(
  poolType: string,
  poolId: string | null,
  snapshotAt: Date
) {
  // This would require fetching current on-chain pool state
  // For now, we'll skip automatic snapshots and rely on a cron job
  // that periodically fetches and stores pool states

  // TODO: Implement cron job for periodic pool snapshots
  // See: apps/web/src/app/api/cron/pool-snapshots/route.ts
}

/**
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "helius-webhook",
    timestamp: new Date().toISOString(),
  });
}
