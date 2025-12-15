"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Download, RefreshCw, TrendingUp } from "lucide-react";
import { EarningsSummary } from "@/components/rewards/EarningsSummary";
import { RevenueChart } from "@/components/rewards/RevenueChart";
import { TransactionHistory } from "@/components/rewards/TransactionHistory";
import { useRevenueAnalytics } from "@/hooks/useRevenueAnalytics";

export default function AnalyticsPage() {
  const { publicKey } = useWallet();
  const [period, setPeriod] = useState("30d");
  const [exporting, setExporting] = useState(false);

  const {
    revenue,
    breakdown,
    timeSeries,
    recentTransactions,
    loading,
    error,
    refetch,
  } = useRevenueAnalytics("creator", publicKey?.toString(), period);

  const handleExport = async () => {
    if (!publicKey) return;

    setExporting(true);
    try {
      const queryParams = new URLSearchParams({
        type: "creator",
        creator: publicKey.toString(),
        format: "csv",
      });

      const response = await fetch(`/api/rewards/export?${queryParams}`);

      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `creator_rewards_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Export error:", err);
      alert("Failed to export data");
    } finally {
      setExporting(false);
    }
  };

  if (!publicKey) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Connect Your Wallet
          </h3>
          <p className="text-gray-600">
            Please connect your wallet to view analytics
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Creator Analytics
            </h1>
            <p className="text-gray-600 mt-1">
              Track your revenue and earnings across all sources
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => refetch()}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>

            <button
              onClick={handleExport}
              disabled={exporting || !revenue}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {exporting ? "Exporting..." : "Export CSV"}
            </button>
          </div>
        </div>

        {/* Period Selector */}
        <div className="flex gap-2">
          {["7d", "30d", "90d", "1y", "all"].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-sm rounded-md ${
                period === p
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {p === "all"
                ? "All Time"
                : p === "1y"
                ? "1 Year"
                : p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">Error: {error}</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="mb-8">
        <EarningsSummary data={revenue || {}} type="creator" />
      </div>

      {/* Revenue Breakdown */}
      {breakdown.length > 0 && (
        <div className="mb-8 bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Revenue Breakdown</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {breakdown.map((item) => (
              <div
                key={item.source}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div>
                  <div className="text-sm text-gray-600">{item.source}</div>
                  <div className="text-lg font-semibold mt-1">
                    {(item.amount / 1e9).toFixed(4)} SOL
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">
                    {item.percentage.toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revenue Chart */}
      <div className="mb-8 bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Revenue Over Time</h2>
        <RevenueChart data={timeSeries} type="revenue" />
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Transactions</h2>
        <TransactionHistory
          creator={publicKey.toString()}
          limit={20}
        />
      </div>

      {/* Footer Note */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> Analytics are updated in real-time as transactions are processed on-chain.
          Revenue includes primary sales (80%), patron subscriptions (80% after distribution),
          ecosystem payouts, and secondary royalties (4%). All amounts are in SOL.
        </p>
      </div>
    </div>
  );
}
