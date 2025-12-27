import { useState, useCallback, useEffect, useRef } from "react";
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

  // Use ref to store params to avoid infinite loops
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const refetch = useCallback(async () => {
    const currentParams = paramsRef.current;
    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();

      if (currentParams.wallet) queryParams.set("wallet", currentParams.wallet);
      if (currentParams.creator) queryParams.set("creator", currentParams.creator);
      if (currentParams.content) queryParams.set("content", currentParams.content);
      if (currentParams.pool_type) queryParams.set("pool_type", currentParams.pool_type);
      if (currentParams.transaction_type)
        queryParams.set("transaction_type", currentParams.transaction_type);
      if (currentParams.limit) queryParams.set("limit", currentParams.limit.toString());
      if (currentParams.offset) queryParams.set("offset", currentParams.offset.toString());
      if (currentParams.sort) queryParams.set("sort", currentParams.sort);

      const response = await fetch(`/api/rewards/history?${queryParams}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      setTransactions(data.transactions || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Error fetching reward history:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch when params change
  useEffect(() => {
    refetch();
  }, [
    params.wallet,
    params.creator,
    params.content,
    params.pool_type,
    params.transaction_type,
    params.limit,
    params.offset,
    params.sort,
    refetch,
  ]);

  return {
    transactions,
    total,
    loading,
    error,
    refetch,
  };
}
