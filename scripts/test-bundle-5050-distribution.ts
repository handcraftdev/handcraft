/**
 * Test bundle mint 50/50 holder reward distribution
 * Run with: npx tsx scripts/test-bundle-5050-distribution.ts
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
  getBundlePda,
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
  getBundleRewardPoolPda,
  getContentCollectionPda,
  getBundleCollectionPda,
  getMintConfigPda,
  getBundleMintConfigPda,
  getSimpleNftPda,
  getSimpleBundleNftPda,
  ContentType,
  createContentRegistryClient,
} from "@handcraft/sdk";

const RPC_URL = "https://api.devnet.solana.com";

async function main() {
  console.log("=== Bundle 50/50 Distribution Test ===\n");

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
  const [creator1PatronPoolPda] = getCreatorPatronPoolPda(creator1.publicKey);
  const [creator1PatronTreasuryPda] = getCreatorPatronTreasuryPda(creator1.publicKey);
  const [creator1WeightPda] = getCreatorWeightPda(creator1.publicKey);

  const ecosystemData = await client.fetchEcosystemConfig();
  const treasury = ecosystemData?.treasury || mainWallet.publicKey;

  const timestamp = Date.now();

  // =========================================================================
  // STEP 1: Register 3 content items
  // =========================================================================
  console.log("========================================");
  console.log("STEP 1: Register 3 Content Items");
  console.log("========================================\n");

  const contentIds = [
    `bundle-test-content1-${timestamp}`,
    `bundle-test-content2-${timestamp}`,
    `bundle-test-content3-${timestamp}`,
  ];

  const contentPdas: PublicKey[] = [];
  const contentCollectionAssets: PublicKey[] = [];

  for (let i = 0; i < contentIds.length; i++) {
    const contentId = contentIds[i];
    const [contentPda] = getContentPda(contentId);
    contentPdas.push(contentPda);

    console.log(`Registering content ${i + 1}: ${contentId}`);

    const { instruction: registerIx, collectionAssetKeypair } = await client.registerContentWithMintInstruction(
      creator1.publicKey,
      contentId,
      `QmBundleTestContent${i + 1}`,
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
    contentCollectionAssets.push(collectionAssetKeypair.publicKey);

    await new Promise(r => setTimeout(r, 1500));
  }
  console.log("All 3 content items registered!\n");

  // =========================================================================
  // STEP 2: Mint 1 NFT for each content (to populate ContentRewardPools)
  // =========================================================================
  console.log("========================================");
  console.log("STEP 2: Mint NFTs for Each Content");
  console.log("========================================\n");

  const contentRewardPoolPdas: PublicKey[] = [];

  for (let i = 0; i < contentIds.length; i++) {
    const contentId = contentIds[i];
    const contentPda = contentPdas[i];
    const [contentCollectionPda] = getContentCollectionPda(contentPda);
    const [mintConfigPda] = getMintConfigPda(contentPda);
    const [contentRewardPoolPda] = getContentRewardPoolPda(contentPda);
    contentRewardPoolPdas.push(contentRewardPoolPda);

    const contentCollection = await client.fetchContentCollection(contentId);
    const collectionAsset = contentCollection!.collectionAsset;

    const content = await client.fetchContent(contentId);
    const edition = BigInt(Number(content?.mintedCount || 0) + 1);
    const [nftAssetPda] = getSimpleNftPda(mainWallet.publicKey, contentPda, edition);
    const [unifiedNftStatePda] = getUnifiedNftRewardStatePda(nftAssetPda);

    console.log(`Minting NFT for content ${i + 1}...`);

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

    const poolState = await program.account.contentRewardPool.fetch(contentRewardPoolPda);
    console.log(`  Content ${i + 1} pool: weight=${poolState.totalWeight}, nfts=${poolState.totalNfts}`);
  }
  console.log("All content NFTs minted!\n");

  // =========================================================================
  // STEP 3: Create a bundle containing all 3 contents
  // =========================================================================
  console.log("========================================");
  console.log("STEP 3: Create Bundle");
  console.log("========================================\n");

  const bundleId = `test-bundle-5050-${timestamp}`;
  const [bundlePda] = getBundlePda(creator1.publicKey, bundleId);
  const [bundleCollectionPda] = getBundleCollectionPda(bundlePda);
  const [bundleMintConfigPda] = getBundleMintConfigPda(bundlePda);
  const [bundleRewardPoolPda] = getBundleRewardPoolPda(bundlePda);

  // Create bundle with mint and rent config
  const { instruction: createBundleIx, collectionAssetKeypair: bundleCollectionKeypair } =
    await client.createBundleWithMintAndRentInstruction(
      creator1.publicKey,
      bundleId,
      "QmBundleMetadata",
      "album", // BundleType
      BigInt(0.05 * LAMPORTS_PER_SOL), // 0.05 SOL mint price
      null, // no max supply
      500, // 5% royalty
      BigInt(0.001 * LAMPORTS_PER_SOL), // rentFee6h
      BigInt(0.002 * LAMPORTS_PER_SOL), // rentFee1d
      BigInt(0.005 * LAMPORTS_PER_SOL), // rentFee7d
      mainWallet.publicKey // platform
    );

  const createBundleTx = new Transaction().add(createBundleIx);
  createBundleTx.feePayer = creator1.publicKey;
  createBundleTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  createBundleTx.partialSign(bundleCollectionKeypair);
  await sendAndConfirmTransaction(connection, createBundleTx, [creator1, bundleCollectionKeypair]);
  console.log("Bundle created!");

  await new Promise(r => setTimeout(r, 2000));

  // Add contents to bundle
  console.log("Adding contents to bundle...");
  for (let i = 0; i < contentIds.length; i++) {
    const addContentIx = await client.addBundleItemInstruction(
      creator1.publicKey,
      bundleId,
      contentIds[i],
      i // position
    );
    const addContentTx = new Transaction().add(addContentIx);
    addContentTx.feePayer = creator1.publicKey;
    addContentTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    await sendAndConfirmTransaction(connection, addContentTx, [creator1]);
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log("All contents added to bundle!\n");

  // =========================================================================
  // STEP 4: Record pool states BEFORE bundle mint
  // =========================================================================
  console.log("========================================");
  console.log("STEP 4: Record Pool States BEFORE Bundle Mint");
  console.log("========================================\n");

  const beforeContentPools: { rps: bigint; deposited: bigint; lamports: number }[] = [];
  for (let i = 0; i < contentRewardPoolPdas.length; i++) {
    const poolState = await program.account.contentRewardPool.fetch(contentRewardPoolPdas[i]);
    const lamports = await connection.getBalance(contentRewardPoolPdas[i]);
    beforeContentPools.push({
      rps: BigInt(poolState.rewardPerShare.toString()),
      deposited: BigInt(poolState.totalDeposited.toString()),
      lamports,
    });
    console.log(`Content Pool ${i + 1}:`);
    console.log(`  reward_per_share: ${poolState.rewardPerShare}`);
    console.log(`  total_deposited: ${poolState.totalDeposited}`);
    console.log(`  lamports: ${lamports}`);
  }

  // =========================================================================
  // STEP 5: Mint first bundle NFT (establishes holder pool)
  // =========================================================================
  console.log("\n========================================");
  console.log("STEP 5: Mint First Bundle NFT (Establishes Pool)");
  console.log("========================================\n");

  const bundleData = await client.fetchBundle(creator1.publicKey, bundleId);
  const bundleCollection = await client.fetchBundleCollection(creator1.publicKey, bundleId);
  const bundleCollectionAsset = bundleCollection!.collectionAsset;

  let bundleEdition = BigInt(Number(bundleData?.mintedCount || 0) + 1);
  let [bundleNftAssetPda] = getSimpleBundleNftPda(mainWallet.publicKey, bundlePda, bundleEdition);
  let [bundleUnifiedNftStatePda] = getUnifiedNftRewardStatePda(bundleNftAssetPda);

  // First mint - no 50/50 split (goes to creator as first mint)
  await program.methods
    .simpleMintBundle()
    .accounts({
      ecosystemConfig: ecosystemConfigPda,
      bundle: bundlePda,
      bundleMintConfig: bundleMintConfigPda,
      bundleRewardPool: bundleRewardPoolPda,
      bundleCollection: bundleCollectionPda,
      collectionAsset: bundleCollectionAsset,
      creator: creator1.publicKey,
      treasury: treasury,
      platform: mainWallet.publicKey,
      nftAsset: bundleNftAssetPda,
      unifiedNftState: bundleUnifiedNftStatePda,
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
    .remainingAccounts(contentRewardPoolPdas.map(pubkey => ({
      pubkey,
      isSigner: false,
      isWritable: true,
    })))
    .signers([mainWallet])
    .rpc();

  console.log("First bundle NFT minted (holder pool established)");
  await new Promise(r => setTimeout(r, 2000));

  // Record before second mint
  const beforeBundlePool = await program.account.bundleRewardPool.fetch(bundleRewardPoolPda);
  const beforeBundleLamports = await connection.getBalance(bundleRewardPoolPda);
  console.log(`\nBundleRewardPool BEFORE second mint:`);
  console.log(`  total_weight: ${beforeBundlePool.totalWeight}`);
  console.log(`  reward_per_share: ${beforeBundlePool.rewardPerShare}`);
  console.log(`  lamports: ${beforeBundleLamports}`);

  const beforeContentPoolsSecond: { rps: bigint; deposited: bigint; lamports: number }[] = [];
  for (let i = 0; i < contentRewardPoolPdas.length; i++) {
    const poolState = await program.account.contentRewardPool.fetch(contentRewardPoolPdas[i]);
    const lamports = await connection.getBalance(contentRewardPoolPdas[i]);
    beforeContentPoolsSecond.push({
      rps: BigInt(poolState.rewardPerShare.toString()),
      deposited: BigInt(poolState.totalDeposited.toString()),
      lamports,
    });
  }

  // =========================================================================
  // STEP 6: Mint second bundle NFT (triggers 50/50 distribution)
  // =========================================================================
  console.log("\n========================================");
  console.log("STEP 6: Mint Second Bundle NFT (50/50 Distribution)");
  console.log("========================================\n");

  // Fetch updated bundle state
  const bundleData2 = await client.fetchBundle(creator1.publicKey, bundleId);
  bundleEdition = BigInt(Number(bundleData2?.mintedCount || 0) + 1);
  [bundleNftAssetPda] = getSimpleBundleNftPda(mainWallet.publicKey, bundlePda, bundleEdition);
  [bundleUnifiedNftStatePda] = getUnifiedNftRewardStatePda(bundleNftAssetPda);

  // Second mint - triggers 50/50 split
  await program.methods
    .simpleMintBundle()
    .accounts({
      ecosystemConfig: ecosystemConfigPda,
      bundle: bundlePda,
      bundleMintConfig: bundleMintConfigPda,
      bundleRewardPool: bundleRewardPoolPda,
      bundleCollection: bundleCollectionPda,
      collectionAsset: bundleCollectionAsset,
      creator: creator1.publicKey,
      treasury: treasury,
      platform: mainWallet.publicKey,
      nftAsset: bundleNftAssetPda,
      unifiedNftState: bundleUnifiedNftStatePda,
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
    .remainingAccounts(contentRewardPoolPdas.map(pubkey => ({
      pubkey,
      isSigner: false,
      isWritable: true,
    })))
    .signers([mainWallet])
    .rpc();

  console.log("Second bundle NFT minted with 50/50 distribution!");
  await new Promise(r => setTimeout(r, 2000));

  // =========================================================================
  // STEP 7: Verify 50/50 distribution
  // =========================================================================
  console.log("\n========================================");
  console.log("STEP 7: Verify 50/50 Distribution");
  console.log("========================================\n");

  const mintPrice = 0.05 * LAMPORTS_PER_SOL; // 0.05 SOL
  const holderReward = Math.floor(mintPrice * 0.12); // 12% = 6,000,000 lamports
  const expectedBundleShare = Math.floor(holderReward / 2); // 50% = 3,000,000 lamports
  const expectedContentShare = holderReward - expectedBundleShare; // 50% = 3,000,000 lamports
  const expectedPerContentPool = Math.floor(expectedContentShare / 3); // ~1,000,000 lamports each

  console.log(`Mint price: ${mintPrice} lamports (${mintPrice / LAMPORTS_PER_SOL} SOL)`);
  console.log(`Total holder reward (12%): ${holderReward} lamports`);
  console.log(`Expected bundle share (50%): ${expectedBundleShare} lamports`);
  console.log(`Expected content share (50%): ${expectedContentShare} lamports`);
  console.log(`Expected per content pool: ~${expectedPerContentPool} lamports\n`);

  // Check BundleRewardPool
  const afterBundlePool = await program.account.bundleRewardPool.fetch(bundleRewardPoolPda);
  const afterBundleLamports = await connection.getBalance(bundleRewardPoolPda);
  const bundleLamportsDelta = afterBundleLamports - beforeBundleLamports;

  console.log("BundleRewardPool:");
  console.log(`  lamports: ${beforeBundleLamports} -> ${afterBundleLamports} (delta: +${bundleLamportsDelta})`);
  console.log(`  Expected delta: +${expectedBundleShare}`);
  console.log(`  Status: ${bundleLamportsDelta === expectedBundleShare ? "✓ CORRECT" : "✗ MISMATCH"}`);

  // Check ContentRewardPools
  console.log("\nContentRewardPools:");
  let totalContentDelta = 0;
  const contentResults: { pool: number; delta: number; expected: number; correct: boolean }[] = [];

  for (let i = 0; i < contentRewardPoolPdas.length; i++) {
    const afterPoolState = await program.account.contentRewardPool.fetch(contentRewardPoolPdas[i]);
    const afterLamports = await connection.getBalance(contentRewardPoolPdas[i]);
    const delta = afterLamports - beforeContentPoolsSecond[i].lamports;
    totalContentDelta += delta;

    // First pool gets remainder
    const expected = i === 0
      ? expectedPerContentPool + (expectedContentShare % 3)
      : expectedPerContentPool;

    const correct = delta === expected;
    contentResults.push({ pool: i + 1, delta, expected, correct });

    console.log(`  Content Pool ${i + 1}:`);
    console.log(`    lamports: ${beforeContentPoolsSecond[i].lamports} -> ${afterLamports} (delta: +${delta})`);
    console.log(`    Expected delta: +${expected}`);
    console.log(`    Status: ${correct ? "✓ CORRECT" : "✗ MISMATCH"}`);
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log("\n========================================");
  console.log("SUMMARY");
  console.log("========================================\n");

  const bundleCorrect = bundleLamportsDelta === expectedBundleShare;
  const contentCorrect = totalContentDelta === expectedContentShare;
  const allCorrect = bundleCorrect && contentCorrect && contentResults.every(r => r.correct);

  console.log(`Total holder reward: ${holderReward} lamports`);
  console.log(`BundleRewardPool received: ${bundleLamportsDelta} lamports (${bundleCorrect ? "✓" : "✗"})`);
  console.log(`ContentRewardPools received: ${totalContentDelta} lamports (${contentCorrect ? "✓" : "✗"})`);
  console.log(`Sum: ${bundleLamportsDelta + totalContentDelta} lamports`);

  if (allCorrect) {
    console.log("\n✓ 50/50 DISTRIBUTION VERIFIED!");
    console.log(`  - 50% (${expectedBundleShare} lamports) -> BundleRewardPool`);
    console.log(`  - 50% (${expectedContentShare} lamports) -> 3 ContentRewardPools`);
  } else {
    console.log("\n✗ DISTRIBUTION MISMATCH - Check details above");
  }
}

main().catch(console.error);
