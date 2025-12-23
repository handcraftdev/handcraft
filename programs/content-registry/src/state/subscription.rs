use anchor_lang::prelude::*;
use crate::state::reward_pool::PRECISION;
use crate::state::rarity::Rarity;

// ============================================================================
// SEED CONSTANTS
// ============================================================================

/// Unified NFT reward state - tracks all debts for content or bundle NFTs
pub const UNIFIED_NFT_REWARD_STATE_SEED: &[u8] = b"unified_nft_reward";

/// Creator patron pool - holds SOL for NFT holder claims (12% of patron subscriptions)
pub const CREATOR_PATRON_POOL_SEED: &[u8] = b"creator_patron_pool";

/// Creator patron streaming treasury - receives Streamflow payments
pub const CREATOR_PATRON_TREASURY_SEED: &[u8] = b"creator_patron_treasury";

/// Global holder pool - holds SOL for NFT holder claims (12% of ecosystem subscriptions)
pub const GLOBAL_HOLDER_POOL_SEED: &[u8] = b"global_holder_pool";

/// Creator distribution pool - holds SOL for creator claims (80% of ecosystem subscriptions)
pub const CREATOR_DIST_POOL_SEED: &[u8] = b"creator_dist_pool";

/// Ecosystem epoch state - shared epoch tracking for lazy distribution
pub const ECOSYSTEM_EPOCH_STATE_SEED: &[u8] = b"ecosystem_epoch_state";

/// Creator weight - tracks total weight of creator's NFTs for ecosystem payouts
pub const CREATOR_WEIGHT_SEED: &[u8] = b"creator_weight";

/// Ecosystem streaming treasury - receives Streamflow payments for ecosystem subscriptions
pub const ECOSYSTEM_STREAMING_TREASURY_SEED: &[u8] = b"ecosystem_streaming_treasury";

/// Creator patron config - creator's subscription tier settings
pub const CREATOR_PATRON_CONFIG_SEED: &[u8] = b"creator_patron_config";

/// Creator patron subscription - user's subscription to a creator
pub const CREATOR_PATRON_SUB_SEED: &[u8] = b"creator_patron_sub";

/// Ecosystem subscription config - platform-wide subscription settings
pub const ECOSYSTEM_SUB_CONFIG_SEED: &[u8] = b"ecosystem_sub_config";

/// Ecosystem subscription - user's platform subscription
pub const ECOSYSTEM_SUB_SEED: &[u8] = b"ecosystem_sub";

/// Default epoch duration: 1 day in seconds (for distribution batching)
pub const DEFAULT_EPOCH_DURATION: i64 = 24 * 60 * 60;

/// Test epoch duration: 60 seconds (for E2E testing)
pub const TEST_EPOCH_DURATION: i64 = 60;

/// Subscription validity period: 30 days in seconds (for content access)
pub const SUBSCRIPTION_VALIDITY_PERIOD: i64 = 30 * 24 * 60 * 60;

// ============================================================================
// UNIFIED NFT REWARD STATE
// ============================================================================

/// Single account per NFT tracking all reward debts
/// Replaces separate NftRewardState per pool, reducing rent costs
/// PDA seeds: ["unified_nft_reward", nft_asset]
#[account]
#[derive(InitSpace)]
pub struct UnifiedNftRewardState {
    /// The NFT asset this state belongs to
    pub nft_asset: Pubkey,
    /// Creator of the content/bundle (for patron pool lookup)
    pub creator: Pubkey,
    /// Rarity tier of this NFT
    pub rarity: Rarity,
    /// Weight of this NFT based on rarity (1=Common, 5=Uncommon, 20=Rare, 60=Epic, 120=Legendary)
    pub weight: u16,
    /// Whether this is a bundle NFT (false = content NFT)
    pub is_bundle: bool,
    /// Content or Bundle pubkey (for pool lookup)
    pub content_or_bundle: Pubkey,

    // Debt for each pool type (3 pools, 1 account)
    /// Debt for ContentRewardPool OR RewardPool (IMMEDIATE distribution)
    pub content_or_bundle_debt: u128,
    /// Debt for CreatorPatronPool (LAZY distribution, uses virtual RPS at mint)
    pub patron_debt: u128,
    /// Debt for GlobalHolderPool (LAZY distribution, uses virtual RPS at mint)
    pub global_debt: u128,

    /// Timestamp when this state was created (at mint time)
    pub created_at: i64,
}

impl UnifiedNftRewardState {
    /// Calculate pending content/bundle rewards (IMMEDIATE pool)
    pub fn pending_content_or_bundle_reward(&self, current_rps: u128) -> u64 {
        let entitled = self.weight as u128 * current_rps;
        if entitled <= self.content_or_bundle_debt {
            return 0;
        }
        ((entitled - self.content_or_bundle_debt) / PRECISION) as u64
    }

    /// Calculate pending patron rewards (LAZY pool)
    /// Uses saturating subtraction to handle virtual RPS debt
    pub fn pending_patron_reward(&self, current_rps: u128) -> u64 {
        let weighted_rps = self.weight as u128 * current_rps;
        (weighted_rps.saturating_sub(self.patron_debt) / PRECISION) as u64
    }

    /// Calculate pending global holder rewards (LAZY pool)
    /// Uses saturating subtraction to handle virtual RPS debt
    pub fn pending_global_reward(&self, current_rps: u128) -> u64 {
        let weighted_rps = self.weight as u128 * current_rps;
        (weighted_rps.saturating_sub(self.global_debt) / PRECISION) as u64
    }

    /// Update content/bundle debt after claiming
    pub fn update_content_or_bundle_debt(&mut self, current_rps: u128) {
        self.content_or_bundle_debt = self.weight as u128 * current_rps;
    }

    /// Update patron debt after claiming
    pub fn update_patron_debt(&mut self, current_rps: u128) {
        self.patron_debt = self.weight as u128 * current_rps;
    }

    /// Update global debt after claiming
    pub fn update_global_debt(&mut self, current_rps: u128) {
        self.global_debt = self.weight as u128 * current_rps;
    }
}

// ============================================================================
// CREATOR PATRON POOL (per creator)
// ============================================================================

/// Per-creator pool for patron subscription holder rewards
/// Receives 12% of patron subscription fees on epoch distribution
/// PDA seeds: ["creator_patron_pool", creator]
#[account]
#[derive(InitSpace)]
pub struct CreatorPatronPool {
    /// The creator this pool belongs to
    pub creator: Pubkey,
    /// Accumulated reward per weight unit (scaled by PRECISION)
    pub reward_per_share: u128,
    /// Total weight of all NFTs for this creator (sum of rarity weights)
    pub total_weight: u64,
    /// Total SOL deposited into this pool
    pub total_deposited: u64,
    /// Total SOL claimed from this pool
    pub total_claimed: u64,
    /// Timestamp of last epoch distribution
    pub last_distribution_at: i64,
    /// Epoch duration in seconds (default: 30 days)
    pub epoch_duration: i64,
    /// Timestamp when pool was created
    pub created_at: i64,
}

impl CreatorPatronPool {
    /// Check if epoch has ended and distribution is needed
    pub fn epoch_ended(&self, now: i64) -> bool {
        now >= self.last_distribution_at + self.epoch_duration
    }

    /// Distribute streaming treasury to pool
    /// Returns the holder share (12%) that was deposited
    pub fn distribute(&mut self, streaming_balance: u64, now: i64) -> u64 {
        if streaming_balance == 0 || self.total_weight == 0 {
            return 0;
        }

        // 12% to holder pool
        let holder_share = streaming_balance * 12 / 100;

        // Update pool accounting
        self.reward_per_share += (holder_share as u128 * PRECISION) / self.total_weight as u128;
        self.total_deposited += holder_share;
        self.last_distribution_at = now;

        holder_share
    }

    /// Add weight when NFT is minted
    pub fn add_weight(&mut self, weight: u16) {
        self.total_weight += weight as u64;
    }

    /// Remove weight when NFT is burned
    pub fn remove_weight(&mut self, weight: u16) {
        self.total_weight = self.total_weight.saturating_sub(weight as u64);
    }
}

// ============================================================================
// GLOBAL HOLDER POOL (singleton)
// ============================================================================

/// Global pool for ecosystem subscription holder rewards
/// Receives 12% of ecosystem subscription fees on epoch distribution
/// PDA seeds: ["global_holder_pool"]
#[account]
#[derive(InitSpace)]
pub struct GlobalHolderPool {
    /// Accumulated reward per weight unit (scaled by PRECISION)
    pub reward_per_share: u128,
    /// Total weight of ALL NFTs globally (sum of all rarity weights)
    pub total_weight: u64,
    /// Total SOL deposited into this pool
    pub total_deposited: u64,
    /// Total SOL claimed from this pool
    pub total_claimed: u64,
    /// Timestamp when pool was created
    pub created_at: i64,
}

impl GlobalHolderPool {
    /// Add weight when any NFT is minted
    pub fn add_weight(&mut self, weight: u16) {
        self.total_weight += weight as u64;
    }

    /// Remove weight when any NFT is burned
    pub fn remove_weight(&mut self, weight: u16) {
        self.total_weight = self.total_weight.saturating_sub(weight as u64);
    }

    /// Distribute holder share (12%) to pool
    pub fn distribute(&mut self, holder_share: u64) {
        if holder_share == 0 || self.total_weight == 0 {
            return;
        }
        self.reward_per_share += (holder_share as u128 * PRECISION) / self.total_weight as u128;
        self.total_deposited += holder_share;
    }
}

// ============================================================================
// CREATOR DISTRIBUTION POOL (singleton)
// ============================================================================

/// Global pool for ecosystem subscription creator payouts
/// Receives 80% of ecosystem subscription fees on epoch distribution
/// Creators claim based on their weight share (sum of their NFT weights)
/// PDA seeds: ["creator_dist_pool"]
#[account]
#[derive(InitSpace)]
pub struct CreatorDistPool {
    /// Accumulated reward per weight unit (scaled by PRECISION)
    pub reward_per_share: u128,
    /// Total weight of ALL NFTs globally (same as GlobalHolderPool)
    pub total_weight: u64,
    /// Total SOL deposited into this pool
    pub total_deposited: u64,
    /// Total SOL claimed from this pool
    pub total_claimed: u64,
    /// Timestamp when pool was created
    pub created_at: i64,
}

impl CreatorDistPool {
    /// Add weight when any NFT is minted
    pub fn add_weight(&mut self, weight: u16) {
        self.total_weight += weight as u64;
    }

    /// Remove weight when any NFT is burned
    pub fn remove_weight(&mut self, weight: u16) {
        self.total_weight = self.total_weight.saturating_sub(weight as u64);
    }

    /// Distribute creator share (80%) to pool
    pub fn distribute(&mut self, creator_share: u64) {
        if creator_share == 0 || self.total_weight == 0 {
            return;
        }
        self.reward_per_share += (creator_share as u128 * PRECISION) / self.total_weight as u128;
        self.total_deposited += creator_share;
    }
}

// ============================================================================
// ECOSYSTEM EPOCH STATE (singleton)
// ============================================================================

/// Shared epoch tracking for GlobalHolderPool and CreatorDistPool
/// Both pools distribute from EcosystemStreamingTreasury at the same time
/// PDA seeds: ["ecosystem_epoch_state"]
#[account]
#[derive(InitSpace)]
pub struct EcosystemEpochState {
    /// Timestamp of last ecosystem distribution
    pub last_distribution_at: i64,
    /// Epoch duration in seconds (default: 30 days)
    pub epoch_duration: i64,
}

impl EcosystemEpochState {
    /// Check if epoch has ended
    pub fn epoch_ended(&self, now: i64) -> bool {
        now >= self.last_distribution_at + self.epoch_duration
    }

    /// Update after distribution
    pub fn mark_distributed(&mut self, now: i64) {
        self.last_distribution_at = now;
    }
}

// ============================================================================
// CREATOR WEIGHT (per creator)
// ============================================================================

/// Tracks total weight of creator's NFTs for CreatorDistPool claims
/// PDA seeds: ["creator_weight", creator]
#[account]
#[derive(InitSpace)]
pub struct CreatorWeight {
    /// The creator this weight belongs to
    pub creator: Pubkey,
    /// Sum of weights of all NFTs created by this creator
    pub total_weight: u64,
    /// Accumulated debt for CreatorDistPool (uses ADD not SET)
    pub reward_debt: u128,
    /// Total SOL claimed from CreatorDistPool
    pub total_claimed: u64,
    /// Timestamp when account was created
    pub created_at: i64,
}

impl CreatorWeight {
    /// Add weight when creator's NFT is minted
    /// Also accumulates debt with current virtual RPS
    pub fn add_weight(&mut self, weight: u16, virtual_creator_dist_rps: u128) {
        self.total_weight += weight as u64;
        // ADD (not SET) - accumulates across all NFTs
        self.reward_debt += weight as u128 * virtual_creator_dist_rps;
    }

    /// Remove weight when creator's NFT is burned
    /// Debt is NOT reduced - creator loses potential future rewards for burned NFTs
    pub fn remove_weight(&mut self, weight: u16) {
        self.total_weight = self.total_weight.saturating_sub(weight as u64);
    }

    /// Calculate pending rewards from CreatorDistPool
    pub fn pending_reward(&self, pool_rps: u128) -> u64 {
        let weighted_rps = self.total_weight as u128 * pool_rps;
        (weighted_rps.saturating_sub(self.reward_debt) / PRECISION) as u64
    }

    /// Update debt after claiming
    pub fn update_debt(&mut self, pool_rps: u128) {
        self.reward_debt = self.total_weight as u128 * pool_rps;
    }
}

// ============================================================================
// CREATOR PATRON CONFIG (per creator)
// ============================================================================

/// Creator's subscription/membership tier configuration
/// PDA seeds: ["creator_patron_config", creator]
#[account]
#[derive(InitSpace)]
pub struct CreatorPatronConfig {
    /// The creator who owns this config
    pub creator: Pubkey,
    /// SOL per month for support-only tier (0 = disabled)
    pub membership_price: u64,
    /// SOL per month for support + Level 2 access tier (0 = disabled)
    pub subscription_price: u64,
    /// Whether patron system is active for this creator
    pub is_active: bool,
    /// Timestamp when config was created
    pub created_at: i64,
    /// Timestamp when config was last updated
    pub updated_at: i64,
}

// ============================================================================
// CREATOR PATRON SUBSCRIPTION (per user per creator)
// ============================================================================

/// Patron tier type
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum PatronTier {
    /// Support only, no content access
    Membership,
    /// Support + Level 2 content access
    Subscription,
}

/// Tracks a user's subscription to a specific creator
/// PDA seeds: ["creator_patron_sub", subscriber, creator]
#[account]
#[derive(InitSpace)]
pub struct CreatorPatronSubscription {
    /// The subscriber's wallet
    pub subscriber: Pubkey,
    /// The creator being subscribed to
    pub creator: Pubkey,
    /// Membership or Subscription tier
    pub tier: PatronTier,
    /// Streamflow stream account for ongoing payments
    pub stream_id: Pubkey,
    /// Timestamp when subscription started
    pub started_at: i64,
    /// Whether subscription is currently active
    pub is_active: bool,
}

// ============================================================================
// ECOSYSTEM SUBSCRIPTION CONFIG (singleton)
// ============================================================================

/// Platform-wide ecosystem subscription configuration
/// PDA seeds: ["ecosystem_sub_config"]
#[account]
#[derive(InitSpace)]
pub struct EcosystemSubConfig {
    /// SOL per month for ecosystem access
    pub price: u64,
    /// Whether ecosystem subscription is active
    pub is_active: bool,
    /// Admin who can update config
    pub authority: Pubkey,
    /// Timestamp when config was created
    pub created_at: i64,
    /// Timestamp when config was last updated
    pub updated_at: i64,
}

// ============================================================================
// ECOSYSTEM SUBSCRIPTION (per user)
// ============================================================================

/// Tracks a user's ecosystem subscription
/// PDA seeds: ["ecosystem_sub", subscriber]
#[account]
#[derive(InitSpace)]
pub struct EcosystemSubscription {
    /// The subscriber's wallet
    pub subscriber: Pubkey,
    /// Streamflow stream account for ongoing payments
    pub stream_id: Pubkey,
    /// Timestamp when subscription started
    pub started_at: i64,
    /// Whether subscription is currently active
    pub is_active: bool,
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/// Calculate fee splits for primary sales/subscriptions
/// Returns: (creator_share, platform_share, ecosystem_share, holder_share)
pub fn calculate_primary_split(amount: u64) -> (u64, u64, u64, u64) {
    let creator_share = amount * 80 / 100;
    let platform_share = amount * 5 / 100;
    let ecosystem_share = amount * 3 / 100;
    let holder_share = amount - creator_share - platform_share - ecosystem_share; // 12%
    (creator_share, platform_share, ecosystem_share, holder_share)
}

/// Calculate ecosystem subscription distribution
/// Returns: (creator_pool_share, holder_pool_share, platform_share, ecosystem_share)
pub fn calculate_ecosystem_split(amount: u64) -> (u64, u64, u64, u64) {
    let platform_share = amount * 5 / 100;
    let ecosystem_share = amount * 3 / 100;
    let holder_share = amount * 12 / 100;
    let creator_share = amount - platform_share - ecosystem_share - holder_share; // 80%
    (creator_share, holder_share, platform_share, ecosystem_share)
}
