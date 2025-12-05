"use client";

import { useMemo } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction, PublicKey, TransactionInstruction, Connection } from "@solana/web3.js";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createContentRegistryClient,
  ContentType,
  PaymentCurrency,
  getContentPda,
  getCidRegistryPda,
  getEcosystemConfigPda,
  getMintConfigPda,
  getContentRewardPoolPda,
  getWalletContentStatePda,
  getContentCollectionPda,
  ContentRewardPool,
  WalletContentState,
  MintConfig,
  EcosystemConfig,
  ContentCollection,
  calculatePrimarySplit,
  calculatePendingReward,
  MIN_CREATOR_ROYALTY_BPS,
  MAX_CREATOR_ROYALTY_BPS,
  MIN_PRICE_LAMPORTS,
  PRECISION,
} from "@handcraft/sdk";

export {
  ContentType,
  PaymentCurrency,
  MIN_CREATOR_ROYALTY_BPS,
  MAX_CREATOR_ROYALTY_BPS,
  MIN_PRICE_LAMPORTS,
};
export type { MintConfig, EcosystemConfig, ContentRewardPool, WalletContentState, ContentCollection };

/**
 * Simulate a transaction before sending to wallet
 * Throws an error with a descriptive message if simulation fails
 */
async function simulateTransaction(
  connection: Connection,
  tx: Transaction,
  feePayer: PublicKey
): Promise<void> {
  tx.feePayer = feePayer;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  const simulation = await connection.simulateTransaction(tx);

  if (simulation.value.err) {
    // Extract error details
    const logs = simulation.value.logs || [];
    const errorLog = logs.find(log =>
      log.includes("Error") ||
      log.includes("error") ||
      log.includes("failed")
    );

    // Check for specific error patterns
    if (logs.some(log => log.includes("already in use"))) {
      throw new Error("Account already exists - this content may already be registered");
    }
    if (logs.some(log => log.includes("CidAlreadyRegistered"))) {
      throw new Error("This content CID is already registered on-chain");
    }
    if (logs.some(log => log.includes("insufficient funds"))) {
      throw new Error("Insufficient funds for transaction");
    }

    throw new Error(
      errorLog ||
      `Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`
    );
  }
}

export function useContentRegistry() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const queryClient = useQueryClient();

  // Memoize client to prevent recreating on every render
  const client = useMemo(() => createContentRegistryClient(connection), [connection]);

  // Fetch current user's content
  const contentQuery = useQuery({
    queryKey: ["content", publicKey?.toBase58()],
    queryFn: () => (publicKey ? client.fetchContentByCreator(publicKey) : []),
    enabled: !!publicKey,
    staleTime: 30000, // Cache for 30 seconds
  });

  // Fetch global content (all creators)
  const globalContentQuery = useQuery({
    queryKey: ["globalContent"],
    queryFn: () => client.fetchGlobalContent(),
    staleTime: 30000, // Cache for 30 seconds
  });

  // Register content mutation (without NFT config)
  const registerContent = useMutation({
    mutationFn: async ({
      contentCid,
      metadataCid,
      contentType,
      isEncrypted = false,
      previewCid = "",
      encryptionMetaCid = "",
    }: {
      contentCid: string;
      metadataCid: string;
      contentType: ContentType;
      isEncrypted?: boolean;
      previewCid?: string;
      encryptionMetaCid?: string;
    }) => {
      if (!publicKey) throw new Error("Wallet not connected");

      console.log("Registering content...");
      console.log("Content CID:", contentCid);
      console.log("Metadata CID:", metadataCid);
      console.log("Is Encrypted:", isEncrypted);

      const ix = await client.registerContentInstruction(
        publicKey,
        contentCid,
        metadataCid,
        contentType,
        isEncrypted,
        previewCid,
        encryptionMetaCid
      );

      console.log("Content instruction created, keys:", ix.keys.map(k => ({
        pubkey: k.pubkey.toBase58(),
        isSigner: k.isSigner,
        isWritable: k.isWritable
      })));

      const tx = new Transaction().add(ix);

      // Simulate transaction before prompting wallet
      console.log("Simulating transaction...");
      await simulateTransaction(connection, tx, publicKey);
      console.log("Simulation successful, sending to wallet...");

      const signature = await sendTransaction(tx, connection);
      console.log("Content registration tx sent:", signature);
      await connection.confirmTransaction(signature, "confirmed");
      console.log("Content registration confirmed!");
      return signature;
    },
    onSuccess: () => {
      console.log("Invalidating queries after content registration");
      queryClient.invalidateQueries({ queryKey: ["content", publicKey?.toBase58()] });
      queryClient.invalidateQueries({ queryKey: ["globalContent"] });
    },
  });

  // Register content with mint config (SOL only)
  const registerContentWithMint = useMutation({
    mutationFn: async ({
      contentCid,
      metadataCid,
      contentType,
      price,
      maxSupply,
      creatorRoyaltyBps,
      isEncrypted = false,
      previewCid = "",
      encryptionMetaCid = "",
    }: {
      contentCid: string;
      metadataCid: string;
      contentType: ContentType;
      price: bigint;
      maxSupply: bigint | null;
      creatorRoyaltyBps: number;
      isEncrypted?: boolean;
      previewCid?: string;
      encryptionMetaCid?: string;
    }) => {
      if (!publicKey) throw new Error("Wallet not connected");

      console.log("Registering content with mint config...", {
        contentCid,
        metadataCid,
        price,
        maxSupply,
        creatorRoyaltyBps,
        isEncrypted,
        previewCid,
        encryptionMetaCid,
      });

      // registerContentWithMintInstruction now returns { instruction, collectionAssetKeypair }
      // because it also creates a Metaplex Core Collection with LinkedLifecycleHook
      const { instruction, collectionAssetKeypair } = await client.registerContentWithMintInstruction(
        publicKey,
        contentCid,
        metadataCid,
        contentType,
        price,
        maxSupply,
        creatorRoyaltyBps,
        isEncrypted,
        previewCid,
        encryptionMetaCid
      );

      console.log("Collection Asset pubkey:", collectionAssetKeypair.publicKey.toBase58());

      const tx = new Transaction().add(instruction);

      // Set up the transaction for simulation
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      // Sign with the collection asset keypair (partial sign before wallet signs)
      tx.partialSign(collectionAssetKeypair);

      // Simulate transaction before prompting wallet
      console.log("Simulating transaction...");
      const simulation = await connection.simulateTransaction(tx);
      if (simulation.value.err) {
        const logs = simulation.value.logs || [];
        const errorLog = logs.find(log =>
          log.includes("Error") || log.includes("error") || log.includes("failed")
        );
        throw new Error(errorLog || `Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
      }
      console.log("Simulation successful, sending to wallet...");

      // Send transaction with the collection keypair as additional signer
      const signature = await sendTransaction(tx, connection, {
        signers: [collectionAssetKeypair],
      });
      console.log("Content + mint registration tx sent:", signature);
      await connection.confirmTransaction(signature, "confirmed");
      console.log("Content + mint registration confirmed!");
      return signature;
    },
    onSuccess: () => {
      console.log("Invalidating queries after content + mint registration");
      queryClient.invalidateQueries({ queryKey: ["content", publicKey?.toBase58()] });
      queryClient.invalidateQueries({ queryKey: ["globalContent"] });
      queryClient.invalidateQueries({ queryKey: ["mintableContent"] });
    },
  });

  // Tip content mutation
  const tipContent = useMutation({
    mutationFn: async ({
      contentCid,
      creator,
      amountLamports,
    }: {
      contentCid: string;
      creator: PublicKey;
      amountLamports: number;
    }) => {
      if (!publicKey) throw new Error("Wallet not connected");

      const ix = await client.tipContentInstruction(publicKey, contentCid, creator, amountLamports);
      const tx = new Transaction().add(ix);

      // Simulate transaction before prompting wallet
      await simulateTransaction(connection, tx, publicKey);

      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, "confirmed");
      return signature;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["globalContent"] });
    },
  });

  // Configure mint mutation (SOL only)
  const configureMint = useMutation({
    mutationFn: async ({
      contentCid,
      price,
      maxSupply,
      creatorRoyaltyBps,
    }: {
      contentCid: string;
      price: bigint;
      maxSupply: bigint | null;
      creatorRoyaltyBps: number;
    }) => {
      if (!publicKey) throw new Error("Wallet not connected");

      console.log("Configuring mint...", { contentCid, price, maxSupply, creatorRoyaltyBps });

      const ix = await client.configureMintInstruction(
        publicKey,
        contentCid,
        price,
        maxSupply,
        creatorRoyaltyBps
      );

      const tx = new Transaction().add(ix);

      // Simulate transaction before prompting wallet
      console.log("Simulating transaction...");
      await simulateTransaction(connection, tx, publicKey);
      console.log("Simulation successful, sending to wallet...");

      const signature = await sendTransaction(tx, connection);
      console.log("Configure mint tx sent:", signature);
      await connection.confirmTransaction(signature, "confirmed");
      console.log("Configure mint confirmed!");
      return signature;
    },
    onSuccess: (_, { contentCid }) => {
      queryClient.invalidateQueries({ queryKey: ["mintConfig", contentCid] });
      queryClient.invalidateQueries({ queryKey: ["mintableContent"] });
    },
  });

  // Update mint settings mutation (for existing configs)
  const updateMintSettings = useMutation({
    mutationFn: async ({
      contentCid,
      price,
      maxSupply,
      creatorRoyaltyBps,
      isActive,
    }: {
      contentCid: string;
      price: bigint | null;
      maxSupply: bigint | null | undefined;
      creatorRoyaltyBps: number | null;
      isActive: boolean | null;
    }) => {
      if (!publicKey) throw new Error("Wallet not connected");

      console.log("Updating mint settings...", { contentCid, price, maxSupply, creatorRoyaltyBps, isActive });

      const ix = await client.updateMintSettingsInstruction(
        publicKey,
        contentCid,
        price,
        maxSupply,
        creatorRoyaltyBps,
        isActive
      );

      const tx = new Transaction().add(ix);

      // Simulate transaction before prompting wallet
      console.log("Simulating transaction...");
      await simulateTransaction(connection, tx, publicKey);
      console.log("Simulation successful, sending to wallet...");

      const signature = await sendTransaction(tx, connection);
      console.log("Update mint settings tx sent:", signature);
      await connection.confirmTransaction(signature, "confirmed");
      console.log("Update mint settings confirmed!");
      return signature;
    },
    onSuccess: (_, { contentCid }) => {
      queryClient.invalidateQueries({ queryKey: ["mintConfig", contentCid] });
      queryClient.invalidateQueries({ queryKey: ["mintableContent"] });
    },
  });

  // Mint NFT with SOL mutation
  // 12% holder reward is automatically deposited to accumulated reward pool
  // NFT is created within the content's collection, inheriting its LinkedLifecycleHook
  const mintNftSol = useMutation({
    mutationFn: async ({
      contentCid,
      creator,
      treasury,
      platform,
    }: {
      contentCid: string;
      creator: PublicKey;
      treasury: PublicKey;
      platform: PublicKey;
    }) => {
      if (!publicKey) throw new Error("Wallet not connected");

      console.log("Minting NFT with SOL...", {
        contentCid,
        creator: creator.toBase58(),
        treasury: treasury.toBase58(),
        platform: platform.toBase58(),
        buyer: publicKey.toBase58(),
      });

      // First, fetch the content collection to get the collection asset address
      const contentCollection = await client.fetchContentCollection(contentCid);
      if (!contentCollection) {
        throw new Error("Content collection not found. Make sure the content was registered with mint config.");
      }

      console.log("Collection Asset:", contentCollection.collectionAsset.toBase58());

      // mintNftSolInstruction returns { instruction, nftAssetKeypair }
      // The nftAssetKeypair MUST be added as a signer to the transaction
      const { instruction, nftAssetKeypair } = await client.mintNftSolInstruction(
        publicKey,
        contentCid,
        creator,
        treasury,
        platform,
        contentCollection.collectionAsset
      );

      console.log("NFT Asset pubkey:", nftAssetKeypair.publicKey.toBase58());

      const tx = new Transaction().add(instruction);

      // Set up the transaction for simulation
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      // Sign with the NFT asset keypair (partial sign before wallet signs)
      tx.partialSign(nftAssetKeypair);

      // Simulate transaction before prompting wallet
      console.log("Simulating transaction...");
      const simulation = await connection.simulateTransaction(tx);
      if (simulation.value.err) {
        const logs = simulation.value.logs || [];
        const errorLog = logs.find(log =>
          log.includes("Error") || log.includes("error") || log.includes("failed")
        );
        throw new Error(errorLog || `Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
      }
      console.log("Simulation successful, sending to wallet...");

      // Send transaction with the NFT keypair as additional signer
      const signature = await sendTransaction(tx, connection, {
        signers: [nftAssetKeypair],
      });
      console.log("Mint NFT tx sent:", signature);
      await connection.confirmTransaction(signature, "confirmed");
      console.log("Mint NFT confirmed!");
      return signature;
    },
    onSuccess: (_, { contentCid }) => {
      queryClient.invalidateQueries({ queryKey: ["globalContent"] });
      queryClient.invalidateQueries({ queryKey: ["mintConfig", contentCid] });
      queryClient.invalidateQueries({ queryKey: ["mintableContent"] });
      queryClient.invalidateQueries({ queryKey: ["contentRewardPool", contentCid] });
      queryClient.invalidateQueries({ queryKey: ["walletContentState"] });
      queryClient.invalidateQueries({ queryKey: ["pendingRewards"] });
    },
  });

  // Update content metadata mutation (only before first mint)
  const updateContent = useMutation({
    mutationFn: async ({
      contentCid,
      metadataCid,
    }: {
      contentCid: string;
      metadataCid: string;
    }) => {
      if (!publicKey) throw new Error("Wallet not connected");

      console.log("Updating content...", { contentCid, metadataCid });

      const ix = await client.updateContentInstruction(
        publicKey,
        contentCid,
        metadataCid
      );

      const tx = new Transaction().add(ix);

      // Simulate transaction before prompting wallet
      console.log("Simulating transaction...");
      await simulateTransaction(connection, tx, publicKey);
      console.log("Simulation successful, sending to wallet...");

      const signature = await sendTransaction(tx, connection);
      console.log("Update content tx sent:", signature);
      await connection.confirmTransaction(signature, "confirmed");
      console.log("Update content confirmed!");
      return signature;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content", publicKey?.toBase58()] });
      queryClient.invalidateQueries({ queryKey: ["globalContent"] });
    },
  });

  // Delete content mutation (only before first mint)
  const deleteContent = useMutation({
    mutationFn: async ({
      contentCid,
      hasMintConfig,
    }: {
      contentCid: string;
      hasMintConfig?: boolean;
    }) => {
      if (!publicKey) throw new Error("Wallet not connected");

      console.log("Deleting content...", { contentCid, hasMintConfig });

      // Use the appropriate delete instruction based on whether mint config exists
      const ix = hasMintConfig
        ? await client.deleteContentWithMintInstruction(publicKey, contentCid)
        : await client.deleteContentInstruction(publicKey, contentCid);

      const tx = new Transaction().add(ix);

      // Simulate transaction before prompting wallet
      console.log("Simulating transaction...");
      await simulateTransaction(connection, tx, publicKey);
      console.log("Simulation successful, sending to wallet...");

      const signature = await sendTransaction(tx, connection);
      console.log("Delete content tx sent:", signature);
      await connection.confirmTransaction(signature, "confirmed");
      console.log("Delete content confirmed!");
      return signature;
    },
    onSuccess: (_, { contentCid }) => {
      queryClient.invalidateQueries({ queryKey: ["content", publicKey?.toBase58()] });
      queryClient.invalidateQueries({ queryKey: ["globalContent"] });
      queryClient.invalidateQueries({ queryKey: ["mintConfig", contentCid] });
      queryClient.invalidateQueries({ queryKey: ["mintableContent"] });
    },
  });

  // Claim rewards mutation (per-content pool - claims pending rewards for a content position)
  const claimContentRewards = useMutation({
    mutationFn: async ({
      contentCid,
    }: {
      contentCid: string;
    }) => {
      if (!publicKey) throw new Error("Wallet not connected");

      console.log("Claiming rewards for content...", {
        contentCid,
      });

      const ix = await client.claimContentRewardsInstruction(
        publicKey,
        contentCid
      );

      const tx = new Transaction().add(ix);

      // Simulate transaction before prompting wallet
      console.log("Simulating claim transaction...");
      await simulateTransaction(connection, tx, publicKey);
      console.log("Simulation successful, sending to wallet...");

      const signature = await sendTransaction(tx, connection);
      console.log("Claim tx sent:", signature);
      await connection.confirmTransaction(signature, "confirmed");
      console.log("Claim confirmed!");
      return signature;
    },
    onSuccess: (_, { contentCid }) => {
      queryClient.invalidateQueries({ queryKey: ["contentRewardPool", contentCid] });
      queryClient.invalidateQueries({ queryKey: ["walletContentState", publicKey?.toBase58(), contentCid] });
      queryClient.invalidateQueries({ queryKey: ["pendingRewards"] });
    },
  });

  // Claim rewards with on-chain NFT verification (recommended)
  // This verifies actual NFT ownership at claim time, preventing gaming the system
  const claimRewardsVerified = useMutation({
    mutationFn: async ({
      contentCid,
    }: {
      contentCid: string;
    }) => {
      if (!publicKey) throw new Error("Wallet not connected");

      console.log("Claiming verified rewards for content...", {
        contentCid,
      });

      // First, fetch the content collection to get the collection asset address
      const contentCollection = await client.fetchContentCollection(contentCid);
      if (!contentCollection) {
        throw new Error("Content collection not found.");
      }

      // Fetch NFT assets owned by the user for this collection
      const nftAssets = await client.fetchWalletNftsForCollection(
        publicKey,
        contentCollection.collectionAsset
      );

      console.log("Found NFT assets:", nftAssets.length);

      const ix = await client.claimRewardsVerifiedInstruction(
        publicKey,
        contentCid,
        nftAssets
      );

      const tx = new Transaction().add(ix);

      // Simulate transaction before prompting wallet
      console.log("Simulating verified claim transaction...");
      await simulateTransaction(connection, tx, publicKey);
      console.log("Simulation successful, sending to wallet...");

      const signature = await sendTransaction(tx, connection);
      console.log("Verified claim tx sent:", signature);
      await connection.confirmTransaction(signature, "confirmed");
      console.log("Verified claim confirmed!");
      return signature;
    },
    onSuccess: (_, { contentCid }) => {
      queryClient.invalidateQueries({ queryKey: ["contentRewardPool", contentCid] });
      queryClient.invalidateQueries({ queryKey: ["walletContentState", publicKey?.toBase58(), contentCid] });
      queryClient.invalidateQueries({ queryKey: ["pendingRewards"] });
    },
  });

  // Batch claim rewards mutation (claims from multiple content positions in one transaction)
  const claimAllRewards = useMutation({
    mutationFn: async ({
      contentCids,
    }: {
      contentCids: string[];
    }) => {
      if (!publicKey) throw new Error("Wallet not connected");
      if (contentCids.length === 0) throw new Error("No content to claim from");

      console.log("Claiming all rewards...", {
        contentCids,
        count: contentCids.length,
      });

      const ix = await client.claimAllRewardsInstruction(
        publicKey,
        contentCids
      );

      const tx = new Transaction().add(ix);

      // Simulate transaction before prompting wallet
      console.log("Simulating batch claim transaction...");
      await simulateTransaction(connection, tx, publicKey);
      console.log("Simulation successful, sending to wallet...");

      const signature = await sendTransaction(tx, connection);
      console.log("Batch claim tx sent:", signature);
      await connection.confirmTransaction(signature, "confirmed");
      console.log("Batch claim confirmed!");
      return signature;
    },
    onSuccess: () => {
      // Invalidate all content reward pools and wallet states
      queryClient.invalidateQueries({ queryKey: ["contentRewardPool"] });
      queryClient.invalidateQueries({ queryKey: ["walletContentState"] });
      queryClient.invalidateQueries({ queryKey: ["pendingRewards"] });
    },
  });

  // Fetch mint config for a specific content
  const useMintConfig = (contentCid: string | null) => {
    return useQuery({
      queryKey: ["mintConfig", contentCid],
      queryFn: () => contentCid ? client.fetchMintConfig(contentCid) : null,
      enabled: !!contentCid,
      staleTime: 60000, // Cache for 60 seconds
    });
  };

  // Fetch content reward pool
  const useContentRewardPool = (contentCid: string | null) => {
    return useQuery({
      queryKey: ["contentRewardPool", contentCid],
      queryFn: () => contentCid ? client.fetchContentRewardPool(contentCid) : null,
      enabled: !!contentCid,
      staleTime: 30000, // Cache for 30 seconds
    });
  };

  // Fetch wallet content state (user's position in a specific content)
  const useWalletContentState = (contentCid: string | null) => {
    return useQuery({
      queryKey: ["walletContentState", publicKey?.toBase58(), contentCid],
      queryFn: () => publicKey && contentCid ? client.fetchWalletContentState(publicKey, contentCid) : null,
      enabled: !!publicKey && !!contentCid,
      staleTime: 30000, // Cache for 30 seconds
    });
  };

  // Fetch ALL NFTs owned by wallet ONCE (batch query)
  const walletNftsQuery = useQuery({
    queryKey: ["walletNfts", publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey) return [];
      // Fetch all NFT metadata for wallet once
      return client.fetchWalletNftMetadata(publicKey);
    },
    enabled: !!publicKey,
    staleTime: 60000, // Cache for 60 seconds
  });

  // Per-content pending reward info
  interface ContentPendingReward {
    contentCid: string;
    pending: bigint;
    nftCount: bigint;
  }

  // Get wallet NFTs data (may be undefined while loading)
  const walletNfts = walletNftsQuery.data || [];

  // Fetch pending rewards for ALL user's content positions (per-content pools)
  // This query depends on walletNftsQuery being loaded first to know which content the user owns NFTs for
  const pendingRewardsQuery = useQuery({
    queryKey: ["pendingRewards", publicKey?.toBase58(), walletNftsQuery.dataUpdatedAt],
    queryFn: async (): Promise<ContentPendingReward[]> => {
      if (!publicKey) return [];

      // Get unique content CIDs the user has NFTs for
      const nfts = walletNftsQuery.data || [];
      const contentCids = [...new Set(
        nfts
          .map(nft => nft.contentCid)
          .filter((cid): cid is string => cid !== null)
      )];

      if (contentCids.length === 0) return [];

      // Use the SDK function to get pending rewards for each content
      return client.getPendingRewardsForWallet(publicKey, contentCids);
    },
    enabled: walletNftsQuery.isSuccess && walletNfts.length > 0 && !!publicKey,
    staleTime: 30000,
  });

  // Helper to get all pending rewards
  const usePendingRewards = () => pendingRewardsQuery;

  // Helper to get pending reward for a specific content
  const getPendingRewardForContent = (contentCid: string | null): ContentPendingReward | null => {
    if (!contentCid || !pendingRewardsQuery.data) return null;
    return pendingRewardsQuery.data.find(r => r.contentCid === contentCid) || null;
  };

  // Count NFTs owned for a specific content (uses cached wallet NFTs)
  const useNftOwnership = (contentCid: string | null) => {
    // Filter from cached wallet NFTs instead of making new RPC call
    const count = contentCid
      ? walletNfts.filter(nft => nft.contentCid === contentCid).length
      : 0;

    return {
      data: count,
      isLoading: walletNftsQuery.isLoading,
      refetch: walletNftsQuery.refetch,
    };
  };

  // Count total NFTs minted for a content (on-chain count)
  const useTotalMintedNfts = (contentCid: string | null) => {
    return useQuery({
      queryKey: ["totalMintedNfts", contentCid],
      queryFn: async () => {
        if (!contentCid) return 0;
        return client.countTotalMintedNfts(contentCid);
      },
      enabled: !!contentCid,
      staleTime: 30000, // Cache for 30 seconds
    });
  };

  // Fetch ecosystem config
  const ecosystemConfigQuery = useQuery({
    queryKey: ["ecosystemConfig"],
    queryFn: () => client.fetchEcosystemConfig(),
    staleTime: 300000, // Cache for 5 minutes (rarely changes)
  });

  // Fetch all mintable content (includes mint configs!)
  const mintableContentQuery = useQuery({
    queryKey: ["mintableContent"],
    queryFn: () => client.fetchMintableContent(),
    staleTime: 30000, // Cache for 30 seconds
  });

  return {
    // State
    content: contentQuery.data || [],
    globalContent: globalContentQuery.data || [],
    mintableContent: mintableContentQuery.data || [],
    ecosystemConfig: ecosystemConfigQuery.data,
    isLoadingContent: contentQuery.isLoading,
    isLoadingGlobalContent: globalContentQuery.isLoading,
    isLoadingMintableContent: mintableContentQuery.isLoading,

    // Actions
    registerContent: registerContent.mutateAsync,
    registerContentWithMint: registerContentWithMint.mutateAsync,
    tipContent: tipContent.mutateAsync,
    configureMint: configureMint.mutateAsync,
    updateMintSettings: updateMintSettings.mutateAsync,
    mintNftSol: mintNftSol.mutateAsync,
    updateContent: updateContent.mutateAsync,
    deleteContent: deleteContent.mutateAsync,
    claimContentRewards: claimContentRewards.mutateAsync,
    claimRewardsVerified: claimRewardsVerified.mutateAsync,  // Recommended: verifies NFT ownership
    claimAllRewards: claimAllRewards.mutateAsync,

    // Mutation states
    isRegisteringContent: registerContent.isPending || registerContentWithMint.isPending,
    isTipping: tipContent.isPending,
    isConfiguringMint: configureMint.isPending,
    isUpdatingMintSettings: updateMintSettings.isPending,
    isMintingNft: mintNftSol.isPending,
    isUpdatingContent: updateContent.isPending,
    isDeletingContent: deleteContent.isPending,
    isClaimingReward: claimContentRewards.isPending || claimRewardsVerified.isPending || claimAllRewards.isPending,

    // Hooks for specific data
    useMintConfig,
    useNftOwnership,
    useTotalMintedNfts,
    useContentRewardPool,
    useWalletContentState,
    usePendingRewards,
    getPendingRewardForContent,
    pendingRewardsQuery,

    // Utilities
    client,
    getContentPda,
    getCidRegistryPda,
    getEcosystemConfigPda,
    getMintConfigPda,
    getContentRewardPoolPda,
    getWalletContentStatePda,
    getContentCollectionPda,
    calculatePrimarySplit,
    calculatePendingReward,
  };
}
