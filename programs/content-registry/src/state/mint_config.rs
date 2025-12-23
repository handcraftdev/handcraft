use anchor_lang::prelude::*;
use crate::state::item_common::ItemType;

pub const MINT_CONFIG_SEED: &[u8] = b"mint_config";

/// Fixed creator royalty percentage (basis points: 400 = 4%)
/// Per subscription design: fixed 4% creator royalty on secondary sales
pub const FIXED_CREATOR_ROYALTY_BPS: u16 = 400;

/// Minimum price in lamports (0.001 SOL)
/// Free minting is not allowed - all content must have a price
pub const MIN_PRICE_LAMPORTS: u64 = 1_000_000;
/// Minimum price in USDC (0.01 USDC with 6 decimals)
pub const MIN_PRICE_USDC: u64 = 10_000;

/// Payment currency options
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum PaymentCurrency {
    Sol,
    Usdc,
}

/// Unified mint configuration for content or bundle
/// PDA seeds: ["mint_config", item_pda] where item_pda is content or bundle
#[account]
#[derive(InitSpace)]
pub struct MintConfig {
    /// Type of item (Content or Bundle)
    pub item_type: ItemType,
    /// The content or bundle this config belongs to
    pub item: Pubkey,
    /// Creator who owns this config
    pub creator: Pubkey,
    /// Price per NFT in lamports (minimum 0.001 SOL, free mint not allowed)
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
    /// Free minting is not allowed - price must be at least the minimum
    pub fn validate_price(price: u64, currency: PaymentCurrency) -> bool {
        // Free minting is not allowed
        if price == 0 {
            return false;
        }
        match currency {
            PaymentCurrency::Sol => price >= MIN_PRICE_LAMPORTS,
            PaymentCurrency::Usdc => price >= MIN_PRICE_USDC,
        }
    }

    /// Validate royalty is the fixed 4% rate
    pub fn validate_royalty(royalty_bps: u16) -> bool {
        royalty_bps == FIXED_CREATOR_ROYALTY_BPS
    }
}
