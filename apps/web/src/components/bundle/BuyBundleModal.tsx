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
} from "@/hooks/useContentRegistry";
import { getTransactionErrorMessage } from "@/utils/wallet-errors";
import { RarityProbabilities, RARITY_STYLES } from "@/components/rarity";
import {
  MAGICBLOCK_DEFAULT_QUEUE,
  MB_FALLBACK_TIMEOUT_SECONDS,
} from "@handcraft/sdk";

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

  // Fetch bundle collection for minting
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

  // Check for existing pending mint requests when modal opens
  useEffect(() => {
    if (!isOpen || !publicKey || !client) return;

    const checkForPendingRequests = async () => {
      setIsCheckingPending(true);
      try {
        // Check editions from 1 up to minted + pending + 10 (to be safe)
        const maxEdition = mintedCount + pendingCount + BigInt(10);
        const pendingRequests = await client.findPendingBundleMintRequests(
          publicKey,
          bundleId,
          creator,
          maxEdition
        );

        if (pendingRequests.length > 0) {
          // Found a pending request - use the first one
          const { edition, mintRequest, mintRequestPda, nftAssetPda } = pendingRequests[0];
          console.log("Found pending bundle mint request:", {
            edition: edition.toString(),
            createdAt: new Date(Number(mintRequest.createdAt) * 1000).toISOString(),
            isFulfilled: mintRequest.isFulfilled,
          });

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

  // Calculate max quantity user can buy
  const maxQuantity = remaining !== null ? Math.min(Number(remaining), 10) : 10;

  // Countdown timer for fallback
  useEffect(() => {
    if (!pendingRequest) {
      setFallbackCountdown(null);
      return;
    }

    const updateCountdown = () => {
      const elapsed = (Date.now() - pendingRequest.requestedAt) / 1000;
      const remaining = Math.max(0, MB_FALLBACK_TIMEOUT_SECONDS - elapsed);
      setFallbackCountdown(remaining);
      if (remaining <= 0) {
        setFallbackCountdown(0);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [pendingRequest]);

  // Claim fallback (mint with slot hash randomness after timeout)
  const handleClaimFallback = async () => {
    if (!publicKey || !client || !pendingRequest) return;

    setIsClaimingFallback(true);
    setError(null);
    try {
      const fallbackIx = await client.mbBundleClaimFallbackInstruction(
        publicKey,
        bundleId,
        creator,
        pendingRequest.edition
      );
      const tx = new Transaction().add(fallbackIx);
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");

      // Fetch the actual rarity assigned by slot hash randomness
      try {
        const nftRarity = await client.fetchBundleNftRarity(pendingRequest.nftAssetPda);
        if (nftRarity) {
          setRevealedRarity(nftRarity.rarity);
        }
      } catch {
        // If we can't fetch, just show success
      }
      setMintStep("success");
      setPendingRequest(null);

      // Invalidate queries after short delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      invalidateQueries();
      onSuccess?.(revealedRarity ?? undefined);
      handleClose();
    } catch (err) {
      console.error("Failed to claim fallback:", err);
      setError(getTransactionErrorMessage(err));
    } finally {
      setIsClaimingFallback(false);
    }
  };

  // Cancel pending mint and get refund
  const [isCancelling, setIsCancelling] = useState(false);
  const handleCancelMint = async () => {
    if (!publicKey || !client || !pendingRequest) return;

    setIsCancelling(true);
    setError(null);
    try {
      const cancelIx = await client.mbCancelBundleMintInstruction(
        publicKey,
        bundleId,
        creator,
        pendingRequest.edition
      );
      const tx = new Transaction().add(cancelIx);
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");

      console.log("Bundle mint cancelled, refund received:", sig);
      setPendingRequest(null);
      setMintStep("idle");
      invalidateQueries();
    } catch (err) {
      console.error("Failed to cancel mint:", err);
      setError(getTransactionErrorMessage(err));
    } finally {
      setIsCancelling(false);
    }
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

        // Calculate edition number for unique PDA (minted + pending + 1)
        const edition = mintedCount + pendingCount + BigInt(i + 1);
        console.log("Bundle mint params:", {
          bundleId,
          creator: creator.toBase58(),
          treasury: ecosystemConfig.treasury.toBase58(),
          collectionAsset: bundleCollection.collectionAsset.toBase58(),
          edition: edition.toString(),
          mintedCount: mintedCount.toString(),
          pendingCount: pendingCount.toString(),
        });

        // Step 1: Send transaction to request mint
        setMintStep("committing");

        // Get the MagicBlock request mint instruction
        let mbRequestIx, mintRequestPda, nftAssetPda;
        try {
          const result = await client.mbRequestBundleMintInstruction(
            publicKey,
            bundleId,
            creator,
            ecosystemConfig.treasury,
            ecosystemConfig.treasury, // Use treasury as platform for now
            bundleCollection.collectionAsset,
            MAGICBLOCK_DEFAULT_QUEUE,
            edition
          );
          mbRequestIx = result.instruction;
          mintRequestPda = result.mintRequestPda;
          nftAssetPda = result.nftAssetPda;
          console.log("Instruction built successfully:", { mintRequestPda: mintRequestPda.toBase58(), nftAssetPda: nftAssetPda.toBase58() });
        } catch (ixErr) {
          console.error("Failed to build instruction:", ixErr);
          throw ixErr;
        }

        // Build transaction
        const tx = new Transaction().add(mbRequestIx);
        tx.feePayer = publicKey;
        const { blockhash } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;

        // Simulate to get detailed error logs
        console.log("Simulating transaction...");
        const simResult = await connection.simulateTransaction(tx);
        console.log("Simulation logs:", simResult.value.logs);
        if (simResult.value.err) {
          console.error("Simulation error:", simResult.value.err);
          console.error("Full logs:", simResult.value.logs?.join('\n'));
          throw new Error(`Transaction would fail: ${JSON.stringify(simResult.value.err)}`);
        }

        const sig = await sendTransaction(tx, connection);
        await connection.confirmTransaction(sig, "confirmed");
        console.log("MagicBlock bundle mint request confirmed:", sig);

        // Store pending request for fallback
        setPendingRequest({
          edition,
          mintRequestPda,
          nftAssetPda,
          requestedAt: Date.now(),
        });

        // Step 2: Wait for oracle to create the NFT
        setMintStep("determining");

        // Poll for NFT to appear (oracle creates it via callback)
        const maxWaitTime = 7000; // 7 seconds max (5 second timeout + 2 second buffer)
        const pollInterval = 1000; // Check every 1 second
        const startTime = Date.now();
        let nftCreated = false;

        while (Date.now() - startTime < maxWaitTime && !nftCreated) {
          try {
            // Check if NFT rarity has been revealed (revealedAt > 0 means VRF callback completed)
            const nftRarity = await client.fetchBundleNftRarity(nftAssetPda);
            if (nftRarity && nftRarity.revealedAt > BigInt(0)) {
              nftCreated = true;
              setRevealedRarity(nftRarity.rarity);
              console.log("Bundle NFT created with rarity:", getRarityName(nftRarity.rarity));
            }
          } catch {
            // NFT rarity not found or error, keep polling
          }

          if (!nftCreated) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
          }
        }

        if (!nftCreated) {
          // Oracle hasn't responded within timeout - use slot hash randomness fallback
          console.log("Oracle timeout reached. Using slot hash randomness fallback...");

          try {
            const fallbackIx = await client.mbBundleClaimFallbackInstruction(publicKey, bundleId, creator, edition);
            const fallbackTx = new Transaction().add(fallbackIx);
            fallbackTx.feePayer = publicKey;
            fallbackTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

            const fallbackSig = await sendTransaction(fallbackTx, connection);
            await connection.confirmTransaction(fallbackSig, "confirmed");

            console.log("Fallback claim confirmed:", fallbackSig);

            // Fetch the actual rarity that was assigned (slot hash randomness)
            try {
              const nftRarity = await client.fetchBundleNftRarity(nftAssetPda);
              if (nftRarity) {
                setRevealedRarity(nftRarity.rarity);
                console.log("Fallback rarity:", getRarityName(nftRarity.rarity));
              }
            } catch {
              // If we can't fetch rarity, just show success without specific rarity
            }
          } catch (fallbackErr) {
            console.error("Fallback claim failed:", fallbackErr);
            // Show pending state for manual fallback
            setPendingRequest({
              edition,
              mintRequestPda,
              nftAssetPda,
              requestedAt: Date.now() - 10000, // Make it look like timeout passed
            });
            setMintStep("revealing");
            return;
          }
        }

        // Clear pending request on success
        setPendingRequest(null);
      }

      setMintStep("success");

      // Pause to show success state
      await new Promise(resolve => setTimeout(resolve, 2500));

      // Invalidate queries
      invalidateQueries();
      onSuccess?.(revealedRarity ?? undefined);
      handleClose();
    } catch (err) {
      console.error("Failed to mint bundle NFT:", err);
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

  // Get step message for display
  const getStepMessage = () => {
    switch (mintStep) {
      case "committing":
        return "Requesting VRF randomness...";
      case "determining":
        return "Waiting for oracle...";
      case "revealing":
        return "Waiting for confirmation...";
      case "success":
        return revealedRarity
          ? `You got a ${getRarityName(revealedRarity)} NFT!`
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
          <h2 className="text-xl font-bold">Mint Bundle NFT</h2>
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

        {bundleName && (
          <p className="text-gray-400 mb-4 text-sm">
            <span className="text-white font-medium">{bundleName}</span>
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
                <span className="font-medium text-white">MagicBlock VRF Randomness</span>
              </div>
              <p className="text-gray-400 text-xs">
                Your NFT rarity is determined by verifiable random function.
                Higher rarity = more rewards from the holder pool!
              </p>
              <RarityProbabilities className="mt-2" />
            </div>
          )}

          {/* Minting Progress */}
          {isProcessing && (
            <div className="bg-gray-800 rounded-lg p-6 text-center">
              <div className="mb-4">
                {mintStep === "determining" ? (
                  // Animated dice/stars for randomness
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
                <div className={`w-2 h-2 rounded-full ${mintStep === "committing" || mintStep === "determining" ? "bg-primary-400" : "bg-gray-600"}`} />
                <div className={`w-2 h-2 rounded-full ${mintStep === "determining" ? "bg-primary-400" : "bg-gray-600"}`} />
                <div className="w-2 h-2 rounded-full bg-gray-600" />
              </div>
            </div>
          )}

          {/* Pending/Fallback State */}
          {mintStep === "revealing" && pendingRequest && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-center">
              <p className="text-yellow-400 font-medium mb-2">Oracle timeout</p>
              <p className="text-sm text-gray-400 mb-4">
                The VRF oracle didn't respond in time. You can claim your NFT with slot hash randomness.
              </p>
              {fallbackCountdown !== null && fallbackCountdown > 0 ? (
                <p className="text-sm text-gray-500 mb-3">
                  Fallback available in {Math.ceil(fallbackCountdown)}s
                </p>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={handleClaimFallback}
                    disabled={isClaimingFallback || isCancelling}
                    className="w-full py-2 rounded-lg font-medium bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50"
                  >
                    {isClaimingFallback ? "Claiming..." : "Claim with Slot Hash Randomness"}
                  </button>
                  <button
                    onClick={handleCancelMint}
                    disabled={isClaimingFallback || isCancelling}
                    className="w-full py-2 rounded-lg font-medium bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-gray-300"
                  >
                    {isCancelling ? "Cancelling..." : "Cancel & Get Refund"}
                  </button>
                </div>
              )}
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
                    Your bundle NFT has been minted with {getRarityName(revealedRarity).toLowerCase()} rarity
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
                    Your bundle NFT has been minted successfully
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
              You already own {ownedCount} NFT{ownedCount > 1 ? "s" : ""} for this bundle
            </div>
          )}

          {/* Price Display */}
          {mintStep === "idle" && (
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
                  <span>{mintedCount.toString()} (unlimited)</span>
                </div>
              )}
            </div>
          )}

          {/* Revenue Split */}
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

          {/* Royalty Info */}
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
              disabled={isSoldOut || !publicKey || isLoadingCollection || isCheckingPending || !bundleCollection || !client}
              className={`w-full py-3 rounded-lg font-medium transition-colors ${
                isSoldOut
                  ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                  : "bg-primary-500 hover:bg-primary-600 disabled:bg-gray-700 disabled:cursor-not-allowed"
              }`}
            >
              {isCheckingPending
                ? "Checking for pending mints..."
                : isLoadingCollection
                ? "Loading..."
                : isSoldOut
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
    </div>
  );
}
