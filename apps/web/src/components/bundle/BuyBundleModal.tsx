"use client";

import { useState, useEffect } from "react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useContentRegistry,
  BundleMintConfig,
  Rarity,
  getRarityName,
  getRarityFromWeight,
} from "@/hooks/useContentRegistry";
import { getTransactionErrorMessage } from "@/utils/wallet-errors";
import { RarityProbabilities, RARITY_STYLES } from "@/components/rarity";

interface BuyBundleModalProps {
  isOpen: boolean;
  onClose: () => void;
  bundleId: string;
  bundleName?: string;
  creator: PublicKey;
  mintConfig: BundleMintConfig;
  mintedCount?: bigint | number;
  pendingCount?: bigint | number;
  ownedCount?: number;
  onSuccess?: (rarity?: Rarity) => void;
}

const LAMPORTS_PER_SOL = 1_000_000_000;

type MintStep = "idle" | "committing" | "determining" | "revealing" | "success";

interface PendingBundleMintRequest {
  edition: bigint;
  mintRequestPda: PublicKey;
  nftAssetPda: PublicKey;
  requestedAt: number;
}

export function BuyBundleModal({
  isOpen,
  onClose,
  bundleId,
  bundleName,
  creator,
  mintConfig,
  mintedCount,
  pendingCount = BigInt(0),
  ownedCount = 0,
  onSuccess,
}: BuyBundleModalProps) {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const queryClient = useQueryClient();
  const { ecosystemConfig, useBundleCollection, client } = useContentRegistry();

  const collectionQuery = useBundleCollection(creator, bundleId);
  const bundleCollection = collectionQuery.data;
  const isLoadingCollection = collectionQuery.isLoading;

  const [error, setError] = useState<string | null>(null);
  const [mintStep, setMintStep] = useState<MintStep>("idle");
  const [revealedRarity, setRevealedRarity] = useState<Rarity | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [mintingProgress, setMintingProgress] = useState(0);
  const [pendingRequest, setPendingRequest] = useState<PendingBundleMintRequest | null>(null);
  const [isClaimingFallback, setIsClaimingFallback] = useState(false);
  const [fallbackCountdown, setFallbackCountdown] = useState<number | null>(null);
  const [isCheckingPending, setIsCheckingPending] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (!isOpen || !publicKey || !client) return;

    const checkForPendingRequests = async () => {
      setIsCheckingPending(true);
      try {
        const mintedBigInt = typeof mintedCount === 'bigint' ? mintedCount : BigInt(mintedCount ?? 0);
        const pendingBigInt = typeof pendingCount === 'bigint' ? pendingCount : BigInt(pendingCount ?? 0);
        const maxEdition = mintedBigInt + pendingBigInt + BigInt(10);
        const pendingRequests = await client.findPendingBundleMintRequests(
          publicKey,
          bundleId,
          creator,
          maxEdition
        );

        if (pendingRequests.length > 0) {
          const { edition, mintRequest, mintRequestPda, nftAssetPda } = pendingRequests[0];
          setPendingRequest({
            edition,
            mintRequestPda,
            nftAssetPda,
            requestedAt: Number(mintRequest.createdAt) * 1000,
          });
          setMintStep("revealing");
        }
      } catch (err) {
        console.error("Error checking for pending mint requests:", err);
      } finally {
        setIsCheckingPending(false);
      }
    };

    checkForPendingRequests();
  }, [isOpen, publicKey, client, bundleId, creator, mintedCount, pendingCount]);

  const price = mintConfig.price;
  const isFree = price === BigInt(0);
  const maxSupply = mintConfig.maxSupply;
  const mintedCountBigInt = typeof mintedCount === 'bigint' ? mintedCount : BigInt(mintedCount ?? 0);
  const pendingCountBigInt = typeof pendingCount === 'bigint' ? pendingCount : BigInt(pendingCount ?? 0);
  const remaining = maxSupply ? maxSupply - mintedCountBigInt : null;
  const isSoldOut = remaining !== null && remaining <= BigInt(0);
  const maxQuantity = remaining !== null ? Math.min(Number(remaining), 10) : 10;

  const handleClaimFallback = async () => {
    setError("MagicBlock fallback claim is no longer available. Please cancel and use simple mint instead.");
  };

  const handleCancelMint = async () => {
    setError("MagicBlock cancel is no longer available. Please contact support if you have a stuck pending mint.");
  };

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["bundles"] });
    queryClient.invalidateQueries({ queryKey: ["bundleMintConfig"] });
    queryClient.invalidateQueries({ queryKey: ["walletBundleNfts"] });
    queryClient.invalidateQueries({ queryKey: ["walletBundleNftRarities"] });
    queryClient.invalidateQueries({ queryKey: ["bundlePendingRewards"] });
    queryClient.invalidateQueries({ queryKey: ["allBundleRewardPools"] });
  };

  const formatPrice = (qty: number = 1) => {
    if (isFree) return "Free";
    const totalPrice = Number(price) * qty;
    return `${totalPrice / LAMPORTS_PER_SOL} SOL`;
  };

  const handleBuy = async () => {
    setError(null);
    setMintStep("idle");
    setMintingProgress(0);
    setRevealedRarity(null);
    setPendingRequest(null);

    if (!publicKey) {
      setError("Please connect your wallet");
      return;
    }

    if (!ecosystemConfig) {
      setError("Ecosystem not initialized");
      return;
    }

    if (!bundleCollection) {
      setError("Bundle collection not found");
      return;
    }

    if (!client) {
      setError("Client not initialized");
      return;
    }

    if (isSoldOut) {
      setError("Sold out!");
      return;
    }

    try {
      for (let i = 0; i < quantity; i++) {
        setMintingProgress(i + 1);
        setRevealedRarity(null);
        setMintStep("committing");

        const bundleNameForNft = bundleName || bundleId;
        const { instruction, nftAsset, edition } = await client.simpleMintBundleInstruction(
          publicKey,
          bundleId,
          creator,
          ecosystemConfig.treasury,
          ecosystemConfig.treasury,
          bundleCollection.collectionAsset,
          bundleNameForNft.slice(0, 32),
          []
        );

        const tx = new Transaction().add(instruction);
        tx.feePayer = publicKey;
        const { blockhash } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;

        setMintStep("determining");

        const sig = await sendTransaction(tx, connection);
        await connection.confirmTransaction(sig, "confirmed");

        // Wait for data propagation before fetching rarity
        await new Promise(resolve => setTimeout(resolve, 1500));

        try {
          const rewardState = await client.fetchNftRewardState(nftAsset);
          if (rewardState) {
            // Convert weight to rarity (actual on-chain weights: 1, 5, 20, 60, 120)
            const rarity = getRarityFromWeight(rewardState.weight);
            setRevealedRarity(rarity);
            console.log("Bundle minted with rarity:", getRarityName(rarity), "weight:", rewardState.weight);
          }
        } catch {
          // Continue without rarity
        }
      }

      setMintStep("success");
      await new Promise(resolve => setTimeout(resolve, 2500));
      invalidateQueries();
      onSuccess?.(revealedRarity ?? undefined);
      handleClose();
    } catch (err) {
      console.error("Failed to mint bundle:", err);
      setError(getTransactionErrorMessage(err));
      setMintStep("idle");
    }
  };

  const handleClose = () => {
    setMintStep("idle");
    setRevealedRarity(null);
    setError(null);
    setQuantity(1);
    setMintingProgress(0);
    setPendingRequest(null);
    onClose();
  };

  if (!isOpen) return null;

  const isProcessing = mintStep !== "idle" && mintStep !== "success" && mintStep !== "revealing";

  const getStepMessage = () => {
    switch (mintStep) {
      case "committing": return "Preparing transaction...";
      case "determining": return "Buying bundle...";
      case "revealing": return "Confirming...";
      case "success":
        return revealedRarity ? `You got a ${getRarityName(revealedRarity)} edition!` : "Purchase successful!";
      default: return "";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={isProcessing ? undefined : handleClose} />

      <div className="relative bg-black border border-white/[0.08] rounded-xl w-full max-w-sm p-4 m-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent pointer-events-none" />

        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-white/90">Buy Bundle</h2>
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

          {bundleName && (
            <p className="text-white/40 mb-3 text-base">
              <span className="text-white/90 font-medium">{bundleName}</span>
            </p>
          )}

          <div className="space-y-3">
            {mintStep === "idle" && (
              <div className="bg-gradient-to-r from-purple-500/10 to-yellow-500/10 border border-purple-500/20 rounded-lg p-2.5 text-sm">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  <span className="font-medium text-white/90">Random Rarity</span>
                </div>
                <p className="text-white/40 text-sm">
                  Rarity determines rewards. Higher rarity = more rewards!
                </p>
                <RarityProbabilities className="mt-1.5" />
              </div>
            )}

            {isProcessing && (
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-lg p-4 text-center">
                <div className="mb-3">
                  {mintStep === "determining" ? (
                    <div className="w-12 h-12 mx-auto relative">
                      <div className="absolute inset-0 animate-spin" style={{ animationDuration: "3s" }}>
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
                    <div className="w-10 h-10 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  )}
                </div>
                <p className="text-lg font-medium text-white/90">{getStepMessage()}</p>
{quantity > 1 && (
                  <p className="text-sm text-white/40 mt-1">Buying {mintingProgress} of {quantity}</p>
                )}
                <div className="flex justify-center gap-1 mt-3">
                  <div className={`w-1.5 h-1.5 rounded-full ${mintStep === "committing" || mintStep === "determining" ? "bg-cyan-400" : "bg-white/20"}`} />
                  <div className={`w-1.5 h-1.5 rounded-full ${mintStep === "determining" ? "bg-cyan-400" : "bg-white/20"}`} />
                  <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                </div>
              </div>
            )}

            {mintStep === "revealing" && pendingRequest && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-center">
                <p className="text-yellow-400 font-medium text-base mb-1.5">Oracle timeout</p>
                <p className="text-sm text-white/40 mb-3">
                  VRF oracle didn't respond. Claim with slot hash randomness.
                </p>
                {fallbackCountdown !== null && fallbackCountdown > 0 ? (
                  <p className="text-sm text-white/30 mb-2">Fallback available in {Math.ceil(fallbackCountdown)}s</p>
                ) : (
                  <div className="space-y-1.5">
                    <button onClick={handleClaimFallback} disabled={isClaimingFallback || isCancelling}
                      className="w-full py-2 rounded-lg text-sm font-medium bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 disabled:opacity-50 text-white/90 transition-all">
                      {isClaimingFallback ? "Claiming..." : "Claim with Slot Hash"}
                    </button>
                    <button onClick={handleCancelMint} disabled={isClaimingFallback || isCancelling}
                      className="w-full py-2 rounded-lg text-sm font-medium bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] disabled:opacity-50 text-white/60 transition-all">
                      {isCancelling ? "Cancelling..." : "Cancel & Refund"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {mintStep === "success" && (
              <div className={`rounded-lg p-4 text-center border ${
                revealedRarity !== null && RARITY_STYLES[revealedRarity]
                  ? `${RARITY_STYLES[revealedRarity].border} ${RARITY_STYLES[revealedRarity].bg}`
                  : "border-emerald-500/30 bg-emerald-500/10"
              }`}>
                <div className="text-4xl mb-2">
                  {revealedRarity === 4 && <span className="animate-pulse">⭐</span>}
                  {revealedRarity === 3 && <span className="animate-bounce">💎</span>}
                  {revealedRarity === 2 && "💠"}
                  {revealedRarity === 1 && "🌿"}
                  {revealedRarity === 0 && "⚪"}
                  {(revealedRarity === null || !RARITY_STYLES[revealedRarity]) && "🎉"}
                </div>
                {revealedRarity !== null && RARITY_STYLES[revealedRarity] ? (
                  <>
                    <p className={`text-xl font-bold ${RARITY_STYLES[revealedRarity].text}`}>{getRarityName(revealedRarity)}!</p>
                    <p className="text-sm text-white/40 mt-0.5">{getRarityName(revealedRarity).toLowerCase()} rarity edition</p>
                  </>
                ) : (
                  <>
                    <p className="text-xl font-bold text-emerald-400">Success!</p>
                    <p className="text-sm text-white/40 mt-0.5">Bundle purchase successful</p>
                  </>
                )}
              </div>
            )}

            {ownedCount > 0 && mintStep === "idle" && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2 text-emerald-400 text-sm flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                You already own {ownedCount} edition{ownedCount > 1 ? "s" : ""}
              </div>
            )}

            {mintStep === "idle" && (
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-3">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-white/40 text-sm">Price per edition</span>
                  <span className="text-xl font-bold text-cyan-400">{formatPrice(1)}</span>
                </div>

                {!isSoldOut && maxQuantity > 1 && (
                  <div className="flex justify-between items-center mb-2 pt-2 border-t border-white/[0.06]">
                    <span className="text-white/40 text-sm">Quantity</span>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={quantity <= 1}
                        className="w-6 h-6 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] disabled:opacity-50 flex items-center justify-center transition-all text-sm text-white/70 hover:text-white/90">-</button>
                      <span className="w-6 text-center font-medium text-white/90 text-base">{quantity}</span>
                      <button onClick={() => setQuantity(q => Math.min(maxQuantity, q + 1))} disabled={quantity >= maxQuantity}
                        className="w-6 h-6 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] disabled:opacity-50 flex items-center justify-center transition-all text-sm text-white/70 hover:text-white/90">+</button>
                    </div>
                  </div>
                )}

                {quantity > 1 && (
                  <div className="flex justify-between items-center mb-1.5 pt-2 border-t border-white/[0.06]">
                    <span className="text-white/40 text-sm">Total</span>
                    <span className="text-xl font-bold text-cyan-400">{formatPrice(quantity)}</span>
                  </div>
                )}

                {maxSupply ? (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-white/40">Editions</span>
                    <span className="text-white/70">{mintedCountBigInt.toString()} / {maxSupply.toString()}
                      {remaining !== null && remaining > BigInt(0) && <span className="text-white/40 ml-1">({remaining.toString()} left)</span>}
                    </span>
                  </div>
                ) : (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-white/40">Editions</span>
                    <span className="text-white/70">{mintedCountBigInt.toString()} (unlimited)</span>
                  </div>
                )}
              </div>
            )}

            {mintStep === "idle" && (
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-2.5">
                <h3 className="text-xs uppercase tracking-[0.15em] text-white/30 mb-2">Your payment goes to</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-white/50">Creator</span><span className="text-emerald-400">80%</span></div>
                  <div className="flex justify-between"><span className="text-white/50">Existing Holders</span><span className="text-blue-400">12%</span></div>
                  <div className="flex justify-between"><span className="text-white/30">Platform</span><span className="text-white/30">5%</span></div>
                  <div className="flex justify-between"><span className="text-white/30">Ecosystem</span><span className="text-white/30">3%</span></div>
                </div>
                {mintedCountBigInt === BigInt(0) && <p className="text-xs text-white/30 mt-1.5">First mint: 12% holder reward goes to creator</p>}
              </div>
            )}

            {mintStep === "idle" && (
              <p className="text-xs text-white/30 text-center">Creator receives {mintConfig.creatorRoyaltyBps / 100}% royalty on resales</p>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 text-red-400 text-sm">{error}</div>
            )}

            {mintStep === "idle" && (
              <button onClick={handleBuy} disabled={isSoldOut || !publicKey || isLoadingCollection || isCheckingPending || !bundleCollection || !client}
                className={`w-full py-2 rounded-lg text-base font-medium transition-all ${
                  isSoldOut ? "bg-white/[0.04] text-white/30 cursor-not-allowed"
                    : "bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-white/90 disabled:opacity-50 disabled:cursor-not-allowed"
                }`}>
{isCheckingPending ? "Checking..." : isLoadingCollection ? "Loading..." : isSoldOut ? "Sold Out"
                  : !publicKey ? "Connect Wallet" : isFree ? (quantity > 1 ? `Buy ${quantity} for Free` : "Buy for Free")
                  : quantity > 1 ? `Buy ${quantity} for ${formatPrice(quantity)}` : `Buy for ${formatPrice()}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
