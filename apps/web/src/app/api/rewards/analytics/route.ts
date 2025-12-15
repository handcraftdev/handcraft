import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export interface CreatorRevenue {
  creator_wallet: string;
  total_all_time_revenue: number;
  total_primary_sales: number;
  total_patron_revenue: number;
  total_ecosystem_payouts: number;
  total_secondary_royalties: number;
  primary_sales_count: number;
  active_patron_subscribers: number;
  last_revenue_at: string;
}

export interface UserEarnings {
  wallet: string;
  total_all_time_earnings: number;
  total_content_rewards: number;
  total_bundle_rewards: number;
  total_patron_rewards: number;
  total_global_rewards: number;
  total_claim_count: number;
  last_claim_at: string;
}

export interface TimeSeriesDataPoint {
  date: string;
  amount: number;
  count: number;
}

/**
 * GET /api/rewards/analytics
 *
 * Get analytics data for creators or users
 *
 * Query parameters:
 * - type: "creator" or "user" (required)
 * - wallet: Wallet address (required)
 * - period: Time period for time series ("7d", "30d", "90d", "1y", "all") (default: "30d")
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const wallet = searchParams.get("wallet");
    const period = searchParams.get("period") || "30d";

    if (!type || !wallet) {
      return NextResponse.json(
        { error: "type and wallet parameters required" },
        { status: 400 }
      );
    }

    if (type === "creator") {
      return await getCreatorAnalytics(wallet, period);
    } else if (type === "user") {
      return await getUserAnalytics(wallet, period);
    } else {
      return NextResponse.json(
        { error: "type must be 'creator' or 'user'" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Get creator revenue analytics
 */
async function getCreatorAnalytics(wallet: string, period: string) {
  const supabase = getServiceSupabase();
  // Get aggregated revenue data
  const { data: revenue, error: revenueError } = await supabase
    .from("creator_revenue")
    .select("*")
    .eq("creator_wallet", wallet)
    .single();

  if (revenueError && revenueError.code !== "PGRST116") {
    throw revenueError;
  }

  // Get revenue breakdown using stored function
  const { data: breakdown, error: breakdownError } = await supabase
    .rpc("get_creator_revenue_breakdown", { creator: wallet });

  if (breakdownError) {
    throw breakdownError;
  }

  // Get time series data
  const timeSeries = await getCreatorTimeSeries(wallet, period);

  // Get recent transactions
  const { data: recentTx, error: txError } = await supabase
    .from("reward_transactions")
    .select("signature, block_time, transaction_type, amount, content_pubkey")
    .eq("creator_wallet", wallet)
    .order("block_time", { ascending: false })
    .limit(10);

  if (txError) {
    throw txError;
  }

  return NextResponse.json({
    wallet,
    revenue: revenue || getDefaultCreatorRevenue(wallet),
    breakdown: breakdown || [],
    time_series: timeSeries,
    recent_transactions: recentTx || [],
  });
}

/**
 * Get user earnings analytics
 */
async function getUserAnalytics(wallet: string, period: string) {
  const supabase = getServiceSupabase();
  // Get aggregated earnings data
  const { data: earnings, error: earningsError } = await supabase
    .from("user_earnings")
    .select("*")
    .eq("wallet", wallet)
    .single();

  if (earningsError && earningsError.code !== "PGRST116") {
    throw earningsError;
  }

  // Get earnings breakdown using stored function
  const { data: breakdown, error: breakdownError } = await supabase
    .rpc("get_user_earnings_breakdown", { user_wallet: wallet });

  if (breakdownError) {
    throw breakdownError;
  }

  // Get time series data
  const timeSeries = await getUserTimeSeries(wallet, period);

  // Get recent claims
  const { data: recentClaims, error: claimsError } = await supabase
    .from("reward_transactions")
    .select("signature, block_time, pool_type, amount, nft_asset")
    .eq("source_wallet", wallet)
    .eq("transaction_type", "reward_claim")
    .order("block_time", { ascending: false })
    .limit(10);

  if (claimsError) {
    throw claimsError;
  }

  return NextResponse.json({
    wallet,
    earnings: earnings || getDefaultUserEarnings(wallet),
    breakdown: breakdown || [],
    time_series: timeSeries,
    recent_claims: recentClaims || [],
  });
}

/**
 * Get creator revenue time series
 */
async function getCreatorTimeSeries(
  wallet: string,
  period: string
): Promise<TimeSeriesDataPoint[]> {
  const supabase = getServiceSupabase();
  const daysAgo = periodToDays(period);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysAgo);

  const { data, error } = await supabase
    .from("reward_transactions")
    .select("block_time, amount, creator_share")
    .eq("creator_wallet", wallet)
    .gte("block_time", cutoffDate.toISOString())
    .order("block_time", { ascending: true });

  if (error) {
    throw error;
  }

  // Group by day
  return aggregateByDay(data || [], "creator_share");
}

/**
 * Get user earnings time series
 */
async function getUserTimeSeries(
  wallet: string,
  period: string
): Promise<TimeSeriesDataPoint[]> {
  const supabase = getServiceSupabase();
  const daysAgo = periodToDays(period);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysAgo);

  const { data, error } = await supabase
    .from("reward_transactions")
    .select("block_time, amount")
    .eq("source_wallet", wallet)
    .eq("transaction_type", "reward_claim")
    .gte("block_time", cutoffDate.toISOString())
    .order("block_time", { ascending: true });

  if (error) {
    throw error;
  }

  // Group by day
  return aggregateByDay(data || [], "amount");
}

/**
 * Convert period string to days
 */
function periodToDays(period: string): number {
  switch (period) {
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "90d":
      return 90;
    case "1y":
      return 365;
    case "all":
      return 10000; // Large number to get all data
    default:
      return 30;
  }
}

/**
 * Aggregate transactions by day
 */
function aggregateByDay(
  transactions: any[],
  amountField: string
): TimeSeriesDataPoint[] {
  const dayMap = new Map<string, { amount: number; count: number }>();

  for (const tx of transactions) {
    const date = new Date(tx.block_time).toISOString().split("T")[0];
    const amount = Number(tx[amountField] || 0);

    const existing = dayMap.get(date) || { amount: 0, count: 0 };
    dayMap.set(date, {
      amount: existing.amount + amount,
      count: existing.count + 1,
    });
  }

  return Array.from(dayMap.entries())
    .map(([date, { amount, count }]) => ({ date, amount, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Get default creator revenue object
 */
function getDefaultCreatorRevenue(wallet: string): CreatorRevenue {
  return {
    creator_wallet: wallet,
    total_all_time_revenue: 0,
    total_primary_sales: 0,
    total_patron_revenue: 0,
    total_ecosystem_payouts: 0,
    total_secondary_royalties: 0,
    primary_sales_count: 0,
    active_patron_subscribers: 0,
    last_revenue_at: new Date().toISOString(),
  };
}

/**
 * Get default user earnings object
 */
function getDefaultUserEarnings(wallet: string): UserEarnings {
  return {
    wallet,
    total_all_time_earnings: 0,
    total_content_rewards: 0,
    total_bundle_rewards: 0,
    total_patron_rewards: 0,
    total_global_rewards: 0,
    total_claim_count: 0,
    last_claim_at: new Date().toISOString(),
  };
}
