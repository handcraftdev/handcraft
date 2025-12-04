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
    pub minted_count: u64,     // Number of NFTs minted for this content
    // Access control
    pub is_encrypted: bool,    // Whether content is encrypted (requires NFT to access)
    #[max_len(64)]
    pub preview_cid: String,   // Preview CID for non-owners (empty if not gated)
    #[max_len(64)]
    pub encryption_meta_cid: String, // Encryption metadata CID (empty if not encrypted)
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum ContentType {
    // Video types
    Movie,
    TvSeries,
    MusicVideo,
    ShortVideo,
    GeneralVideo,
    // Book types
    Comic,
    GeneralBook,
    // Audio types
    Podcast,
    Audiobook,
    GeneralAudio,
    // Image types
    Photo,
    Art,
    GeneralImage,
}
