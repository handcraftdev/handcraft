"use client";

import { useState, useEffect } from "react";
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

  useEffect(() => {
    refetch();
  }, [page, wallet, creator, content, poolType, transactionType, refetch]);

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-800">
          Error loading transactions: {error}
        </p>
        <button
          onClick={() => refetch()}
          className="mt-2 text-sm text-red-600 hover:text-red-700 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (loading && transactions.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-600">
          Loading transactions...
        </span>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
        <p className="text-sm text-gray-600">No transactions found</p>
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
        <div className="flex items-center justify-between border-t border-gray-200 pt-4">
          <div className="text-sm text-gray-600">
            Showing {page * pageSize + 1} - {Math.min((page + 1) * pageSize, total)} of {total} transactions
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0 || loading}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className={`px-3 py-1 text-sm border rounded-md ${
                      pageNum === page
                        ? "bg-blue-500 text-white border-blue-500"
                        : "border-gray-300 hover:bg-gray-50"
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
              className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Loading overlay for pagination */}
      {loading && transactions.length > 0 && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}
    </div>
  );
}
