pub mod item_common;
pub mod content;
// NOTE: cid_registry removed - CID uniqueness enforced by ContentEntry PDA seed
pub mod mint_config;
pub mod ecosystem_config;
pub mod reward_pool;
// NOTE: collection removed - collection_asset stored directly in ContentEntry
pub mod rent;
pub mod bundle;
pub mod rarity;
pub mod subscription;
pub mod profile;

pub use item_common::{ItemType, MintableItem};
pub use content::{ContentEntry, ContentType};
// NOTE: CidRegistry removed - use hash_cid from crate::utils if needed
pub use mint_config::{
    MintConfig, PaymentCurrency, MINT_CONFIG_SEED,
    FIXED_CREATOR_ROYALTY_BPS, MIN_PRICE_LAMPORTS, MIN_PRICE_USDC,
};
pub use ecosystem_config::{
    EcosystemConfig, ECOSYSTEM_CONFIG_SEED,
    PLATFORM_FEE_PRIMARY_BPS, ECOSYSTEM_FEE_PRIMARY_BPS, CREATOR_FEE_PRIMARY_BPS,
    HOLDER_REWARD_PRIMARY_BPS,
    PLATFORM_FEE_SECONDARY_BPS, ECOSYSTEM_FEE_SECONDARY_BPS, HOLDER_REWARD_SECONDARY_BPS,
};
pub use reward_pool::{
    // Legacy types (kept for migration)
    ContentRewardPool, WalletContentState,
    CONTENT_REWARD_POOL_SEED, WALLET_CONTENT_STATE_SEED,
    // Unified types
    RewardPool, WalletItemState,
    REWARD_POOL_SEED, WALLET_ITEM_STATE_SEED,
    PRECISION,
};
// NOTE: ContentCollection removed - collection_asset stored in ContentEntry
pub use rent::{
    RentConfig, RentTier,
    RENT_CONFIG_SEED,
    RENT_PERIOD_6H, RENT_PERIOD_1D, RENT_PERIOD_7D,
    MIN_RENT_FEE_LAMPORTS,
};
// NOTE: RentEntry removed - rental expiry stored in NFT Attributes
pub use bundle::{
    Bundle, BundleItem, BundleType,
    BUNDLE_SEED, BUNDLE_ITEM_SEED, MAX_BUNDLE_ITEMS,
};
// NOTE: BundleCollection, BundleRentEntry removed - data stored in Bundle and NFT Attributes
pub use rarity::Rarity;
// Subscription system types (Phase 1)
pub use subscription::{
    // Unified NFT reward tracking
    UnifiedNftRewardState, UNIFIED_NFT_REWARD_STATE_SEED,
    // Creator patron pool (per creator)
    CreatorPatronPool, CREATOR_PATRON_POOL_SEED, CREATOR_PATRON_TREASURY_SEED,
    // Global pools (singletons)
    GlobalHolderPool, GLOBAL_HOLDER_POOL_SEED,
    CreatorDistPool, CREATOR_DIST_POOL_SEED,
    EcosystemEpochState, ECOSYSTEM_EPOCH_STATE_SEED,
    // Creator weight (per creator)
    CreatorWeight, CREATOR_WEIGHT_SEED,
    // Streaming treasury
    ECOSYSTEM_STREAMING_TREASURY_SEED,
    // Patron config and subscription
    CreatorPatronConfig, CREATOR_PATRON_CONFIG_SEED,
    CreatorPatronSubscription, CREATOR_PATRON_SUB_SEED, PatronTier,
    // Ecosystem subscription
    EcosystemSubConfig, ECOSYSTEM_SUB_CONFIG_SEED,
    EcosystemSubscription, ECOSYSTEM_SUB_SEED,
    // Constants
    DEFAULT_EPOCH_DURATION, TEST_EPOCH_DURATION, SUBSCRIPTION_VALIDITY_PERIOD,
    // Helper functions
    calculate_primary_split, calculate_ecosystem_split,
};
pub use profile::{UserProfile, USER_PROFILE_SEED, MAX_USERNAME_LENGTH};
