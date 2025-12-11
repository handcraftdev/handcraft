import { Connection, PublicKey, Keypair, Transaction } from "@solana/web3.js";
import { createProgram, getContentPda, getSrsMintRequestPda, getSrsNftAssetPda, getNftRewardStatePda, getNftRarityPda } from "../packages/sdk/src/program";
import * as fs from "fs";
import * as path from "path";

const WALLET_PATH = process.argv[2];
const CONTENT_CID = process.argv[3];

if (!WALLET_PATH || !CONTENT_CID) {
  console.log("Usage: pnpm tsx scripts/cleanup-orphaned-srs.ts <wallet_keypair_path> <content_cid>");
  console.log("Example: pnpm tsx scripts/cleanup-orphaned-srs.ts ~/.config/solana/id.json QmNRhV3u...");
  process.exit(1);
}

async function main() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  // Load wallet keypair
  const keypairData = JSON.parse(fs.readFileSync(path.resolve(WALLET_PATH), "utf-8"));
  const wallet = Keypair.fromSecretKey(new Uint8Array(keypairData));

  console.log("=== Cleanup Orphaned SRS Accounts ===\n");
  console.log("Wallet:", wallet.publicKey.toBase58());
  console.log("Content CID:", CONTENT_CID);

  const [contentPda] = getContentPda(CONTENT_CID);
  const [mintRequestPda] = getSrsMintRequestPda(wallet.publicKey, contentPda);
  const [nftAssetPda] = getSrsNftAssetPda(mintRequestPda);
  const [nftRewardStatePda] = getNftRewardStatePda(nftAssetPda);
  const [nftRarityPda] = getNftRarityPda(nftAssetPda);

  console.log("\nMint Request PDA:", mintRequestPda.toBase58());
  console.log("NFT Asset PDA:", nftAssetPda.toBase58());
  console.log("NFT Reward State PDA:", nftRewardStatePda.toBase58());
  console.log("NFT Rarity PDA:", nftRarityPda.toBase58());

  // Check accounts
  const mintRequestInfo = await connection.getAccountInfo(mintRequestPda);
  const nftRewardStateInfo = await connection.getAccountInfo(nftRewardStatePda);
  const nftRarityInfo = await connection.getAccountInfo(nftRarityPda);

  console.log("\n=== Account Status ===");
  console.log("Mint Request:", mintRequestInfo ? "EXISTS (can't cleanup)" : "does not exist (can cleanup)");
  console.log("NFT Reward State:", nftRewardStateInfo ? `EXISTS (${nftRewardStateInfo.lamports / 1e9} SOL)` : "does not exist");
  console.log("NFT Rarity:", nftRarityInfo ? `EXISTS (${nftRarityInfo.lamports / 1e9} SOL)` : "does not exist");

  if (mintRequestInfo) {
    console.log("\n❌ Cannot cleanup - mint request still exists. Use cancel first.");
    return;
  }

  if (!nftRewardStateInfo && !nftRarityInfo) {
    console.log("\n✓ No orphaned accounts to clean up!");
    return;
  }

  console.log("\n=== Building Cleanup Transaction ===");

  const program = createProgram(connection);

  const instruction = await program.methods
    .srsCleanupOrphaned()
    .accounts({
      content: contentPda,
      mintRequestPda: mintRequestPda,
      nftAsset: nftAssetPda,
      nftRewardState: nftRewardStatePda,
      nftRarity: nftRarityPda,
      buyer: wallet.publicKey,
      systemProgram: new PublicKey("11111111111111111111111111111111"),
    })
    .instruction();

  const tx = new Transaction().add(instruction);
  tx.feePayer = wallet.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  console.log("Sending transaction...");
  const sig = await connection.sendTransaction(tx, [wallet]);
  console.log("Signature:", sig);

  await connection.confirmTransaction(sig, "confirmed");
  console.log("\n✓ Cleanup complete! Orphaned accounts closed and lamports refunded.");

  // Verify
  const postBalance = await connection.getBalance(wallet.publicKey);
  console.log("Wallet balance:", postBalance / 1e9, "SOL");
}

main().catch(console.error);
