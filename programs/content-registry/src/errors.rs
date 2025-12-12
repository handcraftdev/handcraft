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

    // Bundle errors
    #[msg("Bundle is not active")]
    BundleNotActive,
    #[msg("Bundle must be empty to delete")]
    BundleNotEmpty,
    #[msg("Bundle item limit reached (max 1000)")]
    BundleItemLimitReached,
    #[msg("Only the content creator can add to bundles")]
    NotContentCreator,
    #[msg("Bundle is locked after first NFT mint")]
    BundleLocked,
    #[msg("Bundle mint configuration already exists")]
    BundleMintConfigExists,
    #[msg("Bundle mint configuration not found")]
    BundleMintConfigNotFound,
    #[msg("Bundle rent configuration already exists")]
    BundleRentConfigExists,
    #[msg("Invalid BundleCollection PDA")]
    InvalidBundleCollection,
    #[msg("Invalid BundleRewardPool PDA")]
    InvalidBundleRewardPool,
    #[msg("Invalid BundleNftRewardState PDA")]
    InvalidBundleNftRewardState,
    #[msg("Invalid BundleRentEntry PDA")]
    InvalidBundleRentEntry,
    #[msg("Bundle does not match")]
    BundleMismatch,

    // Randomness/Rarity errors
    #[msg("Randomness has already been revealed")]
    RandomnessAlreadyRevealed,
    #[msg("Randomness not yet resolved")]
    RandomnessNotResolved,
    #[msg("Invalid randomness account")]
    InvalidRandomnessAccount,
    #[msg("NFT rarity already revealed")]
    RarityAlreadyRevealed,
    #[msg("Pending mint request not found")]
    PendingMintNotFound,
    #[msg("Invalid NftRarity PDA")]
    InvalidNftRarity,
    #[msg("Cannot cancel pending mint yet - must wait at least 10 minutes")]
    CancelTooEarly,
    #[msg("Randomness already fulfilled for this request")]
    AlreadyFulfilled,
    #[msg("Randomness not yet available - wait for oracle callback")]
    RandomnessNotAvailable,
    #[msg("VRF request failed")]
    VrfRequestFailed,
    #[msg("Invalid ORAO client account")]
    InvalidOraoClient,
    #[msg("Fallback claim too early - must wait for timeout")]
    FallbackTooEarly,
    #[msg("Mint request not yet fulfilled")]
    NotFulfilled,

    // Migration errors
    #[msg("Only the content creator can perform this action")]
    NotCreator,
    #[msg("Only the ecosystem admin can perform this action")]
    NotAdmin,

    // Cleanup errors
    #[msg("Invalid state - account should not exist or has wrong data")]
    InvalidState,

    // Subscription system errors
    #[msg("Invalid NFT type - expected content NFT but got bundle NFT or vice versa")]
    InvalidNftType,
    #[msg("Invalid patron config - at least one tier must be enabled")]
    InvalidPatronConfig,
    #[msg("Patron config is not active")]
    PatronConfigInactive,
    #[msg("Selected tier is not available")]
    TierNotAvailable,
    #[msg("Ecosystem subscription is not active")]
    EcosystemSubInactive,
    #[msg("Invalid ecosystem subscription price")]
    InvalidEcosystemSubPrice,
    #[msg("Subscription required for this content")]
    SubscriptionRequired,
    #[msg("Invalid input value")]
    InvalidInput,
}

// Alias for backward compatibility
pub use ContentRegistryError as ContentError;
