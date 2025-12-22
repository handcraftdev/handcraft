use solana_sha256_hasher::hash;

/// Hash a CID string to derive PDA seeds.
/// Uses Solana's hash to create a 32-byte hash.
pub fn hash_cid(cid: &str) -> [u8; 32] {
    let result = hash(cid.as_bytes());
    result.to_bytes()
}
