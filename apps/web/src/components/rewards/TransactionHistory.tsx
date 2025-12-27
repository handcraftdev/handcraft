"use client";

import { useState } from "react";
import { useRewardHistory } from "@/hooks/useRewardHistory";
import { TransactionRow } from "./TransactionRow";
import { Loader2 } from "lucide-react";

export interface TransactionHistoryProps {
  wallet?: string;
  creator?: string;
  content?: string;
  poolType?: string;
  transactionType?: string;
  limit?: number;
}

export function TransactionHistory({
  wallet,
  creator,
  content,
  poolType,
  transactionType,
  limit = 50,
}: TransactionHistoryProps) {
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const { transactions, total, loading, error, refetch } = useRewardHistory({
    wallet,
    creator,
    content,
    pool_type: poolType,
    transaction_type: transactionType,
    limit: pageSize,
    offset: page * pageSize,
  });

  // Hook now auto-fetches when params change

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
        <p className="text-sm text-red-400">
          Error loading transactions: {error}
        </p>
        <button
          onClick={() => refetch()}
          className="mt-2 text-sm text-red-400 hover:text-red-300 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (loading && transactions.length === 0) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-4 w-4 animate-spin text-white/40" />
        <span className="ml-2 text-sm text-white/40">
          Loading transactions...
        </span>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-6 text-center">
        <p className="text-sm text-white/40">No transactions found</p>
      </div>
    );
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      {/* Transaction List */}
      <div className="space-y-2">
        {transactions.map((tx) => (
          <TransactionRow key={tx.id} transaction={tx} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-white/[0.06] pt-3">
          <div className="text-sm text-white/40">
            Showing {page * pageSize + 1} - {Math.min((page + 1) * pageSize, total)} of {total}
          </div>

          <div className="flex gap-1.5">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0 || loading}
              className="px-2.5 py-1 text-sm border border-white/[0.08] rounded-lg hover:bg-white/[0.04] text-white/60 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = Math.max(
                  0,
                  Math.min(
                    page - 2 + i,
                    totalPages - 5 + i
                  )
                );
                if (pageNum >= totalPages) return null;

                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    disabled={loading}
                    className={`px-2.5 py-1 text-sm border rounded-lg ${
                      pageNum === page
                        ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                        : "border-white/[0.08] hover:bg-white/[0.04] text-white/60"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {pageNum + 1}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1 || loading}
              className="px-2.5 py-1 text-sm border border-white/[0.08] rounded-lg hover:bg-white/[0.04] text-white/60 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Loading overlay for pagination */}
      {loading && transactions.length > 0 && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-white/40" />
        </div>
      )}
    </div>
  );
}
