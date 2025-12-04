use anchor_lang::prelude::*;

pub const CONTENT_REWARD_POOL_SEED: &[u8] = b"content_reward_pool";
pub const WALLET_CONTENT_STATE_SEED: &[u8] = b"wallet_content";

/// Precision factor for reward_per_share calculations (1e12)
/// This prevents precision loss when dividing small rewards by large holder counts
pub const PRECISION: u128 = 1_000_000_000_000;

/// Per-content reward pool
/// Each content piece has its own pool tracking holder rewards from that content's sales
/// PDA seeds: ["content_reward_pool", content_pda]
#[account]
#[derive(InitSpace)]
pub struct ContentRewardPool {
    /// The content this pool belongs to
    pub content: Pubkey,
    /// Accumulated reward per share (scaled by PRECISION)
    /// Increases with each sale: reward_per_share += (holder_reward * PRECISION) / total_nfts
    pub reward_per_share: u128,
    /// Total NFTs minted for this content
    pub total_nfts: u64,
    /// Total rewards ever deposited to this pool (lamports)
    pub total_deposited: u64,
    /// Total rewards claimed from this pool (lamports)
    pub total_claimed: u64,
    /// Timestamp when pool was created
    pub created_at: i64,
}

impl ContentRewardPool {
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

/// Wallet-content state tracking
/// Tracks a wallet's position in a specific content's reward pool
/// Aggregates all NFTs a wallet owns for a given content
/// PDA seeds: ["wallet_content", wallet, content_pda]
#[account]
#[derive(InitSpace)]
pub struct WalletContentState {
    /// The wallet this state belongs to
    pub wallet: Pubkey,
    /// The content this state tracks
    pub content: Pubkey,
    /// Number of NFTs this wallet owns for this content
    pub nft_count: u64,
    /// Cumulative reward debt (sum of reward_per_share at each NFT acquisition)
    /// Used to calculate pending: (nft_count * current_rps) - reward_debt
    pub reward_debt: u128,
    /// Timestamp when first NFT was acquired
    pub created_at: i64,
    /// Timestamp of last update
    pub updated_at: i64,
}

impl WalletContentState {
    /// Calculate pending rewards for this wallet's position in this content
    pub fn pending_reward(&self, current_reward_per_share: u128) -> u64 {
        let entitled = self.nft_count as u128 * current_reward_per_share;
        if entitled <= self.reward_debt {
            return 0;
        }
        ((entitled - self.reward_debt) / PRECISION) as u64
    }

    /// Add an NFT to this wallet's position (on mint or transfer in)
    /// current_rps: the content pool's reward_per_share at acquisition time
    pub fn add_nft(&mut self, current_rps: u128, timestamp: i64) {
        self.nft_count += 1;
        self.reward_debt += current_rps;
        self.updated_at = timestamp;
    }

    /// Remove an NFT from this wallet's position (on transfer out)
    /// Preserves accumulated rewards by adjusting debt correctly
    pub fn remove_nft(&mut self, current_rps: u128, timestamp: i64) {
        if self.nft_count == 0 {
            return;
        }
        // To preserve pending rewards when removing an NFT:
        // pending = (nft_count * rps) - debt
        // After removal: pending = ((nft_count - 1) * rps) - new_debt
        // We want pending to stay the same, so: new_debt = debt - rps
        self.reward_debt = self.reward_debt.saturating_sub(current_rps);
        self.nft_count -= 1;
        self.updated_at = timestamp;
    }

    /// Claim rewards - updates debt to current entitled amount
    /// Returns the amount claimed
    pub fn claim(&mut self, current_rps: u128, timestamp: i64) -> u64 {
        let pending = self.pending_reward(current_rps);
        self.reward_debt = self.nft_count as u128 * current_rps;
        self.updated_at = timestamp;
        pending
    }
}

// Keep old structures for migration compatibility (can be removed after migration)
pub const GLOBAL_REWARD_POOL_SEED: &[u8] = b"global_reward_pool";
pub const NFT_REWARD_STATE_SEED: &[u8] = b"nft_reward";

/// @deprecated - Use ContentRewardPool instead
/// Global accumulated reward pool (legacy)
#[account]
#[derive(InitSpace)]
pub struct GlobalRewardPool {
    pub reward_per_share: u128,
    pub total_nfts: u64,
    pub total_deposited: u64,
    pub total_claimed: u64,
    pub created_at: i64,
}

/// @deprecated - Use WalletContentState instead
/// Per-NFT reward state (legacy)
#[account]
#[derive(InitSpace)]
pub struct NftRewardState {
    pub nft_asset: Pubkey,
    pub reward_debt: u128,
    pub created_at: i64,
}
