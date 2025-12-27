"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Download, RefreshCw, TrendingUp } from "lucide-react";
import { EarningsSummary } from "@/components/rewards/EarningsSummary";
import { RevenueChart } from "@/components/rewards/RevenueChart";
import { TransactionHistory } from "@/components/rewards/TransactionHistory";
import { useRevenueAnalytics } from "@/hooks/useRevenueAnalytics";
import { SidebarPanel } from "@/components/sidebar";

export default function AnalyticsPage() {
  const { publicKey } = useWallet();
  const [period, setPeriod] = useState("30d");
  const [exporting, setExporting] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = useCallback(() => setIsSidebarOpen(prev => !prev), []);

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
      <div className="min-h-screen bg-black text-white">
        <SidebarPanel isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <button
          onClick={toggleSidebar}
          className={`fixed top-4 z-50 p-3 bg-white/5 backdrop-blur-md rounded-full border border-white/10 hover:border-white/20 transition-all duration-300 ${isSidebarOpen ? 'left-[264px]' : 'left-4'}`}
        >
          <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center justify-center min-h-screen px-4">
          <div className="text-center max-w-sm">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center mx-auto mb-3 border border-white/10">
              <TrendingUp className="h-6 w-6 text-white/50" />
            </div>
            <h2 className="text-lg font-medium text-white mb-1">
              Connect Wallet
            </h2>
            <p className="text-base text-white/40">
              Connect your wallet to view analytics
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <SidebarPanel isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Menu Button */}
      <button
        onClick={toggleSidebar}
        className={`fixed top-4 z-50 p-3 bg-white/5 backdrop-blur-md rounded-full border border-white/10 hover:border-white/20 transition-all duration-300 ${isSidebarOpen ? 'left-[264px]' : 'left-4'}`}
      >
        <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Compact header bar */}
      <div className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-medium text-white">Analytics</h1>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => refetch()}
                disabled={loading}
                className="flex items-center gap-1.5 px-2.5 py-1.5 border border-white/[0.08] rounded-md hover:bg-white/[0.04] text-sm text-white/60 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
              <button
                onClick={handleExport}
                disabled={exporting || !revenue}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-md hover:bg-purple-500/30 text-sm disabled:opacity-50 transition-colors"
              >
                <Download className="h-3 w-3" />
                {exporting ? "..." : "Export"}
              </button>
            </div>
          </div>

          {/* Period Selector as tabs */}
          <div className="flex items-center gap-1 pb-3 overflow-x-auto no-scrollbar">
            {["7d", "30d", "90d", "1y", "all"].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 whitespace-nowrap ${
                  period === p
                    ? "bg-white text-black"
                    : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
                }`}
              >
                {p === "all" ? "All Time" : p === "1y" ? "1 Year" : p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-4">

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-sm text-red-400">Error: {error}</p>
          </div>
        )}

        {/* Summary Cards */}
        <div className="mb-6">
          <EarningsSummary data={revenue || {}} type="creator" />
        </div>

        {/* Revenue Breakdown */}
        {breakdown.length > 0 && (
          <div className="mb-6 bg-white/[0.02] rounded-xl border border-white/[0.06] p-4">
            <h2 className="text-base font-medium text-white/90 mb-3">Revenue Breakdown</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {breakdown.map((item) => (
                <div
                  key={item.source}
                  className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg"
                >
                  <div>
                    <div className="text-sm text-white/40">{item.source}</div>
                    <div className="text-base font-semibold text-white/80 mt-0.5">
                      {(item.amount / 1e9).toFixed(6)} SOL
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-purple-400">
                      {item.percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Revenue Chart */}
        <div className="mb-6 bg-white/[0.02] rounded-xl border border-white/[0.06] p-4">
          <h2 className="text-base font-medium text-white/90 mb-3">Revenue Over Time</h2>
          <RevenueChart data={timeSeries} type="revenue" />
        </div>

        {/* Recent Transactions */}
        <div className="bg-white/[0.02] rounded-xl border border-white/[0.06] p-4">
          <h2 className="text-base font-medium text-white/90 mb-3">Recent Transactions</h2>
          <TransactionHistory
            creator={publicKey.toString()}
            limit={20}
          />
        </div>

        {/* Footer Note */}
        <div className="mt-4 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
          <p className="text-sm text-purple-300/80">
            <strong>Note:</strong> Analytics are updated in real-time as transactions are processed on-chain.
            Revenue includes primary sales (80%), patron subscriptions (80% after distribution),
            ecosystem payouts, and secondary royalties (4%). All amounts are in SOL.
          </p>
        </div>
      </main>
    </div>
  );
}
