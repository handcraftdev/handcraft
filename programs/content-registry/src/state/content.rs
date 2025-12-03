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
