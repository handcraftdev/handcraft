"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  useContentRegistry,
  PaymentCurrency,
  MintConfig,
} from "@/hooks/useContentRegistry";

interface BuyNftModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentCid: string;
  contentTitle?: string;
  creator: PublicKey;
  mintConfig: MintConfig;
  mintedCount: bigint;
  onSuccess?: () => void;
}

const LAMPORTS_PER_SOL = 1_000_000_000;

export function BuyNftModal({
  isOpen,
  onClose,
  contentCid,
  contentTitle,
  creator,
  mintConfig,
  mintedCount,
  onSuccess,
}: BuyNftModalProps) {
  const { publicKey } = useWallet();
  const { mintNftSol, isMintingNft, ecosystemConfig } = useContentRegistry();
  const [error, setError] = useState<string | null>(null);

  const price = mintConfig.price;
  const isFree = price === BigInt(0);
  const currency = mintConfig.currency;
  const maxSupply = mintConfig.maxSupply;
  const remaining = maxSupply ? maxSupply - mintedCount : null;
  const isSoldOut = remaining !== null && remaining <= BigInt(0);

  const formatPrice = () => {
    if (isFree) return "Free";
    if (currency === PaymentCurrency.Sol) {
      return `${Number(price) / LAMPORTS_PER_SOL} SOL`;
    } else {
      return `${Number(price) / 1_000_000} USDC`;
    }
  };

  const handleBuy = async () => {
    setError(null);

    if (!publicKey) {
      setError("Please connect your wallet");
      return;
    }

    if (!ecosystemConfig) {
      setError("Ecosystem not initialized");
      return;
    }

    if (isSoldOut) {
      setError("Sold out!");
      return;
    }

    try {
      if (currency === PaymentCurrency.Sol) {
        await mintNftSol({
          contentCid,
          creator,
          treasury: ecosystemConfig.treasury,
          platform: null, // No platform for direct purchases
        });
      } else {
        // USDC not implemented in UI yet
        setError("USDC payments coming soon!");
        return;
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("Failed to mint NFT:", err);
      setError(err instanceof Error ? err.message : "Failed to mint NFT");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />

      <div className="relative bg-gray-900 rounded-xl w-full max-w-md p-6 m-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Buy NFT</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {contentTitle && (
          <p className="text-gray-400 mb-4 text-sm">
            <span className="text-white font-medium">{contentTitle}</span>
          </p>
        )}

        <div className="space-y-4">
          {/* Price Display */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400">Price</span>
              <span className="text-2xl font-bold text-primary-400">
                {formatPrice()}
              </span>
            </div>

            {/* Supply Info */}
            {maxSupply && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Editions</span>
                <span>
                  {mintedCount.toString()} / {maxSupply.toString()}
                  {remaining !== null && remaining > BigInt(0) && (
                    <span className="text-gray-500 ml-1">
                      ({remaining.toString()} left)
                    </span>
                  )}
                </span>
              </div>
            )}
            {!maxSupply && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Editions</span>
                <span>{mintedCount.toString()} minted (unlimited)</span>
              </div>
            )}
          </div>

          {/* Revenue Split */}
          <div className="bg-gray-800/50 rounded-lg p-4">
            <h3 className="text-sm font-medium mb-2 text-gray-400">Your payment goes to:</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Creator</span>
                <span className="text-green-400">92%</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Platform</span>
                <span>5%</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Ecosystem</span>
                <span>3%</span>
              </div>
            </div>
          </div>

          {/* Royalty Info */}
          <p className="text-xs text-gray-500 text-center">
            Creator receives {mintConfig.creatorRoyaltyBps / 100}% royalty on resales
          </p>

          {error && (
            <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleBuy}
            disabled={isMintingNft || isSoldOut || !publicKey}
            className={`w-full py-3 rounded-lg font-medium transition-colors ${
              isSoldOut
                ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                : "bg-primary-500 hover:bg-primary-600 disabled:bg-gray-700 disabled:cursor-not-allowed"
            }`}
          >
            {isSoldOut
              ? "Sold Out"
              : isMintingNft
              ? "Minting..."
              : !publicKey
              ? "Connect Wallet"
              : isFree
              ? "Mint for Free"
              : `Buy for ${formatPrice()}`}
          </button>
        </div>
      </div>
    </div>
  );
}
