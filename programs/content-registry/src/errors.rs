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
    #[msg("Invalid account pairs for batch claim")]
    InvalidAccountPairs,
    #[msg("Invalid account data")]
    InvalidAccountData,

    // Lifecycle hook errors
    #[msg("Invalid lifecycle hook caller - must be Metaplex Core")]
    InvalidHookCaller,
    #[msg("Invalid asset for transfer hook")]
    InvalidAsset,
    #[msg("Sender does not own this NFT")]
    SenderNotOwner,

    // Claim-time verification errors
    #[msg("Invalid NFT asset - not a valid Metaplex Core asset")]
    InvalidNftAsset,
    #[msg("NFT does not belong to the content's collection")]
    NftNotInCollection,
    #[msg("Claimer does not own this NFT")]
    ClaimerNotOwner,
    #[msg("No NFTs provided for verification")]
    NoNftsProvided,
    #[msg("Invalid NftRewardState PDA")]
    InvalidNftRewardState,

    // Rental errors
    #[msg("Renting is not active for this content")]
    RentingNotActive,
    #[msg("Rent fee below minimum allowed")]
    RentFeeTooLow,
    #[msg("Rent period must be between 1 hour and 365 days")]
    InvalidRentPeriod,
    #[msg("Rental has expired")]
    RentalExpired,
    #[msg("Rental NFT cannot be transferred")]
    RentalNonTransferable,
    #[msg("Invalid RentEntry PDA")]
    InvalidRentEntry,
    #[msg("Rent config already exists for this content")]
    RentConfigExists,
}
