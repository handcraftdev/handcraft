import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export interface RewardTransaction {
  id: number;
  signature: string;
  block_time: string;
  transaction_type: string;
  pool_type: string | null;
  pool_id: string | null;
  amount: number;
  creator_share: number | null;
  platform_share: number | null;
  ecosystem_share: number | null;
  holder_share: number | null;
  source_wallet: string;
  creator_wallet: string | null;
  receiver_wallet: string | null;
  content_pubkey: string | null;
  nft_asset: string | null;
  nft_weight: number | null;
}

export interface TransactionHistoryParams {
  wallet?: string;
  creator?: string;
  content?: string;
  pool_type?: string;
  transaction_type?: string;
  limit?: number;
  offset?: number;
  sort?: "asc" | "desc";
}

/**
 * GET /api/rewards/history
 *
 * Query reward transaction history with flexible filters
 *
 * Query parameters:
 * - wallet: Filter by source_wallet or receiver_wallet
 * - creator: Filter by creator_wallet
 * - content: Filter by content_pubkey
 * - pool_type: Filter by pool type (content, bundle, patron, global_holder, creator_dist)
 * - transaction_type: Filter by transaction type (mint, claim, distribution, etc.)
 * - limit: Max results (default 50, max 1000)
 * - offset: Pagination offset (default 0)
 * - sort: Sort order by block_time (asc or desc, default desc)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const wallet = searchParams.get("wallet");
    const creator = searchParams.get("creator");
    const content = searchParams.get("content");
    const poolType = searchParams.get("pool_type");
    const transactionType = searchParams.get("transaction_type");
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "50"),
      1000
    );
    const offset = parseInt(searchParams.get("offset") || "0");
    const sort = (searchParams.get("sort") || "desc") as "asc" | "desc";

    // Build query
    const supabase = getServiceSupabase();
    let query = supabase
      .from("reward_transactions")
      .select("*", { count: "exact" });

    // Apply filters
    if (wallet) {
      query = query.or(`source_wallet.eq.${wallet},receiver_wallet.eq.${wallet}`);
    }

    if (creator) {
      query = query.eq("creator_wallet", creator);
    }

    if (content) {
      query = query.eq("content_pubkey", content);
    }

    if (poolType) {
      query = query.eq("pool_type", poolType);
    }

    if (transactionType) {
      query = query.eq("transaction_type", transactionType);
    }

    // Apply pagination and sorting
    query = query
      .order("block_time", { ascending: sort === "asc" })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to fetch transactions" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      transactions: data as RewardTransaction[],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/rewards/history/summary
 *
 * Get transaction summary statistics for a wallet
 *
 * Body: { wallet: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet } = body;

    if (!wallet) {
      return NextResponse.json(
        { error: "wallet parameter required" },
        { status: 400 }
      );
    }

    // Get transaction counts by type
    const supabase = getServiceSupabase();
    const { data: typeCounts, error: typeError } = await supabase
      .from("reward_transactions")
      .select("transaction_type")
      .or(`source_wallet.eq.${wallet},receiver_wallet.eq.${wallet}`);

    if (typeError) {
      throw typeError;
    }

    const typeCountMap = (typeCounts || []).reduce((acc, tx) => {
      acc[tx.transaction_type] = (acc[tx.transaction_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Get total amounts by pool type (for claims)
    const { data: poolAmounts, error: poolError } = await supabase
      .from("reward_transactions")
      .select("pool_type, amount")
      .eq("source_wallet", wallet)
      .eq("transaction_type", "reward_claim");

    if (poolError) {
      throw poolError;
    }

    const poolAmountMap = (poolAmounts || []).reduce((acc, tx) => {
      if (tx.pool_type) {
        acc[tx.pool_type] = (acc[tx.pool_type] || 0) + Number(tx.amount);
      }
      return acc;
    }, {} as Record<string, number>);

    // Get total earned (all claims)
    const totalEarned = Object.values(poolAmountMap).reduce(
      (sum, amount) => sum + amount,
      0
    );

    return NextResponse.json({
      wallet,
      transaction_counts: typeCountMap,
      earnings_by_pool: poolAmountMap,
      total_earned_lamports: totalEarned,
      total_earned_sol: totalEarned / 1e9,
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
