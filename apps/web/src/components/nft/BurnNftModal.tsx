"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useContentRegistry } from "@/hooks/useContentRegistry";
import { getTransactionErrorMessage } from "@/utils/wallet-errors";

interface BurnNftModalProps {
  isOpen: boolean;
  onClose: () => void;
  nftAsset: PublicKey;
  collectionAsset: PublicKey;
  contentCid: string;
  nftTitle?: string;
  previewUrl?: string | null;
  onSuccess?: () => void;
}

export function BurnNftModal({
  isOpen,
  onClose,
  nftAsset,
  collectionAsset,
  contentCid,
  nftTitle,
  previewUrl,
  onSuccess,
}: BurnNftModalProps) {
  const { burnNft, isBurningNft } = useContentRegistry();
  const [error, setError] = useState<string | null>(null);

  const handleBurn = async () => {
    setError(null);

    try {
      await burnNft({ nftAsset, collectionAsset, contentCid });
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("Failed to burn NFT:", err);
      setError(getTransactionErrorMessage(err));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />

      <div className="relative bg-black border border-white/[0.08] rounded-lg w-full max-w-xs p-4 m-4">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent pointer-events-none rounded-lg" />

        <div className="relative text-center">
          {/* Fire Icon */}
          <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
            </svg>
          </div>

          <h2 className="text-lg font-medium text-white/90 mb-2">Burn NFT</h2>

          {/* NFT Preview */}
          {previewUrl && (
            <div className="w-16 h-16 mx-auto mb-3 rounded-lg overflow-hidden bg-white/5 border border-white/[0.06]">
              <img src={previewUrl} alt={nftTitle || "NFT"} className="w-full h-full object-cover" />
            </div>
          )}

          <p className="text-white/40 mb-3 text-base">
            Are you sure you want to burn{" "}
            <span className="text-white/80 font-medium">
              {nftTitle || "this NFT"}
            </span>
            ? This action is <span className="text-red-400 font-medium">permanent</span>.
          </p>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 mb-4">
            <p className="text-sm text-amber-300">
              You will receive the rent refund from the NFT account.
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2.5 text-red-400 text-sm mb-4">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={isBurningNft}
              className="flex-1 py-2 bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-50 rounded-lg text-base font-medium transition-all text-white/60 border border-white/[0.06]"
            >
              Cancel
            </button>
            <button
              onClick={handleBurn}
              disabled={isBurningNft}
              className="flex-1 py-2 bg-red-500/20 hover:bg-red-500/30 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-base font-medium transition-all flex items-center justify-center gap-1.5 border border-red-500/30 text-white/90"
            >
              {isBurningNft ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin text-red-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Burning...</span>
                </>
              ) : (
                "Burn NFT"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
