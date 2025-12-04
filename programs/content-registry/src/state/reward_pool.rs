use anchor_lang::prelude::*;

pub const GLOBAL_REWARD_POOL_SEED: &[u8] = b"global_reward_pool";
pub const NFT_REWARD_STATE_SEED: &[u8] = b"nft_reward";

/// Precision factor for reward_per_share calculations (1e12)
/// This prevents precision loss when dividing small rewards by large holder counts
pub const PRECISION: u128 = 1_000_000_000_000;

/// Global accumulated reward pool for all holder rewards
/// Uses "reward per share" accounting for O(1) claiming
/// All 12% holder rewards from all content sales go to this single pool
/// PDA seeds: ["global_reward_pool"]
#[account]
#[derive(InitSpace)]
pub struct GlobalRewardPool {
    /// Accumulated reward per share (scaled by PRECISION)
    /// Increases with each sale: reward_per_share += (holder_reward * PRECISION) / total_nfts
    pub reward_per_share: u128,
    /// Total NFTs minted across all content (the "stake" denominator)
    pub total_nfts: u64,
    /// Total rewards ever deposited to the pool (lamports)
    pub total_deposited: u64,
    /// Total rewards claimed from the pool (lamports)
    pub total_claimed: u64,
    /// Timestamp when pool was created
    pub created_at: i64,
}

impl GlobalRewardPool {
    /// Add rewards to the pool and update reward_per_share
    /// Should be called BEFORE incrementing total_nfts for new mint
    pub fn add_rewards(&mut self, amount: u64) {
        if self.total_nfts == 0 || amount == 0 {
            return;
        }
        self.reward_per_share += (amount as u128 * PRECISION) / self.total_nfts as u128;
        self.total_deposited += amount;
    }

    /// Increment total NFTs (call AFTER adding rewards)
    pub fn increment_nfts(&mut self) {
        self.total_nfts += 1;
    }
}

/// Per-NFT reward state tracking
/// Records the global reward_per_share at mint time (or last claim) as "debt"
/// Claimable = (current_reward_per_share - reward_debt) / PRECISION
/// PDA seeds: ["nft_reward", nft_asset_pubkey]
#[account]
#[derive(InitSpace)]
pub struct NftRewardState {
    /// The NFT asset this state belongs to
    pub nft_asset: Pubkey,
    /// Reward debt - the global reward_per_share value at mint/last claim
    /// Used to calculate pending: (current_reward_per_share - reward_debt) / PRECISION
    pub reward_debt: u128,
    /// Timestamp when NFT was minted
    pub created_at: i64,
}

impl NftRewardState {
    /// Calculate pending rewards for this NFT
    pub fn pending_reward(&self, current_reward_per_share: u128) -> u64 {
        if current_reward_per_share <= self.reward_debt {
            return 0;
        }
        ((current_reward_per_share - self.reward_debt) / PRECISION) as u64
    }

    /// Claim rewards - updates debt to current reward_per_share
    pub fn claim(&mut self, current_reward_per_share: u128) -> u64 {
        let pending = self.pending_reward(current_reward_per_share);
        self.reward_debt = current_reward_per_share;
        pending
    }
}
