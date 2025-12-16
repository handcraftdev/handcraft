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
  mintedCount: bigint;
  pendingCount?: bigint;
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
        const maxEdition = mintedCount + pendingCount + BigInt(10);
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
  const remaining = maxSupply ? maxSupply - mintedCount : null;
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
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={isProcessing ? undefined : handleClose} />

      <div className="relative bg-black border border-white/10 rounded-2xl w-full max-w-md p-6 m-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent pointer-events-none" />

        <div className="relative">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-medium text-white/90">Buy Bundle</h2>
            <button
              onClick={handleClose}
              disabled={isProcessing}
              className="p-2 hover:bg-white/5 rounded-xl transition-colors text-white/50 hover:text-white/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {bundleName && (
            <p className="text-white/40 mb-4 text-sm">
              <span className="text-white/90 font-medium">{bundleName}</span>
            </p>
          )}

          <div className="space-y-4">
            {mintStep === "idle" && (
              <div className="bg-gradient-to-r from-purple-500/10 to-yellow-500/10 border border-purple-500/20 rounded-xl p-3 text-sm">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  <span className="font-medium text-white/90">Random Rarity</span>
                </div>
                <p className="text-white/40 text-xs">
                  Your rarity is determined by verifiable random function. Higher rarity = more rewards!
                </p>
                <RarityProbabilities className="mt-2" />
              </div>
            )}

            {isProcessing && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
                <div className="mb-4">
                  {mintStep === "determining" ? (
                    <div className="w-16 h-16 mx-auto relative">
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
                    <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  )}
                </div>
                <p className="text-lg font-medium text-white/90">{getStepMessage()}</p>
{quantity > 1 && (
                  <p className="text-sm text-white/40 mt-1">Buying {mintingProgress} of {quantity}</p>
                )}
                <div className="flex justify-center gap-1 mt-4">
                  <div className={`w-2 h-2 rounded-full ${mintStep === "committing" || mintStep === "determining" ? "bg-cyan-400" : "bg-white/20"}`} />
                  <div className={`w-2 h-2 rounded-full ${mintStep === "determining" ? "bg-cyan-400" : "bg-white/20"}`} />
                  <div className="w-2 h-2 rounded-full bg-white/20" />
                </div>
              </div>
            )}

            {mintStep === "revealing" && pendingRequest && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-center">
                <p className="text-yellow-400 font-medium mb-2">Oracle timeout</p>
                <p className="text-sm text-white/40 mb-4">
                  The VRF oracle didn't respond in time. You can claim your edition with slot hash randomness.
                </p>
                {fallbackCountdown !== null && fallbackCountdown > 0 ? (
                  <p className="text-sm text-white/30 mb-3">Fallback available in {Math.ceil(fallbackCountdown)}s</p>
                ) : (
                  <div className="space-y-2">
                    <button onClick={handleClaimFallback} disabled={isClaimingFallback || isCancelling}
                      className="w-full py-2.5 rounded-xl font-medium bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 hover:border-yellow-500/50 disabled:opacity-50 text-white/90 transition-all duration-300">
                      {isClaimingFallback ? "Claiming..." : "Claim with Slot Hash Randomness"}
                    </button>
                    <button onClick={handleCancelMint} disabled={isClaimingFallback || isCancelling}
                      className="w-full py-2.5 rounded-xl font-medium bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-50 text-white/70 transition-all duration-300">
                      {isCancelling ? "Cancelling..." : "Cancel & Get Refund"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {mintStep === "success" && (
              <div className={`rounded-xl p-6 text-center border ${
                revealedRarity !== null && RARITY_STYLES[revealedRarity]
                  ? `${RARITY_STYLES[revealedRarity].border} ${RARITY_STYLES[revealedRarity].bg}`
                  : "border-emerald-500/30 bg-emerald-500/10"
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
                    <p className={`text-xl font-bold ${RARITY_STYLES[revealedRarity].text}`}>{getRarityName(revealedRarity)}!</p>
                    <p className="text-sm text-white/40 mt-1">You purchased a {getRarityName(revealedRarity).toLowerCase()} rarity edition</p>
                  </>
                ) : (
                  <>
                    <p className="text-xl font-bold text-emerald-400">Success!</p>
                    <p className="text-sm text-white/40 mt-1">Your bundle purchase was successful</p>
                  </>
                )}
              </div>
            )}

            {ownedCount > 0 && mintStep === "idle" && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-emerald-400 text-sm flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                You already own {ownedCount} edition{ownedCount > 1 ? "s" : ""} of this bundle
              </div>
            )}

            {mintStep === "idle" && (
              <div className="bg-white/5 border border-white/5 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-white/40">Price per edition</span>
                  <span className="text-xl font-bold text-cyan-400">{formatPrice(1)}</span>
                </div>

                {!isSoldOut && maxQuantity > 1 && (
                  <div className="flex justify-between items-center mb-3 pt-2 border-t border-white/5">
                    <span className="text-white/40">Quantity</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={quantity <= 1}
                        className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-50 flex items-center justify-center transition-all">-</button>
                      <span className="w-8 text-center font-medium text-white/90">{quantity}</span>
                      <button onClick={() => setQuantity(q => Math.min(maxQuantity, q + 1))} disabled={quantity >= maxQuantity}
                        className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-50 flex items-center justify-center transition-all">+</button>
                    </div>
                  </div>
                )}

                {quantity > 1 && (
                  <div className="flex justify-between items-center mb-2 pt-2 border-t border-white/5">
                    <span className="text-white/40">Total</span>
                    <span className="text-2xl font-bold text-cyan-400">{formatPrice(quantity)}</span>
                  </div>
                )}

                {maxSupply ? (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-white/40">Editions</span>
                    <span className="text-white/70">{mintedCount.toString()} / {maxSupply.toString()}
                      {remaining !== null && remaining > BigInt(0) && <span className="text-white/40 ml-1">({remaining.toString()} left)</span>}
                    </span>
                  </div>
                ) : (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-white/40">Editions</span>
                    <span className="text-white/70">{mintedCount.toString()} (unlimited)</span>
                  </div>
                )}
              </div>
            )}

            {mintStep === "idle" && (
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-white/30 mb-3">Your payment goes to</h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-white/50">Creator</span><span className="text-emerald-400">80%</span></div>
                  <div className="flex justify-between"><span className="text-white/50">Existing Holders</span><span className="text-blue-400">12%</span></div>
                  <div className="flex justify-between"><span className="text-white/30">Platform</span><span className="text-white/30">5%</span></div>
                  <div className="flex justify-between"><span className="text-white/30">Ecosystem</span><span className="text-white/30">3%</span></div>
                </div>
                {mintedCount === BigInt(0) && <p className="text-xs text-white/30 mt-2">First mint: 12% holder reward goes to creator</p>}
              </div>
            )}

            {mintStep === "idle" && (
              <p className="text-xs text-white/30 text-center">Creator receives {mintConfig.creatorRoyaltyBps / 100}% royalty on resales</p>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">{error}</div>
            )}

            {mintStep === "idle" && (
              <button onClick={handleBuy} disabled={isSoldOut || !publicKey || isLoadingCollection || isCheckingPending || !bundleCollection || !client}
                className={`w-full py-3 rounded-xl font-medium transition-all duration-300 ${
                  isSoldOut ? "bg-white/5 text-white/30 cursor-not-allowed"
                    : "bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 hover:border-cyan-500/50 text-white/90 disabled:opacity-50 disabled:cursor-not-allowed"
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
