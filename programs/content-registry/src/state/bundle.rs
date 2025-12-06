use anchor_lang::prelude::*;

// Seeds for PDA derivation
pub const BUNDLE_SEED: &[u8] = b"bundle";
pub const BUNDLE_ITEM_SEED: &[u8] = b"bundle_item";

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
        8   // updated_at
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
