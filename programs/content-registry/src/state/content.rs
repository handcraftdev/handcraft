use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct ContentEntry {
    pub creator: Pubkey,
    #[max_len(64)]
    pub content_cid: String,
    #[max_len(64)]
    pub metadata_cid: String,
    pub content_type: ContentType,
    pub tips_received: u64,
    pub created_at: i64,
    // NFT mint tracking
    pub is_locked: bool,       // Locked after first mint (no delete/edit metadata)
    pub minted_count: u64,     // Number of NFTs successfully minted (used for edition numbering)
    pub pending_count: u64,    // Number of pending VRF mints (for max_supply checking)
    // Access control
    pub is_encrypted: bool,    // Whether content is encrypted (requires NFT to access)
    #[max_len(64)]
    pub preview_cid: String,   // Preview CID for non-owners (empty if not gated)
    #[max_len(64)]
    pub encryption_meta_cid: String, // Encryption metadata CID (empty if not encrypted)
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
