"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import type { RewardTransaction } from "@/app/api/rewards/history/route";

export interface TransactionRowProps {
  transaction: RewardTransaction;
}

export function TransactionRow({ transaction: tx }: TransactionRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const truncate = (str: string, len = 8) => {
    if (str.length <= len * 2) return str;
    return `${str.slice(0, len)}...${str.slice(-len)}`;
  };

  const lamportsToSol = (lamports: number) => {
    return (lamports / 1e9).toFixed(6);
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      mint: "NFT Mint",
      patron_subscription: "Patron Subscription",
      ecosystem_subscription: "Ecosystem Subscription",
      secondary_royalty: "Secondary Royalty",
      reward_claim: "Reward Claim",
      reward_distribution: "Distribution",
      reward_transfer: "Transfer",
    };
    return labels[type] || type;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      mint: "bg-green-100 text-green-800",
      patron_subscription: "bg-purple-100 text-purple-800",
      ecosystem_subscription: "bg-blue-100 text-blue-800",
      secondary_royalty: "bg-yellow-100 text-yellow-800",
      reward_claim: "bg-indigo-100 text-indigo-800",
      reward_distribution: "bg-pink-100 text-pink-800",
      reward_transfer: "bg-gray-100 text-gray-800",
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  const getPoolLabel = (pool: string | null) => {
    if (!pool) return null;
    const labels: Record<string, string> = {
      content: "Content Pool",
      bundle: "Bundle Pool",
      creator_patron: "Patron Pool",
      global_holder: "Global Pool",
      creator_dist: "Creator Distribution",
    };
    return labels[pool] || pool;
  };

  const date = new Date(tx.block_time);
  const explorerUrl = `https://solscan.io/tx/${tx.signature}?cluster=devnet`;

  return (
    <div className="border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
      {/* Main Row */}
      <div
        className="p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <button className="text-gray-400 hover:text-gray-600">
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>

            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(
                    tx.transaction_type
                  )}`}
                >
                  {getTypeLabel(tx.transaction_type)}
                </span>
                {tx.pool_type && (
                  <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                    {getPoolLabel(tx.pool_type)}
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {date.toLocaleDateString()} {date.toLocaleTimeString()}
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-lg font-semibold">
              {lamportsToSol(tx.amount)} SOL
            </div>
            <div className="text-xs text-gray-500">
              {truncate(tx.signature)}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-gray-200 bg-gray-50 p-4 space-y-3">
          {/* Transaction Signature */}
          <div>
            <label className="text-xs font-medium text-gray-500">
              Transaction
            </label>
            <div className="flex items-center gap-2 mt-1">
              <code className="flex-1 text-sm bg-white px-2 py-1 rounded border border-gray-200 font-mono">
                {tx.signature}
              </code>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard(tx.signature);
                }}
                className="p-1 hover:bg-gray-200 rounded"
                title="Copy"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4 text-gray-600" />
                )}
              </button>
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1 hover:bg-gray-200 rounded"
                title="View on Solscan"
              >
                <ExternalLink className="h-4 w-4 text-gray-600" />
              </a>
            </div>
          </div>

          {/* Fee Split (if applicable) */}
          {(tx.creator_share || tx.platform_share || tx.ecosystem_share || tx.holder_share) && (
            <div className="grid grid-cols-2 gap-2">
              <label className="col-span-2 text-xs font-medium text-gray-500">
                Fee Distribution
              </label>
              {tx.creator_share && (
                <div className="text-sm">
                  <span className="text-gray-600">Creator:</span>{" "}
                  <span className="font-mono">{lamportsToSol(tx.creator_share)} SOL</span>
                </div>
              )}
              {tx.holder_share && (
                <div className="text-sm">
                  <span className="text-gray-600">Holders:</span>{" "}
                  <span className="font-mono">{lamportsToSol(tx.holder_share)} SOL</span>
                </div>
              )}
              {tx.platform_share && (
                <div className="text-sm">
                  <span className="text-gray-600">Platform:</span>{" "}
                  <span className="font-mono">{lamportsToSol(tx.platform_share)} SOL</span>
                </div>
              )}
              {tx.ecosystem_share && (
                <div className="text-sm">
                  <span className="text-gray-600">Ecosystem:</span>{" "}
                  <span className="font-mono">{lamportsToSol(tx.ecosystem_share)} SOL</span>
                </div>
              )}
            </div>
          )}

          {/* Participants */}
          <div className="grid grid-cols-1 gap-2">
            {tx.source_wallet && (
              <div>
                <label className="text-xs font-medium text-gray-500">
                  Source
                </label>
                <code className="block text-sm bg-white px-2 py-1 rounded border border-gray-200 font-mono mt-1">
                  {truncate(tx.source_wallet, 12)}
                </code>
              </div>
            )}
            {tx.creator_wallet && (
              <div>
                <label className="text-xs font-medium text-gray-500">
                  Creator
                </label>
                <code className="block text-sm bg-white px-2 py-1 rounded border border-gray-200 font-mono mt-1">
                  {truncate(tx.creator_wallet, 12)}
                </code>
              </div>
            )}
            {tx.receiver_wallet && (
              <div>
                <label className="text-xs font-medium text-gray-500">
                  Receiver
                </label>
                <code className="block text-sm bg-white px-2 py-1 rounded border border-gray-200 font-mono mt-1">
                  {truncate(tx.receiver_wallet, 12)}
                </code>
              </div>
            )}
          </div>

          {/* NFT Details (if applicable) */}
          {(tx.nft_asset || tx.content_pubkey) && (
            <div className="grid grid-cols-1 gap-2">
              {tx.content_pubkey && (
                <div>
                  <label className="text-xs font-medium text-gray-500">
                    Content
                  </label>
                  <code className="block text-sm bg-white px-2 py-1 rounded border border-gray-200 font-mono mt-1">
                    {truncate(tx.content_pubkey, 12)}
                  </code>
                </div>
              )}
              {tx.nft_asset && (
                <div>
                  <label className="text-xs font-medium text-gray-500">
                    NFT Asset {tx.nft_weight && `(Weight: ${tx.nft_weight})`}
                  </label>
                  <code className="block text-sm bg-white px-2 py-1 rounded border border-gray-200 font-mono mt-1">
                    {truncate(tx.nft_asset, 12)}
                  </code>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
