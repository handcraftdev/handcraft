"use client";

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

// Types from API responses
import type { MembershipConfigResponse } from "@/app/api/membership/config/route";
import type { EcosystemConfigResponse, EcosystemMembershipResponse } from "@/app/api/membership/ecosystem/route";
import type { CreatorMembershipResponse } from "@/app/api/membership/creator/route";
import type { StreamInfoResponse } from "@/app/api/membership/stream/route";

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

// Client-side types (with PublicKey objects for compatibility)
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
  authority: PublicKey;
}

export interface EcosystemMembership {
  subscriber: PublicKey;
  streamId: PublicKey;
  startedAt: bigint;
  isActive: boolean;
  isValid: boolean;
}

// Helper to safely reconstruct PublicKey (needed for mutations that use wallet adapter's publicKey)
function safePublicKey(pk: PublicKey | null | undefined): PublicKey | null {
  if (!pk) return null;
  try {
    return new PublicKey(pk.toBase58());
  } catch {
    return null;
  }
}

// Helper to get SDK client dynamically (only needed for mutations)
async function getSDKClient(connection: any) {
  const { createContentRegistryClient } = await import("@handcraft/sdk");
  return createContentRegistryClient(connection);
}

// Helper to get Streamflow client dynamically (only needed for mutations)
async function getStreamflowClient(rpcUrl: string) {
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

  // =========================================================================
  // FETCH QUERIES (via API routes - no SDK on client)
  // =========================================================================

  // Fetch membership config for a creator (pass null to use current user)
  const useMembershipConfig = (creator: PublicKey | null | undefined) => {
    const targetCreator = creator === null ? publicKey : creator;

    return useQuery({
      queryKey: ["membershipConfig", targetCreator?.toBase58()],
      queryFn: async (): Promise<MembershipConfig | null> => {
        if (!targetCreator) return null;

        const res = await fetch(`/api/membership/config?creator=${targetCreator.toBase58()}`);
        if (!res.ok) throw new Error("Failed to fetch membership config");

        const { data } = await res.json() as { data: MembershipConfigResponse | null };
        if (!data) return null;

        return {
          creator: new PublicKey(data.creator),
          monthlyPrice: BigInt(data.monthlyPrice),
          isActive: data.isActive,
        };
      },
      enabled: !!targetCreator,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
    });
  };

  // Fetch membership status for a creator (from Streamflow streams via API)
  const useCreatorMembership = (creator: PublicKey | null) => {
    return useQuery({
      queryKey: ["creatorMembership", publicKey?.toBase58(), creator?.toBase58()],
      queryFn: async (): Promise<CreatorMembership | null> => {
        if (!publicKey || !creator) return null;

        const res = await fetch(
          `/api/membership/creator?subscriber=${publicKey.toBase58()}&creator=${creator.toBase58()}`
        );
        if (!res.ok) throw new Error("Failed to fetch creator membership");

        const { data } = await res.json() as { data: CreatorMembershipResponse | null };
        if (!data) return null;

        return {
          subscriber: new PublicKey(data.subscriber),
          creator: new PublicKey(data.creator),
          billingPeriod: data.billingPeriod,
          streamId: new PublicKey(data.streamId),
          startedAt: BigInt(data.startedAt),
          isActive: data.isActive,
          isValid: data.isValid,
        };
      },
      enabled: !!publicKey && !!creator,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    });
  };

  // Fetch ecosystem membership config (via API)
  const ecosystemConfigQuery = useQuery({
    queryKey: ["ecosystemMembershipConfig"],
    queryFn: async (): Promise<EcosystemMembershipConfig | null> => {
      const res = await fetch("/api/membership/ecosystem");
      if (!res.ok) throw new Error("Failed to fetch ecosystem config");

      const { data, type } = await res.json() as { data: EcosystemConfigResponse | null; type: string };
      if (!data || type !== "config") return null;

      return {
        price: BigInt(data.price),
        isActive: data.isActive,
        authority: new PublicKey(data.authority),
      };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Fetch ecosystem membership status (via API)
  const ecosystemMembershipQuery = useQuery({
    queryKey: ["ecosystemMembership", publicKey?.toBase58()],
    queryFn: async (): Promise<EcosystemMembership | null> => {
      if (!publicKey) return null;

      const res = await fetch(`/api/membership/ecosystem?subscriber=${publicKey.toBase58()}`);
      if (!res.ok) throw new Error("Failed to fetch ecosystem membership");

      const { data, type } = await res.json() as { data: EcosystemMembershipResponse | null; type: string };
      if (!data || type !== "membership") return null;

      return {
        subscriber: new PublicKey(data.subscriber),
        streamId: new PublicKey(data.streamId),
        startedAt: BigInt(data.startedAt),
        isActive: data.isActive,
        isValid: data.isValid,
      };
    },
    enabled: !!publicKey,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // =========================================================================
  // MUTATIONS (require wallet signature - SDK still needed client-side)
  // =========================================================================

  // Initialize membership config (creator only)
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
      const membershipLamports = BigInt(0);

      const tx = new Transaction();

      // Create creator's WSOL ATA if it doesn't exist
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

      // Create creator's WSOL ATA if it doesn't exist
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

      const ix = await client.updatePatronConfigInstruction(
        safePk,
        null,
        monthlyLamports,
        null
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

  // Join a creator's membership via CPI
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

      // PRE-FLIGHT CHECK
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

      const amount = period === "yearly" ? calculateYearlyPrice(monthlyPrice) : monthlyPrice;
      const durationType = period === "yearly"
        ? MembershipDurationType.Yearly
        : MembershipDurationType.Monthly;

      const tier = MembershipTier.Subscription;

      const streamMetadata = Keypair.generate();

      const [ecosystemConfigPda] = getEcosystemConfigPda();
      const ecosystemConfigAccount = await connection.getAccountInfo(ecosystemConfigPda);
      if (!ecosystemConfigAccount) {
        throw new Error("Ecosystem config not found");
      }
      const treasury = new PublicKey(ecosystemConfigAccount.data.slice(40, 72));
      const partner = treasury;

      const tx = new Transaction();

      const subscriberWsolAta = await getAssociatedTokenAddress(NATIVE_MINT, safePk);
      const subscriberAtaInfo = await connection.getAccountInfo(subscriberWsolAta);

      if (!subscriberAtaInfo) {
        tx.add(
          createAssociatedTokenAccountInstruction(
            safePk,
            subscriberWsolAta,
            safePk,
            NATIVE_MINT
          )
        );
      }

      const amountWithFee = amount + (amount * BigInt(3)) / BigInt(1000);
      const { SystemProgram } = await import("@solana/web3.js");
      tx.add(
        SystemProgram.transfer({
          fromPubkey: safePk,
          toPubkey: subscriberWsolAta,
          lamports: amountWithFee,
        }),
        createSyncNativeInstruction(subscriberWsolAta)
      );

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

      const signature = await sendTransactionWithSigners(
        connection,
        tx,
        signTransaction,
        [streamMetadata]
      );

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

  // Cancel creator membership
  const cancelMembership = useMutation({
    mutationFn: async ({ creator, streamId }: { creator: PublicKey; streamId: string }) => {
      const safePk = safePublicKey(publicKey);
      if (!safePk || !signTransaction || !wallet?.adapter) {
        throw new Error("Wallet not connected");
      }

      const streamflowClient = await getStreamflowClient(connection.rpcEndpoint);

      const stream = await streamflowClient.getStream(streamId);
      if (!stream) {
        return "not-found";
      }

      const result = await streamflowClient.cancelStream(streamId, wallet.adapter as any);

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Unwrap WSOL back to native SOL
      const wsolAta = await getAssociatedTokenAddress(NATIVE_MINT, safePk);
      const ataInfo = await connection.getAccountInfo(wsolAta);

      if (ataInfo) {
        const unwrapTx = new Transaction();
        unwrapTx.add(
          createCloseAccountInstruction(
            wsolAta,
            safePk,
            safePk
          )
        );
        unwrapTx.feePayer = safePk;

        try {
          await sendTransactionWithSimulation(connection, unwrapTx, signTransaction);
        } catch (err) {
          console.warn("Failed to unwrap WSOL:", err);
        }
      }

      return result.txSignature;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["creatorMembership", publicKey?.toBase58(), variables.creator.toBase58()],
        refetchType: "all",
      });
      queryClient.invalidateQueries({
        queryKey: ["membershipStreams", publicKey?.toBase58()],
        refetchType: "all",
      });
    },
  });

  // Join ecosystem membership via CPI
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

      // PRE-FLIGHT CHECK
      const [configPda] = getEcosystemSubConfigPda();
      const [subscriptionPda] = getEcosystemSubscriptionPda(safePk);

      const [configAccount, subscriptionAccount] = await Promise.all([
        connection.getAccountInfo(configPda),
        connection.getAccountInfo(subscriptionPda),
      ]);

      if (!configAccount) {
        throw new Error(PREFLIGHT_ERRORS.ECOSYSTEM_NOT_FOUND);
      }
      const isConfigActive = configAccount.data[16] === 1;
      if (!isConfigActive) {
        throw new Error(PREFLIGHT_ERRORS.ECOSYSTEM_INACTIVE);
      }

      if (subscriptionAccount) {
        const streamIdBytes = subscriptionAccount.data.slice(40, 72);
        const existingStreamId = new PublicKey(streamIdBytes);

        try {
          const existingStream = await streamflowClient.getStream(existingStreamId.toBase58());
          if (existingStream && existingStream.canceledAt === 0) {
            throw new Error(PREFLIGHT_ERRORS.ALREADY_SUBSCRIBED);
          }
        } catch (err) {
          // Stream doesn't exist - allow re-subscribe
        }
      }

      const amount = period === "yearly" ? calculateYearlyPrice(price) : price;
      const durationType = period === "yearly"
        ? MembershipDurationType.Yearly
        : MembershipDurationType.Monthly;

      const streamMetadata = Keypair.generate();

      const [ecosystemConfigPda] = getEcosystemConfigPda();
      const ecosystemConfigAccount = await connection.getAccountInfo(ecosystemConfigPda);
      if (!ecosystemConfigAccount) {
        throw new Error("Ecosystem config not found");
      }
      const treasury = new PublicKey(ecosystemConfigAccount.data.slice(40, 72));
      const partner = treasury;

      const tx = new Transaction();

      const subscriberWsolAta = await getAssociatedTokenAddress(NATIVE_MINT, safePk);
      const subscriberAtaInfo = await connection.getAccountInfo(subscriberWsolAta);

      if (!subscriberAtaInfo) {
        tx.add(
          createAssociatedTokenAccountInstruction(
            safePk,
            subscriberWsolAta,
            safePk,
            NATIVE_MINT
          )
        );
      }

      const amountWithFee = amount + (amount * BigInt(3)) / BigInt(1000);
      const { SystemProgram } = await import("@solana/web3.js");
      tx.add(
        SystemProgram.transfer({
          fromPubkey: safePk,
          toPubkey: subscriberWsolAta,
          lamports: amountWithFee,
        }),
        createSyncNativeInstruction(subscriberWsolAta)
      );

      const ix = await client.joinEcosystemMembershipInstruction(
        safePk,
        streamMetadata,
        partner,
        durationType
      );
      tx.add(ix);

      tx.feePayer = safePk;

      const signature = await sendTransactionWithSigners(
        connection,
        tx,
        signTransaction,
        [streamMetadata]
      );

      return {
        streamId: streamMetadata.publicKey.toBase58(),
        txSignature: signature,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["ecosystemMembership", publicKey?.toBase58()],
      });
    },
  });

  // Cancel ecosystem membership
  const cancelEcosystemMembership = useMutation({
    mutationFn: async ({ streamId }: { streamId: string }) => {
      const safePk = safePublicKey(publicKey);
      if (!safePk || !signTransaction || !wallet?.adapter) {
        throw new Error("Wallet not connected");
      }

      const streamflowClient = await getStreamflowClient(connection.rpcEndpoint);

      const stream = await streamflowClient.getStream(streamId);
      if (!stream) {
        return "not-found";
      }

      const result = await streamflowClient.cancelStream(streamId, wallet.adapter as any);

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Unwrap WSOL back to native SOL
      const wsolAta = await getAssociatedTokenAddress(NATIVE_MINT, safePk);
      const ataInfo = await connection.getAccountInfo(wsolAta);

      if (ataInfo) {
        const unwrapTx = new Transaction();
        unwrapTx.add(
          createCloseAccountInstruction(
            wsolAta,
            safePk,
            safePk
          )
        );
        unwrapTx.feePayer = safePk;

        try {
          await sendTransactionWithSimulation(connection, unwrapTx, signTransaction);
        } catch (err) {
          console.warn("Failed to unwrap WSOL:", err);
        }
      }

      return result.txSignature;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["ecosystemMembership", publicKey?.toBase58()],
        refetchType: "all",
      });
    },
  });

  // Renew creator membership (topup existing stream)
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
      streamId: string;
    }) => {
      if (!publicKey || !wallet?.adapter) {
        throw new Error("Wallet not connected");
      }

      const streamflowClient = await getStreamflowClient(connection.rpcEndpoint);

      const stream = await streamflowClient.getStream(streamId);
      if (!stream) {
        throw new Error("Stream not found");
      }

      const originalPeriod: BillingPeriod = detectBillingPeriodFromName(stream.name);

      if (originalPeriod !== period) {
        throw new Error(
          `Cannot add ${period} to a ${originalPeriod} membership. ` +
          `To switch periods, cancel and create a new ${period} membership.`
        );
      }

      const topupAmount = period === "yearly"
        ? calculateYearlyPrice(monthlyPrice)
        : monthlyPrice;

      await streamflowClient.topupStream(
        streamId,
        topupAmount,
        wallet.adapter as any
      );

      return { streamId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["creatorMembership", publicKey?.toBase58(), variables.creator.toBase58()],
      });
      queryClient.invalidateQueries({
        queryKey: ["streamInfo", variables.streamId],
      });
    },
  });

  // Renew ecosystem membership (topup existing stream)
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

      const stream = await streamflowClient.getStream(streamId);
      if (!stream) {
        throw new Error("Stream not found");
      }

      const originalPeriod: BillingPeriod = detectBillingPeriodFromName(stream.name);

      if (originalPeriod !== period) {
        throw new Error(
          `Cannot add ${period} to a ${originalPeriod} membership. ` +
          `To switch periods, cancel and create a new ${period} membership.`
        );
      }

      const paymentAmount = period === "yearly" ? price * BigInt(10) : price;

      await streamflowClient.topupStream(
        streamId,
        paymentAmount,
        wallet.adapter as any
      );

      return { streamId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["ecosystemMembership", publicKey?.toBase58()],
      });
      queryClient.invalidateQueries({
        queryKey: ["streamInfo", variables.streamId],
      });
    },
  });

  // Join a custom membership tier
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

      const streamflowClient = await getStreamflowClient(connection.rpcEndpoint);
      const {
        getCreatorPatronConfigPda,
        getCreatorPatronSubscriptionPda,
        createMonthlyStreamParams,
      } = await import("@handcraft/sdk");

      // PRE-FLIGHT CHECK
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

      const creatorWsolAta = await getAssociatedTokenAddress(NATIVE_MINT, safeCreator);
      const creatorAtaInfo = await connection.getAccountInfo(creatorWsolAta);

      if (!creatorAtaInfo) {
        throw new Error("Creator hasn't set up their wallet for receiving payments.");
      }

      const priceLamports = BigInt(Math.floor(monthlyPrice * LAMPORTS_PER_SOL));

      const adapter = wallet.adapter as any;
      const walletSigner = {
        publicKey: publicKey,
        signTransaction: signTransaction,
        signAllTransactions: adapter.signAllTransactions?.bind(adapter),
      };

      const streamParams = createMonthlyStreamParams(
        creator,
        priceLamports,
        `${tierName} - Custom Tier`
      );

      const streamResult = await streamflowClient.createMembershipStream(
        { ...streamParams, sender: safePk },
        walletSigner as any
      );

      return { streamId: streamResult.streamId, txSignature: streamResult.txSignature, tierId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["creatorMembership", publicKey?.toBase58(), variables.creator.toBase58()],
      });
    },
  });

  // Query to get stream info (via API)
  const useStreamInfo = (streamId: string | null) => {
    return useQuery({
      queryKey: ["streamInfo", streamId],
      queryFn: async (): Promise<StreamInfoResponse | null> => {
        if (!streamId) return null;

        const res = await fetch(`/api/membership/stream?id=${streamId}`);
        if (!res.ok) throw new Error("Failed to fetch stream info");

        const { data } = await res.json() as { data: StreamInfoResponse | null };
        return data;
      },
      enabled: !!streamId,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
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
  return (num / LAMPORTS_PER_SOL).toFixed(6);
}

// Helper to calculate days remaining from stream's endTime
export function getDaysRemaining(endTimeSeconds: number): number {
  const now = Math.floor(Date.now() / 1000);
  const remaining = Math.max(0, endTimeSeconds - now);
  return Math.round(remaining / (24 * 60 * 60));
}

// Helper to calculate yearly price (10 months = 12 months access)
export function calculateYearlyPrice(monthlyLamports: bigint): bigint {
  return monthlyLamports * BigInt(10);
}

// Helper to format "Member since" date from timestamp
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

// Helper to detect billing period from stream name
function detectBillingPeriodFromName(name: string): BillingPeriod {
  const lowerName = name.toLowerCase();
  if (lowerName.includes("yr") || lowerName.includes("year") || lowerName.includes("annual")) {
    return "yearly";
  }
  return "monthly";
}

// Helper to detect original billing period from stream name
export function getStreamBillingPeriod(streamName: string): BillingPeriod {
  return detectBillingPeriodFromName(streamName);
}
