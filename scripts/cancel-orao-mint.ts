/**
 * Cancel pending ORAO mint request
 */

import {
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";
import { PROGRAM_ID, getContentPda, getMintConfigPda, getContentRewardPoolPda } from "@handcraft/sdk";

const ORAO_MINT_REQUEST_SEED = Buffer.from("orao_mint_request");

async function main() {
  console.log("=== Cancel ORAO Mint Request ===\n");

  // Load wallet
  const keypairPath = path.join(process.env.HOME!, ".config/solana/id.json");
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(new Uint8Array(keypairData));
  console.log("Wallet:", wallet.publicKey.toBase58());

  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  // Load IDL and create program
  const idlPath = path.join(__dirname, "../packages/sdk/src/program/content_registry.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const provider = new AnchorProvider(connection, new Wallet(wallet), { commitment: "confirmed" });
  const program = new Program(idl, provider);

  // Use the test content CID
  const testContentCid = "QmTestContent1765138919065";
  const [contentPda] = getContentPda(testContentCid);
  console.log("Content PDA:", contentPda.toBase58());

  const [mintRequestPda] = PublicKey.findProgramAddressSync(
    [ORAO_MINT_REQUEST_SEED, wallet.publicKey.toBuffer(), contentPda.toBuffer()],
    PROGRAM_ID
  );
  console.log("Mint Request PDA:", mintRequestPda.toBase58());

  // Check if exists
  const existingRequest = await connection.getAccountInfo(mintRequestPda);
  if (!existingRequest) {
    console.log("\nNo pending mint request found.");
    return;
  }

  console.log("\nPending mint request found. Cancelling...");

  const [mintConfigPda] = getMintConfigPda(contentPda);
  const [contentRewardPoolPda] = getContentRewardPoolPda(contentPda);

  try {
    const tx = await (program.methods as any)
      .oraoCancelMint()
      .accounts({
        content: contentPda,
        mintConfig: mintConfigPda,
        mintRequest: mintRequestPda,
        contentRewardPool: contentRewardPoolPda,
        buyer: wallet.publicKey,
      })
      .signers([wallet])
      .rpc();

    console.log("✅ Cancelled! TX:", tx);
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    if (error.logs) {
      console.error("\nLogs:");
      error.logs.forEach((log: string) => console.error("  ", log));
    }
  }
}

main().catch(console.error);
