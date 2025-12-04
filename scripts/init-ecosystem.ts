/**
 * Initialize the ecosystem config on devnet
 * Run with: npx tsx scripts/init-ecosystem.ts
 */

import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";

const PROGRAM_ID = new PublicKey("EvnyqtTHHeNYoeauSgXMAUSu4EFeEsbxUxVzhC2NaDHU");
const ECOSYSTEM_CONFIG_SEED = "ecosystem";
const GLOBAL_REWARD_POOL_SEED = "global_reward_pool";

// USDC devnet mint (from Circle)
const USDC_DEVNET_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

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

  // Get ecosystem config PDA
  const [ecosystemConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(ECOSYSTEM_CONFIG_SEED)],
    PROGRAM_ID
  );

  // Get global reward pool PDA
  const [globalRewardPoolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(GLOBAL_REWARD_POOL_SEED)],
    PROGRAM_ID
  );

  console.log("Ecosystem Config PDA:", ecosystemConfigPda.toBase58());
  console.log("Global Reward Pool PDA:", globalRewardPoolPda.toBase58());

  // Check if already initialized
  const existingAccount = await connection.getAccountInfo(ecosystemConfigPda);
  if (existingAccount) {
    console.log("Ecosystem config already initialized!");
    return;
  }

  console.log("Initializing ecosystem config and global reward pool...");
  console.log("  Admin:", keypair.publicKey.toBase58());
  console.log("  Treasury:", keypair.publicKey.toBase58());
  console.log("  USDC Mint:", USDC_DEVNET_MINT.toBase58());

  try {
    const tx = await program.methods
      .initializeEcosystem(USDC_DEVNET_MINT)
      .accounts({
        ecosystemConfig: ecosystemConfigPda,
        globalRewardPool: globalRewardPoolPda,
        admin: keypair.publicKey,
        treasury: keypair.publicKey, // Using admin as treasury for now
        systemProgram: PublicKey.default,
      })
      .signers([keypair])
      .rpc();

    console.log("Transaction signature:", tx);
    console.log("Ecosystem and global reward pool initialized successfully!");

    // Verify
    const account = await connection.getAccountInfo(ecosystemConfigPda);
    console.log("Ecosystem config data length:", account?.data.length);

    const poolAccount = await connection.getAccountInfo(globalRewardPoolPda);
    console.log("Global reward pool data length:", poolAccount?.data.length);
  } catch (error) {
    console.error("Error:", error);
  }
}

main().catch(console.error);
