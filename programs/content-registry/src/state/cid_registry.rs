use anchor_lang::prelude::*;

/// Seed prefix for CID registry PDAs
pub const CID_REGISTRY_SEED: &[u8] = b"cid";

/// Registry to ensure CID uniqueness across all content.
/// PDA seeds: ["cid", hash(content_cid)]
///
/// This prevents multiple users from claiming the same content CID.
/// The first user to register a CID becomes its permanent owner.
#[account]
#[derive(InitSpace)]
pub struct CidRegistry {
    /// The owner who registered this CID
    pub owner: Pubkey,
    /// The content PDA associated with this CID
    pub content_pda: Pubkey,
    /// When this CID was registered
    pub registered_at: i64,
}

/// Hash a CID string to derive PDA seeds.
/// Uses Solana's hash to create a 32-byte hash.
pub fn hash_cid(cid: &str) -> [u8; 32] {
    use solana_sha256_hasher::hash;
    let result = hash(cid.as_bytes());
    result.to_bytes()
}
