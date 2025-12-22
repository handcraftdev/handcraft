use anchor_lang::prelude::*;

pub const RENT_CONFIG_SEED: &[u8] = b"rent_config";
// NOTE: RENT_ENTRY_SEED removed - rental expiry is now stored in NFT Attributes plugin

/// Standard rental periods (in seconds)
pub const RENT_PERIOD_6H: i64 = 6 * 3600;      // 6 hours = 21,600 seconds
pub const RENT_PERIOD_1D: i64 = 24 * 3600;     // 1 day = 86,400 seconds
pub const RENT_PERIOD_7D: i64 = 7 * 24 * 3600; // 7 days = 604,800 seconds

/// Minimum rent fee: 0.001 SOL
pub const MIN_RENT_FEE_LAMPORTS: u64 = 1_000_000;

/// Rental tier selection (0 = 6h, 1 = 1d, 2 = 7d)
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum RentTier {
    SixHours = 0,
    OneDay = 1,
    SevenDays = 2,
}

impl RentTier {
    /// Get the period in seconds for this tier
    pub fn period_seconds(&self) -> i64 {
        match self {
            RentTier::SixHours => RENT_PERIOD_6H,
            RentTier::OneDay => RENT_PERIOD_1D,
            RentTier::SevenDays => RENT_PERIOD_7D,
        }
    }
}

/// Rent configuration for a content piece
/// Uses 3-tier pricing: 6 hours, 1 day, 7 days
/// PDA seeds: ["rent_config", content_pda]
#[account]
#[derive(InitSpace)]
pub struct RentConfig {
    /// The content this rent config belongs to
    pub content: Pubkey,
    /// Creator who can update rent settings
    pub creator: Pubkey,
    /// Rent fee for 6-hour access (lamports)
    pub rent_fee_6h: u64,
    /// Rent fee for 1-day access (lamports)
    pub rent_fee_1d: u64,
    /// Rent fee for 7-day access (lamports)
    pub rent_fee_7d: u64,
    /// Whether renting is currently enabled
    pub is_active: bool,
    /// Total number of times this content has been rented
    pub total_rentals: u64,
    /// Total fees collected from rentals (lamports)
    pub total_fees_collected: u64,
    /// Timestamp when config was created
    pub created_at: i64,
    /// Timestamp when config was last updated
    pub updated_at: i64,
}

impl RentConfig {
    /// Validate rent fee (must meet minimum)
    pub fn validate_fee(fee: u64) -> bool {
        fee >= MIN_RENT_FEE_LAMPORTS
    }

    /// Get rent fee for a specific tier
    pub fn get_fee_for_tier(&self, tier: RentTier) -> u64 {
        match tier {
            RentTier::SixHours => self.rent_fee_6h,
            RentTier::OneDay => self.rent_fee_1d,
            RentTier::SevenDays => self.rent_fee_7d,
        }
    }
}

// NOTE: RentEntry removed - rental expiry is now stored in NFT Attributes plugin
// Rental access is checked by reading the NFT's expires_at attribute
