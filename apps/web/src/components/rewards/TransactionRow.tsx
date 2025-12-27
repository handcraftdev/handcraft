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
      mint: "bg-emerald-500/20 text-emerald-400",
      patron_subscription: "bg-purple-500/20 text-purple-400",
      ecosystem_subscription: "bg-blue-500/20 text-blue-400",
      secondary_royalty: "bg-amber-500/20 text-amber-400",
      reward_claim: "bg-indigo-500/20 text-indigo-400",
      reward_distribution: "bg-pink-500/20 text-pink-400",
      reward_transfer: "bg-white/10 text-white/60",
    };
    return colors[type] || "bg-white/10 text-white/60";
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
    <div className="border border-white/[0.06] rounded-lg hover:border-white/[0.1] transition-colors bg-white/[0.02]">
      {/* Main Row */}
      <div
        className="p-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 flex-1">
            <button className="text-white/30 hover:text-white/50">
              {expanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>

            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded-full ${getTypeColor(
                    tx.transaction_type
                  )}`}
                >
                  {getTypeLabel(tx.transaction_type)}
                </span>
                {tx.pool_type && (
                  <span className="px-2 py-0.5 text-xs bg-white/[0.06] text-white/40 rounded-full">
                    {getPoolLabel(tx.pool_type)}
                  </span>
                )}
              </div>
              <div className="text-sm text-white/40 mt-1">
                {date.toLocaleDateString()} {date.toLocaleTimeString()}
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-lg font-semibold text-white/90">
              {lamportsToSol(tx.amount)} SOL
            </div>
            <div className="text-xs text-white/30 font-mono">
              {truncate(tx.signature)}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-white/[0.06] bg-white/[0.02] p-3 space-y-2.5">
          {/* Transaction Signature */}
          <div>
            <label className="text-xs font-medium text-white/30 uppercase tracking-wider">
              Transaction
            </label>
            <div className="flex items-center gap-1.5 mt-1">
              <code className="flex-1 text-sm bg-black/30 px-2 py-1 rounded border border-white/[0.06] font-mono text-white/60 truncate">
                {tx.signature}
              </code>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard(tx.signature);
                }}
                className="p-1 hover:bg-white/[0.06] rounded"
                title="Copy"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-white/40" />
                )}
              </button>
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1 hover:bg-white/[0.06] rounded"
                title="View on Solscan"
              >
                <ExternalLink className="h-3.5 w-3.5 text-white/40" />
              </a>
            </div>
          </div>

          {/* Fee Split (if applicable) */}
          {(tx.creator_share || tx.platform_share || tx.ecosystem_share || tx.holder_share) && (
            <div className="grid grid-cols-2 gap-2">
              <label className="col-span-2 text-xs font-medium text-white/30 uppercase tracking-wider">
                Fee Distribution
              </label>
              {tx.creator_share && (
                <div className="text-sm">
                  <span className="text-white/40">Creator:</span>{" "}
                  <span className="font-mono text-white/60">{lamportsToSol(tx.creator_share)} SOL</span>
                </div>
              )}
              {tx.holder_share && (
                <div className="text-sm">
                  <span className="text-white/40">Holders:</span>{" "}
                  <span className="font-mono text-white/60">{lamportsToSol(tx.holder_share)} SOL</span>
                </div>
              )}
              {tx.platform_share && (
                <div className="text-sm">
                  <span className="text-white/40">Platform:</span>{" "}
                  <span className="font-mono text-white/60">{lamportsToSol(tx.platform_share)} SOL</span>
                </div>
              )}
              {tx.ecosystem_share && (
                <div className="text-sm">
                  <span className="text-white/40">Ecosystem:</span>{" "}
                  <span className="font-mono text-white/60">{lamportsToSol(tx.ecosystem_share)} SOL</span>
                </div>
              )}
            </div>
          )}

          {/* Participants */}
          <div className="grid grid-cols-1 gap-2">
            {tx.source_wallet && (
              <div>
                <label className="text-xs font-medium text-white/30 uppercase tracking-wider">
                  Source
                </label>
                <code className="block text-sm bg-black/30 px-2 py-1 rounded border border-white/[0.06] font-mono text-white/60 mt-1">
                  {truncate(tx.source_wallet, 12)}
                </code>
              </div>
            )}
            {tx.creator_wallet && (
              <div>
                <label className="text-xs font-medium text-white/30 uppercase tracking-wider">
                  Creator
                </label>
                <code className="block text-sm bg-black/30 px-2 py-1 rounded border border-white/[0.06] font-mono text-white/60 mt-1">
                  {truncate(tx.creator_wallet, 12)}
                </code>
              </div>
            )}
            {tx.receiver_wallet && (
              <div>
                <label className="text-xs font-medium text-white/30 uppercase tracking-wider">
                  Receiver
                </label>
                <code className="block text-sm bg-black/30 px-2 py-1 rounded border border-white/[0.06] font-mono text-white/60 mt-1">
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
                  <label className="text-xs font-medium text-white/30 uppercase tracking-wider">
                    Content
                  </label>
                  <code className="block text-sm bg-black/30 px-2 py-1 rounded border border-white/[0.06] font-mono text-white/60 mt-1">
                    {truncate(tx.content_pubkey, 12)}
                  </code>
                </div>
              )}
              {tx.nft_asset && (
                <div>
                  <label className="text-xs font-medium text-white/30 uppercase tracking-wider">
                    NFT Asset {tx.nft_weight && `(Weight: ${tx.nft_weight})`}
                  </label>
                  <code className="block text-sm bg-black/30 px-2 py-1 rounded border border-white/[0.06] font-mono text-white/60 mt-1">
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
