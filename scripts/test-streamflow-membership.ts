import { Connection, Keypair, PublicKey, Transaction, VersionedTransaction, sendAndConfirmTransaction } from "@solana/web3.js";
import {
  SolanaStreamClient,
  ICreateLinearStreamData,
  ICreateStreamExt,
} from "@streamflow/stream";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  NATIVE_MINT,
} from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";
import {
  createContentRegistryClient,
  getCreatorPatronConfigPda,
  getCreatorPatronSubscriptionPda,
} from "../packages/sdk/src/program";

// Native SOL mint (wrapped SOL)
const NATIVE_SOL_MINT = NATIVE_MINT; // So11111111111111111111111111111111111111112

// Load keypair from file
function loadKeypair(filepath: string): Keypair {
  const secretKey = JSON.parse(fs.readFileSync(filepath, "utf-8"));
  return Keypair.fromSecretKey(new Uint8Array(secretKey));
}

/**
 * Pre-create WSOL ATAs for sender and recipient to avoid Streamflow SDK bug.
 * Only creates ATAs - Streamflow handles SOL wrapping with isNative: true.
 */
async function ensureWsolAtas(
  connection: Connection,
  payer: Keypair,
  sender: PublicKey,
  recipient: PublicKey
): Promise<boolean> {
  const senderAta = await getAssociatedTokenAddress(NATIVE_MINT, sender);
  const recipientAta = await getAssociatedTokenAddress(NATIVE_MINT, recipient);

  const [senderAtaInfo, recipientAtaInfo] = await Promise.all([
    connection.getAccountInfo(senderAta),
    connection.getAccountInfo(recipientAta),
  ]);

  const instructions = [];

  // Create sender ATA if needed
  if (!senderAtaInfo) {
    console.log("  Creating sender WSOL ATA:", senderAta.toBase58());
    instructions.push(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        senderAta,
        sender,
        NATIVE_MINT
      )
    );
  } else {
    console.log("  Sender WSOL ATA exists:", senderAta.toBase58());
  }

  // Create recipient ATA if needed
  if (!recipientAtaInfo) {
    console.log("  Creating recipient WSOL ATA:", recipientAta.toBase58());
    instructions.push(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        recipientAta,
        recipient,
        NATIVE_MINT
      )
    );
  } else {
    console.log("  Recipient WSOL ATA exists:", recipientAta.toBase58());
  }

  if (instructions.length > 0) {
    const tx = new Transaction().add(...instructions);
    tx.feePayer = payer.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;

    const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
    console.log("  ✓ ATAs created, tx:", sig);
    return true;
  }

  console.log("  ✓ All ATAs already exist");
  return false;
}

// Wrap Keypair to look like a wallet adapter for Streamflow
function createWalletAdapter(keypair: Keypair) {
  return {
    publicKey: keypair.publicKey,
    signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
      if (tx instanceof Transaction) {
        tx.sign(keypair);
        return tx;
      } else {
        tx.sign([keypair]);
        return tx;
      }
    },
    signAllTransactions: async <T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> => {
      return txs.map(tx => {
        if (tx instanceof Transaction) {
          tx.sign(keypair);
        } else {
          tx.sign([keypair]);
        }
        return tx;
      });
    },
  };
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

  if (balance < 0.5 * 1e9) {
    console.log("\n[WARNING] Balance is low. You may need more SOL for testing.");
    console.log("Get devnet SOL from: https://faucet.solana.com/");
  }

  const client = createContentRegistryClient(connection);

  // Test with a different creator (the one from MembershipButton logs)
  const creator = new PublicKey("BExNRPHbwJ2BVFW1WPLmoV7dteKtyNd7WN7bHy5JGUoe");

  console.log("\n=== CHECKING PATRON CONFIG ===");

  // Check patron config
  const [patronConfigPda] = getCreatorPatronConfigPda(creator);
  console.log("Patron Config PDA:", patronConfigPda.toBase58());
  const patronConfigAccount = await connection.getAccountInfo(patronConfigPda);

  if (!patronConfigAccount) {
    console.log("\n[ERROR] Patron config does NOT exist for this creator.");
    console.log("You need to initialize the patron config first via the web UI.");
    return;
  }

  console.log("  ✓ Patron config exists");
  // Parse config - Layout: discriminator(8) + creator(32) + membershipPrice(8) + subscriptionPrice(8) + isActive(1)
  const subscriptionPrice = patronConfigAccount.data.readBigUInt64LE(48);
  const isActive = patronConfigAccount.data[56] === 1;
  console.log("  Subscription price:", Number(subscriptionPrice) / 1e9, "SOL");
  console.log("  Is active:", isActive);

  if (!isActive) {
    console.log("\n[ERROR] Patron config is not active.");
    return;
  }

  console.log("\n=== TESTING STREAMFLOW STREAM CREATION (Native SOL) ===");

  // Create Streamflow client directly
  const streamflowClient = new SolanaStreamClient("https://api.devnet.solana.com");

  // Check SOL balance
  console.log("Sender SOL balance:", balance / 1e9, "SOL");

  if (balance < 0.1 * 1e9) {
    console.log("\n[ERROR] Insufficient SOL balance.");
    return;
  }

  // Pre-create WSOL ATAs (Streamflow handles SOL wrapping with isNative: true)
  console.log("\n=== PRE-CREATING WSOL ATAs ===");
  await ensureWsolAtas(connection, wallet, wallet.publicKey, creator);

  // Create stream with proper parameters
  // Use 0.01 SOL for testing
  const testAmount = new BN(10_000_000); // 0.01 SOL in lamports
  const testDuration = 60; // 60 seconds total
  const startTime = Math.floor(Date.now() / 1000) + 5; // Start 5 seconds from now
  const releaseFrequency = 1; // Release every 1 second
  const amountPerSecond = new BN(Math.floor(testAmount.toNumber() / testDuration));

  console.log("Creating test Streamflow stream...");
  console.log("  Amount:", testAmount.toNumber() / 1e9, "SOL");
  console.log("  Duration:", testDuration, "seconds");
  console.log("  Amount per period:", amountPerSecond.toNumber() / 1e9, "SOL/sec");
  console.log("  Recipient (creator):", creator.toBase58());

  try {
    // Create wallet adapter from keypair (Streamflow needs signTransaction methods)
    const walletAdapter = createWalletAdapter(wallet);

    const streamData: ICreateLinearStreamData = {
      recipient: creator.toBase58(),
      tokenId: NATIVE_SOL_MINT.toBase58(), // Native SOL
      amount: testAmount,
      period: releaseFrequency, // Release every 1 second
      start: startTime,
      cliff: startTime, // No cliff
      cliffAmount: new BN(0),
      amountPerPeriod: amountPerSecond,
      name: "Test SOL Membership",
      canTopup: true,
      cancelableBySender: true,
      cancelableByRecipient: false,
      transferableBySender: false,
      transferableByRecipient: false,
      automaticWithdrawal: false, // Disable auto-withdrawal
      withdrawalFrequency: 0,
    };

    const streamResult = await streamflowClient.create(
      streamData,
      {
        sender: walletAdapter,
        isNative: true, // Streamflow handles SOL wrapping, we just pre-create ATAs
      } as unknown as ICreateStreamExt
    );

    console.log("  ✓ Streamflow stream created!");
    console.log("  Stream ID:", streamResult.metadataId);
    console.log("  Tx ID:", streamResult.txId);

    // Verify stream exists
    console.log("\nVerifying stream...");
    const streamInfo = await streamflowClient.getOne({ id: streamResult.metadataId });
    if (streamInfo) {
      console.log("  ✓ Stream verified");
      console.log("  Sender:", streamInfo.sender);
      console.log("  Recipient:", streamInfo.recipient);
      console.log("  Start time:", new Date(Number(streamInfo.start) * 1000).toISOString());
      console.log("  End time:", new Date(Number(streamInfo.end) * 1000).toISOString());
    }

    // Now test creating on-chain subscription record
    console.log("\n=== TESTING ON-CHAIN SUBSCRIPTION ===");

    const [subscriptionPda] = getCreatorPatronSubscriptionPda(wallet.publicKey, creator);
    console.log("Subscription PDA:", subscriptionPda.toBase58());

    const existingSub = await connection.getAccountInfo(subscriptionPda);
    if (existingSub) {
      console.log("  [INFO] Subscription already exists - skipping creation");
      console.log("  To test fresh, you'd need a different creator or cancel existing subscription");
    } else {
      console.log("Creating on-chain subscription record...");
      const streamId = new PublicKey(streamResult.metadataId);

      const ix = await client.subscribePatronInstruction(
        wallet.publicKey,
        creator,
        "subscription",
        streamId
      );

      const tx = new Transaction().add(ix);
      tx.feePayer = wallet.publicKey;
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;

      // Sign and send
      tx.sign(wallet);
      const sig = await connection.sendRawTransaction(tx.serialize());
      await connection.confirmTransaction(sig, "confirmed");

      console.log("  ✓ On-chain subscription created!");
      console.log("  Transaction:", sig);

      // Verify
      const subAccount = await connection.getAccountInfo(subscriptionPda);
      if (subAccount) {
        console.log("  ✓ Subscription account verified");
        const storedStreamId = new PublicKey(subAccount.data.slice(73, 105));
        console.log("  Stored Stream ID:", storedStreamId.toBase58());
        console.log("  Matches:", storedStreamId.equals(streamId));
      }
    }

    console.log("\n=== SUCCESS ===");
    console.log("Full end-to-end flow works!");

  } catch (err: any) {
    console.error("\n[ERROR] Streamflow stream creation failed:");
    console.error("  Message:", err.message);
    if (err.logs) {
      console.error("  Logs:", err.logs);
    }

    // Check if it's a specific error
    if (err.message?.includes("insufficient funds")) {
      console.log("\nYou need more SOL in your wallet.");
      console.log("Get devnet SOL from: https://faucet.solana.com/");
    }
  }

  console.log("\n=== DONE ===");
}

main().catch(console.error);
