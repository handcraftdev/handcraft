use anchor_lang::prelude::*;

#[error_code]
pub enum ContentRegistryError {
    #[msg("CID must be 64 characters or less")]
    CidTooLong,
    #[msg("Tip amount must be greater than 0")]
    InvalidTipAmount,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Content CID already registered by another user")]
    CidAlreadyRegistered,
    #[msg("CID hash does not match the provided CID")]
    CidHashMismatch,

    // NFT minting errors
    #[msg("Content is locked after first NFT mint")]
    ContentLocked,
    #[msg("Mint configuration already exists for this content")]
    MintConfigExists,
    #[msg("Mint configuration not found")]
    MintConfigNotFound,
    #[msg("Minting is not active for this content")]
    MintingNotActive,
    #[msg("Maximum supply reached")]
    MaxSupplyReached,
    #[msg("Price below minimum allowed")]
    PriceTooLow,
    #[msg("Royalty percentage out of allowed range (2-10%)")]
    InvalidRoyalty,
    #[msg("Insufficient payment amount")]
    InsufficientPayment,
    #[msg("Invalid payment currency")]
    InvalidCurrency,
    #[msg("Cannot increase supply after minting has started")]
    CannotIncreaseSupply,
    #[msg("Cannot set supply below already minted count")]
    SupplyBelowMinted,
    #[msg("Ecosystem is paused")]
    EcosystemPaused,
    #[msg("Ecosystem config already initialized")]
    EcosystemAlreadyInitialized,
    #[msg("Invalid USDC mint address")]
    InvalidUsdcMint,

    // Holder reward claim errors
    #[msg("NFT asset does not match the reward state")]
    NftMismatch,
    #[msg("Content does not match the reward pool")]
    ContentMismatch,
    #[msg("Holder does not own this NFT")]
    NotNftOwner,
    #[msg("No rewards available to claim")]
    NothingToClaim,
}
