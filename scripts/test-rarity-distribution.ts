/**
 * Test rarity distribution by minting multiple NFTs
 * Run with: npx tsx scripts/test-rarity-distribution.ts
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
const NUM_MINTS = 20; // Number of NFTs to mint for distribution test

async function main() {
  console.log("=== Rarity Distribution Test ===\n");
  console.log(`Minting ${NUM_MINTS} NFTs to test rarity distribution...\n`);

  const connection = new Connection(RPC_URL, "confirmed");

  // Load main wallet
  const keypairPath = path.join(process.env.HOME!, ".config/solana/id.json");
  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(new Uint8Array(secretKey));

  console.log("Wallet:", wallet.publicKey.toBase58());
  const balance = await connection.getBalance(wallet.publicKey);
  console.log("Balance:", balance / LAMPORTS_PER_SOL, "SOL\n");

  if (balance < 2 * LAMPORTS_PER_SOL) {
    console.error("Need at least 2 SOL for this test");
    return;
  }

  // Load IDL and create program
  const idlPath = path.join(__dirname, "../packages/sdk/src/program/content_registry.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const provider = new AnchorProvider(connection, new Wallet(wallet), { commitment: "confirmed" });
  const program = new Program(idl, provider);
  const client = createContentRegistryClient(connection);

  // Get PDAs
  const [ecosystemConfigPda] = getEcosystemConfigPda();
  const [globalHolderPoolPda] = getGlobalHolderPoolPda();
  const [creatorDistPoolPda] = getCreatorDistPoolPda();
  const [ecosystemEpochStatePda] = getEcosystemEpochStatePda();
  const [ecosystemStreamingTreasuryPda] = getEcosystemStreamingTreasuryPda();
  const [creatorPatronPoolPda] = getCreatorPatronPoolPda(wallet.publicKey);
  const [creatorPatronTreasuryPda] = getCreatorPatronTreasuryPda(wallet.publicKey);
  const [creatorWeightPda] = getCreatorWeightPda(wallet.publicKey);

  const ecosystemData = await client.fetchEcosystemConfig();
  const treasury = ecosystemData?.treasury || wallet.publicKey;

  // Use existing content or find one
  const existingContents = await connection.getProgramAccounts(program.programId, {
    filters: [{ dataSize: 8 + 32 + 64 + 64 + 8 + 8 + 1 + 1 + 1 + 2 + 64 + 64 }], // Content size
  });

  let CONTENT_CID: string;
  let contentPda: PublicKey;
  let collectionAsset: PublicKey;

  // Find a content with mintable status from the wallet
  const testContentId = `rarity-test-${Date.now()}`;
  const [testContentPda] = getContentPda(testContentId);
  const [contentCollectionPda] = getContentCollectionPda(testContentPda);
  const [mintConfigPda] = getMintConfigPda(testContentPda);
  const [contentRewardPoolPda] = getContentRewardPoolPda(testContentPda);

  // Register new content for this test
  console.log("Registering content for rarity test...");
  const { instruction: registerIx, collectionAssetKeypair } = await client.registerContentWithMintInstruction(
    wallet.publicKey,
    testContentId,
    "QmRarityTest",
    ContentType.Video,
    BigInt(0.01 * LAMPORTS_PER_SOL), // 0.01 SOL - cheap for testing
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
  console.log("Content registered!\n");

  await new Promise(r => setTimeout(r, 2000));

  const contentCollection = await client.fetchContentCollection(testContentId);
  collectionAsset = contentCollection!.collectionAsset;
  CONTENT_CID = testContentId;
  contentPda = testContentPda;

  // Track rarity distribution
  const rarityCount: Record<string, number> = {
    common: 0,
    uncommon: 0,
    rare: 0,
    epic: 0,
    legendary: 0,
  };
  const weightTotal: Record<string, number> = {
    common: 0,
    uncommon: 0,
    rare: 0,
    epic: 0,
    legendary: 0,
  };

  console.log("Starting mints...\n");

  for (let i = 1; i <= NUM_MINTS; i++) {
    const content = await client.fetchContent(CONTENT_CID);
    const edition = BigInt(Number(content?.mintedCount || 0) + 1);
    const [nftAssetPda] = getSimpleNftPda(wallet.publicKey, contentPda, edition);
    const [unifiedNftStatePda] = getUnifiedNftRewardStatePda(nftAssetPda);

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

      await new Promise(r => setTimeout(r, 1500));

      const nftState = await program.account.unifiedNftRewardState.fetch(unifiedNftStatePda);
      const rarity = Object.keys(nftState.rarity)[0].toLowerCase();
      const weight = nftState.weight;

      rarityCount[rarity]++;
      weightTotal[rarity] += weight;

      const bar = "█".repeat(Math.ceil(i / 2));
      process.stdout.write(`\r[${bar.padEnd(10)}] ${i}/${NUM_MINTS} - Last: ${rarity.padEnd(9)} (w:${weight})`);
    } catch (err: any) {
      console.error(`\nMint ${i} failed:`, err.message);
      // Continue with next mint
    }
  }

  console.log("\n\n========================================");
  console.log("RARITY DISTRIBUTION RESULTS");
  console.log("========================================\n");

  const total = Object.values(rarityCount).reduce((a, b) => a + b, 0);
  const totalWeight = Object.values(weightTotal).reduce((a, b) => a + b, 0);

  console.log("Rarity     | Count | Actual % | Expected % | Weight");
  console.log("-----------|-------|----------|------------|-------");

  const expected: Record<string, number> = {
    common: 55,
    uncommon: 27,
    rare: 13,
    epic: 4,
    legendary: 1,
  };

  for (const [rarity, count] of Object.entries(rarityCount)) {
    const actual = total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
    const exp = expected[rarity];
    const weight = weightTotal[rarity];
    console.log(`${rarity.padEnd(10)} | ${String(count).padStart(5)} | ${actual.padStart(7)}% | ${String(exp).padStart(9)}% | ${weight}`);
  }

  console.log("-----------|-------|----------|------------|-------");
  console.log(`Total      | ${String(total).padStart(5)} |          |            | ${totalWeight}`);

  console.log("\n========================================");
  console.log("WEIGHT ANALYSIS");
  console.log("========================================\n");

  console.log(`Total NFTs: ${total}`);
  console.log(`Total Weight: ${totalWeight}`);
  console.log(`Average Weight per NFT: ${(totalWeight / total).toFixed(2)}`);
  console.log(`Expected Average (theoretical): ~4.32`);

  // Chi-square test (rough)
  console.log("\n========================================");
  console.log("STATISTICAL ANALYSIS");
  console.log("========================================\n");

  let chiSquare = 0;
  for (const [rarity, count] of Object.entries(rarityCount)) {
    const expectedCount = (expected[rarity] / 100) * total;
    if (expectedCount > 0) {
      chiSquare += Math.pow(count - expectedCount, 2) / expectedCount;
    }
  }
  console.log(`Chi-square value: ${chiSquare.toFixed(2)}`);
  console.log(`(Lower is better - values under 9.49 indicate good fit at 95% confidence for df=4)`);

  console.log("\nTest complete!");
}

main().catch(console.error);
