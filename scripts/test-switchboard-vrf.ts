/**
 * Test Switchboard VRF on devnet
 * Run: npx tsx test-switchboard-vrf.ts
 */
import { Connection, Keypair, clusterApiUrl, Transaction, sendAndConfirmTransaction, TransactionInstruction } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

// Retry function for reveal instruction with exponential backoff
async function retryRevealRandomness(
  randomness: any,
  maxRetries: number = 5,
  delayMs: number = 2000
): Promise<TransactionInstruction> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempting to reveal randomness (attempt ${attempt}/${maxRetries})...`);
      const revealIx = await randomness.revealIx();
      console.log("Successfully obtained reveal instruction");
      return revealIx;
    } catch (error: any) {
      console.log(`Reveal attempt ${attempt} failed:`, error.message);

      if (attempt === maxRetries) {
        console.error("All reveal attempts failed. The Switchboard gateway may be experiencing issues.");
        throw error;
      }

      console.log(`Waiting ${delayMs}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      delayMs = Math.min(delayMs * 1.5, 10000);
    }
  }
  throw new Error("Should not reach here");
}

async function main() {
  console.log("=== Testing Switchboard VRF on Devnet ===\n");

  // Load wallet
  const keypairPath = path.join(process.env.HOME || "", ".config/solana/id.json");
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(new Uint8Array(keypairData));
  console.log("Wallet:", wallet.publicKey.toBase58());

  // Connect to devnet
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
  const balance = await connection.getBalance(wallet.publicKey);
  console.log("Balance:", balance / 1e9, "SOL\n");

  try {
    // Dynamically import Switchboard SDK
    console.log("Loading Switchboard SDK...");
    const {
      Randomness,
      AnchorUtils,
      ON_DEMAND_DEVNET_PID,
      ON_DEMAND_DEVNET_QUEUE
    } = await import("@switchboard-xyz/on-demand");

    console.log("Switchboard Program ID:", ON_DEMAND_DEVNET_PID.toBase58());
    console.log("Switchboard Queue:", ON_DEMAND_DEVNET_QUEUE.toBase58());

    // Create a simple wallet adapter
    const walletAdapter = {
      publicKey: wallet.publicKey,
      signTransaction: async (tx: any) => {
        tx.sign(wallet);
        return tx;
      },
      signAllTransactions: async (txs: any[]) => {
        txs.forEach(tx => tx.sign(wallet));
        return txs;
      },
    };

    // Load Switchboard program
    console.log("\nLoading Switchboard program...");
    const sbProgram = await AnchorUtils.loadProgramFromConnection(
      connection,
      walletAdapter,
      ON_DEMAND_DEVNET_PID
    );
    console.log("Program loaded successfully!");

    // Generate randomness keypair
    const randomnessKeypair = Keypair.generate();
    console.log("\nRandomness account:", randomnessKeypair.publicKey.toBase58());

    // Create randomness account
    console.log("Creating randomness account...");
    const [randomness, createIx] = await Randomness.create(
      sbProgram,
      randomnessKeypair,
      ON_DEMAND_DEVNET_QUEUE
    );
    console.log("Create instruction ready!");

    // Step 1: Send create transaction first
    console.log("\nSending create transaction...");
    const createTx = new Transaction().add(createIx);
    createTx.feePayer = wallet.publicKey;
    createTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    createTx.sign(wallet, randomnessKeypair);

    const createSig = await sendAndConfirmTransaction(connection, createTx, [wallet, randomnessKeypair]);
    console.log("Create tx confirmed:", createSig);

    // Step 2: Now get commit instruction (account exists now)
    console.log("\nGetting commit instruction...");
    const commitIx = await randomness.commitIx(ON_DEMAND_DEVNET_QUEUE);
    console.log("Commit instruction ready!");

    // Step 3: Send commit transaction
    console.log("Sending commit transaction...");
    const commitTx = new Transaction().add(commitIx);
    commitTx.feePayer = wallet.publicKey;
    commitTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    commitTx.sign(wallet);

    const commitSig = await sendAndConfirmTransaction(connection, commitTx, [wallet]);
    console.log("Commit tx confirmed:", commitSig);

    // Wait for slot to advance and oracle to process
    console.log("\nWaiting 3 seconds for randomness to be available...");
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 4: Get reveal instruction with retry logic
    const revealIx = await retryRevealRandomness(randomness);

    // Step 5: Send reveal transaction
    console.log("Sending reveal transaction...");
    const revealTx = new Transaction().add(revealIx);
    revealTx.feePayer = wallet.publicKey;
    revealTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    revealTx.sign(wallet);

    const revealSig = await sendAndConfirmTransaction(connection, revealTx, [wallet]);
    console.log("Reveal tx confirmed:", revealSig);

    console.log("\n=== VRF Test Successful! ===");
    console.log("Switchboard on-demand VRF is working on devnet.");
    console.log("\nNext steps:");
    console.log("1. Enable VRF_RARITY feature flag");
    console.log("2. Test commit-reveal flow in UI");

  } catch (error: any) {
    console.error("\n=== VRF Test Failed ===");
    console.error("Error:", error.message);
    if (error.logs) {
      console.error("Logs:", error.logs);
    }
    console.error("\nFull error:", error);
  }
}

main().catch(console.error);
