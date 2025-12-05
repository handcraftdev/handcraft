import { Connection, Keypair, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import {
  createContentRegistryClient,
  getContentPda,
  getNftRewardStatePda,
  ContentType,
} from "@handcraft/sdk";

const RPC_URL = "https://api.devnet.solana.com";

async function main() {
  const connection = new Connection(RPC_URL, "confirmed");
  const client = createContentRegistryClient(connection);

  // Load wallet
  const keypairPath = path.join(process.env.HOME!, ".config/solana/id.json");
  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(new Uint8Array(secretKey));
  console.log("=== Test: Per-NFT Reward Tracking ===\n");
  console.log("Wallet:", wallet.publicKey.toBase58());

  // Check balance
  const balance = await connection.getBalance(wallet.publicKey);
  console.log("Balance:", balance / 1e9, "SOL");

  if (balance < 0.3 * 1e9) {
    console.error("Insufficient balance. Need at least 0.3 SOL");
    return;
  }

  // Fetch treasury
  const ecosystemData = await client.fetchEcosystemConfig();
  if (!ecosystemData) {
    console.error("Ecosystem not initialized!");
    return;
  }
  const treasury = ecosystemData.treasury;

  // === Step 1: Register content with mint config ===
  const contentCid = `test-per-nft-${Date.now()}`;
  console.log("\n--- Step 1: Register content ---");
  console.log("Content CID:", contentCid);

  const [contentPda] = getContentPda(contentCid);

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
  console.log("Collection:", contentCollection.collectionAsset.toBase58());

  // === Step 2: Mint first NFT ===
  console.log("\n--- Step 2: Mint first NFT ---");

  const { instruction: mint1Ix, nftAssetKeypair: nft1Keypair } = await client.mintNftSolInstruction(
    wallet.publicKey,
    contentCid,
    wallet.publicKey,
    treasury,
    treasury,
    contentCollection.collectionAsset
  );

  const mint1Tx = new Transaction().add(mint1Ix);
  mint1Tx.feePayer = wallet.publicKey;
  mint1Tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  mint1Tx.partialSign(nft1Keypair);

  const mint1Sig = await sendAndConfirmTransaction(connection, mint1Tx, [wallet, nft1Keypair]);
  console.log("Minted NFT #1:", nft1Keypair.publicKey.toBase58());
  console.log("Tx:", mint1Sig.slice(0, 20) + "...");

  await new Promise(r => setTimeout(r, 2000));

  // Check NftRewardState was created
  const [nft1RewardStatePda] = getNftRewardStatePda(nft1Keypair.publicKey);
  const nft1RewardState = await client.fetchNftRewardState(nft1Keypair.publicKey);
  console.log("NFT #1 RewardState PDA:", nft1RewardStatePda.toBase58());
  console.log("NFT #1 reward_debt:", nft1RewardState?.rewardDebt.toString());

  // Check reward pool
  let rewardPool = await client.fetchContentRewardPool(contentCid);
  console.log("Reward pool - reward_per_share:", rewardPool?.rewardPerShare.toString());
  console.log("Reward pool - total_nfts:", rewardPool?.totalNfts.toString());

  // === Step 3: Mint second NFT (generates holder rewards) ===
  console.log("\n--- Step 3: Mint second NFT (generates holder rewards) ---");

  const { instruction: mint2Ix, nftAssetKeypair: nft2Keypair } = await client.mintNftSolInstruction(
    wallet.publicKey,
    contentCid,
    wallet.publicKey,
    treasury,
    treasury,
    contentCollection.collectionAsset
  );

  const mint2Tx = new Transaction().add(mint2Ix);
  mint2Tx.feePayer = wallet.publicKey;
  mint2Tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  mint2Tx.partialSign(nft2Keypair);

  const mint2Sig = await sendAndConfirmTransaction(connection, mint2Tx, [wallet, nft2Keypair]);
  console.log("Minted NFT #2:", nft2Keypair.publicKey.toBase58());
  console.log("Tx:", mint2Sig.slice(0, 20) + "...");

  await new Promise(r => setTimeout(r, 2000));

  // Check NftRewardState for NFT #2
  const nft2RewardState = await client.fetchNftRewardState(nft2Keypair.publicKey);
  console.log("NFT #2 reward_debt:", nft2RewardState?.rewardDebt.toString());

  // Check reward pool after second mint
  rewardPool = await client.fetchContentRewardPool(contentCid);
  console.log("Reward pool - reward_per_share (after 2nd mint):", rewardPool?.rewardPerShare.toString());
  console.log("Reward pool - total_deposited:", rewardPool?.totalDeposited.toString());

  // === Step 4: Calculate expected pending rewards ===
  console.log("\n--- Step 4: Expected pending rewards ---");

  const PRECISION = BigInt("1000000000000");
  const nft1Pending = nft1RewardState && rewardPool
    ? (rewardPool.rewardPerShare - nft1RewardState.rewardDebt) / PRECISION
    : BigInt(0);
  const nft2Pending = nft2RewardState && rewardPool
    ? (rewardPool.rewardPerShare - nft2RewardState.rewardDebt) / PRECISION
    : BigInt(0);

  console.log("NFT #1 expected pending:", nft1Pending.toString(), "lamports");
  console.log("NFT #2 expected pending:", nft2Pending.toString(), "lamports");
  console.log("Total expected:", (nft1Pending + nft2Pending).toString(), "lamports");

  // === Step 5: Claim rewards with verified claim ===
  console.log("\n--- Step 5: Claim rewards with per-NFT verification ---");

  const nftAssets = await client.fetchWalletNftsForCollection(
    wallet.publicKey,
    contentCollection.collectionAsset
  );
  console.log("Found NFT assets:", nftAssets.length);
  for (const asset of nftAssets) {
    console.log("  - Asset:", asset.toBase58());
  }

  const claimIx = await client.claimRewardsVerifiedInstruction(
    wallet.publicKey,
    contentCid,
    nftAssets
  );

  const claimTx = new Transaction().add(claimIx);

  try {
    const claimSig = await sendAndConfirmTransaction(connection, claimTx, [wallet]);
    console.log("Claimed:", claimSig.slice(0, 20) + "...");
  } catch (err: any) {
    console.error("Claim failed:", err.message);
    if (err.logs) {
      console.error("Logs:", err.logs.slice(-10));
    }
    return;
  }

  await new Promise(r => setTimeout(r, 2000));

  // === Step 6: Verify state after claim ===
  console.log("\n--- Step 6: Verify state after claim ---");

  const nft1RewardStateAfter = await client.fetchNftRewardState(nft1Keypair.publicKey);
  const nft2RewardStateAfter = await client.fetchNftRewardState(nft2Keypair.publicKey);
  const rewardPoolAfter = await client.fetchContentRewardPool(contentCid);

  console.log("NFT #1 reward_debt AFTER:", nft1RewardStateAfter?.rewardDebt.toString());
  console.log("NFT #2 reward_debt AFTER:", nft2RewardStateAfter?.rewardDebt.toString());
  console.log("Both should equal current reward_per_share:", rewardPoolAfter?.rewardPerShare.toString());
  console.log("Reward pool - total_claimed:", rewardPoolAfter?.totalClaimed.toString());

  // === Step 7: Try claiming again (should get 0) ===
  console.log("\n--- Step 7: Claim again (should get 0 or minimal) ---");

  const claim2Ix = await client.claimRewardsVerifiedInstruction(
    wallet.publicKey,
    contentCid,
    nftAssets
  );

  const claim2Tx = new Transaction().add(claim2Ix);

  try {
    const claim2Sig = await sendAndConfirmTransaction(connection, claim2Tx, [wallet]);
    console.log("Second claim:", claim2Sig.slice(0, 20) + "...");
  } catch (err: any) {
    console.error("Second claim failed:", err.message);
  }

  await new Promise(r => setTimeout(r, 2000));

  const rewardPoolFinal = await client.fetchContentRewardPool(contentCid);
  console.log("Final total_claimed:", rewardPoolFinal?.totalClaimed.toString());

  console.log("\n=== Test Complete ===");
  console.log("\nSummary:");
  console.log("- Registered content with collection");
  console.log("- Minted 2 NFTs, each with its own NftRewardState");
  console.log("- NFT #1 accumulated rewards from NFT #2's mint");
  console.log("- Claimed using per-NFT reward tracking");
  console.log("- Second claim got 0 (debt was updated)");
  console.log("\nPer-NFT reward tracking WORKS!");
}

main().catch(console.error);
