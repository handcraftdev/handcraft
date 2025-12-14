import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  getUnifiedNftRewardStatePda,
  createContentRegistryClient,
  Rarity,
  getRarityWeight,
  getRarityName,
} from "@handcraft/sdk";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";

const USER = new PublicKey("3iwhqrFx6PzMStAbuU6cceGsKJa38UTa1m4hNUECe2Hh");
const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const MPL_CORE_PROGRAM = new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");

function parseRarity(anchorRarity: unknown): Rarity {
  if (typeof anchorRarity === "number") return anchorRarity as Rarity;
  if (typeof anchorRarity === "object" && anchorRarity !== null) {
    const keys = Object.keys(anchorRarity);
    if (keys.length > 0) {
      const key = keys[0].toLowerCase();
      switch (key) {
        case "common": return Rarity.Common;
        case "uncommon": return Rarity.Uncommon;
        case "rare": return Rarity.Rare;
        case "epic": return Rarity.Epic;
        case "legendary": return Rarity.Legendary;
      }
    }
  }
  return Rarity.Common;
}

async function main() {
  const connection = new Connection(RPC_URL);
  const client = createContentRegistryClient(connection);

  // Load IDL
  const idlPath = path.join(process.cwd(), "packages/sdk/src/program/content_registry.json");
  const IDL = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

  const provider = new AnchorProvider(
    connection,
    { publicKey: USER } as any,
    { commitment: "confirmed" }
  );
  const program = new Program(IDL as any, provider);

  console.log("=== NFT Reward States for", USER.toBase58(), "===\n");

  // Get MPL Core assets owned by user
  console.log("--- Finding MPL Core NFTs ---");
  const coreAccounts = await connection.getProgramAccounts(MPL_CORE_PROGRAM, {
    filters: [
      { memcmp: { offset: 1, bytes: USER.toBase58() } }
    ]
  });
  console.log("MPL Core assets owned:", coreAccounts.length);

  // Fetch pool data first
  console.log("\n--- Pool RPS Values ---");
  const globalPool = await client.fetchGlobalHolderPool();
  const creatorDistPool = await client.fetchCreatorDistPool();
  const creatorPatronPool = await client.fetchCreatorPatronPool(USER);

  const globalRps = globalPool ? BigInt(globalPool.rewardPerShare?.toString() || "0") : BigInt(0);
  const creatorDistRps = creatorDistPool ? BigInt(creatorDistPool.rewardPerShare?.toString() || "0") : BigInt(0);
  const creatorPatronRps = creatorPatronPool ? BigInt(creatorPatronPool.rewardPerShare?.toString() || "0") : BigInt(0);

  console.log("Global Holder Pool RPS:", globalRps.toString());
  console.log("Creator Dist Pool RPS:", creatorDistRps.toString());
  console.log("Creator Patron Pool RPS:", creatorPatronRps.toString());

  // Table data
  interface NftData {
    nft: string;
    rarity: string;
    weight: number;
    globalDebt: bigint;
    globalPending: bigint;
  }

  const nftDataList: NftData[] = [];
  let totalWeight = 0;
  let totalGlobalDebt = BigInt(0);
  let totalGlobalPending = BigInt(0);

  // Rarity counters
  const rarityCounts = { Common: 0, Uncommon: 0, Rare: 0, Epic: 0, Legendary: 0 };

  console.log("\n--- Fetching Unified NFT Reward States ---\n");

  for (const nft of coreAccounts) {
    const nftAsset = nft.pubkey;
    const [statePda] = getUnifiedNftRewardStatePda(nftAsset);

    try {
      // Fetch via Anchor program for proper deserialization
      const state = await (program.account as any).unifiedNftRewardState.fetch(statePda);

      if (state) {
        const rarity = parseRarity(state.rarity);
        const weight = getRarityWeight(rarity);
        const rarityName = getRarityName(rarity);

        // Get debt - globalDebt is stored in the account (from global_debt on-chain)
        // Debt is stored as weight * rps_at_mint (without precision division)
        const globalDebt = BigInt(state.globalDebt?.toString() || "0");

        // Calculate pending: (weight * current_rps - debt) / precision
        // On-chain formula: (weighted_rps.saturating_sub(debt) / PRECISION)
        const weightedRps = BigInt(weight) * globalRps;
        const globalPending = weightedRps > globalDebt
          ? (weightedRps - globalDebt) / BigInt(1e12)
          : BigInt(0);

        totalWeight += weight;
        totalGlobalDebt += globalDebt;
        totalGlobalPending += globalPending;
        rarityCounts[rarityName as keyof typeof rarityCounts]++;

        nftDataList.push({
          nft: nftAsset.toBase58().substring(0, 12) + "...",
          rarity: rarityName,
          weight,
          globalDebt,
          globalPending,
        });
      }
    } catch {
      // No state for this NFT
    }
  }

  // Sort by weight descending
  nftDataList.sort((a, b) => b.weight - a.weight);

  // Print table
  console.log("┌────────────────┬───────────┬────────┬──────────────────┬──────────────────┐");
  console.log("│ NFT            │ Rarity    │ Weight │ Global Debt      │ Global Pending   │");
  console.log("├────────────────┼───────────┼────────┼──────────────────┼──────────────────┤");

  for (const data of nftDataList) {
    // Debt is stored as weight * rps (not divided by precision), so divide by 1e12 to get SOL equivalent
    const debtSolEquiv = Number(data.globalDebt / BigInt(1e12)) / LAMPORTS_PER_SOL;
    const pendingSol = (Number(data.globalPending) / LAMPORTS_PER_SOL).toFixed(9);
    console.log(
      `│ ${data.nft.padEnd(14)} │ ${data.rarity.padEnd(9)} │ ${String(data.weight).padStart(6)} │ ${debtSolEquiv.toFixed(9).padStart(16)} │ ${pendingSol.padStart(16)} │`
    );
  }

  console.log("└────────────────┴───────────┴────────┴──────────────────┴──────────────────┘");

  // Summary
  console.log("\n========================================");
  console.log("=== SUMMARY ===");
  console.log("========================================");
  console.log(`NFTs with reward state: ${nftDataList.length} / ${coreAccounts.length}`);
  console.log(`\nRarity Distribution:`);
  console.log(`  Common (1):     ${rarityCounts.Common}`);
  console.log(`  Uncommon (5):   ${rarityCounts.Uncommon}`);
  console.log(`  Rare (20):      ${rarityCounts.Rare}`);
  console.log(`  Epic (60):      ${rarityCounts.Epic}`);
  console.log(`  Legendary (120): ${rarityCounts.Legendary}`);
  console.log(`\nTotal Weight: ${totalWeight}`);
  // Debt is stored as weight * rps, so divide by precision to get SOL equivalent
  const totalDebtSolEquiv = Number(totalGlobalDebt / BigInt(1e12)) / LAMPORTS_PER_SOL;
  console.log(`Total Global Debt: ${totalDebtSolEquiv.toFixed(9)} SOL (equivalent)`);
  console.log(`\n>>> CLAIMABLE FROM GLOBAL HOLDER POOL: ${(Number(totalGlobalPending) / LAMPORTS_PER_SOL).toFixed(9)} SOL <<<`);
}

main().catch(console.error);
