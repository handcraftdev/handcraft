/**
 * Test that all pool weights are correctly decremented on NFT burn
 * Run with: npx tsx scripts/test-burn-pool-weights.ts
 */

import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";
import {
  getContentPda,
  getEcosystemConfigPda,
  getGlobalHolderPoolPda,
  getCreatorDistPoolPda,
  getEcosystemEpochStatePda,
  getEcosystemStreamingTreasuryPda,
  getCreatorPatronPoolPda,
  getCreatorPatronTreasuryPda,
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

async function main() {
  console.log("=== Burn Pool Weight Verification Test ===\n");

  const connection = new Connection(RPC_URL, "confirmed");

  // Load wallets
  const keypairPath = path.join(process.env.HOME!, ".config/solana/id.json");
  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const mainWallet = Keypair.fromSecretKey(new Uint8Array(secretKey));

  const creator1Path = path.join(__dirname, "test-wallets/creator1.json");
  const creator1Key = JSON.parse(fs.readFileSync(creator1Path, "utf-8"));
  const creator1 = Keypair.fromSecretKey(new Uint8Array(creator1Key));

  console.log("Main wallet:", mainWallet.publicKey.toBase58());
  console.log("Creator1:", creator1.publicKey.toBase58());

  // Load IDL and create program
  const idlPath = path.join(__dirname, "../packages/sdk/src/program/content_registry.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const provider = new AnchorProvider(connection, new Wallet(mainWallet), { commitment: "confirmed" });
  const program = new Program(idl, provider);
  const client = createContentRegistryClient(connection);

  // Get global PDAs
  const [ecosystemConfigPda] = getEcosystemConfigPda();
  const [globalHolderPoolPda] = getGlobalHolderPoolPda();
  const [creatorDistPoolPda] = getCreatorDistPoolPda();
  const [ecosystemEpochStatePda] = getEcosystemEpochStatePda();
  const [ecosystemStreamingTreasuryPda] = getEcosystemStreamingTreasuryPda();

  // Creator-specific PDAs
  const [creator1PatronPoolPda] = getCreatorPatronPoolPda(creator1.publicKey);
  const [creator1PatronTreasuryPda] = getCreatorPatronTreasuryPda(creator1.publicKey);
  const [creator1WeightPda] = getCreatorWeightPda(creator1.publicKey);

  const ecosystemData = await client.fetchEcosystemConfig();
  const treasury = ecosystemData?.treasury || mainWallet.publicKey;

  // =========================================================================
  // STEP 1: Register content and mint an NFT
  // =========================================================================
  console.log("========================================");
  console.log("STEP 1: Mint NFT to burn");
  console.log("========================================\n");

  const testContentId = `burn-test-${Date.now()}`;
  const [contentPda] = getContentPda(testContentId);
  const [contentCollectionPda] = getContentCollectionPda(contentPda);
  const [mintConfigPda] = getMintConfigPda(contentPda);
  const [contentRewardPoolPda] = getContentRewardPoolPda(contentPda);

  // Register content as creator1
  console.log("Registering content as Creator1...");
  const creator1Provider = new AnchorProvider(connection, new Wallet(creator1), { commitment: "confirmed" });
  const creator1Program = new Program(idl, creator1Provider);

  const { instruction: registerIx, collectionAssetKeypair } = await client.registerContentWithMintInstruction(
    creator1.publicKey,
    testContentId,
    "QmBurnTest",
    ContentType.Video,
    BigInt(0.01 * LAMPORTS_PER_SOL),
    null,
    500,
    false,
    "QmPreview",
    ""
  );

  const registerTx = new Transaction().add(registerIx);
  registerTx.feePayer = creator1.publicKey;
  registerTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  registerTx.partialSign(collectionAssetKeypair);
  await sendAndConfirmTransaction(connection, registerTx, [creator1, collectionAssetKeypair]);
  console.log("Content registered!");

  await new Promise(r => setTimeout(r, 2000));

  const contentCollection = await client.fetchContentCollection(testContentId);
  const collectionAsset = contentCollection!.collectionAsset;

  // Mint one NFT
  const content = await client.fetchContent(testContentId);
  const edition = BigInt(Number(content?.mintedCount || 0) + 1);
  const [nftAssetPda] = getSimpleNftPda(mainWallet.publicKey, contentPda, edition);
  const [unifiedNftStatePda] = getUnifiedNftRewardStatePda(nftAssetPda);

  console.log("Minting NFT...");
  await program.methods
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
      nftAsset: nftAssetPda,
      unifiedNftState: unifiedNftStatePda,
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

  await new Promise(r => setTimeout(r, 2000));

  const nftState = await program.account.unifiedNftRewardState.fetch(unifiedNftStatePda);
  const rarity = Object.keys(nftState.rarity)[0];
  const nftWeight = nftState.weight as number;

  console.log(`NFT minted! Rarity: ${rarity}, Weight: ${nftWeight}`);

  // =========================================================================
  // STEP 2: Record pool states BEFORE burn
  // =========================================================================
  console.log("\n========================================");
  console.log("STEP 2: Record Pool States BEFORE Burn");
  console.log("========================================\n");

  const beforeGlobalHolder = await program.account.globalHolderPool.fetch(globalHolderPoolPda);
  const beforeCreatorDist = await program.account.creatorDistPool.fetch(creatorDistPoolPda);
  const beforeCreator1Weight = await program.account.creatorWeight.fetch(creator1WeightPda);
  const beforeContentPool = await program.account.contentRewardPool.fetch(contentRewardPoolPda);
  const beforeCreator1PatronPool = await program.account.creatorPatronPool.fetch(creator1PatronPoolPda);

  console.log("GlobalHolderPool weight:", beforeGlobalHolder.totalWeight.toString());
  console.log("CreatorDistPool weight:", beforeCreatorDist.totalWeight.toString());
  console.log("CreatorWeight weight:", beforeCreator1Weight.totalWeight.toString());
  console.log("ContentRewardPool weight:", beforeContentPool.totalWeight.toString());
  console.log("CreatorPatronPool weight:", beforeCreator1PatronPool.totalWeight.toString());
  console.log("\nNFT weight to burn:", nftWeight);

  // =========================================================================
  // STEP 3: Burn the NFT
  // =========================================================================
  console.log("\n========================================");
  console.log("STEP 3: Burn NFT");
  console.log("========================================\n");

  console.log("Burning NFT with subscription reconciliation...");

  try {
    await program.methods
      .burnNftWithSubscription()
      .accounts({
        content: contentPda,
        contentCollection: contentCollectionPda,
        contentRewardPool: contentRewardPoolPda,
        unifiedNftState: unifiedNftStatePda,
        creator: creator1.publicKey,
        creatorPatronPool: creator1PatronPoolPda,
        globalHolderPool: globalHolderPoolPda,
        creatorDistPool: creatorDistPoolPda,
        creatorWeight: creator1WeightPda,
        nftAsset: nftAssetPda,
        collectionAsset: collectionAsset,
        owner: mainWallet.publicKey,
        mplCoreProgram: new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"),
        systemProgram: PublicKey.default,
      })
      .signers([mainWallet])
      .rpc();

    console.log("NFT burned successfully!");
  } catch (err: any) {
    console.error("Burn failed:", err.message);
    if (err.logs) {
      console.error("Logs:", err.logs.slice(-10).join("\n"));
    }
    return;
  }

  await new Promise(r => setTimeout(r, 2000));

  // =========================================================================
  // STEP 4: Verify pool states AFTER burn
  // =========================================================================
  console.log("\n========================================");
  console.log("STEP 4: Verify Pool States AFTER Burn");
  console.log("========================================\n");

  const afterGlobalHolder = await program.account.globalHolderPool.fetch(globalHolderPoolPda);
  const afterCreatorDist = await program.account.creatorDistPool.fetch(creatorDistPoolPda);
  const afterCreator1Weight = await program.account.creatorWeight.fetch(creator1WeightPda);
  const afterContentPool = await program.account.contentRewardPool.fetch(contentRewardPoolPda);
  const afterCreator1PatronPool = await program.account.creatorPatronPool.fetch(creator1PatronPoolPda);

  console.log("--- Pool Weight Changes ---\n");

  // GlobalHolderPool
  const globalDelta = beforeGlobalHolder.totalWeight.toNumber() - afterGlobalHolder.totalWeight.toNumber();
  console.log("GlobalHolderPool:");
  console.log(`  Weight: ${beforeGlobalHolder.totalWeight} -> ${afterGlobalHolder.totalWeight} (delta: -${globalDelta})`);
  console.log(`  Expected delta: -${nftWeight}`);
  console.log(`  Status: ${globalDelta === nftWeight ? "✓ CORRECT" : "✗ MISMATCH"}`);

  // CreatorDistPool
  const distDelta = beforeCreatorDist.totalWeight.toNumber() - afterCreatorDist.totalWeight.toNumber();
  console.log("\nCreatorDistPool:");
  console.log(`  Weight: ${beforeCreatorDist.totalWeight} -> ${afterCreatorDist.totalWeight} (delta: -${distDelta})`);
  console.log(`  Expected delta: -${nftWeight}`);
  console.log(`  Status: ${distDelta === nftWeight ? "✓ CORRECT" : "✗ MISMATCH"}`);

  // CreatorWeight
  const creatorWeightDelta = beforeCreator1Weight.totalWeight.toNumber() - afterCreator1Weight.totalWeight.toNumber();
  console.log("\nCreatorWeight (Creator1):");
  console.log(`  Weight: ${beforeCreator1Weight.totalWeight} -> ${afterCreator1Weight.totalWeight} (delta: -${creatorWeightDelta})`);
  console.log(`  Expected delta: -${nftWeight}`);
  console.log(`  Status: ${creatorWeightDelta === nftWeight ? "✓ CORRECT" : "✗ MISMATCH"}`);

  // ContentRewardPool
  const contentDelta = beforeContentPool.totalWeight.toNumber() - afterContentPool.totalWeight.toNumber();
  const contentNftsDelta = beforeContentPool.totalNfts.toNumber() - afterContentPool.totalNfts.toNumber();
  console.log("\nContentRewardPool:");
  console.log(`  Weight: ${beforeContentPool.totalWeight} -> ${afterContentPool.totalWeight} (delta: -${contentDelta})`);
  console.log(`  NFTs: ${beforeContentPool.totalNfts} -> ${afterContentPool.totalNfts} (delta: -${contentNftsDelta})`);
  console.log(`  Expected weight delta: -${nftWeight}`);
  console.log(`  Expected NFTs delta: -1`);
  console.log(`  Status: ${contentDelta === nftWeight && contentNftsDelta === 1 ? "✓ CORRECT" : "✗ MISMATCH"}`);

  // CreatorPatronPool
  const patronDelta = beforeCreator1PatronPool.totalWeight.toNumber() - afterCreator1PatronPool.totalWeight.toNumber();
  console.log("\nCreatorPatronPool (Creator1):");
  console.log(`  Weight: ${beforeCreator1PatronPool.totalWeight} -> ${afterCreator1PatronPool.totalWeight} (delta: -${patronDelta})`);
  console.log(`  Expected delta: -${nftWeight}`);
  console.log(`  Status: ${patronDelta === nftWeight ? "✓ CORRECT" : "✗ MISMATCH"}`);

  // Verify UnifiedNftRewardState is closed
  console.log("\nUnifiedNftRewardState:");
  try {
    await program.account.unifiedNftRewardState.fetch(unifiedNftStatePda);
    console.log("  Status: ✗ Account still exists (should be closed)");
  } catch {
    console.log("  Status: ✓ Account closed (rent refunded)");
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log("\n========================================");
  console.log("SUMMARY");
  console.log("========================================\n");

  const allCorrect =
    globalDelta === nftWeight &&
    distDelta === nftWeight &&
    creatorWeightDelta === nftWeight &&
    contentDelta === nftWeight &&
    patronDelta === nftWeight &&
    contentNftsDelta === 1;

  if (allCorrect) {
    console.log("✓ ALL POOL WEIGHTS CORRECTLY DECREMENTED ON BURN!");
    console.log(`  Weight removed: ${nftWeight}`);
    console.log(`  All 5 pools updated correctly`);
    console.log(`  UnifiedNftRewardState closed`);
  } else {
    console.log("✗ SOME POOL WEIGHTS ARE INCORRECT");
    console.log("  Check the details above");
  }

  console.log("\nPools verified on burn:");
  console.log("  1. GlobalHolderPool");
  console.log("  2. CreatorDistPool");
  console.log("  3. CreatorWeight");
  console.log("  4. ContentRewardPool");
  console.log("  5. CreatorPatronPool");
}

main().catch(console.error);
