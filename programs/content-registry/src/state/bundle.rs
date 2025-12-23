use anchor_lang::prelude::*;
use crate::state::item_common::MintableItem;

// Seeds for PDA derivation
pub const BUNDLE_SEED: &[u8] = b"bundle";
pub const BUNDLE_ITEM_SEED: &[u8] = b"bundle_item";

// NOTE: Bundle now uses unified types from mint_config.rs, rent.rs, reward_pool.rs:
// - MintConfig with MINT_CONFIG_SEED (instead of BundleMintConfig)
// - RentConfig with RENT_CONFIG_SEED (instead of BundleRentConfig)
// - RewardPool with REWARD_POOL_SEED (instead of BundleRewardPool)
// - WalletItemState with WALLET_ITEM_STATE_SEED (instead of BundleWalletState)

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

/// Bundle account - stores bundle state for on-chain logic
/// Bundle metadata (CID, name, description) stored in Metaplex Core collection metadata
/// PDA seeds: ["bundle", bundle_id_hash]
#[account]
#[derive(InitSpace)]
pub struct Bundle {
    /// Creator of the bundle
    pub creator: Pubkey,

    /// Unique bundle identifier (e.g., slug or CID-based)
    #[max_len(64)]
    pub bundle_id: String,

    /// Metaplex Core collection asset for this bundle's NFTs
    pub collection_asset: Pubkey,

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
        32 + // collection_asset (Pubkey)
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
// MINTABLE ITEM TRAIT IMPLEMENTATION
// ============================================================================

impl MintableItem for Bundle {
    fn creator(&self) -> Pubkey {
        self.creator
    }

    fn collection_asset(&self) -> Pubkey {
        self.collection_asset
    }

    fn minted_count(&self) -> u64 {
        self.minted_count
    }

    fn pending_count(&self) -> u64 {
        self.pending_count
    }

    fn is_locked(&self) -> bool {
        self.is_locked
    }

    fn visibility_level(&self) -> u8 {
        self.visibility_level
    }

    fn set_minted_count(&mut self, count: u64) {
        self.minted_count = count;
    }

    fn set_pending_count(&mut self, count: u64) {
        self.pending_count = count;
    }

    fn set_is_locked(&mut self, locked: bool) {
        self.is_locked = locked;
    }
}
