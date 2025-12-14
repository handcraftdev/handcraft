"use client";

import { useMemo } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createContentRegistryClient,
  ContentType,
  PaymentCurrency,
  RentTier,
  Rarity,
  getRarityName,
  getRarityWeight,
  getRarityFromWeight,
  getContentPda,
  getCidRegistryPda,
  getEcosystemConfigPda,
  getMintConfigPda,
  getContentRewardPoolPda,
  getWalletContentStatePda,
  getContentCollectionPda,
  getRentConfigPda,
  getPendingMintPda,
  getMbMintRequestPda,
  getMbNftAssetPda,
  getBundlePda,
  getBundleItemPda,
  getBundleMintConfigPda,
  getBundleRentConfigPda,
  getBundleCollectionPda,
  getBundleRewardPoolPda,
  getUserProfilePda,
  getEcosystemStreamingTreasuryPda,
  MAGICBLOCK_DEFAULT_QUEUE,
  MB_FALLBACK_TIMEOUT_SECONDS,
  ContentRewardPool,
  UserProfile,
  WalletContentState,
  MintConfig,
  EcosystemConfig,
  ContentCollection,
  RentConfig,
  RentEntry,
  ContentEntry,
  PendingMint,
  Bundle,
  BundleItem,
  BundleType,
  BundleWithItems,
  BundleMintConfig,
  BundleRentConfig,
  BundleCollection,
  BundleRewardPool,
  EcosystemEpochState,
  GlobalHolderPool,
  CreatorDistPool,
  getBundleTypeLabel,
  calculatePrimarySplit,
  calculatePendingReward,
  FIXED_CREATOR_ROYALTY_BPS,
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
  BundleType,
  getRarityName,
  getRarityWeight,
  getBundleTypeLabel,
  getContentPda,
  getMbMintRequestPda,
  getMbNftAssetPda,
  getBundlePda,
  getBundleItemPda,
  getBundleMintConfigPda,
  getBundleRentConfigPda,
  getBundleCollectionPda,
  getBundleRewardPoolPda,
  getUserProfilePda,
  MAGICBLOCK_DEFAULT_QUEUE,
  MB_FALLBACK_TIMEOUT_SECONDS,
  FIXED_CREATOR_ROYALTY_BPS,
  MIN_PRICE_LAMPORTS,
  RENT_PERIOD_6H,
  RENT_PERIOD_1D,
  RENT_PERIOD_7D,
  MIN_RENT_FEE_LAMPORTS,
};
export type { MbMintRequest } from "@handcraft/sdk";
export type { MintConfig, EcosystemConfig, ContentRewardPool, WalletContentState, ContentCollection, RentConfig, RentEntry, PendingMint, ContentEntry, Bundle, BundleItem, BundleWithItems, BundleMintConfig, BundleRentConfig, BundleCollection, BundleRewardPool, UserProfile, EcosystemEpochState, GlobalHolderPool, CreatorDistPool };
export { getEcosystemStreamingTreasuryPda };

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

  // Fetch user profile for the connected wallet
  const userProfileQuery = useQuery({
    queryKey: ["userProfile", publicKey?.toBase58()],
    queryFn: () => {
      if (!client || !publicKey) return null;
      return client.fetchUserProfile(publicKey);
    },
    enabled: !!client && !!publicKey,
    staleTime: 300000, // Cache for 5 minutes
    gcTime: 600000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Create user profile mutation
  const createUserProfile = useMutation({
    mutationFn: async ({ username }: { username: string }) => {
      if (!publicKey) throw new Error("Wallet not connected");
      if (!client) throw new Error("Client not initialized");

      const ix = await client.createUserProfileInstruction(publicKey, username);
      const tx = new Transaction().add(ix);
      await simulateTransaction(connection, tx, publicKey);

      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, "confirmed");
      return signature;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userProfile", publicKey?.toBase58()] });
    },
  });

  // Update user profile mutation
  const updateUserProfile = useMutation({
    mutationFn: async ({ username }: { username: string }) => {
      if (!publicKey) throw new Error("Wallet not connected");
      if (!client) throw new Error("Client not initialized");

      const ix = await client.updateUserProfileInstruction(publicKey, username);
      const tx = new Transaction().add(ix);
      await simulateTransaction(connection, tx, publicKey);

      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, "confirmed");
      return signature;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userProfile", publicKey?.toBase58()] });
    },
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
      visibilityLevel = 0,
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
      visibilityLevel?: number;
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
        encryptionMetaCid,
        visibilityLevel
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
  // Automatically batches claims if there are too many NFTs to fit in one transaction
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

      // Limit NFTs per transaction to avoid exceeding account limit
      // Each NFT adds 2 accounts (NFT asset + reward state PDA)
      // Fixed accounts: contentRewardPool, walletContentState, contentCollection, holder, systemProgram = 5
      // Max accounts per tx = 64, so max NFTs = (64 - 5) / 2 = 29
      const MAX_NFTS_PER_TX = 25; // Conservative limit to leave room for compute budget etc

      if (nftAssets.length <= MAX_NFTS_PER_TX) {
        // Single transaction for small batches
        const ix = await client.claimRewardsVerifiedInstruction(
          publicKey,
          contentCid,
          nftAssets
        );

        const tx = new Transaction().add(ix);

        console.log("Simulating verified claim transaction...");
        await simulateTransaction(connection, tx, publicKey);
        console.log("Simulation successful, sending to wallet...");

        const signature = await sendTransaction(tx, connection);
        console.log("Verified claim tx sent:", signature);
        await connection.confirmTransaction(signature, "confirmed");
        console.log("Verified claim confirmed!");
        return signature;
      } else {
        // Multiple transactions for large batches
        console.log(`Splitting ${nftAssets.length} NFTs into batches of ${MAX_NFTS_PER_TX}`);
        const batches: PublicKey[][] = [];
        for (let i = 0; i < nftAssets.length; i += MAX_NFTS_PER_TX) {
          batches.push(nftAssets.slice(i, i + MAX_NFTS_PER_TX));
        }

        let lastSignature = "";
        for (let i = 0; i < batches.length; i++) {
          const batch = batches[i];
          console.log(`Processing batch ${i + 1}/${batches.length} with ${batch.length} NFTs`);

          const ix = await client.claimRewardsVerifiedInstruction(
            publicKey,
            contentCid,
            batch
          );

          const tx = new Transaction().add(ix);

          console.log(`Simulating batch ${i + 1}...`);
          await simulateTransaction(connection, tx, publicKey);

          lastSignature = await sendTransaction(tx, connection);
          console.log(`Batch ${i + 1} tx sent:`, lastSignature);
          await connection.confirmTransaction(lastSignature, "confirmed");
          console.log(`Batch ${i + 1} confirmed!`);
        }

        return lastSignature;
      }
    },
    onSuccess: (_, { contentCid }) => {
      queryClient.invalidateQueries({ queryKey: ["contentRewardPool", contentCid] });
      queryClient.invalidateQueries({ queryKey: ["walletContentState", publicKey?.toBase58(), contentCid] });
      queryClient.invalidateQueries({ queryKey: ["pendingRewards"] });
    },
  });

  // Batch claim rewards mutation (claims from multiple content positions)
  // Uses verified claims with per-NFT tracking
  // Automatically splits into multiple transactions if needed
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

      // Limit NFTs per transaction to avoid exceeding account limit
      // Each NFT adds 2 accounts (NFT asset + reward state PDA)
      // Fixed accounts: contentRewardPool, walletContentState, contentCollection, holder, systemProgram = 5
      // Max accounts per tx = 64, so max NFTs = (64 - 5) / 2 = 29
      const MAX_NFTS_PER_TX = 25; // Conservative limit to leave room for compute budget etc

      // Collect all claim batches: { contentCid, nftAssets[] }
      type ClaimBatch = { contentCid: string; nftAssets: PublicKey[] };
      const allBatches: ClaimBatch[] = [];

      // Build batched claims for each content
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

        // Split NFTs into batches if needed
        for (let i = 0; i < nftAssets.length; i += MAX_NFTS_PER_TX) {
          allBatches.push({
            contentCid,
            nftAssets: nftAssets.slice(i, i + MAX_NFTS_PER_TX),
          });
        }
      }

      if (allBatches.length === 0) {
        throw new Error("No valid claims to process");
      }

      console.log(`Processing ${allBatches.length} claim batch(es)`);

      // Try to fit multiple batches into one transaction if they're small enough
      // But if that fails, process one batch at a time
      let lastSignature = "";

      // Group batches into transactions (max ~12 NFTs per tx total)
      let currentTx = new Transaction();
      let currentNftCount = 0;
      let txIndex = 0;

      for (let i = 0; i < allBatches.length; i++) {
        const batch = allBatches[i];
        const batchNftCount = batch.nftAssets.length;

        // If adding this batch would exceed limit, send current tx first
        if (currentNftCount + batchNftCount > MAX_NFTS_PER_TX && currentTx.instructions.length > 0) {
          txIndex++;
          console.log(`Sending transaction ${txIndex} with ${currentNftCount} NFTs...`);

          try {
            await simulateTransaction(connection, currentTx, publicKey);
            lastSignature = await sendTransaction(currentTx, connection);
            await connection.confirmTransaction(lastSignature, "confirmed");
            console.log(`Transaction ${txIndex} confirmed:`, lastSignature);
          } catch (err) {
            console.error(`Transaction ${txIndex} failed:`, err);
            throw err;
          }

          currentTx = new Transaction();
          currentNftCount = 0;
        }

        // Add batch to current transaction
        console.log(`Adding claim for ${batch.contentCid} with ${batchNftCount} NFTs`);
        const ix = await client.claimRewardsVerifiedInstruction(
          publicKey,
          batch.contentCid,
          batch.nftAssets
        );
        currentTx.add(ix);
        currentNftCount += batchNftCount;
      }

      // Send remaining transaction
      if (currentTx.instructions.length > 0) {
        txIndex++;
        console.log(`Sending final transaction ${txIndex} with ${currentNftCount} NFTs...`);

        await simulateTransaction(connection, currentTx, publicKey);
        lastSignature = await sendTransaction(currentTx, connection);
        await connection.confirmTransaction(lastSignature, "confirmed");
        console.log(`Transaction ${txIndex} confirmed:`, lastSignature);
      }

      console.log(`All claims completed! Total transactions: ${txIndex}`);
      return lastSignature;
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

  // Batch fetch ALL bundle mint configs in one RPC call
  const allBundleMintConfigsQuery = useQuery({
    queryKey: ["allBundleMintConfigs"],
    queryFn: async () => {
      if (!client) return new Map<string, BundleMintConfig>();
      return client.fetchAllBundleMintConfigs();
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

  // ============================================
  // BUNDLE QUERIES
  // ============================================

  // Fetch all bundles globally (for feed)
  const globalBundlesQuery = useQuery({
    queryKey: ["bundles", "global"],
    queryFn: async () => {
      if (!client) return [];
      return client.fetchAllBundles();
    },
    enabled: !!client,
    staleTime: 60000,
    gcTime: 300000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Fetch content-to-bundle mapping (which bundles contain which content)
  const contentToBundlesQuery = useQuery({
    queryKey: ["contentToBundles"],
    queryFn: async () => {
      if (!client) return new Map<string, Array<{ bundleId: string; creator: { toBase58(): string } }>>();
      // Get all content CIDs from global content
      const contentCids = globalContentQuery.data?.map(c => c.contentCid) || [];
      if (contentCids.length === 0) return new Map();
      return client.findBundlesForContentBatch(contentCids);
    },
    enabled: !!client && globalContentQuery.isSuccess && (globalContentQuery.data?.length ?? 0) > 0,
    staleTime: 120000,
    gcTime: 300000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Helper to get bundles for a specific content
  const getBundlesForContent = (contentCid: string): Array<{ bundleId: string; creator: { toBase58(): string } }> => {
    return contentToBundlesQuery.data?.get(contentCid) || [];
  };

  // Fetch all bundles for the connected wallet
  const myBundlesQuery = useQuery({
    queryKey: ["bundles", "creator", publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey || !client) return [];
      return client.fetchBundlesByCreator(publicKey);
    },
    enabled: !!publicKey && !!client,
    staleTime: 60000,
    gcTime: 300000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Hook to fetch a specific bundle
  const useBundle = (bundleId: string | null) => {
    return useQuery({
      queryKey: ["bundle", publicKey?.toBase58(), bundleId],
      queryFn: async () => {
        if (!publicKey || !bundleId || !client) return null;
        return client.fetchBundle(publicKey, bundleId);
      },
      enabled: !!publicKey && !!bundleId && !!client,
      staleTime: 60000,
      gcTime: 120000,
    });
  };

  // Hook to fetch bundle with all items
  const useBundleWithItems = (bundleId: string | null) => {
    return useQuery({
      queryKey: ["bundleWithItems", publicKey?.toBase58(), bundleId],
      queryFn: async () => {
        if (!publicKey || !bundleId || !client) return null;
        return client.fetchBundleWithItems(publicKey, bundleId);
      },
      enabled: !!publicKey && !!bundleId && !!client,
      staleTime: 60000,
      gcTime: 120000,
    });
  };

  // ============================================
  // BUNDLE MUTATIONS
  // ============================================

  // Create a new bundle (basic - starts as draft)
  const createBundle = useMutation({
    mutationFn: async ({
      bundleId,
      metadataCid,
      bundleType,
    }: {
      bundleId: string;
      metadataCid: string;
      bundleType: BundleType;
    }) => {
      if (!publicKey || !client) throw new Error("Wallet not connected");

      const instruction = await client.createBundleInstruction(
        publicKey,
        bundleId,
        metadataCid,
        bundleType
      );

      const tx = new Transaction().add(instruction);
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      console.log("Simulating create bundle transaction...");
      await simulateTransaction(connection, tx, publicKey);
      console.log("Simulation successful, sending to wallet...");

      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");

      return { signature: sig, bundleId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bundles", "creator", publicKey?.toBase58()] });
    },
  });

  // Create a bundle with mint and rent configuration (all-in-one, single signature)
  const createBundleWithMintAndRent = useMutation({
    mutationFn: async ({
      bundleId,
      metadataCid,
      bundleType,
      mintPrice,
      mintMaxSupply,
      creatorRoyaltyBps,
      rentFee6h,
      rentFee1d,
      rentFee7d,
      platform,
    }: {
      bundleId: string;
      metadataCid: string;
      bundleType: BundleType;
      mintPrice: bigint;
      mintMaxSupply: bigint | null;
      creatorRoyaltyBps: number;
      rentFee6h: bigint;
      rentFee1d: bigint;
      rentFee7d: bigint;
      platform: PublicKey;
    }) => {
      if (!publicKey || !client) throw new Error("Wallet not connected");

      const { instruction, collectionAssetKeypair } = await client.createBundleWithMintAndRentInstruction(
        publicKey,
        bundleId,
        metadataCid,
        bundleType,
        mintPrice,
        mintMaxSupply,
        creatorRoyaltyBps,
        rentFee6h,
        rentFee1d,
        rentFee7d,
        platform
      );

      const tx = new Transaction().add(instruction);
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      // Partially sign with the collection asset keypair
      tx.partialSign(collectionAssetKeypair);

      console.log("Simulating create bundle with mint/rent transaction...");
      await simulatePartiallySignedTransaction(connection, tx);
      console.log("Simulation successful, sending to wallet...");

      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");

      return { signature: sig, bundleId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bundles", "creator", publicKey?.toBase58()] });
      queryClient.invalidateQueries({ queryKey: ["bundleMintConfig"] });
      queryClient.invalidateQueries({ queryKey: ["bundleRentConfig"] });
    },
  });

  // Add content to a bundle
  const addBundleItem = useMutation({
    mutationFn: async ({
      bundleId,
      contentCid,
      position,
    }: {
      bundleId: string;
      contentCid: string;
      position?: number;
    }) => {
      if (!publicKey || !client) throw new Error("Wallet not connected");

      const instruction = await client.addBundleItemInstruction(
        publicKey,
        bundleId,
        contentCid,
        position
      );

      const tx = new Transaction().add(instruction);
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      console.log("Simulating add bundle item transaction...");
      await simulateTransaction(connection, tx, publicKey);
      console.log("Simulation successful, sending to wallet...");

      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");

      return { signature: sig };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["bundle", publicKey?.toBase58(), variables.bundleId] });
      queryClient.invalidateQueries({ queryKey: ["bundleWithItems", publicKey?.toBase58(), variables.bundleId] });
      queryClient.invalidateQueries({ queryKey: ["bundles", "creator", publicKey?.toBase58()] });
    },
  });

  // Remove content from a bundle
  const removeBundleItem = useMutation({
    mutationFn: async ({
      bundleId,
      contentCid,
    }: {
      bundleId: string;
      contentCid: string;
    }) => {
      if (!publicKey || !client) throw new Error("Wallet not connected");

      const instruction = await client.removeBundleItemInstruction(
        publicKey,
        bundleId,
        contentCid
      );

      const tx = new Transaction().add(instruction);
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      console.log("Simulating remove bundle item transaction...");
      await simulateTransaction(connection, tx, publicKey);
      console.log("Simulation successful, sending to wallet...");

      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");

      return { signature: sig };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["bundle", publicKey?.toBase58(), variables.bundleId] });
      queryClient.invalidateQueries({ queryKey: ["bundleWithItems", publicKey?.toBase58(), variables.bundleId] });
      queryClient.invalidateQueries({ queryKey: ["bundles", "creator", publicKey?.toBase58()] });
    },
  });

  // Update bundle metadata or status
  const updateBundle = useMutation({
    mutationFn: async ({
      bundleId,
      metadataCid,
      isActive,
    }: {
      bundleId: string;
      metadataCid?: string;
      isActive?: boolean;
    }) => {
      if (!publicKey || !client) throw new Error("Wallet not connected");

      const instruction = await client.updateBundleInstruction(
        publicKey,
        bundleId,
        metadataCid,
        isActive
      );

      const tx = new Transaction().add(instruction);
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      console.log("Simulating update bundle transaction...");
      await simulateTransaction(connection, tx, publicKey);
      console.log("Simulation successful, sending to wallet...");

      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");

      return { signature: sig };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["bundle", publicKey?.toBase58(), variables.bundleId] });
      queryClient.invalidateQueries({ queryKey: ["bundleWithItems", publicKey?.toBase58(), variables.bundleId] });
      queryClient.invalidateQueries({ queryKey: ["bundles", "creator", publicKey?.toBase58()] });
    },
  });

  // Delete an empty bundle
  const deleteBundle = useMutation({
    mutationFn: async ({ bundleId }: { bundleId: string }) => {
      if (!publicKey || !client) throw new Error("Wallet not connected");

      const instruction = await client.deleteBundleInstruction(publicKey, bundleId);

      const tx = new Transaction().add(instruction);
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      console.log("Simulating delete bundle transaction...");
      await simulateTransaction(connection, tx, publicKey);
      console.log("Simulation successful, sending to wallet...");

      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");

      return { signature: sig };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bundles", "creator", publicKey?.toBase58()] });
    },
  });

  // ============= Bundle Mint/Rent Mutations =============

  // Configure bundle minting
  const configureBundleMint = useMutation({
    mutationFn: async ({
      bundleId,
      price,
      maxSupply,
      creatorRoyaltyBps,
      platform,
    }: {
      bundleId: string;
      price: bigint;
      maxSupply: bigint | null;
      creatorRoyaltyBps: number;
      platform: PublicKey;
    }) => {
      if (!publicKey || !client) throw new Error("Wallet not connected");

      const { instruction, collectionAssetKeypair } = await client.configureBundleMintInstruction(
        publicKey,
        bundleId,
        price,
        maxSupply,
        creatorRoyaltyBps,
        platform
      );

      const tx = new Transaction().add(instruction);
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      // Partially sign with the collection asset keypair
      tx.partialSign(collectionAssetKeypair);

      console.log("Simulating configure bundle mint transaction...");
      await simulatePartiallySignedTransaction(connection, tx);
      console.log("Simulation successful, sending to wallet...");

      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");

      return { signature: sig };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bundles", "creator", publicKey?.toBase58()] });
      queryClient.invalidateQueries({ queryKey: ["bundleMintConfig"] });
    },
  });

  // Update bundle mint settings
  const updateBundleMintSettings = useMutation({
    mutationFn: async ({
      bundleId,
      price,
      maxSupply,
      creatorRoyaltyBps,
      isActive,
    }: {
      bundleId: string;
      price: bigint | null;
      maxSupply: bigint | null | undefined;
      creatorRoyaltyBps: number | null;
      isActive: boolean | null;
    }) => {
      if (!publicKey || !client) throw new Error("Wallet not connected");

      const instruction = await client.updateBundleMintSettingsInstruction(
        publicKey,
        bundleId,
        price,
        maxSupply,
        creatorRoyaltyBps,
        isActive
      );

      const tx = new Transaction().add(instruction);
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      console.log("Simulating update bundle mint settings transaction...");
      await simulateTransaction(connection, tx, publicKey);
      console.log("Simulation successful, sending to wallet...");

      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");

      return { signature: sig };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bundleMintConfig"] });
    },
  });

  // Direct mint bundle NFT
  const directMintBundle = useMutation({
    mutationFn: async ({
      bundleId,
      bundleName,
      creator,
      treasury,
      platform,
      collectionAsset,
    }: {
      bundleId: string;
      bundleName: string;
      creator: PublicKey;
      treasury: PublicKey;
      platform: PublicKey;
      collectionAsset: PublicKey;
    }) => {
      if (!publicKey || !client) throw new Error("Wallet not connected");

      const result = await client.simpleMintBundleInstruction(
        publicKey,
        bundleId,
        creator,
        treasury,
        platform,
        collectionAsset,
        bundleName.slice(0, 32), // Limit to 32 chars for Metaplex Core
        []  // contentCids for 50/50 distribution
      );

      const tx = new Transaction().add(result.instruction);
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      console.log("Simulating direct mint bundle transaction...");
      await simulateTransaction(connection, tx, publicKey);
      console.log("Simulation successful, sending to wallet...");

      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");

      return {
        signature: sig,
        nftAsset: result.nftAsset,
        edition: result.edition,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bundles"] });
      queryClient.invalidateQueries({ queryKey: ["bundleRewardPool"] });
    },
  });

  // Configure bundle rental
  const configureBundleRent = useMutation({
    mutationFn: async ({
      bundleId,
      rentFee6h,
      rentFee1d,
      rentFee7d,
    }: {
      bundleId: string;
      rentFee6h: bigint;
      rentFee1d: bigint;
      rentFee7d: bigint;
    }) => {
      if (!publicKey || !client) throw new Error("Wallet not connected");

      const instruction = await client.configureBundleRentInstruction(
        publicKey,
        bundleId,
        rentFee6h,
        rentFee1d,
        rentFee7d
      );

      const tx = new Transaction().add(instruction);
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      console.log("Simulating configure bundle rent transaction...");
      await simulateTransaction(connection, tx, publicKey);
      console.log("Simulation successful, sending to wallet...");

      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");

      return { signature: sig };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bundleRentConfig"] });
    },
  });

  // Update bundle rent config
  const updateBundleRentConfig = useMutation({
    mutationFn: async ({
      bundleId,
      rentFee6h,
      rentFee1d,
      rentFee7d,
      isActive,
    }: {
      bundleId: string;
      rentFee6h: bigint | null;
      rentFee1d: bigint | null;
      rentFee7d: bigint | null;
      isActive: boolean | null;
    }) => {
      if (!publicKey || !client) throw new Error("Wallet not connected");

      const instruction = await client.updateBundleRentConfigInstruction(
        publicKey,
        bundleId,
        rentFee6h,
        rentFee1d,
        rentFee7d,
        isActive
      );

      const tx = new Transaction().add(instruction);
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      console.log("Simulating update bundle rent config transaction...");
      await simulateTransaction(connection, tx, publicKey);
      console.log("Simulation successful, sending to wallet...");

      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");

      return { signature: sig };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bundleRentConfig"] });
    },
  });

  // Rent bundle with SOL
  const rentBundleSol = useMutation({
    mutationFn: async ({
      bundleId,
      creator,
      treasury,
      platform,
      collectionAsset,
      tier,
    }: {
      bundleId: string;
      creator: PublicKey;
      treasury: PublicKey;
      platform: PublicKey;
      collectionAsset: PublicKey;
      tier: RentTier;
    }) => {
      if (!publicKey || !client) throw new Error("Wallet not connected");

      const result = await client.rentBundleSolInstruction(
        publicKey,
        bundleId,
        creator,
        treasury,
        platform,
        collectionAsset,
        tier
      );

      const tx = new Transaction().add(result.instruction);
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      // Sign with the NFT asset keypair (partial sign before wallet signs)
      tx.partialSign(result.nftAssetKeypair);

      // Simulate transaction before prompting wallet
      console.log("Simulating bundle rent transaction...");
      await simulatePartiallySignedTransaction(connection, tx);
      console.log("Simulation successful, sending to wallet...");

      const sig = await sendTransaction(tx, connection, {
        signers: [result.nftAssetKeypair],
      });
      console.log("Bundle rent tx sent:", sig);
      await connection.confirmTransaction(sig, "confirmed");
      console.log("Bundle rent confirmed!");

      return {
        signature: sig,
        nftAsset: result.nftAsset,
        rentEntryPda: result.rentEntryPda,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bundleRentConfig"] });
      queryClient.invalidateQueries({ queryKey: ["bundleRewardPool"] });
    },
  });

  // Claim bundle rewards
  const claimBundleRewards = useMutation({
    mutationFn: async ({
      bundleId,
      creator,
      nftAsset,
    }: {
      bundleId: string;
      creator: PublicKey;
      nftAsset: PublicKey;
    }) => {
      if (!publicKey || !client) throw new Error("Wallet not connected");

      console.log("Claiming bundle rewards...", {
        bundleId,
        creator: creator.toBase58(),
        nftAsset: nftAsset.toBase58(),
        claimer: publicKey.toBase58(),
      });

      const instruction = await client.claimBundleRewardsInstruction(
        publicKey,
        bundleId,
        creator,
        nftAsset
      );

      const tx = new Transaction().add(instruction);
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      console.log("Simulating claim bundle rewards transaction...");
      await simulateTransaction(connection, tx, publicKey);
      console.log("Simulation successful, sending to wallet...");

      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");
      console.log("Claim bundle rewards confirmed!");

      return { signature: sig };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bundleRewardPool"] });
      queryClient.invalidateQueries({ queryKey: ["bundlePendingRewards"] });
    },
  });

  // Batch claim all bundle rewards - claims all bundle NFTs in efficient batched transactions
  const claimAllBundleRewards = useMutation({
    mutationFn: async ({
      bundleRewards,
    }: {
      bundleRewards: Array<{
        bundleId: string;
        creator: PublicKey;
        nftAssets: PublicKey[];
      }>;
    }) => {
      if (!publicKey || !client) throw new Error("Wallet not connected");
      if (bundleRewards.length === 0) throw new Error("No bundle rewards to claim");

      console.log("Claiming all bundle rewards...", {
        bundleCount: bundleRewards.length,
        totalNfts: bundleRewards.reduce((acc, r) => acc + r.nftAssets.length, 0),
      });

      // Build all bundle claim instructions
      const instructions: TransactionInstruction[] = [];

      for (const reward of bundleRewards) {
        for (const nftAsset of reward.nftAssets) {
          const ix = await client.claimBundleRewardsInstruction(
            publicKey,
            reward.bundleId,
            reward.creator,
            nftAsset
          );
          instructions.push(ix);
        }
      }

      if (instructions.length === 0) {
        throw new Error("No valid bundle claims to process");
      }

      // Group instructions into transactions (max ~5 claims per tx to stay within limits)
      const MAX_CLAIMS_PER_TX = 5;
      const txBatches: TransactionInstruction[][] = [];
      for (let i = 0; i < instructions.length; i += MAX_CLAIMS_PER_TX) {
        txBatches.push(instructions.slice(i, i + MAX_CLAIMS_PER_TX));
      }

      console.log(`Processing ${instructions.length} bundle claims in ${txBatches.length} transaction(s)`);

      let lastSignature = "";
      for (let i = 0; i < txBatches.length; i++) {
        const batch = txBatches[i];
        const tx = new Transaction();
        for (const ix of batch) {
          tx.add(ix);
        }

        console.log(`Simulating bundle claim batch ${i + 1}/${txBatches.length}...`);
        await simulateTransaction(connection, tx, publicKey);
        console.log("Simulation successful, sending to wallet...");

        lastSignature = await sendTransaction(tx, connection);
        console.log(`Bundle claim batch ${i + 1} tx sent:`, lastSignature);
        await connection.confirmTransaction(lastSignature, "confirmed");
        console.log(`Bundle claim batch ${i + 1} confirmed!`);
      }

      return { signature: lastSignature, claimedCount: instructions.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bundleRewardPool"] });
      queryClient.invalidateQueries({ queryKey: ["bundlePendingRewards"] });
    },
  });

  // Unified claim all rewards - combines content and bundle claims into same transactions
  const claimAllRewardsUnified = useMutation({
    mutationFn: async ({
      contentCids,
      bundleRewards,
    }: {
      contentCids: string[];
      bundleRewards: Array<{
        bundleId: string;
        creator: PublicKey;
        nftAssets: PublicKey[];
      }>;
    }) => {
      if (!publicKey || !client) throw new Error("Wallet not connected");

      // Collect ALL instructions first (both content and bundle)
      const allInstructions: TransactionInstruction[] = [];

      // First, try to unwrap any WSOL in ecosystem treasury to native SOL
      // This enables epoch distribution to work with streamed subscription funds
      try {
        const unwrapIx = await client.unwrapEcosystemTreasuryWsolInstruction(publicKey);
        allInstructions.push(unwrapIx);
        console.log("Added ecosystem treasury WSOL unwrap instruction");
      } catch (err) {
        console.log("Skipping ecosystem unwrap (may not have WSOL):", err);
      }

      // Build content claim instructions
      if (contentCids.length > 0) {
        console.log("Building content claim instructions...", { count: contentCids.length });

        for (const contentCid of contentCids) {
          const contentCollection = await client.fetchContentCollection(contentCid);
          if (!contentCollection) continue;

          const nftAssets = await client.fetchWalletNftsForCollection(
            publicKey,
            contentCollection.collectionAsset
          );
          if (nftAssets.length === 0) continue;

          // Content claims can include multiple NFTs per instruction
          const MAX_NFTS_PER_CONTENT_IX = 10; // Conservative to leave room for bundle claims
          for (let i = 0; i < nftAssets.length; i += MAX_NFTS_PER_CONTENT_IX) {
            const batch = nftAssets.slice(i, i + MAX_NFTS_PER_CONTENT_IX);
            const ix = await client.claimRewardsVerifiedInstruction(
              publicKey,
              contentCid,
              batch
            );
            allInstructions.push(ix);
          }
        }
      }

      // Build bundle claim instructions (batch per bundle - all NFTs from same bundle in one instruction)
      // Also collect unique creators to unwrap their patron treasuries
      const uniqueCreators = new Set<string>();
      if (bundleRewards.length > 0) {
        const totalBundleNfts = bundleRewards.reduce((acc, r) => acc + r.nftAssets.length, 0);
        if (totalBundleNfts > 0) {
          console.log("Building bundle claim instructions...", {
            bundleCount: bundleRewards.length,
            totalNfts: totalBundleNfts
          });

          // One instruction per bundle (batches all NFTs from that bundle)
          for (const reward of bundleRewards) {
            if (reward.nftAssets.length > 0) {
              uniqueCreators.add(reward.creator.toBase58());
              const ix = await client.batchClaimBundleRewardsInstruction(
                publicKey,
                reward.bundleId,
                reward.creator,
                reward.nftAssets
              );
              allInstructions.push(ix);
            }
          }
        }
      }

      // Unwrap WSOL from creator patron treasuries to enable their epoch distributions
      for (const creatorKey of uniqueCreators) {
        try {
          const creatorPubkey = new PublicKey(creatorKey);
          const unwrapIx = await client.unwrapCreatorPatronTreasuryWsolInstruction(creatorPubkey, publicKey);
          allInstructions.push(unwrapIx);
          console.log(`Added creator patron treasury WSOL unwrap for ${creatorKey.slice(0, 8)}...`);
        } catch (err) {
          console.log(`Skipping creator patron unwrap for ${creatorKey.slice(0, 8)}... (may not have WSOL)`);
        }
      }

      // Note: allInstructions may contain unwrap instructions even if no content/bundle claims
      // We should still process unwrap instructions to enable future distributions
      if (allInstructions.length === 0) {
        console.log("No instructions to process");
        return { signatures: [] };
      }

      console.log(`Total instructions to process: ${allInstructions.length}`);

      // Batch all instructions into transactions (max ~4 instructions per tx to stay within limits)
      // Content claims use more accounts, bundle claims use fewer, so we use a conservative limit
      const MAX_INSTRUCTIONS_PER_TX = 4;
      const signatures: string[] = [];

      for (let i = 0; i < allInstructions.length; i += MAX_INSTRUCTIONS_PER_TX) {
        const batch = allInstructions.slice(i, i + MAX_INSTRUCTIONS_PER_TX);
        const tx = new Transaction();
        for (const ix of batch) {
          tx.add(ix);
        }

        const txNum = Math.floor(i / MAX_INSTRUCTIONS_PER_TX) + 1;
        const totalTxs = Math.ceil(allInstructions.length / MAX_INSTRUCTIONS_PER_TX);
        console.log(`Sending claim tx ${txNum}/${totalTxs} (${batch.length} instructions)...`);

        await simulateTransaction(connection, tx, publicKey);
        const sig = await sendTransaction(tx, connection);
        await connection.confirmTransaction(sig, "confirmed");
        signatures.push(sig);
        console.log(`Tx ${txNum} confirmed:`, sig);
      }

      return { signatures };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contentRewardPool"] });
      queryClient.invalidateQueries({ queryKey: ["pendingRewards"] });
      queryClient.invalidateQueries({ queryKey: ["bundleRewardPool"] });
      queryClient.invalidateQueries({ queryKey: ["bundlePendingRewards"] });
    },
  });

  // Fetch bundle mint config
  const useBundleMintConfig = (creator: PublicKey | null, bundleId: string | null) => {
    return useQuery({
      queryKey: ["bundleMintConfig", creator?.toBase58(), bundleId],
      queryFn: () =>
        creator && bundleId && client ? client.fetchBundleMintConfig(creator, bundleId) : null,
      enabled: !!creator && !!bundleId && !!client,
      staleTime: 60000,
      gcTime: 120000,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    });
  };

  // Fetch bundle rent config
  const useBundleRentConfig = (creator: PublicKey | null, bundleId: string | null) => {
    return useQuery({
      queryKey: ["bundleRentConfig", creator?.toBase58(), bundleId],
      queryFn: () =>
        creator && bundleId && client ? client.fetchBundleRentConfig(creator, bundleId) : null,
      enabled: !!creator && !!bundleId && !!client,
      staleTime: 60000,
      gcTime: 120000,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    });
  };

  // Fetch bundle collection
  const useBundleCollection = (creator: PublicKey | null, bundleId: string | null) => {
    return useQuery({
      queryKey: ["bundleCollection", creator?.toBase58(), bundleId],
      queryFn: () =>
        creator && bundleId && client ? client.fetchBundleCollection(creator, bundleId) : null,
      enabled: !!creator && !!bundleId && !!client,
      staleTime: 60000,
      gcTime: 120000,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    });
  };

  // Fetch bundle reward pool
  const useBundleRewardPool = (creator: PublicKey | null, bundleId: string | null) => {
    return useQuery({
      queryKey: ["bundleRewardPool", creator?.toBase58(), bundleId],
      queryFn: () =>
        creator && bundleId && client ? client.fetchBundleRewardPool(creator, bundleId) : null,
      enabled: !!creator && !!bundleId && !!client,
      staleTime: 60000,
      gcTime: 120000,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    });
  };

  // Fetch bundle NFT ownership for current wallet
  const useBundleNftOwnership = (creator: PublicKey | null, bundleId: string | null) => {
    return useQuery({
      queryKey: ["bundleNftOwnership", publicKey?.toBase58(), creator?.toBase58(), bundleId],
      queryFn: () =>
        publicKey && creator && bundleId && client
          ? client.fetchBundleWalletState(publicKey, creator, bundleId)
          : null,
      enabled: !!publicKey && !!creator && !!bundleId && !!client,
      staleTime: 60000,
      gcTime: 120000,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    });
  };

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
          const config = allConfigs.get(contentPda.toBase58());
          if (config) return config;
          // If not in batch, try individual fetch (might be newly created)
          console.log("[useMintConfig] Content not in batch, fetching individually:", contentCid);
        }
        // Fallback to individual fetch if batch not loaded or content not found
        const config = await client.fetchMintConfig(contentCid);
        console.log("[useMintConfig] Individual fetch result:", contentCid, config);
        return config;
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
      const rewardStates = await client.fetchNftRewardStatesBatch(nftAssets);

      // Convert weight to rarity and store in Map<nftAsset string, Rarity>
      const result = new Map<string, Rarity>();
      for (const [key, state] of rewardStates) {
        result.set(key, getRarityFromWeight(state.weight));
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

  // ========== BUNDLE NFT OWNERSHIP AND RARITY TRACKING ==========

  // Fetch ALL bundle NFTs owned by wallet ONCE (batch query)
  const walletBundleNftsQuery = useQuery({
    queryKey: ["walletBundleNfts", publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey || !client) return [];
      return client.fetchWalletBundleNftMetadata(publicKey);
    },
    enabled: !!publicKey && !!client,
    staleTime: 300000, // Cache for 5 minutes
    gcTime: 600000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('429')) return false;
      return failureCount < 2;
    },
  });

  // Fetch rarities for all wallet bundle NFTs (batch query)
  const walletBundleNftRaritiesQuery = useQuery({
    queryKey: ["walletBundleNftRarities", publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey || !client) return new Map<string, Rarity>();
      const nfts = walletBundleNftsQuery.data || [];
      if (nfts.length === 0) return new Map<string, Rarity>();

      const nftAssets = nfts.map(nft => nft.nftAsset);
      const rewardStates = await client.fetchBundleNftRewardStatesBatch(nftAssets);

      // Convert weight to rarity and store in Map<nftAsset string, Rarity>
      const result = new Map<string, Rarity>();
      for (const [key, state] of rewardStates) {
        result.set(key, getRarityFromWeight(state.weight));
      }
      return result;
    },
    enabled: !!publicKey && !!client && walletBundleNftsQuery.isSuccess && (walletBundleNftsQuery.data?.length ?? 0) > 0,
    staleTime: 300000,
    gcTime: 600000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('429')) return false;
      return failureCount < 2;
    },
  });

  // Get wallet bundle NFTs data
  const walletBundleNfts = walletBundleNftsQuery.data || [];

  // Map of bundle NFT asset address -> Rarity
  const bundleNftRarities = walletBundleNftRaritiesQuery.data || new Map<string, Rarity>();

  // Batch fetch all bundle reward pools
  const allBundleRewardPoolsQuery = useQuery({
    queryKey: ["allBundleRewardPools"],
    queryFn: async () => {
      if (!client) return new Map();
      return client.fetchAllBundleRewardPools();
    },
    enabled: !!client,
    staleTime: 120000,
    gcTime: 300000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Batch fetch all bundle collections (needed for pending rewards calculation)
  const allBundleCollectionsQuery = useQuery({
    queryKey: ["allBundleCollections"],
    queryFn: async () => {
      if (!client) return new Map();
      return client.fetchAllBundleCollections();
    },
    enabled: !!client,
    staleTime: 120000,
    gcTime: 300000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Per-bundle pending reward info
  interface BundlePendingReward {
    bundleId: string;
    creator: { toBase58(): string };
    pending: bigint;
    nftCount: bigint;
    nftRewards: Array<{
      nftAsset: { toBase58(): string };
      pending: bigint;
      rewardDebt: bigint;
      weight: number;
      createdAt: bigint;
    }>;
  }

  // Fetch pending rewards for ALL user's bundle positions
  const bundlePendingRewardsQuery = useQuery({
    queryKey: ["bundlePendingRewards", publicKey?.toBase58()],
    queryFn: async (): Promise<BundlePendingReward[]> => {
      if (!publicKey || !client) return [];

      const nfts = walletBundleNfts;
      if (nfts.length === 0) return [];

      const rewardPools = allBundleRewardPoolsQuery.data || new Map();
      const collections = allBundleCollectionsQuery.data || new Map();

      return client.getBundlePendingRewardsOptimized(publicKey, nfts, rewardPools, collections);
    },
    enabled: walletBundleNftsQuery.isSuccess &&
             walletBundleNfts.length > 0 &&
             !!publicKey &&
             !!client &&
             allBundleRewardPoolsQuery.isSuccess &&
             allBundleCollectionsQuery.isSuccess,
    staleTime: 120000,
    gcTime: 300000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('429')) return false;
      return failureCount < 2;
    },
  });

  // Helper to get pending reward for a specific bundle
  const getPendingRewardForBundle = (bundleId: string | null, creatorAddress: string | null): BundlePendingReward | null => {
    if (!bundleId || !creatorAddress || !bundlePendingRewardsQuery.data) return null;
    return bundlePendingRewardsQuery.data.find(
      r => r.bundleId === bundleId && r.creator.toBase58() === creatorAddress
    ) || null;
  };

  // ========== END BUNDLE NFT TRACKING ==========

  // Per-NFT pending reward info
  interface NftPendingReward {
    nftAsset: { toBase58(): string };
    pending: bigint;
    rewardDebt: bigint;
    weight: number;
    createdAt: bigint;  // Timestamp for sorting by mint sequence
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

  // Fetch epoch state for subscription pools
  const epochStateQuery = useQuery({
    queryKey: ["epochState"],
    queryFn: () => client?.fetchEcosystemEpochState() ?? null,
    enabled: !!client,
    staleTime: 60000, // Cache for 1 minute
    gcTime: 120000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Fetch global holder pool (12% of ecosystem subscriptions go to NFT holders)
  const globalHolderPoolQuery = useQuery({
    queryKey: ["globalHolderPool"],
    queryFn: () => client?.fetchGlobalHolderPool() ?? null,
    enabled: !!client,
    staleTime: 60000,
    gcTime: 120000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Fetch creator distribution pool (80% of ecosystem subscriptions go to creators)
  const creatorDistPoolQuery = useQuery({
    queryKey: ["creatorDistPool"],
    queryFn: () => client?.fetchCreatorDistPool() ?? null,
    enabled: !!client,
    staleTime: 60000,
    gcTime: 120000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Fetch ecosystem streaming treasury balance (undistributed SOL)
  const ecosystemTreasuryBalanceQuery = useQuery({
    queryKey: ["ecosystemTreasuryBalance"],
    queryFn: () => client?.fetchEcosystemStreamingTreasuryBalance() ?? BigInt(0),
    enabled: !!client,
    staleTime: 30000, // Refresh more often as this is a live balance
    gcTime: 60000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
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
    allMintConfigs: allMintConfigsQuery.data, // Map of contentPda -> MintConfig
    allBundleMintConfigs: allBundleMintConfigsQuery.data, // Map of bundlePda -> BundleMintConfig
    mintableContent, // Derived from cached globalContent + allMintConfigs
    ecosystemConfig: ecosystemConfigQuery.data,
    isLoadingContent: isLoadingUserContent,
    isLoadingGlobalContent: globalContentQuery.isLoading,
    isLoadingMintableContent,
    isLoadingEcosystemConfig: ecosystemConfigQuery.isLoading,
    ecosystemConfigError: ecosystemConfigQuery.error,
    isEcosystemConfigError: ecosystemConfigQuery.isError,
    refetchEcosystemConfig: ecosystemConfigQuery.refetch,

    // Epoch & Subscription Pools
    epochState: epochStateQuery.data,
    globalHolderPool: globalHolderPoolQuery.data,
    creatorDistPool: creatorDistPoolQuery.data,
    ecosystemTreasuryBalance: ecosystemTreasuryBalanceQuery.data ?? BigInt(0),
    isLoadingEpochState: epochStateQuery.isLoading,
    isLoadingGlobalHolderPool: globalHolderPoolQuery.isLoading,
    isLoadingCreatorDistPool: creatorDistPoolQuery.isLoading,
    isLoadingEcosystemTreasuryBalance: ecosystemTreasuryBalanceQuery.isLoading,
    refetchEpochState: epochStateQuery.refetch,
    refetchGlobalHolderPool: globalHolderPoolQuery.refetch,
    refetchCreatorDistPool: creatorDistPoolQuery.refetch,
    refetchEcosystemTreasuryBalance: ecosystemTreasuryBalanceQuery.refetch,

    // User Profile
    userProfile: userProfileQuery.data,
    isLoadingUserProfile: userProfileQuery.isLoading,
    refetchUserProfile: userProfileQuery.refetch,
    createUserProfile: createUserProfile.mutateAsync,
    updateUserProfile: updateUserProfile.mutateAsync,
    isCreatingUserProfile: createUserProfile.isPending,
    isUpdatingUserProfile: updateUserProfile.isPending,

    // Actions
    registerContent: registerContent.mutateAsync,
    registerContentWithMint: registerContentWithMint.mutateAsync,
    registerContentWithMintAndRent: registerContentWithMintAndRent.mutateAsync,
    tipContent: tipContent.mutateAsync,
    configureMint: configureMint.mutateAsync,
    updateMintSettings: updateMintSettings.mutateAsync,
    mintNftSol: mintNftSol.mutateAsync,
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
    isMintingNft: mintNftSol.isPending,
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

    // Bundle NFT ownership and rarity
    walletBundleNfts,
    bundleNftRarities,
    walletBundleNftRaritiesQuery,

    // Bundle pending rewards
    bundlePendingRewardsQuery,
    getPendingRewardForBundle,

    // Bundle management
    globalBundlesQuery,
    globalBundles: globalBundlesQuery.data ?? [],
    isLoadingGlobalBundles: globalBundlesQuery.isLoading,
    contentToBundlesQuery,
    getBundlesForContent,
    myBundlesQuery,
    useBundle,
    useBundleWithItems,
    createBundle,
    createBundleWithMintAndRent,
    addBundleItem,
    removeBundleItem,
    updateBundle,
    deleteBundle,
    isCreatingBundle: createBundle.isPending,
    isCreatingBundleWithMintAndRent: createBundleWithMintAndRent.isPending,
    isAddingBundleItem: addBundleItem.isPending,
    isRemovingBundleItem: removeBundleItem.isPending,
    isUpdatingBundle: updateBundle.isPending,
    isDeletingBundle: deleteBundle.isPending,

    // Bundle mint/rent
    configureBundleMint,
    updateBundleMintSettings,
    directMintBundle,
    configureBundleRent,
    updateBundleRentConfig,
    rentBundleSol,
    claimBundleRewards,
    claimAllBundleRewards: claimAllBundleRewards.mutateAsync,
    claimAllRewardsUnified: claimAllRewardsUnified.mutateAsync,
    useBundleMintConfig,
    useBundleRentConfig,
    useBundleCollection,
    useBundleRewardPool,
    useBundleNftOwnership,
    isConfiguringBundleMint: configureBundleMint.isPending,
    isUpdatingBundleMintSettings: updateBundleMintSettings.isPending,
    isDirectMintingBundle: directMintBundle.isPending,
    isConfiguringBundleRent: configureBundleRent.isPending,
    isUpdatingBundleRentConfig: updateBundleRentConfig.isPending,
    isRentingBundle: rentBundleSol.isPending,
    isClaimingBundleRewards: claimBundleRewards.isPending || claimAllBundleRewards.isPending || claimAllRewardsUnified.isPending,

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
    getBundlePda,
    getBundleItemPda,
    calculatePrimarySplit,
    calculatePendingReward,
  };
}
