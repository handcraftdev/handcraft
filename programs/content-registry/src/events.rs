use anchor_lang::prelude::*;

#[event]
pub struct TipEvent {
    pub content: Pubkey,
    pub tipper: Pubkey,
    pub creator: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct NftMintEvent {
    pub content: Pubkey,
    pub buyer: Pubkey,
    pub creator: Pubkey,
    pub edition_number: u64,
    pub price: u64,
    pub timestamp: i64,
    pub nft_asset: Pubkey,
}

#[event]
pub struct ClaimRewardEvent {
    pub holder: Pubkey,
    pub content: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct BatchClaimEvent {
    pub holder: Pubkey,
    pub total_amount: u64,
    pub num_contents: u32,
    pub timestamp: i64,
}

#[event]
pub struct NftTransferSyncEvent {
    pub content: Pubkey,
    pub sender: Pubkey,
    pub receiver: Pubkey,
    pub sender_claimed: u64,
    pub timestamp: i64,
}

#[event]
pub struct VerifiedClaimEvent {
    pub holder: Pubkey,
    pub content: Pubkey,
    pub verified_nft_count: u64,
    pub stored_nft_count: u64,
    pub amount_claimed: u64,
    pub timestamp: i64,
}

/// Emitted when secondary sale royalties are synced into the reward pool
/// This happens automatically when anyone claims rewards
#[event]
pub struct SecondaryRoyaltySyncEvent {
    /// Content whose reward pool received secondary royalties
    pub content: Pubkey,
    /// Amount of secondary royalties synced (lamports)
    pub amount: u64,
    /// New reward_per_share after sync
    pub new_reward_per_share: u128,
    /// Timestamp of sync
    pub timestamp: i64,
}

/// Emitted when content is rented
#[event]
pub struct ContentRentedEvent {
    /// Content being rented
    pub content: Pubkey,
    /// Renter's wallet
    pub renter: Pubkey,
    /// Creator receiving payment
    pub creator: Pubkey,
    /// The rental NFT asset
    pub nft_asset: Pubkey,
    /// Rent fee paid (lamports)
    pub fee_paid: u64,
    /// Rental start timestamp
    pub rented_at: i64,
    /// Rental expiry timestamp
    pub expires_at: i64,
}

// ============================================================================
// REWARD ACCOUNTING EVENTS
// ============================================================================

/// Fee split breakdown for primary sales/subscriptions
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug)]
pub struct FeeSplit {
    /// Creator share (lamports)
    pub creator_share: u64,
    /// Platform share (lamports)
    pub platform_share: u64,
    /// Ecosystem treasury share (lamports)
    pub ecosystem_share: u64,
    /// Holder reward pool share (lamports)
    pub holder_share: u64,
}

/// Emitted when rewards are deposited to a pool (primary sales, subscriptions)
#[event]
pub struct RewardDepositEvent {
    /// Type of pool: "content", "bundle", "creator_patron", "global_holder", "creator_dist"
    pub pool_type: String,
    /// Pool identifier (content/bundle/creator pubkey, or empty string for global pools)
    pub pool_id: Pubkey,
    /// Amount deposited to pool (lamports)
    pub amount: u64,
    /// Source transaction type: "mint", "patron_subscription", "ecosystem_subscription", "secondary_royalty"
    pub source_type: String,
    /// Source identifier (buyer/subscriber wallet, or secondary sale asset)
    pub source: Pubkey,
    /// Creator involved (if applicable)
    pub creator: Option<Pubkey>,
    /// Content or bundle involved (if applicable)
    pub content_or_bundle: Option<Pubkey>,
    /// New reward_per_share after deposit
    pub new_reward_per_share: u128,
    /// Fee split breakdown (if applicable - zero values if not a primary transaction)
    pub fee_split: Option<FeeSplit>,
    /// Timestamp
    pub timestamp: i64,
}

/// Emitted when epoch-based lazy distribution occurs
#[event]
pub struct RewardDistributionEvent {
    /// Distribution type: "patron_pool", "ecosystem_pools"
    pub distribution_type: String,
    /// Pool identifier (creator pubkey for patron, empty for ecosystem)
    pub pool_id: Option<Pubkey>,
    /// Total amount distributed from streaming treasury (lamports)
    pub total_amount: u64,
    /// Amount to creator (for patron distributions only)
    pub creator_amount: Option<u64>,
    /// Amount to platform treasury
    pub platform_amount: u64,
    /// Amount to ecosystem treasury
    pub ecosystem_amount: u64,
    /// Amount to holder pool
    pub holder_pool_amount: u64,
    /// Amount to creator distribution pool (for ecosystem distributions only)
    pub creator_dist_pool_amount: Option<u64>,
    /// Epoch timestamp
    pub epoch_timestamp: i64,
    /// Timestamp
    pub timestamp: i64,
}

/// Emitted when a user claims rewards from a pool
#[event]
pub struct RewardClaimEvent {
    /// Pool type: "content", "bundle", "patron", "global_holder", "creator_dist"
    pub pool_type: String,
    /// Pool identifier (content/bundle/creator pubkey, or empty for global)
    pub pool_id: Option<Pubkey>,
    /// Claimer wallet
    pub claimer: Pubkey,
    /// Amount claimed (lamports)
    pub amount: u64,
    /// NFT asset (if holder claim)
    pub nft_asset: Option<Pubkey>,
    /// NFT weight (if holder claim)
    pub nft_weight: Option<u16>,
    /// Creator weight (if creator ecosystem payout)
    pub creator_weight: Option<u64>,
    /// Reward debt before claim
    pub debt_before: u128,
    /// Reward debt after claim
    pub debt_after: u128,
    /// Timestamp
    pub timestamp: i64,
}

/// Emitted when rewards are transferred between accounts (e.g., on NFT transfer)
#[event]
pub struct RewardTransferEvent {
    /// Pool type affected: "content", "bundle"
    pub pool_type: String,
    /// Pool identifier (content or bundle pubkey)
    pub pool_id: Pubkey,
    /// Sender wallet
    pub sender: Pubkey,
    /// Receiver wallet
    pub receiver: Pubkey,
    /// NFT asset transferred
    pub nft_asset: Pubkey,
    /// Amount sender claimed before transfer (lamports)
    pub sender_claimed: u64,
    /// Sender's new debt after transfer
    pub sender_new_debt: u128,
    /// Receiver's new debt after transfer
    pub receiver_new_debt: u128,
    /// Timestamp
    pub timestamp: i64,
}

/// Emitted when a subscription is created (patron or ecosystem)
#[event]
pub struct SubscriptionCreatedEvent {
    /// Subscription type: "patron_membership", "patron_subscription", "ecosystem"
    pub subscription_type: String,
    /// Subscriber wallet
    pub subscriber: Pubkey,
    /// Creator (for patron subscriptions)
    pub creator: Option<Pubkey>,
    /// Monthly price (lamports)
    pub price: u64,
    /// Streamflow stream ID
    pub stream_id: Pubkey,
    /// Started timestamp
    pub started_at: i64,
}

/// Emitted when a subscription is cancelled
#[event]
pub struct SubscriptionCancelledEvent {
    /// Subscription type: "patron_membership", "patron_subscription", "ecosystem"
    pub subscription_type: String,
    /// Subscriber wallet
    pub subscriber: Pubkey,
    /// Creator (for patron subscriptions)
    pub creator: Option<Pubkey>,
    /// Streamflow stream ID
    pub stream_id: Pubkey,
    /// Cancelled timestamp
    pub cancelled_at: i64,
}
