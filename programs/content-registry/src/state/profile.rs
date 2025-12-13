use anchor_lang::prelude::*;

/// Seed for UserProfile PDA
pub const USER_PROFILE_SEED: &[u8] = b"user_profile";

/// Maximum username length (for character budget in collection names)
pub const MAX_USERNAME_LENGTH: usize = 20;

/// User profile storing username and settings
/// PDA seeds: ["user_profile", owner]
#[account]
#[derive(InitSpace)]
pub struct UserProfile {
    /// The wallet that owns this profile
    pub owner: Pubkey,
    /// User's display name (max 20 chars)
    #[max_len(20)]
    pub username: String,
    /// Timestamp when profile was created
    pub created_at: i64,
    /// Timestamp when profile was last updated
    pub updated_at: i64,
}

impl UserProfile {
    /// Validate username
    pub fn validate_username(username: &str) -> bool {
        !username.is_empty() && username.len() <= MAX_USERNAME_LENGTH
    }

    /// Truncate username if needed (shouldn't happen if validated)
    pub fn truncate_username(username: &str, max_len: usize) -> String {
        if username.len() <= max_len {
            username.to_string()
        } else {
            format!("{}...", &username[..max_len.saturating_sub(3)])
        }
    }
}
