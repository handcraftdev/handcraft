use anchor_lang::prelude::*;

/// Optimized ContentEntry - stores only data needed for on-chain logic
/// Content metadata (CID, type) is stored in Metaplex Core collection/NFT metadata
/// PDA seeds: ["content", cid_hash] - uniqueness enforced by PDA derivation
#[account]
#[derive(InitSpace)]
pub struct ContentEntry {
    /// Creator/owner of the content
    pub creator: Pubkey,
    /// Metaplex Core collection asset for this content's NFTs
    pub collection_asset: Pubkey,
    /// Tips received (lamports)
    pub tips_received: u64,
    /// Locked after first mint (no delete/edit metadata)
    pub is_locked: bool,
    /// Number of NFTs successfully minted (used for edition numbering)
    pub minted_count: u64,
    /// Number of pending VRF mints (for max_supply checking)
    pub pending_count: u64,
    /// Whether content is encrypted (requires NFT to access)
    pub is_encrypted: bool,
    /// Preview CID for non-owners (empty if not gated)
    #[max_len(64)]
    pub preview_cid: String,
    /// Encryption metadata CID (empty if not encrypted)
    #[max_len(64)]
    pub encryption_meta_cid: String,
    /// Visibility level for access control (4-tier model, default: 1)
    /// Level 0: Public - anyone can access (free content, samples, previews)
    /// Level 1: Ecosystem - ecosystem sub OR creator sub OR NFT/Rental
    /// Level 2: Subscriber - creator sub OR NFT/Rental (ecosystem sub NOT enough)
    /// Level 3: NFT Only - ONLY NFT owners or renters (subscriptions don't grant access)
    pub visibility_level: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum ContentType {
    // Video domain (0-4)
    Video,
    Movie,
    Television,
    MusicVideo,
    Short,
    // Audio domain (5-7)
    Music,
    Podcast,
    Audiobook,
    // Image domain (8-9)
    Photo,
    Artwork,
    // Document domain (10-11)
    Book,
    Comic,
    // File domain (12-15)
    Asset,
    Game,
    Software,
    Dataset,
    // Text domain (16)
    Post,
}
