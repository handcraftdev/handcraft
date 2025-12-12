/**
 * Multi-Wallet Subscription System Test
 * Uses pre-created test wallets with transfers from main wallet
 * Run with: npx tsx scripts/test-multi-wallet-subscription.ts
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
  SystemProgram,
} from "@solana/web3.js";
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
const TEST_EPOCH_DURATION = 60;
const TEST_ID = Date.now();
const WALLETS_DIR = path.join(__dirname, "test-wallets");

// Helper to load wallet
function loadWallet(name: string): Keypair {
  const walletPath = name === "main"
    ? path.join(process.env.HOME!, ".config/solana/id.json")
    : path.join(WALLETS_DIR, `${name}.json`);
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  return Keypair.fromSecretKey(new Uint8Array(secretKey));
}

// Helper to transfer SOL
async function transferSol(
  connection: Connection,
  from: Keypair,
  to: PublicKey,
  amount: number
): Promise<void> {
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: from.publicKey,
      toPubkey: to,
      lamports: amount * LAMPORTS_PER_SOL,
    })
  );
  await sendAndConfirmTransaction(connection, tx, [from]);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForEpoch(program: Program, epochStatePda: PublicKey): Promise<void> {
  const epochState = await program.account.ecosystemEpochState.fetch(epochStatePda);
  const epochEnd = epochState.lastDistributionAt.toNumber() + epochState.epochDuration.toNumber();
  const now = Math.floor(Date.now() / 1000);
  const waitTime = Math.max(0, epochEnd - now + 2);

  if (waitTime > 0) {
    console.log(`Waiting ${waitTime} seconds for epoch to end...`);
    for (let i = waitTime; i > 0; i -= 15) {
      await sleep(Math.min(15, i) * 1000);
      console.log(`  ${Math.max(0, i - 15)} seconds remaining...`);
    }
  }
}

async function main() {
  console.log("=== Multi-Wallet Subscription System Test ===\n");
  console.log("Test ID:", TEST_ID);

  const connection = new Connection(RPC_URL, "confirmed");

  // Load wallets
  const mainWallet = loadWallet("main");
  const creator1 = loadWallet("creator1");

  console.log("\n--- Wallets ---");
  console.log("Main wallet:", mainWallet.publicKey.toBase58());
  console.log("Creator1:", creator1.publicKey.toBase58());

  // Check balances
  const mainBalance = await connection.getBalance(mainWallet.publicKey);
  const creator1Balance = await connection.getBalance(creator1.publicKey);
  console.log(`\nMain balance: ${mainBalance / LAMPORTS_PER_SOL} SOL`);
  console.log(`Creator1 balance: ${creator1Balance / LAMPORTS_PER_SOL} SOL`);

  if (mainBalance < 2 * LAMPORTS_PER_SOL) {
    console.error("Main wallet needs at least 2 SOL");
    return;
  }

  // Load IDL and create programs
  const idlPath = path.join(__dirname, "../packages/sdk/src/program/content_registry.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

  const mainProvider = new AnchorProvider(connection, new Wallet(mainWallet), { commitment: "confirmed" });
  const creator1Provider = new AnchorProvider(connection, new Wallet(creator1), { commitment: "confirmed" });

  const mainProgram = new Program(idl, mainProvider);
  const creator1Program = new Program(idl, creator1Provider);
  const client = createContentRegistryClient(connection);

  // Get global PDAs
  const [ecosystemConfigPda] = getEcosystemConfigPda();
  const [globalHolderPoolPda] = getGlobalHolderPoolPda();
  const [creatorDistPoolPda] = getCreatorDistPoolPda();
  const [ecosystemEpochStatePda] = getEcosystemEpochStatePda();
  const [ecosystemSubConfigPda] = getEcosystemSubConfigPda();
  const [ecosystemStreamingTreasuryPda] = getEcosystemStreamingTreasuryPda();

  const ecosystemData = await client.fetchEcosystemConfig();
  const treasury = ecosystemData?.treasury || mainWallet.publicKey;

  // =========================================================================
  // PHASE 1: Setup Epoch Duration
  // =========================================================================
  console.log("\n========================================");
  console.log("PHASE 1: Setup");
  console.log("========================================\n");

  const epochState = await mainProgram.account.ecosystemEpochState.fetch(ecosystemEpochStatePda);
  if (epochState.epochDuration.toNumber() !== TEST_EPOCH_DURATION) {
    console.log("Setting epoch duration to 60 seconds...");
    await mainProgram.methods
      .updateEpochDuration(new BN(TEST_EPOCH_DURATION))
      .accounts({
        ecosystemEpochState: ecosystemEpochStatePda,
        ecosystemConfig: ecosystemConfigPda,
        admin: mainWallet.publicKey,
      })
      .signers([mainWallet])
      .rpc();
    await sleep(2000);
  }
  console.log("Epoch duration:", TEST_EPOCH_DURATION, "seconds");

  // Fund test wallets from main wallet
  console.log("\n--- Funding Test Wallets ---");

  // Generate fresh subscriber wallets for this test run
  const subscriber1 = Keypair.generate();
  const subscriber2 = Keypair.generate();
  const minter1 = Keypair.generate();

  console.log("Subscriber1:", subscriber1.publicKey.toBase58());
  console.log("Subscriber2:", subscriber2.publicKey.toBase58());
  console.log("Minter1:", minter1.publicKey.toBase58());

  // Transfer 0.3 SOL to each test wallet
  console.log("\nTransferring SOL to test wallets...");
  await transferSol(connection, mainWallet, subscriber1.publicKey, 0.3);
  console.log("  subscriber1: 0.3 SOL");
  await transferSol(connection, mainWallet, subscriber2.publicKey, 0.3);
  console.log("  subscriber2: 0.3 SOL");
  await transferSol(connection, mainWallet, minter1.publicKey, 0.5);
  console.log("  minter1: 0.5 SOL");
  await sleep(2000);

  // =========================================================================
  // PHASE 2: Creator1 Registers Content
  // =========================================================================
  console.log("\n========================================");
  console.log("PHASE 2: Creator1 Registers Content");
  console.log("========================================\n");

  const CONTENT_CID = `multi-wallet-test-${TEST_ID}`;
  const [contentPda] = getContentPda(CONTENT_CID);
  const [contentCollectionPda] = getContentCollectionPda(contentPda);
  const [mintConfigPda] = getMintConfigPda(contentPda);
  const [contentRewardPoolPda] = getContentRewardPoolPda(contentPda);
  const [creator1PatronPoolPda] = getCreatorPatronPoolPda(creator1.publicKey);
  const [creator1PatronTreasuryPda] = getCreatorPatronTreasuryPda(creator1.publicKey);
  const [creator1WeightPda] = getCreatorWeightPda(creator1.publicKey);
  const [creator1PatronConfigPda] = getCreatorPatronConfigPda(creator1.publicKey);

  console.log("Content CID:", CONTENT_CID);
  console.log("Creator:", creator1.publicKey.toBase58());

  // Register content as creator1
  const { instruction: registerIx, collectionAssetKeypair } = await client.registerContentWithMintInstruction(
    creator1.publicKey,
    CONTENT_CID,
    "QmTestMetadata",
    ContentType.Video,
    BigInt(0.05 * LAMPORTS_PER_SOL), // 0.05 SOL mint price
    null,
    500, // 5% royalty
    false,
    "QmPreview",
    ""
  );

  const registerTx = new Transaction().add(registerIx);
  registerTx.feePayer = creator1.publicKey;
  registerTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  registerTx.partialSign(collectionAssetKeypair);
  await sendAndConfirmTransaction(connection, registerTx, [creator1, collectionAssetKeypair]);
  console.log("Content registered by creator1!");
  await sleep(2000);

  const contentCollection = await client.fetchContentCollection(CONTENT_CID);
  const collectionAsset = contentCollection!.collectionAsset;

  // =========================================================================
  // PHASE 3: Setup Patron Config for Creator1
  // =========================================================================
  console.log("\n========================================");
  console.log("PHASE 3: Creator1 Patron Config");
  console.log("========================================\n");

  // Check if patron config exists
  const existingPatronConfig = await connection.getAccountInfo(creator1PatronConfigPda);
  if (!existingPatronConfig) {
    console.log("Initializing patron config for creator1...");
    await creator1Program.methods
      .initPatronConfig(
        new BN(0.05 * LAMPORTS_PER_SOL), // subscription price
        new BN(0.02 * LAMPORTS_PER_SOL), // tip minimum
      )
      .accounts({
        patronConfig: creator1PatronConfigPda,
        creatorPatronPool: creator1PatronPoolPda,
        creatorPatronTreasury: creator1PatronTreasuryPda,
        creator: creator1.publicKey,
        systemProgram: PublicKey.default,
      })
      .signers([creator1])
      .rpc();
    console.log("Patron config created!");
    await sleep(2000);
  } else {
    console.log("Patron config already exists");
  }

  // =========================================================================
  // PHASE 4: Minter1 Mints NFT from Creator1's Content
  // =========================================================================
  console.log("\n========================================");
  console.log("PHASE 4: Minter1 Mints NFT");
  console.log("========================================\n");

  const content = await client.fetchContent(CONTENT_CID);
  const edition1 = BigInt(Number(content?.mintedCount || 0) + 1);
  const [nft1AssetPda] = getSimpleNftPda(minter1.publicKey, contentPda, edition1);
  const [nft1StatePda] = getUnifiedNftRewardStatePda(nft1AssetPda);

  console.log("Minter:", minter1.publicKey.toBase58());
  console.log("Edition:", edition1.toString());

  const minter1Provider = new AnchorProvider(connection, new Wallet(minter1), { commitment: "confirmed" });
  const minter1Program = new Program(idl, minter1Provider);

  await minter1Program.methods
    .simpleMint()
    .accounts({
      ecosystemConfig: ecosystemConfigPda,
      content: contentPda,
      mintConfig: mintConfigPda,
      contentRewardPool: contentRewardPoolPda,
      contentCollection: contentCollectionPda,
      collectionAsset: collectionAsset,
      creator: creator1.publicKey,
      treasury: treasury,
      platform: mainWallet.publicKey,
      nftAsset: nft1AssetPda,
      unifiedNftState: nft1StatePda,
      globalHolderPool: globalHolderPoolPda,
      creatorDistPool: creatorDistPoolPda,
      creatorPatronPool: creator1PatronPoolPda,
      creatorWeight: creator1WeightPda,
      creatorPatronTreasury: creator1PatronTreasuryPda,
      ecosystemStreamingTreasury: ecosystemStreamingTreasuryPda,
      ecosystemEpochState: ecosystemEpochStatePda,
      payer: minter1.publicKey,
      slotHashes: new PublicKey("SysvarS1otHashes111111111111111111111111111"),
      mplCoreProgram: new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"),
      systemProgram: PublicKey.default,
    })
    .signers([minter1])
    .rpc();

  await sleep(2000);
  const nft1State = await mainProgram.account.unifiedNftRewardState.fetch(nft1StatePda);
  console.log("NFT minted!");
  console.log("  Rarity:", Object.keys(nft1State.rarity)[0]);
  console.log("  Weight:", nft1State.weight);
  console.log("  Holder:", minter1.publicKey.toBase58());

  // =========================================================================
  // PHASE 5: Subscriber1 & Subscriber2 Subscribe
  // =========================================================================
  console.log("\n========================================");
  console.log("PHASE 5: Subscribers Subscribe");
  console.log("========================================\n");

  // Subscriber1 subscribes to patron + ecosystem
  const [patronSub1Pda] = getCreatorPatronSubscriptionPda(subscriber1.publicKey, creator1.publicKey);
  const [ecoSub1Pda] = getEcosystemSubscriptionPda(subscriber1.publicKey);

  const sub1Provider = new AnchorProvider(connection, new Wallet(subscriber1), { commitment: "confirmed" });
  const sub1Program = new Program(idl, sub1Provider);

  console.log("Subscriber1 subscribing to Creator1 patron...");
  const patronTreasuryBefore = await connection.getBalance(creator1PatronTreasuryPda);
  await sub1Program.methods
    .subscribePatron({ subscription: {} })
    .accounts({
      patronConfig: creator1PatronConfigPda,
      creatorPatronTreasury: creator1PatronTreasuryPda,
      patronSubscription: patronSub1Pda,
      creator: creator1.publicKey,
      subscriber: subscriber1.publicKey,
      systemProgram: PublicKey.default,
    })
    .signers([subscriber1])
    .rpc();
  await sleep(2000);

  const patronTreasuryAfter = await connection.getBalance(creator1PatronTreasuryPda);
  console.log("  Patron treasury:", patronTreasuryBefore / LAMPORTS_PER_SOL, "->", patronTreasuryAfter / LAMPORTS_PER_SOL, "SOL");

  console.log("Subscriber1 subscribing to ecosystem...");
  const ecoTreasuryBefore = await connection.getBalance(ecosystemStreamingTreasuryPda);
  await sub1Program.methods
    .subscribeEcosystem()
    .accounts({
      ecosystemSubConfig: ecosystemSubConfigPda,
      ecosystemSubscription: ecoSub1Pda,
      ecosystemStreamingTreasury: ecosystemStreamingTreasuryPda,
      subscriber: subscriber1.publicKey,
      systemProgram: PublicKey.default,
    })
    .signers([subscriber1])
    .rpc();
  await sleep(2000);

  const ecoTreasuryAfter = await connection.getBalance(ecosystemStreamingTreasuryPda);
  console.log("  Ecosystem treasury:", ecoTreasuryBefore / LAMPORTS_PER_SOL, "->", ecoTreasuryAfter / LAMPORTS_PER_SOL, "SOL");

  // Subscriber2 subscribes only to ecosystem
  const [ecoSub2Pda] = getEcosystemSubscriptionPda(subscriber2.publicKey);
  const sub2Provider = new AnchorProvider(connection, new Wallet(subscriber2), { commitment: "confirmed" });
  const sub2Program = new Program(idl, sub2Provider);

  console.log("\nSubscriber2 subscribing to ecosystem...");
  const ecoTreasury2Before = await connection.getBalance(ecosystemStreamingTreasuryPda);
  await sub2Program.methods
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

  const ecoTreasury2After = await connection.getBalance(ecosystemStreamingTreasuryPda);
  console.log("  Ecosystem treasury:", ecoTreasury2Before / LAMPORTS_PER_SOL, "->", ecoTreasury2After / LAMPORTS_PER_SOL, "SOL");

  // =========================================================================
  // PHASE 6: Main Wallet Mints Another NFT
  // =========================================================================
  console.log("\n========================================");
  console.log("PHASE 6: Main Wallet Mints NFT");
  console.log("========================================\n");

  const content2 = await client.fetchContent(CONTENT_CID);
  const edition2 = BigInt(Number(content2?.mintedCount || 0) + 1);
  const [nft2AssetPda] = getSimpleNftPda(mainWallet.publicKey, contentPda, edition2);
  const [nft2StatePda] = getUnifiedNftRewardStatePda(nft2AssetPda);

  console.log("Minter:", mainWallet.publicKey.toBase58());
  console.log("Edition:", edition2.toString());

  await mainProgram.methods
    .simpleMint()
    .accounts({
      ecosystemConfig: ecosystemConfigPda,
      content: contentPda,
      mintConfig: mintConfigPda,
      contentRewardPool: contentRewardPoolPda,
      contentCollection: contentCollectionPda,
      collectionAsset: collectionAsset,
      creator: creator1.publicKey,
      treasury: treasury,
      platform: mainWallet.publicKey,
      nftAsset: nft2AssetPda,
      unifiedNftState: nft2StatePda,
      globalHolderPool: globalHolderPoolPda,
      creatorDistPool: creatorDistPoolPda,
      creatorPatronPool: creator1PatronPoolPda,
      creatorWeight: creator1WeightPda,
      creatorPatronTreasury: creator1PatronTreasuryPda,
      ecosystemStreamingTreasury: ecosystemStreamingTreasuryPda,
      ecosystemEpochState: ecosystemEpochStatePda,
      payer: mainWallet.publicKey,
      slotHashes: new PublicKey("SysvarS1otHashes111111111111111111111111111"),
      mplCoreProgram: new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"),
      systemProgram: PublicKey.default,
    })
    .signers([mainWallet])
    .rpc();

  await sleep(2000);
  const nft2State = await mainProgram.account.unifiedNftRewardState.fetch(nft2StatePda);
  console.log("NFT minted!");
  console.log("  Rarity:", Object.keys(nft2State.rarity)[0]);
  console.log("  Weight:", nft2State.weight);

  // =========================================================================
  // PHASE 7: Wait for Epoch End & Distribute
  // =========================================================================
  console.log("\n========================================");
  console.log("PHASE 7: Epoch Distribution");
  console.log("========================================\n");

  await waitForEpoch(mainProgram, ecosystemEpochStatePda);

  const ecoStreamingBal = await connection.getBalance(ecosystemStreamingTreasuryPda);
  const patronStreamingBal = await connection.getBalance(creator1PatronTreasuryPda);
  console.log("Before distribution:");
  console.log("  Ecosystem treasury:", ecoStreamingBal / LAMPORTS_PER_SOL, "SOL");
  console.log("  Patron treasury:", patronStreamingBal / LAMPORTS_PER_SOL, "SOL");

  // Trigger distribution via claim
  console.log("\nTriggering epoch distribution...");
  try {
    await mainProgram.methods
      .claimGlobalHolderRewards()
      .accounts({
        globalHolderPool: globalHolderPoolPda,
        ecosystemEpochState: ecosystemEpochStatePda,
        ecosystemStreamingTreasury: ecosystemStreamingTreasuryPda,
        platformTreasury: mainWallet.publicKey,
        ecosystemTreasury: treasury,
        ecosystemConfig: ecosystemConfigPda,
        nftRewardState: nft2StatePda,
        nftAsset: nft2AssetPda,
        holder: mainWallet.publicKey,
        systemProgram: PublicKey.default,
      })
      .signers([mainWallet])
      .rpc();

    await sleep(2000);
    console.log("Distribution triggered!");

    const holderPool = await mainProgram.account.globalHolderPool.fetch(globalHolderPoolPda);
    const distPool = await mainProgram.account.creatorDistPool.fetch(creatorDistPoolPda);
    console.log("\nAfter distribution:");
    console.log("  GlobalHolderPool total_deposited:", holderPool.totalDeposited.toString());
    console.log("  CreatorDistPool total_deposited:", distPool.totalDeposited.toString());
  } catch (err: any) {
    console.error("Distribution failed:", err.message);
  }

  // =========================================================================
  // PHASE 8: Minter1 Claims Patron Rewards (as NFT holder)
  // =========================================================================
  console.log("\n========================================");
  console.log("PHASE 8: Minter1 Claims Patron Rewards");
  console.log("========================================\n");

  const minter1BalBefore = await connection.getBalance(minter1.publicKey);
  console.log("Minter1 balance before claim:", minter1BalBefore / LAMPORTS_PER_SOL, "SOL");

  try {
    await minter1Program.methods
      .claimPatronRewards()
      .accounts({
        creator: creator1.publicKey,
        creatorPatronPool: creator1PatronPoolPda,
        creatorPatronTreasury: creator1PatronTreasuryPda,
        creatorWallet: creator1.publicKey,
        platformTreasury: mainWallet.publicKey,
        ecosystemTreasury: treasury,
        ecosystemConfig: ecosystemConfigPda,
        nftRewardState: nft1StatePda,
        nftAsset: nft1AssetPda,
        holder: minter1.publicKey,
        systemProgram: PublicKey.default,
      })
      .signers([minter1])
      .rpc();

    await sleep(2000);
    const minter1BalAfter = await connection.getBalance(minter1.publicKey);
    console.log("Minter1 balance after claim:", minter1BalAfter / LAMPORTS_PER_SOL, "SOL");
    console.log("Claimed:", (minter1BalAfter - minter1BalBefore) / LAMPORTS_PER_SOL, "SOL");
  } catch (err: any) {
    console.error("Patron claim failed:", err.message);
    if (err.logs) console.error("Logs:", err.logs.slice(-5).join("\n"));
  }

  // =========================================================================
  // PHASE 9: Creator1 Claims Ecosystem Payout
  // =========================================================================
  console.log("\n========================================");
  console.log("PHASE 9: Creator1 Claims Ecosystem Payout");
  console.log("========================================\n");

  const creator1BalBefore = await connection.getBalance(creator1.publicKey);
  console.log("Creator1 balance before claim:", creator1BalBefore / LAMPORTS_PER_SOL, "SOL");

  try {
    await creator1Program.methods
      .claimCreatorEcosystemPayout()
      .accounts({
        globalHolderPool: globalHolderPoolPda,
        creatorDistPool: creatorDistPoolPda,
        ecosystemEpochState: ecosystemEpochStatePda,
        ecosystemStreamingTreasury: ecosystemStreamingTreasuryPda,
        platformTreasury: mainWallet.publicKey,
        ecosystemTreasury: treasury,
        ecosystemConfig: ecosystemConfigPda,
        creatorWeight: creator1WeightPda,
        creator: creator1.publicKey,
        systemProgram: PublicKey.default,
      })
      .signers([creator1])
      .rpc();

    await sleep(2000);
    const creator1BalAfter = await connection.getBalance(creator1.publicKey);
    console.log("Creator1 balance after claim:", creator1BalAfter / LAMPORTS_PER_SOL, "SOL");
    console.log("Claimed:", (creator1BalAfter - creator1BalBefore) / LAMPORTS_PER_SOL, "SOL");
  } catch (err: any) {
    console.error("Creator ecosystem claim failed:", err.message);
    if (err.logs) console.error("Logs:", err.logs.slice(-5).join("\n"));
  }

  // =========================================================================
  // Summary
  // =========================================================================
  console.log("\n========================================");
  console.log("TEST SUMMARY");
  console.log("========================================\n");

  console.log("Content:", CONTENT_CID);
  console.log("Creator:", creator1.publicKey.toBase58());
  console.log("Minted NFTs: 2");
  console.log("  - Edition 1: Minter1 (" + minter1.publicKey.toBase58().slice(0, 12) + "...)");
  console.log("  - Edition 2: Main wallet");
  console.log("Subscriptions:");
  console.log("  - Subscriber1: Patron + Ecosystem");
  console.log("  - Subscriber2: Ecosystem only");

  // Final balances
  console.log("\nFinal Balances:");
  console.log("  Main wallet:", (await connection.getBalance(mainWallet.publicKey)) / LAMPORTS_PER_SOL, "SOL");
  console.log("  Creator1:", (await connection.getBalance(creator1.publicKey)) / LAMPORTS_PER_SOL, "SOL");
  console.log("  Minter1:", (await connection.getBalance(minter1.publicKey)) / LAMPORTS_PER_SOL, "SOL");

  console.log("\nTest completed successfully!");
}

main().catch(console.error);
