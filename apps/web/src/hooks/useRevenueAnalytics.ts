import { useState, useCallback, useEffect, useRef } from "react";
import type {
  CreatorRevenue,
  UserEarnings,
  TimeSeriesDataPoint,
} from "@/app/api/rewards/analytics/route";

interface RevenueBreakdown {
  source: string;
  amount: number;
  percentage: number;
}

interface UseRevenueAnalyticsReturn {
  revenue: CreatorRevenue | null;
  earnings: UserEarnings | null;
  breakdown: RevenueBreakdown[];
  timeSeries: TimeSeriesDataPoint[];
  recentTransactions: any[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useRevenueAnalytics(
  type: "creator" | "user",
  wallet: string | null | undefined,
  period: string = "30d"
): UseRevenueAnalyticsReturn {
  const [revenue, setRevenue] = useState<CreatorRevenue | null>(null);
  const [earnings, setEarnings] = useState<UserEarnings | null>(null);
  const [breakdown, setBreakdown] = useState<RevenueBreakdown[]>([]);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesDataPoint[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use ref to store params to avoid infinite loops
  const paramsRef = useRef({ type, wallet, period });
  paramsRef.current = { type, wallet, period };

  const refetch = useCallback(async () => {
    const { type: currentType, wallet: currentWallet, period: currentPeriod } = paramsRef.current;

    if (!currentWallet) {
      setError("Wallet address required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams({
        type: currentType,
        wallet: currentWallet,
        period: currentPeriod,
      });

      const response = await fetch(`/api/rewards/analytics?${queryParams}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (currentType === "creator") {
        setRevenue(data.revenue);
      } else {
        setEarnings(data.earnings);
      }

      setBreakdown(data.breakdown || []);
      setTimeSeries(data.time_series || []);
      setRecentTransactions(data.recent_transactions || data.recent_claims || []);
    } catch (err) {
      console.error("Error fetching analytics:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch on mount and when deps change
  useEffect(() => {
    if (wallet) {
      refetch();
    }
  }, [wallet, type, period, refetch]);

  return {
    revenue,
    earnings,
    breakdown,
    timeSeries,
    recentTransactions,
    loading,
    error,
    refetch,
  };
}
