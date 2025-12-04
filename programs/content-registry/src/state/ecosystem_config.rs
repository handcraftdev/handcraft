use anchor_lang::prelude::*;

pub const ECOSYSTEM_CONFIG_SEED: &[u8] = b"ecosystem";

/// Fee percentages in basis points (100 = 1%)
/// Primary sale: Creator 80%, Platform 5%, Ecosystem 3%, Existing Holders 12%
pub const PLATFORM_FEE_PRIMARY_BPS: u16 = 500;   // 5%
pub const ECOSYSTEM_FEE_PRIMARY_BPS: u16 = 300;  // 3%
pub const CREATOR_FEE_PRIMARY_BPS: u16 = 8000;   // 80%
pub const HOLDER_REWARD_PRIMARY_BPS: u16 = 1200; // 12% - distributed to existing NFT holders

/// Secondary sale fixed fees (on top of creator royalty)
pub const PLATFORM_FEE_SECONDARY_BPS: u16 = 100; // 1%
pub const ECOSYSTEM_FEE_SECONDARY_BPS: u16 = 50; // 0.5%

/// Global ecosystem configuration
/// PDA seeds: ["ecosystem"]
/// Only one instance exists, controlled by admin
#[account]
#[derive(InitSpace)]
pub struct EcosystemConfig {
    /// Admin who can update ecosystem settings
    pub admin: Pubkey,
    /// Treasury wallet to receive ecosystem fees
    pub treasury: Pubkey,
    /// USDC mint address (for USDC payments)
    pub usdc_mint: Pubkey,
    /// Total fees collected (SOL, in lamports)
    pub total_fees_sol: u64,
    /// Total fees collected (USDC, in base units)
    pub total_fees_usdc: u64,
    /// Total NFTs minted across all content
    pub total_nfts_minted: u64,
    /// Whether the ecosystem is paused (emergency stop)
    pub is_paused: bool,
    /// Timestamp when config was created
    pub created_at: i64,
}

impl EcosystemConfig {
    /// Calculate fee split for primary sale
    /// Returns (creator_amount, platform_amount, ecosystem_amount, holder_reward_amount)
    /// holder_reward_amount is distributed equally among existing NFT holders
    /// If no existing holders, holder_reward goes to creator
    pub fn calculate_primary_split(price: u64) -> (u64, u64, u64, u64) {
        if price == 0 {
            return (0, 0, 0, 0);
        }

        let platform_amount = (price as u128 * PLATFORM_FEE_PRIMARY_BPS as u128 / 10000) as u64;
        let ecosystem_amount = (price as u128 * ECOSYSTEM_FEE_PRIMARY_BPS as u128 / 10000) as u64;
        let holder_reward_amount = (price as u128 * HOLDER_REWARD_PRIMARY_BPS as u128 / 10000) as u64;
        let creator_amount = price - platform_amount - ecosystem_amount - holder_reward_amount;

        (creator_amount, platform_amount, ecosystem_amount, holder_reward_amount)
    }

    /// Calculate fee split for secondary sale
    /// Returns (creator_royalty, platform_amount, ecosystem_amount, seller_amount)
    pub fn calculate_secondary_split(price: u64, creator_royalty_bps: u16) -> (u64, u64, u64, u64) {
        if price == 0 {
            return (0, 0, 0, 0);
        }

        let creator_royalty = (price as u128 * creator_royalty_bps as u128 / 10000) as u64;
        let platform_amount = (price as u128 * PLATFORM_FEE_SECONDARY_BPS as u128 / 10000) as u64;
        let ecosystem_amount = (price as u128 * ECOSYSTEM_FEE_SECONDARY_BPS as u128 / 10000) as u64;
        let seller_amount = price - creator_royalty - platform_amount - ecosystem_amount;

        (creator_royalty, platform_amount, ecosystem_amount, seller_amount)
    }
}
