import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

/**
 * GET /api/rewards/export
 *
 * Export reward transactions as CSV
 *
 * Query parameters:
 * - wallet: Filter by wallet (optional)
 * - creator: Filter by creator (optional)
 * - type: "creator" or "user" - determines which transactions to include
 * - start_date: ISO date string (optional)
 * - end_date: ISO date string (optional)
 * - format: "csv" or "json" (default: csv)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const wallet = searchParams.get("wallet");
    const creator = searchParams.get("creator");
    const type = searchParams.get("type");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const format = searchParams.get("format") || "csv";

    if (!type || (type !== "creator" && type !== "user")) {
      return NextResponse.json(
        { error: "type parameter required (creator or user)" },
        { status: 400 }
      );
    }

    // Build query
    const supabase = getServiceSupabase();
    let query = supabase
      .from("reward_transactions")
      .select("*")
      .order("block_time", { ascending: true });

    // Apply filters based on type
    if (type === "creator") {
      if (!creator) {
        return NextResponse.json(
          { error: "creator parameter required for creator export" },
          { status: 400 }
        );
      }
      query = query.eq("creator_wallet", creator);
    } else if (type === "user") {
      if (!wallet) {
        return NextResponse.json(
          { error: "wallet parameter required for user export" },
          { status: 400 }
        );
      }
      query = query.or(`source_wallet.eq.${wallet},receiver_wallet.eq.${wallet}`);
    }

    // Date range filter
    if (startDate) {
      query = query.gte("block_time", startDate);
    }
    if (endDate) {
      query = query.lte("block_time", endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to fetch transactions" },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: "No transactions found" },
        { status: 404 }
      );
    }

    // Return based on format
    if (format === "json") {
      return NextResponse.json({
        transactions: data,
        count: data.length,
        exported_at: new Date().toISOString(),
      });
    }

    // Generate CSV
    const csv = generateCSV(data, type);
    const filename = `${type}_rewards_${new Date().toISOString().split("T")[0]}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
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
 * Generate CSV from transactions
 */
function generateCSV(transactions: any[], type: "creator" | "user"): string {
  const headers = getHeaders(type);
  const rows = transactions.map((tx) => formatRow(tx, type));

  return [headers, ...rows].join("\n");
}

/**
 * Get CSV headers based on export type
 */
function getHeaders(type: "creator" | "user"): string {
  if (type === "creator") {
    return [
      "Date",
      "Time",
      "Transaction Signature",
      "Transaction Type",
      "Pool Type",
      "Amount (SOL)",
      "Creator Share (SOL)",
      "Platform Share (SOL)",
      "Ecosystem Share (SOL)",
      "Holder Share (SOL)",
      "Source Wallet",
      "Content Pubkey",
      "NFT Asset",
    ].join(",");
  } else {
    return [
      "Date",
      "Time",
      "Transaction Signature",
      "Transaction Type",
      "Pool Type",
      "Amount (SOL)",
      "Earned/Spent",
      "Creator Wallet",
      "Content Pubkey",
      "NFT Asset",
      "NFT Weight",
    ].join(",");
  }
}

/**
 * Format a transaction row for CSV
 */
function formatRow(tx: any, type: "creator" | "user"): string {
  const date = new Date(tx.block_time);
  const dateStr = date.toISOString().split("T")[0];
  const timeStr = date.toISOString().split("T")[1].split(".")[0];

  const lamportsToSol = (lamports: number | null) =>
    lamports ? (lamports / 1e9).toFixed(9) : "0";

  if (type === "creator") {
    return [
      dateStr,
      timeStr,
      tx.signature,
      tx.transaction_type,
      tx.pool_type || "",
      lamportsToSol(tx.amount),
      lamportsToSol(tx.creator_share),
      lamportsToSol(tx.platform_share),
      lamportsToSol(tx.ecosystem_share),
      lamportsToSol(tx.holder_share),
      tx.source_wallet || "",
      tx.content_pubkey || "",
      tx.nft_asset || "",
    ]
      .map(escapeCSV)
      .join(",");
  } else {
    // For user export, determine if they earned or spent
    const earnedSpent =
      tx.transaction_type === "reward_claim" ? "Earned" : "Spent";

    return [
      dateStr,
      timeStr,
      tx.signature,
      tx.transaction_type,
      tx.pool_type || "",
      lamportsToSol(tx.amount),
      earnedSpent,
      tx.creator_wallet || "",
      tx.content_pubkey || "",
      tx.nft_asset || "",
      tx.nft_weight?.toString() || "",
    ]
      .map(escapeCSV)
      .join(",");
  }
}

/**
 * Escape CSV value
 */
function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * POST /api/rewards/export/email
 *
 * Email a CSV export to the user (future enhancement)
 */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: "Email export not yet implemented" },
    { status: 501 }
  );
}
