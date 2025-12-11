/**
 * MagicBlock Claim Fallback - Mint NFT with Common rarity
 *
 * When the MagicBlock VRF oracle doesn't respond within 60 seconds,
 * users can call this to claim their NFT with Common rarity.
 *
 * Run with: npx tsx scripts/magicblock-claim-fallback.ts
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";
import {
  PROGRAM_ID,
  getContentPda,
  getContentCollectionPda,
  getNftRewardStatePda,
  getNftRarityPda,
  getEcosystemConfigPda,
  getContentRewardPoolPda,
} from "@handcraft/sdk";

const MPL_CORE_ID = new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");

// Seeds for MagicBlock mint (from magicblock_mint.rs)
const MB_MINT_REQUEST_SEED = Buffer.from("mb_mint_request");
const MB_NFT_SEED = Buffer.from("mb_nft");

// Fallback timeout in seconds
const FALLBACK_TIMEOUT = 60;

async function main() {
  console.log("=== MagicBlock Claim Fallback ===\n");

  // Load wallet
  const keypairPath = path.join(process.env.HOME!, ".config/solana/id.json");
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(new Uint8Array(keypairData));
  console.log("Wallet:", wallet.publicKey.toBase58());

  // Use standard devnet RPC
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  // Check balance
  const balance = await connection.getBalance(wallet.publicKey);
  console.log("Balance:", balance / LAMPORTS_PER_SOL, "SOL\n");

  // Load IDL and create program
  const idlPath = path.join(__dirname, "../packages/sdk/src/program/content_registry.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const provider = new AnchorProvider(connection, new Wallet(wallet), { commitment: "confirmed" });
  const program = new Program(idl, provider);

  // Use the content CID from the recently registered content
  const testContentCid = "QmHybridCallbackTest001";

  // Derive content PDA
  const [contentPda] = getContentPda(testContentCid);
  console.log("Content PDA:", contentPda.toBase58());

  // Check if content exists
  let contentData: any;
  try {
    contentData = await (program.account as any).contentEntry.fetch(contentPda);
    console.log("Content found! Creator:", contentData.creator.toBase58());
  } catch (error: any) {
    console.error("Content not found.");
    return;
  }

  // Derive mint request PDA
  const [mintRequestPda] = PublicKey.findProgramAddressSync(
    [MB_MINT_REQUEST_SEED, wallet.publicKey.toBuffer(), contentPda.toBuffer()],
    PROGRAM_ID
  );

  console.log("\n=== Checking Mint Request ===");
  console.log("Mint Request PDA:", mintRequestPda.toBase58());

  // Check if mint request exists
  const mintRequestAccount = await connection.getAccountInfo(mintRequestPda);
  if (!mintRequestAccount) {
    console.log("\nNo pending mint request found.");
    console.log("First run: npx tsx scripts/test-magicblock-mint.ts");
    return;
  }

  // Decode mint request
  let mintRequestData: any;
  try {
    mintRequestData = await (program.account as any).magicBlockMintRequest.fetch(mintRequestPda);
  } catch (error: any) {
    console.error("Failed to decode mint request:", error.message);
    return;
  }

  console.log("\n=== Mint Request Details ===");
  console.log("  Buyer:", mintRequestData.buyer.toBase58());
  console.log("  Content:", mintRequestData.content.toBase58());
  console.log("  Creator:", mintRequestData.creator.toBase58());
  console.log("  Amount Paid:", mintRequestData.amountPaid.toString(), "lamports");
  console.log("  Created At:", new Date(mintRequestData.createdAt.toNumber() * 1000).toISOString());
  console.log("  Is Fulfilled:", mintRequestData.isFulfilled);

  if (mintRequestData.isFulfilled) {
    console.log("\nMint request already fulfilled!");
    return;
  }

  // Check timeout
  const now = Math.floor(Date.now() / 1000);
  const elapsed = now - mintRequestData.createdAt.toNumber();
  const remaining = FALLBACK_TIMEOUT - elapsed;

  console.log("\n=== Timeout Status ===");
  console.log("  Elapsed:", elapsed, "seconds");
  console.log("  Required:", FALLBACK_TIMEOUT, "seconds");

  if (remaining > 0) {
    console.log(`\n  Wait ${remaining} more seconds for fallback to be available.`);
    console.log("  (Or wait for MagicBlock VRF oracle to respond)");
    return;
  }

  console.log("  Timeout passed! Fallback available.");

  // Derive all required PDAs
  const [nftAssetPda] = PublicKey.findProgramAddressSync(
    [MB_NFT_SEED, mintRequestPda.toBuffer()],
    PROGRAM_ID
  );

  const [contentCollectionPda] = getContentCollectionPda(contentPda);
  const [nftRewardStatePda] = getNftRewardStatePda(nftAssetPda);
  const [nftRarityPda] = getNftRarityPda(nftAssetPda);
  const [contentRewardPoolPda] = getContentRewardPoolPda(contentPda);

  // Get collection asset
  let contentCollectionData: any;
  try {
    contentCollectionData = await (program.account as any).contentCollection.fetch(contentCollectionPda);
  } catch (error: any) {
    console.error("Content collection not found.");
    return;
  }
  const collectionAsset = contentCollectionData.collectionAsset;

  // Get ecosystem config for treasury
  const [ecosystemConfigPda] = getEcosystemConfigPda();
  let ecosystemConfigData: any;
  try {
    ecosystemConfigData = await (program.account as any).ecosystemConfig.fetch(ecosystemConfigPda);
  } catch (error: any) {
    console.error("Ecosystem config not found.");
    return;
  }
  const treasury = ecosystemConfigData.treasury;

  // Get platform from mint request (fallback to treasury if not set)
  const platform = mintRequestData.platform;

  console.log("\n=== Claiming with Fallback (Common rarity) ===");
  console.log("NFT Asset:", nftAssetPda.toBase58());
  console.log("Collection:", collectionAsset.toBase58());
  console.log("Creator:", mintRequestData.creator.toBase58());
  console.log("Treasury:", treasury.toBase58());
  console.log("Platform:", platform.toBase58());
  console.log("Content Reward Pool:", contentRewardPoolPda.toBase58());

  try {
    const tx = await (program.methods as any)
      .magicblockClaimFallback()
      .accounts({
        mintRequest: mintRequestPda,
        content: contentPda,
        contentCollection: contentCollectionPda,
        collectionAsset: collectionAsset,
        nftAsset: nftAssetPda,
        nftRarity: nftRarityPda,
        nftRewardState: nftRewardStatePda,
        buyer: wallet.publicKey,
        creator: mintRequestData.creator,
        treasury: treasury,
        platform: platform,
        contentRewardPool: contentRewardPoolPda,
        mplCoreProgram: MPL_CORE_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([wallet])
      .rpc();

    console.log("\n=== Success! ===");
    console.log("TX:", tx);
    console.log("NFT Asset:", nftAssetPda.toBase58());

    // Fetch rarity to confirm
    try {
      const rarityData = await (program.account as any).nftRarity.fetch(nftRarityPda);
      console.log("\nNFT Rarity:", JSON.stringify(rarityData.rarity));
      console.log("Weight:", rarityData.weight.toString());
    } catch (e) {
      console.log("Could not fetch rarity data");
    }

    console.log("\nNFT minted with Common rarity (fallback)!");

  } catch (error: any) {
    console.error("\nError:", error.message);
    if (error.logs) {
      console.error("\nLogs:");
      error.logs.forEach((log: string) => console.error("  ", log));
    }
  }
}

main().catch(console.error);
