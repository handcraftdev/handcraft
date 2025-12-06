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
