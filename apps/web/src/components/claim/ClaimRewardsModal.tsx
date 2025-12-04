"use client";

import { useState, useMemo } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useContentRegistry } from "@/hooks/useContentRegistry";
import { getTransactionErrorMessage } from "@/utils/wallet-errors";

const LAMPORTS_PER_SOL = 1_000_000_000;

interface ClaimRewardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ClaimRewardsModal({
  isOpen,
  onClose,
  onSuccess,
}: ClaimRewardsModalProps) {
  const { publicKey } = useWallet();
  const {
    claimRewards,
    isClaimingReward,
    useGlobalRewardPool,
    usePendingRewards,
    globalContent,
  } = useContentRegistry();

  const { data: globalRewardPool, isLoading: isLoadingPool } = useGlobalRewardPool();
  const { data: pendingRewards, isLoading: isLoadingPending, refetch } = usePendingRewards();

  // Create a map of contentCid -> content metadata for display
  const contentMetadataMap = useMemo(() => {
    const map = new Map<string, { title: string; creator: string }>();
    for (const content of globalContent) {
      map.set(content.contentCid, {
        title: (content as any).metadata?.title || (content as any).metadata?.name || "Untitled",
        creator: content.creator?.toBase58().slice(0, 6) + "..." || "Unknown",
      });
    }
    return map;
  }, [globalContent]);

  const [error, setError] = useState<string | null>(null);
  const [claimingIndex, setClaimingIndex] = useState<number | null>(null);
  const [claimingAll, setClaimingAll] = useState(false);

  // Calculate total pending rewards (SOL only now)
  const totalPending = pendingRewards?.reduce((acc, r) => acc + r.pending, BigInt(0)) || BigInt(0);

  const formatSol = (lamports: bigint) => {
    return `${(Number(lamports) / LAMPORTS_PER_SOL).toFixed(6)} SOL`;
  };

  const handleClaimSingle = async (index: number) => {
    if (!publicKey || !pendingRewards) return;

    const reward = pendingRewards[index];
    if (!reward) return;

    setError(null);
    setClaimingIndex(index);

    try {
      await claimRewards({
        nftAsset: reward.nftAsset,
      });
      await refetch();
      if (pendingRewards.length === 1) {
        onSuccess?.();
        onClose();
      }
    } catch (err) {
      console.error("Failed to claim reward:", err);
      setError(getTransactionErrorMessage(err));
    } finally {
      setClaimingIndex(null);
    }
  };

  const handleClaimAll = async () => {
    if (!publicKey || !pendingRewards || pendingRewards.length === 0) return;

    setError(null);
    setClaimingAll(true);

    try {
      // Claim each NFT's rewards sequentially
      for (let i = 0; i < pendingRewards.length; i++) {
        const reward = pendingRewards[i];
        setClaimingIndex(i);
        await claimRewards({
          nftAsset: reward.nftAsset,
        });
      }
      await refetch();
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("Failed to claim rewards:", err);
      setError(getTransactionErrorMessage(err));
    } finally {
      setClaimingAll(false);
      setClaimingIndex(null);
    }
  };

  if (!isOpen) return null;

  const isLoading = isLoadingPool || isLoadingPending;
  const hasRewards = pendingRewards && pendingRewards.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />

      <div className="relative bg-gray-900 rounded-xl w-full max-w-md p-6 m-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Claim Rewards</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>


        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400"></div>
          </div>
        ) : !hasRewards ? (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-2">No pending rewards</div>
            <p className="text-sm text-gray-500">
              You'll earn rewards when new NFTs are minted for content you hold.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Total Summary */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Total Pending</h3>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-green-400">
                  {formatSol(totalPending)}
                </span>
                <span className="text-sm text-gray-500">
                  {pendingRewards.length} NFT{pendingRewards.length > 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {/* Global Reward Pool Info */}
            {globalRewardPool && (
              <div className="bg-gray-800/50 rounded-lg p-3 text-sm">
                <div className="flex justify-between text-gray-400">
                  <span>Global Pool Deposited</span>
                  <span>{formatSol(globalRewardPool.totalDeposited)}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Total Claimed</span>
                  <span>{formatSol(globalRewardPool.totalClaimed)}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Total NFTs in Pool</span>
                  <span>{globalRewardPool.totalNfts.toString()}</span>
                </div>
              </div>
            )}

            {/* Individual Claims */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-400">Your NFTs with Pending Rewards</h3>
              {pendingRewards.map((reward, index) => {
                const contentInfo = reward.contentCid
                  ? contentMetadataMap.get(reward.contentCid)
                  : null;
                return (
                  <div
                    key={reward.nftAsset.toBase58()}
                    className="bg-gray-800 rounded-lg p-3 flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0 mr-3">
                      <div className="text-sm font-medium truncate">
                        {contentInfo?.title || "Unknown Content"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {reward.nftAsset.toBase58().slice(0, 8)}...
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-green-400 font-medium">
                        {formatSol(reward.pending)}
                      </span>
                      <button
                        onClick={() => handleClaimSingle(index)}
                        disabled={isClaimingReward || claimingAll}
                        className="px-3 py-1 text-sm bg-primary-500 hover:bg-primary-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {claimingIndex === index ? "Claiming..." : "Claim"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Claim All Button */}
            {pendingRewards.length > 1 && (
              <button
                onClick={handleClaimAll}
                disabled={isClaimingReward || claimingAll}
                className="w-full py-3 rounded-lg font-medium bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors"
              >
                {claimingAll
                  ? `Claiming ${claimingIndex !== null ? claimingIndex + 1 : 0}/${pendingRewards.length}...`
                  : `Claim All (${pendingRewards.length} transactions)`}
              </button>
            )}

            {pendingRewards.length === 1 && (
              <button
                onClick={() => handleClaimSingle(0)}
                disabled={isClaimingReward}
                className="w-full py-3 rounded-lg font-medium bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors"
              >
                {isClaimingReward ? "Claiming..." : "Claim Reward"}
              </button>
            )}
          </div>
        )}

        {/* Info */}
        <p className="text-xs text-gray-500 mt-4 text-center">
          Rewards accumulate from the 12% holder share when ANY NFT is minted across the platform.
        </p>
      </div>
    </div>
  );
}
