use anchor_lang::prelude::*;

// ============================================================================
// ITEM TYPE DISCRIMINATOR
// ============================================================================

/// Discriminator for Content vs Bundle in unified structs
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum ItemType {
    Content,
    Bundle,
}

// ============================================================================
// MINTABLE ITEM TRAIT
// ============================================================================

/// Common trait for items that can be minted as NFTs (Content or Bundle)
/// Provides unified interface for mint/rent/reward operations
pub trait MintableItem {
    /// Get the creator/owner of this item
    fn creator(&self) -> Pubkey;

    /// Get the Metaplex Core collection asset for this item's NFTs
    fn collection_asset(&self) -> Pubkey;

    /// Get the number of NFTs successfully minted
    fn minted_count(&self) -> u64;

    /// Get the number of pending VRF mints
    fn pending_count(&self) -> u64;

    /// Check if item is locked (after first mint)
    fn is_locked(&self) -> bool;

    /// Get visibility level for access control
    fn visibility_level(&self) -> u8;

    /// Set the minted count
    fn set_minted_count(&mut self, count: u64);

    /// Set the pending count
    fn set_pending_count(&mut self, count: u64);

    /// Set the locked status
    fn set_is_locked(&mut self, locked: bool);

    /// Increment minted count and lock if first mint
    fn increment_minted(&mut self) {
        let new_count = self.minted_count() + 1;
        self.set_minted_count(new_count);
        // Lock after first mint
        if new_count == 1 && !self.is_locked() {
            self.set_is_locked(true);
        }
    }

    /// Decrement pending count (after VRF completion)
    fn decrement_pending(&mut self) {
        let current = self.pending_count();
        if current > 0 {
            self.set_pending_count(current - 1);
        }
    }

    /// Increment pending count (for VRF mints)
    fn increment_pending(&mut self) {
        self.set_pending_count(self.pending_count() + 1);
    }
}
