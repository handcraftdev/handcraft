import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import {
  createContentRegistryClient,
  getEcosystemSubConfigPda,
  getEcosystemStreamingTreasuryPda,
  getGlobalHolderPoolPda,
  getCreatorDistPoolPda,
  getCreatorPatronPoolPda,
  getCreatorPatronTreasuryPda,
  getUnifiedNftRewardStatePda,
  getEcosystemEpochStatePda,
} from "../packages/sdk/src/program";

// Load keypair from file
function loadKeypair(filepath: string): Keypair {
  const secretKey = JSON.parse(fs.readFileSync(filepath, "utf-8"));
  return Keypair.fromSecretKey(new Uint8Array(secretKey));
}

// Format lamports to SOL
function formatSol(lamports: bigint | number): string {
  const value = typeof lamports === "bigint" ? Number(lamports) : lamports;
  return (value / 1e9).toFixed(9) + " SOL";
}

// PRECISION constant (must match on-chain)
const PRECISION = BigInt("1000000000000000000"); // 10^18

interface PoolState {
  rewardPerShare: bigint;
  totalWeight: bigint;
  totalDeposited: bigint;
}

interface NftRewardState {
  nftAsset: PublicKey;
  creator: PublicKey;
  weight: number;
  patronDebt: bigint;
  globalDebt: bigint;
  contentDebt: bigint;
}

// Parse GlobalHolderPool account
function parseGlobalHolderPool(data: Buffer): PoolState {
  // Layout: discriminator(8) + reward_per_share(16) + total_weight(8) + total_deposited(8)
  return {
    rewardPerShare: data.readBigUInt64LE(8) + (data.readBigUInt64LE(16) << BigInt(64)),
    totalWeight: data.readBigUInt64LE(24),
    totalDeposited: data.readBigUInt64LE(32),
  };
}

// Parse CreatorDistPool account
function parseCreatorDistPool(data: Buffer): PoolState {
  // Layout: discriminator(8) + reward_per_share(16) + total_weight(8) + total_deposited(8)
  return {
    rewardPerShare: data.readBigUInt64LE(8) + (data.readBigUInt64LE(16) << BigInt(64)),
    totalWeight: data.readBigUInt64LE(24),
    totalDeposited: data.readBigUInt64LE(32),
  };
}

// Parse CreatorPatronPool account
function parseCreatorPatronPool(data: Buffer): PoolState {
  // Layout: discriminator(8) + creator(32) + reward_per_share(16) + total_weight(8) + total_deposited(8)
  return {
    rewardPerShare: data.readBigUInt64LE(40) + (data.readBigUInt64LE(48) << BigInt(64)),
    totalWeight: data.readBigUInt64LE(56),
    totalDeposited: data.readBigUInt64LE(64),
  };
}

// Parse UnifiedNftRewardState account
function parseUnifiedNftRewardState(data: Buffer): NftRewardState {
  // Layout: discriminator(8) + nft_asset(32) + creator(32) + rarity(1) + weight(2) + is_bundle(1) +
  //         content_or_bundle(32) + content_or_bundle_debt(16) + patron_debt(16) + global_debt(16) + created_at(8)
  return {
    nftAsset: new PublicKey(data.slice(8, 40)),
    creator: new PublicKey(data.slice(40, 72)),
    weight: data.readUInt16LE(73), // After rarity(1 byte)
    contentDebt: data.readBigUInt64LE(108) + (data.readBigUInt64LE(116) << BigInt(64)),
    patronDebt: data.readBigUInt64LE(124) + (data.readBigUInt64LE(132) << BigInt(64)),
    globalDebt: data.readBigUInt64LE(140) + (data.readBigUInt64LE(148) << BigInt(64)),
  };
}

// Calculate virtual RPS (same logic as on-chain)
function calculateVirtualRps(
  poolRps: bigint,
  streamingTreasuryBalance: bigint,
  sharePercent: number,
  totalWeight: bigint
): bigint {
  if (totalWeight === BigInt(0) || streamingTreasuryBalance === BigInt(0)) {
    return poolRps;
  }

  const treasuryShare = (streamingTreasuryBalance * BigInt(sharePercent)) / BigInt(100);
  return poolRps + (treasuryShare * PRECISION) / totalWeight;
}

async function main() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  // Load wallet
  const walletPath = process.env.WALLET_PATH || path.join(process.env.HOME!, ".config/solana/id.json");
  const wallet = loadKeypair(walletPath);
  console.log("=".repeat(70));
  console.log("MINT DEBT CALCULATION ANALYSIS");
  console.log("=".repeat(70));
  console.log("\nWallet:", wallet.publicKey.toBase58());

  // ===== STEP 1: Fetch Pool States =====
  console.log("\n" + "=".repeat(70));
  console.log("POOL STATES (Before any mint)");
  console.log("=".repeat(70));

  // Global Holder Pool
  const [globalHolderPoolPda] = getGlobalHolderPoolPda();
  const globalHolderPoolAccount = await connection.getAccountInfo(globalHolderPoolPda);

  if (!globalHolderPoolAccount) {
    console.log("\nGlobalHolderPool not found - needs initialization");
  } else {
    const globalPool = parseGlobalHolderPool(globalHolderPoolAccount.data);
    console.log("\n[GlobalHolderPool]");
    console.log("  PDA:", globalHolderPoolPda.toBase58());
    console.log("  Total Weight:", globalPool.totalWeight.toString());
    console.log("  Reward Per Share:", globalPool.rewardPerShare.toString());
    console.log("  Total Deposited:", formatSol(globalPool.totalDeposited));
  }

  // Creator Dist Pool
  const [creatorDistPoolPda] = getCreatorDistPoolPda();
  const creatorDistPoolAccount = await connection.getAccountInfo(creatorDistPoolPda);

  if (!creatorDistPoolAccount) {
    console.log("\nCreatorDistPool not found - needs initialization");
  } else {
    const distPool = parseCreatorDistPool(creatorDistPoolAccount.data);
    console.log("\n[CreatorDistPool]");
    console.log("  PDA:", creatorDistPoolPda.toBase58());
    console.log("  Total Weight:", distPool.totalWeight.toString());
    console.log("  Reward Per Share:", distPool.rewardPerShare.toString());
    console.log("  Total Deposited:", formatSol(distPool.totalDeposited));
  }

  // ===== STEP 2: Fetch Streaming Treasury Balances =====
  console.log("\n" + "=".repeat(70));
  console.log("STREAMING TREASURY BALANCES");
  console.log("=".repeat(70));

  // Ecosystem Streaming Treasury
  const [ecosystemTreasuryPda] = getEcosystemStreamingTreasuryPda();
  const ecosystemTreasuryBalance = await connection.getBalance(ecosystemTreasuryPda);
  console.log("\n[EcosystemStreamingTreasury]");
  console.log("  PDA:", ecosystemTreasuryPda.toBase58());
  console.log("  Balance:", formatSol(ecosystemTreasuryBalance));

  // Creator Patron Treasury (for test creator)
  const testCreator = wallet.publicKey; // Using wallet as creator for testing
  const [patronTreasuryPda] = getCreatorPatronTreasuryPda(testCreator);
  const patronTreasuryBalance = await connection.getBalance(patronTreasuryPda);
  console.log("\n[CreatorPatronTreasury]");
  console.log("  Creator:", testCreator.toBase58());
  console.log("  PDA:", patronTreasuryPda.toBase58());
  console.log("  Balance:", formatSol(patronTreasuryBalance));

  // Creator Patron Pool
  const [patronPoolPda] = getCreatorPatronPoolPda(testCreator);
  const patronPoolAccount = await connection.getAccountInfo(patronPoolPda);
  let patronPool: PoolState | null = null;

  if (!patronPoolAccount) {
    console.log("\nCreatorPatronPool not found for this creator");
  } else {
    patronPool = parseCreatorPatronPool(patronPoolAccount.data);
    console.log("\n[CreatorPatronPool]");
    console.log("  PDA:", patronPoolPda.toBase58());
    console.log("  Total Weight:", patronPool.totalWeight.toString());
    console.log("  Reward Per Share:", patronPool.rewardPerShare.toString());
    console.log("  Total Deposited:", formatSol(patronPool.totalDeposited));
  }

  // ===== STEP 3: Calculate Virtual RPS =====
  console.log("\n" + "=".repeat(70));
  console.log("VIRTUAL RPS CALCULATIONS");
  console.log("=".repeat(70));

  // Assuming a new NFT with weight 100 (Common)
  const testWeight = 100;
  console.log("\nFor a NEW NFT with weight:", testWeight);

  if (globalHolderPoolAccount) {
    const globalPool = parseGlobalHolderPool(globalHolderPoolAccount.data);
    const newTotalWeight = globalPool.totalWeight + BigInt(testWeight);

    const virtualGlobalRps = calculateVirtualRps(
      globalPool.rewardPerShare,
      BigInt(ecosystemTreasuryBalance),
      12, // 12% to holder pool
      newTotalWeight
    );

    console.log("\n[GlobalHolderPool Virtual RPS]");
    console.log("  Actual RPS:", globalPool.rewardPerShare.toString());
    console.log("  Treasury Balance:", formatSol(ecosystemTreasuryBalance));
    console.log("  Treasury Share (12%):", formatSol(Math.floor(ecosystemTreasuryBalance * 0.12)));
    console.log("  Total Weight (after mint):", newTotalWeight.toString());
    console.log("  Virtual RPS:", virtualGlobalRps.toString());

    const expectedGlobalDebt = BigInt(testWeight) * virtualGlobalRps;
    console.log("\n  Expected global_debt = weight * virtual_rps");
    console.log("  Expected global_debt:", expectedGlobalDebt.toString());
  }

  if (creatorDistPoolAccount) {
    const distPool = parseCreatorDistPool(creatorDistPoolAccount.data);
    const newTotalWeight = distPool.totalWeight + BigInt(testWeight);

    const virtualDistRps = calculateVirtualRps(
      distPool.rewardPerShare,
      BigInt(ecosystemTreasuryBalance),
      80, // 80% to creator dist pool
      newTotalWeight
    );

    console.log("\n[CreatorDistPool Virtual RPS]");
    console.log("  Actual RPS:", distPool.rewardPerShare.toString());
    console.log("  Treasury Balance:", formatSol(ecosystemTreasuryBalance));
    console.log("  Treasury Share (80%):", formatSol(Math.floor(ecosystemTreasuryBalance * 0.80)));
    console.log("  Total Weight (after mint):", newTotalWeight.toString());
    console.log("  Virtual RPS:", virtualDistRps.toString());

    const expectedCreatorDebtIncrement = BigInt(testWeight) * virtualDistRps;
    console.log("\n  Expected creator_debt_increment = weight * virtual_rps");
    console.log("  Expected creator_debt_increment:", expectedCreatorDebtIncrement.toString());
  }

  if (patronPool) {
    const newTotalWeight = patronPool.totalWeight + BigInt(testWeight);

    const virtualPatronRps = calculateVirtualRps(
      patronPool.rewardPerShare,
      BigInt(patronTreasuryBalance),
      12, // 12% to patron pool
      newTotalWeight
    );

    console.log("\n[CreatorPatronPool Virtual RPS]");
    console.log("  Actual RPS:", patronPool.rewardPerShare.toString());
    console.log("  Treasury Balance:", formatSol(patronTreasuryBalance));
    console.log("  Treasury Share (12%):", formatSol(Math.floor(patronTreasuryBalance * 0.12)));
    console.log("  Total Weight (after mint):", newTotalWeight.toString());
    console.log("  Virtual RPS:", virtualPatronRps.toString());

    const expectedPatronDebt = BigInt(testWeight) * virtualPatronRps;
    console.log("\n  Expected patron_debt = weight * virtual_rps");
    console.log("  Expected patron_debt:", expectedPatronDebt.toString());
  }

  // ===== STEP 4: Check an existing NFT's debt (if provided) =====
  const nftAssetArg = process.argv[2];
  if (nftAssetArg) {
    console.log("\n" + "=".repeat(70));
    console.log("EXISTING NFT DEBT ANALYSIS");
    console.log("=".repeat(70));

    const nftAsset = new PublicKey(nftAssetArg);
    const [unifiedStatePda] = getUnifiedNftRewardStatePda(nftAsset);
    const unifiedStateAccount = await connection.getAccountInfo(unifiedStatePda);

    if (!unifiedStateAccount) {
      console.log("\nUnifiedNftRewardState not found for NFT:", nftAsset.toBase58());
    } else {
      const nftState = parseUnifiedNftRewardState(unifiedStateAccount.data);
      console.log("\n[NFT:", nftAsset.toBase58().slice(0, 8) + "...]");
      console.log("  Weight:", nftState.weight);
      console.log("  Creator:", nftState.creator.toBase58());
      console.log("\n  Debts (set at mint time using virtual RPS):");
      console.log("    Content/Bundle Debt:", nftState.contentDebt.toString());
      console.log("    Patron Debt:", nftState.patronDebt.toString());
      console.log("    Global Debt:", nftState.globalDebt.toString());

      // Calculate what the pending rewards would be
      if (globalHolderPoolAccount) {
        const globalPool = parseGlobalHolderPool(globalHolderPoolAccount.data);
        const entitled = BigInt(nftState.weight) * globalPool.rewardPerShare;
        const pending = entitled > nftState.globalDebt ? (entitled - nftState.globalDebt) / PRECISION : BigInt(0);
        console.log("\n  [Global Holder Pool Pending Reward]");
        console.log("    Entitled:", entitled.toString());
        console.log("    Debt:", nftState.globalDebt.toString());
        console.log("    Pending (saturating_sub):", formatSol(pending));
      }
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("USAGE");
  console.log("=".repeat(70));
  console.log("\nTo analyze a specific NFT:");
  console.log("  npx tsx scripts/test-mint-debt.ts <NFT_ASSET_PUBKEY>");

  console.log("\n" + "=".repeat(70));
  console.log("DONE");
  console.log("=".repeat(70));
}

main().catch(console.error);
