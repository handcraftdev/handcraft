import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  getUnifiedNftRewardStatePda,
  getGlobalHolderPoolPda,
  getCreatorDistPoolPda,
  getCreatorPatronPoolPda,
  createContentRegistryClient,
} from "@handcraft/sdk";

const USER = new PublicKey("3iwhqrFx6PzMStAbuU6cceGsKJa38UTa1m4hNUECe2Hh");
const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const MPL_CORE_PROGRAM = new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");

async function main() {
  const connection = new Connection(RPC_URL);
  const client = createContentRegistryClient(connection);

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

  // Check UnifiedNftRewardState for each NFT
  console.log("\n--- Checking Unified NFT Reward States ---");

  let totalGlobalClaimable = BigInt(0);
  let totalCreatorDistClaimable = BigInt(0);
  let totalCreatorPatronClaimable = BigInt(0);
  let nftsWithState = 0;
  let totalWeight = 0;

  for (const nft of coreAccounts) {
    const nftAsset = nft.pubkey;
    const [statePda] = getUnifiedNftRewardStatePda(nftAsset);

    try {
      const state = await client.fetchNftRewardState(nftAsset);

      if (state) {
        nftsWithState++;
        const weight = Number(state.rarityWeight || 1);
        totalWeight += weight;

        // Get debts
        const globalDebt = BigInt(state.globalHolderDebt?.toString() || "0");
        const creatorDistDebt = BigInt(state.creatorDistDebt?.toString() || "0");
        const creatorPatronDebt = BigInt(state.creatorPatronDebt?.toString() || "0");

        // Calculate pending: (weight * rps / 1e12) - debt
        const globalPending = (BigInt(weight) * globalRps / BigInt(1e12)) - globalDebt;
        const creatorDistPending = (BigInt(weight) * creatorDistRps / BigInt(1e12)) - creatorDistDebt;
        const creatorPatronPending = (BigInt(weight) * creatorPatronRps / BigInt(1e12)) - creatorPatronDebt;

        if (globalPending > 0) totalGlobalClaimable += globalPending;
        if (creatorDistPending > 0) totalCreatorDistClaimable += creatorDistPending;
        if (creatorPatronPending > 0) totalCreatorPatronClaimable += creatorPatronPending;

        console.log(`\nNFT: ${nftAsset.toBase58().substring(0, 12)}...`);
        console.log(`  Weight: ${weight}`);
        console.log(`  Global Holder Debt: ${Number(globalDebt) / LAMPORTS_PER_SOL} SOL`);
        console.log(`  Global Pending: ${Number(globalPending > 0 ? globalPending : 0) / LAMPORTS_PER_SOL} SOL`);
        console.log(`  Creator Dist Debt: ${Number(creatorDistDebt) / LAMPORTS_PER_SOL} SOL`);
        console.log(`  Creator Dist Pending: ${Number(creatorDistPending > 0 ? creatorDistPending : 0) / LAMPORTS_PER_SOL} SOL`);
      }
    } catch {
      // No state for this NFT
    }
  }

  console.log("\n========================================");
  console.log("=== SUMMARY ===");
  console.log("========================================");
  console.log(`NFTs with reward state: ${nftsWithState} / ${coreAccounts.length}`);
  console.log(`Total weight: ${totalWeight}`);
  console.log("");
  console.log(">>> CLAIMABLE REWARDS <<<");
  console.log(`  Global Holder Pool: ${(Number(totalGlobalClaimable) / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
  console.log(`  Creator Dist Pool:  ${(Number(totalCreatorDistClaimable) / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
  console.log(`  Creator Patron Pool: ${(Number(totalCreatorPatronClaimable) / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
  console.log("");
  console.log(`TOTAL CLAIMABLE: ${((Number(totalGlobalClaimable) + Number(totalCreatorDistClaimable) + Number(totalCreatorPatronClaimable)) / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
}

main().catch(console.error);
