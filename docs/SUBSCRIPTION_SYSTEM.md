# Handcraft Subscription System

## Overview

This document describes the subscription system that extends Handcraft's existing monetization with:
1. **Creator Patronage** - Users support creators directly, gain access to all creator content
2. **Ecosystem Subscription** - Users pay platform, gain access to all content platform-wide

Both systems:
- Use the same fee structure as NFT mints (Creator 80%, Platform 5%, Ecosystem 3%, Holders 12%)
- Integrate with the existing reward distribution pattern: **immediate push distribution + pull-based claims**
- Use **rarity-weighted** calculations for all distributions

---

## Design Principles

1. **No Public Content** - All content requires access (NFT, patron, ecosystem sub, or rental)
2. **Unified Fee Structure** - All revenue sources use the same 80/5/3/12 split
3. **Weight-Based Distribution** - All calculations use rarity weights, not counts
4. **Burn Reconciliation** - NFT burns reduce weight from all relevant pools
5. **Bundle → Content Rewards** - Bundle mints distribute to both bundle AND content NFT holders

---

## Current System Summary

### Existing Monetization

| Type | Access | Rewards | Duration |
|------|--------|---------|----------|
| **Content NFT** | Specific content | 12% holder rewards (weighted) | Permanent |
| **Bundle NFT** | All bundle contents | 12% holder rewards (weighted) | Permanent |
| **Content Rental** | Specific content | 12% holder rewards | 6h / 1d / 7d |
| **Bundle Rental** | All bundle contents | 12% holder rewards | 6h / 1d / 7d |

### Unified Fee Structure (All Sources)

**Primary Sale / Subscription Payment:**
```
Creator:     80%  → creator wallet (or distributed by weight for ecosystem sub)
Platform:     5%  → platform treasury
Ecosystem:    3%  → ecosystem treasury
Holders:     12%  → Reward pools (weighted by rarity)
─────────────────
Total:      100%
```

**Secondary Sale (Resale):**
```
Seller:      ~88% → seller wallet (remaining after fees)
Creator:     2-10% → creator wallet (configurable royalty)
Platform:     1%  → treasury
Ecosystem:    1%  → ecosystem treasury
Holders:      8%  → Reward pools (weighted by rarity)
```

### Rarity Weights

| Rarity | Weight | Probability |
|--------|--------|-------------|
| Common | 1 | 55% |
| Uncommon | 5 | 27% |
| Rare | 20 | 13% |
| Epic | 60 | 4% |
| Legendary | 120 | 1% |

**All pool calculations use weight, not count:**
```rust
reward_per_share += (amount * PRECISION) / total_weight
pending = (nft_weight * reward_per_share - reward_debt) / PRECISION
```

---

## Access Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                     ACCESS HIERARCHY                             │
│                     (No Public Content)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Level 3: NFT Holder        → Owns specific content/bundle NFT  │
│           ├── Permanent access                                   │
│           └── Earns holder rewards (12% weighted)               │
│                                                                  │
│  Level 2: Creator Patron    → Active patron of creator          │
│           ├── Access to ALL creator's content (visibility ≤ 2)  │
│           └── Earns holder rewards (12% weighted to all NFTs)   │
│                                                                  │
│  Level 1: Ecosystem Sub     → Active ecosystem subscriber       │
│           ├── Access to ALL platform content (visibility ≤ 1)   │
│           └── Earns holder rewards (12% weighted to all NFTs)   │
│                                                                  │
│  Level 0: Renter            → Has active rental                 │
│           └── Temporary access, no rewards                      │
│                                                                  │
│  No Access: Preview only (encrypted content gated)              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Content Visibility Levels

Creators set visibility per content:

| Level | Name | Who Can Access |
|-------|------|----------------|
| 1 | Ecosystem | Ecosystem subscribers + Patrons + NFT holders |
| 2 | Patron | Creator's patrons + NFT holders only |
| 3 | NFT Only | NFT holders only |

**Note:** No public (free) content. All content is gated.

---

## Creator Patronage

### Concept

Users support specific creators via token streaming. In exchange:
- Access to ALL creator's content (visibility level ≤ 2)
- Creator-defined perks (early access, exclusive content, badges)
- Stream can be cancelled anytime with remaining balance refunded

### Fee Structure (Same as NFT Mint)

```
Patron Payment Distribution:
Creator:     80%  → creator wallet
Platform:     5%  → platform treasury
Ecosystem:    3%  → ecosystem treasury
Holders:     12%  → All creator's content NFT pools (weighted)
─────────────────
Total:      100%
```

**Holder reward distribution for patronage:**
- 12% is distributed across ALL ContentRewardPools for creator's content
- Distribution is proportional to each content's total_weight
- This rewards all NFT holders of creator's content

### Accounts

```rust
/// Creator's patronage configuration
/// PDA: ["patron_config", creator]
pub struct CreatorPatronConfig {
    pub creator: Pubkey,
    pub is_active: bool,
    pub tiers: [PatronTier; 3],           // Bronze, Silver, Gold
    pub default_content_visibility: u8,    // Default for new content (1, 2, or 3)
    pub total_patrons: u64,
    pub total_weight: u64,                 // Sum of all creator's content weights
    pub total_earned: u64,                 // All-time creator earnings
    pub created_at: i64,
    pub updated_at: i64,
}

pub struct PatronTier {
    pub name: String,                      // "Bronze", "Silver", "Gold"
    pub price_per_day: u64,                // Lamports per day
    pub perks_cid: String,                 // IPFS metadata describing perks
    pub is_active: bool,
}

/// User's patronage to a specific creator
/// PDA: ["patron_sub", subscriber, creator]
pub struct CreatorPatronSubscription {
    pub subscriber: Pubkey,
    pub creator: Pubkey,
    pub tier: u8,                          // 0=Bronze, 1=Silver, 2=Gold
    pub stream_account: Pubkey,            // Streamflow stream address
    pub deposited_amount: u64,             // Total deposited
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
  → Creates Streamflow stream: subscriber → treasury PDA
  → Creates CreatorPatronSubscription PDA
  → Stream rate = tier.price_per_day

topup_patron(creator: Pubkey, amount: u64)
  → Tops up existing Streamflow stream

cancel_patron(creator: Pubkey)
  → Cancels Streamflow stream (refunds remaining balance)
  → Closes CreatorPatronSubscription PDA

// Distribution (called when treasury receives streamed funds)
distribute_patron_revenue(creator: Pubkey)
  → Reads treasury balance for this creator
  → Splits: 80% creator, 5% platform, 3% ecosystem, 12% holders
  → Distributes 12% to all creator's ContentRewardPools by weight
```

### Patron Reward Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     PATRON REWARD FLOW                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  User subscribes (streams 0.33 SOL/day to treasury):                    │
│                                                                          │
│  ┌──────────┐    Stream     ┌──────────┐    distribute_patron_revenue() │
│  │   User   │ ────────────► │ Treasury │ ─────────────────────────────► │
│  │  Wallet  │               │   PDA    │                                │
│  └──────────┘               └──────────┘                                │
│                                    │                                     │
│                                    ▼                                     │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                      FEE DISTRIBUTION                             │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │                                                                   │   │
│  │  Creator (80%)  ──────────────────────────►  Creator Wallet      │   │
│  │  Platform (5%)  ──────────────────────────►  Platform Treasury   │   │
│  │  Ecosystem (3%) ──────────────────────────►  Ecosystem Treasury  │   │
│  │  Holders (12%)  ──┬───────────────────────►  Content Pool A      │   │
│  │                   │  (by weight ratio)       (weight: 100)       │   │
│  │                   ├───────────────────────►  Content Pool B      │   │
│  │                   │                          (weight: 500)       │   │
│  │                   └───────────────────────►  Content Pool C      │   │
│  │                                              (weight: 200)       │   │
│  │                                                                   │   │
│  │  Pool A gets: 12% * (100 / 800) = 1.5%                           │   │
│  │  Pool B gets: 12% * (500 / 800) = 7.5%                           │   │
│  │  Pool C gets: 12% * (200 / 800) = 3.0%                           │   │
│  │                                                                   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Ecosystem Subscription

### Concept

Users pay platform for access to ALL content (respecting visibility settings). Revenue follows the same fee structure, with the creator portion distributed by mint weight.

### Fee Structure (Same as NFT Mint)

```
Ecosystem Payment Distribution:
Creators:    80%  → distributed by total_weight across all creators
Platform:     5%  → platform treasury
Ecosystem:    3%  → ecosystem treasury
Holders:     12%  → GlobalHolderRewardPool (all NFT holders by weight)
─────────────────
Total:      100%
```

### Weight-Based Distribution

**For Holders (12%):**
```
GlobalHolderRewardPool.reward_per_share += (holder_amount * PRECISION) / global_total_weight
```
- `global_total_weight` = sum of all NFT weights platform-wide
- Every NFT holder can claim based on their NFT's weight

**For Creators (80%):**
```
CreatorDistPool.reward_per_share += (creator_amount * PRECISION) / global_total_weight
```
- Each creator claims based on their `total_content_weight`
- `total_content_weight` = sum of weights of all NFTs minted for their content

### Accounts

```rust
/// Global ecosystem subscription configuration
/// PDA: ["ecosystem_sub_config"]
pub struct EcosystemSubConfig {
    pub authority: Pubkey,                 // Platform admin
    pub price_per_day: u64,                // Lamports per day
    pub treasury: Pubkey,                  // Stream destination
    pub total_subscribers: u64,
    pub total_collected: u64,              // All-time revenue
    pub total_distributed: u64,            // All-time distributed
    pub last_distribution_at: i64,
    pub is_active: bool,
}

/// User's ecosystem subscription
/// PDA: ["ecosystem_sub", subscriber]
pub struct EcosystemSubscription {
    pub subscriber: Pubkey,
    pub stream_account: Pubkey,            // Streamflow stream address
    pub deposited_amount: u64,
    pub started_at: i64,
    pub is_active: bool,
}

/// Global holder reward pool for ecosystem subscriptions
/// PDA: ["global_holder_pool"]
pub struct GlobalHolderRewardPool {
    pub reward_per_share: u128,            // Per weight unit (scaled by PRECISION)
    pub total_weight: u64,                 // Sum of all NFT weights platform-wide
    pub total_deposited: u64,
    pub total_claimed: u64,
}

/// Creator distribution pool for ecosystem subscriptions
/// PDA: ["creator_dist_pool"]
pub struct CreatorDistributionPool {
    pub reward_per_share: u128,            // Per weight unit (scaled by PRECISION)
    pub total_weight: u64,                 // Sum of all minted NFT weights platform-wide
    pub total_deposited: u64,
    pub total_claimed: u64,
}

/// Creator's weight tracking for ecosystem distribution
/// PDA: ["creator_weight", creator]
pub struct CreatorWeight {
    pub creator: Pubkey,
    pub total_weight: u64,                 // Sum of all NFT weights for this creator
    pub reward_debt: u128,                 // For pull-based claiming
    pub total_claimed: u64,
    pub last_claim_at: i64,
}

/// Per-NFT state for global holder rewards
/// PDA: ["global_nft_state", nft_asset]
pub struct GlobalNftRewardState {
    pub nft_asset: Pubkey,
    pub weight: u16,
    pub reward_debt: u128,
    pub created_at: i64,
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
cancel_ecosystem()

// Distribution (permissionless - anyone can call)
distribute_ecosystem_revenue()
  → Reads treasury balance (new funds since last distribution)
  → Splits: 80% creators, 5% platform, 3% ecosystem, 12% holders
  → Updates GlobalHolderRewardPool.reward_per_share
  → Updates CreatorDistributionPool.reward_per_share

// Claims (pull-based)
claim_global_holder_reward(nft_asset: Pubkey)
  → pending = (nft_weight * global_rps - nft_debt) / PRECISION
  → Transfer to holder

claim_creator_ecosystem_payout()
  → pending = (creator_weight * creator_rps - creator_debt) / PRECISION
  → Transfer to creator
```

### Ecosystem Reward Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  ECOSYSTEM SUBSCRIPTION REWARD FLOW                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  STEP 1: Users Subscribe (Continuous Streaming)                         │
│                                                                          │
│  ┌──────────┐     Stream      ┌──────────┐                              │
│  │  User A  │ ──────────────► │          │                              │
│  └──────────┘                 │ Treasury │                              │
│  ┌──────────┐     Stream      │   PDA    │                              │
│  │  User B  │ ──────────────► │          │                              │
│  └──────────┘                 └────┬─────┘                              │
│                                    │                                     │
│  ────────────────────────────────────────────────────────────────────── │
│                                    │                                     │
│  STEP 2: distribute_ecosystem_revenue() - Anyone can call               │
│                                    │                                     │
│                                    ▼                                     │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                      FEE DISTRIBUTION                             │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │                                                                   │   │
│  │  Platform (5%)   ─────────────────────►  Platform Treasury       │   │
│  │  Ecosystem (3%)  ─────────────────────►  Ecosystem Treasury      │   │
│  │                                                                   │   │
│  │  Holders (12%)   ─────────────────────►  GlobalHolderRewardPool  │   │
│  │                                          reward_per_share +=     │   │
│  │                                          (amt * PRECISION) /     │   │
│  │                                          global_total_weight     │   │
│  │                                                                   │   │
│  │  Creators (80%)  ─────────────────────►  CreatorDistributionPool │   │
│  │                                          reward_per_share +=     │   │
│  │                                          (amt * PRECISION) /     │   │
│  │                                          global_total_weight     │   │
│  │                                                                   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ────────────────────────────────────────────────────────────────────── │
│                                                                          │
│  STEP 3: Pull-Based Claims                                              │
│                                                                          │
│  NFT Holders:                                                           │
│  ┌─────────────────┐     claim_global_holder_reward()                  │
│  │ Holder (w=20)   │ ──► pending = (20 * rps - debt) / PRECISION       │
│  └─────────────────┘                                                    │
│                                                                          │
│  Creators:                                                               │
│  ┌─────────────────┐     claim_creator_ecosystem_payout()              │
│  │ Creator A       │ ──► pending = (creator_weight * rps - debt)       │
│  │ weight: 1000    │         / PRECISION                               │
│  └─────────────────┘                                                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Bundle Mint Rewards (IMPORTANT FIX)

### Problem

Previously, bundle mints only distributed rewards to bundle NFT holders, not to content NFT holders within the bundle. This disincentivizes content NFT purchases when bundles are popular.

### Solution

Bundle mints distribute 12% holder rewards to **BOTH**:
1. **Bundle NFT holders** - BundleRewardPool
2. **Content NFT holders** - Each ContentRewardPool for items in the bundle

### Distribution Formula

```
bundle_holder_reward = 12% of mint price

// Split between bundle pool and content pools
bundle_pool_share = bundle_holder_reward * 0.5  // 50% to bundle holders
content_pools_share = bundle_holder_reward * 0.5  // 50% to content holders

// Bundle pool
BundleRewardPool.add_rewards(bundle_pool_share)

// Content pools (weighted by each content's total_weight)
for each content in bundle:
    content_share = content_pools_share * (content.total_weight / total_bundle_content_weight)
    ContentRewardPool[content].add_rewards(content_share)
```

### Example

```
Bundle with 3 contents:
- Content A: total_weight = 100
- Content B: total_weight = 300
- Content C: total_weight = 100
- Total content weight: 500

Bundle mint price: 10 SOL
Holder reward: 1.2 SOL (12%)

Distribution:
- Bundle pool: 0.6 SOL (50%)
- Content pools: 0.6 SOL (50%)
  - Content A: 0.6 * (100/500) = 0.12 SOL
  - Content B: 0.6 * (300/500) = 0.36 SOL
  - Content C: 0.6 * (100/500) = 0.12 SOL
```

---

## NFT Burn Reconciliation

### Requirement

When an NFT is burned, its weight must be removed from all relevant pools to maintain correct reward distribution.

### Content NFT Burn

```rust
fn burn_content_nft(nft_asset: Pubkey) {
    let nft_state = fetch_nft_state(nft_asset);
    let weight = nft_state.weight;

    // 1. Remove from content reward pool
    content_reward_pool.total_weight -= weight;

    // 2. Remove from global holder pool (for ecosystem sub)
    global_holder_pool.total_weight -= weight;

    // 3. Update creator's total weight
    creator_weight.total_weight -= weight;

    // 4. Close NFT state accounts
    close_nft_reward_state(nft_asset);
    close_global_nft_state(nft_asset);
}
```

### Bundle NFT Burn

```rust
fn burn_bundle_nft(nft_asset: Pubkey) {
    let nft_state = fetch_bundle_nft_state(nft_asset);
    let weight = nft_state.weight;

    // 1. Remove from bundle reward pool
    bundle_reward_pool.total_weight -= weight;

    // 2. Remove from global holder pool
    global_holder_pool.total_weight -= weight;

    // 3. Update creator's total weight
    creator_weight.total_weight -= weight;

    // 4. Close NFT state accounts
    close_bundle_nft_state(nft_asset);
    close_global_nft_state(nft_asset);
}
```

---

## Complete Reward Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        COMPLETE REWARD FLOW                                  │
│                    (All sources use same fee structure)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         PAYMENT SOURCES                              │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │                                                                      │    │
│  │  Content Mint    Bundle Mint     Patron Sub     Ecosystem Sub       │    │
│  │       │              │               │               │              │    │
│  │       │              │               │               │              │    │
│  │       ▼              ▼               ▼               ▼              │    │
│  │  ┌─────────────────────────────────────────────────────────────┐   │    │
│  │  │              UNIFIED FEE SPLIT (All Sources)                 │   │    │
│  │  │                                                              │   │    │
│  │  │   Creator:    80%   Platform:  5%                           │   │    │
│  │  │   Ecosystem:   3%   Holders:  12%                           │   │    │
│  │  └─────────────────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    HOLDER REWARD DISTRIBUTION (12%)                  │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │                                                                      │    │
│  │  CONTENT MINT:                                                       │    │
│  │  └── 12% → ContentRewardPool (weighted)                             │    │
│  │                                                                      │    │
│  │  BUNDLE MINT:                                                        │    │
│  │  └── 12% split:                                                      │    │
│  │      ├── 6% → BundleRewardPool (weighted)                           │    │
│  │      └── 6% → All ContentRewardPools in bundle (by content weight)  │    │
│  │                                                                      │    │
│  │  PATRON SUB:                                                         │    │
│  │  └── 12% → All creator's ContentRewardPools (by content weight)     │    │
│  │                                                                      │    │
│  │  ECOSYSTEM SUB:                                                      │    │
│  │  └── 12% → GlobalHolderRewardPool (all NFTs by weight)              │    │
│  │                                                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    CREATOR REWARD DISTRIBUTION (80%)                 │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │                                                                      │    │
│  │  CONTENT MINT:    80% → content creator wallet                      │    │
│  │  BUNDLE MINT:     80% → bundle creator wallet                       │    │
│  │  PATRON SUB:      80% → patron's creator wallet                     │    │
│  │  ECOSYSTEM SUB:   80% → CreatorDistPool (by creator's total weight) │    │
│  │                                                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         REWARD POOLS                                 │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │                                                                      │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐  │    │
│  │  │ContentRewardPool│  │BundleRewardPool │  │GlobalHolderRewardPool│  │    │
│  │  │ (per content)   │  │ (per bundle)    │  │ (singleton)          │  │    │
│  │  ├─────────────────┤  ├─────────────────┤  ├─────────────────────┤  │    │
│  │  │ reward_per_share│  │ reward_per_share│  │ reward_per_share    │  │    │
│  │  │ total_weight    │  │ total_weight    │  │ total_weight        │  │    │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────┘  │    │
│  │                                                                      │    │
│  │  ┌─────────────────────┐                                            │    │
│  │  │CreatorDistPool      │  For ecosystem sub creator payouts         │    │
│  │  │ (singleton)         │                                            │    │
│  │  ├─────────────────────┤                                            │    │
│  │  │ reward_per_share    │                                            │    │
│  │  │ total_weight        │                                            │    │
│  │  └─────────────────────┘                                            │    │
│  │                                                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      PULL-BASED CLAIMS                               │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │                                                                      │    │
│  │  claim_content_rewards(nft):                                        │    │
│  │    pending = (nft_weight * content_pool.rps - debt) / PRECISION     │    │
│  │                                                                      │    │
│  │  claim_bundle_rewards(nft):                                         │    │
│  │    pending = (nft_weight * bundle_pool.rps - debt) / PRECISION      │    │
│  │                                                                      │    │
│  │  claim_global_holder_reward(nft):                                   │    │
│  │    pending = (nft_weight * global_pool.rps - debt) / PRECISION      │    │
│  │                                                                      │    │
│  │  claim_creator_ecosystem_payout():                                  │    │
│  │    pending = (creator_weight * creator_pool.rps - debt) / PRECISION │    │
│  │                                                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Weight Tracking Summary

### On Mint

```rust
// Content NFT mint
content_reward_pool.total_weight += nft_weight;
global_holder_pool.total_weight += nft_weight;
creator_weight.total_weight += nft_weight;
creator_dist_pool.total_weight += nft_weight;

// Bundle NFT mint
bundle_reward_pool.total_weight += nft_weight;
global_holder_pool.total_weight += nft_weight;
creator_weight.total_weight += nft_weight;
creator_dist_pool.total_weight += nft_weight;
```

### On Burn

```rust
// Content NFT burn
content_reward_pool.total_weight -= nft_weight;
global_holder_pool.total_weight -= nft_weight;
creator_weight.total_weight -= nft_weight;
creator_dist_pool.total_weight -= nft_weight;

// Bundle NFT burn
bundle_reward_pool.total_weight -= nft_weight;
global_holder_pool.total_weight -= nft_weight;
creator_weight.total_weight -= nft_weight;
creator_dist_pool.total_weight -= nft_weight;
```

---

## Access Check Flow

```rust
fn check_content_access(user: Pubkey, content: Pubkey) -> AccessResult {
    let content_entry = fetch_content(content);
    let visibility = content_entry.visibility_level;

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

    // Level 3 content: NFT only - stop here
    if visibility == 3 {
        return AccessResult::Denied;
    }

    // Check 5: Is active patron of creator? (visibility <= 2)
    if visibility <= 2 && user_is_patron(user, content_entry.creator) {
        return AccessResult::Granted(AccessType::Patron);
    }

    // Check 6: Is active ecosystem subscriber? (visibility == 1)
    if visibility == 1 && user_is_ecosystem_subscriber(user) {
        return AccessResult::Granted(AccessType::EcosystemSub);
    }

    AccessResult::Denied
}
```

---

## Implementation Phases

### Phase 1: Foundation & Bundle Fix
- [ ] Fix bundle mint to distribute to content NFT holders (50/50 split)
- [ ] Add `visibility_level` field to Content account (default: 1)
- [ ] Add `visibility_level` field to Bundle account (default: 1)
- [ ] Create GlobalHolderRewardPool account
- [ ] Create GlobalNftRewardState account (per NFT)
- [ ] Create CreatorDistributionPool account
- [ ] Create CreatorWeight account (per creator)
- [ ] Update mint instructions to track global weights
- [ ] Implement burn reconciliation for all pools
- [ ] Research Streamflow SDK integration
- [ ] Research Clockwork SDK integration

### Phase 2: Creator Patronage (Program)
- [ ] CreatorPatronConfig account + instructions
- [ ] CreatorPatronSubscription account
- [ ] Streamflow integration for patron streams
- [ ] `init_patron_config` instruction
- [ ] `subscribe_patron` instruction
- [ ] `topup_patron` / `cancel_patron` instructions
- [ ] `distribute_patron_revenue` instruction
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
- [ ] `distribute_ecosystem_revenue` instruction (splits 80/5/3/12)
- [ ] `claim_global_holder_reward` instruction
- [ ] `claim_creator_ecosystem_payout` instruction
- [ ] Unit tests

### Phase 5: Ecosystem Subscription (SDK + Web)
- [ ] SDK: Ecosystem instruction builders
- [ ] SDK: Ecosystem account fetchers
- [ ] Web: EcosystemSubscribeModal
- [ ] Web: Global holder rewards in claim modal
- [ ] Web: Ecosystem earnings in creator dashboard
- [ ] Web: Subscribe button in header

### Phase 6: Clockwork Auto-Renewal
- [ ] AutoRenewalConfig account
- [ ] Clockwork thread creation
- [ ] Auto-topup logic
- [ ] SDK: Automation management
- [ ] Web: Auto-renewal toggle

### Phase 7: Polish & Testing
- [ ] E2E testing all flows
- [ ] Edge cases (burn during active claim, etc.)
- [ ] Off-chain notifications
- [ ] Documentation updates

---

## Summary Tables

### Revenue Sources & Distribution

| Source | Creator | Platform | Ecosystem | Holders | Holder Pool |
|--------|---------|----------|-----------|---------|-------------|
| Content NFT Mint | 80% | 5% | 3% | 12% | ContentRewardPool |
| Bundle NFT Mint | 80% | 5% | 3% | 12% | 50% Bundle + 50% Content pools |
| Content Rental | 80% | 5% | 3% | 12% | ContentRewardPool |
| Bundle Rental | 80% | 5% | 3% | 12% | 50% Bundle + 50% Content pools |
| Content Resale | 2-10% | 1% | 1% | 8% | ContentRewardPool |
| Bundle Resale | 2-10% | 1% | 1% | 8% | BundleRewardPool |
| Creator Patron | 80% | 5% | 3% | 12% | All creator's ContentRewardPools |
| Ecosystem Sub | 80%* | 5% | 3% | 12% | GlobalHolderRewardPool |

*Ecosystem sub creator portion distributed by CreatorDistributionPool (by weight)

### Access Types & Rewards

| Access Type | Earns Holder Rewards? | Duration | Notes |
|-------------|----------------------|----------|-------|
| Content NFT Owner | Yes (content pool + global pool) | Permanent | Weight-based |
| Bundle NFT Owner | Yes (bundle pool + global pool) | Permanent | Weight-based |
| Creator Patron | No (access only) | Subscription | Creator perks |
| Ecosystem Sub | No (access only) | Subscription | Platform-wide access |
| Renter | No | 6h/1d/7d | Temporary access |

---

*Last updated: December 12, 2025*
