import { Connection, PublicKey, Keypair, Transaction } from "@solana/web3.js";
import { createProgram, getContentPda, getSrsMintRequestPda } from "../packages/sdk/src/program";
import * as fs from "fs";
import * as path from "path";

const WALLET_PATH = process.argv[2];
const CONTENT_CID = process.argv[3];

if (!WALLET_PATH || !CONTENT_CID) {
  console.log("Usage: pnpm tsx scripts/cancel-srs-mint.ts <wallet_keypair_path> <content_cid>");
  console.log("Example: pnpm tsx scripts/cancel-srs-mint.ts ~/.config/solana/id.json QmNRhV3u...");
  process.exit(1);
}

async function main() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  // Load wallet keypair
  const resolvedPath = WALLET_PATH.replace("~", process.env.HOME || "");
  const keypairData = JSON.parse(fs.readFileSync(path.resolve(resolvedPath), "utf-8"));
  const wallet = Keypair.fromSecretKey(new Uint8Array(keypairData));

  console.log("=== Cancel SRS Mint Request ===\n");
  console.log("Wallet:", wallet.publicKey.toBase58());
  console.log("Content CID:", CONTENT_CID);

  const program = createProgram(connection);
  const [contentPda] = getContentPda(CONTENT_CID);
  const [mintRequestPda] = getSrsMintRequestPda(wallet.publicKey, contentPda);

  console.log("\nMint Request PDA:", mintRequestPda.toBase58());

  // Check if request exists
  const requestInfo = await connection.getAccountInfo(mintRequestPda);
  if (!requestInfo) {
    console.log("\n✓ No pending mint request to cancel");
    return;
  }

  // Fetch request data to check age
  const request = await (program.account as any).srsMintRequest.fetch(mintRequestPda);
  const createdAt = new Date(Number(request.createdAt) * 1000);
  const now = new Date();
  const ageMinutes = (now.getTime() - createdAt.getTime()) / 60000;

  console.log("\nRequest created at:", createdAt.toISOString());
  console.log("Age:", ageMinutes.toFixed(1), "minutes");
  console.log("Amount escrowed:", Number(request.amountPaid) / 1e9, "SOL");
  console.log("Is Fulfilled:", request.isFulfilled);

  if (ageMinutes < 10) {
    console.log("\n❌ Cannot cancel yet - must wait at least 10 minutes");
    console.log("Try again in", (10 - ageMinutes).toFixed(1), "minutes");
    return;
  }

  console.log("\n=== Cancelling Request ===");

  const instruction = await program.methods
    .srsCancelMint()
    .accounts({
      content: contentPda,
      mintRequest: mintRequestPda,
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
  console.log("\n✓ Mint request cancelled! Escrowed SOL refunded to wallet.");

  // Verify
  const postBalance = await connection.getBalance(wallet.publicKey);
  console.log("Wallet balance:", postBalance / 1e9, "SOL");
}

main().catch(console.error);
