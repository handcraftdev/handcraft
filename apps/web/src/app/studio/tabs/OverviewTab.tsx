"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { StudioStats, StatCard } from "@/components/studio/shared";
import { UserProfileSettings } from "@/components/profile";
import { useRevenueAnalytics } from "@/hooks/useRevenueAnalytics";
import { ContentEntry, getBundleTypeLabel } from "@/hooks/useContentRegistry";

const LAMPORTS_PER_SOL = 1_000_000_000;

interface OverviewTabProps {
  content: ContentEntry[];
  bundles: any[];
  isLoadingProfile: boolean;
  hasProfile: boolean;
}

export function OverviewTab({ content, bundles, isLoadingProfile, hasProfile }: OverviewTabProps) {
  const { publicKey } = useWallet();

  // Fetch analytics data
  const { revenue, recentTransactions, loading: analyticsLoading } = useRevenueAnalytics(
    "creator",
    publicKey?.toString(),
    "30d"
  );

  // Calculate stats
  const stats = useMemo(() => {
    let totalMints = 0;
    let activeContent = 0;
    let lockedContent = 0;

    for (const c of content) {
      totalMints += Number(c.mintedCount || 0);
      if (c.isLocked || Number(c.mintedCount || 0) > 0) {
        lockedContent++;
      } else {
        activeContent++;
      }
    }

    const totalBundles = bundles.length;
    const activeBundles = bundles.filter((b) => b.isActive).length;

    return {
      totalMints,
      contentCount: content.length,
      activeContent,
      lockedContent,
      totalBundles,
      activeBundles,
    };
  }, [content, bundles]);

  // Format revenue
  const totalRevenue = revenue?.total_all_time_revenue
    ? (Number(revenue.total_all_time_revenue) / LAMPORTS_PER_SOL).toFixed(6)
    : "0.000000";

  const period30dRevenue = revenue?.total_primary_sales
    ? (Number(revenue.total_primary_sales) / LAMPORTS_PER_SOL).toFixed(6)
    : "0.000000";

  return (
    <div className="space-y-6">
      {/* Creator Profile */}
      <UserProfileSettings highlight={!isLoadingProfile && !hasProfile} />

      {/* Main Stats Grid */}
      <StudioStats
        stats={[
          {
            icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            ),
            label: "Published Content",
            value: stats.contentCount,
            subtitle: `${stats.activeContent} active · ${stats.lockedContent} locked`,
            color: "default",
          },
          {
            icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            ),
            label: "Bundles",
            value: stats.totalBundles,
            subtitle: `${stats.activeBundles} active`,
            color: "purple",
          },
          {
            icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            ),
            label: "NFTs Sold",
            value: stats.totalMints,
            color: "emerald",
          },
          {
            icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
            label: "Total Revenue",
            value: `${totalRevenue} SOL`,
            subtitle: analyticsLoading ? "Loading..." : undefined,
            color: "cyan",
          },
        ]}
      />

      {/* Analytics Summary + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Quick Analytics */}
        <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-medium text-white/90">Revenue (30 Days)</h3>
            <Link
              href="/studio/analytics"
              className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
            >
              View Details →
            </Link>
          </div>

          {analyticsLoading ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2.5 bg-white/[0.02] rounded-lg">
                <span className="text-white/50 text-sm">Primary Sales</span>
                <span className="text-white font-medium text-base">{period30dRevenue} SOL</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-white/[0.02] rounded-lg">
                <span className="text-white/50 text-sm">Patron Revenue</span>
                <span className="text-white font-medium text-base">
                  {revenue?.total_patron_revenue
                    ? (Number(revenue.total_patron_revenue) / LAMPORTS_PER_SOL).toFixed(6)
                    : "0.000000"}{" "}
                  SOL
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-white/[0.02] rounded-lg">
                <span className="text-white/50 text-sm">Secondary Royalties</span>
                <span className="text-white font-medium text-base">
                  {revenue?.total_secondary_royalties
                    ? (Number(revenue.total_secondary_royalties) / LAMPORTS_PER_SOL).toFixed(6)
                    : "0.000000"}{" "}
                  SOL
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
          <h3 className="text-base font-medium text-white/90 mb-3">Recent Activity</h3>

          {analyticsLoading ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          ) : recentTransactions && recentTransactions.length > 0 ? (
            <div className="space-y-2">
              {recentTransactions.slice(0, 5).map((tx: any, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2.5 bg-white/[0.02] rounded-lg"
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      tx.transaction_type === "primary_sale" ? "bg-emerald-500/20" :
                      tx.transaction_type === "rental" ? "bg-amber-500/20" :
                      "bg-purple-500/20"
                    }`}>
                      <svg className={`w-3.5 h-3.5 ${
                        tx.transaction_type === "primary_sale" ? "text-emerald-400" :
                        tx.transaction_type === "rental" ? "text-amber-400" :
                        "text-purple-400"
                      }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {tx.transaction_type === "primary_sale" ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        ) : tx.transaction_type === "rental" ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                        )}
                      </svg>
                    </div>
                    <div>
                      <p className="text-white/80 text-sm font-medium capitalize">
                        {tx.transaction_type?.replace(/_/g, " ") || "Transaction"}
                      </p>
                      <p className="text-white/40 text-xs">
                        {new Date(tx.timestamp || tx.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className="text-emerald-400 font-medium text-sm">
                    +{(Number(tx.amount || tx.creator_amount || 0) / LAMPORTS_PER_SOL).toFixed(6)} SOL
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center mx-auto mb-2">
                <svg className="w-5 h-5 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-white/40 text-sm">No recent activity</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
