"use client";

import { useMemo } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction, PublicKey } from "@solana/web3.js";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createContentRegistryClient,
  ContentType,
  PaymentCurrency,
  RentTier,
  Rarity,
  getRarityName,
  getRarityWeight,
  getContentPda,
  getCidRegistryPda,
  getEcosystemConfigPda,
  getMintConfigPda,
  getContentRewardPoolPda,
  getWalletContentStatePda,
  getContentCollectionPda,
  getRentConfigPda,
  getPendingMintPda,
  getNftRarityPda,
  ContentRewardPool,
  WalletContentState,
  MintConfig,
  EcosystemConfig,
  ContentCollection,
  RentConfig,
  RentEntry,
  ContentEntry,
  PendingMint,
  calculatePrimarySplit,
  calculatePendingReward,
  MIN_CREATOR_ROYALTY_BPS,
  MAX_CREATOR_ROYALTY_BPS,
  MIN_PRICE_LAMPORTS,
  RENT_PERIOD_6H,
  RENT_PERIOD_1D,
  RENT_PERIOD_7D,
  MIN_RENT_FEE_LAMPORTS,
} from "@handcraft/sdk";
import { simulateTransaction, simulatePartiallySignedTransaction } from "@/utils/transaction";

export {
  ContentType,
  PaymentCurrency,
  RentTier,
  Rarity,
  getRarityName,
  getRarityWeight,
  MIN_CREATOR_ROYALTY_BPS,
  MAX_CREATOR_ROYALTY_BPS,
  MIN_PRICE_LAMPORTS,
  RENT_PERIOD_6H,
  RENT_PERIOD_1D,
  RENT_PERIOD_7D,
  MIN_RENT_FEE_LAMPORTS,
};
export type { MintConfig, EcosystemConfig, ContentRewardPool, WalletContentState, ContentCollection, RentConfig, RentEntry, PendingMint };

export function useContentRegistry() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const queryClient = useQueryClient();

  // Memoize client to prevent recreating on every render
  // Only create client on client-side to avoid SSR issues with @solana/web3.js PublicKey._bn
  const client = useMemo(() => {
    if (typeof window === "undefined") return null;
    return createContentRegistryClient(connection);
  }, [connection]);

  // Fetch global content (all creators) - this is the ONLY content fetch
  const globalContentQuery = useQuery({
    queryKey: ["globalContent"],
    queryFn: () => client?.fetchGlobalContent() ?? [],
    enabled: !!client,
    staleTime: 60000, // Cache for 60 seconds
    gcTime: 120000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('429')) return false;
      return failureCount < 2;
    },
  });

  // Derive user's content from globalContent (avoids duplicate RPC call)
  const userContent = useMemo(() => {
    if (!publicKey) return [];
    const allContent = globalContentQuery.data || [];
    return allContent.filter(c => c.creator.equals(publicKey));
  }, [publicKey, globalContentQuery.data]);

  const isLoadingUserContent = globalContentQuery.isLoading;

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
      if (!client) throw new Error("Client not initialized");

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
      platform,
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
      platform: PublicKey;
      isEncrypted?: boolean;
      previewCid?: string;
      encryptionMetaCid?: string;
    }) => {
      if (!publicKey) throw new Error("Wallet not connected");
      if (!client) throw new Error("Client not initialized");

      console.log("Registering content with mint config...", {
        contentCid,
        metadataCid,
        price,
        maxSupply,
        creatorRoyaltyBps,
        platform: platform.toBase58(),
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
        platform,
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
      await simulatePartiallySignedTransaction(connection, tx);
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

  // Register content with mint config AND rent config in a single transaction
  const registerContentWithMintAndRent = useMutation({
    mutationFn: async ({
      contentCid,
      metadataCid,
      contentType,
      price,
      maxSupply,
      creatorRoyaltyBps,
      platform,
      isEncrypted = false,
      previewCid = "",
      encryptionMetaCid = "",
      rentFee6h,
      rentFee1d,
      rentFee7d,
    }: {
      contentCid: string;
      metadataCid: string;
      contentType: ContentType;
      price: bigint;
      maxSupply: bigint | null;
      creatorRoyaltyBps: number;
      platform: PublicKey;
      isEncrypted?: boolean;
      previewCid?: string;
      encryptionMetaCid?: string;
      rentFee6h?: bigint;
      rentFee1d?: bigint;
      rentFee7d?: bigint;
    }) => {
      if (!publicKey) throw new Error("Wallet not connected");
      if (!client) throw new Error("Client not initialized");

      console.log("Registering content with mint + rent config...", {
        contentCid,
        metadataCid,
        price,
        maxSupply,
        creatorRoyaltyBps,
        platform: platform.toBase58(),
        isEncrypted,
        rentFee6h: rentFee6h?.toString(),
        rentFee1d: rentFee1d?.toString(),
        rentFee7d: rentFee7d?.toString(),
      });

      // Get the register content + mint instruction
      const { instruction: registerIx, collectionAssetKeypair } = await client.registerContentWithMintInstruction(
        publicKey,
        contentCid,
        metadataCid,
        contentType,
        price,
        maxSupply,
        creatorRoyaltyBps,
        platform,
        isEncrypted,
        previewCid,
        encryptionMetaCid
      );

      console.log("Collection Asset pubkey:", collectionAssetKeypair.publicKey.toBase58());

      // Build transaction with register + mint instruction
      const tx = new Transaction().add(registerIx);

      // If rent fees are provided, add the configure rent instruction to the same transaction
      if (rentFee6h !== undefined && rentFee1d !== undefined && rentFee7d !== undefined) {
        console.log("Adding configure rent instruction to transaction...");
        const rentIx = await client.configureRentInstruction(
          publicKey,
          contentCid,
          rentFee6h,
          rentFee1d,
          rentFee7d
        );
        tx.add(rentIx);
      }

      // Set up the transaction
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      // Sign with the collection asset keypair
      tx.partialSign(collectionAssetKeypair);

      // Simulate transaction before prompting wallet
      console.log("Simulating combined transaction...");
      await simulatePartiallySignedTransaction(connection, tx);
      console.log("Simulation successful, sending to wallet...");

      // Send transaction
      const signature = await sendTransaction(tx, connection, {
        signers: [collectionAssetKeypair],
      });
      console.log("Content + mint + rent registration tx sent:", signature);
      await connection.confirmTransaction(signature, "confirmed");
      console.log("Content + mint + rent registration confirmed!");
      return signature;
    },
    onSuccess: (_, { contentCid }) => {
      console.log("Invalidating queries after content + mint + rent registration");
      queryClient.invalidateQueries({ queryKey: ["content", publicKey?.toBase58()] });
      queryClient.invalidateQueries({ queryKey: ["globalContent"] });
      queryClient.invalidateQueries({ queryKey: ["mintableContent"] });
      queryClient.invalidateQueries({ queryKey: ["rentConfig", contentCid] });
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
      if (!client) throw new Error("Client not initialized");

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
      if (!client) throw new Error("Client not initialized");

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
      queryClient.invalidateQueries({ queryKey: ["allMintConfigs"] });
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
      if (!client) throw new Error("Client not initialized");

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
      queryClient.invalidateQueries({ queryKey: ["allMintConfigs"] });
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
      if (!client) throw new Error("Client not initialized");

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
      await simulatePartiallySignedTransaction(connection, tx);
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
      queryClient.invalidateQueries({ queryKey: ["allMintConfigs"] });
      queryClient.invalidateQueries({ queryKey: ["mintableContent"] });
      queryClient.invalidateQueries({ queryKey: ["contentRewardPool", contentCid] });
      queryClient.invalidateQueries({ queryKey: ["walletContentState"] });
      queryClient.invalidateQueries({ queryKey: ["pendingRewards"] });
    },
  });

  // Commit mint with VRF randomness - Step 1 of two-step flow
  // Takes payment and commits to a future slot for randomness determination
  // Returns the randomness account pubkey needed for step 2
  const commitMint = useMutation({
    mutationFn: async ({
      contentCid,
      creator,
      treasury,
      platform,
      randomnessAccount,
    }: {
      contentCid: string;
      creator: PublicKey;
      treasury: PublicKey;
      platform: PublicKey;
      randomnessAccount: PublicKey;
    }) => {
      if (!publicKey) throw new Error("Wallet not connected");
      if (!client) throw new Error("Client not initialized");

      console.log("Committing mint with VRF...", {
        contentCid,
        creator: creator.toBase58(),
        treasury: treasury.toBase58(),
        platform: platform.toBase58(),
        randomnessAccount: randomnessAccount.toBase58(),
        buyer: publicKey.toBase58(),
      });

      const commitIx = await client.commitMintInstruction(
        publicKey,
        contentCid,
        creator,
        treasury,
        platform,
        randomnessAccount
      );

      const tx = new Transaction().add(commitIx);

      // Simulate transaction before prompting wallet
      console.log("Simulating commit transaction...");
      await simulateTransaction(connection, tx, publicKey);
      console.log("Simulation successful, sending to wallet...");

      const signature = await sendTransaction(tx, connection);
      console.log("Commit mint tx sent:", signature);
      await connection.confirmTransaction(signature, "confirmed");
      console.log("Commit mint confirmed!");
      return { signature, randomnessAccount };
    },
    onSuccess: (_, { contentCid }) => {
      queryClient.invalidateQueries({ queryKey: ["globalContent"] });
      queryClient.invalidateQueries({ queryKey: ["mintConfig", contentCid] });
    },
  });

  // Reveal mint with VRF randomness - Step 2 of two-step flow
  // Called after the committed slot has passed and VRF randomness is available
  // Creates the NFT with randomized rarity
  const revealMint = useMutation({
    mutationFn: async ({
      contentCid,
      creator,
      randomnessAccount,
      treasury,
      platform,
    }: {
      contentCid: string;
      creator: PublicKey;
      randomnessAccount: PublicKey;
      treasury: PublicKey;
      platform?: PublicKey;
    }): Promise<{ signature: string; nftAsset: PublicKey; rarity?: Rarity }> => {
      if (!publicKey) throw new Error("Wallet not connected");
      if (!client) throw new Error("Client not initialized");

      console.log("Revealing mint with VRF...", {
        contentCid,
        creator: creator.toBase58(),
        randomnessAccount: randomnessAccount.toBase58(),
        buyer: publicKey.toBase58(),
      });

      // Fetch the content collection to get the collection asset address
      const contentCollection = await client.fetchContentCollection(contentCid);
      if (!contentCollection) {
        throw new Error("Content collection not found. Make sure the content was registered with mint config.");
      }

      console.log("Collection Asset:", contentCollection.collectionAsset.toBase58());

      const { instruction, nftAssetKeypair } = await client.revealMintInstruction(
        publicKey,
        contentCid,
        creator,
        contentCollection.collectionAsset,
        randomnessAccount,
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
      console.log("Simulating reveal transaction...");
      await simulatePartiallySignedTransaction(connection, tx);
      console.log("Simulation successful, sending to wallet...");

      // Send transaction with the NFT keypair as additional signer
      const signature = await sendTransaction(tx, connection, {
        signers: [nftAssetKeypair],
      });
      console.log("Reveal mint tx sent:", signature);
      await connection.confirmTransaction(signature, "confirmed");
      console.log("Reveal mint confirmed!");

      return { signature, nftAsset: nftAssetKeypair.publicKey };
    },
    onSuccess: (_, { contentCid }) => {
      queryClient.invalidateQueries({ queryKey: ["globalContent"] });
      queryClient.invalidateQueries({ queryKey: ["mintConfig", contentCid] });
      queryClient.invalidateQueries({ queryKey: ["allMintConfigs"] });
      queryClient.invalidateQueries({ queryKey: ["mintableContent"] });
      queryClient.invalidateQueries({ queryKey: ["contentRewardPool", contentCid] });
      queryClient.invalidateQueries({ queryKey: ["walletContentState"] });
      queryClient.invalidateQueries({ queryKey: ["pendingRewards"] });
      queryClient.invalidateQueries({ queryKey: ["walletNfts"] });
    },
  });

  // Cancel an expired pending mint and get refund
  // Can only be called after 10 minutes if the oracle failed to provide randomness
  const cancelExpiredMint = useMutation({
    mutationFn: async ({
      contentCid,
    }: {
      contentCid: string;
    }): Promise<{ signature: string }> => {
      if (!publicKey) throw new Error("Wallet not connected");
      if (!client) throw new Error("Client not initialized");

      console.log("Cancelling expired mint...", { contentCid, buyer: publicKey.toBase58() });

      const instruction = await client.cancelExpiredMintInstruction(publicKey, contentCid);

      const tx = new Transaction().add(instruction);

      // Simulate transaction before prompting wallet
      console.log("Simulating cancel transaction...");
      await simulateTransaction(connection, tx, publicKey);
      console.log("Simulation successful, sending to wallet...");

      const signature = await sendTransaction(tx, connection);
      console.log("Cancel expired mint tx sent:", signature);
      await connection.confirmTransaction(signature, "confirmed");
      console.log("Cancel expired mint confirmed! Refund processed.");

      return { signature };
    },
    onSuccess: (_, { contentCid }) => {
      queryClient.invalidateQueries({ queryKey: ["globalContent"] });
      queryClient.invalidateQueries({ queryKey: ["mintConfig", contentCid] });
      queryClient.invalidateQueries({ queryKey: ["allMintConfigs"] });
      queryClient.invalidateQueries({ queryKey: ["mintableContent"] });
      queryClient.invalidateQueries({ queryKey: ["pendingMint", publicKey?.toBase58(), contentCid] });
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
      if (!client) throw new Error("Client not initialized");

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
      if (!client) throw new Error("Client not initialized");

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
      if (!client) throw new Error("Client not initialized");

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
      if (!client) throw new Error("Client not initialized");

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
  // Uses verified claims with per-NFT tracking
  const claimAllRewards = useMutation({
    mutationFn: async ({
      contentCids,
    }: {
      contentCids: string[];
    }) => {
      if (!publicKey) throw new Error("Wallet not connected");
      if (!client) throw new Error("Client not initialized");
      if (contentCids.length === 0) throw new Error("No content to claim from");

      console.log("Claiming all rewards (verified)...", {
        contentCids,
        count: contentCids.length,
      });

      const tx = new Transaction();

      // Build verified claim instructions for each content
      for (const contentCid of contentCids) {
        const contentCollection = await client.fetchContentCollection(contentCid);
        if (!contentCollection) {
          console.warn(`Skipping ${contentCid}: collection not found`);
          continue;
        }

        const nftAssets = await client.fetchWalletNftsForCollection(
          publicKey,
          contentCollection.collectionAsset
        );

        if (nftAssets.length === 0) {
          console.warn(`Skipping ${contentCid}: no NFTs owned`);
          continue;
        }

        console.log(`Adding claim for ${contentCid} with ${nftAssets.length} NFTs`);
        const ix = await client.claimRewardsVerifiedInstruction(
          publicKey,
          contentCid,
          nftAssets
        );
        tx.add(ix);
      }

      if (tx.instructions.length === 0) {
        throw new Error("No valid claims to process");
      }

      // Simulate transaction before prompting wallet
      console.log(`Simulating batch claim transaction (${tx.instructions.length} instructions)...`);
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

  // Configure rent for content with 3-tier pricing (creator only)
  const configureRent = useMutation({
    mutationFn: async ({
      contentCid,
      rentFee6h,
      rentFee1d,
      rentFee7d,
    }: {
      contentCid: string;
      rentFee6h: bigint;
      rentFee1d: bigint;
      rentFee7d: bigint;
    }) => {
      if (!publicKey) throw new Error("Wallet not connected");
      if (!client) throw new Error("Client not initialized");

      console.log("Configuring rent...", { contentCid, rentFee6h, rentFee1d, rentFee7d });

      const ix = await client.configureRentInstruction(
        publicKey,
        contentCid,
        rentFee6h,
        rentFee1d,
        rentFee7d
      );

      const tx = new Transaction().add(ix);

      console.log("Simulating transaction...");
      await simulateTransaction(connection, tx, publicKey);
      console.log("Simulation successful, sending to wallet...");

      const signature = await sendTransaction(tx, connection);
      console.log("Configure rent tx sent:", signature);
      await connection.confirmTransaction(signature, "confirmed");
      console.log("Configure rent confirmed!");

      // Check if transaction actually succeeded
      const txResult = await connection.getTransaction(signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      console.log("Transaction result:", txResult?.meta?.err);
      if (txResult?.meta?.err) {
        console.error("Transaction failed with error:", txResult.meta.err);
        console.error("Transaction logs:", txResult.meta.logMessages);
        throw new Error(`Transaction failed: ${JSON.stringify(txResult.meta.err)}`);
      }

      // Debug: Check if account was created
      console.log("Checking if RentConfig account was created...");
      const rentConfig = await client.fetchRentConfig(contentCid);
      console.log("RentConfig immediately after tx:", rentConfig);

      return signature;
    },
    onSuccess: (_, { contentCid }) => {
      queryClient.invalidateQueries({ queryKey: ["rentConfig", contentCid] });
      queryClient.invalidateQueries({ queryKey: ["allRentConfigs"] });
    },
  });

  // Update rent config with 3-tier pricing (creator only)
  const updateRentConfig = useMutation({
    mutationFn: async ({
      contentCid,
      rentFee6h,
      rentFee1d,
      rentFee7d,
      isActive,
    }: {
      contentCid: string;
      rentFee6h: bigint | null;
      rentFee1d: bigint | null;
      rentFee7d: bigint | null;
      isActive: boolean | null;
    }) => {
      if (!publicKey) throw new Error("Wallet not connected");
      if (!client) throw new Error("Client not initialized");

      console.log("Updating rent config...", { contentCid, rentFee6h, rentFee1d, rentFee7d, isActive });

      const ix = await client.updateRentConfigInstruction(
        publicKey,
        contentCid,
        rentFee6h,
        rentFee1d,
        rentFee7d,
        isActive
      );

      const tx = new Transaction().add(ix);

      console.log("Simulating transaction...");
      await simulateTransaction(connection, tx, publicKey);
      console.log("Simulation successful, sending to wallet...");

      const signature = await sendTransaction(tx, connection);
      console.log("Update rent config tx sent:", signature);
      await connection.confirmTransaction(signature, "confirmed");
      console.log("Update rent config confirmed!");
      return signature;
    },
    onSuccess: (_, { contentCid }) => {
      queryClient.invalidateQueries({ queryKey: ["rentConfig", contentCid] });
      queryClient.invalidateQueries({ queryKey: ["allRentConfigs"] });
    },
  });

  // Rent content with SOL (select tier: 6h, 1d, or 7d)
  const rentContentSol = useMutation({
    mutationFn: async ({
      contentCid,
      creator,
      treasury,
      platform,
      tier,
    }: {
      contentCid: string;
      creator: PublicKey;
      treasury: PublicKey;
      platform: PublicKey;
      tier: RentTier;
    }) => {
      if (!publicKey) throw new Error("Wallet not connected");
      if (!client) throw new Error("Client not initialized");

      console.log("Renting content...", {
        contentCid,
        creator: creator.toBase58(),
        treasury: treasury.toBase58(),
        platform: platform.toBase58(),
        renter: publicKey.toBase58(),
        tier,
      });

      // Fetch the content collection to get the collection asset address
      const contentCollection = await client.fetchContentCollection(contentCid);
      if (!contentCollection) {
        throw new Error("Content collection not found.");
      }

      console.log("Collection Asset:", contentCollection.collectionAsset.toBase58());

      const { instruction, nftAssetKeypair } = await client.rentContentSolInstruction(
        publicKey,
        contentCid,
        creator,
        treasury,
        platform,
        contentCollection.collectionAsset,
        tier
      );

      console.log("Rental NFT Asset pubkey:", nftAssetKeypair.publicKey.toBase58());

      const tx = new Transaction().add(instruction);

      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      tx.partialSign(nftAssetKeypair);

      console.log("Simulating transaction...");
      await simulatePartiallySignedTransaction(connection, tx);
      console.log("Simulation successful, sending to wallet...");

      const signature = await sendTransaction(tx, connection, {
        signers: [nftAssetKeypair],
      });
      console.log("Rent content tx sent:", signature);
      await connection.confirmTransaction(signature, "confirmed");
      console.log("Rent content confirmed!");
      return { signature, nftAsset: nftAssetKeypair.publicKey };
    },
    onSuccess: (_, { contentCid }) => {
      queryClient.invalidateQueries({ queryKey: ["rentConfig", contentCid] });
      queryClient.invalidateQueries({ queryKey: ["allRentConfigs"] });
      queryClient.invalidateQueries({ queryKey: ["walletRentals"] });
      queryClient.invalidateQueries({ queryKey: ["contentRewardPool", contentCid] });
    },
  });

  // Burn NFT mutation - burns with proper reward state cleanup
  // Decrements totalWeight/totalNfts and closes NftRewardState (refunds rent)
  const burnNft = useMutation({
    mutationFn: async ({
      nftAsset,
      collectionAsset,
      contentCid,
    }: {
      nftAsset: PublicKey;
      collectionAsset: PublicKey;
      contentCid: string;
    }) => {
      if (!publicKey) throw new Error("Wallet not connected");
      if (!client) throw new Error("Client not initialized");

      console.log("Burning NFT with reward cleanup...", {
        nftAsset: nftAsset.toBase58(),
        collectionAsset: collectionAsset.toBase58(),
        contentCid,
        owner: publicKey.toBase58(),
      });

      const ix = await client.burnNftInstruction(publicKey, nftAsset, collectionAsset, contentCid);
      const tx = new Transaction().add(ix);

      console.log("Simulating burn transaction...");
      await simulateTransaction(connection, tx, publicKey);
      console.log("Simulation successful, sending to wallet...");

      const signature = await sendTransaction(tx, connection);
      console.log("Burn NFT tx sent:", signature);
      await connection.confirmTransaction(signature, "confirmed");
      console.log("Burn NFT confirmed!");
      return signature;
    },
    onSuccess: (_, { contentCid }) => {
      queryClient.invalidateQueries({ queryKey: ["walletNfts"] });
      queryClient.invalidateQueries({ queryKey: ["profileNfts"] });
      queryClient.invalidateQueries({ queryKey: ["pendingRewards"] });
      queryClient.invalidateQueries({ queryKey: ["globalContent"] });
      queryClient.invalidateQueries({ queryKey: ["contentRewardPool", contentCid] });
    },
  });

  // Batch fetch ALL mint configs in one RPC call (much more efficient)
  const allMintConfigsQuery = useQuery({
    queryKey: ["allMintConfigs"],
    queryFn: async () => {
      if (!client) return new Map<string, MintConfig>();
      return client.fetchAllMintConfigs();
    },
    enabled: !!client,
    staleTime: 60000, // Cache for 60 seconds
    gcTime: 300000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('429')) return false;
      return failureCount < 2;
    },
  });

  // Batch fetch ALL rent configs in one RPC call (much more efficient)
  const allRentConfigsQuery = useQuery({
    queryKey: ["allRentConfigs"],
    queryFn: async () => {
      if (!client) return new Map<string, RentConfig>();
      return client.fetchAllRentConfigs();
    },
    enabled: !!client,
    staleTime: 60000, // Cache for 60 seconds
    gcTime: 300000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('429')) return false;
      return failureCount < 2;
    },
  });

  // Batch fetch ALL content collections in one RPC call
  const allContentCollectionsQuery = useQuery({
    queryKey: ["allContentCollections"],
    queryFn: async () => {
      if (!client) return new Map<string, ContentCollection>();
      return client.fetchAllContentCollections();
    },
    enabled: !!client,
    staleTime: 60000,
    gcTime: 300000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('429')) return false;
      return failureCount < 2;
    },
  });

  // Batch fetch ALL content reward pools in one RPC call
  const allRewardPoolsQuery = useQuery({
    queryKey: ["allRewardPools"],
    queryFn: async () => {
      if (!client) return new Map<string, ContentRewardPool>();
      return client.fetchAllContentRewardPools();
    },
    enabled: !!client,
    staleTime: 60000,
    gcTime: 300000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('429')) return false;
      return failureCount < 2;
    },
  });

  // Fetch mint config for a specific content - uses batch data if available
  const useMintConfig = (contentCid: string | null) => {
    return useQuery({
      queryKey: ["mintConfig", contentCid],
      queryFn: async () => {
        if (!contentCid || !client) return null;
        // First check batch data
        const allConfigs = allMintConfigsQuery.data;
        if (allConfigs && allConfigs.size > 0) {
          const [contentPda] = getContentPda(contentCid);
          return allConfigs.get(contentPda.toBase58()) || null;
        }
        // Fallback to individual fetch if batch not loaded
        return client.fetchMintConfig(contentCid);
      },
      enabled: !!contentCid && !!client,
      staleTime: 60000, // Cache for 60 seconds
      gcTime: 120000,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof Error && error.message.includes('429')) return false;
        return failureCount < 2;
      },
    });
  };

  // Fetch rent config for a specific content - uses batch data if available
  const useRentConfig = (contentCid: string | null) => {
    return useQuery({
      queryKey: ["rentConfig", contentCid],
      queryFn: async () => {
        if (!contentCid || !client) return null;
        // First check batch data
        const allConfigs = allRentConfigsQuery.data;
        if (allConfigs && allConfigs.size > 0) {
          const [contentPda] = getContentPda(contentCid);
          return allConfigs.get(contentPda.toBase58()) || null;
        }
        // Fallback to individual fetch if batch not loaded
        return client.fetchRentConfig(contentCid);
      },
      enabled: !!contentCid && !!client,
      staleTime: 60000, // Cache for 60 seconds
      gcTime: 120000,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof Error && error.message.includes('429')) return false;
        return failureCount < 2;
      },
    });
  };

  // Check rental access for a specific NFT
  const checkRentalAccess = async (nftAsset: PublicKey) => {
    if (!client) throw new Error("Client not initialized");
    return client.checkRentalAccess(nftAsset);
  };

  // Fetch content reward pool
  const useContentRewardPool = (contentCid: string | null) => {
    return useQuery({
      queryKey: ["contentRewardPool", contentCid],
      queryFn: () => contentCid && client ? client.fetchContentRewardPool(contentCid) : null,
      enabled: !!contentCid && !!client,
      staleTime: 60000, // Cache for 60 seconds
      gcTime: 120000,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof Error && error.message.includes('429')) return false;
        return failureCount < 2;
      },
    });
  };

  // Fetch wallet content state (user's position in a specific content)
  const useWalletContentState = (contentCid: string | null) => {
    return useQuery({
      queryKey: ["walletContentState", publicKey?.toBase58(), contentCid],
      queryFn: () => publicKey && contentCid && client ? client.fetchWalletContentState(publicKey, contentCid) : null,
      enabled: !!publicKey && !!contentCid && !!client,
      staleTime: 60000, // Cache for 60 seconds
      gcTime: 120000,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof Error && error.message.includes('429')) return false;
        return failureCount < 2;
      },
    });
  };

  // Fetch ALL NFTs owned by wallet ONCE (batch query)
  // This uses getProgramAccounts which is expensive - cache aggressively to avoid 429 rate limits
  const walletNftsQuery = useQuery({
    queryKey: ["walletNfts", publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey || !client) return [];
      // Fetch all NFT metadata for wallet once
      return client.fetchWalletNftMetadata(publicKey);
    },
    enabled: !!publicKey && !!client,
    staleTime: 300000, // Cache for 5 minutes (expensive query)
    gcTime: 600000, // Keep in cache for 10 minutes
    refetchOnMount: false, // Don't refetch on component remount (Fast Refresh)
    refetchOnWindowFocus: false, // Don't refetch on tab focus
    refetchOnReconnect: false, // Don't refetch on reconnect
    retry: (failureCount, error) => {
      // Don't retry on 429 rate limit errors
      if (error instanceof Error && error.message.includes('429')) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Fetch rental NFT assets for the wallet (to exclude from ownership count)
  // Uses optimized function that reuses pre-fetched NFT data instead of re-fetching
  const walletRentalNftsQuery = useQuery({
    queryKey: ["walletRentalNfts", publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey || !client) return new Set<string>();
      // Use the optimized version that accepts pre-fetched NFT metadata
      // This avoids a redundant fetchWalletNftMetadata call and uses batch fetching
      const nftMetadata = walletNftsQuery.data || [];
      return client.fetchRentalNftsFromMetadata(nftMetadata);
    },
    enabled: !!publicKey && !!client && walletNftsQuery.isSuccess && (walletNftsQuery.data?.length ?? 0) > 0,
    staleTime: 300000, // Cache for 5 minutes
    gcTime: 600000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('429')) return false;
      return failureCount < 2;
    },
  });

  // Set of rental NFT asset addresses
  const rentalNftAssets = walletRentalNftsQuery.data || new Set<string>();

  // Fetch rarities for all wallet NFTs (batch query)
  // Uses the batch fetch function to get rarities in a single RPC call
  const walletNftRaritiesQuery = useQuery({
    queryKey: ["walletNftRarities", publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey || !client) return new Map<string, Rarity>();
      const nfts = walletNftsQuery.data || [];
      if (nfts.length === 0) return new Map<string, Rarity>();

      const nftAssets = nfts.map(nft => nft.nftAsset);
      const rarities = await client.fetchNftRaritiesBatch(nftAssets);

      // Convert to Map<nftAsset string, Rarity>
      const result = new Map<string, Rarity>();
      for (const [key, nftRarity] of rarities) {
        result.set(key, nftRarity.rarity);
      }
      return result;
    },
    enabled: !!publicKey && !!client && walletNftsQuery.isSuccess && (walletNftsQuery.data?.length ?? 0) > 0,
    staleTime: 300000, // Cache for 5 minutes
    gcTime: 600000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('429')) return false;
      return failureCount < 2;
    },
  });

  // Map of NFT asset address -> Rarity
  const nftRarities = walletNftRaritiesQuery.data || new Map<string, Rarity>();

  // Per-NFT pending reward info
  interface NftPendingReward {
    nftAsset: { toBase58(): string };
    pending: bigint;
    rewardDebt: bigint;
  }

  // Per-content pending reward info with NFT details
  interface ContentPendingReward {
    contentCid: string;
    pending: bigint;
    nftCount: bigint;
    nftRewards: NftPendingReward[];
  }

  // Get wallet NFTs data (may be undefined while loading), excluding rental NFTs
  const walletNfts = (walletNftsQuery.data || []).filter(
    nft => !rentalNftAssets.has(nft.nftAsset.toBase58())
  );

  // Fetch pending rewards for ALL user's content positions (per-content pools)
  // Uses optimized batch fetching - only 1 RPC call for NFT reward states instead of N*M calls
  // Excludes rental NFTs since they don't earn rewards
  const pendingRewardsQuery = useQuery({
    queryKey: ["pendingRewards", publicKey?.toBase58()],
    queryFn: async (): Promise<ContentPendingReward[]> => {
      if (!publicKey || !client) return [];

      // Use filtered walletNfts that excludes rental NFTs
      // Rental NFTs don't accumulate rewards
      const nfts = walletNfts;
      if (nfts.length === 0) return [];

      // Use pre-fetched batch data for reward pools and collections
      const rewardPools = allRewardPoolsQuery.data || new Map();
      const collections = allContentCollectionsQuery.data || new Map();

      // Use optimized function that accepts pre-fetched data
      // This reduces N*M individual calls to just 1 batch call
      return client.getPendingRewardsOptimized(publicKey, nfts, rewardPools, collections);
    },
    enabled: walletNftsQuery.isSuccess &&
             walletRentalNftsQuery.isSuccess &&
             walletNfts.length > 0 &&
             !!publicKey &&
             !!client &&
             allRewardPoolsQuery.isSuccess &&
             allContentCollectionsQuery.isSuccess,
    staleTime: 120000, // Cache for 2 minutes
    gcTime: 300000, // Keep in cache for 5 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('429')) return false;
      return failureCount < 2;
    },
  });

  // Helper to get all pending rewards
  const usePendingRewards = () => pendingRewardsQuery;

  // Helper to get pending reward for a specific content
  const getPendingRewardForContent = (contentCid: string | null): ContentPendingReward | null => {
    if (!contentCid || !pendingRewardsQuery.data) return null;
    return pendingRewardsQuery.data.find(r => r.contentCid === contentCid) || null;
  };

  // Count NFTs owned for a specific content (uses cached wallet NFTs, excludes rental NFTs)
  const useNftOwnership = (contentCid: string | null) => {
    // Filter from cached wallet NFTs instead of making new RPC call
    const count = contentCid
      ? walletNfts.filter(nft => nft.contentCid === contentCid).length
      : 0;

    return {
      data: count,
      isLoading: walletNftsQuery.isLoading || walletRentalNftsQuery.isLoading,
      refetch: () => {
        walletNftsQuery.refetch();
        walletRentalNftsQuery.refetch();
      },
    };
  };

  // Fetch active rental for a specific content
  const useActiveRental = (contentCid: string | null) => {
    return useQuery({
      queryKey: ["activeRental", publicKey?.toBase58(), contentCid],
      queryFn: async (): Promise<RentEntry | null> => {
        if (!publicKey || !contentCid || !client) return null;
        return client.fetchActiveRentalForContent(publicKey, contentCid);
      },
      enabled: !!publicKey && !!contentCid && !!client,
      staleTime: 60000, // Cache for 1 minute
      gcTime: 120000,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof Error && error.message.includes('429')) return false;
        return failureCount < 2;
      },
    });
  };

  // Count total NFTs minted for a content (on-chain count)
  const useTotalMintedNfts = (contentCid: string | null) => {
    return useQuery({
      queryKey: ["totalMintedNfts", contentCid],
      queryFn: async () => {
        if (!contentCid || !client) return 0;
        return client.countTotalMintedNfts(contentCid);
      },
      enabled: !!contentCid && !!client,
      staleTime: 60000, // Cache for 60 seconds
      gcTime: 120000,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof Error && error.message.includes('429')) return false;
        return failureCount < 2;
      },
    });
  };

  // Fetch ecosystem config
  const ecosystemConfigQuery = useQuery({
    queryKey: ["ecosystemConfig"],
    queryFn: () => client?.fetchEcosystemConfig() ?? null,
    enabled: !!client,
    staleTime: 300000, // Cache for 5 minutes (rarely changes)
    gcTime: 600000, // Keep in cache for 10 minutes
    refetchOnMount: false, // Don't refetch on Fast Refresh
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      // Don't retry on 429 rate limit errors
      if (error instanceof Error && error.message.includes('429')) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Derive mintable content from already-cached globalContent + allMintConfigs
  // This avoids duplicate RPC calls by reusing data from other queries
  const mintableContent = useMemo(() => {
    const content = globalContentQuery.data || [];
    const mintConfigs = allMintConfigsQuery.data;

    if (!mintConfigs || mintConfigs.size === 0) return [];

    const results: Array<{ content: ContentEntry; mintConfig: MintConfig }> = [];

    for (const item of content) {
      const [contentPda] = getContentPda(item.contentCid);
      const mintConfig = mintConfigs.get(contentPda.toBase58());
      if (mintConfig && mintConfig.isActive) {
        results.push({ content: item, mintConfig });
      }
    }

    return results;
  }, [globalContentQuery.data, allMintConfigsQuery.data]);

  const isLoadingMintableContent = globalContentQuery.isLoading || allMintConfigsQuery.isLoading;

  return {
    // State
    content: userContent, // Derived from cached globalContent
    globalContent: globalContentQuery.data || [],
    mintableContent, // Derived from cached globalContent + allMintConfigs
    ecosystemConfig: ecosystemConfigQuery.data,
    isLoadingContent: isLoadingUserContent,
    isLoadingGlobalContent: globalContentQuery.isLoading,
    isLoadingMintableContent,
    isLoadingEcosystemConfig: ecosystemConfigQuery.isLoading,
    ecosystemConfigError: ecosystemConfigQuery.error,
    isEcosystemConfigError: ecosystemConfigQuery.isError,
    refetchEcosystemConfig: ecosystemConfigQuery.refetch,

    // Actions
    registerContent: registerContent.mutateAsync,
    registerContentWithMint: registerContentWithMint.mutateAsync,
    registerContentWithMintAndRent: registerContentWithMintAndRent.mutateAsync,
    tipContent: tipContent.mutateAsync,
    configureMint: configureMint.mutateAsync,
    updateMintSettings: updateMintSettings.mutateAsync,
    mintNftSol: mintNftSol.mutateAsync,
    // VRF-based minting with rarity (two-step flow)
    commitMint: commitMint.mutateAsync,
    revealMint: revealMint.mutateAsync,
    cancelExpiredMint: cancelExpiredMint.mutateAsync,  // Refund if oracle fails
    updateContent: updateContent.mutateAsync,
    deleteContent: deleteContent.mutateAsync,
    claimContentRewards: claimContentRewards.mutateAsync,
    claimRewardsVerified: claimRewardsVerified.mutateAsync,  // Recommended: verifies NFT ownership
    claimAllRewards: claimAllRewards.mutateAsync,

    // Rent actions
    configureRent: configureRent.mutateAsync,
    updateRentConfig: updateRentConfig.mutateAsync,
    rentContentSol: rentContentSol.mutateAsync,
    checkRentalAccess,

    // Burn NFT
    burnNft: burnNft.mutateAsync,

    // Mutation states
    isRegisteringContent: registerContent.isPending || registerContentWithMint.isPending || registerContentWithMintAndRent.isPending,
    isTipping: tipContent.isPending,
    isConfiguringMint: configureMint.isPending,
    isUpdatingMintSettings: updateMintSettings.isPending,
    isMintingNft: mintNftSol.isPending || commitMint.isPending || revealMint.isPending,
    isCommittingMint: commitMint.isPending,
    isRevealingMint: revealMint.isPending,
    isCancellingExpiredMint: cancelExpiredMint.isPending,
    isUpdatingContent: updateContent.isPending,
    isDeletingContent: deleteContent.isPending,
    isClaimingReward: claimContentRewards.isPending || claimRewardsVerified.isPending || claimAllRewards.isPending,
    isConfiguringRent: configureRent.isPending,
    isUpdatingRentConfig: updateRentConfig.isPending,
    isRentingContent: rentContentSol.isPending,
    isBurningNft: burnNft.isPending,

    // Hooks for specific data
    useMintConfig,
    useRentConfig,
    useNftOwnership,
    useActiveRental,
    useTotalMintedNfts,
    useContentRewardPool,
    useWalletContentState,
    usePendingRewards,
    getPendingRewardForContent,
    pendingRewardsQuery,
    walletNfts,
    nftRarities,
    walletNftRaritiesQuery,

    // Utilities
    client,
    getContentPda,
    getCidRegistryPda,
    getEcosystemConfigPda,
    getMintConfigPda,
    getContentRewardPoolPda,
    getWalletContentStatePda,
    getContentCollectionPda,
    getRentConfigPda,
    getPendingMintPda,
    getNftRarityPda,
    calculatePrimarySplit,
    calculatePendingReward,
  };
}
