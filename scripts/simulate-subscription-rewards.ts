/**
 * Simulate subscription rewards by depositing SOL directly into the pools
 * This is for testing purposes to see rewards without actual streaming
 */

import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import {
  getGlobalHolderPoolPda,
  getCreatorDistPoolPda,
  getCreatorPatronPoolPda,
  getEcosystemStreamingTreasuryPda,
  getCreatorPatronTreasuryPda,
  createContentRegistryClient,
} from "@handcraft/sdk";
import * as fs from "fs";
import * as path from "path";

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

// Amount to deposit (in SOL)
const ECOSYSTEM_DEPOSIT_SOL = 0.1; // Will be split: 12% holder, 80% creator
const MEMBERSHIP_DEPOSIT_SOL = 0.05; // Goes to creator patron pool

// Creator to test membership rewards with (your wallet or a test creator)
const TEST_CREATOR = new PublicKey("3iwhqrFx6PzMStAbuU6cceGsKJa38UTa1m4hNUECe2Hh");

async function main() {
  const connection = new Connection(RPC_URL, "confirmed");

  // Load wallet keypair
  const keypairPath = path.join(process.env.HOME!, ".config/solana/id.json");
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const payer = Keypair.fromSecretKey(new Uint8Array(keypairData));

  console.log("=== Simulate Subscription Rewards ===\n");
  console.log("Payer:", payer.publicKey.toBase58());

  const balance = await connection.getBalance(payer.publicKey);
  console.log("Balance:", balance / LAMPORTS_PER_SOL, "SOL\n");

  // Get PDAs
  const [globalHolderPoolPda] = getGlobalHolderPoolPda();
  const [creatorDistPoolPda] = getCreatorDistPoolPda();
  const [ecosystemTreasuryPda] = getEcosystemStreamingTreasuryPda();
  const [creatorPatronPoolPda] = getCreatorPatronPoolPda(TEST_CREATOR);
  const [creatorPatronTreasuryPda] = getCreatorPatronTreasuryPda(TEST_CREATOR);

  console.log("Pool PDAs:");
  console.log("  GlobalHolderPool:", globalHolderPoolPda.toBase58());
  console.log("  CreatorDistPool:", creatorDistPoolPda.toBase58());
  console.log("  EcosystemTreasury:", ecosystemTreasuryPda.toBase58());
  console.log("  CreatorPatronPool:", creatorPatronPoolPda.toBase58());
  console.log("  CreatorPatronTreasury:", creatorPatronTreasuryPda.toBase58());
  console.log("");

  // Check current pool states
  const client = createContentRegistryClient(connection);

  console.log("--- Current Pool States ---");
  const holderPool = await client.fetchGlobalHolderPool();
  const distPool = await client.fetchCreatorDistPool();
  const patronPool = await client.fetchCreatorPatronPool(TEST_CREATOR);

  if (holderPool) {
    console.log("GlobalHolderPool:");
    console.log("  Total Weight:", holderPool.totalWeight?.toString());
    console.log("  RPS:", holderPool.rewardPerShare?.toString());
    console.log("  Total Deposited:", Number(holderPool.totalDeposited || 0) / LAMPORTS_PER_SOL, "SOL");
  } else {
    console.log("GlobalHolderPool: Not initialized");
  }

  if (distPool) {
    console.log("CreatorDistPool:");
    console.log("  Total Weight:", distPool.totalWeight?.toString());
    console.log("  RPS:", distPool.rewardPerShare?.toString());
    console.log("  Total Deposited:", Number(distPool.totalDeposited || 0) / LAMPORTS_PER_SOL, "SOL");
  } else {
    console.log("CreatorDistPool: Not initialized");
  }

  if (patronPool) {
    console.log("CreatorPatronPool (", TEST_CREATOR.toBase58().slice(0, 8), "...):");
    console.log("  Total Weight:", patronPool.totalWeight?.toString());
    console.log("  RPS:", patronPool.rewardPerShare?.toString());
    console.log("  Total Deposited:", Number(patronPool.totalDeposited || 0) / LAMPORTS_PER_SOL, "SOL");
  } else {
    console.log("CreatorPatronPool: Not initialized");
  }

  console.log("\n--- Depositing to Pools ---");

  // Option 1: Direct deposit to pools (simulates what distribution would do)
  // This bypasses the normal distribution flow but updates RPS correctly

  const holderDepositLamports = Math.floor(ECOSYSTEM_DEPOSIT_SOL * 0.12 * LAMPORTS_PER_SOL);
  const creatorDepositLamports = Math.floor(ECOSYSTEM_DEPOSIT_SOL * 0.80 * LAMPORTS_PER_SOL);
  const patronDepositLamports = Math.floor(MEMBERSHIP_DEPOSIT_SOL * 0.12 * LAMPORTS_PER_SOL);

  console.log("Depositing to GlobalHolderPool:", holderDepositLamports / LAMPORTS_PER_SOL, "SOL");
  console.log("Depositing to CreatorDistPool:", creatorDepositLamports / LAMPORTS_PER_SOL, "SOL");
  console.log("Depositing to CreatorPatronPool:", patronDepositLamports / LAMPORTS_PER_SOL, "SOL");

  // Create transaction to transfer SOL directly to pool accounts
  // Note: This only adds SOL balance, doesn't update RPS.
  // For RPS update, we need to trigger actual distribution via program instruction.

  const tx = new Transaction();

  // Transfer to GlobalHolderPool
  tx.add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: globalHolderPoolPda,
      lamports: holderDepositLamports,
    })
  );

  // Transfer to CreatorDistPool
  tx.add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: creatorDistPoolPda,
      lamports: creatorDepositLamports,
    })
  );

  // Transfer to CreatorPatronPool
  tx.add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: creatorPatronPoolPda,
      lamports: patronDepositLamports,
    })
  );

  console.log("\nSending transaction...");
  const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
  console.log("Transaction confirmed:", sig);

  console.log("\n⚠️  NOTE: This only transferred SOL to pool accounts.");
  console.log("The reward_per_share (RPS) is NOT updated by direct transfers.");
  console.log("RPS is only updated by the program's distribution instructions.");
  console.log("\nTo properly simulate rewards, you need to:");
  console.log("1. Send SOL to EcosystemStreamingTreasury or CreatorPatronTreasury");
  console.log("2. Trigger a mint or claim instruction that calls distribution");
}

main().catch(console.error);
