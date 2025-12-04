"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  useContentRegistry,
  PaymentCurrency,
  MintConfig,
} from "@/hooks/useContentRegistry";
import { getTransactionErrorMessage } from "@/utils/wallet-errors";

// Default platform wallet - if not set, use ecosystem treasury
// This can be configured per-deployment or made dynamic
const DEFAULT_PLATFORM_WALLET = process.env.NEXT_PUBLIC_PLATFORM_WALLET
  ? new PublicKey(process.env.NEXT_PUBLIC_PLATFORM_WALLET)
  : null;

interface BuyNftModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentCid: string;
  contentTitle?: string;
  creator: PublicKey;
  mintConfig: MintConfig;
  mintedCount: bigint;
  ownedCount?: number;
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
  ownedCount = 0,
  onSuccess,
}: BuyNftModalProps) {
  const { publicKey } = useWallet();
  const { mintNftSol, isMintingNft, ecosystemConfig } = useContentRegistry();
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [mintingProgress, setMintingProgress] = useState(0);

  const price = mintConfig.price;
  const isFree = price === BigInt(0);
  const currency = mintConfig.currency;
  const maxSupply = mintConfig.maxSupply;
  const remaining = maxSupply ? maxSupply - mintedCount : null;
  const isSoldOut = remaining !== null && remaining <= BigInt(0);

  // Calculate max quantity user can buy
  const maxQuantity = remaining !== null ? Math.min(Number(remaining), 10) : 10;

  const formatPrice = (qty: number = 1) => {
    if (isFree) return "Free";
    const totalPrice = Number(price) * qty;
    if (currency === PaymentCurrency.Sol) {
      return `${totalPrice / LAMPORTS_PER_SOL} SOL`;
    } else {
      return `${totalPrice / 1_000_000} USDC`;
    }
  };

  const handleBuy = async () => {
    setError(null);
    setMintingProgress(0);

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
        // Use configured platform wallet, or fall back to treasury (ecosystem gets the platform cut)
        const platformWallet = DEFAULT_PLATFORM_WALLET || ecosystemConfig.treasury;

        // Mint multiple NFTs sequentially
        for (let i = 0; i < quantity; i++) {
          setMintingProgress(i + 1);
          await mintNftSol({
            contentCid,
            creator,
            treasury: ecosystemConfig.treasury,
            platform: platformWallet,
          });
        }
      } else {
        // USDC not implemented in UI yet
        setError("USDC payments coming soon!");
        return;
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("Failed to mint NFT:", err);
      setError(getTransactionErrorMessage(err));
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
          {/* Already Owned Info */}
          {ownedCount > 0 && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-green-400 text-sm flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              You already own {ownedCount} NFT{ownedCount > 1 ? "s" : ""} for this content
            </div>
          )}

          {/* Price Display */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400">Price per NFT</span>
              <span className="text-xl font-bold text-primary-400">
                {formatPrice(1)}
              </span>
            </div>

            {/* Quantity Selector */}
            {!isSoldOut && maxQuantity > 1 && (
              <div className="flex justify-between items-center mb-3 pt-2 border-t border-gray-700">
                <span className="text-gray-400">Quantity</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    className="w-8 h-8 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    -
                  </button>
                  <span className="w-8 text-center font-medium">{quantity}</span>
                  <button
                    onClick={() => setQuantity(q => Math.min(maxQuantity, q + 1))}
                    disabled={quantity >= maxQuantity}
                    className="w-8 h-8 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {/* Total Price */}
            {quantity > 1 && (
              <div className="flex justify-between items-center mb-2 pt-2 border-t border-gray-700">
                <span className="text-gray-400">Total</span>
                <span className="text-2xl font-bold text-primary-400">
                  {formatPrice(quantity)}
                </span>
              </div>
            )}

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
              ? `Minting ${mintingProgress}/${quantity}...`
              : !publicKey
              ? "Connect Wallet"
              : isFree
              ? quantity > 1 ? `Mint ${quantity} for Free` : "Mint for Free"
              : quantity > 1
              ? `Buy ${quantity} for ${formatPrice(quantity)}`
              : `Buy for ${formatPrice()}`}
          </button>
        </div>
      </div>
    </div>
  );
}
