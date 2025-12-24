"use client";

console.log("[Module Load] hooks/useMembership.ts");

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  createCloseAccountInstruction,
  NATIVE_MINT,
} from "@solana/spl-token";
import { sendTransactionWithSimulation, sendTransactionWithSigners } from "@/lib/transaction";
import { useState, useEffect } from "react";

// SDK imports are done dynamically inside functions to avoid module-level PublicKey creation
// which causes _bn errors during SSR

const SOLANA_NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet") as "mainnet" | "devnet" | "testnet";

// Pre-flight validation error messages
const PREFLIGHT_ERRORS = {
  ALREADY_SUBSCRIBED: "You're already a member",
  CONFIG_NOT_FOUND: "Creator hasn't set up memberships",
  CONFIG_INACTIVE: "Creator's memberships are not active",
  ECOSYSTEM_NOT_FOUND: "Platform membership is not available",
  ECOSYSTEM_INACTIVE: "Platform membership is not active",
} as const;
const LAMPORTS_PER_SOL = 1_000_000_000;

// Billing periods for membership
export type BillingPeriod = "monthly" | "yearly";

export interface MembershipConfig {
  creator: PublicKey;
  monthlyPrice: bigint;
  isActive: boolean;
}

export interface CreatorMembership {
  subscriber: PublicKey;
  creator: PublicKey;
  billingPeriod: BillingPeriod;
  streamId: PublicKey;
  startedAt: bigint;
  isActive: boolean;
  isValid: boolean;
}

export interface EcosystemMembershipConfig {
  price: bigint;
  isActive: boolean;
  authority: PublicKey; // Treasury wallet that receives payments
}

export interface EcosystemMembership {
  subscriber: PublicKey;
  streamId: PublicKey;
  startedAt: bigint;
  isActive: boolean;
  isValid: boolean;
}

// Helper to safely reconstruct PublicKey (fixes _bn property loss during SSR/bundling)
function safePublicKey(pk: PublicKey | null | undefined): PublicKey | null {
  if (!pk) return null;
  try {
    // Reconstruct to ensure _bn property exists
    return new PublicKey(pk.toBase58());
  } catch {
    return null;
  }
}

// Helper to get SDK client dynamically
async function getSDKClient(connection: any) {
  const { createContentRegistryClient } = await import("@handcraft/sdk");
  return createContentRegistryClient(connection);
}

// Helper to get Streamflow client dynamically (only on client side)
async function getStreamflowClient(rpcUrl: string) {
  // Ensure we're on client side before loading Streamflow SDK
  if (typeof window === "undefined") {
    throw new Error("StreamflowClient can only be used on client side");
  }
  const { StreamflowClient } = await import("@handcraft/sdk");
  return new StreamflowClient({
    cluster: SOLANA_NETWORK as "mainnet" | "devnet" | "testnet",
    rpcUrl,
  });
}

export function useMembership() {
  const { connection } = useConnection();
  const { publicKey, signTransaction, wallet } = useWallet();
  const queryClient = useQueryClient();

  // Track client-side mount to prevent SSR from triggering Streamflow SDK
  // Streamflow SDK creates PublicKey instances internally which causes _bn errors during SSR
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // =========================================================================
  // FETCH QUERIES
  // =========================================================================

  // Fetch membership config for a creator (pass null to use current user)
  const useMembershipConfig = (creator: PublicKey | null | undefined) => {
    // If creator is null, use the current user's publicKey
    const targetCreator = creator === null ? publicKey : creator;

    return useQuery({
      queryKey: ["membershipConfig", targetCreator?.toBase58()],
      queryFn: async (): Promise<MembershipConfig | null> => {
        if (!targetCreator) return null;

        const { getCreatorPatronConfigPda } = await import("@handcraft/sdk");
        const [configPda] = getCreatorPatronConfigPda(targetCreator);
        const accountInfo = await connection.getAccountInfo(configPda);

        if (!accountInfo || !accountInfo.data) return null;

        const data = accountInfo.data;
        // CreatorPatronConfig layout (73 bytes total):
        // discriminator: 8, creator: 32, membershipPrice: 8, subscriptionPrice: 8,
        // isActive: 1, createdAt: 8, updatedAt: 8
        if (data.length < 57) return null;

        // We use subscriptionPrice as the monthly price (membershipPrice is deprecated)
        const subscriptionPrice = data.readBigUInt64LE(48);
        const isActive = data[56] === 1;

        return {
          creator: targetCreator,
          monthlyPrice: subscriptionPrice,
          isActive,
        };
      },
      enabled: !!targetCreator,
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
    });
  };

  // Fetch membership status for a creator (from Streamflow streams)
  const useCreatorMembership = (creator: PublicKey | null) => {
    return useQuery({
      queryKey: ["creatorMembership", publicKey?.toBase58(), creator?.toBase58()],
      queryFn: async (): Promise<CreatorMembership | null> => {
        if (!publicKey || !creator) return null;

        try {
          const { getCreatorPatronTreasuryPda } = await import("@handcraft/sdk");
          const streamflowClient = await getStreamflowClient(connection.rpcEndpoint);

          // Get creator's patron treasury PDA (where streams should go)
          const [treasuryPda] = getCreatorPatronTreasuryPda(creator);

          // Get all streams from this user
          const streams = await streamflowClient.getStreamsForWallet(publicKey);

          console.log("=== CREATOR MEMBERSHIP CHECK ===");
          console.log("Creator:", creator.toBase58());
          console.log("Treasury PDA:", treasuryPda.toBase58());
          console.log("Total streams:", streams.length);

          // Find active stream to creator's treasury PDA
          const now = Math.floor(Date.now() / 1000);
          const activeStream = streams.find(stream => {
            const isToTreasury = stream.recipient === treasuryPda.toBase58();
            const hasTimeRemaining = stream.endTime > now;
            const wasFunded = stream.depositedAmount.toNumber() > 0;
            // Stream is active if canceledAt is 0 (not cancelled)
            const isNotCancelled = stream.canceledAt === 0;

            return isToTreasury && hasTimeRemaining && wasFunded && isNotCancelled;
          });

          if (!activeStream) {
            console.log("No active stream to treasury found");
            return null;
          }

          console.log("Active stream:", activeStream.id);

          // Determine billing period from duration
          const duration = activeStream.endTime - activeStream.startTime;
          const billingPeriod: BillingPeriod = duration > 60 * 24 * 60 * 60 ? "yearly" : "monthly";

          return {
            subscriber: publicKey,
            creator,
            billingPeriod,
            streamId: new PublicKey(activeStream.id),
            startedAt: BigInt(activeStream.startTime),
            isActive: true,
            isValid: true,
          };
        } catch (err) {
          console.error("Error fetching membership:", err);
          return null;
        }
      },
      enabled: !!publicKey && !!creator && isMounted,
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    });
  };

  // Fetch ecosystem membership config
  const ecosystemConfigQuery = useQuery({
    queryKey: ["ecosystemMembershipConfig"],
    queryFn: async (): Promise<EcosystemMembershipConfig | null> => {
      const { getEcosystemSubConfigPda } = await import("@handcraft/sdk");
      const [configPda] = getEcosystemSubConfigPda();
      const accountInfo = await connection.getAccountInfo(configPda);

      if (!accountInfo || !accountInfo.data) return null;

      const data = accountInfo.data;
      if (data.length < 49) return null; // 8 + 8 + 1 + 32 = 49

      // EcosystemSubConfig layout:
      // discriminator: 8, price: 8, isActive: 1, authority: 32
      const price = data.readBigUInt64LE(8);
      const isActive = data[16] === 1;
      const authorityBytes = data.slice(17, 49);
      const authority = new PublicKey(authorityBytes);

      return { price, isActive, authority };
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Fetch ecosystem membership status
  // Primary: Check on-chain EcosystemSubscription account (stores stream_id from CPI)
  // Fallback: Query Streamflow for streams to treasury (for non-CPI created streams)
  const ecosystemMembershipQuery = useQuery({
    queryKey: ["ecosystemMembership", publicKey?.toBase58()],
    queryFn: async (): Promise<EcosystemMembership | null> => {
      const safePk = safePublicKey(publicKey);
      if (!safePk) return null;

      try {
        const { getEcosystemStreamingTreasuryPda, getEcosystemSubscriptionPda } = await import("@handcraft/sdk");
        const streamflowClient = await getStreamflowClient(connection.rpcEndpoint);

        const [treasuryPda] = getEcosystemStreamingTreasuryPda();
        const [subscriptionPda] = getEcosystemSubscriptionPda(safePk);

        console.log("=== ECOSYSTEM MEMBERSHIP CHECK ===");
        console.log("Treasury PDA:", treasuryPda.toBase58());
        console.log("Subscription PDA:", subscriptionPda.toBase58());

        // PRIMARY: Check on-chain subscription account (created by CPI)
        const subscriptionAccount = await connection.getAccountInfo(subscriptionPda);

        if (subscriptionAccount && subscriptionAccount.data.length >= 8 + 32 + 32 + 8 + 1) {
          // EcosystemSubscription layout:
          // discriminator: 8, subscriber: 32, stream_id: 32, started_at: 8, is_active: 1
          const data = subscriptionAccount.data;
          const streamIdBytes = data.slice(40, 72); // After discriminator(8) + subscriber(32)
          const streamId = new PublicKey(streamIdBytes);
          const startedAt = data.readBigInt64LE(72);
          const isActive = data[80] === 1;

          console.log("On-chain subscription found:", {
            streamId: streamId.toBase58(),
            startedAt: startedAt.toString(),
            isActive,
          });

          if (isActive) {
            // Verify stream is still valid via Streamflow
            try {
              const stream = await streamflowClient.getStream(streamId.toBase58());
              if (stream) {
                const now = Math.floor(Date.now() / 1000);
                const hasTimeRemaining = stream.endTime > now;
                const wasFunded = stream.depositedAmount.toNumber() > 0;
                const isNotCancelled = stream.canceledAt === 0;
                const recipientMatches = stream.recipient === treasuryPda.toBase58();

                console.log("Stream verification:", {
                  id: stream.id,
                  recipient: stream.recipient,
                  hasTimeRemaining,
                  wasFunded,
                  isNotCancelled,
                  recipientMatches,
                });

                if (hasTimeRemaining && wasFunded && isNotCancelled && recipientMatches) {
                  return {
                    subscriber: safePk,
                    streamId,
                    startedAt: BigInt(stream.startTime),
                    isActive: true,
                    isValid: true,
                  };
                }
              }
            } catch (err) {
              console.log("Stream fetch error (may be indexer delay):", err);
              // If we can't fetch but account exists, still show as member
              return {
                subscriber: safePk,
                streamId,
                startedAt: BigInt(Number(startedAt)),
                isActive: true,
                isValid: true,
              };
            }
          }
        } else {
          console.log("No on-chain subscription account found");
        }

        // FALLBACK: Check Streamflow directly (for legacy/non-CPI streams)
        const streams = await streamflowClient.getStreamsForWallet(safePk);
        console.log("Fallback: checking", streams.length, "streams from Streamflow");

        const now = Math.floor(Date.now() / 1000);
        const activeStream = streams.find(stream => {
          const isToTreasury = stream.recipient === treasuryPda.toBase58();
          const hasTimeRemaining = stream.endTime > now;
          const wasFunded = stream.depositedAmount.toNumber() > 0;
          const isNotCancelled = stream.canceledAt === 0;
          return isToTreasury && hasTimeRemaining && wasFunded && isNotCancelled;
        });

        if (activeStream) {
          console.log("Found active stream via fallback:", activeStream.id);
          return {
            subscriber: safePk,
            streamId: new PublicKey(activeStream.id),
            startedAt: BigInt(activeStream.startTime),
            isActive: true,
            isValid: true,
          };
        }

        console.log("No active ecosystem membership found");
        return null;
      } catch (err) {
        console.error("Error fetching ecosystem membership:", err);
        return null;
      }
    },
    enabled: !!publicKey && isMounted,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // =========================================================================
  // MUTATIONS
  // =========================================================================

  // Initialize membership config (creator only)
  // Only takes monthly price - yearly is auto-calculated (10 months for 12 months access)
  // Also creates creator's WSOL ATA so subscribers can pay in 1 transaction
  const initMembershipConfig = useMutation({
    mutationFn: async ({
      monthlyPrice,
    }: {
      monthlyPrice: number;
    }) => {
      const safePk = safePublicKey(publicKey);
      if (!safePk || !signTransaction) {
        throw new Error("Wallet not connected");
      }

      const client = await getSDKClient(connection);

      const monthlyLamports = BigInt(Math.floor(monthlyPrice * LAMPORTS_PER_SOL));
      // Set membershipPrice to 0 (deprecated) and subscriptionPrice to monthly rate
      const membershipLamports = BigInt(0);

      const tx = new Transaction();

      // Create creator's WSOL ATA if it doesn't exist (for receiving Streamflow payments)
      const creatorWsolAta = await getAssociatedTokenAddress(NATIVE_MINT, safePk);
      const ataInfo = await connection.getAccountInfo(creatorWsolAta);
      if (!ataInfo) {
        tx.add(
          createAssociatedTokenAccountInstruction(
            safePk,
            creatorWsolAta,
            safePk,
            NATIVE_MINT
          )
        );
      }

      // Add patron config initialization
      const ix = await client.initPatronConfigInstruction(
        safePk,
        membershipLamports,
        monthlyLamports
      );
      tx.add(ix);

      tx.feePayer = safePk;

      const sig = await sendTransactionWithSimulation(connection, tx, signTransaction);
      return sig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["membershipConfig"] });
    },
  });

  // Update membership config (creator only)
  // Also creates WSOL ATA if it doesn't exist (for creators who set up before this fix)
  const updateMembershipConfig = useMutation({
    mutationFn: async ({
      monthlyPrice,
    }: {
      monthlyPrice: number;
    }) => {
      const safePk = safePublicKey(publicKey);
      if (!safePk || !signTransaction) {
        throw new Error("Wallet not connected");
      }

      const client = await getSDKClient(connection);

      const monthlyLamports = BigInt(Math.floor(monthlyPrice * LAMPORTS_PER_SOL));

      const tx = new Transaction();

      // Create creator's WSOL ATA if it doesn't exist (for receiving Streamflow payments)
      const creatorWsolAta = await getAssociatedTokenAddress(NATIVE_MINT, safePk);
      console.log("Creator WSOL ATA address:", creatorWsolAta.toBase58());
      const ataInfo = await connection.getAccountInfo(creatorWsolAta);
      console.log("ATA exists?", !!ataInfo);

      if (!ataInfo) {
        console.log("Creating WSOL ATA...");
        tx.add(
          createAssociatedTokenAccountInstruction(
            safePk,
            creatorWsolAta,
            safePk,
            NATIVE_MINT
          )
        );
      } else {
        console.log("WSOL ATA already exists");
      }

      const ix = await client.updatePatronConfigInstruction(
        safePk,
        null, // membershipPrice (deprecated)
        monthlyLamports,
        null // isActive unchanged
      );
      tx.add(ix);

      tx.feePayer = safePk;

      const sig = await sendTransactionWithSimulation(connection, tx, signTransaction);
      return sig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["membershipConfig"] });
    },
  });

  // Join a creator's membership via CPI (secure on-chain stream creation)
  // Program enforces creator's treasury PDA as recipient - prevents fund redirection attacks
  const joinMembership = useMutation({
    mutationFn: async ({
      creator,
      period,
      monthlyPrice,
    }: {
      creator: PublicKey;
      period: BillingPeriod;
      monthlyPrice: bigint;
    }) => {
      const safePk = safePublicKey(publicKey);
      if (!safePk || !signTransaction) {
        throw new Error("Wallet not connected");
      }

      const client = await getSDKClient(connection);
      const {
        getCreatorPatronConfigPda,
        getCreatorPatronSubscriptionPda,
        getEcosystemConfigPda,
        MembershipDurationType,
        MembershipTier,
      } = await import("@handcraft/sdk");

      // PRE-FLIGHT CHECK: Validate before building transaction
      const safeCreator = safePublicKey(creator)!;
      const [configPda] = getCreatorPatronConfigPda(safeCreator);
      const [subscriptionPda] = getCreatorPatronSubscriptionPda(safePk, safeCreator);

      const [configAccount, subscriptionAccount] = await Promise.all([
        connection.getAccountInfo(configPda),
        connection.getAccountInfo(subscriptionPda),
      ]);

      if (!configAccount) {
        throw new Error(PREFLIGHT_ERRORS.CONFIG_NOT_FOUND);
      }
      const isConfigActive = configAccount.data[56] === 1;
      if (!isConfigActive) {
        throw new Error(PREFLIGHT_ERRORS.CONFIG_INACTIVE);
      }
      if (subscriptionAccount) {
        throw new Error(PREFLIGHT_ERRORS.ALREADY_SUBSCRIBED);
      }

      // Calculate amount based on billing period
      // Yearly: pay 10 months, get 12 months access (2 months free)
      const amount = period === "yearly" ? calculateYearlyPrice(monthlyPrice) : monthlyPrice;
      const durationType = period === "yearly"
        ? MembershipDurationType.Yearly
        : MembershipDurationType.Monthly;

      // Use Subscription tier (support + content access)
      const tier = MembershipTier.Subscription;

      console.log("=== JOIN CREATOR MEMBERSHIP (CPI) ===");
      console.log("Period:", period);
      console.log("Duration type:", durationType);
      console.log("Tier:", tier);
      console.log("Amount (lamports):", amount.toString());
      console.log("Amount (SOL):", Number(amount) / 1e9);
      console.log("Creator:", creator.toBase58());

      // Generate a new keypair for the stream metadata (becomes the stream ID)
      const streamMetadata = Keypair.generate();
      console.log("Stream ID:", streamMetadata.publicKey.toBase58());

      // Get ecosystem treasury from config (partner fees go to ecosystem treasury)
      const [ecosystemConfigPda] = getEcosystemConfigPda();
      const ecosystemConfigAccount = await connection.getAccountInfo(ecosystemConfigPda);
      if (!ecosystemConfigAccount) {
        throw new Error("Ecosystem config not found");
      }
      // EcosystemConfig layout: discriminator(8) + admin(32) + treasury(32) + ...
      const treasury = new PublicKey(ecosystemConfigAccount.data.slice(40, 72));
      const partner = treasury;

      // Build the transaction
      const tx = new Transaction();

      // Ensure subscriber has WSOL ATA with funds
      const subscriberWsolAta = await getAssociatedTokenAddress(NATIVE_MINT, safePk);
      const subscriberAtaInfo = await connection.getAccountInfo(subscriberWsolAta);

      if (!subscriberAtaInfo) {
        // Create WSOL ATA
        tx.add(
          createAssociatedTokenAccountInstruction(
            safePk,
            subscriberWsolAta,
            safePk,
            NATIVE_MINT
          )
        );
      }

      // Transfer SOL to WSOL ATA and sync (wrap SOL)
      // Add a bit extra for Streamflow fees (0.25%)
      const amountWithFee = amount + (amount * BigInt(3)) / BigInt(1000); // 0.3% buffer
      const { SystemProgram } = await import("@solana/web3.js");
      tx.add(
        SystemProgram.transfer({
          fromPubkey: safePk,
          toPubkey: subscriberWsolAta,
          lamports: amountWithFee,
        }),
        createSyncNativeInstruction(subscriberWsolAta)
      );

      // Add the CPI instruction (program creates stream with enforced recipient)
      const ix = await client.joinCreatorMembershipInstruction(
        safePk,
        safeCreator,
        streamMetadata,
        partner,
        tier,
        durationType
      );
      tx.add(ix);

      tx.feePayer = safePk;

      // Send with additional signer (stream metadata keypair)
      const signature = await sendTransactionWithSigners(
        connection,
        tx,
        signTransaction,
        [streamMetadata]
      );

      console.log("Transaction signature:", signature);

      return {
        streamId: streamMetadata.publicKey.toBase58(),
        txSignature: signature,
      };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["creatorMembership", publicKey?.toBase58(), variables.creator.toBase58()],
      });
      queryClient.invalidateQueries({
        queryKey: ["membershipStreams", publicKey?.toBase58()],
      });
    },
  });

  // Cancel creator membership (cancels Streamflow stream, returns remaining funds)
  // After cancel, unwraps WSOL back to native SOL
  const cancelMembership = useMutation({
    mutationFn: async ({ creator, streamId }: { creator: PublicKey; streamId: string }) => {
      const safePk = safePublicKey(publicKey);
      if (!safePk || !signTransaction || !wallet?.adapter) {
        throw new Error("Wallet not connected");
      }

      const streamflowClient = await getStreamflowClient(connection.rpcEndpoint);

      console.log("=== CANCEL MEMBERSHIP ===");
      console.log("Stream ID:", streamId);
      console.log("Creator:", creator.toBase58());

      // Check if stream exists
      const stream = await streamflowClient.getStream(streamId);
      console.log("Stream found:", !!stream);

      if (!stream) {
        console.log("Stream not found, nothing to cancel");
        return "not-found";
      }

      console.log("Stream details:", {
        sender: stream.sender,
        recipient: stream.recipient,
        deposited: stream.depositedAmount.toString(),
        withdrawn: stream.withdrawnAmount.toString(),
        cancelableBySender: stream.cancelableBySender,
      });

      // Cancel Streamflow stream - remaining WSOL returned to sender's WSOL ATA
      console.log("Calling Streamflow cancel...");
      const result = await streamflowClient.cancelStream(streamId, wallet.adapter as any);
      console.log("Cancel result:", result);

      // Wait for cancel to confirm
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Unwrap WSOL back to native SOL by closing the WSOL ATA
      const wsolAta = await getAssociatedTokenAddress(NATIVE_MINT, safePk);
      const ataInfo = await connection.getAccountInfo(wsolAta);

      if (ataInfo) {
        console.log("Unwrapping WSOL to native SOL...");
        const unwrapTx = new Transaction();
        // Close WSOL ATA - this returns all WSOL as native SOL to the owner
        unwrapTx.add(
          createCloseAccountInstruction(
            wsolAta,      // WSOL ATA to close
            safePk,    // Destination for SOL (owner)
            safePk     // Authority (owner)
          )
        );
        unwrapTx.feePayer = safePk;

        try {
          const unwrapSig = await sendTransactionWithSimulation(connection, unwrapTx, signTransaction);
          console.log("WSOL unwrapped, signature:", unwrapSig);
        } catch (err) {
          // Don't fail the whole operation if unwrap fails
          // User can manually unwrap later
          console.warn("Failed to unwrap WSOL (user can do this manually):", err);
        }
      }

      return result.txSignature;
    },
    onSuccess: (_, variables) => {
      console.log("Cancel succeeded, invalidating queries...");
      // Force refetch all relevant queries
      queryClient.invalidateQueries({
        queryKey: ["creatorMembership", publicKey?.toBase58(), variables.creator.toBase58()],
        refetchType: "all",
      });
      queryClient.invalidateQueries({
        queryKey: ["membershipStreams", publicKey?.toBase58()],
        refetchType: "all",
      });
      queryClient.invalidateQueries({
        queryKey: ["streamInfo"],
        refetchType: "all",
      });
      queryClient.invalidateQueries({
        queryKey: ["creatorMembership"],
        refetchType: "all",
      });
    },
  });

  // Join ecosystem membership via CPI (secure on-chain stream creation)
  // Program enforces treasury PDA as recipient - prevents fund redirection attacks
  const joinEcosystemMembership = useMutation({
    mutationFn: async ({ price, period = "monthly" }: { price: bigint; period?: BillingPeriod }) => {
      const safePk = safePublicKey(publicKey);
      if (!safePk || !signTransaction) {
        throw new Error("Wallet not connected");
      }

      const client = await getSDKClient(connection);
      const streamflowClient = await getStreamflowClient(connection.rpcEndpoint);
      const {
        getEcosystemSubConfigPda,
        getEcosystemSubscriptionPda,
        getEcosystemConfigPda,
        getEcosystemStreamingTreasuryPda,
        MembershipDurationType,
      } = await import("@handcraft/sdk");

      // PRE-FLIGHT CHECK: Validate before building transaction
      const [configPda] = getEcosystemSubConfigPda();
      const [subscriptionPda] = getEcosystemSubscriptionPda(safePk);

      const [configAccount, subscriptionAccount] = await Promise.all([
        connection.getAccountInfo(configPda),
        connection.getAccountInfo(subscriptionPda),
      ]);

      // Check if ecosystem config exists and is active
      if (!configAccount) {
        throw new Error(PREFLIGHT_ERRORS.ECOSYSTEM_NOT_FOUND);
      }
      const isConfigActive = configAccount.data[16] === 1;
      if (!isConfigActive) {
        throw new Error(PREFLIGHT_ERRORS.ECOSYSTEM_INACTIVE);
      }

      // Check if already subscribed (but allow re-subscribe if stream was cancelled)
      if (subscriptionAccount) {
        // Read the stream_id from the subscription account
        // EcosystemSubscription layout: discriminator(8) + subscriber(32) + stream_id(32) + started_at(8) + is_active(1)
        const streamIdBytes = subscriptionAccount.data.slice(40, 72);
        const existingStreamId = new PublicKey(streamIdBytes);

        // Check if the existing stream is still active
        try {
          const existingStream = await streamflowClient.getStream(existingStreamId.toBase58());
          if (existingStream && existingStream.canceledAt === 0) {
            // Stream is still active - user is already subscribed
            throw new Error(PREFLIGHT_ERRORS.ALREADY_SUBSCRIBED);
          }
          // Stream was cancelled - allow re-subscribe
          console.log("Previous subscription was cancelled, allowing re-subscribe");
        } catch (err) {
          // Stream doesn't exist or error fetching - allow re-subscribe
          console.log("Could not verify existing stream, allowing re-subscribe");
        }
      }

      // Calculate amount based on billing period
      // Yearly: pay 10 months, get 12 months access (2 months free)
      const amount = period === "yearly" ? calculateYearlyPrice(price) : price;
      const durationType = period === "yearly"
        ? MembershipDurationType.Yearly
        : MembershipDurationType.Monthly;

      console.log("=== JOIN ECOSYSTEM MEMBERSHIP (CPI) ===");
      console.log("Period:", period);
      console.log("Duration type:", durationType);
      console.log("Amount (lamports):", amount.toString());
      console.log("Amount (SOL):", Number(amount) / 1e9);

      // Generate a new keypair for the stream metadata (becomes the stream ID)
      const streamMetadata = Keypair.generate();
      console.log("Stream ID:", streamMetadata.publicKey.toBase58());

      // Get ecosystem treasury from config (partner fees go to ecosystem treasury)
      const [ecosystemConfigPda] = getEcosystemConfigPda();
      const ecosystemConfigAccount = await connection.getAccountInfo(ecosystemConfigPda);
      if (!ecosystemConfigAccount) {
        throw new Error("Ecosystem config not found");
      }
      // EcosystemConfig layout: discriminator(8) + admin(32) + treasury(32) + ...
      const treasury = new PublicKey(ecosystemConfigAccount.data.slice(40, 72));
      const partner = treasury;

      // Build the transaction
      const tx = new Transaction();

      // Ensure subscriber has WSOL ATA with funds
      const subscriberWsolAta = await getAssociatedTokenAddress(NATIVE_MINT, safePk);
      const subscriberAtaInfo = await connection.getAccountInfo(subscriberWsolAta);

      if (!subscriberAtaInfo) {
        // Create WSOL ATA
        tx.add(
          createAssociatedTokenAccountInstruction(
            safePk,
            subscriberWsolAta,
            safePk,
            NATIVE_MINT
          )
        );
      }

      // Transfer SOL to WSOL ATA and sync (wrap SOL)
      // Add a bit extra for Streamflow fees (0.25%)
      const amountWithFee = amount + (amount * BigInt(3)) / BigInt(1000); // 0.3% buffer
      const { SystemProgram } = await import("@solana/web3.js");
      tx.add(
        SystemProgram.transfer({
          fromPubkey: safePk,
          toPubkey: subscriberWsolAta,
          lamports: amountWithFee,
        }),
        createSyncNativeInstruction(subscriberWsolAta)
      );

      // Add the CPI instruction (program creates stream with enforced recipient)
      const ix = await client.joinEcosystemMembershipInstruction(
        safePk,
        streamMetadata,
        partner,
        durationType
      );
      tx.add(ix);

      tx.feePayer = safePk;

      // Send with additional signer (stream metadata keypair)
      const signature = await sendTransactionWithSigners(
        connection,
        tx,
        signTransaction,
        [streamMetadata]
      );

      console.log("Transaction signature:", signature);

      // Debug: fetch the created stream to verify recipient
      const [expectedTreasuryPda] = getEcosystemStreamingTreasuryPda();
      console.log("Expected treasury recipient:", expectedTreasuryPda.toBase58());

      // Wait a moment for Streamflow indexer
      await new Promise(resolve => setTimeout(resolve, 2000));

      try {
        const createdStream = await streamflowClient.getStream(streamMetadata.publicKey.toBase58());
        console.log("Created stream details:", {
          id: createdStream?.id,
          recipient: createdStream?.recipient,
          sender: createdStream?.sender,
          depositedAmount: createdStream?.depositedAmount.toString(),
          recipientMatches: createdStream?.recipient === expectedTreasuryPda.toBase58(),
        });
      } catch (err) {
        console.log("Could not fetch created stream (may need indexer delay):", err);
      }

      return {
        streamId: streamMetadata.publicKey.toBase58(),
        txSignature: signature,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["ecosystemMembership", publicKey?.toBase58()],
      });
      queryClient.invalidateQueries({
        queryKey: ["ecosystemStreams", publicKey?.toBase58()],
      });
    },
  });

  // Cancel ecosystem membership (cancels Streamflow stream directly, returns remaining funds)
  // Uses Streamflow SDK directly instead of CPI to avoid privilege escalation issues
  // After cancel, unwraps WSOL back to native SOL
  const cancelEcosystemMembership = useMutation({
    mutationFn: async ({ streamId }: { streamId: string }) => {
      const safePk = safePublicKey(publicKey);
      if (!safePk || !signTransaction || !wallet?.adapter) {
        throw new Error("Wallet not connected");
      }

      const streamflowClient = await getStreamflowClient(connection.rpcEndpoint);

      console.log("=== CANCEL ECOSYSTEM MEMBERSHIP ===");
      console.log("Stream ID:", streamId);

      // Check if stream exists via Streamflow
      const stream = await streamflowClient.getStream(streamId);
      console.log("Stream found:", !!stream);

      if (!stream) {
        console.log("Stream not found, nothing to cancel");
        return "not-found";
      }

      console.log("Stream details:", {
        sender: stream.sender,
        recipient: stream.recipient,
        deposited: stream.depositedAmount.toString(),
        withdrawn: stream.withdrawnAmount.toString(),
        cancelableBySender: stream.cancelableBySender,
      });

      // Cancel Streamflow stream directly - remaining WSOL returned to sender's WSOL ATA
      console.log("Calling Streamflow cancel...");
      const result = await streamflowClient.cancelStream(streamId, wallet.adapter as any);
      console.log("Cancel result:", result);

      // Wait for cancel to confirm
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Unwrap WSOL back to native SOL by closing the WSOL ATA
      const wsolAta = await getAssociatedTokenAddress(NATIVE_MINT, safePk);
      const ataInfo = await connection.getAccountInfo(wsolAta);

      if (ataInfo) {
        console.log("Unwrapping WSOL to native SOL...");
        const unwrapTx = new Transaction();
        // Close WSOL ATA - this returns all WSOL as native SOL to the owner
        unwrapTx.add(
          createCloseAccountInstruction(
            wsolAta,      // WSOL ATA to close
            safePk,    // Destination for SOL (owner)
            safePk     // Authority (owner)
          )
        );
        unwrapTx.feePayer = safePk;

        try {
          const unwrapSig = await sendTransactionWithSimulation(connection, unwrapTx, signTransaction);
          console.log("WSOL unwrapped, signature:", unwrapSig);
        } catch (err) {
          // Don't fail the whole operation if unwrap fails
          // User can manually unwrap later
          console.warn("Failed to unwrap WSOL (user can do this manually):", err);
        }
      }

      return result.txSignature;
    },
    onSuccess: () => {
      console.log("Ecosystem cancel succeeded, invalidating queries...");
      queryClient.invalidateQueries({
        queryKey: ["ecosystemMembership", publicKey?.toBase58()],
        refetchType: "all",
      });
      queryClient.invalidateQueries({
        queryKey: ["ecosystemStreams", publicKey?.toBase58()],
        refetchType: "all",
      });
      queryClient.invalidateQueries({
        queryKey: ["streamInfo"],
        refetchType: "all",
      });
      queryClient.invalidateQueries({
        queryKey: ["ecosystemMembership"],
        refetchType: "all",
      });
    },
  });

  // Renew creator membership (topup existing stream)
  // IMPORTANT: Must match original billing period - no cross-period topups
  const renewMembership = useMutation({
    mutationFn: async ({
      creator,
      period,
      monthlyPrice,
      streamId,
    }: {
      creator: PublicKey;
      period: BillingPeriod;
      monthlyPrice: bigint;
      streamId: string; // Existing stream ID to topup
    }) => {
      if (!publicKey || !wallet?.adapter) {
        throw new Error("Wallet not connected");
      }

      const streamflowClient = await getStreamflowClient(connection.rpcEndpoint);

      // Fetch existing stream to check original period
      const stream = await streamflowClient.getStream(streamId);
      if (!stream) {
        throw new Error("Stream not found");
      }

      // Determine original period from stream name (reliable even after topups)
      // Yearly streams have "Yr" or "Year" in name, monthly don't
      const originalPeriod: BillingPeriod = detectBillingPeriodFromName(stream.name);

      console.log("Stream period check:", {
        streamName: stream.name,
        originalPeriod,
        requestedPeriod: period,
      });

      // Block cross-period topups
      if (originalPeriod !== period) {
        throw new Error(
          `Cannot add ${period} to a ${originalPeriod} membership. ` +
          `To switch periods, cancel and create a new ${period} membership.`
        );
      }

      // Calculate topup amount based on billing period
      const topupAmount = period === "yearly"
        ? calculateYearlyPrice(monthlyPrice)
        : monthlyPrice;

      // Topup existing Streamflow stream (extends end date)
      await streamflowClient.topupStream(
        streamId,
        topupAmount,
        wallet.adapter as any
      );

      // Streamflow stream is the source of truth - no on-chain record needed
      return { streamId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["creatorMembership", publicKey?.toBase58(), variables.creator.toBase58()],
      });
      queryClient.invalidateQueries({
        queryKey: ["membershipStreams", publicKey?.toBase58()],
      });
      queryClient.invalidateQueries({
        queryKey: ["streamInfo", variables.streamId],
      });
    },
  });

  // Renew ecosystem membership (topup existing stream)
  // IMPORTANT: Must match original billing period - no cross-period topups
  const renewEcosystemMembership = useMutation({
    mutationFn: async ({
      price,
      streamId,
      period = "monthly",
    }: {
      price: bigint;
      streamId: string;
      period?: BillingPeriod;
    }) => {
      if (!publicKey || !wallet?.adapter) {
        throw new Error("Wallet not connected");
      }

      const streamflowClient = await getStreamflowClient(connection.rpcEndpoint);

      console.log("=== RENEW ECOSYSTEM MEMBERSHIP ===");
      console.log("Period:", period);
      console.log("Monthly price (lamports):", price.toString());
      console.log("Stream ID:", streamId);

      // Fetch existing stream to check original period
      const stream = await streamflowClient.getStream(streamId);
      if (!stream) {
        throw new Error("Stream not found");
      }

      // Determine original period from stream name (reliable even after topups)
      // Yearly streams have "Yr" or "Year" in name, monthly don't
      const originalPeriod: BillingPeriod = detectBillingPeriodFromName(stream.name);

      console.log("Stream period check:", {
        streamName: stream.name,
        originalPeriod,
        requestedPeriod: period,
      });

      // Block cross-period topups
      if (originalPeriod !== period) {
        throw new Error(
          `Cannot add ${period} to a ${originalPeriod} membership. ` +
          `To switch periods, cancel and create a new ${period} membership.`
        );
      }

      // Payment amount: monthly = 1x price, yearly = 10x price (discount)
      const paymentAmount = period === "yearly" ? price * BigInt(10) : price;

      console.log("Topup calculation:", {
        period,
        paymentAmount: paymentAmount.toString(),
        paymentSOL: Number(paymentAmount) / 1e9,
      });

      // Use Streamflow SDK directly for topup
      await streamflowClient.topupStream(
        streamId,
        paymentAmount,
        wallet.adapter as any
      );

      console.log("Topup successful");

      return { streamId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["ecosystemMembership", publicKey?.toBase58()],
      });
      queryClient.invalidateQueries({
        queryKey: ["ecosystemStreams", publicKey?.toBase58()],
      });
      queryClient.invalidateQueries({
        queryKey: ["streamInfo", variables.streamId],
      });
    },
  });

  // Join a custom membership tier (single transaction - creator's WSOL ATA created during their init)
  const joinCustomMembership = useMutation({
    mutationFn: async ({
      creator,
      tierId,
      tierName,
      monthlyPrice,
    }: {
      creator: PublicKey;
      tierId: string;
      tierName: string;
      monthlyPrice: number;
    }) => {
      const safePk = safePublicKey(publicKey);
      if (!safePk || !signTransaction || !wallet?.adapter) {
        throw new Error("Wallet not connected");
      }

      const client = await getSDKClient(connection);
      const streamflowClient = await getStreamflowClient(connection.rpcEndpoint);
      const {
        getCreatorPatronConfigPda,
        getCreatorPatronSubscriptionPda,
        createMonthlyStreamParams,
      } = await import("@handcraft/sdk");

      // PRE-FLIGHT CHECK: Validate before triggering Streamflow wallet popup
      const safeCreator = safePublicKey(creator)!;
      const [configPda] = getCreatorPatronConfigPda(safeCreator);
      const [subscriptionPda] = getCreatorPatronSubscriptionPda(safePk, safeCreator);

      const [configAccount, subscriptionAccount] = await Promise.all([
        connection.getAccountInfo(configPda),
        connection.getAccountInfo(subscriptionPda),
      ]);

      // Check if config exists and is active
      if (!configAccount) {
        throw new Error(PREFLIGHT_ERRORS.CONFIG_NOT_FOUND);
      }
      const isConfigActive = configAccount.data[56] === 1;
      if (!isConfigActive) {
        throw new Error(PREFLIGHT_ERRORS.CONFIG_INACTIVE);
      }

      // Check if already subscribed
      if (subscriptionAccount) {
        throw new Error(PREFLIGHT_ERRORS.ALREADY_SUBSCRIBED);
      }

      // Check creator's WSOL ATA exists (created during their membership init)
      const creatorWsolAta = await getAssociatedTokenAddress(NATIVE_MINT, safeCreator);
      const creatorAtaInfo = await connection.getAccountInfo(creatorWsolAta);
      console.log("Creator WSOL ATA:", creatorWsolAta.toBase58(), "exists:", !!creatorAtaInfo);

      if (!creatorAtaInfo) {
        throw new Error("Creator hasn't set up their wallet for receiving payments. Ask them to update their membership settings.");
      }

      const priceLamports = BigInt(Math.floor(monthlyPrice * LAMPORTS_PER_SOL));

      // Create wallet adapter for Streamflow
      const adapter = wallet.adapter as any;
      const walletSigner = {
        publicKey: publicKey,
        signTransaction: signTransaction,
        signAllTransactions: adapter.signAllTransactions?.bind(adapter),
      };

      // Create Streamflow payment stream
      const streamParams = createMonthlyStreamParams(
        creator,
        priceLamports,
        `${tierName} - Custom Tier`
      );

      const streamResult = await streamflowClient.createMembershipStream(
        { ...streamParams, sender: safePk },
        walletSigner as any
      );

      // Streamflow stream is the source of truth - no on-chain record needed
      return { streamId: streamResult.streamId, txSignature: streamResult.txSignature, tierId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["creatorMembership", publicKey?.toBase58(), variables.creator.toBase58()],
      });
      queryClient.invalidateQueries({
        queryKey: ["membershipStreams", publicKey?.toBase58()],
      });
      queryClient.invalidateQueries({
        queryKey: ["customMemberships", variables.creator.toBase58()],
      });
    },
  });

  // Query to get stream info (for "Member since" display)
  // Long cache - stream info rarely changes, only on topup/cancel
  const useStreamInfo = (streamId: string | null) => {
    return useQuery({
      queryKey: ["streamInfo", streamId],
      queryFn: async () => {
        if (!streamId) return null;
        const streamflowClient = await getStreamflowClient(connection.rpcEndpoint);
        const stream = await streamflowClient.getStream(streamId);
        return stream;
      },
      enabled: !!streamId && isMounted,
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
      gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    });
  };

  return {
    // Fetch hooks
    useMembershipConfig,
    useCreatorMembership,
    useStreamInfo,
    ecosystemConfigQuery,
    ecosystemMembershipQuery,

    // Mutations
    initMembershipConfig,
    updateMembershipConfig,
    joinMembership,
    cancelMembership,
    renewMembership,
    joinEcosystemMembership,
    cancelEcosystemMembership,
    renewEcosystemMembership,
    joinCustomMembership,

    // Loading states
    isInitializingMembership: initMembershipConfig.isPending,
    isUpdatingMembership: updateMembershipConfig.isPending,
    isJoiningMembership: joinMembership.isPending,
    isCancellingMembership: cancelMembership.isPending,
    isJoiningEcosystemMembership: joinEcosystemMembership.isPending,
    isCancellingEcosystemMembership: cancelEcosystemMembership.isPending,
    isJoiningCustomMembership: joinCustomMembership.isPending,
  };
}

// Helper to format SOL amounts
export function formatSol(lamports: bigint | number): string {
  const num = typeof lamports === "bigint" ? Number(lamports) : lamports;
  return (num / LAMPORTS_PER_SOL).toFixed(4);
}

// Helper to calculate days remaining from stream's endTime
export function getDaysRemaining(endTimeSeconds: number): number {
  const now = Math.floor(Date.now() / 1000);
  const remaining = Math.max(0, endTimeSeconds - now);
  return Math.round(remaining / (24 * 60 * 60));
}

// Helper to calculate yearly price (10 months = 12 months access, 2 months free)
export function calculateYearlyPrice(monthlyLamports: bigint): bigint {
  return monthlyLamports * BigInt(10);
}

// Helper to format "Member since" date from timestamp (seconds)
export function formatMemberSince(timestampSeconds: number): string {
  const date = new Date(timestampSeconds * 1000);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Helper to get monthly equivalent from yearly
export function getMonthlyFromYearly(yearlyLamports: bigint): bigint {
  return yearlyLamports / BigInt(12);
}

// Helper to detect billing period from stream name (reliable even after topups)
// Stream names: "EcoMembership" (monthly), "EcoMembershipYr" (yearly)
// "CreatorMembership" (monthly), yearly would have "Yr" or "Year"
function detectBillingPeriodFromName(name: string): BillingPeriod {
  const lowerName = name.toLowerCase();
  // Check for yearly indicators in stream name
  if (lowerName.includes("yr") || lowerName.includes("year") || lowerName.includes("annual")) {
    return "yearly";
  }
  return "monthly";
}

// Helper to detect original billing period from stream name
// Used by UI to show only the matching renewal option
export function getStreamBillingPeriod(streamName: string): BillingPeriod {
  return detectBillingPeriodFromName(streamName);
}
