# Handcraft Subscription & Reward System

## Overview

This document describes the complete monetization and reward system:
1. **Existing Monetization** - NFT mints, rentals, secondary sales
2. **Creator Patronage** - Users support creators directly (Patreon-style)
3. **Ecosystem Subscription** - Users pay platform for all content access (Spotify-style)

All systems use:
- **Immediate push distribution** to reward pools
- **Pull-based claims** for NFT holders
- **Rarity-weighted calculations** for all distributions

---

## Design Principles

1. **No Public Content** - All content requires access (NFT, rental, patron, or ecosystem sub)
2. **Unified Fee Structure** - All revenue sources use 80/5/3/12 split
3. **Weight-Based Distribution** - All calculations use rarity weights, not counts
4. **Burn Reconciliation** - NFT burns reduce weight from all relevant pools
5. **Rental = Access Only** - Rentals provide temporary access, no rewards

---

## Fee Structure (All Sources)

**Primary (Mint / Rental / Subscription):**
```
Creator:     80%  → creator wallet
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

---

## Rarity Weights

| Rarity | Weight | Probability |
|--------|--------|-------------|
| Common | 1 | 55% |
| Uncommon | 5 | 27% |
| Rare | 20 | 13% |
| Epic | 60 | 4% |
| Legendary | 120 | 1% |

**All calculations:**
```rust
reward_per_share += (amount * PRECISION) / total_weight
pending = (nft_weight * reward_per_share - reward_debt) / PRECISION
```

---

## Access Hierarchy (Simplified)

```
┌─────────────────────────────────────────────────────────────────┐
│                     ACCESS HIERARCHY                             │
│                     (No Public Content)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Level 3: NFT/Rental Only                                       │
│  └── Only NFT owners or active renters can access               │
│      (Even creator patrons CANNOT access)                       │
│                                                                  │
│  Level 2: Patron Access                                         │
│  └── Creator patrons + NFT/Rental holders can access            │
│                                                                  │
│  Level 1: Ecosystem Access                                      │
│  └── Ecosystem subscribers + Patrons + NFT/Rental holders       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Key Points:**
- **Rental** = NFT-like access with time limit, NO reward participation
- **Level 3 content** cannot be accessed even by active patrons
- All levels respect the visibility setting set by creator

---

## Existing Monetization (Detailed)

### Content NFT Mint/Sale

| Recipient | Share | Pool/Destination |
|-----------|-------|------------------|
| Creator | 80% | Creator wallet |
| Platform | 5% | Platform treasury |
| Ecosystem | 3% | Ecosystem treasury |
| **Holders** | **12%** | **ContentRewardPool** (content NFT holders only) |

### Content Rental

| Recipient | Share | Pool/Destination |
|-----------|-------|------------------|
| Creator | 80% | Creator wallet |
| Platform | 5% | Platform treasury |
| Ecosystem | 3% | Ecosystem treasury |
| **Holders** | **12%** | **ContentRewardPool** (content NFT holders only) |

**Note:** Renters do NOT earn rewards. They get temporary access only.

### Content Secondary Sale

| Recipient | Share | Pool/Destination |
|-----------|-------|------------------|
| Seller | ~88% | Seller wallet |
| Creator | 2-10% | Creator wallet |
| Platform | 1% | Platform treasury |
| Ecosystem | 1% | Ecosystem treasury |
| **Holders** | **8%** | **ContentRewardPool** (content NFT holders only) |

### Bundle NFT Mint/Sale

| Recipient | Share | Pool/Destination |
|-----------|-------|------------------|
| Creator | 80% | Creator wallet |
| Platform | 5% | Platform treasury |
| Ecosystem | 3% | Ecosystem treasury |
| **Holders** | **12%** | **Split:** 6% BundleRewardPool + 6% ContentRewardPools |

**Bundle holder rewards split:**
- 50% (6%) → BundleRewardPool (bundle NFT holders)
- 50% (6%) → All ContentRewardPools in bundle (content NFT holders, by weight)

### Bundle Rental

Same as bundle mint - 50/50 split between bundle pool and content pools.
Renters do NOT earn rewards.

### Bundle Secondary Sale

| Recipient | Share | Pool/Destination |
|-----------|-------|------------------|
| Seller | ~88% | Seller wallet |
| Creator | 2-10% | Creator wallet |
| Platform | 1% | Platform treasury |
| Ecosystem | 1% | Ecosystem treasury |
| **Holders** | **8%** | **BundleRewardPool only** (not content pools) |

**Note:** Secondary sales only go to bundle pool since the specific bundle NFT was resold.

---

## Pool Architecture

### Problem: Distributing to Multiple Pools

For patron subscriptions and bundle mints, we need to distribute to multiple content pools. However:
- Programs cannot query all content addresses dynamically
- A single instruction cannot update unlimited accounts

### Solution: Hybrid Pool Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           REWARD POOL ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PER-CONTENT POOLS:                                                          │
│  ┌─────────────────────┐                                                     │
│  │ ContentRewardPool   │  PDA: ["content_reward_pool", content]             │
│  │ (per content)       │  Receives: Content mint/rent/secondary holder fees │
│  │                     │  Tracks: content NFT weights                        │
│  │ - reward_per_share  │  Claims: content NFT holders                        │
│  │ - total_weight      │                                                     │
│  └─────────────────────┘                                                     │
│                                                                              │
│  PER-BUNDLE POOLS:                                                           │
│  ┌─────────────────────┐                                                     │
│  │ BundleRewardPool    │  PDA: ["bundle_reward_pool", bundle]               │
│  │ (per bundle)        │  Receives: Bundle mint/rent/secondary holder fees  │
│  │                     │  Tracks: bundle NFT weights                         │
│  │ - reward_per_share  │  Claims: bundle NFT holders                         │
│  │ - total_weight      │                                                     │
│  └─────────────────────┘                                                     │
│                                                                              │
│  PER-CREATOR POOLS:                                                          │
│  ┌─────────────────────┐                                                     │
│  │ CreatorPatronPool   │  PDA: ["creator_patron_pool", creator]             │
│  │ (per creator)       │  Receives: Patron subscription holder fees (12%)   │
│  │                     │  Tracks: ALL creator NFT weights (content + bundle)│
│  │ - reward_per_share  │  Claims: Any holder of creator's NFTs              │
│  │ - total_weight      │                                                     │
│  └─────────────────────┘                                                     │
│                                                                              │
│  GLOBAL POOLS (SINGLETONS):                                                  │
│  ┌─────────────────────┐  ┌─────────────────────┐                           │
│  │ GlobalHolderPool    │  │ CreatorDistPool     │                           │
│  │ (singleton)         │  │ (singleton)         │                           │
│  │                     │  │                     │                           │
│  │ Receives: Ecosystem │  │ Receives: Ecosystem │                           │
│  │   sub holder fees   │  │   sub creator share │                           │
│  │   (12%)             │  │   (80%)             │                           │
│  │                     │  │                     │                           │
│  │ Tracks: ALL NFT     │  │ Tracks: ALL NFT     │                           │
│  │   weights globally  │  │   weights globally  │                           │
│  │                     │  │                     │                           │
│  │ Claims: Any NFT     │  │ Claims: Any creator │                           │
│  │   holder            │  │   by their weight   │                           │
│  └─────────────────────┘  └─────────────────────┘                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Bundle → Content Distribution

For distributing bundle mint rewards to content pools:
- Bundle items are **capped** (max 50 items)
- Pass ContentRewardPool PDAs as **remaining accounts**
- Distribute to each in the instruction

```rust
// Bundle mint instruction
pub fn bundle_mint_nft(ctx: Context<BundleMintNft>, ...) {
    let holder_fee = price * 12 / 100;
    let bundle_share = holder_fee / 2;      // 6%
    let content_share = holder_fee / 2;     // 6%

    // Update bundle pool
    ctx.accounts.bundle_reward_pool.add_rewards(bundle_share);

    // Distribute to content pools (passed as remaining accounts)
    let total_content_weight = calculate_total_content_weight(&ctx.remaining_accounts);
    for (i, pool_info) in ctx.remaining_accounts.iter().enumerate() {
        let pool = ContentRewardPool::deserialize(pool_info)?;
        let share = content_share * pool.total_weight / total_content_weight;
        pool.add_rewards(share);
    }
}
```

---

## Creator Patronage

### Concept

Users support specific creators via token streaming. In exchange:
- Access to creator's content at visibility level ≤ 2
- Creator-defined perks and tiers
- Cancellable anytime with remaining balance refunded

### Membership Tiers

Creators define their own membership structure (like Patreon):

```rust
pub struct PatronTier {
    pub name: String,           // "Supporter", "Fan", "Superfan"
    pub price_per_month: u64,   // SOL per month
    pub perks_cid: String,      // IPFS metadata for perks description
    pub is_active: bool,
}
```

**Default tier:** Single "Creator Subscription" tier at creator-set price.

### Fee Distribution

```
Patron Payment (streamed continuously):
Creator:     80%  → creator wallet
Platform:     5%  → platform treasury
Ecosystem:    3%  → ecosystem treasury
Holders:     12%  → CreatorPatronPool (ALL creator NFT holders)
```

### CreatorPatronPool Mechanics

- **One pool per creator** (not per content)
- **Tracks total weight** of ALL creator's NFTs (content + bundle)
- **Any holder** of creator's NFTs can claim from this pool

```rust
/// PDA: ["creator_patron_pool", creator]
pub struct CreatorPatronPool {
    pub creator: Pubkey,
    pub reward_per_share: u128,
    pub total_weight: u64,          // Sum of ALL creator NFT weights
    pub total_deposited: u64,
    pub total_claimed: u64,
}

/// PDA: ["patron_nft_state", creator, nft_asset]
pub struct PatronNftRewardState {
    pub nft_asset: Pubkey,
    pub weight: u16,
    pub reward_debt: u128,
    pub last_claim_at: i64,
}
```

### Weight Tracking for CreatorPatronPool

```rust
// On content NFT mint (update creator's patron pool)
creator_patron_pool.total_weight += nft_weight;
create_patron_nft_state(nft_asset, weight);

// On bundle NFT mint
creator_patron_pool.total_weight += nft_weight;
create_patron_nft_state(nft_asset, weight);

// On burn
creator_patron_pool.total_weight -= nft_weight;
close_patron_nft_state(nft_asset);
```

### Patron Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      PATRON SUBSCRIPTION FLOW                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  User subscribes to Creator Alice (0.3 SOL/month):                      │
│                                                                          │
│  ┌──────────┐   Streamflow    ┌──────────┐    distribute_patron()       │
│  │   User   │ ──────────────► │ Treasury │ ─────────────────────────►   │
│  │  Wallet  │                 │   PDA    │                              │
│  └──────────┘                 └──────────┘                              │
│                                     │                                    │
│                                     ▼                                    │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                      FEE DISTRIBUTION                             │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │                                                                   │   │
│  │  80% ────────────────────────────────►  Alice's Wallet           │   │
│  │   5% ────────────────────────────────►  Platform Treasury        │   │
│  │   3% ────────────────────────────────►  Ecosystem Treasury       │   │
│  │  12% ────────────────────────────────►  CreatorPatronPool[Alice] │   │
│  │                                         reward_per_share +=      │   │
│  │                                         (amt * PRECISION) /      │   │
│  │                                         alice_total_weight       │   │
│  │                                                                   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  NFT Holder claims from patron pool:                                    │
│  ┌─────────────────────────────┐                                        │
│  │ Holder owns Alice's NFT     │  claim_patron_reward(nft):             │
│  │ (weight: 20)                │  pending = (20 * rps - debt) / PREC    │
│  └─────────────────────────────┘                                        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Ecosystem Subscription

### Concept

Users pay platform for access to ALL content (visibility level 1). Revenue:
- 80% distributed to creators by their total NFT weight
- 12% distributed to all NFT holders by weight
- 5% + 3% to platform/ecosystem

### Fee Distribution

```
Ecosystem Payment (streamed continuously):
Creators:    80%  → CreatorDistPool (by each creator's weight)
Platform:     5%  → platform treasury
Ecosystem:    3%  → ecosystem treasury
Holders:     12%  → GlobalHolderPool (all NFT holders by weight)
```

### Global Pool Mechanics

**GlobalHolderPool** - For NFT holder rewards:
```rust
/// PDA: ["global_holder_pool"]
pub struct GlobalHolderPool {
    pub reward_per_share: u128,
    pub total_weight: u64,          // Sum of ALL NFT weights globally
    pub total_deposited: u64,
    pub total_claimed: u64,
}

/// PDA: ["global_nft_state", nft_asset]
pub struct GlobalNftRewardState {
    pub nft_asset: Pubkey,
    pub weight: u16,
    pub reward_debt: u128,
    pub last_claim_at: i64,
}
```

**CreatorDistPool** - For creator payouts:
```rust
/// PDA: ["creator_dist_pool"]
pub struct CreatorDistPool {
    pub reward_per_share: u128,
    pub total_weight: u64,          // Sum of ALL NFT weights globally
    pub total_deposited: u64,
    pub total_claimed: u64,
}

/// PDA: ["creator_weight", creator]
pub struct CreatorWeight {
    pub creator: Pubkey,
    pub total_weight: u64,          // Sum of creator's NFT weights
    pub reward_debt: u128,
    pub total_claimed: u64,
}
```

### Weight Tracking for Global Pools

```rust
// On ANY NFT mint (content or bundle)
global_holder_pool.total_weight += nft_weight;
creator_dist_pool.total_weight += nft_weight;
creator_weight[creator].total_weight += nft_weight;
create_global_nft_state(nft_asset, weight);

// On burn
global_holder_pool.total_weight -= nft_weight;
creator_dist_pool.total_weight -= nft_weight;
creator_weight[creator].total_weight -= nft_weight;
close_global_nft_state(nft_asset);
```

### Ecosystem Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ECOSYSTEM SUBSCRIPTION FLOW                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  STEP 1: Users stream to ecosystem treasury                             │
│                                                                          │
│  ┌──────────┐     Stream      ┌──────────┐                              │
│  │  User A  │ ──────────────► │          │                              │
│  └──────────┘                 │ Treasury │                              │
│  ┌──────────┐     Stream      │   PDA    │                              │
│  │  User B  │ ──────────────► │          │                              │
│  └──────────┘                 └────┬─────┘                              │
│                                    │                                     │
│  STEP 2: distribute_ecosystem_revenue() (permissionless)                │
│                                    │                                     │
│                                    ▼                                     │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                      FEE DISTRIBUTION                             │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │                                                                   │   │
│  │   5% ────────────────────────────────►  Platform Treasury        │   │
│  │   3% ────────────────────────────────►  Ecosystem Treasury       │   │
│  │  12% ────────────────────────────────►  GlobalHolderPool         │   │
│  │  80% ────────────────────────────────►  CreatorDistPool          │   │
│  │                                                                   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  STEP 3: Pull-based claims                                              │
│                                                                          │
│  NFT Holders:                                                           │
│  ┌─────────────────┐     claim_global_holder_reward(nft)               │
│  │ Holder (w=20)   │ ──► pending = (20 * rps - debt) / PRECISION       │
│  └─────────────────┘                                                    │
│                                                                          │
│  Creators:                                                               │
│  ┌─────────────────┐     claim_creator_ecosystem_payout()              │
│  │ Creator Alice   │ ──► pending = (alice_weight * rps - debt)         │
│  │ weight: 1000    │         / PRECISION                               │
│  └─────────────────┘                                                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Complete Weight Tracking

### On Content NFT Mint

```rust
fn mint_content_nft(...) {
    let weight = get_rarity_weight(rarity);

    // 1. Content reward pool
    content_reward_pool.total_weight += weight;
    create_content_nft_state(nft, weight);

    // 2. Creator patron pool
    creator_patron_pool.total_weight += weight;
    create_patron_nft_state(nft, weight);

    // 3. Global holder pool
    global_holder_pool.total_weight += weight;
    create_global_nft_state(nft, weight);

    // 4. Creator weight (for ecosystem dist)
    creator_weight.total_weight += weight;
    creator_dist_pool.total_weight += weight;
}
```

### On Bundle NFT Mint

```rust
fn mint_bundle_nft(...) {
    let weight = get_rarity_weight(rarity);

    // 1. Bundle reward pool
    bundle_reward_pool.total_weight += weight;
    create_bundle_nft_state(nft, weight);

    // 2. Creator patron pool
    creator_patron_pool.total_weight += weight;
    create_patron_nft_state(nft, weight);

    // 3. Global holder pool
    global_holder_pool.total_weight += weight;
    create_global_nft_state(nft, weight);

    // 4. Creator weight (for ecosystem dist)
    creator_weight.total_weight += weight;
    creator_dist_pool.total_weight += weight;
}
```

### On NFT Burn

```rust
fn burn_content_nft(nft: Pubkey) {
    let weight = nft_state.weight;

    // Decrement ALL pools
    content_reward_pool.total_weight -= weight;
    creator_patron_pool.total_weight -= weight;
    global_holder_pool.total_weight -= weight;
    creator_weight.total_weight -= weight;
    creator_dist_pool.total_weight -= weight;

    // Close state accounts
    close_content_nft_state(nft);
    close_patron_nft_state(nft);
    close_global_nft_state(nft);
}
```

---

## Access Check Logic

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

    // Level 3 content: NFT/Rental only - stop here
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

## Summary Tables

### Revenue Sources & Holder Pool Distribution

| Source | Holder % | Pool(s) |
|--------|----------|---------|
| Content Mint | 12% | ContentRewardPool |
| Content Rental | 12% | ContentRewardPool |
| Content Secondary | 8% | ContentRewardPool |
| Bundle Mint | 12% | 50% BundleRewardPool + 50% ContentRewardPools |
| Bundle Rental | 12% | 50% BundleRewardPool + 50% ContentRewardPools |
| Bundle Secondary | 8% | BundleRewardPool only |
| Creator Patron | 12% | CreatorPatronPool |
| Ecosystem Sub | 12% | GlobalHolderPool |

### Access vs Rewards

| Access Type | Earns Rewards? | From Which Pools? |
|-------------|----------------|-------------------|
| Content NFT Owner | Yes | ContentRewardPool + CreatorPatronPool + GlobalHolderPool |
| Bundle NFT Owner | Yes | BundleRewardPool + CreatorPatronPool + GlobalHolderPool |
| Creator Patron | No | Access only |
| Ecosystem Subscriber | No | Access only |
| Renter | No | Access only (time-limited) |

### Claim Instructions Summary

| Claim | Who Can Call | Pool |
|-------|--------------|------|
| `claim_content_rewards(nft)` | Content NFT owner | ContentRewardPool |
| `claim_bundle_rewards(nft)` | Bundle NFT owner | BundleRewardPool |
| `claim_patron_rewards(nft)` | Any creator's NFT owner | CreatorPatronPool |
| `claim_global_holder_reward(nft)` | Any NFT owner | GlobalHolderPool |
| `claim_creator_ecosystem_payout()` | Any creator | CreatorDistPool |

---

## Implementation Phases

### Phase 1: Foundation & Bundle Fix
- [ ] Add `visibility_level` to Content/Bundle accounts (default: 1)
- [ ] Fix bundle mint to distribute 50/50 to bundle + content pools
- [ ] Create CreatorPatronPool account + PDA
- [ ] Create PatronNftRewardState account + PDA
- [ ] Create GlobalHolderPool account + PDA
- [ ] Create GlobalNftRewardState account + PDA
- [ ] Create CreatorDistPool account + PDA
- [ ] Create CreatorWeight account + PDA
- [ ] Update all mint instructions to track weights in new pools
- [ ] Implement burn reconciliation for all pools

### Phase 2: Creator Patronage
- [ ] CreatorPatronConfig account (tiers, pricing, perks)
- [ ] Streamflow integration for patron streams
- [ ] `init_patron_config` instruction
- [ ] `subscribe_patron` instruction
- [ ] `distribute_patron_revenue` instruction
- [ ] `claim_patron_rewards` instruction
- [ ] SDK instruction builders
- [ ] Web: Patron setup modal (creator)
- [ ] Web: Patron subscribe modal (user)

### Phase 3: Ecosystem Subscription
- [ ] EcosystemSubConfig account
- [ ] Streamflow integration for ecosystem streams
- [ ] `distribute_ecosystem_revenue` instruction
- [ ] `claim_global_holder_reward` instruction
- [ ] `claim_creator_ecosystem_payout` instruction
- [ ] SDK instruction builders
- [ ] Web: Ecosystem subscribe modal
- [ ] Web: Global rewards in claim modal

### Phase 4: Clockwork Auto-Renewal
- [ ] Auto-renewal config
- [ ] Clockwork thread creation
- [ ] Auto-topup logic

### Phase 5: Testing & Polish
- [ ] E2E testing all flows
- [ ] Edge cases (burn during claim, etc.)
- [ ] Documentation updates

---

*Last updated: December 12, 2025*
