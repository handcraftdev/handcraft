# Event Emission Guide for Reward Accounting

This document outlines where to add `emit!` calls in existing Rust instructions to enable comprehensive reward transaction tracking.

## Overview

The reward accounting system relies on on-chain events to build a complete transaction ledger. Events defined in `src/events.rs` should be emitted at key points in the instruction handlers.

## Critical Events to Emit

### 1. RewardDepositEvent
**When:** Rewards are deposited to any pool (primary sales, secondary royalties, subscriptions)

**Locations to add:**

#### a. Content/Bundle Mint Instructions
File: `src/contexts/mint.rs`, `src/contexts/bundle_mint.rs`, `src/contexts/simple_mint.rs`

```rust
// After depositing holder_share to ContentRewardPool/BundleRewardPool
emit!(RewardDepositEvent {
    pool_type: "content".to_string(), // or "bundle"
    pool_id: content.key(), // or bundle.key()
    amount: holder_share,
    source_type: "mint".to_string(),
    source: buyer.key(),
    creator: Some(creator.key()),
    content_or_bundle: Some(content.key()),
    new_reward_per_share: pool.reward_per_share,
    fee_split: Some(FeeSplit {
        creator_share,
        platform_share,
        ecosystem_share,
        holder_share,
    }),
    timestamp: Clock::get()?.unix_timestamp,
});
```

#### b. Secondary Royalty Sync
File: `src/contexts/rewards.rs` in claim instructions

```rust
// After calling pool.sync_secondary_royalties()
if new_royalties > 0 {
    emit!(RewardDepositEvent {
        pool_type: "content".to_string(),
        pool_id: content.key(),
        amount: new_royalties,
        source_type: "secondary_royalty".to_string(),
        source: nft_asset.key(), // The NFT that was sold
        creator: Some(content.creator),
        content_or_bundle: Some(content.key()),
        new_reward_per_share: pool.reward_per_share,
        fee_split: None, // Secondary sales don't split, already distributed by Metaplex
        timestamp: Clock::get()?.unix_timestamp,
    });
}
```

### 2. RewardDistributionEvent
**When:** Epoch-based lazy distribution occurs

**Locations to add:**

#### a. Patron Pool Distribution
File: `src/contexts/subscription_mint.rs` in `maybe_distribute_patron_pool()`
File: `src/contexts/subscription_pools.rs` in `handle_claim_patron_rewards()`

```rust
// After distributing streaming treasury
emit!(RewardDistributionEvent {
    distribution_type: "patron_pool".to_string(),
    pool_id: Some(creator.key()),
    total_amount: balance,
    creator_amount: Some(creator_share),
    platform_amount: platform_share,
    ecosystem_amount: ecosystem_share,
    holder_pool_amount: holder_share,
    creator_dist_pool_amount: None,
    epoch_timestamp: pool.last_distribution_at,
    timestamp: now,
});
```

#### b. Ecosystem Pools Distribution
File: `src/contexts/subscription_mint.rs` in `maybe_distribute_ecosystem_pools()`
File: `src/contexts/subscription_pools.rs` in `handle_claim_global_holder_rewards()` and `handle_claim_creator_ecosystem_payout()`

```rust
// After distributing to both GlobalHolderPool and CreatorDistPool
emit!(RewardDistributionEvent {
    distribution_type: "ecosystem_pools".to_string(),
    pool_id: None,
    total_amount: balance,
    creator_amount: None,
    platform_amount: platform_share,
    ecosystem_amount: ecosystem_share,
    holder_pool_amount: holder_share,
    creator_dist_pool_amount: Some(creator_share),
    epoch_timestamp: epoch_state.last_distribution_at,
    timestamp: now,
});
```

### 3. RewardClaimEvent
**When:** A user claims rewards from any pool

**Locations to add:**

#### a. Content/Bundle Pool Claims
File: `src/contexts/subscription_pools.rs` in `handle_claim_unified_content_rewards()` and `handle_claim_unified_bundle_rewards()`

```rust
// After successful claim transfer
emit!(RewardClaimEvent {
    pool_type: "content".to_string(), // or "bundle"
    pool_id: Some(content.key()),
    claimer: holder.key(),
    amount: pending as u64,
    nft_asset: Some(nft_asset.key()),
    nft_weight: Some(nft_state.weight),
    creator_weight: None,
    debt_before: nft_state.content_or_bundle_debt - weighted_rps + pending * PRECISION as u128,
    debt_after: nft_state.content_or_bundle_debt,
    timestamp: Clock::get()?.unix_timestamp,
});
```

#### b. Patron Pool Claims
File: `src/contexts/subscription_pools.rs` in `handle_claim_patron_rewards()`

```rust
// After successful claim
if pending > 0 {
    emit!(RewardClaimEvent {
        pool_type: "patron".to_string(),
        pool_id: Some(creator.key()),
        claimer: holder.key(),
        amount: pending as u64,
        nft_asset: Some(nft_asset.key()),
        nft_weight: Some(nft_state.weight),
        creator_weight: None,
        debt_before: weighted_rps - pending * PRECISION as u128,
        debt_after: nft_state.patron_debt,
        timestamp: now,
    });
}
```

#### c. Global Holder Pool Claims
File: `src/contexts/subscription_pools.rs` in `handle_claim_global_holder_rewards()`

```rust
// After successful claim
if pending > 0 {
    emit!(RewardClaimEvent {
        pool_type: "global_holder".to_string(),
        pool_id: None,
        claimer: holder.key(),
        amount: pending as u64,
        nft_asset: Some(nft_asset.key()),
        nft_weight: Some(nft_state.weight),
        creator_weight: None,
        debt_before: weighted_rps - pending * PRECISION as u128,
        debt_after: nft_state.global_debt,
        timestamp: now,
    });
}
```

#### d. Creator Ecosystem Payout Claims
File: `src/contexts/subscription_pools.rs` in `handle_claim_creator_ecosystem_payout()`

```rust
// After successful creator claim
if pending > 0 {
    emit!(RewardClaimEvent {
        pool_type: "creator_dist".to_string(),
        pool_id: None,
        claimer: creator.key(),
        amount: pending as u64,
        nft_asset: None,
        nft_weight: None,
        creator_weight: Some(creator_weight.total_weight),
        debt_before: weighted_rps - pending * PRECISION as u128,
        debt_after: creator_weight.reward_debt,
        timestamp: now,
    });
}
```

#### e. Legacy Claims (if still in use)
File: `src/contexts/rewards.rs` in claim handlers

```rust
// For ClaimContentRewards
emit!(RewardClaimEvent {
    pool_type: "content".to_string(),
    pool_id: Some(content_reward_pool.content),
    claimer: holder.key(),
    amount: pending,
    nft_asset: None, // Legacy doesn't track individual NFTs
    nft_weight: None,
    creator_weight: None,
    debt_before: wallet_content_state.reward_debt,
    debt_after: wallet_content_state.reward_debt + pending as u128 * PRECISION,
    timestamp: Clock::get()?.unix_timestamp,
});
```

### 4. RewardTransferEvent
**When:** NFT transfer causes reward debt transfer

**Location to add:**
File: Currently doesn't exist - would be in a future NFT transfer sync handler

```rust
// In handle_sync_nft_transfer() or similar
emit!(RewardTransferEvent {
    pool_type: "content".to_string(), // or "bundle"
    pool_id: content.key(),
    sender: sender.key(),
    receiver: receiver.key(),
    nft_asset: nft_asset.key(),
    sender_claimed: sender_claimed,
    sender_new_debt: sender_state.reward_debt,
    receiver_new_debt: receiver_state.reward_debt,
    timestamp: Clock::get()?.unix_timestamp,
});
```

### 5. SubscriptionCreatedEvent
**When:** A user subscribes (patron or ecosystem)

**Locations to add:**

#### a. Patron Subscription
File: `src/contexts/patron_subscription.rs` in `handle_subscribe_patron()`

```rust
// After creating subscription record
emit!(SubscriptionCreatedEvent {
    subscription_type: match tier {
        PatronTier::Membership => "patron_membership".to_string(),
        PatronTier::Subscription => "patron_subscription".to_string(),
    },
    subscriber: subscriber.key(),
    creator: Some(creator.key()),
    price: match tier {
        PatronTier::Membership => config.membership_price,
        PatronTier::Subscription => config.subscription_price,
    },
    stream_id,
    started_at: timestamp,
});
```

#### b. Ecosystem Subscription
File: `src/contexts/ecosystem_subscription.rs` in `handle_subscribe_ecosystem()`

```rust
// After creating subscription record
emit!(SubscriptionCreatedEvent {
    subscription_type: "ecosystem".to_string(),
    subscriber: subscriber.key(),
    creator: None,
    price: ecosystem_sub_config.price,
    stream_id,
    started_at: timestamp,
});
```

### 6. SubscriptionCancelledEvent
**When:** A subscription is cancelled

**Locations to add:**

#### a. Patron Subscription Cancellation
File: `src/contexts/patron_subscription.rs` in `handle_cancel_patron_subscription()`

```rust
// Before account is closed
let timestamp = Clock::get()?.unix_timestamp;
emit!(SubscriptionCancelledEvent {
    subscription_type: match patron_subscription.tier {
        PatronTier::Membership => "patron_membership".to_string(),
        PatronTier::Subscription => "patron_subscription".to_string(),
    },
    subscriber: subscriber.key(),
    creator: Some(creator.key()),
    stream_id: patron_subscription.stream_id,
    cancelled_at: timestamp,
});
```

#### b. Ecosystem Subscription Cancellation
File: `src/contexts/ecosystem_subscription.rs` in `handle_cancel_ecosystem_subscription()`

```rust
// Before account is closed
let timestamp = Clock::get()?.unix_timestamp;
emit!(SubscriptionCancelledEvent {
    subscription_type: "ecosystem".to_string(),
    subscriber: subscriber.key(),
    creator: None,
    stream_id: ecosystem_subscription.stream_id,
    cancelled_at: timestamp,
});
```

## Import Requirements

At the top of each file where events are emitted, add:

```rust
use crate::events::{
    RewardDepositEvent, RewardDistributionEvent, RewardClaimEvent,
    RewardTransferEvent, SubscriptionCreatedEvent, SubscriptionCancelledEvent,
    FeeSplit,
};
```

## Testing Recommendations

After adding event emissions:

1. Run unit tests to ensure events compile and emit correctly
2. Use Solana transaction inspector to verify events appear in transaction logs
3. Test webhook parsing to ensure all event fields are captured
4. Verify database records are created correctly from webhook data

## Notes

- Events are immutable and should never be emitted conditionally based on business logic - emit every occurrence
- Include all available context in events (even if redundant) for debugging and analytics
- Use consistent string values for enums (e.g., "content", not "Content")
- Timestamps should always use `Clock::get()?.unix_timestamp`
- Amount fields should always be in lamports (u64)
