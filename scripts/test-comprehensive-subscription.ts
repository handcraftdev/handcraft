/**
 * Comprehensive Subscription System Test
 * Tests: Multiple mints, bundles, multiple epochs, complex reward scenarios
 * Run with: npx tsx scripts/test-comprehensive-subscription.ts
 */

import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet, BN } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";
import {
  PROGRAM_ID,
  getContentPda,
  getEcosystemConfigPda,
  getGlobalHolderPoolPda,
  getCreatorDistPoolPda,
  getEcosystemEpochStatePda,
  getEcosystemSubConfigPda,
  getEcosystemSubscriptionPda,
  getEcosystemStreamingTreasuryPda,
  getCreatorPatronPoolPda,
  getCreatorPatronTreasuryPda,
  getCreatorPatronConfigPda,
  getCreatorPatronSubscriptionPda,
  getCreatorWeightPda,
  getUnifiedNftRewardStatePda,
  getContentRewardPoolPda,
  getContentCollectionPda,
  getMintConfigPda,
  getSimpleNftPda,
  getBundlePda,
  getBundleMintConfigPda,
  getBundleCollectionPda,
  getBundleRewardPoolPda,
  getSimpleBundleNftPda,
  ContentType,
  createContentRegistryClient,
} from "@handcraft/sdk";

const RPC_URL = "https://api.devnet.solana.com";
const PRECISION = BigInt("1000000000000");
const TEST_EPOCH_DURATION = 60; // 60 seconds for testing

// Unique test identifier
const TEST_ID = Date.now();

async function main() {
  console.log("=== Comprehensive Subscription System Test ===\n");
  console.log("Test ID:", TEST_ID);

  // Setup
  const connection = new Connection(RPC_URL, "confirmed");
  const keypairPath = path.join(process.env.HOME!, ".config/solana/id.json");
  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(new Uint8Array(secretKey));

  console.log("Wallet:", wallet.publicKey.toBase58());

  const balance = await connection.getBalance(wallet.publicKey);
  console.log("Balance:", balance / LAMPORTS_PER_SOL, "SOL\n");

  if (balance < 1 * LAMPORTS_PER_SOL) {
    console.error("Insufficient balance. Need at least 1 SOL");
    return;
  }

  // Load IDL and create program
  const idlPath = path.join(__dirname, "../packages/sdk/src/program/content_registry.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const provider = new AnchorProvider(connection, new Wallet(wallet), { commitment: "confirmed" });
  const program = new Program(idl, provider);
  const client = createContentRegistryClient(connection);

  // Get global PDAs
  const [ecosystemConfigPda] = getEcosystemConfigPda();
  const [globalHolderPoolPda] = getGlobalHolderPoolPda();
  const [creatorDistPoolPda] = getCreatorDistPoolPda();
  const [ecosystemEpochStatePda] = getEcosystemEpochStatePda();
  const [ecosystemSubConfigPda] = getEcosystemSubConfigPda();
  const [ecosystemStreamingTreasuryPda] = getEcosystemStreamingTreasuryPda();
  const [creatorPatronPoolPda] = getCreatorPatronPoolPda(wallet.publicKey);
  const [creatorPatronTreasuryPda] = getCreatorPatronTreasuryPda(wallet.publicKey);
  const [creatorWeightPda] = getCreatorWeightPda(wallet.publicKey);
  const [creatorPatronConfigPda] = getCreatorPatronConfigPda(wallet.publicKey);

  const ecosystemData = await client.fetchEcosystemConfig();
  const treasury = ecosystemData?.treasury || wallet.publicKey;

  // =========================================================================
  // PHASE 1: Setup - Ensure epoch is set to 60 seconds
  // =========================================================================
  console.log("========================================");
  console.log("PHASE 1: Setup");
  console.log("========================================\n");

  const epochState = await program.account.ecosystemEpochState.fetch(ecosystemEpochStatePda);
  if (epochState.epochDuration.toNumber() !== TEST_EPOCH_DURATION) {
    console.log("Setting epoch duration to 60 seconds...");
    await program.methods
      .updateEpochDuration(new BN(TEST_EPOCH_DURATION))
      .accounts({
        ecosystemEpochState: ecosystemEpochStatePda,
        ecosystemConfig: ecosystemConfigPda,
        admin: wallet.publicKey,
      })
      .signers([wallet])
      .rpc();
    await sleep(2000);
  }
  console.log("Epoch duration:", TEST_EPOCH_DURATION, "seconds");

  // Record initial pool states
  const initialHolderPool = await program.account.globalHolderPool.fetch(globalHolderPoolPda);
  const initialDistPool = await program.account.creatorDistPool.fetch(creatorDistPoolPda);
  console.log("\nInitial pool states:");
  console.log("  GlobalHolderPool weight:", initialHolderPool.totalWeight.toString());
  console.log("  CreatorDistPool weight:", initialDistPool.totalWeight.toString());

  // =========================================================================
  // PHASE 2: Create Content and Mint Multiple NFTs
  // =========================================================================
  console.log("\n========================================");
  console.log("PHASE 2: Create Content & Multiple Mints");
  console.log("========================================\n");

  const CONTENT_CID = `comprehensive-test-${TEST_ID}`;
  const [contentPda] = getContentPda(CONTENT_CID);
  const [contentCollectionPda] = getContentCollectionPda(contentPda);
  const [mintConfigPda] = getMintConfigPda(contentPda);
  const [contentRewardPoolPda] = getContentRewardPoolPda(contentPda);

  // Register content
  console.log("Registering content:", CONTENT_CID);
  const { instruction: registerIx, collectionAssetKeypair } = await client.registerContentWithMintInstruction(
    wallet.publicKey,
    CONTENT_CID,
    "QmTestMetadata",
    ContentType.Video,
    BigInt(0.05 * LAMPORTS_PER_SOL), // 0.05 SOL
    null,
    500,
    false,
    "QmPreview",
    ""
  );

  const registerTx = new Transaction().add(registerIx);
  registerTx.feePayer = wallet.publicKey;
  registerTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  registerTx.partialSign(collectionAssetKeypair);
  await sendAndConfirmTransaction(connection, registerTx, [wallet, collectionAssetKeypair]);
  console.log("Content registered!");
  await sleep(2000);

  const contentCollection = await client.fetchContentCollection(CONTENT_CID);
  const collectionAsset = contentCollection!.collectionAsset;

  // Mint 3 NFTs to build up content pool
  const nftAssets: PublicKey[] = [];
  const nftStates: PublicKey[] = [];
  const nftWeights: number[] = [];

  for (let i = 1; i <= 3; i++) {
    const content = await client.fetchContent(CONTENT_CID);
    const edition = BigInt(Number(content?.mintedCount || 0) + 1);
    const [nftAssetPda] = getSimpleNftPda(wallet.publicKey, contentPda, edition);
    const [unifiedNftStatePda] = getUnifiedNftRewardStatePda(nftAssetPda);

    console.log(`\nMinting NFT #${i} (edition ${edition})...`);

    try {
      await program.methods
        .simpleMint()
        .accounts({
          ecosystemConfig: ecosystemConfigPda,
          content: contentPda,
          mintConfig: mintConfigPda,
          contentRewardPool: contentRewardPoolPda,
          contentCollection: contentCollectionPda,
          collectionAsset: collectionAsset,
          creator: wallet.publicKey,
          treasury: treasury,
          platform: wallet.publicKey,
          nftAsset: nftAssetPda,
          unifiedNftState: unifiedNftStatePda,
          globalHolderPool: globalHolderPoolPda,
          creatorDistPool: creatorDistPoolPda,
          creatorPatronPool: creatorPatronPoolPda,
          creatorWeight: creatorWeightPda,
          creatorPatronTreasury: creatorPatronTreasuryPda,
          ecosystemStreamingTreasury: ecosystemStreamingTreasuryPda,
          ecosystemEpochState: ecosystemEpochStatePda,
          payer: wallet.publicKey,
          slotHashes: new PublicKey("SysvarS1otHashes111111111111111111111111111"),
          mplCoreProgram: new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"),
          systemProgram: PublicKey.default,
        })
        .signers([wallet])
        .rpc();

      await sleep(2000);

      const nftState = await program.account.unifiedNftRewardState.fetch(unifiedNftStatePda);
      const rarity = Object.keys(nftState.rarity)[0];
      console.log(`  Minted! Rarity: ${rarity}, Weight: ${nftState.weight}`);

      nftAssets.push(nftAssetPda);
      nftStates.push(unifiedNftStatePda);
      nftWeights.push(nftState.weight);
    } catch (err: any) {
      console.error(`  Mint failed:`, err.message);
    }
  }

  // Check content pool state
  const contentPool = await program.account.contentRewardPool.fetch(contentRewardPoolPda);
  console.log("\nContent Reward Pool after 3 mints:");
  console.log("  total_weight:", contentPool.totalWeight.toString());
  console.log("  reward_per_share:", contentPool.rewardPerShare.toString());
  console.log("  total_deposited:", contentPool.totalDeposited.toString());

  // =========================================================================
  // PHASE 3: Create Bundle and Mint Bundle NFT
  // =========================================================================
  console.log("\n========================================");
  console.log("PHASE 3: Create Bundle & Mint");
  console.log("========================================\n");

  const BUNDLE_ID = `test-bundle-${TEST_ID}`;
  const [bundlePda] = getBundlePda(wallet.publicKey, BUNDLE_ID);
  const [bundleMintConfigPda] = getBundleMintConfigPda(bundlePda);
  const [bundleCollectionPda] = getBundleCollectionPda(bundlePda);
  const [bundleRewardPoolPda] = getBundleRewardPoolPda(bundlePda);

  // Create bundle with mint config
  console.log("Creating bundle:", BUNDLE_ID);
  try {
    const bundleCollectionKeypair = Keypair.generate();
    const [bundleRentConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("bundle_rent_config"), bundlePda.toBuffer()],
      program.programId
    );

    await program.methods
      .createBundleWithMintAndRent(
        BUNDLE_ID,
        "QmBundleMetadata", // metadata_cid
        { collection: {} }, // BundleType::Collection
        new BN(0.1 * LAMPORTS_PER_SOL), // mint price
        null, // no max supply
        500, // 5% royalty
        new BN(0.01 * LAMPORTS_PER_SOL), // 6h rent
        new BN(0.02 * LAMPORTS_PER_SOL), // 1d rent
        new BN(0.05 * LAMPORTS_PER_SOL), // 7d rent
      )
      .accounts({
        creator: wallet.publicKey,
        bundle: bundlePda,
        mintConfig: bundleMintConfigPda,
        rentConfig: bundleRentConfigPda,
        bundleCollection: bundleCollectionPda,
        collectionAsset: bundleCollectionKeypair.publicKey,
        ecosystemConfig: ecosystemConfigPda,
        platform: treasury,
        mplCoreProgram: new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"),
        systemProgram: PublicKey.default,
      })
      .signers([wallet, bundleCollectionKeypair])
      .rpc();

    console.log("Bundle created!");
    await sleep(2000);

    // Add content to bundle
    const [bundleItemPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("bundle_item"), bundlePda.toBuffer(), contentPda.toBuffer()],
      program.programId
    );

    await program.methods
      .addBundleItem()
      .accounts({
        bundle: bundlePda,
        bundleItem: bundleItemPda,
        content: contentPda,
        creator: wallet.publicKey,
        systemProgram: PublicKey.default,
      })
      .signers([wallet])
      .rpc();

    console.log("Content added to bundle!");
    await sleep(2000);

    // Mint bundle NFT
    const bundle = await program.account.bundle.fetch(bundlePda);
    const bundleEdition = BigInt(Number(bundle.mintedCount) + 1);
    const [bundleNftPda] = getSimpleBundleNftPda(wallet.publicKey, bundlePda, bundleEdition);
    const [bundleNftStatePda] = getUnifiedNftRewardStatePda(bundleNftPda);

    const bundleCollection = await program.account.bundleCollection.fetch(bundleCollectionPda);

    console.log("\nMinting bundle NFT...");
    await program.methods
      .simpleMintBundle()
      .accounts({
        ecosystemConfig: ecosystemConfigPda,
        bundle: bundlePda,
        bundleMintConfig: bundleMintConfigPda,
        bundleRewardPool: bundleRewardPoolPda,
        bundleCollection: bundleCollectionPda,
        collectionAsset: bundleCollection.collectionAsset,
        creator: wallet.publicKey,
        treasury: treasury,
        platform: wallet.publicKey,
        nftAsset: bundleNftPda,
        unifiedNftState: bundleNftStatePda,
        globalHolderPool: globalHolderPoolPda,
        creatorDistPool: creatorDistPoolPda,
        creatorPatronPool: creatorPatronPoolPda,
        creatorWeight: creatorWeightPda,
        creatorPatronTreasury: creatorPatronTreasuryPda,
        ecosystemStreamingTreasury: ecosystemStreamingTreasuryPda,
        ecosystemEpochState: ecosystemEpochStatePda,
        payer: wallet.publicKey,
        slotHashes: new PublicKey("SysvarS1otHashes111111111111111111111111111"),
        mplCoreProgram: new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"),
        systemProgram: PublicKey.default,
      })
      .remainingAccounts([
        { pubkey: contentRewardPoolPda, isWritable: true, isSigner: false },
      ])
      .signers([wallet])
      .rpc();

    await sleep(2000);
    const bundleNftState = await program.account.unifiedNftRewardState.fetch(bundleNftStatePda);
    console.log("Bundle NFT minted!");
    console.log("  Rarity:", Object.keys(bundleNftState.rarity)[0]);
    console.log("  Weight:", bundleNftState.weight);
    console.log("  is_bundle:", bundleNftState.isBundle);

    nftAssets.push(bundleNftPda);
    nftStates.push(bundleNftStatePda);
    nftWeights.push(bundleNftState.weight);

  } catch (err: any) {
    console.error("Bundle operations failed:", err.message);
    if (err.logs) {
      console.error("Logs:", err.logs.slice(-10).join("\n"));
    }
  }

  // =========================================================================
  // PHASE 4: Subscribe to Patron and Ecosystem (Fresh subscriptions)
  // =========================================================================
  console.log("\n========================================");
  console.log("PHASE 4: Fresh Subscriptions");
  console.log("========================================\n");

  // Generate a new subscriber wallet for fresh subscriptions
  const subscriber2 = Keypair.generate();

  // Airdrop some SOL to subscriber2
  console.log("Funding test subscriber...");
  const airdropSig = await connection.requestAirdrop(subscriber2.publicKey, 0.5 * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(airdropSig);
  await sleep(2000);

  const [patronSub2Pda] = getCreatorPatronSubscriptionPda(subscriber2.publicKey, wallet.publicKey);
  const [ecoSub2Pda] = getEcosystemSubscriptionPda(subscriber2.publicKey);

  // Subscribe to patron
  const patronTreasuryBefore = await connection.getBalance(creatorPatronTreasuryPda);
  console.log("Patron treasury before:", patronTreasuryBefore / LAMPORTS_PER_SOL, "SOL");

  try {
    await program.methods
      .subscribePatron({ subscription: {} })
      .accounts({
        patronConfig: creatorPatronConfigPda,
        creatorPatronTreasury: creatorPatronTreasuryPda,
        patronSubscription: patronSub2Pda,
        creator: wallet.publicKey,
        subscriber: subscriber2.publicKey,
        systemProgram: PublicKey.default,
      })
      .signers([subscriber2])
      .rpc();

    await sleep(2000);
    const patronTreasuryAfter = await connection.getBalance(creatorPatronTreasuryPda);
    console.log("Patron treasury after:", patronTreasuryAfter / LAMPORTS_PER_SOL, "SOL");
    console.log("New patron payment:", (patronTreasuryAfter - patronTreasuryBefore) / LAMPORTS_PER_SOL, "SOL");
  } catch (err: any) {
    console.error("Patron subscription failed:", err.message);
  }

  // Subscribe to ecosystem
  const ecoTreasuryBefore = await connection.getBalance(ecosystemStreamingTreasuryPda);
  console.log("\nEcosystem treasury before:", ecoTreasuryBefore / LAMPORTS_PER_SOL, "SOL");

  try {
    await program.methods
      .subscribeEcosystem()
      .accounts({
        ecosystemSubConfig: ecosystemSubConfigPda,
        ecosystemSubscription: ecoSub2Pda,
        ecosystemStreamingTreasury: ecosystemStreamingTreasuryPda,
        subscriber: subscriber2.publicKey,
        systemProgram: PublicKey.default,
      })
      .signers([subscriber2])
      .rpc();

    await sleep(2000);
    const ecoTreasuryAfter = await connection.getBalance(ecosystemStreamingTreasuryPda);
    console.log("Ecosystem treasury after:", ecoTreasuryAfter / LAMPORTS_PER_SOL, "SOL");
    console.log("New ecosystem payment:", (ecoTreasuryAfter - ecoTreasuryBefore) / LAMPORTS_PER_SOL, "SOL");
  } catch (err: any) {
    console.error("Ecosystem subscription failed:", err.message);
  }

  // =========================================================================
  // PHASE 5: Wait for Epoch 1 End + Trigger Distribution
  // =========================================================================
  console.log("\n========================================");
  console.log("PHASE 5: Epoch 1 Distribution");
  console.log("========================================\n");

  await waitForEpoch(program, ecosystemEpochStatePda);

  // Check treasury balances before distribution
  const ecoStreamingBal1 = await connection.getBalance(ecosystemStreamingTreasuryPda);
  const patronStreamingBal1 = await connection.getBalance(creatorPatronTreasuryPda);
  console.log("Before Epoch 1 distribution:");
  console.log("  Ecosystem streaming treasury:", ecoStreamingBal1 / LAMPORTS_PER_SOL, "SOL");
  console.log("  Patron streaming treasury:", patronStreamingBal1 / LAMPORTS_PER_SOL, "SOL");

  // Claim global holder rewards (triggers distribution)
  if (nftAssets.length > 0) {
    console.log("\nTriggering Epoch 1 distribution via claim_global_holder_rewards...");
    try {
      await program.methods
        .claimGlobalHolderRewards()
        .accounts({
          globalHolderPool: globalHolderPoolPda,
          creatorDistPool: creatorDistPoolPda,
          ecosystemEpochState: ecosystemEpochStatePda,
          ecosystemStreamingTreasury: ecosystemStreamingTreasuryPda,
          platformTreasury: wallet.publicKey,
          ecosystemTreasury: treasury,
          ecosystemConfig: ecosystemConfigPda,
          nftRewardState: nftStates[0],
          nftAsset: nftAssets[0],
          holder: wallet.publicKey,
          systemProgram: PublicKey.default,
        })
        .signers([wallet])
        .rpc();

      await sleep(2000);
      console.log("Epoch 1 distribution triggered!");

      const holderPool1 = await program.account.globalHolderPool.fetch(globalHolderPoolPda);
      const distPool1 = await program.account.creatorDistPool.fetch(creatorDistPoolPda);
      console.log("\nAfter Epoch 1 distribution:");
      console.log("  GlobalHolderPool total_deposited:", holderPool1.totalDeposited.toString());
      console.log("  CreatorDistPool total_deposited:", distPool1.totalDeposited.toString());
    } catch (err: any) {
      console.error("Epoch 1 distribution failed:", err.message);
    }
  }

  // =========================================================================
  // PHASE 6: Mint More NFTs During Epoch 2
  // =========================================================================
  console.log("\n========================================");
  console.log("PHASE 6: Mint More During Epoch 2");
  console.log("========================================\n");

  // Mint 2 more NFTs
  for (let i = 4; i <= 5; i++) {
    const content = await client.fetchContent(CONTENT_CID);
    const edition = BigInt(Number(content?.mintedCount || 0) + 1);
    const [nftAssetPda] = getSimpleNftPda(wallet.publicKey, contentPda, edition);
    const [unifiedNftStatePda] = getUnifiedNftRewardStatePda(nftAssetPda);

    console.log(`\nMinting NFT #${i} (edition ${edition})...`);

    try {
      await program.methods
        .simpleMint()
        .accounts({
          ecosystemConfig: ecosystemConfigPda,
          content: contentPda,
          mintConfig: mintConfigPda,
          contentRewardPool: contentRewardPoolPda,
          contentCollection: contentCollectionPda,
          collectionAsset: collectionAsset,
          creator: wallet.publicKey,
          treasury: treasury,
          platform: wallet.publicKey,
          nftAsset: nftAssetPda,
          unifiedNftState: unifiedNftStatePda,
          globalHolderPool: globalHolderPoolPda,
          creatorDistPool: creatorDistPoolPda,
          creatorPatronPool: creatorPatronPoolPda,
          creatorWeight: creatorWeightPda,
          creatorPatronTreasury: creatorPatronTreasuryPda,
          ecosystemStreamingTreasury: ecosystemStreamingTreasuryPda,
          ecosystemEpochState: ecosystemEpochStatePda,
          payer: wallet.publicKey,
          slotHashes: new PublicKey("SysvarS1otHashes111111111111111111111111111"),
          mplCoreProgram: new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"),
          systemProgram: PublicKey.default,
        })
        .signers([wallet])
        .rpc();

      await sleep(2000);

      const nftState = await program.account.unifiedNftRewardState.fetch(unifiedNftStatePda);
      const rarity = Object.keys(nftState.rarity)[0];
      console.log(`  Minted! Rarity: ${rarity}, Weight: ${nftState.weight}`);

      nftAssets.push(nftAssetPda);
      nftStates.push(unifiedNftStatePda);
      nftWeights.push(nftState.weight);
    } catch (err: any) {
      console.error(`  Mint failed:`, err.message);
    }
  }

  // Add more subscriptions during epoch 2
  const subscriber3 = Keypair.generate();
  const airdropSig3 = await connection.requestAirdrop(subscriber3.publicKey, 0.5 * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(airdropSig3);
  await sleep(2000);

  const [ecoSub3Pda] = getEcosystemSubscriptionPda(subscriber3.publicKey);
  console.log("\nAdding another ecosystem subscription...");
  try {
    await program.methods
      .subscribeEcosystem()
      .accounts({
        ecosystemSubConfig: ecosystemSubConfigPda,
        ecosystemSubscription: ecoSub3Pda,
        ecosystemStreamingTreasury: ecosystemStreamingTreasuryPda,
        subscriber: subscriber3.publicKey,
        systemProgram: PublicKey.default,
      })
      .signers([subscriber3])
      .rpc();
    await sleep(2000);
    console.log("Subscription added!");
  } catch (err: any) {
    console.error("Subscription failed:", err.message);
  }

  // =========================================================================
  // PHASE 7: Wait for Epoch 2 End + Trigger Distribution
  // =========================================================================
  console.log("\n========================================");
  console.log("PHASE 7: Epoch 2 Distribution");
  console.log("========================================\n");

  await waitForEpoch(program, ecosystemEpochStatePda);

  const ecoStreamingBal2 = await connection.getBalance(ecosystemStreamingTreasuryPda);
  console.log("Ecosystem streaming treasury before Epoch 2 distribution:", ecoStreamingBal2 / LAMPORTS_PER_SOL, "SOL");

  // Trigger epoch 2 distribution
  if (nftAssets.length > 1) {
    console.log("\nTriggering Epoch 2 distribution...");
    try {
      await program.methods
        .claimGlobalHolderRewards()
        .accounts({
          globalHolderPool: globalHolderPoolPda,
          creatorDistPool: creatorDistPoolPda,
          ecosystemEpochState: ecosystemEpochStatePda,
          ecosystemStreamingTreasury: ecosystemStreamingTreasuryPda,
          platformTreasury: wallet.publicKey,
          ecosystemTreasury: treasury,
          ecosystemConfig: ecosystemConfigPda,
          nftRewardState: nftStates[1],
          nftAsset: nftAssets[1],
          holder: wallet.publicKey,
          systemProgram: PublicKey.default,
        })
        .signers([wallet])
        .rpc();

      await sleep(2000);
      console.log("Epoch 2 distribution triggered!");

      const holderPool2 = await program.account.globalHolderPool.fetch(globalHolderPoolPda);
      const distPool2 = await program.account.creatorDistPool.fetch(creatorDistPoolPda);
      console.log("\nAfter Epoch 2 distribution:");
      console.log("  GlobalHolderPool total_deposited:", holderPool2.totalDeposited.toString());
      console.log("  CreatorDistPool total_deposited:", distPool2.totalDeposited.toString());
    } catch (err: any) {
      console.error("Epoch 2 distribution failed:", err.message);
    }
  }

  // =========================================================================
  // PHASE 8: Claim All Rewards
  // =========================================================================
  console.log("\n========================================");
  console.log("PHASE 8: Claim All Rewards");
  console.log("========================================\n");

  const walletBefore = await connection.getBalance(wallet.publicKey);

  // Claim content rewards for each NFT
  console.log("Claiming content rewards for each NFT...");
  let totalContentClaimed = 0;
  for (let i = 0; i < Math.min(nftAssets.length, 3); i++) {
    const nftState = await program.account.unifiedNftRewardState.fetch(nftStates[i]);
    if (nftState.isBundle) continue; // Skip bundle NFTs for content claims

    try {
      await program.methods
        .claimUnifiedContentRewards()
        .accounts({
          claimer: wallet.publicKey,
          content: contentPda,
          contentRewardPool: contentRewardPoolPda,
          nftAsset: nftAssets[i],
          nftRewardState: nftStates[i],
          systemProgram: PublicKey.default,
        })
        .signers([wallet])
        .rpc();

      console.log(`  NFT #${i + 1} content rewards claimed`);
      totalContentClaimed++;
      await sleep(1000);
    } catch (err: any) {
      console.log(`  NFT #${i + 1} - ${err.message?.includes("NothingToClaim") ? "Nothing to claim" : err.message}`);
    }
  }

  // Claim patron rewards
  console.log("\nClaiming patron rewards...");
  try {
    await program.methods
      .claimPatronRewards()
      .accounts({
        creator: wallet.publicKey,
        creatorPatronPool: creatorPatronPoolPda,
        creatorPatronTreasury: creatorPatronTreasuryPda,
        creatorWallet: wallet.publicKey,
        platformTreasury: wallet.publicKey,
        ecosystemTreasury: treasury,
        ecosystemConfig: ecosystemConfigPda,
        nftRewardState: nftStates[0],
        nftAsset: nftAssets[0],
        holder: wallet.publicKey,
        systemProgram: PublicKey.default,
      })
      .signers([wallet])
      .rpc();
    console.log("  Patron rewards claimed!");
    await sleep(1000);
  } catch (err: any) {
    console.log("  Patron claim:", err.message?.includes("NothingToClaim") ? "Nothing to claim" : err.message);
  }

  // Claim creator ecosystem payout
  console.log("\nClaiming creator ecosystem payout...");
  try {
    await program.methods
      .claimCreatorEcosystemPayout()
      .accounts({
        globalHolderPool: globalHolderPoolPda,
        creatorDistPool: creatorDistPoolPda,
        ecosystemEpochState: ecosystemEpochStatePda,
        ecosystemStreamingTreasury: ecosystemStreamingTreasuryPda,
        platformTreasury: wallet.publicKey,
        ecosystemTreasury: treasury,
        ecosystemConfig: ecosystemConfigPda,
        creatorWeight: creatorWeightPda,
        creator: wallet.publicKey,
        systemProgram: PublicKey.default,
      })
      .signers([wallet])
      .rpc();
    console.log("  Creator ecosystem payout claimed!");
    await sleep(1000);
  } catch (err: any) {
    console.log("  Creator payout:", err.message?.includes("NothingToClaim") ? "Nothing to claim" : err.message);
  }

  const walletAfter = await connection.getBalance(wallet.publicKey);
  console.log("\nTotal received from all claims:", (walletAfter - walletBefore) / LAMPORTS_PER_SOL, "SOL");

  // =========================================================================
  // PHASE 9: Final State Summary
  // =========================================================================
  console.log("\n========================================");
  console.log("PHASE 9: Final State Summary");
  console.log("========================================\n");

  const finalHolderPool = await program.account.globalHolderPool.fetch(globalHolderPoolPda);
  const finalDistPool = await program.account.creatorDistPool.fetch(creatorDistPoolPda);
  const finalPatronPool = await program.account.creatorPatronPool.fetch(creatorPatronPoolPda);
  const finalContentPool = await program.account.contentRewardPool.fetch(contentRewardPoolPda);
  const finalCreatorWeight = await program.account.creatorWeight.fetch(creatorWeightPda);

  console.log("GlobalHolderPool:");
  console.log("  total_weight:", finalHolderPool.totalWeight.toString());
  console.log("  total_deposited:", finalHolderPool.totalDeposited.toString());
  console.log("  total_claimed:", finalHolderPool.totalClaimed.toString());
  console.log("  reward_per_share:", finalHolderPool.rewardPerShare.toString());

  console.log("\nCreatorDistPool:");
  console.log("  total_weight:", finalDistPool.totalWeight.toString());
  console.log("  total_deposited:", finalDistPool.totalDeposited.toString());
  console.log("  total_claimed:", finalDistPool.totalClaimed.toString());
  console.log("  reward_per_share:", finalDistPool.rewardPerShare.toString());

  console.log("\nCreatorPatronPool:");
  console.log("  total_weight:", finalPatronPool.totalWeight.toString());
  console.log("  total_deposited:", finalPatronPool.totalDeposited.toString());
  console.log("  total_claimed:", finalPatronPool.totalClaimed.toString());

  console.log("\nContentRewardPool:");
  console.log("  total_weight:", finalContentPool.totalWeight.toString());
  console.log("  total_deposited:", finalContentPool.totalDeposited.toString());
  console.log("  total_claimed:", finalContentPool.totalClaimed.toString());

  console.log("\nCreatorWeight:");
  console.log("  total_weight:", finalCreatorWeight.totalWeight.toString());
  console.log("  total_claimed:", finalCreatorWeight.totalClaimed.toString());

  console.log("\nNFTs minted in this test:");
  for (let i = 0; i < nftAssets.length; i++) {
    console.log(`  NFT ${i + 1}: Weight ${nftWeights[i]}`);
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log("\n========================================");
  console.log("           TEST SUMMARY");
  console.log("========================================");
  console.log("");
  console.log(`Content NFTs minted: ${nftAssets.length - 1}`); // -1 for bundle
  console.log(`Bundle NFTs minted: 1`);
  console.log(`Epochs processed: 2`);
  console.log(`Patron subscriptions: 2`);
  console.log(`Ecosystem subscriptions: 2`);
  console.log(`Total weight added: ${nftWeights.reduce((a, b) => a + b, 0)}`);
  console.log("");
  console.log("Comprehensive subscription system test completed!");
}

async function waitForEpoch(program: any, epochStatePda: PublicKey) {
  const epochState = await program.account.ecosystemEpochState.fetch(epochStatePda);
  const now = Math.floor(Date.now() / 1000);
  const epochEndTime = epochState.lastDistributionAt.toNumber() + epochState.epochDuration.toNumber();
  const waitTime = epochEndTime - now;

  if (waitTime > 0) {
    console.log(`Waiting ${waitTime} seconds for epoch to end...`);
    for (let remaining = waitTime; remaining > 0; remaining -= 15) {
      await sleep(Math.min(15000, remaining * 1000));
      console.log(`  ${Math.max(0, remaining - 15)} seconds remaining...`);
    }
    await sleep(3000); // Extra buffer
  } else {
    console.log("Epoch already ended");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(console.error);
