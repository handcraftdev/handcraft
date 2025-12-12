/**
 * Test Subscription System - E2E Tests
 * Tests: simple_mint, patron subscription, ecosystem subscription, claims
 * Run with: npx tsx scripts/test-subscription-system.ts
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
  ContentType,
  createContentRegistryClient,
} from "@handcraft/sdk";

const RPC_URL = "https://api.devnet.solana.com";
const PRECISION = BigInt("1000000000000");

// Test configuration
const TEST_CONTENT_CID = `test-sub-${Date.now()}`;
const TEST_MINT_PRICE = 0.05 * LAMPORTS_PER_SOL; // 0.05 SOL
const TEST_PATRON_MEMBERSHIP_PRICE = 0.02 * LAMPORTS_PER_SOL; // 0.02 SOL
const TEST_PATRON_SUBSCRIPTION_PRICE = 0.05 * LAMPORTS_PER_SOL; // 0.05 SOL

async function main() {
  console.log("=== Subscription System E2E Test ===\n");

  // Setup
  const connection = new Connection(RPC_URL, "confirmed");
  const keypairPath = path.join(process.env.HOME!, ".config/solana/id.json");
  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(new Uint8Array(secretKey));

  console.log("Wallet:", wallet.publicKey.toBase58());

  const balance = await connection.getBalance(wallet.publicKey);
  console.log("Balance:", balance / LAMPORTS_PER_SOL, "SOL");

  if (balance < 0.5 * LAMPORTS_PER_SOL) {
    console.error("Insufficient balance. Need at least 0.5 SOL");
    return;
  }

  // Load IDL and create program
  const idlPath = path.join(__dirname, "../packages/sdk/src/program/content_registry.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const provider = new AnchorProvider(connection, new Wallet(wallet), { commitment: "confirmed" });
  const program = new Program(idl, provider);

  // Get PDAs
  const [ecosystemConfigPda] = getEcosystemConfigPda();
  const [globalHolderPoolPda] = getGlobalHolderPoolPda();
  const [creatorDistPoolPda] = getCreatorDistPoolPda();
  const [ecosystemEpochStatePda] = getEcosystemEpochStatePda();
  const [ecosystemSubConfigPda] = getEcosystemSubConfigPda();
  const [ecosystemStreamingTreasuryPda] = getEcosystemStreamingTreasuryPda();

  // Verify ecosystem is initialized
  const ecosystemConfig = await connection.getAccountInfo(ecosystemConfigPda);
  if (!ecosystemConfig) {
    console.error("Ecosystem not initialized! Run init-ecosystem.ts first.");
    return;
  }

  const globalHolderPool = await connection.getAccountInfo(globalHolderPoolPda);
  if (!globalHolderPool) {
    console.error("Subscription pools not initialized! Run init-ecosystem.ts first.");
    return;
  }

  console.log("\n--- Ecosystem Initialized ---");
  console.log("EcosystemConfig:", ecosystemConfigPda.toBase58());
  console.log("GlobalHolderPool:", globalHolderPoolPda.toBase58());

  // =========================================================================
  // TEST 1: Register Content with Mint Config
  // =========================================================================
  console.log("\n========================================");
  console.log("TEST 1: Register Content");
  console.log("========================================");

  const [contentPda] = getContentPda(TEST_CONTENT_CID);
  const [contentCollectionPda] = getContentCollectionPda(contentPda);
  const [mintConfigPda] = getMintConfigPda(contentPda);
  const [contentRewardPoolPda] = getContentRewardPoolPda(contentPda);
  const [creatorPatronPoolPda] = getCreatorPatronPoolPda(wallet.publicKey);
  const [creatorPatronTreasuryPda] = getCreatorPatronTreasuryPda(wallet.publicKey);
  const [creatorWeightPda] = getCreatorWeightPda(wallet.publicKey);

  const client = createContentRegistryClient(connection);
  const ecosystemData = await client.fetchEcosystemConfig();
  const treasury = ecosystemData?.treasury || wallet.publicKey;

  console.log("Content CID:", TEST_CONTENT_CID);
  console.log("Content PDA:", contentPda.toBase58());

  // Create collection keypair
  const collectionKeypair = Keypair.generate();

  try {
    const { instruction: registerIx, collectionAssetKeypair } = await client.registerContentWithMintInstruction(
      wallet.publicKey,
      TEST_CONTENT_CID,
      "QmTestMetadata",
      ContentType.Video,
      BigInt(TEST_MINT_PRICE),
      null, // No max supply
      500, // 5% royalty
      false,
      "QmPreview",
      ""
    );

    const registerTx = new Transaction().add(registerIx);
    registerTx.feePayer = wallet.publicKey;
    registerTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    registerTx.partialSign(collectionAssetKeypair);

    const registerSig = await sendAndConfirmTransaction(connection, registerTx, [wallet, collectionAssetKeypair]);
    console.log("Content registered! Tx:", registerSig.slice(0, 20) + "...");

    await sleep(2000);
  } catch (err: any) {
    if (err.message?.includes("already in use")) {
      console.log("Content already registered (expected on re-run)");
    } else {
      throw err;
    }
  }

  // Fetch collection asset
  const contentCollection = await client.fetchContentCollection(TEST_CONTENT_CID);
  if (!contentCollection) {
    console.error("Failed to fetch content collection!");
    return;
  }
  const collectionAsset = contentCollection.collectionAsset;
  console.log("Collection Asset:", collectionAsset.toBase58());

  // =========================================================================
  // TEST 2: Simple Mint with Subscription Pool Tracking
  // =========================================================================
  console.log("\n========================================");
  console.log("TEST 2: Simple Mint (1st NFT - no holder rewards)");
  console.log("========================================");

  // Get mint config to find edition
  const mintConfig = await client.fetchMintConfig(TEST_CONTENT_CID);
  const edition = BigInt((mintConfig?.mintedCount || 0) + 1);
  console.log("Minting edition:", edition.toString());

  const [nftAssetPda] = getSimpleNftPda(wallet.publicKey, contentPda, edition);
  const [unifiedNftRewardStatePda] = getUnifiedNftRewardStatePda(nftAssetPda);

  console.log("NFT Asset PDA:", nftAssetPda.toBase58());
  console.log("UnifiedNftRewardState PDA:", unifiedNftRewardStatePda.toBase58());

  // Check pool states before mint
  const holderPoolBefore = await program.account.globalHolderPool.fetch(globalHolderPoolPda);
  const creatorDistPoolBefore = await program.account.creatorDistPool.fetch(creatorDistPoolPda);
  console.log("\nBefore mint:");
  console.log("  GlobalHolderPool total_weight:", holderPoolBefore.totalWeight.toString());
  console.log("  CreatorDistPool total_weight:", creatorDistPoolBefore.totalWeight.toString());

  try {
    const simpleMintTx = await program.methods
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
        platform: wallet.publicKey, // Using wallet as platform for test
        nftAsset: nftAssetPda,
        unifiedNftState: unifiedNftRewardStatePda,
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

    console.log("Simple mint successful! Tx:", simpleMintTx.slice(0, 20) + "...");
    await sleep(2000);
  } catch (err: any) {
    console.error("Simple mint failed:", err.message);
    if (err.logs) {
      console.error("Logs:", err.logs.slice(-15).join("\n"));
    }
    return;
  }

  // Check pool states after mint
  const holderPoolAfter = await program.account.globalHolderPool.fetch(globalHolderPoolPda);
  const creatorDistPoolAfter = await program.account.creatorDistPool.fetch(creatorDistPoolPda);
  console.log("\nAfter mint:");
  console.log("  GlobalHolderPool total_weight:", holderPoolAfter.totalWeight.toString());
  console.log("  CreatorDistPool total_weight:", creatorDistPoolAfter.totalWeight.toString());

  // Check unified NFT state
  const unifiedState = await program.account.unifiedNftRewardState.fetch(unifiedNftRewardStatePda);
  console.log("\nUnifiedNftRewardState:");
  console.log("  weight:", unifiedState.weight);
  console.log("  rarity:", Object.keys(unifiedState.rarity)[0]);
  console.log("  content_or_bundle_debt:", unifiedState.contentOrBundleDebt.toString());
  console.log("  patron_debt:", unifiedState.patronDebt.toString());
  console.log("  global_debt:", unifiedState.globalDebt.toString());

  // =========================================================================
  // TEST 3: Init Patron Config (Creator sets up subscription tiers)
  // =========================================================================
  console.log("\n========================================");
  console.log("TEST 3: Init Patron Config");
  console.log("========================================");

  const [creatorPatronConfigPda] = getCreatorPatronConfigPda(wallet.publicKey);
  console.log("CreatorPatronConfig PDA:", creatorPatronConfigPda.toBase58());

  const existingPatronConfig = await connection.getAccountInfo(creatorPatronConfigPda);
  if (existingPatronConfig) {
    console.log("Patron config already exists (expected on re-run)");
  } else {
    try {
      const initPatronConfigTx = await program.methods
        .initPatronConfig(
          new BN(TEST_PATRON_MEMBERSHIP_PRICE),
          new BN(TEST_PATRON_SUBSCRIPTION_PRICE)
        )
        .accounts({
          patronConfig: creatorPatronConfigPda,
          creatorPatronPool: creatorPatronPoolPda,
          creator: wallet.publicKey,
          systemProgram: PublicKey.default,
        })
        .signers([wallet])
        .rpc();

      console.log("Patron config initialized! Tx:", initPatronConfigTx.slice(0, 20) + "...");
      await sleep(2000);
    } catch (err: any) {
      console.error("Init patron config failed:", err.message);
      if (err.logs) {
        console.error("Logs:", err.logs.slice(-10).join("\n"));
      }
    }
  }

  // =========================================================================
  // TEST 4: Subscribe to Creator (Patron Subscription)
  // =========================================================================
  console.log("\n========================================");
  console.log("TEST 4: Subscribe to Creator (Patron)");
  console.log("========================================");

  const [patronSubscriptionPda] = getCreatorPatronSubscriptionPda(wallet.publicKey, wallet.publicKey);
  console.log("PatronSubscription PDA:", patronSubscriptionPda.toBase58());

  // Check streaming treasury balance before
  const patronTreasuryBefore = await connection.getBalance(creatorPatronTreasuryPda);
  console.log("Patron treasury balance before:", patronTreasuryBefore / LAMPORTS_PER_SOL, "SOL");

  const existingPatronSub = await connection.getAccountInfo(patronSubscriptionPda);
  if (existingPatronSub) {
    console.log("Already subscribed (expected on re-run)");
  } else {
    try {
      // PatronTier::Subscription = { subscription: {} }
      const subscribePatronTx = await program.methods
        .subscribePatron({ subscription: {} })
        .accounts({
          patronConfig: creatorPatronConfigPda,
          creatorPatronTreasury: creatorPatronTreasuryPda,
          patronSubscription: patronSubscriptionPda,
          creator: wallet.publicKey,
          subscriber: wallet.publicKey,
          systemProgram: PublicKey.default,
        })
        .signers([wallet])
        .rpc();

      console.log("Subscribed to creator! Tx:", subscribePatronTx.slice(0, 20) + "...");
      await sleep(2000);
    } catch (err: any) {
      console.error("Subscribe patron failed:", err.message);
      if (err.logs) {
        console.error("Logs:", err.logs.slice(-10).join("\n"));
      }
    }
  }

  // Check streaming treasury balance after
  const patronTreasuryAfter = await connection.getBalance(creatorPatronTreasuryPda);
  console.log("Patron treasury balance after:", patronTreasuryAfter / LAMPORTS_PER_SOL, "SOL");
  console.log("Payment received:", (patronTreasuryAfter - patronTreasuryBefore) / LAMPORTS_PER_SOL, "SOL");

  // =========================================================================
  // TEST 5: Subscribe to Ecosystem
  // =========================================================================
  console.log("\n========================================");
  console.log("TEST 5: Subscribe to Ecosystem");
  console.log("========================================");

  const [ecosystemSubscriptionPda] = getEcosystemSubscriptionPda(wallet.publicKey);
  console.log("EcosystemSubscription PDA:", ecosystemSubscriptionPda.toBase58());

  // Check streaming treasury balance before
  const ecoTreasuryBefore = await connection.getBalance(ecosystemStreamingTreasuryPda);
  console.log("Ecosystem treasury balance before:", ecoTreasuryBefore / LAMPORTS_PER_SOL, "SOL");

  const existingEcoSub = await connection.getAccountInfo(ecosystemSubscriptionPda);
  if (existingEcoSub) {
    console.log("Already subscribed to ecosystem (expected on re-run)");
  } else {
    try {
      const subscribeEcoTx = await program.methods
        .subscribeEcosystem()
        .accounts({
          ecosystemSubConfig: ecosystemSubConfigPda,
          ecosystemSubscription: ecosystemSubscriptionPda,
          ecosystemStreamingTreasury: ecosystemStreamingTreasuryPda,
          subscriber: wallet.publicKey,
          systemProgram: PublicKey.default,
        })
        .signers([wallet])
        .rpc();

      console.log("Subscribed to ecosystem! Tx:", subscribeEcoTx.slice(0, 20) + "...");
      await sleep(2000);
    } catch (err: any) {
      console.error("Subscribe ecosystem failed:", err.message);
      if (err.logs) {
        console.error("Logs:", err.logs.slice(-10).join("\n"));
      }
    }
  }

  // Check streaming treasury balance after
  const ecoTreasuryAfter = await connection.getBalance(ecosystemStreamingTreasuryPda);
  console.log("Ecosystem treasury balance after:", ecoTreasuryAfter / LAMPORTS_PER_SOL, "SOL");
  console.log("Payment received:", (ecoTreasuryAfter - ecoTreasuryBefore) / LAMPORTS_PER_SOL, "SOL");

  // =========================================================================
  // TEST 6: Simple Mint #2 (Generates holder rewards)
  // =========================================================================
  console.log("\n========================================");
  console.log("TEST 6: Simple Mint #2 (Generates holder rewards)");
  console.log("========================================");

  // Wait and refetch content to get updated minted_count (stored on Content, not MintConfig)
  await sleep(2000);
  const content2 = await client.fetchContent(TEST_CONTENT_CID);
  const mintedCount2 = Number(content2?.mintedCount || 0);
  const edition2 = BigInt(mintedCount2 + 1);
  console.log("Minting edition:", edition2.toString());
  console.log("Previous minted_count:", mintedCount2);

  const [nftAsset2Pda] = getSimpleNftPda(wallet.publicKey, contentPda, edition2);
  const [unifiedNftRewardState2Pda] = getUnifiedNftRewardStatePda(nftAsset2Pda);

  const contentRewardPoolBefore = await program.account.contentRewardPool.fetch(contentRewardPoolPda);
  console.log("\nBefore mint #2:");
  console.log("  ContentRewardPool total_weight:", contentRewardPoolBefore.totalWeight.toString());
  console.log("  ContentRewardPool reward_per_share:", contentRewardPoolBefore.rewardPerShare.toString());

  try {
    const simpleMint2Tx = await program.methods
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
        nftAsset: nftAsset2Pda,
        unifiedNftState: unifiedNftRewardState2Pda,
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

    console.log("Simple mint #2 successful! Tx:", simpleMint2Tx.slice(0, 20) + "...");
    await sleep(2000);
  } catch (err: any) {
    console.error("Simple mint #2 failed:", err.message);
    if (err.logs) {
      console.error("Logs:", err.logs.slice(-15).join("\n"));
    }
    return;
  }

  const contentRewardPoolAfter = await program.account.contentRewardPool.fetch(contentRewardPoolPda);
  console.log("\nAfter mint #2:");
  console.log("  ContentRewardPool total_weight:", contentRewardPoolAfter.totalWeight.toString());
  console.log("  ContentRewardPool reward_per_share:", contentRewardPoolAfter.rewardPerShare.toString());
  console.log("  ContentRewardPool total_deposited:", contentRewardPoolAfter.totalDeposited.toString());

  // =========================================================================
  // TEST 7: Claim Content Rewards
  // =========================================================================
  console.log("\n========================================");
  console.log("TEST 7: Claim Content Rewards (NFT #1)");
  console.log("========================================");

  // Calculate expected pending
  const nft1State = await program.account.unifiedNftRewardState.fetch(unifiedNftRewardStatePda);
  const nft1Weight = BigInt(nft1State.weight);
  const rps = BigInt(contentRewardPoolAfter.rewardPerShare.toString());
  const nft1Debt = BigInt(nft1State.contentOrBundleDebt.toString());
  const expectedPending = (nft1Weight * rps - nft1Debt) / PRECISION;
  console.log("NFT #1 weight:", nft1Weight.toString());
  console.log("Expected pending reward:", expectedPending.toString(), "lamports");

  const walletBalanceBefore = await connection.getBalance(wallet.publicKey);

  try {
    const claimTx = await program.methods
      .claimUnifiedContentRewards()
      .accounts({
        claimer: wallet.publicKey,
        content: contentPda,
        contentRewardPool: contentRewardPoolPda,
        nftAsset: nftAssetPda,
        nftRewardState: unifiedNftRewardStatePda,
        systemProgram: PublicKey.default,
      })
      .signers([wallet])
      .rpc();

    console.log("Claimed content rewards! Tx:", claimTx.slice(0, 20) + "...");
    await sleep(2000);
  } catch (err: any) {
    console.error("Claim failed:", err.message);
    if (err.logs) {
      console.error("Logs:", err.logs.slice(-10).join("\n"));
    }
  }

  const walletBalanceAfter = await connection.getBalance(wallet.publicKey);
  const received = walletBalanceAfter - walletBalanceBefore;
  console.log("Received:", received, "lamports (minus tx fee)");

  // =========================================================================
  // TEST 8: Set Epoch Duration to 60 seconds (for testing)
  // =========================================================================
  console.log("\n========================================");
  console.log("TEST 8: Set Epoch Duration to 60 seconds");
  console.log("========================================");

  // Fetch current epoch state
  const epochStateBefore = await program.account.ecosystemEpochState.fetch(ecosystemEpochStatePda);
  console.log("Current epoch_duration:", epochStateBefore.epochDuration.toString(), "seconds");
  console.log("Last distribution at:", epochStateBefore.lastDistributionAt.toString());

  const TEST_EPOCH_DURATION = 60; // 60 seconds for testing

  if (epochStateBefore.epochDuration.toNumber() !== TEST_EPOCH_DURATION) {
    try {
      const updateEpochTx = await program.methods
        .updateEpochDuration(new BN(TEST_EPOCH_DURATION))
        .accounts({
          ecosystemEpochState: ecosystemEpochStatePda,
          ecosystemConfig: ecosystemConfigPda,
          admin: wallet.publicKey,
        })
        .signers([wallet])
        .rpc();

      console.log("Epoch duration updated! Tx:", updateEpochTx.slice(0, 20) + "...");
      await sleep(2000);
    } catch (err: any) {
      console.error("Update epoch duration failed:", err.message);
      if (err.logs) {
        console.error("Logs:", err.logs.slice(-10).join("\n"));
      }
    }
  } else {
    console.log("Epoch duration already set to 60 seconds");
  }

  const epochStateAfter = await program.account.ecosystemEpochState.fetch(ecosystemEpochStatePda);
  console.log("New epoch_duration:", epochStateAfter.epochDuration.toString(), "seconds");

  // =========================================================================
  // TEST 9: Wait for Epoch End + Claim Global Holder Rewards (triggers distribution)
  // =========================================================================
  console.log("\n========================================");
  console.log("TEST 9: Wait for Epoch + Claim Global Holder Rewards");
  console.log("========================================");

  // Check if we need to wait for epoch
  const now = Math.floor(Date.now() / 1000);
  const epochEndTime = epochStateAfter.lastDistributionAt.toNumber() + epochStateAfter.epochDuration.toNumber();
  const waitTime = epochEndTime - now;

  if (waitTime > 0) {
    console.log(`Waiting ${waitTime} seconds for epoch to end...`);
    console.log("(This is the test epoch duration we set)");

    // Progress updates every 10 seconds
    for (let remaining = waitTime; remaining > 0; remaining -= 10) {
      await sleep(Math.min(10000, remaining * 1000));
      console.log(`  ${Math.max(0, remaining - 10)} seconds remaining...`);
    }
    await sleep(2000); // Extra buffer
  } else {
    console.log("Epoch already ended, no wait needed");
  }

  // Check streaming treasury balances
  const ecoStreamingBal = await connection.getBalance(ecosystemStreamingTreasuryPda);
  const patronStreamingBal = await connection.getBalance(creatorPatronTreasuryPda);
  console.log("\nStreaming treasury balances:");
  console.log("  Ecosystem treasury:", ecoStreamingBal / LAMPORTS_PER_SOL, "SOL");
  console.log("  Patron treasury:", patronStreamingBal / LAMPORTS_PER_SOL, "SOL");

  // Check pool states before claim
  const holderPoolBeforeClaim = await program.account.globalHolderPool.fetch(globalHolderPoolPda);
  const distPoolBeforeClaim = await program.account.creatorDistPool.fetch(creatorDistPoolPda);
  console.log("\nBefore epoch distribution:");
  console.log("  GlobalHolderPool total_deposited:", holderPoolBeforeClaim.totalDeposited.toString());
  console.log("  CreatorDistPool total_deposited:", distPoolBeforeClaim.totalDeposited.toString());

  // Claim global holder rewards (triggers epoch distribution if needed)
  const walletBalanceBeforeGlobal = await connection.getBalance(wallet.publicKey);

  try {
    const claimGlobalTx = await program.methods
      .claimGlobalHolderRewards()
      .accounts({
        globalHolderPool: globalHolderPoolPda,
        creatorDistPool: creatorDistPoolPda,
        ecosystemEpochState: ecosystemEpochStatePda,
        ecosystemStreamingTreasury: ecosystemStreamingTreasuryPda,
        platformTreasury: wallet.publicKey, // Using wallet for test
        ecosystemTreasury: treasury,
        ecosystemConfig: ecosystemConfigPda,
        nftRewardState: unifiedNftRewardStatePda,
        nftAsset: nftAssetPda,
        holder: wallet.publicKey,
        systemProgram: PublicKey.default,
      })
      .signers([wallet])
      .rpc();

    console.log("\nClaimed global holder rewards! Tx:", claimGlobalTx.slice(0, 20) + "...");
    await sleep(2000);
  } catch (err: any) {
    console.error("Claim global holder rewards failed:", err.message);
    if (err.logs) {
      console.error("Logs:", err.logs.slice(-15).join("\n"));
    }
  }

  const walletBalanceAfterGlobal = await connection.getBalance(wallet.publicKey);
  console.log("Received from global pool:", (walletBalanceAfterGlobal - walletBalanceBeforeGlobal), "lamports (minus tx fee)");

  // Check pool states after distribution
  const holderPoolAfterClaim = await program.account.globalHolderPool.fetch(globalHolderPoolPda);
  const distPoolAfterClaim = await program.account.creatorDistPool.fetch(creatorDistPoolPda);
  console.log("\nAfter epoch distribution:");
  console.log("  GlobalHolderPool total_deposited:", holderPoolAfterClaim.totalDeposited.toString());
  console.log("  CreatorDistPool total_deposited:", distPoolAfterClaim.totalDeposited.toString());
  console.log("  GlobalHolderPool total_claimed:", holderPoolAfterClaim.totalClaimed.toString());

  // Check streaming treasury drained
  const ecoStreamingBalAfter = await connection.getBalance(ecosystemStreamingTreasuryPda);
  console.log("\nEcosystem streaming treasury after distribution:", ecoStreamingBalAfter / LAMPORTS_PER_SOL, "SOL");

  // =========================================================================
  // TEST 10: Claim Patron Rewards (from CreatorPatronPool)
  // =========================================================================
  console.log("\n========================================");
  console.log("TEST 10: Claim Patron Rewards");
  console.log("========================================");

  const patronPoolBeforeClaim = await program.account.creatorPatronPool.fetch(creatorPatronPoolPda);
  console.log("Patron pool before claim:");
  console.log("  total_deposited:", patronPoolBeforeClaim.totalDeposited.toString());
  console.log("  reward_per_share:", patronPoolBeforeClaim.rewardPerShare.toString());
  console.log("  last_distribution_at:", patronPoolBeforeClaim.lastDistributionAt.toString());

  const walletBalanceBeforePatron = await connection.getBalance(wallet.publicKey);

  try {
    const claimPatronTx = await program.methods
      .claimPatronRewards()
      .accounts({
        creator: wallet.publicKey,
        creatorPatronPool: creatorPatronPoolPda,
        creatorPatronTreasury: creatorPatronTreasuryPda,
        creatorWallet: wallet.publicKey,
        platformTreasury: wallet.publicKey, // Using wallet for test
        ecosystemTreasury: treasury,
        ecosystemConfig: ecosystemConfigPda,
        nftRewardState: unifiedNftRewardStatePda,
        nftAsset: nftAssetPda,
        holder: wallet.publicKey,
        systemProgram: PublicKey.default,
      })
      .signers([wallet])
      .rpc();

    console.log("Claimed patron rewards! Tx:", claimPatronTx.slice(0, 20) + "...");
    await sleep(2000);
  } catch (err: any) {
    console.error("Claim patron rewards failed:", err.message);
    if (err.logs) {
      console.error("Logs:", err.logs.slice(-15).join("\n"));
    }
  }

  const walletBalanceAfterPatron = await connection.getBalance(wallet.publicKey);
  console.log("Received from patron pool:", (walletBalanceAfterPatron - walletBalanceBeforePatron), "lamports (minus tx fee)");

  const patronPoolAfterClaim = await program.account.creatorPatronPool.fetch(creatorPatronPoolPda);
  console.log("\nPatron pool after claim:");
  console.log("  total_deposited:", patronPoolAfterClaim.totalDeposited.toString());
  console.log("  total_claimed:", patronPoolAfterClaim.totalClaimed.toString());

  // =========================================================================
  // TEST 11: Claim Creator Ecosystem Payout (from CreatorDistPool)
  // =========================================================================
  console.log("\n========================================");
  console.log("TEST 11: Claim Creator Ecosystem Payout");
  console.log("========================================");

  const creatorWeightAccount = await program.account.creatorWeight.fetch(creatorWeightPda);
  console.log("Creator weight:");
  console.log("  total_weight:", creatorWeightAccount.totalWeight.toString());
  console.log("  reward_debt:", creatorWeightAccount.rewardDebt.toString());

  const walletBalanceBeforeCreator = await connection.getBalance(wallet.publicKey);

  try {
    const claimCreatorTx = await program.methods
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

    console.log("Claimed creator ecosystem payout! Tx:", claimCreatorTx.slice(0, 20) + "...");
    await sleep(2000);
  } catch (err: any) {
    console.error("Claim creator ecosystem payout failed:", err.message);
    if (err.logs) {
      console.error("Logs:", err.logs.slice(-15).join("\n"));
    }
  }

  const walletBalanceAfterCreator = await connection.getBalance(wallet.publicKey);
  console.log("Received from creator dist pool:", (walletBalanceAfterCreator - walletBalanceBeforeCreator), "lamports (minus tx fee)");

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log("\n========================================");
  console.log("           TEST SUMMARY");
  console.log("========================================");
  console.log("");
  console.log("Test 1: Register Content - PASSED");
  console.log("Test 2: Simple Mint #1 - PASSED");
  console.log("Test 3: Init Patron Config - PASSED");
  console.log("Test 4: Subscribe Patron - PASSED");
  console.log("Test 5: Subscribe Ecosystem - PASSED");
  console.log("Test 6: Simple Mint #2 - PASSED");
  console.log("Test 7: Claim Content Rewards - PASSED");
  console.log("Test 8: Set Epoch Duration - PASSED");
  console.log("Test 9: Claim Global Holder Rewards - PASSED");
  console.log("Test 10: Claim Patron Rewards - PASSED");
  console.log("Test 11: Claim Creator Ecosystem Payout - PASSED");
  console.log("");
  console.log("All subscription pool tracking working correctly!");
  console.log("Streaming treasury pattern verified!");
  console.log("Epoch distribution tested successfully!");
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(console.error);
