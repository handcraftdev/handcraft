"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createContentRegistryClient,
  ContentType,
  getProfilePda,
  getContentPda,
} from "@handcraft/sdk";

export { ContentType };

export function useContentRegistry() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const queryClient = useQueryClient();

  const client = createContentRegistryClient(connection);

  // Fetch current user's profile
  const profileQuery = useQuery({
    queryKey: ["profile", publicKey?.toBase58()],
    queryFn: () => (publicKey ? client.fetchProfile(publicKey) : null),
    enabled: !!publicKey,
  });

  // Fetch current user's content
  const contentQuery = useQuery({
    queryKey: ["content", publicKey?.toBase58()],
    queryFn: () => (publicKey ? client.fetchAllContent(publicKey) : []),
    enabled: !!publicKey && !!profileQuery.data,
  });

  // Create profile mutation
  const createProfile = useMutation({
    mutationFn: async (username: string) => {
      if (!publicKey) throw new Error("Wallet not connected");

      const ix = client.createProfileInstruction(publicKey, username);
      const tx = new Transaction().add(ix);
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, "confirmed");
      return signature;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", publicKey?.toBase58()] });
    },
  });

  // Create content mutation
  const createContent = useMutation({
    mutationFn: async ({
      contentCid,
      metadataCid,
      contentType,
    }: {
      contentCid: string;
      metadataCid: string;
      contentType: ContentType;
    }) => {
      if (!publicKey) throw new Error("Wallet not connected");
      if (!profileQuery.data) throw new Error("Profile not found");

      const ix = client.createContentInstruction(
        publicKey,
        profileQuery.data.contentCount,
        contentCid,
        metadataCid,
        contentType
      );
      const tx = new Transaction().add(ix);
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, "confirmed");
      return signature;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", publicKey?.toBase58()] });
      queryClient.invalidateQueries({ queryKey: ["content", publicKey?.toBase58()] });
    },
  });

  // Tip content mutation
  const tipContent = useMutation({
    mutationFn: async ({
      creatorAddress,
      contentIndex,
      amountLamports,
    }: {
      creatorAddress: string;
      contentIndex: bigint;
      amountLamports: number;
    }) => {
      if (!publicKey) throw new Error("Wallet not connected");

      const { PublicKey } = await import("@solana/web3.js");
      const creator = new PublicKey(creatorAddress);
      const [contentPda] = getContentPda(creator, contentIndex);

      const ix = client.tipContentInstruction(publicKey, contentPda, creator, amountLamports);
      const tx = new Transaction().add(ix);
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, "confirmed");
      return signature;
    },
  });

  return {
    // State
    profile: profileQuery.data,
    content: contentQuery.data || [],
    isLoadingProfile: profileQuery.isLoading,
    isLoadingContent: contentQuery.isLoading,
    hasProfile: !!profileQuery.data,

    // Actions
    createProfile: createProfile.mutateAsync,
    createContent: createContent.mutateAsync,
    tipContent: tipContent.mutateAsync,

    // Mutation states
    isCreatingProfile: createProfile.isPending,
    isCreatingContent: createContent.isPending,
    isTipping: tipContent.isPending,

    // Utilities
    client,
    getProfilePda,
    getContentPda,
  };
}
