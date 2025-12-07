"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { PublicKey, Transaction, Keypair } from "@solana/web3.js";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useContentRegistry,
  MintConfig,
  Rarity,
  getRarityName,
  PendingMint,
} from "@/hooks/useContentRegistry";
import { useSwitchboardRandomness } from "@/hooks/useSwitchboardRandomness";
import { getTransactionErrorMessage } from "@/utils/wallet-errors";
import { simulatePartiallySignedTransaction } from "@/utils/transaction";
import { RarityBadge, RarityProbabilities, RARITY_STYLES } from "@/components/rarity";

// Default platform wallet - if not set, use ecosystem treasury
// This can be configured per-deployment or made dynamic
const DEFAULT_PLATFORM_WALLET = process.env.NEXT_PUBLIC_PLATFORM_WALLET
  ? new PublicKey(process.env.NEXT_PUBLIC_PLATFORM_WALLET)
  : null;

// Feature flag to enable/disable VRF-based rarity minting
// Set to false to use legacy minting without rarity
const ENABLE_VRF_RARITY = process.env.NEXT_PUBLIC_ENABLE_VRF_RARITY === "true";

interface BuyNftModalProps {
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
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const queryClient = useQueryClient();
  const {
    mintNftSol,
    commitMint,
    revealMint,
    isMintingNft,
    isCommittingMint,
    isRevealingMint,
    ecosystemConfig,
    client,
  } = useContentRegistry();
  const { createRandomnessAccount, getRevealInstructionWithRetry } = useSwitchboardRandomness();

  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [mintingProgress, setMintingProgress] = useState(0);
  const [mintStep, setMintStep] = useState<MintStep>("idle");
  const [revealedRarity, setRevealedRarity] = useState<Rarity | null>(null);
  const [pendingMintOnChain, setPendingMintOnChain] = useState<PendingMint | null>(null);
  const [isCheckingPending, setIsCheckingPending] = useState(false);

  // Check for pending mint on-chain when modal opens (for cross-device recovery)
  const checkPendingMint = useCallback(async () => {
    if (!publicKey || !client || !isOpen) return;

    setIsCheckingPending(true);
    try {
      const pending = await client.fetchPendingMint(publicKey, contentCid);
      setPendingMintOnChain(pending);
      if (pending) {
        console.log("Found pending mint on-chain:", pending);
      }
    } catch (err) {
      console.error("Error checking pending mint:", err);
    } finally {
      setIsCheckingPending(false);
    }
  }, [publicKey, client, contentCid, isOpen]);

  useEffect(() => {
    if (isOpen && ENABLE_VRF_RARITY) {
      checkPendingMint();
    }
  }, [isOpen, checkPendingMint]);

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

  // Legacy mint without VRF rarity
  const handleLegacyMint = async () => {
    if (!publicKey || !ecosystemConfig) return;

    const platformWallet = DEFAULT_PLATFORM_WALLET || ecosystemConfig.treasury;

    for (let i = 0; i < quantity; i++) {
      setMintingProgress(i + 1);
      await mintNftSol({
        contentCid,
        creator,
        treasury: ecosystemConfig.treasury,
        platform: platformWallet,
      });
    }

    onSuccess?.();
    onClose();
  };

  // Complete a pending mint that was started but not finished (cross-device recovery)
  const handleRecoverPendingMint = async () => {
    if (!publicKey || !client || !pendingMintOnChain || !ecosystemConfig) return;

    setError(null);
    setMintStep("revealing");

    // Use platform wallet or fall back to treasury
    const platformWallet = DEFAULT_PLATFORM_WALLET || ecosystemConfig.treasury;

    try {
      // Fetch the content collection
      const contentCollection = await client.fetchContentCollection(contentCid);
      if (!contentCollection) {
        throw new Error("Content collection not found");
      }

      // Wait for randomness with retry logic (oracle may need time)
      console.log("Waiting for oracle to provide randomness...");
      setMintStep("determining");

      // Get reveal instruction from Switchboard with retry logic
      const revealSbIx = await getRevealInstructionWithRetry(pendingMintOnChain.randomnessAccount);

      setMintStep("revealing");

      // Build reveal transaction with Switchboard reveal + our reveal_mint
      const { instruction: revealProgramIx, nftAssetKeypair } = await client.revealMintInstruction(
        publicKey,
        contentCid,
        creator,
        contentCollection.collectionAsset,
        pendingMintOnChain.randomnessAccount,
        ecosystemConfig.treasury,
        platformWallet
      );

      const revealTx = new Transaction()
        .add(revealSbIx)
        .add(revealProgramIx);

      revealTx.feePayer = publicKey;
      revealTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      revealTx.partialSign(nftAssetKeypair);

      await simulatePartiallySignedTransaction(connection, revealTx);

      const revealSig = await sendTransaction(revealTx, connection, {
        signers: [nftAssetKeypair],
      });
      await connection.confirmTransaction(revealSig, "confirmed");
      console.log("Recovery reveal confirmed:", revealSig);

      setMintStep("success");
      setPendingMintOnChain(null);

      await new Promise(resolve => setTimeout(resolve, 1500));

      // Invalidate NFT-related queries to show the new NFT immediately
      queryClient.invalidateQueries({ queryKey: ["walletNfts"] });
      queryClient.invalidateQueries({ queryKey: ["walletNftRarities"] });
      queryClient.invalidateQueries({ queryKey: ["profileNfts"] });
      queryClient.invalidateQueries({ queryKey: ["profileNftRarities"] });
      queryClient.invalidateQueries({ queryKey: ["globalContent"] });

      onSuccess?.(revealedRarity ?? undefined);
      handleClose();
    } catch (err) {
      console.error("Recovery error:", err);
      setError(getTransactionErrorMessage(err));
      setMintStep("idle");
    }
  };

  // VRF-based mint with rarity (two-step flow: commit + reveal)
  const handleVrfMint = async () => {
    if (!publicKey || !ecosystemConfig || !client) return;

    const platformWallet = DEFAULT_PLATFORM_WALLET || ecosystemConfig.treasury;

    for (let i = 0; i < quantity; i++) {
      setMintingProgress(i + 1);
      setRevealedRarity(null);

      try {
        // Step 1: Create randomness + Commit (combined in single transaction)
        setMintStep("committing");

        // Create randomness account and get both create + commit instructions
        const {
          randomnessAccount,
          randomnessKeypair,
          createInstruction,
          commitInstruction,
        } = await createRandomnessAccount();

        // Build our program's commit_mint instruction
        const commitProgramIx = await client.commitMintInstruction(
          publicKey,
          contentCid,
          creator,
          ecosystemConfig.treasury,
          randomnessAccount,
          platformWallet
        );

        // Combine all instructions into ONE transaction:
        // 1. Create randomness account
        // 2. Switchboard commit instruction
        // 3. Our program's commit_mint instruction
        console.log("Sending combined create + commit transaction...");
        const commitTx = new Transaction()
          .add(createInstruction)
          .add(commitInstruction)
          .add(commitProgramIx);

        commitTx.feePayer = publicKey;
        commitTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        commitTx.partialSign(randomnessKeypair);

        await simulatePartiallySignedTransaction(connection, commitTx);

        const commitSig = await sendTransaction(commitTx, connection, {
          signers: [randomnessKeypair],
        });
        await connection.confirmTransaction(commitSig, "confirmed");
        console.log("Commit transaction confirmed:", commitSig);

        // Step 2: Wait for randomness with retry
        setMintStep("determining");

        // Get reveal instruction from Switchboard with retry logic
        const revealSbIx = await getRevealInstructionWithRetry(randomnessAccount);

        // Step 3: Reveal and create NFT with rarity
        setMintStep("revealing");

        // Fetch the content collection
        const contentCollection = await client.fetchContentCollection(contentCid);
        if (!contentCollection) {
          throw new Error("Content collection not found");
        }

        // Build reveal transaction with Switchboard reveal + our reveal_mint
        if (!ecosystemConfig) {
          throw new Error("Ecosystem config not loaded");
        }
        const { instruction: revealProgramIx, nftAssetKeypair } = await client.revealMintInstruction(
          publicKey,
          contentCid,
          creator,
          contentCollection.collectionAsset,
          randomnessAccount,
          ecosystemConfig.treasury,
          platformWallet
        );

        const revealTx = new Transaction()
          .add(revealSbIx)
          .add(revealProgramIx);

        // Set up transaction for simulation
        revealTx.feePayer = publicKey;
        revealTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

        // Sign with NFT asset keypair
        revealTx.partialSign(nftAssetKeypair);

        // Simulate before sending
        await simulatePartiallySignedTransaction(connection, revealTx);

        // Send reveal transaction (requires wallet signature)
        const revealSig = await sendTransaction(revealTx, connection, {
          signers: [nftAssetKeypair],
        });
        await connection.confirmTransaction(revealSig, "confirmed");
        console.log("Reveal transaction confirmed:", revealSig);

        // Fetch the revealed rarity from the NftRarity account
        try {
          const nftRarity = await client.fetchNftRarity(nftAssetKeypair.publicKey);
          if (nftRarity) {
            setRevealedRarity(nftRarity.rarity);
            console.log("Revealed rarity:", getRarityName(nftRarity.rarity));
          }
        } catch (rarityErr) {
          console.error("Could not fetch rarity:", rarityErr);
        }

        setMintStep("success");

      } catch (err) {
        console.error("VRF mint error:", err);
        throw err;
      }
    }

    // Longer pause to show success state with rarity
    await new Promise(resolve => setTimeout(resolve, 2500));

    // Invalidate NFT-related queries to show the new NFT immediately
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
      if (ENABLE_VRF_RARITY) {
        await handleVrfMint();
      } else {
        await handleLegacyMint();
      }
    } catch (err) {
      console.error("Failed to mint NFT:", err);
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
        return "Revealing your NFT...";
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
          <h2 className="text-xl font-bold">
            {ENABLE_VRF_RARITY ? "Mint NFT with Rarity" : "Buy NFT"}
          </h2>
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
          {/* Pending Mint Recovery Banner */}
          {ENABLE_VRF_RARITY && pendingMintOnChain && mintStep === "idle" && (
            <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="font-medium text-amber-300">Incomplete Mint Found</span>
              </div>
              <p className="text-gray-300 text-sm mb-3">
                You have a pending mint that was started but not completed.
                Your payment of <span className="font-medium text-white">{Number(pendingMintOnChain.amountPaid) / LAMPORTS_PER_SOL} SOL</span> is waiting.
              </p>
              <button
                onClick={handleRecoverPendingMint}
                className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors"
              >
                Complete Mint Now
              </button>
            </div>
          )}

          {/* Loading state for checking pending mints */}
          {isCheckingPending && (
            <div className="text-center py-2">
              <div className="w-5 h-5 border-2 border-gray-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-gray-500 mt-1">Checking for pending mints...</p>
            </div>
          )}

          {/* Rarity Info Banner (VRF mode only) */}
          {ENABLE_VRF_RARITY && mintStep === "idle" && !pendingMintOnChain && (
            <div className="bg-gradient-to-r from-purple-500/10 to-yellow-500/10 border border-purple-500/30 rounded-lg p-3 text-sm">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                <span className="font-medium text-white">Random Rarity</span>
              </div>
              <p className="text-gray-400 text-xs">
                Your NFT will be assigned a random rarity using verifiable randomness.
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
                    Your NFT has been minted with {getRarityName(revealedRarity).toLowerCase()} rarity
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
                    Your NFT has been minted successfully
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
              You already own {ownedCount} NFT{ownedCount > 1 ? "s" : ""} for this content
            </div>
          )}

          {/* Price Display (hidden during processing) */}
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
