/**
 * Create test wallets for comprehensive subscription testing
 * Run with: npx tsx scripts/create-test-wallets.ts
 */

import { Keypair } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

const WALLETS_DIR = path.join(__dirname, "test-wallets");

// Test roles
const TEST_ROLES = [
  "creator1",      // Primary content creator
  "creator2",      // Secondary creator (for multi-creator tests)
  "subscriber1",   // Patron + ecosystem subscriber
  "subscriber2",   // Another subscriber
  "subscriber3",   // Third subscriber
  "minter1",       // NFT minter (different from creator)
  "minter2",       // Another minter
  "claimer1",      // Reward claimer
];

async function main() {
  console.log("=== Creating Test Wallets ===\n");

  // Ensure directory exists
  if (!fs.existsSync(WALLETS_DIR)) {
    fs.mkdirSync(WALLETS_DIR, { recursive: true });
  }

  const wallets: { role: string; pubkey: string; path: string }[] = [];

  for (const role of TEST_ROLES) {
    const walletPath = path.join(WALLETS_DIR, `${role}.json`);

    let keypair: Keypair;

    // Check if wallet already exists
    if (fs.existsSync(walletPath)) {
      const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
      keypair = Keypair.fromSecretKey(new Uint8Array(secretKey));
      console.log(`[EXISTS] ${role}: ${keypair.publicKey.toBase58()}`);
    } else {
      // Create new wallet
      keypair = Keypair.generate();
      fs.writeFileSync(walletPath, JSON.stringify(Array.from(keypair.secretKey)));
      console.log(`[NEW]    ${role}: ${keypair.publicKey.toBase58()}`);
    }

    wallets.push({
      role,
      pubkey: keypair.publicKey.toBase58(),
      path: walletPath,
    });
  }

  console.log("\n========================================");
  console.log("ADDRESSES FOR MANUAL AIRDROP");
  console.log("========================================\n");
  console.log("Visit https://faucet.solana.com and request SOL for each:\n");

  for (const w of wallets) {
    console.log(`${w.role.padEnd(12)}: ${w.pubkey}`);
  }

  console.log("\n========================================");
  console.log("RECOMMENDED AMOUNTS");
  console.log("========================================\n");
  console.log("creator1     : 2 SOL (content registration, bundles)");
  console.log("creator2     : 1 SOL (secondary creator)");
  console.log("subscriber1  : 1 SOL (patron + ecosystem subs)");
  console.log("subscriber2  : 1 SOL (subscriptions)");
  console.log("subscriber3  : 1 SOL (subscriptions)");
  console.log("minter1      : 2 SOL (minting NFTs)");
  console.log("minter2      : 1 SOL (minting NFTs)");
  console.log("claimer1     : 0.5 SOL (claiming rewards)");

  // Save summary file
  const summaryPath = path.join(WALLETS_DIR, "summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify(wallets, null, 2));
  console.log(`\nSummary saved to: ${summaryPath}`);
}

main().catch(console.error);
