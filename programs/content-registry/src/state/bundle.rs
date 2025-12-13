use anchor_lang::prelude::*;
use crate::state::rent::{RentTier, RENT_PERIOD_6H, RENT_PERIOD_1D, RENT_PERIOD_7D, MIN_RENT_FEE_LAMPORTS};
use crate::state::mint_config::{FIXED_CREATOR_ROYALTY_BPS, MIN_PRICE_LAMPORTS};
use crate::state::reward_pool::PRECISION;

// Seeds for PDA derivation
pub const BUNDLE_SEED: &[u8] = b"bundle";
pub const BUNDLE_ITEM_SEED: &[u8] = b"bundle_item";

// Bundle mint/rent related seeds
pub const BUNDLE_MINT_CONFIG_SEED: &[u8] = b"bundle_mint_config";
pub const BUNDLE_RENT_CONFIG_SEED: &[u8] = b"bundle_rent_config";
pub const BUNDLE_COLLECTION_SEED: &[u8] = b"bundle_collection";
pub const BUNDLE_REWARD_POOL_SEED: &[u8] = b"bundle_reward_pool";
// NOTE: BUNDLE_NFT_REWARD_STATE_SEED and BUNDLE_NFT_RARITY_SEED removed
// Bundle NFT state is now stored in UnifiedNftRewardState
pub const BUNDLE_RENT_ENTRY_SEED: &[u8] = b"bundle_rent_entry";
pub const BUNDLE_WALLET_STATE_SEED: &[u8] = b"bundle_wallet";

// Maximum items per bundle
pub const MAX_BUNDLE_ITEMS: u16 = 1000;

/// Bundle types - defines the semantics of the collection
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum BundleType {
    // Entertainment bundles
    Album,         // Music album (ordered tracks)
    Series,        // TV series (seasons/episodes)
    Playlist,      // User-curated collection (any order)

    // Educational bundles
    Course,        // Learning content (ordered lessons)

    // Publication bundles
    Newsletter,    // Recurring posts (chronological)
    Collection,    // Photo/art collection (any order)

    // Product bundles
    ProductPack,   // Assets/software sold together
}

/// Bundle account - stores bundle metadata reference and stats
#[account]
#[derive(InitSpace)]
pub struct Bundle {
    /// Creator of the bundle
    pub creator: Pubkey,

    /// Unique bundle identifier (e.g., slug or CID-based)
    #[max_len(64)]
    pub bundle_id: String,

    /// IPFS CID pointing to bundle metadata JSON
    #[max_len(64)]
    pub metadata_cid: String,

    /// Type of bundle (determines semantics)
    pub bundle_type: BundleType,

    /// Number of items in the bundle
    pub item_count: u16,

    /// Whether the bundle is active (visible/purchasable)
    pub is_active: bool,

    /// Timestamp of creation
    pub created_at: i64,

    /// Timestamp of last update
    pub updated_at: i64,

    /// Number of NFTs successfully minted for this bundle
    pub minted_count: u64,

    /// Number of pending VRF mints (for max_supply checking)
    pub pending_count: u64,

    /// Whether bundle is locked (becomes true after first mint)
    pub is_locked: bool,

    /// Visibility level for access control (4-tier model, default: 1)
    /// Level 0: Public - anyone can access (free content, samples, previews)
    /// Level 1: Ecosystem - ecosystem sub OR creator sub OR NFT/Rental
    /// Level 2: Subscriber - creator sub OR NFT/Rental (ecosystem sub NOT enough)
    /// Level 3: NFT Only - ONLY NFT owners or renters (subscriptions don't grant access)
    pub visibility_level: u8,
}

/// BundleItem account - links content to a bundle with ordering
#[account]
#[derive(InitSpace)]
pub struct BundleItem {
    /// Reference to the Bundle account
    pub bundle: Pubkey,

    /// Reference to the ContentEntry account
    pub content: Pubkey,

    /// Position within the bundle (0-indexed)
    /// Used for ordered bundles like albums, courses
    pub position: u16,

    /// Timestamp when item was added
    pub added_at: i64,
}

impl Bundle {
    /// Calculate space needed for Bundle account
    pub fn space() -> usize {
        8 + // discriminator
        32 + // creator
        4 + 64 + // bundle_id (string with length prefix)
        4 + 64 + // metadata_cid (string with length prefix)
        1 + // bundle_type
        2 + // item_count
        1 + // is_active
        8 + // created_at
        8 + // updated_at
        8 + // minted_count
        8 + // pending_count
        1 + // is_locked
        1   // visibility_level
    }
}

impl BundleItem {
    /// Calculate space needed for BundleItem account
    pub fn space() -> usize {
        8 + // discriminator
        32 + // bundle
        32 + // content
        2 + // position
        8   // added_at
    }
}

// ============================================================================
// BUNDLE MINT/RENT STATE ACCOUNTS
// ============================================================================

/// Bundle mint configuration (mirrors MintConfig for content)
/// PDA seeds: ["bundle_mint_config", bundle_pda]
#[account]
#[derive(InitSpace)]
pub struct BundleMintConfig {
    /// The bundle this config belongs to
    pub bundle: Pubkey,
    /// Creator who owns this config
    pub creator: Pubkey,
    /// Price per NFT in lamports (minimum 0.001 SOL, free mint not allowed)
    pub price: u64,
    /// Maximum supply (None = unlimited)
    pub max_supply: Option<u64>,
    /// Creator royalty on secondary sales (basis points, e.g., 500 = 5%)
    pub creator_royalty_bps: u16,
    /// Whether minting is currently enabled
    pub is_active: bool,
    /// Timestamp when config was created
    pub created_at: i64,
    /// Timestamp when config was last updated
    pub updated_at: i64,
}

impl BundleMintConfig {
    /// Check if more NFTs can be minted
    pub fn can_mint(&self, current_minted: u64, pending: u64) -> bool {
        if !self.is_active {
            return false;
        }
        match self.max_supply {
            Some(max) => current_minted.saturating_add(pending) < max,
            None => true, // Unlimited
        }
    }

    /// Validate price (SOL only)
    /// Free minting is not allowed - price must be at least the minimum
    pub fn validate_price(price: u64) -> bool {
        // Free minting is not allowed
        price > 0 && price >= MIN_PRICE_LAMPORTS
    }

    /// Validate royalty is the fixed 4% rate
    pub fn validate_royalty(royalty_bps: u16) -> bool {
        royalty_bps == FIXED_CREATOR_ROYALTY_BPS
    }
}

/// Bundle rent configuration (mirrors RentConfig for content)
/// PDA seeds: ["bundle_rent_config", bundle_pda]
#[account]
#[derive(InitSpace)]
pub struct BundleRentConfig {
    /// The bundle this rent config belongs to
    pub bundle: Pubkey,
    /// Creator who can update rent settings
    pub creator: Pubkey,
    /// Rent fee for 6-hour access (lamports)
    pub rent_fee_6h: u64,
    /// Rent fee for 1-day access (lamports)
    pub rent_fee_1d: u64,
    /// Rent fee for 7-day access (lamports)
    pub rent_fee_7d: u64,
    /// Whether renting is currently enabled
    pub is_active: bool,
    /// Total number of times this bundle has been rented
    pub total_rentals: u64,
    /// Total fees collected from rentals (lamports)
    pub total_fees_collected: u64,
    /// Timestamp when config was created
    pub created_at: i64,
    /// Timestamp when config was last updated
    pub updated_at: i64,
}

impl BundleRentConfig {
    /// Validate rent fee (must meet minimum)
    pub fn validate_fee(fee: u64) -> bool {
        fee >= MIN_RENT_FEE_LAMPORTS
    }

    /// Get rent fee for a specific tier
    pub fn get_fee_for_tier(&self, tier: RentTier) -> u64 {
        match tier {
            RentTier::SixHours => self.rent_fee_6h,
            RentTier::OneDay => self.rent_fee_1d,
            RentTier::SevenDays => self.rent_fee_7d,
        }
    }

    /// Get rent period in seconds for a tier
    pub fn get_period_for_tier(tier: RentTier) -> i64 {
        match tier {
            RentTier::SixHours => RENT_PERIOD_6H,
            RentTier::OneDay => RENT_PERIOD_1D,
            RentTier::SevenDays => RENT_PERIOD_7D,
        }
    }
}

/// Bundle collection (mirrors ContentCollection)
/// Tracks the Metaplex Core Collection for bundle NFTs
/// PDA seeds: ["bundle_collection", bundle_pda]
#[account]
#[derive(InitSpace)]
pub struct BundleCollection {
    /// The bundle PDA this collection belongs to
    pub bundle: Pubkey,
    /// The Metaplex Core collection asset address
    pub collection_asset: Pubkey,
    /// The creator of the bundle/collection
    pub creator: Pubkey,
    /// Timestamp when collection was created
    pub created_at: i64,
}

/// Bundle reward pool (mirrors ContentRewardPool)
/// Per-bundle reward pool with rarity-weighted distribution
/// Secondary sale holder rewards split 50/50 between bundle holders and content holders
/// PDA seeds: ["bundle_reward_pool", bundle_pda]
#[account]
#[derive(InitSpace)]
pub struct BundleRewardPool {
    /// The bundle this pool belongs to
    pub bundle: Pubkey,
    /// Accumulated reward per weight unit (scaled by PRECISION)
    pub reward_per_share: u128,
    /// Total NFTs minted for this bundle
    pub total_nfts: u64,
    /// Total weight of all NFTs (sum of individual rarity weights)
    pub total_weight: u64,
    /// Total rewards ever deposited to this pool (lamports)
    pub total_deposited: u64,
    /// Total rewards claimed from this pool (lamports)
    pub total_claimed: u64,
    /// Pending content share from secondary sales (50% of holder rewards)
    /// Accumulated here until distributed to content pools via separate instruction
    pub pending_content_share: u64,
    /// Total content share distributed to content pools
    pub total_content_distributed: u64,
    /// Timestamp when pool was created
    pub created_at: i64,
}

impl BundleRewardPool {
    /// Add rewards to the pool and update reward_per_share
    pub fn add_rewards(&mut self, amount: u64) {
        if self.total_weight == 0 || amount == 0 {
            return;
        }
        self.reward_per_share += (amount as u128 * PRECISION) / self.total_weight as u128;
        self.total_deposited += amount;
    }

    /// Add an NFT with its weight
    pub fn add_nft(&mut self, weight: u16) {
        self.total_nfts += 1;
        self.total_weight += weight as u64;
    }

    /// Remove an NFT with its weight (on burn)
    pub fn remove_nft(&mut self, weight: u16) {
        self.total_nfts = self.total_nfts.saturating_sub(1);
        self.total_weight = self.total_weight.saturating_sub(weight as u64);
    }

    /// Check if pool has any NFTs
    pub fn has_nfts(&self) -> bool {
        self.total_nfts > 0
    }

    /// Sync secondary sale royalties with 50/50 split
    /// 50% goes to bundle holders (added to reward_per_share)
    /// 50% accumulated in pending_content_share for distribution to content pools
    /// Returns total new royalties synced
    pub fn sync_secondary_royalties(&mut self, current_lamports: u64, rent_lamports: u64) -> u64 {
        let expected_balance = rent_lamports
            .saturating_add(self.total_deposited)
            .saturating_sub(self.total_claimed)
            .saturating_add(self.pending_content_share);

        if current_lamports > expected_balance {
            let new_royalties = current_lamports - expected_balance;
            if new_royalties > 0 {
                // Split 50/50 between bundle holders and content holders
                let bundle_share = new_royalties / 2;
                let content_share = new_royalties - bundle_share; // Handles odd amounts

                // Add bundle share to pool (if there are holders)
                if self.total_weight > 0 && bundle_share > 0 {
                    self.reward_per_share += (bundle_share as u128 * PRECISION) / self.total_weight as u128;
                    self.total_deposited += bundle_share;
                }

                // Accumulate content share for later distribution
                self.pending_content_share += content_share;

                return new_royalties;
            }
        }
        0
    }

    /// Distribute pending content share to content pools
    /// Returns the amount distributed (resets pending_content_share to 0)
    pub fn take_pending_content_share(&mut self) -> u64 {
        let amount = self.pending_content_share;
        self.pending_content_share = 0;
        self.total_content_distributed += amount;
        amount
    }
}

/// Bundle wallet state (mirrors WalletContentState)
/// Tracks a wallet's NFT holdings for a specific bundle
/// PDA seeds: ["bundle_wallet", wallet, bundle_pda]
#[account]
#[derive(InitSpace)]
pub struct BundleWalletState {
    /// The wallet this state belongs to
    pub wallet: Pubkey,
    /// The bundle this state tracks
    pub bundle: Pubkey,
    /// Number of NFTs this wallet owns for this bundle
    pub nft_count: u64,
    /// Cumulative reward debt
    pub reward_debt: u128,
    /// Timestamp when first NFT was acquired
    pub created_at: i64,
    /// Timestamp of last update
    pub updated_at: i64,
}

impl BundleWalletState {
    /// Calculate pending rewards
    pub fn pending_reward(&self, current_reward_per_share: u128) -> u64 {
        let entitled = self.nft_count as u128 * current_reward_per_share;
        if entitled <= self.reward_debt {
            return 0;
        }
        ((entitled - self.reward_debt) / PRECISION) as u64
    }

    /// Add an NFT to this wallet's position
    pub fn add_nft(&mut self, current_rps: u128, timestamp: i64) {
        self.nft_count += 1;
        self.reward_debt += current_rps;
        self.updated_at = timestamp;
    }

    /// Remove an NFT from this wallet's position
    pub fn remove_nft(&mut self, current_rps: u128, timestamp: i64) {
        if self.nft_count == 0 {
            return;
        }
        self.reward_debt = self.reward_debt.saturating_sub(current_rps);
        self.nft_count -= 1;
        self.updated_at = timestamp;
    }
}

// NOTE: BundleNftRewardState and BundleNftRarity removed
// Use UnifiedNftRewardState from subscription.rs instead

/// Bundle rent entry (mirrors RentEntry)
/// Active rental tracking for bundle rentals
/// PDA seeds: ["bundle_rent_entry", nft_asset]
#[account]
#[derive(InitSpace)]
pub struct BundleRentEntry {
    /// The renter's wallet
    pub renter: Pubkey,
    /// The bundle being rented
    pub bundle: Pubkey,
    /// The rental NFT asset (Metaplex Core)
    pub nft_asset: Pubkey,
    /// Timestamp when rental started
    pub rented_at: i64,
    /// Timestamp when rental expires
    pub expires_at: i64,
    /// Whether this rental is still active
    pub is_active: bool,
    /// Rent fee paid (for record keeping)
    pub fee_paid: u64,
}

impl BundleRentEntry {
    /// Check if this rental has expired
    pub fn is_expired(&self, current_timestamp: i64) -> bool {
        current_timestamp >= self.expires_at
    }

    /// Get remaining rental time in seconds
    pub fn remaining_time(&self, current_timestamp: i64) -> i64 {
        if current_timestamp >= self.expires_at {
            0
        } else {
            self.expires_at - current_timestamp
        }
    }
}
