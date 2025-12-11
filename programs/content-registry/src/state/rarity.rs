use anchor_lang::prelude::*;

/// Seed for NftRarity PDA
/// PDA seeds: ["nft_rarity", nft_asset_pubkey]
pub const NFT_RARITY_SEED: &[u8] = b"nft_rarity";

/// Rarity tiers with their probabilities and weights
/// Probability is in basis points (out of 10000)
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub enum Rarity {
    Common,      // 55% probability, weight 1
    Uncommon,    // 27% probability, weight 5
    Rare,        // 13% probability, weight 20
    Epic,        // 4% probability, weight 60
    Legendary,   // 1% probability, weight 120
}

impl Rarity {
    /// Get the weight multiplier for this rarity
    /// Used to calculate share of reward pool
    pub fn weight(&self) -> u16 {
        match self {
            Rarity::Common => 1,
            Rarity::Uncommon => 5,
            Rarity::Rare => 20,
            Rarity::Epic => 60,
            Rarity::Legendary => 120,
        }
    }

    /// Get rarity name for metadata
    pub fn name(&self) -> &'static str {
        match self {
            Rarity::Common => "Common",
            Rarity::Uncommon => "Uncommon",
            Rarity::Rare => "Rare",
            Rarity::Epic => "Epic",
            Rarity::Legendary => "Legendary",
        }
    }

    /// Determine rarity from a random u128 value
    /// Uses the full range of u128 for maximum precision
    ///
    /// Probability distribution:
    /// - Common:    55% (0 - 5500)
    /// - Uncommon:  27% (5500 - 8200)
    /// - Rare:      13% (8200 - 9500)
    /// - Epic:       4% (9500 - 9900)
    /// - Legendary:  1% (9900 - 10000)
    pub fn from_random(random_value: [u8; 32]) -> Self {
        // Convert first 4 bytes to u32 for simpler calculation
        let random_u32 = u32::from_le_bytes([
            random_value[0],
            random_value[1],
            random_value[2],
            random_value[3],
        ]);

        // Normalize to 0-9999 range (10000 possible values)
        let roll = (random_u32 % 10000) as u16;

        if roll < 5500 {
            Rarity::Common      // 0-5499: 55%
        } else if roll < 8200 {
            Rarity::Uncommon    // 5500-8199: 27%
        } else if roll < 9500 {
            Rarity::Rare        // 8200-9499: 13%
        } else if roll < 9900 {
            Rarity::Epic        // 9500-9899: 4%
        } else {
            Rarity::Legendary   // 9900-9999: 1%
        }
    }

    /// Convert to u8 for storage
    pub fn to_u8(&self) -> u8 {
        match self {
            Rarity::Common => 0,
            Rarity::Uncommon => 1,
            Rarity::Rare => 2,
            Rarity::Epic => 3,
            Rarity::Legendary => 4,
        }
    }

    /// Convert from u8
    pub fn from_u8(value: u8) -> Option<Self> {
        match value {
            0 => Some(Rarity::Common),
            1 => Some(Rarity::Uncommon),
            2 => Some(Rarity::Rare),
            3 => Some(Rarity::Epic),
            4 => Some(Rarity::Legendary),
            _ => None,
        }
    }
}

/// Per-NFT rarity state
/// Stores the rarity for each minted NFT
/// PDA seeds: ["nft_rarity", nft_asset_pubkey]
#[account]
#[derive(InitSpace)]
pub struct NftRarity {
    /// The NFT asset this rarity belongs to
    pub nft_asset: Pubkey,
    /// The content this NFT belongs to
    pub content: Pubkey,
    /// The rarity tier
    pub rarity: Rarity,
    /// Weight for reward calculation (cached for efficiency)
    pub weight: u16,
    /// The randomness account used to determine rarity
    pub randomness_account: Pubkey,
    /// Slot at which randomness was committed
    pub commit_slot: u64,
    /// Timestamp when rarity was revealed
    pub revealed_at: i64,
}

/// Extended content reward pool with weighted tracking
/// Tracks total_weight instead of just total_nfts for rarity-weighted rewards
#[account]
#[derive(InitSpace)]
pub struct ContentWeightedPool {
    /// The content this pool belongs to
    pub content: Pubkey,
    /// Accumulated reward per weight unit (scaled by PRECISION)
    /// Increases with each sale: reward_per_weight += (holder_reward * PRECISION) / total_weight
    pub reward_per_weight: u128,
    /// Total weight of all NFTs minted for this content
    /// Sum of all individual NFT weights based on rarity
    pub total_weight: u64,
    /// Total NFTs minted for this content
    pub total_nfts: u64,
    /// Total rewards ever deposited to this pool (lamports)
    pub total_deposited: u64,
    /// Total rewards claimed from this pool (lamports)
    pub total_claimed: u64,
    /// Timestamp when pool was created
    pub created_at: i64,
}

/// Precision factor for reward_per_weight calculations (1e12)
pub const WEIGHT_PRECISION: u128 = 1_000_000_000_000;

impl ContentWeightedPool {
    /// Add rewards to the pool and update reward_per_weight
    /// Should be called BEFORE adding new NFT weight
    pub fn add_rewards(&mut self, amount: u64) {
        if self.total_weight == 0 || amount == 0 {
            return;
        }
        self.reward_per_weight += (amount as u128 * WEIGHT_PRECISION) / self.total_weight as u128;
        self.total_deposited += amount;
    }

    /// Add an NFT's weight to the pool (call AFTER adding rewards)
    pub fn add_nft_weight(&mut self, weight: u16) {
        self.total_weight += weight as u64;
        self.total_nfts += 1;
    }

    /// Remove an NFT's weight from the pool (on burn)
    pub fn remove_nft_weight(&mut self, weight: u16) {
        self.total_weight = self.total_weight.saturating_sub(weight as u64);
        self.total_nfts = self.total_nfts.saturating_sub(1);
    }

    /// Calculate pending rewards for a given NFT weight and reward_debt
    pub fn pending_reward(&self, nft_weight: u16, reward_debt: u128) -> u64 {
        let entitled = nft_weight as u128 * self.reward_per_weight;
        if entitled <= reward_debt {
            return 0;
        }
        ((entitled - reward_debt) / WEIGHT_PRECISION) as u64
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rarity_distribution() {
        // Test that specific values map to expected rarities
        let common = Rarity::from_random([0; 32]);
        assert_eq!(common, Rarity::Common);

        // Value just under Uncommon threshold (5500)
        let mut bytes = [0u8; 32];
        bytes[0..4].copy_from_slice(&5499u32.to_le_bytes());
        assert_eq!(Rarity::from_random(bytes), Rarity::Common);

        // Value at Uncommon threshold
        bytes[0..4].copy_from_slice(&5500u32.to_le_bytes());
        assert_eq!(Rarity::from_random(bytes), Rarity::Uncommon);

        // Value at Legendary threshold (9900)
        bytes[0..4].copy_from_slice(&9900u32.to_le_bytes());
        assert_eq!(Rarity::from_random(bytes), Rarity::Legendary);
    }

    #[test]
    fn test_weights() {
        assert_eq!(Rarity::Common.weight(), 1);
        assert_eq!(Rarity::Uncommon.weight(), 5);
        assert_eq!(Rarity::Rare.weight(), 20);
        assert_eq!(Rarity::Epic.weight(), 60);
        assert_eq!(Rarity::Legendary.weight(), 120);
    }
}
