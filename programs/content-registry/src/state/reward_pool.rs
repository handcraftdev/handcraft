use anchor_lang::prelude::*;

pub const CONTENT_REWARD_POOL_SEED: &[u8] = b"content_reward_pool";
pub const WALLET_CONTENT_STATE_SEED: &[u8] = b"wallet_content";

/// Precision factor for reward_per_share calculations (1e12)
/// This prevents precision loss when dividing small rewards by large holder counts
pub const PRECISION: u128 = 1_000_000_000_000;

/// Per-content reward pool with rarity-weighted distribution
/// Each content piece has its own pool tracking holder rewards from that content's sales
/// Rewards are distributed proportionally based on NFT weight (rarity)
/// PDA seeds: ["content_reward_pool", content_pda]
#[account]
#[derive(InitSpace)]
pub struct ContentRewardPool {
    /// The content this pool belongs to
    pub content: Pubkey,
    /// Accumulated reward per weight unit (scaled by PRECISION)
    /// Increases with each sale: reward_per_share += (holder_reward * PRECISION) / total_weight
    pub reward_per_share: u128,
    /// Total NFTs minted for this content
    pub total_nfts: u64,
    /// Total weight of all NFTs (sum of individual rarity weights)
    /// Used for weighted reward distribution
    pub total_weight: u64,
    /// Total rewards ever deposited to this pool (lamports)
    pub total_deposited: u64,
    /// Total rewards claimed from this pool (lamports)
    pub total_claimed: u64,
    /// Timestamp when pool was created
    pub created_at: i64,
}

impl ContentRewardPool {
    /// Add rewards to the pool and update reward_per_share (per weight unit)
    /// Should be called BEFORE adding new NFT weight
    pub fn add_rewards(&mut self, amount: u64) {
        if self.total_weight == 0 || amount == 0 {
            return;
        }
        self.reward_per_share += (amount as u128 * PRECISION) / self.total_weight as u128;
        self.total_deposited += amount;
    }

    /// Add an NFT with its weight (call AFTER adding rewards)
    /// weight: The rarity weight of the NFT (1=Common, 5=Uncommon, 20=Rare, 60=Epic, 120=Legendary)
    pub fn add_nft(&mut self, weight: u16) {
        self.total_nfts += 1;
        self.total_weight += weight as u64;
    }

    /// Remove an NFT with its weight (on burn)
    pub fn remove_nft(&mut self, weight: u16) {
        self.total_nfts = self.total_nfts.saturating_sub(1);
        self.total_weight = self.total_weight.saturating_sub(weight as u64);
    }

    /// Sync secondary sale royalties that arrived from Metaplex Core Royalties plugin
    ///
    /// Secondary sales on marketplaces transfer SOL directly to the reward pool PDA
    /// via the Royalties plugin, but don't call any program instruction. This method
    /// detects those deposits and updates reward_per_share accordingly.
    ///
    /// Call this at the start of claim instructions to auto-sync before calculating rewards.
    ///
    /// Returns the amount of new secondary royalties processed (0 if none)
    pub fn sync_secondary_royalties(&mut self, current_lamports: u64, rent_lamports: u64) -> u64 {
        // Calculate expected balance: rent + total_deposited - total_claimed
        let expected_balance = rent_lamports
            .saturating_add(self.total_deposited)
            .saturating_sub(self.total_claimed);

        // If current balance exceeds expected, we have new secondary royalties
        if current_lamports > expected_balance {
            let new_royalties = current_lamports - expected_balance;

            // Only process if we have existing weight to distribute to
            if self.total_weight > 0 && new_royalties > 0 {
                // Update reward_per_share (per weight unit) with new royalties
                self.reward_per_share += (new_royalties as u128 * PRECISION) / self.total_weight as u128;
                self.total_deposited += new_royalties;
                return new_royalties;
            }
        }

        0
    }

    /// Check if pool has any NFTs (and thus any weight)
    pub fn has_nfts(&self) -> bool {
        self.total_nfts > 0
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

// NOTE: Legacy NftRewardState and GlobalRewardPool removed
// Use UnifiedNftRewardState from subscription.rs instead
