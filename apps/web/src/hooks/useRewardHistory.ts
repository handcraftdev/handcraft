import { useState, useCallback } from "react";
import type {
  RewardTransaction,
  TransactionHistoryParams,
} from "@/app/api/rewards/history/route";

interface UseRewardHistoryReturn {
  transactions: RewardTransaction[];
  total: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useRewardHistory(
  params: TransactionHistoryParams
): UseRewardHistoryReturn {
  const [transactions, setTransactions] = useState<RewardTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();

      if (params.wallet) queryParams.set("wallet", params.wallet);
      if (params.creator) queryParams.set("creator", params.creator);
      if (params.content) queryParams.set("content", params.content);
      if (params.pool_type) queryParams.set("pool_type", params.pool_type);
      if (params.transaction_type)
        queryParams.set("transaction_type", params.transaction_type);
      if (params.limit) queryParams.set("limit", params.limit.toString());
      if (params.offset) queryParams.set("offset", params.offset.toString());
      if (params.sort) queryParams.set("sort", params.sort);

      const response = await fetch(`/api/rewards/history?${queryParams}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      setTransactions(data.transactions);
      setTotal(data.total);
    } catch (err) {
      console.error("Error fetching reward history:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [params]);

  return {
    transactions,
    total,
    loading,
    error,
    refetch,
  };
}
