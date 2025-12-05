use anchor_lang::prelude::*;

pub const CONTENT_COLLECTION_SEED: &[u8] = b"content_collection";

/// Tracks the Metaplex Core Collection associated with a content
/// Each content has one collection, and all NFTs minted from that content belong to it
#[account]
#[derive(InitSpace)]
pub struct ContentCollection {
    /// The content PDA this collection belongs to
    pub content: Pubkey,
    /// The Metaplex Core collection asset address
    pub collection_asset: Pubkey,
    /// The creator of the content/collection
    pub creator: Pubkey,
    /// Timestamp when collection was created
    pub created_at: i64,
}
