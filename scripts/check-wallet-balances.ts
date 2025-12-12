/**
 * Check balances of all test wallets
 * Run with: npx tsx scripts/check-wallet-balances.ts
 */

import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

const RPC_URL = "https://api.devnet.solana.com";
const WALLETS_DIR = path.join(__dirname, "test-wallets");

async function main() {
  const connection = new Connection(RPC_URL, "confirmed");

  console.log("=== Test Wallet Balances ===\n");

  // Check main wallet
  const mainWalletPath = path.join(process.env.HOME!, ".config/solana/id.json");
  if (fs.existsSync(mainWalletPath)) {
    const mainKey = JSON.parse(fs.readFileSync(mainWalletPath, "utf-8"));
    const mainWallet = Keypair.fromSecretKey(new Uint8Array(mainKey));
    const mainBalance = await connection.getBalance(mainWallet.publicKey);
    console.log(`main (default) : ${mainWallet.publicKey.toBase58().slice(0, 20)}... = ${(mainBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  }

  console.log("");

  // Check test wallets
  const roles = ["creator1", "creator2", "subscriber1", "subscriber2", "subscriber3", "minter1", "minter2", "claimer1"];

  let totalBalance = 0;
  for (const role of roles) {
    const walletPath = path.join(WALLETS_DIR, `${role}.json`);
    if (fs.existsSync(walletPath)) {
      const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
      const wallet = Keypair.fromSecretKey(new Uint8Array(secretKey));
      const balance = await connection.getBalance(wallet.publicKey);
      totalBalance += balance;
      const balanceStr = (balance / LAMPORTS_PER_SOL).toFixed(4);
      const status = balance > 0.1 * LAMPORTS_PER_SOL ? "✓" : "○";
      console.log(`${status} ${role.padEnd(12)} : ${wallet.publicKey.toBase58().slice(0, 20)}... = ${balanceStr} SOL`);
    }
  }

  console.log(`\nTotal test wallet balance: ${(totalBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log("\n✓ = funded (>0.1 SOL)  ○ = needs funding");
}

main().catch(console.error);
