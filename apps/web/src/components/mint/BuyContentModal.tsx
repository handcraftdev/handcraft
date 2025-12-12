"use client";

import { useState, useEffect, useCallback } from "react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useContentRegistry,
  MintConfig,
  Rarity,
  getRarityName,
} from "@/hooks/useContentRegistry";
import { getTransactionErrorMessage } from "@/utils/wallet-errors";
import { RarityBadge, RarityProbabilities, RARITY_STYLES } from "@/components/rarity";

// Default platform wallet - if not set, use ecosystem treasury
// This can be configured per-deployment or made dynamic
const DEFAULT_PLATFORM_WALLET = process.env.NEXT_PUBLIC_PLATFORM_WALLET
  ? new PublicKey(process.env.NEXT_PUBLIC_PLATFORM_WALLET)
  : null;

interface BuyContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentCid: string;
  contentTitle?: string;
  creator: PublicKey;
  mintConfig: MintConfig;
  mintedCount: bigint;
  ownedCount?: number;
  onSuccess?: (rarity?: Rarity) => void;
}

const LAMPORTS_PER_SOL = 1_000_000_000;

type MintStep = "idle" | "committing" | "determining" | "revealing" | "success";

export function BuyContentModal({
  isOpen,
  onClose,
  contentCid,
  contentTitle,
  creator,
  mintConfig,
  mintedCount,
  ownedCount = 0,
  onSuccess,
}: BuyContentModalProps) {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const queryClient = useQueryClient();
  const { ecosystemConfig, client } = useContentRegistry();

  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [mintingProgress, setMintingProgress] = useState(0);
  const [mintStep, setMintStep] = useState<MintStep>("idle");
  const [revealedRarity, setRevealedRarity] = useState<Rarity | null>(null);

  const price = mintConfig.priceSol;
  const isFree = price === BigInt(0);
  const maxSupply = mintConfig.maxSupply;
  const remaining = maxSupply ? maxSupply - mintedCount : null;
  const isSoldOut = remaining !== null && remaining <= BigInt(0);

  // Calculate max quantity user can buy
  const maxQuantity = remaining !== null ? Math.min(Number(remaining), 10) : 10;

  const formatPrice = (qty: number = 1) => {
    if (isFree) return "Free";
    const totalPrice = Number(price) * qty;
    return `${totalPrice / LAMPORTS_PER_SOL} SOL`;
  };

  // Simple mint with slot hash randomness - single transaction, immediate completion
  const handleSimpleMint = async () => {
    if (!publicKey || !ecosystemConfig || !client) return;

    // Check balance before starting
    const balance = await connection.getBalance(publicKey);
    const totalCost = Number(price) * quantity;
    const minRequired = totalCost + 10_000_000; // Add 0.01 SOL buffer for fees
    if (balance < minRequired) {
      const needed = (minRequired - balance) / LAMPORTS_PER_SOL;
      throw new Error(`Insufficient balance. You need at least ${needed.toFixed(3)} more SOL.`);
    }

    const platformWallet = DEFAULT_PLATFORM_WALLET || ecosystemConfig.treasury;

    for (let i = 0; i < quantity; i++) {
      setMintingProgress(i + 1);
      setRevealedRarity(null);

      try {
        // Fetch the content collection
        const contentCollection = await client.fetchContentCollection(contentCid);
        if (!contentCollection) {
          throw new Error("Content collection not found");
        }

        setMintStep("committing");

        // Use simple mint instruction (slot hash randomness)
        const { instruction, nftAsset, edition } = await client.simpleMintInstruction(
          publicKey,
          contentCid,
          creator,
          ecosystemConfig.treasury,
          platformWallet,
          contentCollection.collectionAsset
        );

        console.log("Simple mint params:", {
          contentCid,
          creator: creator.toBase58(),
          nftAsset: nftAsset.toBase58(),
          edition: edition.toString(),
        });

        // Build and send transaction
        const tx = new Transaction().add(instruction);
        tx.feePayer = publicKey;
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

        setMintStep("determining");

        const sig = await sendTransaction(tx, connection);
        await connection.confirmTransaction(sig, "confirmed");
        console.log("Simple mint confirmed:", sig);

        // Fetch rarity from UnifiedNftRewardState
        try {
          const rewardState = await client.fetchNftRewardState(nftAsset);
          if (rewardState) {
            // Convert weight to rarity
            const weight = rewardState.weight;
            let rarity: Rarity = Rarity.Common;
            if (weight >= 12000) rarity = Rarity.Legendary;
            else if (weight >= 6000) rarity = Rarity.Epic;
            else if (weight >= 2000) rarity = Rarity.Rare;
            else if (weight >= 500) rarity = Rarity.Uncommon;
            setRevealedRarity(rarity);
            console.log("Content minted with rarity:", getRarityName(rarity));
          }
        } catch {
          // If we can't fetch rarity, continue without it
        }

        setMintStep("success");
      } catch (err) {
        console.error("Simple mint error:", err);
        throw err;
      }
    }

    // Pause to show success state
    await new Promise(resolve => setTimeout(resolve, 2500));

    // Invalidate content-related queries
    queryClient.invalidateQueries({ queryKey: ["walletNfts"] });
    queryClient.invalidateQueries({ queryKey: ["walletNftRarities"] });
    queryClient.invalidateQueries({ queryKey: ["profileNfts"] });
    queryClient.invalidateQueries({ queryKey: ["profileNftRarities"] });
    queryClient.invalidateQueries({ queryKey: ["globalContent"] });

    onSuccess?.(revealedRarity ?? undefined);
    handleClose();
  };

  const handleBuy = async () => {
    setError(null);
    setMintingProgress(0);
    setMintStep("idle");

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
      await handleSimpleMint();
    } catch (err) {
      console.error("Failed to mint content:", err);
      setError(getTransactionErrorMessage(err));
      setMintStep("idle");
    }
  };

  const handleClose = () => {
    setMintStep("idle");
    setRevealedRarity(null);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  const isProcessing = mintStep !== "idle" && mintStep !== "success";

  // Get step message for display
  const getStepMessage = () => {
    switch (mintStep) {
      case "committing":
        return "Preparing your mint...";
      case "determining":
        return "Determining your rarity...";
      case "revealing":
        return "Revealing your content...";
      case "success":
        return revealedRarity
          ? `You got a ${getRarityName(revealedRarity)} edition!`
          : "Mint successful!";
      default:
        return "";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80" onClick={isProcessing ? undefined : handleClose} />

      <div className="relative bg-gray-900 rounded-xl w-full max-w-md p-6 m-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Mint Content</h2>
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
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
          {/* Rarity Info Banner */}
          {mintStep === "idle" && (
            <div className="bg-gradient-to-r from-purple-500/10 to-yellow-500/10 border border-purple-500/30 rounded-lg p-3 text-sm">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                <span className="font-medium text-white">Random Rarity</span>
              </div>
              <p className="text-gray-400 text-xs">
                Your content will be assigned a random rarity using verifiable randomness.
                Higher rarity = more rewards from the holder pool!
              </p>
              <RarityProbabilities className="mt-2" />
            </div>
          )}

          {/* Minting Progress (VRF mode) */}
          {isProcessing && (
            <div className="bg-gray-800 rounded-lg p-6 text-center">
              <div className="mb-4">
                {mintStep === "determining" ? (
                  // Animated dice/stars for randomness
                  <div className="w-16 h-16 mx-auto relative">
                    <div className="absolute inset-0 animate-spin-slow">
                      <svg className="w-full h-full text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                      </svg>
                    </div>
                    <div className="absolute inset-2 animate-pulse">
                      <svg className="w-full h-full text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                      </svg>
                    </div>
                  </div>
                ) : (
                  // Standard loading spinner
                  <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
                )}
              </div>
              <p className="text-lg font-medium">{getStepMessage()}</p>
              {quantity > 1 && (
                <p className="text-sm text-gray-400 mt-1">
                  Minting {mintingProgress} of {quantity}
                </p>
              )}
              <div className="flex justify-center gap-1 mt-4">
                <div className={`w-2 h-2 rounded-full ${mintStep === "committing" || mintStep === "determining" || mintStep === "revealing" ? "bg-primary-400" : "bg-gray-600"}`} />
                <div className={`w-2 h-2 rounded-full ${mintStep === "determining" || mintStep === "revealing" ? "bg-primary-400" : "bg-gray-600"}`} />
                <div className={`w-2 h-2 rounded-full ${mintStep === "revealing" ? "bg-primary-400" : "bg-gray-600"}`} />
              </div>
            </div>
          )}

          {/* Success State */}
          {mintStep === "success" && (
            <div className={`rounded-lg p-6 text-center border ${
              revealedRarity !== null && RARITY_STYLES[revealedRarity]
                ? `${RARITY_STYLES[revealedRarity].border} ${RARITY_STYLES[revealedRarity].bg}`
                : "border-green-500 bg-green-500/20"
            }`}>
              <div className="text-5xl mb-3">
                {revealedRarity === Rarity.Legendary && <span className="animate-pulse">⭐</span>}
                {revealedRarity === Rarity.Epic && <span className="animate-bounce">💎</span>}
                {revealedRarity === Rarity.Rare && "💠"}
                {revealedRarity === Rarity.Uncommon && "🌿"}
                {revealedRarity === Rarity.Common && "⚪"}
                {(revealedRarity === null || !RARITY_STYLES[revealedRarity]) && "🎉"}
              </div>
              {revealedRarity !== null && RARITY_STYLES[revealedRarity] ? (
                <>
                  <p className={`text-xl font-bold ${RARITY_STYLES[revealedRarity].text}`}>
                    {getRarityName(revealedRarity)}!
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    Your content has been minted with {getRarityName(revealedRarity).toLowerCase()} rarity
                  </p>
                  {revealedRarity >= Rarity.Rare && (
                    <p className="text-xs text-gray-500 mt-2">
                      Higher rarity means more rewards from the holder pool!
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xl font-bold text-green-400">Success!</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Your content has been minted successfully
                  </p>
                </>
              )}
            </div>
          )}

          {/* Already Owned Info */}
          {ownedCount > 0 && mintStep === "idle" && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-green-400 text-sm flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              You already own {ownedCount} edition{ownedCount > 1 ? "s" : ""} of this content
            </div>
          )}

          {/* Price Display (hidden during processing) */}
          {mintStep === "idle" && (
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-400">Price per edition</span>
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
          )}

          {/* Revenue Split (hidden during processing) */}
          {mintStep === "idle" && (
            <div className="bg-gray-800/50 rounded-lg p-4">
              <h3 className="text-sm font-medium mb-2 text-gray-400">Your payment goes to:</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Creator</span>
                  <span className="text-green-400">80%</span>
                </div>
                <div className="flex justify-between">
                  <span>Existing Holders</span>
                  <span className="text-blue-400">12%</span>
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
              {mintedCount === BigInt(0) && (
                <p className="text-xs text-gray-500 mt-2">
                  First mint: 12% holder reward goes to creator
                </p>
              )}
            </div>
          )}

          {/* Royalty Info (hidden during processing) */}
          {mintStep === "idle" && (
            <p className="text-xs text-gray-500 text-center">
              Creator receives {mintConfig.creatorRoyaltyBps / 100}% royalty on resales
            </p>
          )}

          {error && (
            <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          {mintStep === "idle" && (
            <button
              onClick={handleBuy}
              disabled={isSoldOut || !publicKey}
              className={`w-full py-3 rounded-lg font-medium transition-colors ${
                isSoldOut
                  ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                  : "bg-primary-500 hover:bg-primary-600 disabled:bg-gray-700 disabled:cursor-not-allowed"
              }`}
            >
              {isSoldOut
                ? "Sold Out"
                : !publicKey
                ? "Connect Wallet"
                : isFree
                ? quantity > 1 ? `Mint ${quantity} for Free` : "Mint for Free"
                : quantity > 1
                ? `Mint ${quantity} for ${formatPrice(quantity)}`
                : `Mint for ${formatPrice()}`}
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
      `}</style>
    </div>
  );
}
