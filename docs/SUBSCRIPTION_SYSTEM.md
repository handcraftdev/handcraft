# Handcraft Subscription System

## Overview

This document describes the subscription system that extends Handcraft's existing monetization with:
1. **Creator Patronage** - Users support creators directly, gain access to all creator content
2. **Ecosystem Subscription** - Users pay platform, gain access to all content platform-wide

Both systems integrate with the existing reward distribution pattern: **immediate push distribution + pull-based claims**.

---

## Current System Summary

### Existing Monetization

| Type | Access | Rewards | Duration |
|------|--------|---------|----------|
| **Content NFT** | Specific content | 12% holder rewards | Permanent |
| **Bundle NFT** | All bundle contents | 12% holder rewards | Permanent |
| **Content Rental** | Specific content | None | 6h / 1d / 7d |
| **Bundle Rental** | All bundle contents | None | 6h / 1d / 7d |

### Existing Fee Structure

**Primary Sale (Mint):**
```
Creator:     80%  → creator wallet
Platform:     5%  → treasury
Ecosystem:    3%  → ecosystem treasury
Holders:     12%  → ContentRewardPool / BundleRewardPool
─────────────────
Total:      100%
```

**Secondary Sale (Resale):**
```
Seller:      ~88% → seller wallet (remaining after fees)
Creator:     2-10% → creator wallet (configurable royalty)
Platform:     1%  → treasury
Ecosystem:    1%  → ecosystem treasury
Holders:      8%  → ContentRewardPool / BundleRewardPool
```

### Existing Reward Pattern

**Push Distribution (Immediate):**
```rust
// On every mint/sale, rewards are immediately distributed to the pool
reward_pool.add_rewards(holder_reward_amount);
// This updates: reward_per_share += (amount * PRECISION) / total_weight
```

**Pull-Based Claim:**
```rust
// Users claim their accumulated rewards anytime
pending = (nft_weight * reward_per_share - reward_debt) / PRECISION
// Transfer pending to user, update reward_debt
```

---

## New Subscription System

### Access Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                     ACCESS HIERARCHY                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Level 3: NFT Holder        → Owns specific content/bundle NFT  │
│           ├── Permanent access                                   │
│           └── Earns holder rewards (12% primary, 8% secondary)  │
│                                                                  │
│  Level 2: Creator Patron    → Active patron of creator          │
│           ├── Access to ALL creator's content (visibility ≤ 2)  │
│           ├── Creator-defined perks                              │
│           └── NO holder rewards (creator perks only)            │
│                                                                  │
│  Level 1: Ecosystem Sub     → Active ecosystem subscriber       │
│           ├── Access to ALL platform content (visibility ≤ 1)   │
│           └── NO holder rewards (access only)                   │
│                                                                  │
│  Level 0: Public            → Everyone                          │
│           └── Preview only (encrypted content gated)            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Content Visibility Levels

Creators set visibility per content:

| Level | Name | Who Can Access |
|-------|------|----------------|
| 0 | Public | Everyone (free content) |
| 1 | Ecosystem | Ecosystem subscribers + Patrons + NFT holders |
| 2 | Patron | Creator's patrons + NFT holders only |
| 3 | NFT Only | NFT holders only |

---

## Creator Patronage

### Concept

Users support specific creators via token streaming. In exchange:
- Access to ALL creator's content (visibility level ≤ 2)
- Creator-defined perks (early access, exclusive content, badges)
- Stream can be cancelled anytime with remaining balance refunded

### Fee Structure

```
Patron Payment (Streamed):
Creator:    100%  → streamed directly to creator wallet
─────────────────
Total:      100%

Note: No holder rewards from patronage.
Creators define custom perks for patrons instead.
```

### Accounts

```rust
/// Creator's patronage configuration
/// PDA: ["patron_config", creator]
pub struct CreatorPatronConfig {
    pub creator: Pubkey,
    pub is_active: bool,
    pub tiers: [PatronTier; 3],          // Bronze, Silver, Gold
    pub default_content_visibility: u8,   // Default for new content
    pub total_patrons: u64,
    pub total_earned: u64,                // All-time earnings
    pub created_at: i64,
    pub updated_at: i64,
}

pub struct PatronTier {
    pub name: String,                     // "Bronze", "Silver", "Gold"
    pub price_per_day: u64,               // Lamports per day
    pub perks_cid: String,                // IPFS metadata describing perks
    pub is_active: bool,
}

/// User's patronage to a specific creator
/// PDA: ["patron_sub", subscriber, creator]
pub struct CreatorPatronSubscription {
    pub subscriber: Pubkey,
    pub creator: Pubkey,
    pub tier: u8,                         // 0=Bronze, 1=Silver, 2=Gold
    pub stream_account: Pubkey,           // Streamflow stream address
    pub deposited_amount: u64,            // Total deposited
    pub started_at: i64,
    pub is_active: bool,
}
```

### Instructions

```rust
// Creator setup
init_patron_config(tiers: [PatronTier; 3], default_visibility: u8)
update_patron_config(tiers?: [PatronTier; 3], default_visibility?: u8)
close_patron_config()

// User subscription
subscribe_patron(creator: Pubkey, tier: u8, deposit_amount: u64)
  → Creates Streamflow stream: subscriber → creator
  → Creates CreatorPatronSubscription PDA
  → Stream rate = tier.price_per_day

topup_patron(creator: Pubkey, amount: u64)
  → Tops up existing Streamflow stream

upgrade_patron_tier(creator: Pubkey, new_tier: u8, additional_deposit: u64)
  → Cancels old stream, creates new stream at higher rate

cancel_patron(creator: Pubkey)
  → Cancels Streamflow stream (refunds remaining balance)
  → Closes CreatorPatronSubscription PDA

// Creator withdrawal (from Streamflow)
withdraw_patron_earnings()
  → Creator withdraws accumulated stream balance
```

### Reward Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                  PATRON REWARD FLOW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User subscribes (deposits 10 SOL for ~1 month):                │
│                                                                  │
│  ┌──────────┐    Stream (0.33 SOL/day)    ┌──────────┐         │
│  │   User   │ ─────────────────────────►  │ Creator  │         │
│  │  Wallet  │                             │  Wallet  │         │
│  └──────────┘                             └──────────┘         │
│       │                                                         │
│       │ Cancel anytime                                          │
│       ▼                                                         │
│  Remaining balance refunded to user                             │
│                                                                  │
│  NO holder rewards - this is direct creator support             │
│  Creator defines custom perks in tier metadata                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Ecosystem Subscription

### Concept

Users pay platform for access to ALL content (respecting visibility settings). Revenue is distributed to creators based on their mint share (total NFTs minted for their content).

### Fee Structure

```
Ecosystem Payment (Streamed):
Treasury:   100%  → streamed to ecosystem treasury
─────────────────
Total:      100%

Distribution from Treasury (periodic):
Creators:   100%  → distributed by mint share
```

### Mint Share Formula

```
creator_mint_share = creator_total_mints / platform_total_mints
creator_payout = distributable_pool * creator_mint_share
```

Where `creator_total_mints` = all content NFTs + bundle NFTs minted for that creator.

### Accounts

```rust
/// Global ecosystem subscription configuration
/// PDA: ["ecosystem_sub_config"]
pub struct EcosystemSubConfig {
    pub authority: Pubkey,                // Platform admin
    pub price_per_day: u64,               // Lamports per day
    pub treasury: Pubkey,                 // Stream destination
    pub total_subscribers: u64,
    pub total_collected: u64,             // All-time revenue
    pub total_distributed: u64,           // All-time distributed
    pub last_distribution_at: i64,
    pub is_active: bool,
}

/// User's ecosystem subscription
/// PDA: ["ecosystem_sub", subscriber]
pub struct EcosystemSubscription {
    pub subscriber: Pubkey,
    pub stream_account: Pubkey,           // Streamflow stream address
    pub deposited_amount: u64,
    pub started_at: i64,
    pub is_active: bool,
}

/// Creator's share tracking for ecosystem distribution
/// PDA: ["creator_mint_share", creator]
pub struct CreatorMintShare {
    pub creator: Pubkey,
    pub total_mints: u64,                 // Content + Bundle NFTs minted
    pub reward_debt: u128,                // For pull-based claiming
    pub total_claimed: u64,               // All-time claimed
    pub last_claim_at: i64,
}

/// Ecosystem distribution pool (follows existing pattern)
/// PDA: ["ecosystem_distribution_pool"]
pub struct EcosystemDistributionPool {
    pub reward_per_share: u128,           // Per mint share (scaled by PRECISION)
    pub total_mints: u64,                 // Platform-wide total
    pub total_deposited: u64,
    pub total_claimed: u64,
    pub last_distribution_at: i64,
}
```

### Instructions

```rust
// Admin setup
init_ecosystem_sub_config(price_per_day: u64, treasury: Pubkey)
update_ecosystem_sub_config(price_per_day?: u64)

// User subscription
subscribe_ecosystem(deposit_amount: u64)
  → Creates Streamflow stream: subscriber → treasury
  → Creates EcosystemSubscription PDA

topup_ecosystem(amount: u64)
  → Tops up existing stream

cancel_ecosystem()
  → Cancels stream (refunds remaining)
  → Closes subscription PDA

// Distribution (permissionless - anyone can call)
distribute_ecosystem_revenue()
  → Reads treasury balance (new funds since last distribution)
  → Updates reward_per_share: += (new_funds * PRECISION) / total_mints
  → Updates last_distribution_at

// Creator claim (pull-based)
claim_ecosystem_payout()
  → Calculates pending: (creator_mints * reward_per_share - reward_debt) / PRECISION
  → Transfers pending to creator
  → Updates reward_debt
```

### Reward Flow

```
┌─────────────────────────────────────────────────────────────────┐
│               ECOSYSTEM SUBSCRIPTION REWARD FLOW                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  STEP 1: Users Subscribe (Continuous Streaming)                 │
│                                                                  │
│  ┌──────────┐     Stream      ┌──────────┐                      │
│  │  User A  │ ──────────────► │          │                      │
│  └──────────┘                 │ Treasury │                      │
│  ┌──────────┐     Stream      │   PDA    │                      │
│  │  User B  │ ──────────────► │          │                      │
│  └──────────┘                 └────┬─────┘                      │
│  ┌──────────┐     Stream           │                            │
│  │  User C  │ ──────────────►      │                            │
│  └──────────┘                      │                            │
│                                    │                            │
│  ────────────────────────────────────────────────────────────── │
│                                    │                            │
│  STEP 2: Distribution (Push - Immediate)                        │
│                                    │                            │
│  Anyone calls distribute_ecosystem_revenue()                    │
│                                    │                            │
│                                    ▼                            │
│                        ┌─────────────────────┐                  │
│                        │ EcosystemDistPool   │                  │
│                        │ reward_per_share += │                  │
│                        │ (amount * PRECISION)│                  │
│                        │   / total_mints     │                  │
│                        └─────────────────────┘                  │
│                                                                  │
│  ────────────────────────────────────────────────────────────── │
│                                                                  │
│  STEP 3: Creator Claims (Pull-Based)                            │
│                                                                  │
│  ┌─────────────────┐     claim_ecosystem_payout()              │
│  │ Creator A       │ ──────────────────────────►               │
│  │ 1000 mints (10%)│     pending = 1000 * rps - debt          │
│  └─────────────────┘                                           │
│                                                                  │
│  ┌─────────────────┐     claim_ecosystem_payout()              │
│  │ Creator B       │ ──────────────────────────►               │
│  │ 5000 mints (50%)│     pending = 5000 * rps - debt          │
│  └─────────────────┘                                           │
│                                                                  │
│  ┌─────────────────┐     claim_ecosystem_payout()              │
│  │ Creator C       │ ──────────────────────────►               │
│  │ 4000 mints (40%)│     pending = 4000 * rps - debt          │
│  └─────────────────┘                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Mint Share Tracking

To enable ecosystem distribution by mint share, we track mints per creator:

### Update Existing Mint Instructions

```rust
// In mint_nft (content) - add after successful mint:
creator_mint_share.total_mints += 1;
ecosystem_distribution_pool.total_mints += 1;

// In mint_bundle_nft - add after successful mint:
creator_mint_share.total_mints += 1;
ecosystem_distribution_pool.total_mints += 1;
```

### Account Initialization

```rust
// CreatorMintShare is created on first content registration
// or lazily on first mint if not exists

// EcosystemDistributionPool is singleton, created by admin
```

---

## Clockwork Auto-Renewal

### Concept

Clockwork threads monitor stream balances and auto-topup when low (if user has enabled and has wallet funds).

### Thread Setup

```rust
/// Auto-renewal configuration per subscription
/// PDA: ["auto_renewal", subscription_pda]
pub struct AutoRenewalConfig {
    pub subscription: Pubkey,             // Patron or Ecosystem sub
    pub subscription_type: u8,            // 0=Patron, 1=Ecosystem
    pub thread_id: Pubkey,                // Clockwork thread
    pub topup_amount: u64,                // Amount to topup when triggered
    pub min_balance_days: u8,             // Trigger when balance < X days
    pub is_active: bool,
}
```

### Clockwork Thread

```rust
Thread {
    trigger: Trigger::Cron {
        schedule: "0 0 * * *",            // Daily check
        skippable: true,
    },
    instructions: vec![
        check_and_topup_instruction(subscription_pda)
    ],
}

// check_and_topup logic:
fn check_and_topup(subscription: Pubkey) {
    let stream_balance = streamflow.get_balance(subscription.stream_account);
    let daily_rate = get_daily_rate(subscription);
    let days_remaining = stream_balance / daily_rate;

    if days_remaining < config.min_balance_days {
        let user_balance = get_balance(subscription.subscriber);
        if user_balance >= config.topup_amount {
            streamflow.topup(subscription.stream_account, config.topup_amount);
        }
    }
}
```

---

## Streamflow Integration

### Overview

[Streamflow](https://streamflow.finance/) provides token streaming on Solana.

### Key Operations

```typescript
import { StreamflowSolana } from "@streamflow/stream";

// Create stream
const stream = await client.create({
    recipient: creatorWallet,
    mint: NATIVE_MINT,                    // SOL
    depositedAmount: 10 * LAMPORTS_PER_SOL,
    period: 1,                            // 1 second periods
    cliff: 0,
    amountPerPeriod: pricePerSecond,
    name: "Patron: CreatorName",
    canTopup: true,
    cancelableBySender: true,
    cancelableByRecipient: false,
});

// Topup stream
await client.topup({
    id: streamId,
    amount: 5 * LAMPORTS_PER_SOL,
});

// Cancel stream (refunds remaining to sender)
await client.cancel({
    id: streamId,
});

// Withdraw accumulated (recipient)
await client.withdraw({
    id: streamId,
    amount: withdrawAmount,
});
```

---

## Complete Reward Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        COMPLETE REWARD FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         PAYMENT SOURCES                              │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │                                                                      │    │
│  │   NFT Mint          NFT Resale         Patron Sub      Ecosystem Sub │    │
│  │   (Content/Bundle)  (Secondary)        (Streaming)     (Streaming)   │    │
│  │        │                 │                  │               │        │    │
│  └────────┼─────────────────┼──────────────────┼───────────────┼────────┘    │
│           │                 │                  │               │             │
│           ▼                 ▼                  ▼               ▼             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      IMMEDIATE DISTRIBUTION (PUSH)                   │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │                                                                      │    │
│  │   ┌──────────────────────────────────────────────────────────────┐  │    │
│  │   │ NFT MINT SPLIT                                                │  │    │
│  │   │ ├── Creator (80%)      → creator wallet                      │  │    │
│  │   │ ├── Platform (5%)      → platform treasury                   │  │    │
│  │   │ ├── Ecosystem (3%)     → ecosystem treasury                  │  │    │
│  │   │ └── Holders (12%)      → ContentRewardPool.add_rewards()     │  │    │
│  │   │                           BundleRewardPool.add_rewards()     │  │    │
│  │   └──────────────────────────────────────────────────────────────┘  │    │
│  │                                                                      │    │
│  │   ┌──────────────────────────────────────────────────────────────┐  │    │
│  │   │ NFT RESALE SPLIT                                              │  │    │
│  │   │ ├── Seller (~88%)      → seller wallet                       │  │    │
│  │   │ ├── Creator (2-10%)    → creator wallet                      │  │    │
│  │   │ ├── Platform (1%)      → platform treasury                   │  │    │
│  │   │ ├── Ecosystem (1%)     → ecosystem treasury                  │  │    │
│  │   │ └── Holders (8%)       → RewardPool.sync_secondary_royalties()│  │    │
│  │   └──────────────────────────────────────────────────────────────┘  │    │
│  │                                                                      │    │
│  │   ┌──────────────────────────────────────────────────────────────┐  │    │
│  │   │ PATRON SUBSCRIPTION                                           │  │    │
│  │   │ └── Creator (100%)     → streamed to creator wallet          │  │    │
│  │   │     (No holder rewards - creator defines custom perks)       │  │    │
│  │   └──────────────────────────────────────────────────────────────┘  │    │
│  │                                                                      │    │
│  │   ┌──────────────────────────────────────────────────────────────┐  │    │
│  │   │ ECOSYSTEM SUBSCRIPTION                                        │  │    │
│  │   │ └── Treasury (100%)    → streamed to treasury PDA            │  │    │
│  │   │     Then: distribute_ecosystem_revenue()                     │  │    │
│  │   │     └── EcosystemDistPool.reward_per_share +=                │  │    │
│  │   │         (new_funds * PRECISION) / total_mints                │  │    │
│  │   └──────────────────────────────────────────────────────────────┘  │    │
│  │                                                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         REWARD POOLS                                 │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │                                                                      │    │
│  │  ┌───────────────────┐  ┌───────────────────┐  ┌──────────────────┐ │    │
│  │  │ ContentRewardPool │  │ BundleRewardPool  │  │ EcosystemDistPool│ │    │
│  │  │ (per content)     │  │ (per bundle)      │  │ (singleton)      │ │    │
│  │  ├───────────────────┤  ├───────────────────┤  ├──────────────────┤ │    │
│  │  │ reward_per_share  │  │ reward_per_share  │  │ reward_per_share │ │    │
│  │  │ total_weight      │  │ total_weight      │  │ total_mints      │ │    │
│  │  │ total_deposited   │  │ total_deposited   │  │ total_deposited  │ │    │
│  │  │ total_claimed     │  │ total_claimed     │  │ total_claimed    │ │    │
│  │  └───────────────────┘  └───────────────────┘  └──────────────────┘ │    │
│  │                                                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      PULL-BASED CLAIMS                               │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │                                                                      │    │
│  │   NFT Holder Claims:                                                 │    │
│  │   ┌─────────────────────────────────────────────────────────────┐   │    │
│  │   │ claim_content_rewards(content, nft_asset)                    │   │    │
│  │   │ pending = (nft_weight * pool.rps - nft_state.debt) / PRECISION│   │    │
│  │   │ Transfer pending → holder wallet                             │   │    │
│  │   │ nft_state.debt = nft_weight * pool.rps                       │   │    │
│  │   └─────────────────────────────────────────────────────────────┘   │    │
│  │                                                                      │    │
│  │   ┌─────────────────────────────────────────────────────────────┐   │    │
│  │   │ claim_bundle_rewards(bundle, nft_asset)                      │   │    │
│  │   │ pending = (nft_weight * pool.rps - nft_state.debt) / PRECISION│   │    │
│  │   │ Transfer pending → holder wallet                             │   │    │
│  │   │ nft_state.debt = nft_weight * pool.rps                       │   │    │
│  │   └─────────────────────────────────────────────────────────────┘   │    │
│  │                                                                      │    │
│  │   Creator Claims (Ecosystem Distribution):                          │    │
│  │   ┌─────────────────────────────────────────────────────────────┐   │    │
│  │   │ claim_ecosystem_payout()                                     │   │    │
│  │   │ pending = (creator_mints * pool.rps - share.debt) / PRECISION│   │    │
│  │   │ Transfer pending → creator wallet                            │   │    │
│  │   │ share.debt = creator_mints * pool.rps                        │   │    │
│  │   └─────────────────────────────────────────────────────────────┘   │    │
│  │                                                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Access Check Flow

```rust
fn check_content_access(user: Pubkey, content: Pubkey) -> AccessResult {
    let content_entry = fetch_content(content);
    let visibility = content_entry.visibility_level;

    // Level 3: Anyone can access public content
    if visibility == 0 {
        return AccessResult::Granted(AccessType::Public);
    }

    // Check 1: Is user the creator?
    if content_entry.creator == user {
        return AccessResult::Granted(AccessType::Creator);
    }

    // Check 2: Does user own content NFT?
    if user_owns_content_nft(user, content) {
        return AccessResult::Granted(AccessType::NftOwner);
    }

    // Check 3: Does user own bundle NFT containing this content?
    if user_owns_bundle_with_content(user, content) {
        return AccessResult::Granted(AccessType::BundleOwner);
    }

    // Check 4: Has active rental?
    if user_has_active_rental(user, content) {
        return AccessResult::Granted(AccessType::Renter);
    }

    // Level 3 content: NFT only
    if visibility == 3 {
        return AccessResult::Denied;
    }

    // Check 5: Is active patron of creator? (visibility <= 2)
    if visibility <= 2 && user_is_patron(user, content_entry.creator) {
        return AccessResult::Granted(AccessType::Patron);
    }

    // Check 6: Is active ecosystem subscriber? (visibility <= 1)
    if visibility <= 1 && user_is_ecosystem_subscriber(user) {
        return AccessResult::Granted(AccessType::EcosystemSub);
    }

    AccessResult::Denied
}
```

---

## Implementation Phases

### Phase 1: Foundation
- [ ] Add `visibility_level` field to Content account
- [ ] Add `visibility_level` field to Bundle account
- [ ] Create CreatorMintShare account
- [ ] Create EcosystemDistributionPool account
- [ ] Update mint instructions to track mint counts
- [ ] Research Streamflow SDK integration
- [ ] Research Clockwork SDK integration

### Phase 2: Creator Patronage (Program)
- [ ] CreatorPatronConfig account + instructions
- [ ] CreatorPatronSubscription account
- [ ] Streamflow integration for patron streams
- [ ] `init_patron_config` instruction
- [ ] `subscribe_patron` instruction
- [ ] `topup_patron` instruction
- [ ] `cancel_patron` instruction
- [ ] Unit tests

### Phase 3: Creator Patronage (SDK + Web)
- [ ] SDK: Patron instruction builders
- [ ] SDK: Patron account fetchers
- [ ] Web: PatronConfigModal (creator setup)
- [ ] Web: PatronSubscribeModal (user subscribes)
- [ ] Web: PatronDashboard (creator view)
- [ ] Web: User subscription management
- [ ] Web: Access control integration

### Phase 4: Ecosystem Subscription (Program)
- [ ] EcosystemSubConfig account + instructions
- [ ] EcosystemSubscription account
- [ ] Streamflow integration for ecosystem streams
- [ ] `init_ecosystem_sub_config` instruction
- [ ] `subscribe_ecosystem` instruction
- [ ] `topup_ecosystem` instruction
- [ ] `cancel_ecosystem` instruction
- [ ] `distribute_ecosystem_revenue` instruction
- [ ] `claim_ecosystem_payout` instruction
- [ ] Unit tests

### Phase 5: Ecosystem Subscription (SDK + Web)
- [ ] SDK: Ecosystem instruction builders
- [ ] SDK: Ecosystem account fetchers
- [ ] Web: EcosystemSubscribeModal
- [ ] Web: Ecosystem earnings in creator dashboard
- [ ] Web: Subscribe button in header
- [ ] Web: Full access control integration

### Phase 6: Clockwork Auto-Renewal
- [ ] AutoRenewalConfig account
- [ ] Clockwork thread creation
- [ ] Auto-topup logic
- [ ] SDK: Automation management
- [ ] Web: Auto-renewal toggle

### Phase 7: Polish & Testing
- [ ] E2E testing all flows
- [ ] Edge cases handling
- [ ] Off-chain notifications (expiring soon, etc.)
- [ ] Documentation updates

---

## Summary Tables

### Revenue Sources & Distribution

| Source | Creator | Platform | Ecosystem | NFT Holders | Notes |
|--------|---------|----------|-----------|-------------|-------|
| Content NFT Mint | 80% | 5% | 3% | 12% | Holder rewards to content pool |
| Bundle NFT Mint | 80% | 5% | 3% | 12% | Holder rewards to bundle pool |
| Content NFT Resale | 2-10% | 1% | 1% | 8% | Creator royalty configurable |
| Bundle NFT Resale | 2-10% | 1% | 1% | 8% | Creator royalty configurable |
| Content Rental | 80% | 5% | 3% | 12% | Same as mint |
| Bundle Rental | 80% | 5% | 3% | 12% | Same as mint |
| Creator Patron | 100% | 0% | 0% | 0% | Streamed directly |
| Ecosystem Sub | 0% | 0% | 100%* | 0% | *Distributed by mint share |

### Access Types & Rewards

| Access Type | Rewards | Duration | Cost |
|-------------|---------|----------|------|
| Content NFT Owner | 12% primary, 8% secondary | Permanent | Mint price |
| Bundle NFT Owner | 12% primary, 8% secondary | Permanent | Mint price |
| Creator Patron | Creator perks only | Subscription | Stream rate |
| Ecosystem Sub | None | Subscription | Stream rate |
| Renter | None | 6h/1d/7d | Rental fee |

---

*Last updated: December 12, 2025*
