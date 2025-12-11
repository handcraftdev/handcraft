/**
 * Setup ORAO Callback VRF for single-transaction minting
 *
 * This script:
 * 1. Initializes our VRF client state PDA (if not already done)
 * 2. Registers our program with ORAO Callback VRF
 * 3. Funds the ORAO client account with SOL for oracle fees
 *
 * Run with: npx tsx scripts/setup-orao-vrf.ts
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";
import { PROGRAM_ID } from "@handcraft/sdk";

// ORAO Callback VRF Program ID
const ORAO_VRF_CB_ID = new PublicKey("VRFCBePmGTpZ234BhbzNNzmyg39Rgdd6VgdfhHwKypU");

// ORAO Seeds (from ORAO SDK)
const CB_CLIENT_ACCOUNT_SEED = Buffer.from("OraoVrfCbClient");
const CB_CONFIG_ACCOUNT_SEED = Buffer.from("OraoVrfCbConfig");

// Our seeds
const VRF_CLIENT_STATE_SEED = Buffer.from("vrf_client_state");

// Amount to fund the ORAO client account (in lamports) - 0.1 SOL
const FUNDING_AMOUNT = 0.1 * 1e9;

async function main() {
  // Load keypair from default Solana config
  const keypairPath = path.join(process.env.HOME!, ".config/solana/id.json");
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const keypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));

  console.log("Using wallet:", keypair.publicKey.toBase58());
  console.log("Program ID:", PROGRAM_ID.toBase58());
  console.log("ORAO VRF CB Program:", ORAO_VRF_CB_ID.toBase58());

  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  // Check balance
  const balance = await connection.getBalance(keypair.publicKey);
  console.log("Balance:", balance / 1e9, "SOL");

  if (balance < 0.5 * 1e9) {
    console.log("Insufficient balance. Requesting airdrop...");
    const sig = await connection.requestAirdrop(keypair.publicKey, 2e9);
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

  // Derive PDAs
  const [vrfClientStatePda, vrfClientStateBump] = PublicKey.findProgramAddressSync(
    [VRF_CLIENT_STATE_SEED],
    PROGRAM_ID
  );
  console.log("\n=== PDAs ===");
  console.log("VRF Client State PDA:", vrfClientStatePda.toBase58());

  const [oraoClientPda] = PublicKey.findProgramAddressSync(
    [CB_CLIENT_ACCOUNT_SEED, PROGRAM_ID.toBuffer(), vrfClientStatePda.toBuffer()],
    ORAO_VRF_CB_ID
  );
  console.log("ORAO Client PDA:", oraoClientPda.toBase58());

  const [oraoNetworkStatePda] = PublicKey.findProgramAddressSync(
    [CB_CONFIG_ACCOUNT_SEED],
    ORAO_VRF_CB_ID
  );
  console.log("ORAO Network State PDA:", oraoNetworkStatePda.toBase58());

  // Step 1: Initialize VRF Client State (if needed)
  console.log("\n=== Step 1: Initialize VRF Client State ===");
  const vrfClientStateAccount = await connection.getAccountInfo(vrfClientStatePda);
  if (vrfClientStateAccount) {
    console.log("VRF Client State already initialized!");
  } else {
    console.log("Initializing VRF Client State...");
    try {
      const tx = await (program.methods as any)
        .initVrfClient()
        .accounts({
          vrfClientState: vrfClientStatePda,
          authority: keypair.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([keypair])
        .rpc();
      console.log("VRF Client State initialized! Tx:", tx);
    } catch (error: any) {
      console.error("Error initializing VRF Client State:", error.message);
      return;
    }
  }

  // Step 2: Check if already registered with ORAO
  console.log("\n=== Step 2: Register with ORAO VRF ===");
  const oraoClientAccount = await connection.getAccountInfo(oraoClientPda);
  if (oraoClientAccount) {
    console.log("Already registered with ORAO VRF!");
    console.log("ORAO Client balance:", oraoClientAccount.lamports / 1e9, "SOL");
  } else {
    console.log("Registering with ORAO Callback VRF...");

    // Get ORAO treasury from network state
    const networkStateData = await connection.getAccountInfo(oraoNetworkStatePda);
    if (!networkStateData) {
      console.error("ORAO Network State not found! Is ORAO VRF deployed on devnet?");
      return;
    }

    // Parse treasury from network state (at offset 8 + 32 = 40, Pubkey is 32 bytes)
    // Layout: discriminator (8) + authority (32) + treasury (32) + ...
    const treasury = new PublicKey(networkStateData.data.slice(40, 72));
    console.log("ORAO Treasury:", treasury.toBase58());

    // Get program data PDA
    const [programDataPda] = PublicKey.findProgramAddressSync(
      [PROGRAM_ID.toBuffer()],
      new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111")
    );
    console.log("Program Data PDA:", programDataPda.toBase58());

    try {
      // Use our program's register_vrf_client instruction
      const tx = await (program.methods as any)
        .registerVrfClient()
        .accounts({
          payer: keypair.publicKey,
          program: PROGRAM_ID,
          programData: programDataPda,
          vrfClientState: vrfClientStatePda,
          oraoClient: oraoClientPda,
          oraoNetworkState: oraoNetworkStatePda,
          oraoVrfProgram: ORAO_VRF_CB_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([keypair])
        .rpc();
      console.log("ORAO Registration tx:", tx);
    } catch (error: any) {
      console.error("Registration failed:", error.message?.slice(0, 500));
      console.log("\nNote: Make sure the program is deployed with the latest code.");
      return;
    }
  }

  // Step 3: Fund ORAO Client account
  console.log("\n=== Step 3: Fund ORAO Client Account ===");
  const oraoClientBalance = await connection.getBalance(oraoClientPda);
  console.log("Current ORAO Client balance:", oraoClientBalance / 1e9, "SOL");

  if (oraoClientBalance < FUNDING_AMOUNT) {
    const fundAmount = FUNDING_AMOUNT - oraoClientBalance;
    console.log(`Funding ORAO Client with ${fundAmount / 1e9} SOL...`);

    const fundTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: oraoClientPda,
        lamports: fundAmount,
      })
    );

    try {
      const sig = await sendAndConfirmTransaction(connection, fundTx, [keypair]);
      console.log("Funded! Tx:", sig);
    } catch (error: any) {
      console.log("Funding note: ORAO Client account may need to exist first (after registration)");
      console.log("Error:", error.message?.slice(0, 200));
    }
  } else {
    console.log("ORAO Client already has sufficient funds!");
  }

  console.log("\n=== Setup Summary ===");
  console.log("VRF Client State PDA:", vrfClientStatePda.toBase58());
  console.log("ORAO Client PDA:", oraoClientPda.toBase58());
  console.log("ORAO Network State PDA:", oraoNetworkStatePda.toBase58());
  console.log("\nNext steps:");
  console.log("1. If registration failed, add register_vrf_client instruction to program");
  console.log("2. Deploy updated program with: anchor deploy");
  console.log("3. Re-run this script to complete registration");
  console.log("4. Test VRF minting with: npx tsx scripts/test-orao-mint.ts");
}

main().catch(console.error);
