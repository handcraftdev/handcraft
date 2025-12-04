"use client";

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
  MintConfig,
  EcosystemConfig,
  calculatePrimarySplit,
  MIN_CREATOR_ROYALTY_BPS,
  MAX_CREATOR_ROYALTY_BPS,
  MIN_PRICE_LAMPORTS,
  MIN_PRICE_USDC,
} from "@handcraft/sdk";

export {
  ContentType,
  PaymentCurrency,
  MIN_CREATOR_ROYALTY_BPS,
  MAX_CREATOR_ROYALTY_BPS,
  MIN_PRICE_LAMPORTS,
  MIN_PRICE_USDC,
};
export type { MintConfig, EcosystemConfig };

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

  const client = createContentRegistryClient(connection);

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

  // Register content with NFT mint config in one transaction
  const registerContentWithMint = useMutation({
    mutationFn: async ({
      contentCid,
      metadataCid,
      contentType,
      price,
      currency,
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
      currency: PaymentCurrency;
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
        currency,
        maxSupply,
        creatorRoyaltyBps,
        isEncrypted,
        previewCid,
        encryptionMetaCid,
      });

      const ix = await client.registerContentWithMintInstruction(
        publicKey,
        contentCid,
        metadataCid,
        contentType,
        price,
        currency,
        maxSupply,
        creatorRoyaltyBps,
        isEncrypted,
        previewCid,
        encryptionMetaCid
      );

      const tx = new Transaction().add(ix);

      // Simulate transaction before prompting wallet
      console.log("Simulating transaction...");
      await simulateTransaction(connection, tx, publicKey);
      console.log("Simulation successful, sending to wallet...");

      const signature = await sendTransaction(tx, connection);
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

  // Configure mint mutation
  const configureMint = useMutation({
    mutationFn: async ({
      contentCid,
      price,
      currency,
      maxSupply,
      creatorRoyaltyBps,
    }: {
      contentCid: string;
      price: bigint;
      currency: PaymentCurrency;
      maxSupply: bigint | null;
      creatorRoyaltyBps: number;
    }) => {
      if (!publicKey) throw new Error("Wallet not connected");

      console.log("Configuring mint...", { contentCid, price, currency, maxSupply, creatorRoyaltyBps });

      const ix = await client.configureMintInstruction(
        publicKey,
        contentCid,
        price,
        currency,
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

      // mintNftSolInstruction returns { instruction, nftAssetKeypair }
      // The nftAssetKeypair MUST be added as a signer to the transaction
      const { instruction, nftAssetKeypair } = await client.mintNftSolInstruction(
        publicKey,
        contentCid,
        creator,
        treasury,
        platform
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

  // Fetch mint config for a specific content
  const useMintConfig = (contentCid: string | null) => {
    return useQuery({
      queryKey: ["mintConfig", contentCid],
      queryFn: () => contentCid ? client.fetchMintConfig(contentCid) : null,
      enabled: !!contentCid,
      staleTime: 60000, // Cache for 60 seconds
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

  // Count NFTs owned for a specific content (uses cached wallet NFTs)
  const useNftOwnership = (contentCid: string | null) => {
    const walletNfts = walletNftsQuery.data || [];

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

    // Mutation states
    isRegisteringContent: registerContent.isPending || registerContentWithMint.isPending,
    isTipping: tipContent.isPending,
    isConfiguringMint: configureMint.isPending,
    isUpdatingMintSettings: updateMintSettings.isPending,
    isMintingNft: mintNftSol.isPending,
    isUpdatingContent: updateContent.isPending,
    isDeletingContent: deleteContent.isPending,

    // Hooks for specific data
    useMintConfig,
    useNftOwnership,
    useTotalMintedNfts,

    // Utilities
    client,
    getContentPda,
    getCidRegistryPda,
    getEcosystemConfigPda,
    getMintConfigPda,
    calculatePrimarySplit,
  };
}
