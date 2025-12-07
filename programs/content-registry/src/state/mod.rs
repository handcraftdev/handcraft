pub mod content;
pub mod cid_registry;
pub mod mint_config;
pub mod ecosystem_config;
pub mod reward_pool;
pub mod collection;
pub mod rent;
pub mod bundle;
pub mod rarity;

pub use content::{ContentEntry, ContentType};
pub use cid_registry::{CidRegistry, CID_REGISTRY_SEED, hash_cid};
pub use mint_config::{
    MintConfig, PaymentCurrency, MINT_CONFIG_SEED,
    MIN_CREATOR_ROYALTY_BPS, MAX_CREATOR_ROYALTY_BPS,
    MIN_PRICE_LAMPORTS, MIN_PRICE_USDC,
};
pub use ecosystem_config::{
    EcosystemConfig, ECOSYSTEM_CONFIG_SEED,
    PLATFORM_FEE_PRIMARY_BPS, ECOSYSTEM_FEE_PRIMARY_BPS, CREATOR_FEE_PRIMARY_BPS,
    HOLDER_REWARD_PRIMARY_BPS,
    PLATFORM_FEE_SECONDARY_BPS, ECOSYSTEM_FEE_SECONDARY_BPS, HOLDER_REWARD_SECONDARY_BPS,
};
pub use reward_pool::{
    ContentRewardPool, WalletContentState,
    CONTENT_REWARD_POOL_SEED, WALLET_CONTENT_STATE_SEED, PRECISION,
    // Legacy exports for migration
    GlobalRewardPool, NftRewardState,
    GLOBAL_REWARD_POOL_SEED, NFT_REWARD_STATE_SEED,
};
pub use collection::{ContentCollection, CONTENT_COLLECTION_SEED};
pub use rent::{
    RentConfig, RentEntry, RentTier,
    RENT_CONFIG_SEED, RENT_ENTRY_SEED,
    RENT_PERIOD_6H, RENT_PERIOD_1D, RENT_PERIOD_7D,
    MIN_RENT_FEE_LAMPORTS,
};
pub use bundle::{
    Bundle, BundleItem, BundleType,
    BUNDLE_SEED, BUNDLE_ITEM_SEED, MAX_BUNDLE_ITEMS,
};
pub use rarity::{
    Rarity, NftRarity, ContentWeightedPool,
    NFT_RARITY_SEED, WEIGHT_PRECISION,
};
