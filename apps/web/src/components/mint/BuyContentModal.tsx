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
  getRarityFromWeight,
} from "@/hooks/useContentRegistry";
import { getTransactionErrorMessage } from "@/utils/wallet-errors";
import { RarityBadge, RarityProbabilities, RARITY_STYLES } from "@/components/rarity";

// Default platform wallet - if not set, use ecosystem treasury
// Lazy initialization to avoid SSR _bn issues
let _DEFAULT_PLATFORM_WALLET: PublicKey | null | undefined = undefined;
function getDefaultPlatformWallet(): PublicKey | null {
  if (_DEFAULT_PLATFORM_WALLET === undefined) {
    _DEFAULT_PLATFORM_WALLET = process.env.NEXT_PUBLIC_PLATFORM_WALLET
      ? new PublicKey(process.env.NEXT_PUBLIC_PLATFORM_WALLET)
      : null;
  }
  return _DEFAULT_PLATFORM_WALLET;
}

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

    const platformWallet = getDefaultPlatformWallet() || ecosystemConfig.treasury;

    for (let i = 0; i < quantity; i++) {
      setMintingProgress(i + 1);
      setRevealedRarity(null);

      try {
        // Fetch the content entry to get the collection asset
        const contentEntry = await client.fetchContent(contentCid);
        if (!contentEntry) {
          throw new Error("Content not found");
        }

        setMintStep("committing");

        // Use simple mint instruction (slot hash randomness)
        // Get content name from metadata for NFT naming
        const contentName = contentTitle || `Content ${contentCid.slice(0, 8)}`;
        const { instruction, nftAsset, edition } = await client.simpleMintInstruction(
          publicKey,
          contentCid,
          creator,
          ecosystemConfig.treasury,
          platformWallet,
          contentEntry.collectionAsset,
          contentName.slice(0, 32) // Limit to 32 chars for Metaplex Core
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

        // Wait for data propagation before fetching rarity
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Fetch rarity from UnifiedNftRewardState
        try {
          const rewardState = await client.fetchNftRewardState(nftAsset);
          if (rewardState) {
            // Convert weight to rarity (actual on-chain weights: 1, 5, 20, 60, 120)
            const rarity = getRarityFromWeight(rewardState.weight);
            setRevealedRarity(rarity);
            console.log("Content minted with rarity:", getRarityName(rarity), "weight:", rewardState.weight);
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
        return "Processing your purchase...";
      case "determining":
        return "Determining your rarity...";
      case "revealing":
        return "Revealing your content...";
      case "success":
        return revealedRarity
          ? `You got a ${getRarityName(revealedRarity)} edition!`
          : "Purchase successful!";
      default:
        return "";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={isProcessing ? undefined : handleClose} />

      <div className="relative bg-black border border-white/[0.08] rounded-lg w-full max-w-sm p-4 m-4 overflow-hidden">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none" />

        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-white/90">Buy Content</h2>
            <button
              onClick={handleClose}
              disabled={isProcessing}
              className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-colors text-white/40 hover:text-white/70 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {contentTitle && (
            <p className="text-white/40 mb-3 text-base">
              <span className="text-white/90 font-medium">{contentTitle}</span>
            </p>
          )}

          <div className="space-y-3">
            {/* Rarity Info Banner */}
            {mintStep === "idle" && (
              <div className="bg-gradient-to-r from-purple-500/10 to-yellow-500/10 border border-purple-500/20 rounded-lg p-2.5 text-sm">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  <span className="font-medium text-white/90">Random Rarity</span>
                </div>
                <p className="text-white/40 text-sm">
                  Your content will be assigned a random rarity. Higher rarity = more rewards!
                </p>
                <RarityProbabilities className="mt-1.5" />
              </div>
            )}

            {/* Minting Progress (VRF mode) */}
            {isProcessing && (
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-lg p-4 text-center">
                <div className="mb-3">
                  {mintStep === "determining" ? (
                    // Animated dice/stars for randomness
                    <div className="w-12 h-12 mx-auto relative">
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
                    <div className="w-10 h-10 border-3 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  )}
                </div>
                <p className="text-base font-medium text-white/90">{getStepMessage()}</p>
                {quantity > 1 && (
                  <p className="text-sm text-white/40 mt-1">
                    Buying {mintingProgress} of {quantity}
                  </p>
                )}
                <div className="flex justify-center gap-1 mt-3">
                  <div className={`w-1.5 h-1.5 rounded-full ${mintStep === "committing" || mintStep === "determining" || mintStep === "revealing" ? "bg-purple-400" : "bg-white/20"}`} />
                  <div className={`w-1.5 h-1.5 rounded-full ${mintStep === "determining" || mintStep === "revealing" ? "bg-purple-400" : "bg-white/20"}`} />
                  <div className={`w-1.5 h-1.5 rounded-full ${mintStep === "revealing" ? "bg-purple-400" : "bg-white/20"}`} />
                </div>
              </div>
            )}

            {/* Success State */}
            {mintStep === "success" && (
              <div className={`rounded-lg p-4 text-center border ${
                revealedRarity !== null && RARITY_STYLES[revealedRarity]
                  ? `${RARITY_STYLES[revealedRarity].border} ${RARITY_STYLES[revealedRarity].bg}`
                  : "border-emerald-500/30 bg-emerald-500/10"
              }`}>
                <div className="text-4xl mb-2">
                  {revealedRarity === 4 && <span className="animate-pulse">⭐</span>}{/* Legendary */}
                  {revealedRarity === 3 && <span className="animate-bounce">💎</span>}{/* Epic */}
                  {revealedRarity === 2 && "💠"}{/* Rare */}
                  {revealedRarity === 1 && "🌿"}{/* Uncommon */}
                  {revealedRarity === 0 && "⚪"}{/* Common */}
                  {(revealedRarity === null || !RARITY_STYLES[revealedRarity]) && "🎉"}
                </div>
                {revealedRarity !== null && RARITY_STYLES[revealedRarity] ? (
                  <>
                    <p className={`text-lg font-bold ${RARITY_STYLES[revealedRarity].text}`}>
                      {getRarityName(revealedRarity)}!
                    </p>
                    <p className="text-sm text-white/40 mt-0.5">
                      Your edition has {getRarityName(revealedRarity).toLowerCase()} rarity
                    </p>
                    {revealedRarity >= 2 && ( /* Rare or higher */
                      <p className="text-sm text-white/30 mt-1.5">
                        Higher rarity means more rewards!
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-lg font-bold text-emerald-400">Success!</p>
                    <p className="text-sm text-white/40 mt-0.5">
                      Your purchase was successful
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Already Owned Info */}
            {ownedCount > 0 && mintStep === "idle" && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2 text-emerald-400 text-sm flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                You already own {ownedCount} edition{ownedCount > 1 ? "s" : ""}
              </div>
            )}

            {/* Price Display (hidden during processing) */}
            {mintStep === "idle" && (
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-3">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-white/40 text-sm">Price per edition</span>
                  <span className="text-lg font-bold text-purple-400">
                    {formatPrice(1)}
                  </span>
                </div>

                {/* Quantity Selector */}
                {!isSoldOut && maxQuantity > 1 && (
                  <div className="flex justify-between items-center mb-2 pt-2 border-t border-white/[0.06]">
                    <span className="text-white/40 text-sm">Quantity</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setQuantity(q => Math.max(1, q - 1))}
                        disabled={quantity <= 1}
                        className="w-6 h-6 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all text-sm"
                      >
                        -
                      </button>
                      <span className="w-6 text-center font-medium text-white/90 text-base">{quantity}</span>
                      <button
                        onClick={() => setQuantity(q => Math.min(maxQuantity, q + 1))}
                        disabled={quantity >= maxQuantity}
                        className="w-6 h-6 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all text-sm"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}

                {/* Total Price */}
                {quantity > 1 && (
                  <div className="flex justify-between items-center mb-1.5 pt-2 border-t border-white/[0.06]">
                    <span className="text-white/40 text-sm">Total</span>
                    <span className="text-xl font-bold text-purple-400">
                      {formatPrice(quantity)}
                    </span>
                  </div>
                )}

                {/* Supply Info */}
                {maxSupply && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-white/40">Editions</span>
                    <span className="text-white/70">
                      {mintedCount.toString()} / {maxSupply.toString()}
                      {remaining !== null && remaining > BigInt(0) && (
                        <span className="text-white/40 ml-1">
                          ({remaining.toString()} left)
                        </span>
                      )}
                    </span>
                  </div>
                )}
                {!maxSupply && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-white/40">Editions</span>
                    <span className="text-white/70">{mintedCount.toString()} sold (unlimited)</span>
                  </div>
                )}
              </div>
            )}

            {/* Revenue Split (hidden during processing) */}
            {mintStep === "idle" && (
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-2.5">
                <h3 className="text-2xs uppercase tracking-[0.15em] text-white/30 mb-2">Your payment goes to</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/50">Creator</span>
                    <span className="text-emerald-400">80%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Existing Holders</span>
                    <span className="text-blue-400">12%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/30">Platform</span>
                    <span className="text-white/30">5%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/30">Ecosystem</span>
                    <span className="text-white/30">3%</span>
                  </div>
                </div>
                {mintedCount === BigInt(0) && (
                  <p className="text-2xs text-white/30 mt-1.5">
                    First purchase: 12% holder reward goes to creator
                  </p>
                )}
              </div>
            )}

            {/* Royalty Info (hidden during processing) */}
            {mintStep === "idle" && (
              <p className="text-2xs text-white/30 text-center">
                Creator receives {mintConfig.creatorRoyaltyBps / 100}% royalty on resales
              </p>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 text-red-400 text-sm">
                {error}
              </div>
            )}

            {mintStep === "idle" && (
              <button
                onClick={handleBuy}
                disabled={isSoldOut || !publicKey}
                className={`w-full py-2 rounded-lg text-base font-medium transition-all ${
                  isSoldOut
                    ? "bg-white/[0.04] text-white/30 cursor-not-allowed"
                    : "bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-white/90 disabled:opacity-50 disabled:cursor-not-allowed"
                }`}
              >
                {isSoldOut
                  ? "Sold Out"
                  : !publicKey
                  ? "Connect Wallet"
                  : isFree
                  ? quantity > 1 ? `Buy ${quantity} for Free` : "Buy for Free"
                  : quantity > 1
                  ? `Buy ${quantity} for ${formatPrice(quantity)}`
                  : `Buy for ${formatPrice()}`}
              </button>
            )}
          </div>
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
