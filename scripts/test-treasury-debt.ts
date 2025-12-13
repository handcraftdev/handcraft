import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  SolanaStreamClient,
  Stream,
} from "@streamflow/stream";
import {
  getAssociatedTokenAddress,
  NATIVE_MINT,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";
import {
  getEcosystemSubConfigPda,
  getEcosystemSubscriptionPda,
  getEcosystemStreamingTreasuryPda,
  getCreatorPatronConfigPda,
  getCreatorPatronSubscriptionPda,
} from "../packages/sdk/src/program";

// Load keypair from file
function loadKeypair(filepath: string): Keypair {
  const secretKey = JSON.parse(fs.readFileSync(filepath, "utf-8"));
  return Keypair.fromSecretKey(new Uint8Array(secretKey));
}

// Format lamports to SOL with 9 decimal places
function formatSol(lamports: bigint | number): string {
  const value = typeof lamports === "bigint" ? Number(lamports) : lamports;
  return (value / 1e9).toFixed(9) + " SOL";
}

// Format seconds to human-readable duration
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

interface StreamDebtAnalysis {
  streamId: string;
  deposited: bigint;
  withdrawn: bigint;
  unlocked: bigint;
  locked: bigint;
  debt: bigint;  // unlocked but not withdrawn
  startTime: Date;
  endTime: Date;
  elapsed: number;
  remaining: number;
  percentComplete: number;
}

function analyzeStream(streamId: string, stream: Stream): StreamDebtAnalysis {
  const now = Math.floor(Date.now() / 1000);
  const startTime = Number(stream.start);
  const endTime = Number(stream.end);
  const deposited = BigInt(stream.depositedAmount.toString());
  const withdrawn = BigInt(stream.withdrawnAmount.toString());

  const totalDuration = endTime - startTime;
  const elapsed = Math.max(0, Math.min(now - startTime, totalDuration));
  const remaining = Math.max(0, endTime - now);

  // Calculate unlocked amount based on time elapsed
  let unlocked: bigint;
  if (now >= endTime) {
    unlocked = deposited;
  } else if (now <= startTime) {
    unlocked = BigInt(0);
  } else {
    unlocked = (deposited * BigInt(elapsed)) / BigInt(totalDuration);
  }

  const locked = deposited - unlocked;
  const debt = unlocked > withdrawn ? unlocked - withdrawn : BigInt(0);
  const percentComplete = totalDuration > 0 ? (elapsed / totalDuration) * 100 : 0;

  return {
    streamId,
    deposited,
    withdrawn,
    unlocked,
    locked,
    debt,
    startTime: new Date(startTime * 1000),
    endTime: new Date(endTime * 1000),
    elapsed,
    remaining,
    percentComplete,
  };
}

async function main() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  // Load wallet
  const walletPath = process.env.WALLET_PATH || path.join(process.env.HOME!, ".config/solana/id.json");
  const wallet = loadKeypair(walletPath);
  console.log("=".repeat(60));
  console.log("TREASURY & DEBT ANALYSIS");
  console.log("=".repeat(60));
  console.log("\nWallet:", wallet.publicKey.toBase58());

  // Check wallet balance
  const balance = await connection.getBalance(wallet.publicKey);
  console.log("Balance:", formatSol(balance));

  // Create Streamflow client
  const streamflowClient = new SolanaStreamClient("https://api.devnet.solana.com");

  // ===== CHECK SPECIFIC STREAM (optional argument) =====
  const specificStreamId = process.argv[2];

  if (specificStreamId) {
    console.log("\n" + "=".repeat(60));
    console.log("SPECIFIC STREAM ANALYSIS");
    console.log("=".repeat(60));
    console.log("\nStream ID:", specificStreamId);

    try {
      const stream = await streamflowClient.getOne({ id: specificStreamId });
      if (stream) {
        const analysis = analyzeStream(specificStreamId, stream);

        console.log("\n[Stream Info]");
        console.log("  Sender:", stream.sender);
        console.log("  Recipient:", stream.recipient);
        console.log("  Mint:", stream.mint);
        console.log("  Name:", (stream as any).name || "N/A");

        console.log("\n[Amounts]");
        console.log("  Deposited:", formatSol(analysis.deposited));
        console.log("  Withdrawn:", formatSol(analysis.withdrawn));
        console.log("  Unlocked:", formatSol(analysis.unlocked), `(${analysis.percentComplete.toFixed(4)}%)`);
        console.log("  Locked:", formatSol(analysis.locked));

        console.log("\n  ════════════════════════════════════");
        console.log("  DEBT (claimable by recipient):", formatSol(analysis.debt));
        console.log("  ════════════════════════════════════");

        console.log("\n[Timeline]");
        console.log("  Start:", analysis.startTime.toISOString());
        console.log("  End:", analysis.endTime.toISOString());
        console.log("  Now:", new Date().toISOString());
        console.log("  Elapsed:", formatDuration(analysis.elapsed));
        console.log("  Remaining:", formatDuration(analysis.remaining));
        console.log("  Progress:", analysis.percentComplete.toFixed(4) + "%");

        // Stream parameters
        console.log("\n[Stream Parameters]");
        console.log("  Period:", Number((stream as any).period), "seconds");
        console.log("  Amount per Period:", formatSol(BigInt((stream as any).amountPerPeriod?.toString() || 0)));
        console.log("  Cliff:", new Date(Number((stream as any).cliff) * 1000).toISOString());
        console.log("  Cancelable by Sender:", (stream as any).cancelableBySender);
        console.log("  Cancelable by Recipient:", (stream as any).cancelableByRecipient);
        console.log("  Can Topup:", (stream as any).canTopup);

        // Verification
        console.log("\n[Verification]");
        const expectedTotal = analysis.unlocked + analysis.locked;
        console.log("  Unlocked + Locked = Deposited?", expectedTotal === analysis.deposited ? "✅ YES" : "❌ NO");
        if (analysis.unlocked >= analysis.withdrawn) {
          console.log("  Debt = Unlocked - Withdrawn?", analysis.debt === (analysis.unlocked - analysis.withdrawn) ? "✅ YES" : "❌ NO");
        }

        // Check recipient balance
        const recipientPubkey = new PublicKey(stream.recipient);
        const recipientSol = await connection.getBalance(recipientPubkey);
        const recipientWsol = await getAssociatedTokenAddress(NATIVE_MINT, recipientPubkey, true);
        const recipientWsolInfo = await connection.getAccountInfo(recipientWsol);
        let recipientWsolBalance = 0;
        if (recipientWsolInfo) {
          recipientWsolBalance = Number(recipientWsolInfo.data.readBigUInt64LE(64));
        }

        console.log("\n[Recipient Treasury]");
        console.log("  Address:", stream.recipient);
        console.log("  SOL Balance:", formatSol(recipientSol));
        console.log("  WSOL Balance:", formatSol(recipientWsolBalance));
      } else {
        console.log("  ❌ Stream not found");
      }
    } catch (err: any) {
      console.log("  ❌ Error:", err.message);
    }
  }

  // ===== ECOSYSTEM SUBSCRIPTION =====
  console.log("\n" + "=".repeat(60));
  console.log("ECOSYSTEM SUBSCRIPTION CONFIG");
  console.log("=".repeat(60));

  // Get ecosystem config
  const [ecosystemConfigPda] = getEcosystemSubConfigPda();
  const ecosystemConfigAccount = await connection.getAccountInfo(ecosystemConfigPda);

  if (!ecosystemConfigAccount) {
    console.log("❌ Ecosystem config not found");
  } else {
    // Layout: discriminator(8) + price(8) + isActive(1) + authority(32)
    const price = ecosystemConfigAccount.data.readBigUInt64LE(8);
    const isActive = ecosystemConfigAccount.data[16] === 1;
    const authority = new PublicKey(ecosystemConfigAccount.data.slice(17, 49));

    console.log("\n[Config]");
    console.log("  PDA:", ecosystemConfigPda.toBase58());
    console.log("  Monthly Price:", formatSol(price));
    console.log("  Yearly Price:", formatSol(price * BigInt(10)), "(10 months)");
    console.log("  Is Active:", isActive);
    console.log("  Authority:", authority.toBase58());

    // Get ecosystem streaming treasury
    const [ecosystemTreasuryPda] = getEcosystemStreamingTreasuryPda();
    const treasuryBalance = await connection.getBalance(ecosystemTreasuryPda);
    const treasuryWsol = await getAssociatedTokenAddress(NATIVE_MINT, ecosystemTreasuryPda, true);
    const treasuryWsolInfo = await connection.getAccountInfo(treasuryWsol);
    let treasuryWsolBalance = 0;
    if (treasuryWsolInfo) {
      treasuryWsolBalance = Number(treasuryWsolInfo.data.readBigUInt64LE(64));
    }

    console.log("\n[Streaming Treasury PDA]");
    console.log("  PDA:", ecosystemTreasuryPda.toBase58());
    console.log("  SOL Balance:", formatSol(treasuryBalance));
    console.log("  WSOL Balance:", formatSol(treasuryWsolBalance));

    // Get all streams to treasury
    console.log("\n[All Streams to Treasury]");
    try {
      const allStreams = await streamflowClient.get({ address: ecosystemTreasuryPda.toBase58() });
      console.log(`  Found ${allStreams.length} stream(s)`);

      let totalDeposited = BigInt(0);
      let totalWithdrawn = BigInt(0);
      let totalDebt = BigInt(0);

      for (const [streamId, stream] of allStreams) {
        const analysis = analyzeStream(streamId, stream);
        totalDeposited += analysis.deposited;
        totalWithdrawn += analysis.withdrawn;
        totalDebt += analysis.debt;

        console.log(`\n  Stream: ${streamId.slice(0, 8)}...`);
        console.log(`    Sender: ${stream.sender}`);
        console.log(`    Deposited: ${formatSol(analysis.deposited)}`);
        console.log(`    Withdrawn: ${formatSol(analysis.withdrawn)}`);
        console.log(`    Debt: ${formatSol(analysis.debt)}`);
        console.log(`    Progress: ${analysis.percentComplete.toFixed(1)}%`);
      }

      if (allStreams.length > 0) {
        console.log("\n  ════════════════════════════════════");
        console.log("  TOTALS:");
        console.log("  ════════════════════════════════════");
        console.log(`  Total Deposited: ${formatSol(totalDeposited)}`);
        console.log(`  Total Withdrawn: ${formatSol(totalWithdrawn)}`);
        console.log(`  Total Debt: ${formatSol(totalDebt)}`);
      }
    } catch (err: any) {
      console.log("  ⚠️ Error fetching treasury streams:", err.message);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("DONE");
  console.log("=".repeat(60));
}

main().catch(console.error);
