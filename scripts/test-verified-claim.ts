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
} from "@handcraft/sdk";

const RPC_URL = "https://api.devnet.solana.com";

async function main() {
  const connection = new Connection(RPC_URL, "confirmed");
  const client = createContentRegistryClient(connection);

  // Load wallet
  const keypairPath = path.join(process.env.HOME!, ".config/solana/id.json");
  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(new Uint8Array(secretKey));
  console.log("Wallet:", wallet.publicKey.toBase58());

  // Check balance
  const balance = await connection.getBalance(wallet.publicKey);
  console.log("Balance:", balance / 1e9, "SOL");

  if (balance < 0.3 * 1e9) {
    console.error("Insufficient balance. Need at least 0.3 SOL");
    return;
  }

  // Fetch treasury from ecosystem config
  const ecosystemData = await client.fetchEcosystemConfig();
  if (!ecosystemData) {
    console.error("Ecosystem not initialized!");
    return;
  }
  const treasury = ecosystemData.treasury;
  console.log("Treasury:", treasury.toBase58());

  // Step 1: Register content with mint config
  const contentCid = `test-verified-claim-${Date.now()}`;
  const metadataCid = "QmTestMetadata123";
  const previewCid = "QmTestPreview123";

  console.log("\n--- Step 1: Registering content with mint config ---");
  console.log("Content CID:", contentCid);

  const [contentPda] = getContentPda(contentCid);
  const [contentCollectionPda] = getContentCollectionPda(contentPda);

  const { instruction: registerIx, collectionAssetKeypair } = await client.registerContentWithMintInstruction(
    wallet.publicKey,
    contentCid,
    metadataCid,
    ContentType.GeneralImage,
    BigInt(0.05 * 1e9), // 0.05 SOL
    null, // unlimited supply
    500, // 5% royalty
    false,
    previewCid,
    ""
  );

  console.log("Collection Asset Keypair:", collectionAssetKeypair.publicKey.toBase58());

  const registerTx = new Transaction().add(registerIx);
  registerTx.feePayer = wallet.publicKey;
  registerTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  registerTx.partialSign(collectionAssetKeypair);

  try {
    const registerSig = await sendAndConfirmTransaction(connection, registerTx, [wallet, collectionAssetKeypair]);
    console.log("Registered content:", registerSig);
  } catch (err: any) {
    console.error("Registration failed:", err.message);
    if (err.logs) {
      console.error("Logs:", err.logs.slice(-10));
    }
    return;
  }

  // Wait a bit for state to settle
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Debug: Check content PDA and collection PDA
  console.log("Content PDA:", contentPda.toBase58());
  console.log("Content Collection PDA:", contentCollectionPda.toBase58());

  // Verify collection was created
  const contentCollection = await client.fetchContentCollection(contentCid);
  if (!contentCollection) {
    console.error("ContentCollection not found! Checking account info...");
    const accountInfo = await connection.getAccountInfo(contentCollectionPda);
    console.log("Account exists:", !!accountInfo);
    if (accountInfo) {
      console.log("Account owner:", accountInfo.owner.toBase58());
      console.log("Account data length:", accountInfo.data.length);
    }
    return;
  }
  console.log("ContentCollection created:");
  console.log("  - Content:", contentCollection.content.toBase58());
  console.log("  - Collection Asset:", contentCollection.collectionAsset.toBase58());

  // Step 2: Mint NFT
  console.log("\n--- Step 2: Minting NFT ---");

  const { instruction: mintIx, nftAssetKeypair } = await client.mintNftSolInstruction(
    wallet.publicKey,
    contentCid,
    wallet.publicKey, // creator
    treasury,
    treasury, // platform = treasury for test
    contentCollection.collectionAsset
  );

  console.log("NFT Asset Keypair:", nftAssetKeypair.publicKey.toBase58());

  const mintTx = new Transaction().add(mintIx);
  mintTx.feePayer = wallet.publicKey;
  mintTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  mintTx.partialSign(nftAssetKeypair);

  try {
    const mintSig = await sendAndConfirmTransaction(connection, mintTx, [wallet, nftAssetKeypair]);
    console.log("Minted NFT:", mintSig);
  } catch (err: any) {
    console.error("Minting failed:", err.message);
    if (err.logs) {
      console.error("Logs:", err.logs.slice(-10));
    }
    return;
  }

  // Wait a bit for state to settle
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Check wallet state after mint
  const walletStateAfterMint = await client.fetchWalletContentState(wallet.publicKey, contentCid);
  console.log("Wallet state after mint:", {
    nftCount: walletStateAfterMint?.nftCount.toString(),
    rewardDebt: walletStateAfterMint?.rewardDebt.toString(),
  });

  // Step 3: Mint another NFT (to generate rewards in the pool)
  console.log("\n--- Step 3: Minting second NFT (to generate holder rewards) ---");

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

  try {
    const mint2Sig = await sendAndConfirmTransaction(connection, mint2Tx, [wallet, nft2Keypair]);
    console.log("Minted second NFT:", mint2Sig);
  } catch (err: any) {
    console.error("Second mint failed:", err.message);
    if (err.logs) {
      console.error("Logs:", err.logs.slice(-10));
    }
    return;
  }

  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Check reward pool
  const rewardPool = await client.fetchContentRewardPool(contentCid);
  console.log("Reward pool:", {
    totalNfts: rewardPool?.totalNfts.toString(),
    totalDeposited: rewardPool?.totalDeposited.toString(),
    rewardPerShare: rewardPool?.rewardPerShare.toString(),
  });

  // Step 4: Claim rewards using verified claim
  console.log("\n--- Step 4: Claiming rewards with verification ---");

  // Fetch NFT assets for the collection
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
    console.log("Claimed rewards:", claimSig);
  } catch (err: any) {
    console.error("Claim failed:", err.message);
    if (err.logs) {
      console.error("Logs:", err.logs.slice(-10));
    }
    return;
  }

  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Check wallet state after claim
  const walletStateAfterClaim = await client.fetchWalletContentState(wallet.publicKey, contentCid);
  console.log("Wallet state after claim:", {
    nftCount: walletStateAfterClaim?.nftCount.toString(),
    rewardDebt: walletStateAfterClaim?.rewardDebt.toString(),
  });

  // Check reward pool after claim
  const rewardPoolAfterClaim = await client.fetchContentRewardPool(contentCid);
  console.log("Reward pool after claim:", {
    totalClaimed: rewardPoolAfterClaim?.totalClaimed.toString(),
  });

  console.log("\n--- Test Complete ---");
  console.log("Verified claim worked! NFT ownership was verified on-chain at claim time.");
}

main().catch(console.error);
