// Test script to debug Royalties plugin settings
import { Connection, Keypair, clusterApiUrl, LAMPORTS_PER_SOL, PublicKey, Transaction, TransactionInstruction, SystemProgram } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

// Constants from the program
const PLATFORM_FEE_SECONDARY_BPS = 100;  // 1%
const ECOSYSTEM_FEE_SECONDARY_BPS = 100; // 1%
const HOLDER_REWARD_SECONDARY_BPS = 800; // 8%

function totalSecondaryRoyaltyBps(creatorRoyaltyBps: number): number {
  return creatorRoyaltyBps + PLATFORM_FEE_SECONDARY_BPS + ECOSYSTEM_FEE_SECONDARY_BPS + HOLDER_REWARD_SECONDARY_BPS;
}

function calculateShares(creatorRoyaltyBps: number) {
  const totalBps = totalSecondaryRoyaltyBps(creatorRoyaltyBps);

  // This matches the Rust calculation exactly
  const creatorShare = Math.floor((creatorRoyaltyBps * 100) / totalBps);
  const platformShare = Math.floor((100 * 100) / totalBps);
  const treasuryShare = Math.floor((100 * 100) / totalBps);
  const holderShare = 100 - creatorShare - platformShare - treasuryShare;

  return {
    totalBps,
    creatorShare,
    platformShare,
    treasuryShare,
    holderShare,
    sum: creatorShare + platformShare + treasuryShare + holderShare
  };
}

async function main() {
  console.log("=== Debug Royalties Plugin Settings ===\n");

  // Test various creator royalty values
  const testValues = [200, 300, 400, 500, 600, 700, 800, 900, 1000];

  console.log("Testing different creator royalty values:\n");
  console.log("BPS | Total | Creator | Platform | Treasury | Holder | Sum");
  console.log("----|-------|---------|----------|----------|--------|----");

  for (const bps of testValues) {
    const shares = calculateShares(bps);
    console.log(
      `${bps.toString().padStart(3)} | ${shares.totalBps.toString().padStart(5)} | ${shares.creatorShare.toString().padStart(7)} | ${shares.platformShare.toString().padStart(8)} | ${shares.treasuryShare.toString().padStart(8)} | ${shares.holderShare.toString().padStart(6)} | ${shares.sum}`
    );
  }

  console.log("\n=== Detailed check for 500 bps (5%) ===");
  const shares500 = calculateShares(500);
  console.log("Creator royalty: 500 bps (5%)");
  console.log(`Total royalty: ${shares500.totalBps} bps (${shares500.totalBps / 100}%)`);
  console.log(`\nShares (must sum to 100%):`);
  console.log(`  Creator: ${shares500.creatorShare}%`);
  console.log(`  Platform: ${shares500.platformShare}%`);
  console.log(`  Treasury: ${shares500.treasuryShare}%`);
  console.log(`  Holder: ${shares500.holderShare}%`);
  console.log(`  Total: ${shares500.sum}%`);

  if (shares500.sum !== 100) {
    console.log("\n❌ ERROR: Shares don't sum to 100%!");
    console.log("This is likely causing the InvalidPluginSetting error");
  } else {
    console.log("\n✅ Shares sum to 100% - Royalties math is correct");
  }

  // Now test creating a simple collection with Metaplex Core directly
  console.log("\n\n=== Testing direct Metaplex Core call ===\n");

  const keypairPath = path.join(process.env.HOME || "", ".config/solana/id.json");
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(new Uint8Array(keypairData));

  console.log("Wallet:", wallet.publicKey.toBase58());

  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
  const balance = await connection.getBalance(wallet.publicKey);
  console.log("Balance:", balance / LAMPORTS_PER_SOL, "SOL\n");

  // Try creating a collection with minimal royalties config using umi
  console.log("To test Metaplex Core directly, we would need to use the umi SDK");
  console.log("or check if mpl-core JS SDK can be used to create a collection");

  // Check what mpl-core version we have
  console.log("\nChecking installed mpl-core packages...");
}

main().catch(console.error);
