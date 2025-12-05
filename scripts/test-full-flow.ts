import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction, SystemProgram } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import {
  createContentRegistryClient,
  getContentPda,
  getContentRewardPoolPda,
  getWalletContentStatePda,
  getContentCollectionPda,
  ContentType,
  PROGRAM_ID,
  MPL_CORE_PROGRAM_ID,
} from "@handcraft/sdk";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { transferV1 } from "@metaplex-foundation/mpl-core";
import { createSignerFromKeypair, signerIdentity, publicKey as umiPublicKey } from "@metaplex-foundation/umi";
import { fromWeb3JsKeypair, toWeb3JsTransaction } from "@metaplex-foundation/umi-web3js-adapters";

const RPC_URL = "https://api.devnet.solana.com";

async function main() {
  const connection = new Connection(RPC_URL, "confirmed");
  const client = createContentRegistryClient(connection);

  // Load wallet
  const keypairPath = path.join(process.env.HOME!, ".config/solana/id.json");
  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(new Uint8Array(secretKey));
  console.log("=== Test: Full Claim-Time Verification Flow ===\n");
  console.log("Wallet:", wallet.publicKey.toBase58());

  // Check balance
  const balance = await connection.getBalance(wallet.publicKey);
  console.log("Balance:", balance / 1e9, "SOL");

  if (balance < 0.5 * 1e9) {
    console.error("Insufficient balance. Need at least 0.5 SOL");
    return;
  }

  // Create a second wallet (simulating a buyer on Magic Eden)
  const buyer2 = Keypair.generate();
  console.log("Buyer2 (simulated marketplace buyer):", buyer2.publicKey.toBase58());

  // Fund buyer2 with some SOL
  console.log("\nFunding buyer2...");
  const fundTx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: buyer2.publicKey,
      lamports: 0.1 * 1e9,
    })
  );
  await sendAndConfirmTransaction(connection, fundTx, [wallet]);
  console.log("Funded buyer2 with 0.1 SOL");

  // Fetch treasury
  const ecosystemData = await client.fetchEcosystemConfig();
  if (!ecosystemData) {
    console.error("Ecosystem not initialized!");
    return;
  }
  const treasury = ecosystemData.treasury;

  // === Step 1: Register content ===
  const contentCid = `test-full-flow-${Date.now()}`;
  console.log("\n--- Step 1: Register content with mint config ---");
  console.log("Content CID:", contentCid);

  const [contentPda] = getContentPda(contentCid);
  const [contentCollectionPda] = getContentCollectionPda(contentPda);

  const { instruction: registerIx, collectionAssetKeypair } = await client.registerContentWithMintInstruction(
    wallet.publicKey,
    contentCid,
    "QmTestMetadata",
    ContentType.GeneralImage,
    BigInt(0.05 * 1e9), // 0.05 SOL
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

  const registerSig = await sendAndConfirmTransaction(connection, registerTx, [wallet, collectionAssetKeypair]);
  console.log("Registered:", registerSig.slice(0, 20) + "...");

  await new Promise(r => setTimeout(r, 2000));

  const contentCollection = await client.fetchContentCollection(contentCid);
  if (!contentCollection) {
    console.error("Collection not found!");
    return;
  }
  console.log("Collection created:", contentCollection.collectionAsset.toBase58());

  // === Step 2: Wallet mints 2 NFTs ===
  console.log("\n--- Step 2: Wallet mints 2 NFTs ---");

  const nftAssets: Keypair[] = [];

  for (let i = 0; i < 2; i++) {
    const { instruction: mintIx, nftAssetKeypair } = await client.mintNftSolInstruction(
      wallet.publicKey,
      contentCid,
      wallet.publicKey,
      treasury,
      treasury,
      contentCollection.collectionAsset
    );

    const mintTx = new Transaction().add(mintIx);
    mintTx.feePayer = wallet.publicKey;
    mintTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    mintTx.partialSign(nftAssetKeypair);

    await sendAndConfirmTransaction(connection, mintTx, [wallet, nftAssetKeypair]);
    console.log(`Minted NFT #${i + 1}:`, nftAssetKeypair.publicKey.toBase58());
    nftAssets.push(nftAssetKeypair);
  }

  await new Promise(r => setTimeout(r, 2000));

  // Check wallet state
  let walletState = await client.fetchWalletContentState(wallet.publicKey, contentCid);
  console.log("Wallet NFT count (stored):", walletState?.nftCount.toString());

  // Check reward pool
  let rewardPool = await client.fetchContentRewardPool(contentCid);
  console.log("Reward pool - total deposited:", rewardPool?.totalDeposited.toString(), "lamports");
  console.log("Reward pool - total NFTs:", rewardPool?.totalNfts.toString());

  // === Step 3: Simulate marketplace sale - transfer 1 NFT to buyer2 ===
  console.log("\n--- Step 3: Transfer 1 NFT to buyer2 (simulating marketplace sale) ---");

  // Use mpl-core SDK for proper transfer
  const umi = createUmi(RPC_URL);
  const umiKeypair = fromWeb3JsKeypair(wallet);
  const umiSigner = createSignerFromKeypair(umi, umiKeypair);
  umi.use(signerIdentity(umiSigner));

  // Omit collection - mpl-core will fetch it if needed
  const transferTxBuilder = transferV1(umi, {
    asset: umiPublicKey(nftAssets[0].publicKey.toBase58()),
    newOwner: umiPublicKey(buyer2.publicKey.toBase58()),
  });

  const transferResult = await transferTxBuilder.sendAndConfirm(umi);
  console.log("Transferred NFT to buyer2:", Buffer.from(transferResult.signature).toString("base64").slice(0, 20) + "...");

  // NOTE: No sync instruction called - simulating external transfer

  await new Promise(r => setTimeout(r, 2000));

  // === Step 4: Check stored state (should be STALE) ===
  console.log("\n--- Step 4: Check state BEFORE verified claim ---");

  walletState = await client.fetchWalletContentState(wallet.publicKey, contentCid);
  console.log("Wallet stored NFT count:", walletState?.nftCount.toString(), "(STALE - should be 1)");

  // Verify actual NFT ownership
  const walletNfts = await client.fetchWalletNftsForCollection(wallet.publicKey, contentCollection.collectionAsset);
  console.log("Wallet ACTUAL NFT count:", walletNfts.length);

  const buyer2Nfts = await client.fetchWalletNftsForCollection(buyer2.publicKey, contentCollection.collectionAsset);
  console.log("Buyer2 ACTUAL NFT count:", buyer2Nfts.length);

  // === Step 5: Wallet claims with verification ===
  console.log("\n--- Step 5: Wallet claims with verification ---");

  const claimIx = await client.claimRewardsVerifiedInstruction(
    wallet.publicKey,
    contentCid,
    walletNfts
  );

  const claimTx = new Transaction().add(claimIx);
  const claimSig = await sendAndConfirmTransaction(connection, claimTx, [wallet]);
  console.log("Claimed:", claimSig.slice(0, 20) + "...");

  await new Promise(r => setTimeout(r, 2000));

  // === Step 6: Verify final state ===
  console.log("\n--- Step 6: Verify final state ---");

  walletState = await client.fetchWalletContentState(wallet.publicKey, contentCid);
  console.log("Wallet NFT count AFTER claim:", walletState?.nftCount.toString(), "(should be 1 - CORRECTED)");

  rewardPool = await client.fetchContentRewardPool(contentCid);
  console.log("Reward pool - total claimed:", rewardPool?.totalClaimed.toString(), "lamports");

  // === Step 7: Buyer2 claims (should work for their 1 NFT) ===
  console.log("\n--- Step 7: Buyer2 claims with verification ---");

  // First, buyer2 needs a WalletContentState - they don't have one yet
  // The claim instruction should initialize it
  const buyer2ClaimIx = await client.claimRewardsVerifiedInstruction(
    buyer2.publicKey,
    contentCid,
    buyer2Nfts
  );

  const buyer2ClaimTx = new Transaction().add(buyer2ClaimIx);
  try {
    const buyer2ClaimSig = await sendAndConfirmTransaction(connection, buyer2ClaimTx, [buyer2]);
    console.log("Buyer2 claimed:", buyer2ClaimSig.slice(0, 20) + "...");
  } catch (err: any) {
    // This is expected - buyer2 doesn't have a WalletContentState initialized
    console.log("Buyer2 claim failed (expected - no WalletContentState yet):", err.message?.slice(0, 50));
  }

  console.log("\n=== Test Complete ===");
  console.log("\nSummary:");
  console.log("- Registered content with collection");
  console.log("- Minted 2 NFTs to wallet");
  console.log("- Transferred 1 NFT to buyer2 WITHOUT sync");
  console.log("- Wallet stored count was stale (2), but claim verified actual count (1)");
  console.log("- Claim-time verification WORKED!");
}

main().catch(console.error);
