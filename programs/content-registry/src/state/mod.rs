pub mod content;
pub mod cid_registry;
pub mod mint_config;
pub mod ecosystem_config;
pub mod reward_pool;

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
    PLATFORM_FEE_SECONDARY_BPS, ECOSYSTEM_FEE_SECONDARY_BPS,
};
pub use reward_pool::{
    ContentRewardPool, WalletContentState,
    CONTENT_REWARD_POOL_SEED, WALLET_CONTENT_STATE_SEED, PRECISION,
    // Legacy exports for migration
    GlobalRewardPool, NftRewardState,
    GLOBAL_REWARD_POOL_SEED, NFT_REWARD_STATE_SEED,
};
