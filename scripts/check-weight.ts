import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { PROGRAM_ID, getContentRewardPoolPda, getCidRegistryPda, getContentPda } from "@handcraft/sdk";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Keypair } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import idl from "../packages/sdk/src/program/content_registry.json";

async function main() {
  const cid = process.argv[2] || "QmT5FLje3wqXWjbwrGnZHWFqb7Lq1hxKBGz3jEtjWLSQBV";
  console.log("=== Checking Weight After Burn ===\n");
  console.log("CID:", cid);

  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

  // Load wallet for provider
  const keypairPath = path.join(process.env.HOME || "", ".config/solana/id.json");
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(new Uint8Array(keypairData));

  const provider = new AnchorProvider(
    connection,
    new Wallet(wallet),
    { commitment: "confirmed" }
  );
  const program = new Program(idl as any, provider);

  // Get PDAs
  const [cidRegistryPDA] = getCidRegistryPda(cid);
  const [contentPda] = getContentPda(cid);
  const [rewardPoolPDA] = getContentRewardPoolPda(contentPda);

  console.log("\nCID Registry PDA:", cidRegistryPDA.toBase58());
  console.log("Reward Pool PDA:", rewardPoolPDA.toBase58());

  // Fetch CidRegistry
  try {
    const cidRegistry = await program.account.cidRegistry.fetch(cidRegistryPDA);
    console.log("\n--- CID Registry ---");
    console.log("Collection:", (cidRegistry.collection as PublicKey)?.toBase58());
    console.log("Creator:", (cidRegistry.creator as PublicKey)?.toBase58());
  } catch (e: any) {
    console.log("\n❌ CidRegistry not found:", e.message);
  }

  // Fetch ContentRewardPool
  try {
    const pool = await program.account.contentRewardPool.fetch(rewardPoolPDA);
    console.log("\n--- Content Reward Pool ---");
    console.log("Total NFTs:", (pool.totalNfts as any)?.toString());
    console.log("Total Weight:", (pool.totalWeight as any)?.toString());
    console.log("Accumulated Per Share:", (pool.accumulatedPerShare as any)?.toString());
    console.log("Total Pending:", (pool.totalPending as any)?.toString());
    console.log("Distributed:", (pool.distributed as any)?.toString());

    const totalNfts = Number((pool.totalNfts as any) || 0);
    const totalWeight = Number((pool.totalWeight as any) || 0);
    if (totalNfts > 0) {
      console.log("\nAvg weight per NFT:", (totalWeight / totalNfts).toFixed(2));
      console.log("\n⚠️  If NFT was burned, totalWeight and totalNfts should be LOWER");
      console.log("   If they're still the same, it confirms the stale state bug!");
    }
  } catch (e: any) {
    console.log("\n❌ ContentRewardPool not found:", e.message);
  }
}

main().catch(console.error);
