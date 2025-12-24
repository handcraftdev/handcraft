"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { PublicKey } from "@solana/web3.js";
import {
  createContentRegistryClient,
  getUnifiedNftRewardStatePda,
  getCreatorWeightPda,
  getCreatorPatronPoolPda,
  Rarity,
  getRarityWeight,
  getRarityName,
} from "@handcraft/sdk";

const LAMPORTS_PER_SOL = 1_000_000_000;
const PRECISION = BigInt(1_000_000_000_000); // 1e12
const MPL_CORE_PROGRAM_ID = "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d";

// Lazy initialization to avoid SSR _bn issues
let _MPL_CORE_PROGRAM: PublicKey | null = null;
function getMplCoreProgram(): PublicKey {
  if (!_MPL_CORE_PROGRAM) {
    _MPL_CORE_PROGRAM = new PublicKey(MPL_CORE_PROGRAM_ID);
  }
  return _MPL_CORE_PROGRAM;
}

/**
 * Calculate virtual RPS for lazy pools (includes undistributed treasury balance)
 * Formula: pool_rps + (treasury_balance * share_percent * PRECISION / 100) / total_weight
 */
function calculateVirtualRps(
  poolRps: bigint,
  treasuryBalance: bigint,
  sharePercent: number,
  totalWeight: bigint
): bigint {
  if (totalWeight === BigInt(0) || treasuryBalance === BigInt(0)) {
    return poolRps;
  }
  const treasuryShare = (treasuryBalance * BigInt(sharePercent)) / BigInt(100);
  return poolRps + (treasuryShare * PRECISION) / totalWeight;
}

// ============================================
// TYPES
// ============================================

export interface NftRewardData {
  nftAsset: string;
  rarity: string;
  weight: number;
  creator: string;

  // Content/Bundle rewards (from minting)
  contentCid: string | null;
  contentPending: bigint;
  contentDebt: bigint;

  // Subscription rewards
  globalHolderPending: bigint;
  globalHolderDebt: bigint;
  patronPending: bigint;
  patronDebt: bigint;

  // Total pending for this NFT
  totalPending: bigint;
}

export interface ContentRewardSummary {
  contentCid: string;
  title: string;
  previewUrl: string | null;
  nftCount: number;
  pending: bigint;
  nfts: NftRewardData[];
}

export interface CreatorPatronSummary {
  creator: string;
  nftCount: number;
  weight: number;
  pending: bigint;
  debt: bigint;
}

export interface UnifiedRewardsData {
  // All NFTs with their rewards
  nfts: NftRewardData[];

  // Summary by source
  mintingRewards: {
    total: bigint;
    contentSummaries: ContentRewardSummary[];
  };

  subscriptionRewards: {
    globalHolder: {
      pending: bigint;
      poolDeposited: bigint;
      poolRps: bigint;
      treasuryBalance: bigint;
    };
    creatorDist: {
      pending: bigint;
      creatorWeight: bigint;
      poolDeposited: bigint;
      poolRps: bigint;
      treasuryBalance: bigint;
    };
    creatorPatron: {
      total: bigint;
      byCreator: CreatorPatronSummary[];
    };
  };

  // Totals
  totalPending: bigint;
  totalWeight: number;
  rarityCounts: {
    Common: number;
    Uncommon: number;
    Rare: number;
    Epic: number;
    Legendary: number;
  };
}

// ============================================
// HOOK
// ============================================

export function useUnifiedRewards() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();

  const client = publicKey ? createContentRegistryClient(connection) : null;

  const rewardsQuery = useQuery({
    queryKey: ["unifiedRewards", publicKey?.toBase58()],
    queryFn: async (): Promise<UnifiedRewardsData | null> => {
      if (!publicKey || !client) return null;

      // 1. Fetch all user's MPL Core NFTs
      const mplCoreAccounts = await connection.getProgramAccounts(getMplCoreProgram(), {
        filters: [{ memcmp: { offset: 1, bytes: publicKey.toBase58() } }]
      });
      const nftAssets = mplCoreAccounts.map(acc => acc.pubkey);

      if (nftAssets.length === 0) {
        return createEmptyRewardsData();
      }

      // 2. Fetch all pools and ecosystem treasury WSOL balance in parallel
      const [globalHolderPool, creatorDistPool, ecosystemTreasuryBalance] = await Promise.all([
        client.fetchGlobalHolderPool(),
        client.fetchCreatorDistPool(),
        client.fetchEcosystemStreamingTreasuryBalance(), // Fetches WSOL ATA balance, not native SOL
      ]);
      const globalRps = globalHolderPool ? BigInt(globalHolderPool.rewardPerShare?.toString() || "0") : BigInt(0);
      const creatorDistRps = creatorDistPool ? BigInt(creatorDistPool.rewardPerShare?.toString() || "0") : BigInt(0);
      const globalHolderTotalWeight = globalHolderPool ? BigInt(globalHolderPool.totalWeight?.toString() || "0") : BigInt(0);
      const creatorDistTotalWeight = creatorDistPool ? BigInt(creatorDistPool.totalWeight?.toString() || "0") : BigInt(0);

      // Calculate virtual RPS for lazy pools (includes undistributed treasury)
      const virtualGlobalRps = calculateVirtualRps(globalRps, ecosystemTreasuryBalance, 12, globalHolderTotalWeight);
      const virtualCreatorDistRps = calculateVirtualRps(creatorDistRps, ecosystemTreasuryBalance, 80, creatorDistTotalWeight);

      console.log("[useUnifiedRewards] Ecosystem treasury WSOL balance:", ecosystemTreasuryBalance.toString());
      console.log("[useUnifiedRewards] Global holder pool - actualRPS:", globalRps.toString(), "virtualRPS:", virtualGlobalRps.toString(), "totalWeight:", globalHolderTotalWeight.toString());
      console.log("[useUnifiedRewards] Creator dist pool - actualRPS:", creatorDistRps.toString(), "virtualRPS:", virtualCreatorDistRps.toString(), "totalWeight:", creatorDistTotalWeight.toString());

      // 3. Fetch creator weight (if user is a creator)
      let creatorWeight = BigInt(0);
      let creatorRewardDebt = BigInt(0);
      try {
        const [creatorWeightPda] = getCreatorWeightPda(publicKey);
        const cwAccount = await connection.getAccountInfo(creatorWeightPda);
        if (cwAccount && cwAccount.data.length >= 64) {
          creatorWeight = cwAccount.data.readBigUInt64LE(40);
          creatorRewardDebt = readU128LE(cwAccount.data, 48);
        }
      } catch {
        // Not a creator
      }

      // 4. Fetch UnifiedNftRewardState for each NFT
      const pdas = nftAssets.map(nft => getUnifiedNftRewardStatePda(nft)[0]);
      const nftStateAccounts = await connection.getMultipleAccountsInfo(pdas);

      // 6. Process each NFT
      const nfts: NftRewardData[] = [];
      const rarityCounts = { Common: 0, Uncommon: 0, Rare: 0, Epic: 0, Legendary: 0 };
      let totalWeight = 0;
      let mintingTotal = BigInt(0);
      let globalHolderTotal = BigInt(0);
      const creatorPatronMap = new Map<string, CreatorPatronSummary>();
      const contentSummaryMap = new Map<string, ContentRewardSummary>();

      for (let i = 0; i < nftAssets.length; i++) {
        const nftAsset = nftAssets[i];
        const accountInfo = nftStateAccounts[i];

        if (!accountInfo || !accountInfo.data || accountInfo.data.length < 160) continue;

        try {
          const data = accountInfo.data;
          const offset = 8; // discriminator

          // Parse UnifiedNftRewardState
          const creatorPubkey = new PublicKey(data.slice(offset + 32, offset + 64));
          const rarityValue = data[offset + 64] as Rarity;
          const weight = getRarityWeight(rarityValue);
          const rarityName = getRarityName(rarityValue);

          const contentOrBundleDebt = readU128LE(data, offset + 100);
          const patronDebt = readU128LE(data, offset + 116);
          const globalDebt = readU128LE(data, offset + 132);

          // Calculate pending rewards using VIRTUAL RPS (includes undistributed treasury)
          const weightedGlobalRps = BigInt(weight) * virtualGlobalRps;
          const globalHolderPending = weightedGlobalRps > globalDebt
            ? (weightedGlobalRps - globalDebt) / PRECISION
            : BigInt(0);

          // Content rewards - fetch from content reward pool
          let contentPending = BigInt(0);
          let contentCid: string | null = null;
          // Note: Content rewards are tracked separately via ContentRewardPool
          // For now, we'll need to match NFTs to content via other means

          // Track totals
          totalWeight += weight;
          globalHolderTotal += globalHolderPending;
          rarityCounts[rarityName as keyof typeof rarityCounts]++;

          // Track creator patron pools
          const creatorKey = creatorPubkey.toBase58();
          const existing = creatorPatronMap.get(creatorKey);
          if (existing) {
            existing.nftCount++;
            existing.weight += weight;
            existing.debt += patronDebt;
          } else {
            creatorPatronMap.set(creatorKey, {
              creator: creatorKey,
              nftCount: 1,
              weight,
              pending: BigInt(0),
              debt: patronDebt,
            });
          }

          const nftData: NftRewardData = {
            nftAsset: nftAsset.toBase58(),
            rarity: rarityName,
            weight,
            creator: creatorKey,
            contentCid,
            contentPending,
            contentDebt: contentOrBundleDebt,
            globalHolderPending,
            globalHolderDebt: globalDebt,
            patronPending: BigInt(0), // Calculated below
            patronDebt,
            totalPending: globalHolderPending + contentPending,
          };

          nfts.push(nftData);
        } catch (err) {
          console.error("Error parsing NFT state:", err);
        }
      }

      // 7. Batch fetch creator patron pool RPS and treasury WSOL balances for all creators
      let creatorPatronTotal = BigInt(0);
      const creatorKeys = Array.from(creatorPatronMap.keys());
      if (creatorKeys.length > 0) {
        const creatorPoolPdas = creatorKeys.map(key => getCreatorPatronPoolPda(new PublicKey(key))[0]);

        // Fetch pools and WSOL treasury balances in parallel
        const [poolAccounts, ...treasuryBalances] = await Promise.all([
          connection.getMultipleAccountsInfo(creatorPoolPdas),
          ...creatorKeys.map(key => client.fetchCreatorPatronTreasuryBalance(new PublicKey(key))),
        ]);

        for (let i = 0; i < creatorKeys.length; i++) {
          const creatorKey = creatorKeys[i];
          const summary = creatorPatronMap.get(creatorKey)!;
          const accountInfo = poolAccounts[i];
          const patronTreasuryBalance = treasuryBalances[i] || BigInt(0);

          if (accountInfo && accountInfo.data.length >= 64) {
            try {
              // Parse CreatorPatronPool: discriminator(8) + creator(32) + rewardPerShare(16) + totalWeight(8) + ...
              const patronRps = readU128LE(accountInfo.data, 40);
              const poolTotalWeight = accountInfo.data.readBigUInt64LE(56);

              // Calculate virtual RPS (includes undistributed WSOL treasury - 12% goes to holders)
              const virtualPatronRps = calculateVirtualRps(patronRps, patronTreasuryBalance, 12, poolTotalWeight);

              const weightedRps = BigInt(summary.weight) * virtualPatronRps;
              const pending = weightedRps > summary.debt
                ? (weightedRps - summary.debt) / PRECISION
                : BigInt(0);
              summary.pending = pending;
              summary.debt = summary.debt / PRECISION;
              creatorPatronTotal += pending;
            } catch {
              // Invalid pool data
            }
          }
        }
      }

      // Update NFT patron pending based on calculated pool pending
      for (const nft of nfts) {
        const creatorSummary = creatorPatronMap.get(nft.creator);
        if (creatorSummary && creatorSummary.pending > BigInt(0)) {
          nft.patronPending = (BigInt(nft.weight) * creatorSummary.pending) / BigInt(creatorSummary.weight);
          nft.totalPending += nft.patronPending;
        }
      }

      // 8. Fetch content rewards (minting rewards)
      // This uses the existing pendingRewards from useContentRegistry pattern
      const pendingRewardsResult = await fetchContentPendingRewards(client, publicKey, nftAssets);
      mintingTotal = pendingRewardsResult.total;

      for (const contentReward of pendingRewardsResult.byContent) {
        contentSummaryMap.set(contentReward.contentCid, {
          contentCid: contentReward.contentCid,
          title: `Content ${contentReward.contentCid.slice(0, 8)}...`,
          previewUrl: null,
          nftCount: contentReward.nftCount,
          pending: contentReward.pending,
          nfts: [],
        });
      }

      // Calculate creator dist pending using VIRTUAL RPS (includes undistributed treasury)
      const creatorDistPending = creatorWeight > BigInt(0)
        ? ((creatorWeight * virtualCreatorDistRps) > creatorRewardDebt
          ? ((creatorWeight * virtualCreatorDistRps) - creatorRewardDebt) / PRECISION
          : BigInt(0))
        : BigInt(0);

      const totalPending = mintingTotal + globalHolderTotal + creatorDistPending + creatorPatronTotal;

      return {
        nfts: nfts.sort((a, b) => b.weight - a.weight),
        mintingRewards: {
          total: mintingTotal,
          contentSummaries: Array.from(contentSummaryMap.values()),
        },
        subscriptionRewards: {
          globalHolder: {
            pending: globalHolderTotal,
            poolDeposited: globalHolderPool ? BigInt(globalHolderPool.totalDeposited?.toString() || "0") : BigInt(0),
            poolRps: virtualGlobalRps, // Use virtual RPS for accurate display
            treasuryBalance: ecosystemTreasuryBalance,
          },
          creatorDist: {
            pending: creatorDistPending,
            creatorWeight,
            poolDeposited: creatorDistPool ? BigInt(creatorDistPool.totalDeposited?.toString() || "0") : BigInt(0),
            poolRps: virtualCreatorDistRps, // Use virtual RPS for accurate display
            treasuryBalance: ecosystemTreasuryBalance,
          },
          creatorPatron: {
            total: creatorPatronTotal,
            byCreator: Array.from(creatorPatronMap.values()).filter(c => c.pending > BigInt(0) || c.nftCount > 0),
          },
        },
        totalPending,
        totalWeight,
        rarityCounts,
      };
    },
    enabled: !!publicKey && !!client,
    staleTime: 30000,
    gcTime: 60000,
  });

  return {
    data: rewardsQuery.data,
    isLoading: rewardsQuery.isLoading,
    isError: rewardsQuery.isError,
    refetch: rewardsQuery.refetch,
  };
}

// ============================================
// HELPERS
// ============================================

function createEmptyRewardsData(): UnifiedRewardsData {
  return {
    nfts: [],
    mintingRewards: { total: BigInt(0), contentSummaries: [] },
    subscriptionRewards: {
      globalHolder: { pending: BigInt(0), poolDeposited: BigInt(0), poolRps: BigInt(0), treasuryBalance: BigInt(0) },
      creatorDist: { pending: BigInt(0), creatorWeight: BigInt(0), poolDeposited: BigInt(0), poolRps: BigInt(0), treasuryBalance: BigInt(0) },
      creatorPatron: { total: BigInt(0), byCreator: [] },
    },
    totalPending: BigInt(0),
    totalWeight: 0,
    rarityCounts: { Common: 0, Uncommon: 0, Rare: 0, Epic: 0, Legendary: 0 },
  };
}

function readU128LE(buffer: Buffer, offset: number): bigint {
  let result = BigInt(0);
  for (let i = 0; i < 16; i++) {
    result |= BigInt(buffer[offset + i]) << BigInt(i * 8);
  }
  return result;
}

async function fetchContentPendingRewards(
  _client: ReturnType<typeof createContentRegistryClient>,
  _wallet: PublicKey,
  _nftAssets: PublicKey[]
): Promise<{ total: bigint; byContent: { contentCid: string; pending: bigint; nftCount: number }[] }> {
  // Content/minting rewards are calculated separately via useContentRegistry
  // This hook focuses on subscription pool rewards
  return { total: BigInt(0), byContent: [] };
}

// Format helpers
export function formatSol(lamports: bigint): string {
  return (Number(lamports) / LAMPORTS_PER_SOL).toFixed(6);
}

export function formatSolShort(lamports: bigint): string {
  const sol = Number(lamports) / LAMPORTS_PER_SOL;
  if (sol === 0) return "0";
  if (sol < 0.0001) return "< 0.0001";
  return sol.toFixed(4);
}
