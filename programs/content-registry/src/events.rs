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
