/**
 * Initialize the ecosystem config and subscription pools on devnet
 * Run with: npx tsx scripts/init-ecosystem.ts
 */

import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";
import {
  PROGRAM_ID,
  getEcosystemConfigPda,
  getGlobalHolderPoolPda,
  getCreatorDistPoolPda,
  getEcosystemEpochStatePda,
  getEcosystemSubConfigPda,
} from "@handcraft/sdk";

// USDC devnet mint (from Circle)
const USDC_DEVNET_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

// Default ecosystem subscription price: 0.1 SOL per month
const DEFAULT_ECOSYSTEM_SUB_PRICE = 100_000_000; // 0.1 SOL in lamports

async function main() {
  // Load keypair from default Solana config
  const keypairPath = path.join(process.env.HOME!, ".config/solana/id.json");
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const keypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));

  console.log("Using wallet:", keypair.publicKey.toBase58());

  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  // Check balance
  const balance = await connection.getBalance(keypair.publicKey);
  console.log("Balance:", balance / 1e9, "SOL");

  if (balance < 0.01 * 1e9) {
    console.log("Insufficient balance. Requesting airdrop...");
    const sig = await connection.requestAirdrop(keypair.publicKey, 1e9);
    await connection.confirmTransaction(sig);
    console.log("Airdrop confirmed!");
  }

  // Load IDL
  const idlPath = path.join(__dirname, "../packages/sdk/src/program/content_registry.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

  // Create provider and program
  const wallet = new Wallet(keypair);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  const program = new Program(idl, provider);

  // =========================================================================
  // STEP 1: Initialize Ecosystem Config
  // =========================================================================

  const [ecosystemConfigPda] = getEcosystemConfigPda();
  console.log("\n--- Ecosystem Config ---");
  console.log("PDA:", ecosystemConfigPda.toBase58());

  const existingEcosystem = await connection.getAccountInfo(ecosystemConfigPda);
  if (existingEcosystem) {
    console.log("✓ Ecosystem config already initialized");
  } else {
    console.log("Initializing ecosystem config...");
    console.log("  Admin:", keypair.publicKey.toBase58());
    console.log("  Treasury:", keypair.publicKey.toBase58());
    console.log("  USDC Mint:", USDC_DEVNET_MINT.toBase58());

    try {
      const tx = await program.methods
        .initializeEcosystem(USDC_DEVNET_MINT)
        .accounts({
          ecosystemConfig: ecosystemConfigPda,
          treasury: keypair.publicKey,
          admin: keypair.publicKey,
          systemProgram: PublicKey.default,
        })
        .signers([keypair])
        .rpc();

      console.log("✓ Ecosystem config initialized. Tx:", tx);
    } catch (error) {
      console.error("Error initializing ecosystem config:", error);
      return;
    }
  }

  // =========================================================================
  // STEP 2: Initialize Subscription Pools (Phase 1)
  // =========================================================================

  const [globalHolderPoolPda] = getGlobalHolderPoolPda();
  const [creatorDistPoolPda] = getCreatorDistPoolPda();
  const [ecosystemEpochStatePda] = getEcosystemEpochStatePda();

  console.log("\n--- Subscription Pools ---");
  console.log("GlobalHolderPool PDA:", globalHolderPoolPda.toBase58());
  console.log("CreatorDistPool PDA:", creatorDistPoolPda.toBase58());
  console.log("EcosystemEpochState PDA:", ecosystemEpochStatePda.toBase58());

  const existingHolderPool = await connection.getAccountInfo(globalHolderPoolPda);
  if (existingHolderPool) {
    console.log("✓ Subscription pools already initialized");
  } else {
    console.log("Initializing subscription pools...");

    try {
      const tx = await program.methods
        .initializeEcosystemPools()
        .accounts({
          globalHolderPool: globalHolderPoolPda,
          creatorDistPool: creatorDistPoolPda,
          ecosystemEpochState: ecosystemEpochStatePda,
          ecosystemConfig: ecosystemConfigPda,
          admin: keypair.publicKey,
          systemProgram: PublicKey.default,
        })
        .signers([keypair])
        .rpc();

      console.log("✓ Subscription pools initialized. Tx:", tx);
    } catch (error) {
      console.error("Error initializing subscription pools:", error);
      // Don't return - try to continue with sub config
    }
  }

  // =========================================================================
  // STEP 3: Initialize Ecosystem Subscription Config
  // =========================================================================

  const [ecosystemSubConfigPda] = getEcosystemSubConfigPda();
  console.log("\n--- Ecosystem Subscription Config ---");
  console.log("EcosystemSubConfig PDA:", ecosystemSubConfigPda.toBase58());

  const existingSubConfig = await connection.getAccountInfo(ecosystemSubConfigPda);
  if (existingSubConfig) {
    console.log("✓ Ecosystem subscription config already initialized");
  } else {
    console.log("Initializing ecosystem subscription config...");
    console.log("  Price:", DEFAULT_ECOSYSTEM_SUB_PRICE / 1e9, "SOL/month");

    try {
      const tx = await program.methods
        .initializeEcosystemSubConfig(new (require("@coral-xyz/anchor").BN)(DEFAULT_ECOSYSTEM_SUB_PRICE))
        .accounts({
          ecosystemSubConfig: ecosystemSubConfigPda,
          ecosystemConfig: ecosystemConfigPda,
          admin: keypair.publicKey,
          systemProgram: PublicKey.default,
        })
        .signers([keypair])
        .rpc();

      console.log("✓ Ecosystem subscription config initialized. Tx:", tx);
    } catch (error) {
      console.error("Error initializing ecosystem subscription config:", error);
    }
  }

  // =========================================================================
  // Summary
  // =========================================================================

  console.log("\n========================================");
  console.log("           INITIALIZATION COMPLETE");
  console.log("========================================");
  console.log("");
  console.log("Ecosystem Config:", ecosystemConfigPda.toBase58());
  console.log("GlobalHolderPool:", globalHolderPoolPda.toBase58());
  console.log("CreatorDistPool:", creatorDistPoolPda.toBase58());
  console.log("EcosystemEpochState:", ecosystemEpochStatePda.toBase58());
  console.log("EcosystemSubConfig:", ecosystemSubConfigPda.toBase58());
  console.log("");
  console.log("Note: CreatorPatronPool and CreatorWeight are");
  console.log("      initialized lazily on first mint per creator.");
}

main().catch(console.error);
