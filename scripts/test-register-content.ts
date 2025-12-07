import { Connection, Keypair, clusterApiUrl, LAMPORTS_PER_SOL, Transaction } from "@solana/web3.js";
import { createContentRegistryClient, ContentType } from "@handcraft/sdk";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("=== Test Register Content With Mint ===\n");

  // Load wallet from default Solana keypair
  const keypairPath = path.join(process.env.HOME || "", ".config/solana/id.json");
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(new Uint8Array(keypairData));

  console.log("Wallet:", wallet.publicKey.toBase58());

  // Connect to devnet
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

  // Check balance
  const balance = await connection.getBalance(wallet.publicKey);
  console.log("Balance:", balance / LAMPORTS_PER_SOL, "SOL\n");

  if (balance < 0.1 * LAMPORTS_PER_SOL) {
    console.log("Insufficient balance. Requesting airdrop...");
    const sig = await connection.requestAirdrop(wallet.publicKey, LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig);
    console.log("Airdrop confirmed\n");
  }

  // Create client
  const client = createContentRegistryClient(connection);

  // Generate unique CIDs for testing
  const timestamp = Date.now();
  const contentCid = `QmTestContent${timestamp}`;
  const metadataCid = `QmTestMetadata${timestamp}`;

  console.log("Content CID:", contentCid);
  console.log("Metadata CID:", metadataCid);
  console.log("Content Type:", ContentType.GeneralVideo);
  console.log("Price: 0.01 SOL");
  console.log("Creator Royalty: 5%\n");

  try {
    // Get the instruction and collection keypair
    console.log("Building instruction...");
    const { instruction, collectionAssetKeypair } = await client.registerContentWithMintInstruction(
      wallet.publicKey,
      contentCid,
      metadataCid,
      ContentType.GeneralVideo,
      BigInt(10_000_000), // 0.01 SOL
      null, // unlimited supply
      500, // 5% royalty
      wallet.publicKey, // platform = self for testing
      false, // not encrypted
      "", // no preview
      "" // no encryption meta
    );

    console.log("Collection Asset:", collectionAssetKeypair.publicKey.toBase58());
    console.log("\nInstruction accounts:");
    instruction.keys.forEach((key, i) => {
      console.log(`  ${i}: ${key.pubkey.toBase58()} (signer: ${key.isSigner}, writable: ${key.isWritable})`);
    });

    // Build and sign transaction
    const tx = new Transaction().add(instruction);
    tx.feePayer = wallet.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    // Sign with both wallet and collection keypair
    tx.sign(wallet, collectionAssetKeypair);

    console.log("\nSimulating transaction...");
    const simulation = await connection.simulateTransaction(tx);

    if (simulation.value.err) {
      console.error("\n❌ Simulation FAILED:");
      console.error("Error:", JSON.stringify(simulation.value.err, null, 2));
      console.error("\nLogs:");
      simulation.value.logs?.forEach(log => console.error("  ", log));
    } else {
      console.log("✅ Simulation successful!");
      console.log("\nLogs:");
      simulation.value.logs?.forEach(log => console.log("  ", log));

      console.log("\nSending transaction...");
      const sig = await connection.sendRawTransaction(tx.serialize());
      console.log("Signature:", sig);

      await connection.confirmTransaction(sig, "confirmed");
      console.log("✅ Transaction confirmed!");
    }
  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    if (error.logs) {
      console.error("\nLogs:");
      error.logs.forEach((log: string) => console.error("  ", log));
    }
    throw error;
  }
}

main().catch(console.error);
