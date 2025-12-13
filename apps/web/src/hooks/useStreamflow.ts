"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  StreamflowClient,
  StreamInfo,
  createMonthlyStreamParams,
  createYearlyStreamParams,
  SECONDS_PER_MONTH,
  SECONDS_PER_YEAR,
  getCreatorPatronTreasuryPda,
  getEcosystemStreamingTreasuryPda,
} from "@handcraft/sdk";

const SOLANA_NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet") as "mainnet" | "devnet" | "testnet";

/**
 * Hook for managing Streamflow payment streams for memberships.
 * Creates and manages streaming payments to creator and ecosystem treasuries.
 */
export function useStreamflow() {
  const { connection } = useConnection();
  const { publicKey, wallet, signTransaction } = useWallet();
  const queryClient = useQueryClient();

  // Create Streamflow client
  const streamflowClient = new StreamflowClient({
    cluster: SOLANA_NETWORK,
    rpcUrl: connection.rpcEndpoint,
  });

  /**
   * Create a membership payment stream to a creator.
   * This streams SOL to the creator's treasury over the subscription period.
   */
  const createMembershipStream = useMutation({
    mutationFn: async ({
      creator,
      monthlyPriceLamports,
      billingPeriod,
    }: {
      creator: PublicKey;
      monthlyPriceLamports: bigint;
      billingPeriod: "monthly" | "yearly";
    }) => {
      if (!publicKey || !wallet?.adapter || !signTransaction) {
        throw new Error("Wallet not connected");
      }

      const streamParams = billingPeriod === "monthly"
        ? createMonthlyStreamParams(creator, monthlyPriceLamports, "Membership")
        : createYearlyStreamParams(creator, monthlyPriceLamports, "Annual Membership");

      // Step 1: Prepare WSOL ATAs if needed (workaround for Streamflow SDK bug)
      const prepInstructions = await streamflowClient.prepareNativeSolStream(
        publicKey,
        creator
      );

      if (prepInstructions.length > 0) {
        const prepTx = new Transaction().add(...prepInstructions);
        prepTx.feePayer = publicKey;
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        prepTx.recentBlockhash = blockhash;

        const signedPrepTx = await signTransaction(prepTx);
        const prepSig = await connection.sendRawTransaction(signedPrepTx.serialize());
        await connection.confirmTransaction({ signature: prepSig, blockhash, lastValidBlockHeight }, "confirmed");
      }

      // Step 2: Create the stream (Streamflow handles SOL wrapping with isNative: true)
      const result = await streamflowClient.createMembershipStream(
        { ...streamParams, sender: publicKey },
        wallet.adapter as any
      );

      return result;
    },
    onSuccess: (_, variables) => {
      // Invalidate stream queries
      queryClient.invalidateQueries({
        queryKey: ["membershipStreams", publicKey?.toBase58()],
      });
      queryClient.invalidateQueries({
        queryKey: ["creatorStreams", variables.creator.toBase58()],
      });
    },
  });

  /**
   * Create an ecosystem subscription payment stream.
   * Streams SOL to the ecosystem treasury for platform-wide access.
   */
  const createEcosystemStream = useMutation({
    mutationFn: async ({
      recipient,
      priceLamports,
      durationSeconds = SECONDS_PER_MONTH,
    }: {
      recipient: PublicKey;
      priceLamports: bigint;
      durationSeconds?: number;
    }) => {
      if (!publicKey || !wallet?.adapter || !signTransaction) {
        throw new Error("Wallet not connected");
      }

      // Step 1: Prepare WSOL ATAs if needed (workaround for Streamflow SDK bug)
      const prepInstructions = await streamflowClient.prepareNativeSolStream(
        publicKey,
        recipient
      );

      if (prepInstructions.length > 0) {
        const prepTx = new Transaction().add(...prepInstructions);
        prepTx.feePayer = publicKey;
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        prepTx.recentBlockhash = blockhash;

        const signedPrepTx = await signTransaction(prepTx);
        const prepSig = await connection.sendRawTransaction(signedPrepTx.serialize());
        await connection.confirmTransaction({ signature: prepSig, blockhash, lastValidBlockHeight }, "confirmed");
      }

      // Step 2: Create the stream (Streamflow handles SOL wrapping with isNative: true)
      const result = await streamflowClient.createEcosystemStream(
        {
          sender: publicKey,
          recipient,
          amountLamports: priceLamports,
          durationSeconds,
          name: "Ecosystem Subscription",
        },
        wallet.adapter as any
      );

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["ecosystemStreams", publicKey?.toBase58()],
      });
    },
  });

  /**
   * Cancel an active payment stream.
   * Remaining funds are returned to the subscriber.
   */
  const cancelStream = useMutation({
    mutationFn: async ({ streamId }: { streamId: string }) => {
      if (!publicKey || !wallet?.adapter) {
        throw new Error("Wallet not connected");
      }

      const result = await streamflowClient.cancelStream(
        streamId,
        wallet.adapter as any
      );

      return result;
    },
    onSuccess: () => {
      // Invalidate all stream queries
      queryClient.invalidateQueries({
        queryKey: ["membershipStreams"],
      });
      queryClient.invalidateQueries({
        queryKey: ["ecosystemStreams"],
      });
    },
  });

  /**
   * Get all membership streams for the current user.
   */
  const useMembershipStreams = () => {
    return useQuery({
      queryKey: ["membershipStreams", publicKey?.toBase58()],
      queryFn: async (): Promise<StreamInfo[]> => {
        if (!publicKey) return [];
        return streamflowClient.getStreamsForWallet(publicKey);
      },
      enabled: !!publicKey,
    });
  };

  /**
   * Get streams to a specific creator's treasury.
   */
  const useCreatorStreams = (creator: PublicKey | null) => {
    return useQuery({
      queryKey: ["creatorStreams", creator?.toBase58()],
      queryFn: async (): Promise<StreamInfo[]> => {
        if (!creator) return [];
        const [treasuryPda] = getCreatorPatronTreasuryPda(creator);
        return streamflowClient.getStreamsForWallet(treasuryPda);
      },
      enabled: !!creator,
    });
  };

  /**
   * Get ecosystem subscription streams for the current user.
   */
  const useEcosystemStreams = () => {
    const [ecosystemTreasury] = getEcosystemStreamingTreasuryPda();

    return useQuery({
      queryKey: ["ecosystemStreams", publicKey?.toBase58()],
      queryFn: async (): Promise<StreamInfo[]> => {
        if (!publicKey) return [];

        // Get all user's streams and filter for ecosystem treasury
        const allStreams = await streamflowClient.getStreamsForWallet(publicKey);
        return allStreams.filter(
          stream => stream.recipient === ecosystemTreasury.toBase58()
        );
      },
      enabled: !!publicKey,
    });
  };

  /**
   * Get a specific stream by ID.
   */
  const useStream = (streamId: string | null) => {
    return useQuery({
      queryKey: ["stream", streamId],
      queryFn: async (): Promise<StreamInfo | null> => {
        if (!streamId) return null;
        return streamflowClient.getStream(streamId);
      },
      enabled: !!streamId,
    });
  };

  return {
    // Mutations
    createMembershipStream,
    createEcosystemStream,
    cancelStream,

    // Query hooks
    useMembershipStreams,
    useCreatorStreams,
    useEcosystemStreams,
    useStream,

    // Loading states
    isCreatingStream: createMembershipStream.isPending || createEcosystemStream.isPending,
    isCancellingStream: cancelStream.isPending,
  };
}

// Helper to format stream status
export function getStreamStatus(stream: StreamInfo): "active" | "completed" | "cancelled" {
  const now = Math.floor(Date.now() / 1000);

  if (stream.endTime <= now) {
    return "completed";
  }

  // Check if fully withdrawn (cancelled)
  const deposited = stream.depositedAmount.toNumber();
  const withdrawn = stream.withdrawnAmount.toNumber();
  if (withdrawn >= deposited) {
    return "completed";
  }

  return "active";
}

// Helper to calculate remaining time
export function getStreamTimeRemaining(stream: StreamInfo): number {
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, stream.endTime - now);
}

// Helper to calculate unlocked amount
export function getStreamUnlockedAmount(stream: StreamInfo): bigint {
  const now = Math.floor(Date.now() / 1000);
  const elapsed = Math.max(0, now - stream.startTime);
  const totalDuration = stream.endTime - stream.startTime;

  if (elapsed >= totalDuration) {
    return BigInt(stream.depositedAmount.toString());
  }

  const deposited = BigInt(stream.depositedAmount.toString());
  return (deposited * BigInt(elapsed)) / BigInt(totalDuration);
}
