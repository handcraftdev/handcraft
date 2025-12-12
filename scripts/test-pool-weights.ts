/**
 * Test that all pool weights are correctly tracked
 * Run with: npx tsx scripts/test-pool-weights.ts
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
  console.log("=== Pool Weight Verification Test ===\n");

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

  const [mainPatronPoolPda] = getCreatorPatronPoolPda(mainWallet.publicKey);
  const [mainPatronTreasuryPda] = getCreatorPatronTreasuryPda(mainWallet.publicKey);
  const [mainWeightPda] = getCreatorWeightPda(mainWallet.publicKey);

  const ecosystemData = await client.fetchEcosystemConfig();
  const treasury = ecosystemData?.treasury || mainWallet.publicKey;

  // =========================================================================
  // RECORD INITIAL STATE
  // =========================================================================
  console.log("\n========================================");
  console.log("INITIAL POOL STATES");
  console.log("========================================\n");

  const initialGlobalHolder = await program.account.globalHolderPool.fetch(globalHolderPoolPda);
  const initialCreatorDist = await program.account.creatorDistPool.fetch(creatorDistPoolPda);

  console.log("GlobalHolderPool:");
  console.log("  total_weight:", initialGlobalHolder.totalWeight.toString());

  console.log("\nCreatorDistPool:");
  console.log("  total_weight:", initialCreatorDist.totalWeight.toString());

  let initialCreator1WeightVal = 0;
  let initialCreator1PatronPoolVal = 0;
  try {
    const initialCreator1Weight = await program.account.creatorWeight.fetch(creator1WeightPda);
    initialCreator1WeightVal = initialCreator1Weight.totalWeight.toNumber();
    console.log("\nCreator1 Weight:");
    console.log("  total_weight:", initialCreator1WeightVal);
  } catch {
    console.log("\nCreator1 Weight: Not initialized yet (will be created on first mint)");
  }

  try {
    const initialCreator1PatronPool = await program.account.creatorPatronPool.fetch(creator1PatronPoolPda);
    initialCreator1PatronPoolVal = initialCreator1PatronPool.totalWeight.toNumber();
    console.log("\nCreator1 PatronPool:");
    console.log("  total_weight:", initialCreator1PatronPoolVal);
  } catch {
    console.log("\nCreator1 PatronPool: Not initialized yet");
  }

  // =========================================================================
  // REGISTER CONTENT & MINT NFTs
  // =========================================================================
  console.log("\n========================================");
  console.log("MINTING NFTs TO TEST WEIGHT TRACKING");
  console.log("========================================\n");

  const testContentId = `weight-test-${Date.now()}`;
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
    "QmWeightTest",
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

  // Track minted NFTs and their weights
  const mintedNfts: { edition: bigint; weight: number; rarity: string }[] = [];
  let totalMintedWeight = 0;

  // Mint 5 NFTs
  const NUM_MINTS = 5;
  for (let i = 1; i <= NUM_MINTS; i++) {
    const content = await client.fetchContent(testContentId);
    const edition = BigInt(Number(content?.mintedCount || 0) + 1);
    const [nftAssetPda] = getSimpleNftPda(mainWallet.publicKey, contentPda, edition);
    const [unifiedNftStatePda] = getUnifiedNftRewardStatePda(nftAssetPda);

    console.log(`\nMinting NFT #${i} (edition ${edition})...`);

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

    await new Promise(r => setTimeout(r, 1500));

    const nftState = await program.account.unifiedNftRewardState.fetch(unifiedNftStatePda);
    const rarity = Object.keys(nftState.rarity)[0];
    const weight = nftState.weight as number;

    mintedNfts.push({ edition, weight, rarity });
    totalMintedWeight += weight;

    console.log(`  Rarity: ${rarity}, Weight: ${weight}`);
  }

  // =========================================================================
  // VERIFY POOL WEIGHTS
  // =========================================================================
  console.log("\n========================================");
  console.log("VERIFYING POOL WEIGHTS");
  console.log("========================================\n");

  console.log("Minted NFTs Summary:");
  for (const nft of mintedNfts) {
    console.log(`  Edition ${nft.edition}: ${nft.rarity} (weight: ${nft.weight})`);
  }
  console.log(`  TOTAL WEIGHT MINTED: ${totalMintedWeight}`);

  // Fetch final states
  const finalGlobalHolder = await program.account.globalHolderPool.fetch(globalHolderPoolPda);
  const finalCreatorDist = await program.account.creatorDistPool.fetch(creatorDistPoolPda);
  const finalCreator1Weight = await program.account.creatorWeight.fetch(creator1WeightPda);
  const finalContentPool = await program.account.contentRewardPool.fetch(contentRewardPoolPda);
  const finalCreator1PatronPool = await program.account.creatorPatronPool.fetch(creator1PatronPoolPda);

  console.log("\n--- Pool Weight Changes ---\n");

  // GlobalHolderPool
  const globalWeightDelta = finalGlobalHolder.totalWeight.toNumber() - initialGlobalHolder.totalWeight.toNumber();
  console.log("GlobalHolderPool:");
  console.log(`  Weight: ${initialGlobalHolder.totalWeight} -> ${finalGlobalHolder.totalWeight} (delta: ${globalWeightDelta})`);
  console.log(`  Expected delta: ${totalMintedWeight}`);
  console.log(`  Status: ${globalWeightDelta === totalMintedWeight ? "✓ CORRECT" : "✗ MISMATCH"}`);

  // CreatorDistPool
  const distWeightDelta = finalCreatorDist.totalWeight.toNumber() - initialCreatorDist.totalWeight.toNumber();
  console.log("\nCreatorDistPool:");
  console.log(`  Weight: ${initialCreatorDist.totalWeight} -> ${finalCreatorDist.totalWeight} (delta: ${distWeightDelta})`);
  console.log(`  Expected delta: ${totalMintedWeight}`);
  console.log(`  Status: ${distWeightDelta === totalMintedWeight ? "✓ CORRECT" : "✗ MISMATCH"}`);

  // CreatorWeight (for creator1)
  const creator1WeightDelta = finalCreator1Weight.totalWeight.toNumber() - initialCreator1WeightVal;
  console.log("\nCreatorWeight (Creator1):");
  console.log(`  Weight: ${initialCreator1WeightVal} -> ${finalCreator1Weight.totalWeight} (delta: ${creator1WeightDelta})`);
  console.log(`  Expected weight delta: ${totalMintedWeight}`);
  console.log(`  Status: ${creator1WeightDelta === totalMintedWeight ? "✓ CORRECT" : "✗ MISMATCH"}`);

  // ContentRewardPool
  console.log("\nContentRewardPool:");
  console.log(`  Weight: ${finalContentPool.totalWeight}`);
  console.log(`  NFTs: ${finalContentPool.totalNfts}`);
  console.log(`  Expected weight: ${totalMintedWeight}`);
  console.log(`  Expected NFTs: ${NUM_MINTS}`);
  console.log(`  Status: ${finalContentPool.totalWeight.toNumber() === totalMintedWeight && finalContentPool.totalNfts.toNumber() === NUM_MINTS ? "✓ CORRECT" : "✗ MISMATCH"}`);

  // CreatorPatronPool
  const patronPoolWeightDelta = finalCreator1PatronPool.totalWeight.toNumber() - initialCreator1PatronPoolVal;
  console.log("\nCreatorPatronPool (Creator1):");
  console.log(`  Weight: ${initialCreator1PatronPoolVal} -> ${finalCreator1PatronPool.totalWeight} (delta: ${patronPoolWeightDelta})`);
  console.log(`  Expected delta: ${totalMintedWeight}`);
  console.log(`  Status: ${patronPoolWeightDelta === totalMintedWeight ? "✓ CORRECT" : "✗ MISMATCH"}`);

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log("\n========================================");
  console.log("SUMMARY");
  console.log("========================================\n");

  const allCorrect =
    globalWeightDelta === totalMintedWeight &&
    distWeightDelta === totalMintedWeight &&
    creator1WeightDelta === totalMintedWeight &&
    finalContentPool.totalWeight.toNumber() === totalMintedWeight &&
    patronPoolWeightDelta === totalMintedWeight;

  if (allCorrect) {
    console.log("✓ ALL POOL WEIGHTS ARE CORRECT!");
    console.log(`  Total weight added: ${totalMintedWeight}`);
    console.log(`  All 5 pools updated correctly`);
  } else {
    console.log("✗ SOME POOL WEIGHTS ARE INCORRECT");
    console.log("  Check the details above");
  }

  console.log("\nPools verified:");
  console.log("  1. GlobalHolderPool (ecosystem-wide NFT holder rewards)");
  console.log("  2. CreatorDistPool (ecosystem creator distribution)");
  console.log("  3. CreatorWeight (per-creator weight tracking)");
  console.log("  4. ContentRewardPool (per-content holder rewards)");
  console.log("  5. CreatorPatronPool (patron subscription rewards)");
}

main().catch(console.error);
