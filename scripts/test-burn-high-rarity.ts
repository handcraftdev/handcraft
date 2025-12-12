/**
 * Test burn with higher rarity NFT
 * Run with: npx tsx scripts/test-burn-high-rarity.ts
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

interface MintedNft {
  edition: bigint;
  rarity: string;
  weight: number;
  assetPda: PublicKey;
  statePda: PublicKey;
}

async function main() {
  console.log("=== Burn High Rarity NFT Test ===\n");

  const connection = new Connection(RPC_URL, "confirmed");

  // Load wallets
  const keypairPath = path.join(process.env.HOME!, ".config/solana/id.json");
  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const mainWallet = Keypair.fromSecretKey(new Uint8Array(secretKey));

  const creator1Path = path.join(__dirname, "test-wallets/creator1.json");
  const creator1Key = JSON.parse(fs.readFileSync(creator1Path, "utf-8"));
  const creator1 = Keypair.fromSecretKey(new Uint8Array(creator1Key));

  console.log("Main wallet:", mainWallet.publicKey.toBase58());

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

  // Register content
  const testContentId = `burn-rarity-test-${Date.now()}`;
  const [contentPda] = getContentPda(testContentId);
  const [contentCollectionPda] = getContentCollectionPda(contentPda);
  const [mintConfigPda] = getMintConfigPda(contentPda);
  const [contentRewardPoolPda] = getContentRewardPoolPda(contentPda);

  console.log("Registering content...");
  const creator1Provider = new AnchorProvider(connection, new Wallet(creator1), { commitment: "confirmed" });

  const { instruction: registerIx, collectionAssetKeypair } = await client.registerContentWithMintInstruction(
    creator1.publicKey,
    testContentId,
    "QmBurnRarityTest",
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
  console.log("Content registered!\n");

  await new Promise(r => setTimeout(r, 2000));

  const contentCollection = await client.fetchContentCollection(testContentId);
  const collectionAsset = contentCollection!.collectionAsset;

  // Mint NFTs until we get a non-common one
  const mintedNfts: MintedNft[] = [];
  let foundHighRarity = false;
  const MAX_MINTS = 15;

  console.log("Minting NFTs to find higher rarity...\n");

  for (let i = 1; i <= MAX_MINTS && !foundHighRarity; i++) {
    const content = await client.fetchContent(testContentId);
    const edition = BigInt(Number(content?.mintedCount || 0) + 1);
    const [nftAssetPda] = getSimpleNftPda(mainWallet.publicKey, contentPda, edition);
    const [unifiedNftStatePda] = getUnifiedNftRewardStatePda(nftAssetPda);

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

    mintedNfts.push({
      edition,
      rarity,
      weight,
      assetPda: nftAssetPda,
      statePda: unifiedNftStatePda,
    });

    console.log(`  Mint #${i}: ${rarity} (weight: ${weight})`);

    if (weight > 1) {
      foundHighRarity = true;
      console.log(`\n  Found higher rarity NFT!`);
    }
  }

  // Find the highest rarity NFT to burn
  const nftToBurn = mintedNfts.reduce((max, nft) => nft.weight > max.weight ? nft : max, mintedNfts[0]);

  console.log(`\n========================================`);
  console.log(`BURNING: ${nftToBurn.rarity} NFT (weight: ${nftToBurn.weight})`);
  console.log(`========================================\n`);

  // Record pool states before burn
  const beforeGlobalHolder = await program.account.globalHolderPool.fetch(globalHolderPoolPda);
  const beforeCreatorDist = await program.account.creatorDistPool.fetch(creatorDistPoolPda);
  const beforeCreator1Weight = await program.account.creatorWeight.fetch(creator1WeightPda);
  const beforeContentPool = await program.account.contentRewardPool.fetch(contentRewardPoolPda);
  const beforeCreator1PatronPool = await program.account.creatorPatronPool.fetch(creator1PatronPoolPda);

  console.log("Pool weights BEFORE burn:");
  console.log(`  GlobalHolderPool: ${beforeGlobalHolder.totalWeight}`);
  console.log(`  CreatorDistPool: ${beforeCreatorDist.totalWeight}`);
  console.log(`  CreatorWeight: ${beforeCreator1Weight.totalWeight}`);
  console.log(`  ContentRewardPool: ${beforeContentPool.totalWeight}`);
  console.log(`  CreatorPatronPool: ${beforeCreator1PatronPool.totalWeight}`);

  // Burn the NFT
  console.log("\nBurning NFT...");
  await program.methods
    .burnNftWithSubscription()
    .accounts({
      content: contentPda,
      contentCollection: contentCollectionPda,
      contentRewardPool: contentRewardPoolPda,
      unifiedNftState: nftToBurn.statePda,
      creator: creator1.publicKey,
      creatorPatronPool: creator1PatronPoolPda,
      globalHolderPool: globalHolderPoolPda,
      creatorDistPool: creatorDistPoolPda,
      creatorWeight: creator1WeightPda,
      nftAsset: nftToBurn.assetPda,
      collectionAsset: collectionAsset,
      owner: mainWallet.publicKey,
      mplCoreProgram: new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"),
      systemProgram: PublicKey.default,
    })
    .signers([mainWallet])
    .rpc();

  console.log("NFT burned!");
  await new Promise(r => setTimeout(r, 2000));

  // Verify pool states after burn
  const afterGlobalHolder = await program.account.globalHolderPool.fetch(globalHolderPoolPda);
  const afterCreatorDist = await program.account.creatorDistPool.fetch(creatorDistPoolPda);
  const afterCreator1Weight = await program.account.creatorWeight.fetch(creator1WeightPda);
  const afterContentPool = await program.account.contentRewardPool.fetch(contentRewardPoolPda);
  const afterCreator1PatronPool = await program.account.creatorPatronPool.fetch(creator1PatronPoolPda);

  console.log("\n========================================");
  console.log("VERIFICATION RESULTS");
  console.log("========================================\n");

  const expectedDelta = nftToBurn.weight;

  const results = [
    {
      pool: "GlobalHolderPool",
      before: beforeGlobalHolder.totalWeight.toNumber(),
      after: afterGlobalHolder.totalWeight.toNumber(),
    },
    {
      pool: "CreatorDistPool",
      before: beforeCreatorDist.totalWeight.toNumber(),
      after: afterCreatorDist.totalWeight.toNumber(),
    },
    {
      pool: "CreatorWeight",
      before: beforeCreator1Weight.totalWeight.toNumber(),
      after: afterCreator1Weight.totalWeight.toNumber(),
    },
    {
      pool: "ContentRewardPool",
      before: beforeContentPool.totalWeight.toNumber(),
      after: afterContentPool.totalWeight.toNumber(),
    },
    {
      pool: "CreatorPatronPool",
      before: beforeCreator1PatronPool.totalWeight.toNumber(),
      after: afterCreator1PatronPool.totalWeight.toNumber(),
    },
  ];

  let allCorrect = true;
  for (const r of results) {
    const delta = r.before - r.after;
    const correct = delta === expectedDelta;
    if (!correct) allCorrect = false;
    console.log(`${r.pool}:`);
    console.log(`  ${r.before} -> ${r.after} (delta: -${delta})`);
    console.log(`  Expected: -${expectedDelta}`);
    console.log(`  Status: ${correct ? "✓ CORRECT" : "✗ MISMATCH"}\n`);
  }

  console.log("========================================");
  if (allCorrect) {
    console.log(`✓ ALL CORRECT! Burned ${nftToBurn.rarity} NFT (weight: ${nftToBurn.weight})`);
  } else {
    console.log("✗ SOME MISMATCHES FOUND");
  }
  console.log("========================================");
}

main().catch(console.error);
