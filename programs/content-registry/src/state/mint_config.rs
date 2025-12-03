use anchor_lang::prelude::*;

pub const MINT_CONFIG_SEED: &[u8] = b"mint_config";

/// Minimum creator royalty percentage (basis points: 200 = 2%)
pub const MIN_CREATOR_ROYALTY_BPS: u16 = 200;
/// Maximum creator royalty percentage (basis points: 1000 = 10%)
pub const MAX_CREATOR_ROYALTY_BPS: u16 = 1000;

/// Minimum price in lamports (0.001 SOL) - only if not free
pub const MIN_PRICE_LAMPORTS: u64 = 1_000_000;
/// Minimum price in USDC (0.01 USDC with 6 decimals)
pub const MIN_PRICE_USDC: u64 = 10_000;

/// Payment currency options
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum PaymentCurrency {
    Sol,
    Usdc,
}

/// Mint configuration for a content entry
/// PDA seeds: ["mint_config", content_pda]
#[account]
#[derive(InitSpace)]
pub struct MintConfig {
    /// The content entry this config belongs to
    pub content: Pubkey,
    /// Creator who owns this config
    pub creator: Pubkey,
    /// Price per NFT (0 = free mint)
    pub price: u64,
    /// Payment currency (SOL or USDC)
    pub currency: PaymentCurrency,
    /// Maximum supply (None = unlimited)
    pub max_supply: Option<u64>,
    /// Creator royalty on secondary sales (basis points, e.g., 500 = 5%)
    pub creator_royalty_bps: u16,
    /// Whether minting is currently enabled
    pub is_active: bool,
    /// Timestamp when config was created
    pub created_at: i64,
    /// Timestamp when config was last updated
    pub updated_at: i64,
}

impl MintConfig {
    /// Check if more NFTs can be minted
    pub fn can_mint(&self, current_minted: u64) -> bool {
        if !self.is_active {
            return false;
        }
        match self.max_supply {
            Some(max) => current_minted < max,
            None => true, // Unlimited
        }
    }

    /// Validate price based on currency
    pub fn validate_price(price: u64, currency: PaymentCurrency) -> bool {
        if price == 0 {
            return true; // Free mint allowed
        }
        match currency {
            PaymentCurrency::Sol => price >= MIN_PRICE_LAMPORTS,
            PaymentCurrency::Usdc => price >= MIN_PRICE_USDC,
        }
    }

    /// Validate royalty is within allowed range
    pub fn validate_royalty(royalty_bps: u16) -> bool {
        royalty_bps >= MIN_CREATOR_ROYALTY_BPS && royalty_bps <= MAX_CREATOR_ROYALTY_BPS
    }
}
