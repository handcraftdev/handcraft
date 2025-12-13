import { Connection, Keypair, PublicKey, Transaction, SystemProgram, VersionedTransaction, MessageV0 } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import {
  createContentRegistryClient,
  getCreatorPatronConfigPda,
  getCreatorPatronSubscriptionPda,
  getEcosystemSubConfigPda,
  getEcosystemSubscriptionPda,
} from "../packages/sdk/src/program";

// Load keypair from file
function loadKeypair(filepath: string): Keypair {
  const secretKey = JSON.parse(fs.readFileSync(filepath, "utf-8"));
  return Keypair.fromSecretKey(new Uint8Array(secretKey));
}

async function main() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  // Load wallet
  const walletPath = process.env.WALLET_PATH || path.join(process.env.HOME!, ".config/solana/id.json");
  const wallet = loadKeypair(walletPath);
  console.log("Wallet:", wallet.publicKey.toBase58());

  // Check wallet balance
  const balance = await connection.getBalance(wallet.publicKey);
  console.log("Balance:", balance / 1e9, "SOL");

  const client = createContentRegistryClient(connection);

  // Use a different creator to test new subscription flow
  // This is a random address that likely doesn't have patron config
  const testCreator = new PublicKey("DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy");

  // Test creator (use wallet as creator for existing subscription check)
  const creator = wallet.publicKey;

  console.log("\n=== CHECKING PDAs ===");

  // Check patron config
  const [patronConfigPda] = getCreatorPatronConfigPda(creator);
  console.log("\nPatron Config PDA:", patronConfigPda.toBase58());
  const patronConfigAccount = await connection.getAccountInfo(patronConfigPda);
  if (patronConfigAccount) {
    console.log("  ✓ Patron config exists");
    console.log("  Data length:", patronConfigAccount.data.length);
    // Parse config
    // Layout: discriminator(8) + creator(32) + membershipPrice(8) + subscriptionPrice(8) + isActive(1) + createdAt(8) + updatedAt(8)
    const membershipPrice = patronConfigAccount.data.readBigUInt64LE(40);
    const subscriptionPrice = patronConfigAccount.data.readBigUInt64LE(48);
    const isActive = patronConfigAccount.data[56] === 1;
    console.log("  Membership price:", Number(membershipPrice) / 1e9, "SOL");
    console.log("  Subscription price:", Number(subscriptionPrice) / 1e9, "SOL");
    console.log("  Is active:", isActive);
  } else {
    console.log("  ✗ Patron config does NOT exist");
    console.log("  → Need to initialize patron config first");
  }

  // Check patron subscription
  const [patronSubPda] = getCreatorPatronSubscriptionPda(wallet.publicKey, creator);
  console.log("\nPatron Subscription PDA:", patronSubPda.toBase58());
  const patronSubAccount = await connection.getAccountInfo(patronSubPda);
  if (patronSubAccount) {
    console.log("  ✓ Patron subscription exists");
    console.log("  Data length:", patronSubAccount.data.length);
    // Layout: discriminator(8) + subscriber(32) + creator(32) + tier(1) + streamId(32) + startedAt(8) + isActive(1)
    const tier = patronSubAccount.data[72];
    const streamIdBytes = patronSubAccount.data.slice(73, 105);
    const streamId = new PublicKey(streamIdBytes);
    const startedAt = patronSubAccount.data.readBigInt64LE(105);
    const isActive = patronSubAccount.data[113] === 1;
    console.log("  Tier:", tier === 0 ? "Membership" : "Subscription");
    console.log("  Stream ID:", streamId.toBase58());
    console.log("  Started at:", new Date(Number(startedAt) * 1000).toISOString());
    console.log("  Is active:", isActive);
  } else {
    console.log("  ✗ Patron subscription does NOT exist");
  }

  // Check ecosystem config
  const [ecosystemConfigPda] = getEcosystemSubConfigPda();
  console.log("\nEcosystem Config PDA:", ecosystemConfigPda.toBase58());
  const ecosystemConfigAccount = await connection.getAccountInfo(ecosystemConfigPda);
  if (ecosystemConfigAccount) {
    console.log("  ✓ Ecosystem config exists");
    console.log("  Data length:", ecosystemConfigAccount.data.length);
    // Layout: discriminator(8) + price(8) + isActive(1) + authority(32)
    const price = ecosystemConfigAccount.data.readBigUInt64LE(8);
    const isActive = ecosystemConfigAccount.data[16] === 1;
    console.log("  Price:", Number(price) / 1e9, "SOL");
    console.log("  Is active:", isActive);
  } else {
    console.log("  ✗ Ecosystem config does NOT exist");
    console.log("  → Need to initialize ecosystem subscription config first");
  }

  // Check ecosystem subscription
  const [ecosystemSubPda] = getEcosystemSubscriptionPda(wallet.publicKey);
  console.log("\nEcosystem Subscription PDA:", ecosystemSubPda.toBase58());
  const ecosystemSubAccount = await connection.getAccountInfo(ecosystemSubPda);
  if (ecosystemSubAccount) {
    console.log("  ✓ Ecosystem subscription exists");
    console.log("  Data length:", ecosystemSubAccount.data.length);
    // Layout: discriminator(8) + subscriber(32) + streamId(32) + startedAt(8) + isActive(1)
    const streamIdBytes = ecosystemSubAccount.data.slice(40, 72);
    const streamId = new PublicKey(streamIdBytes);
    const startedAt = ecosystemSubAccount.data.readBigInt64LE(72);
    const isActive = ecosystemSubAccount.data[80] === 1;
    console.log("  Stream ID:", streamId.toBase58());
    console.log("  Started at:", new Date(Number(startedAt) * 1000).toISOString());
    console.log("  Is active:", isActive);
  } else {
    console.log("  ✗ Ecosystem subscription does NOT exist");
  }

  console.log("\n=== TESTING INSTRUCTION SIMULATION ===");

  // Test simulating patron subscription instruction with dummy stream ID
  if (patronConfigAccount && !patronSubAccount) {
    console.log("\nSimulating patron subscribe instruction...");
    try {
      const dummyStreamId = Keypair.generate().publicKey;
      const ix = await client.subscribePatronInstruction(
        wallet.publicKey,
        creator,
        "subscription",
        dummyStreamId
      );

      const tx = new Transaction().add(ix);
      tx.feePayer = wallet.publicKey;
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;

      // Simulate
      const simulation = await connection.simulateTransaction(tx, [wallet]);
      if (simulation.value.err) {
        console.log("  ✗ Simulation FAILED:");
        console.log("  Error:", JSON.stringify(simulation.value.err));
        console.log("  Logs:", simulation.value.logs?.join("\n    "));
      } else {
        console.log("  ✓ Simulation PASSED");
        console.log("  Logs:", simulation.value.logs?.slice(-3).join("\n    "));
      }
    } catch (err: any) {
      console.log("  ✗ Error creating instruction:", err.message);
    }
  } else if (patronSubAccount) {
    console.log("\n⚠️ Patron subscription already exists - cannot test subscribe");
    console.log("  Testing UNSIGNED simulation (like browser does)...");

    try {
      const dummyStreamId = Keypair.generate().publicKey;
      const ix = await client.subscribePatronInstruction(
        wallet.publicKey,
        creator,
        "subscription",
        dummyStreamId
      );

      const tx = new Transaction().add(ix);
      tx.feePayer = wallet.publicKey;
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;

      // Create VersionedTransaction for unsigned simulation
      const messageV0 = MessageV0.compile({
        payerKey: wallet.publicKey,
        instructions: tx.instructions,
        recentBlockhash: blockhash,
      });
      const versionedTx = new VersionedTransaction(messageV0);

      // Simulate WITHOUT signature (sigVerify: false)
      const simulation = await connection.simulateTransaction(versionedTx, {
        sigVerify: false,
        replaceRecentBlockhash: true,
      });

      if (simulation.value.err) {
        console.log("  ✓ Correctly detected error (account already exists):");
        console.log("    Error:", JSON.stringify(simulation.value.err));
        const relevantLogs = simulation.value.logs?.filter(l =>
          l.includes("Error") || l.includes("already") || l.includes("failed")
        );
        if (relevantLogs?.length) {
          console.log("    Logs:", relevantLogs.join("\n          "));
        }
      } else {
        console.log("  ✗ Simulation PASSED (unexpected - account should already exist)");
      }
    } catch (err: any) {
      console.log("  Error:", err.message);
    }
  }

  // Test simulating ecosystem subscription instruction with dummy stream ID
  if (ecosystemConfigAccount && !ecosystemSubAccount) {
    console.log("\nSimulating ecosystem subscribe instruction...");
    try {
      const dummyStreamId = Keypair.generate().publicKey;
      const ix = await client.subscribeEcosystemInstruction(
        wallet.publicKey,
        dummyStreamId
      );

      const tx = new Transaction().add(ix);
      tx.feePayer = wallet.publicKey;
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;

      // Simulate
      const simulation = await connection.simulateTransaction(tx, [wallet]);
      if (simulation.value.err) {
        console.log("  ✗ Simulation FAILED:");
        console.log("  Error:", JSON.stringify(simulation.value.err));
        console.log("  Logs:", simulation.value.logs?.join("\n    "));
      } else {
        console.log("  ✓ Simulation PASSED");
        console.log("  Logs:", simulation.value.logs?.slice(-3).join("\n    "));
      }
    } catch (err: any) {
      console.log("  ✗ Error creating instruction:", err.message);
    }
  } else if (ecosystemSubAccount) {
    console.log("\n⚠️ Ecosystem subscription already exists - cannot test subscribe");
    console.log("  Testing UNSIGNED simulation (like browser does)...");

    try {
      const dummyStreamId = Keypair.generate().publicKey;
      const ix = await client.subscribeEcosystemInstruction(
        wallet.publicKey,
        dummyStreamId
      );

      const tx = new Transaction().add(ix);
      tx.feePayer = wallet.publicKey;
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;

      // Create VersionedTransaction for unsigned simulation
      const messageV0 = MessageV0.compile({
        payerKey: wallet.publicKey,
        instructions: tx.instructions,
        recentBlockhash: blockhash,
      });
      const versionedTx = new VersionedTransaction(messageV0);

      // Simulate WITHOUT signature (sigVerify: false)
      const simulation = await connection.simulateTransaction(versionedTx, {
        sigVerify: false,
        replaceRecentBlockhash: true,
      });

      if (simulation.value.err) {
        console.log("  ✓ Correctly detected error (account already exists):");
        console.log("    Error:", JSON.stringify(simulation.value.err));
        const relevantLogs = simulation.value.logs?.filter(l =>
          l.includes("Error") || l.includes("already") || l.includes("failed")
        );
        if (relevantLogs?.length) {
          console.log("    Logs:", relevantLogs.join("\n          "));
        }
      } else {
        console.log("  ✗ Simulation PASSED (unexpected - account should already exist)");
      }
    } catch (err: any) {
      console.log("  Error:", err.message);
    }
  }

  // Test with a creator that doesn't have patron config set up
  console.log("\n=== TESTING WITH NON-EXISTENT CONFIG ===");
  const [testConfigPda] = getCreatorPatronConfigPda(testCreator);
  const testConfigAccount = await connection.getAccountInfo(testConfigPda);
  console.log("Test creator:", testCreator.toBase58());
  console.log("Config exists:", !!testConfigAccount);

  if (!testConfigAccount) {
    console.log("\nSimulating subscribe to creator without config...");
    try {
      const dummyStreamId = Keypair.generate().publicKey;
      const ix = await client.subscribePatronInstruction(
        wallet.publicKey,
        testCreator,
        "subscription",
        dummyStreamId
      );

      const tx = new Transaction().add(ix);
      tx.feePayer = wallet.publicKey;
      const { blockhash } = await connection.getLatestBlockhash();

      // Create VersionedTransaction for unsigned simulation
      const messageV0 = MessageV0.compile({
        payerKey: wallet.publicKey,
        instructions: tx.instructions,
        recentBlockhash: blockhash,
      });
      const versionedTx = new VersionedTransaction(messageV0);

      // Simulate WITHOUT signature (sigVerify: false)
      const simulation = await connection.simulateTransaction(versionedTx, {
        sigVerify: false,
        replaceRecentBlockhash: true,
      });

      if (simulation.value.err) {
        console.log("  ✓ Correctly detected error (config not found):");
        console.log("    Error:", JSON.stringify(simulation.value.err));
      } else {
        console.log("  ✗ Simulation PASSED (unexpected)");
      }
    } catch (err: any) {
      console.log("  Error:", err.message);
    }
  }

  console.log("\n=== DONE ===");
}

main().catch(console.error);
