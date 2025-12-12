# Handcraft Subscription & Reward System

## Overview

This document describes the complete monetization and reward system:
1. **Existing Monetization** - NFT mints, rentals, secondary sales
2. **Creator Patronage** - Membership (support) and Subscription (support + access)
3. **Ecosystem Subscription** - Platform-wide content access (Spotify-style)

All systems use:
- **Immediate push distribution** to reward pools (on every mint/payment)
- **Pull-based claims** for NFT holders
- **Rarity-weighted calculations** for all distributions

### Why NFT Weight (Not Views/Streams)?

Unlike YouTube Premium, Spotify, or Netflix that distribute by views/streams:

| Platform | Distribution Basis | Problem |
|----------|-------------------|---------|
| Spotify | Stream count | Fake plays, bot farms |
| YouTube | Watch time | Click farms, view manipulation |
| **Handcraft** | **NFT weight** | **Real on-chain purchases** |

NFT weight-based distribution:
- Encourages **real transactions** (can't fake on-chain purchases)
- Rewards **early supporters** (higher rarity = more weight)
- Creates **skin in the game** (holders are invested)

---

## Design Principles

1. **No Public Content** - All content requires access (NFT, rental, subscription, or ecosystem)
2. **Unified Fee Structure** - All revenue sources use 80/5/3/12 split
3. **Weight-Based Distribution** - All calculations use rarity weights, not counts or views
4. **Burn Reconciliation** - NFT burns reduce weight from all relevant pools
5. **Rental = Access Only** - Rentals provide temporary access, no rewards
6. **Eager Weight Tracking** - Update all pools on every mint (user pays, it's cheap)

---

## Fee Structure (All Sources)

**Primary (Mint / Rental / Membership / Subscription):**
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

## Access Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                     ACCESS HIERARCHY                             │
│                     (No Public Content)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Level 3: NFT/Rental Only                                       │
│  └── Only NFT owners or active renters can access               │
│      (Even subscribers CANNOT access)                           │
│                                                                  │
│  Level 2: Subscriber Access                                     │
│  └── Creator subscribers + NFT/Rental holders can access        │
│      (Membership holders CANNOT access - support only)          │
│                                                                  │
│  Level 1: Ecosystem Access                                      │
│  └── Ecosystem subscribers + Creator subscribers + NFT/Rental   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Key Points:**
- **Rental** = NFT-like access with time limit, NO reward participation
- **Membership** = Pure support, NO content access, 12% to NFT holders
- **Subscription** = Support + Level 2 content access, 12% to NFT holders
- **Level 3 content** cannot be accessed by any subscriber

---

## Existing Monetization

### Content NFT Mint/Sale

| Recipient | Share | Destination |
|-----------|-------|-------------|
| Creator | 80% | Creator wallet |
| Platform | 5% | Platform treasury |
| Ecosystem | 3% | Ecosystem treasury |
| **Holders** | **12%** | **ContentRewardPool** (content NFT holders only) |

### Content Rental

Same as content mint. **Renters do NOT earn rewards** - access only.

### Content Secondary Sale

| Recipient | Share | Destination |
|-----------|-------|-------------|
| Seller | ~88% | Seller wallet |
| Creator | 2-10% | Creator wallet |
| Platform | 1% | Platform treasury |
| Ecosystem | 1% | Ecosystem treasury |
| **Holders** | **8%** | **ContentRewardPool** (content NFT holders only) |

### Bundle NFT Mint/Sale

| Recipient | Share | Destination |
|-----------|-------|-------------|
| Creator | 80% | Creator wallet |
| Platform | 5% | Platform treasury |
| Ecosystem | 3% | Ecosystem treasury |
| **Holders** | **12%** | **Split:** 6% BundleRewardPool + 6% ContentRewardPools |

**Bundle holder rewards split (50/50):**
- 50% (6%) → BundleRewardPool (bundle NFT holders)
- 50% (6%) → All ContentRewardPools in bundle (content NFT holders, by weight)

This prevents bundle sales from cannibalizing content sales. Users still have incentive to buy individual content.

### Bundle Rental

Same as bundle mint - 50/50 split. Renters do NOT earn rewards.

### Bundle Secondary Sale

| Recipient | Share | Destination |
|-----------|-------|-------------|
| Seller | ~88% | Seller wallet |
| Creator | 2-10% | Creator wallet |
| Platform | 1% | Platform treasury |
| Ecosystem | 1% | Ecosystem treasury |
| **Holders** | **8%** | **BundleRewardPool only** |

Secondary sales only go to bundle pool (the specific bundle NFT was resold).

### Bundle → Content Distribution

For bundles with many items:
- Bundle items capped at **50 items max**
- Pass ContentRewardPool PDAs as **remaining accounts**
- Distribute to each by weight ratio

```rust
pub fn bundle_mint_nft(ctx: Context<BundleMintNft>, ...) {
    let holder_fee = price * 12 / 100;
    let bundle_share = holder_fee / 2;      // 6%
    let content_share = holder_fee / 2;     // 6%

    // Update bundle pool
    ctx.accounts.bundle_reward_pool.add_rewards(bundle_share);

    // Distribute to content pools (remaining accounts)
    let total_content_weight = sum_content_weights(&ctx.remaining_accounts);
    for pool_info in ctx.remaining_accounts.iter() {
        let pool = ContentRewardPool::deserialize(pool_info)?;
        let share = content_share * pool.total_weight / total_content_weight;
        pool.add_rewards(share);
    }
}
```

---

## Creator Patronage

### Membership vs Subscription

Creators define their own tiers (like Patreon):

| Tier Type | Example | Content Access | 12% to NFT Holders |
|-----------|---------|----------------|-------------------|
| **Membership** | 0.2 SOL/mo | No access | Yes |
| **Subscription** | 1 SOL/mo | Level 2 access | Yes |

**Membership** = Pure support tier
- Fan wants to support creator without content access
- Maybe they already own NFTs
- Like Patreon's "thank you" tier

**Subscription** = Support + Access tier
- Includes Level 2 content access
- Higher price, more value

Both use same fee structure (80/5/3/12).

### Fee Distribution

```
Creator Patronage (Membership or Subscription):
Creator:     80%  → creator wallet
Platform:     5%  → platform treasury
Ecosystem:    3%  → ecosystem treasury
Holders:     12%  → CreatorPatronPool (ALL creator's NFT holders)
```

### CreatorPatronPool

One pool per creator (not per content):

```rust
/// PDA: ["creator_patron_pool", creator]
pub struct CreatorPatronPool {
    pub creator: Pubkey,
    pub reward_per_share: u128,
    pub total_weight: u64,          // Sum of ALL creator NFT weights
    pub total_deposited: u64,
    pub total_claimed: u64,
}
```

- Tracks total weight of ALL creator's NFTs (content + bundle)
- Any holder of creator's NFTs can claim from this pool

### Patron Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      CREATOR PATRONAGE FLOW                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  User subscribes to Creator Alice (1 SOL/month):                        │
│                                                                          │
│  ┌──────────┐   Streamflow    ┌──────────┐    distribute_patron()       │
│  │   User   │ ──────────────► │ Treasury │ ─────────────────────────►   │
│  │  Wallet  │                 │   PDA    │                              │
│  └──────────┘                 └──────────┘                              │
│                                     │                                    │
│                                     ▼                                    │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  80% (0.8 SOL) ──────────────►  Alice's Wallet                   │   │
│  │   5% (0.05 SOL) ─────────────►  Platform Treasury                │   │
│  │   3% (0.03 SOL) ─────────────►  Ecosystem Treasury               │   │
│  │  12% (0.12 SOL) ─────────────►  CreatorPatronPool[Alice]         │   │
│  │                                  reward_per_share +=              │   │
│  │                                  (0.12 * PRECISION) /             │   │
│  │                                  alice_total_nft_weight           │   │
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

Users pay platform for access to ALL Level 1 content. Revenue distributed:
- 80% to creators (by their NFT weight share)
- 12% to all NFT holders (by weight)
- 5% + 3% to platform/ecosystem

### Fee Distribution

```
Ecosystem Subscription:
Creators:    80%  → CreatorDistPool (by each creator's weight)
Platform:     5%  → platform treasury
Ecosystem:    3%  → ecosystem treasury
Holders:     12%  → GlobalHolderPool (all NFT holders by weight)
```

### GlobalHolderPool

For ecosystem subscription holder rewards (12%):

```rust
/// PDA: ["global_holder_pool"]
pub struct GlobalHolderPool {
    pub reward_per_share: u128,
    pub total_weight: u64,          // Sum of ALL NFT weights globally
    pub total_deposited: u64,
    pub total_claimed: u64,
}
```

### CreatorDistPool

For ecosystem subscription creator payouts (80%):

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

**Why CreatorDistPool?**
- Ecosystem subscription is platform-wide (not per-creator)
- 80% needs to go to ALL creators proportionally
- Can't distribute directly to each creator in one instruction
- Pool accumulates funds, creators pull-claim by their weight share

### Ecosystem Flow

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
│  STEP 2: distribute_ecosystem_revenue() - permissionless               │
│                                    │                                     │
│                                    ▼                                     │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │   5% ────────────────────────────────►  Platform Treasury        │   │
│  │   3% ────────────────────────────────►  Ecosystem Treasury       │   │
│  │  12% ────────────────────────────────►  GlobalHolderPool         │   │
│  │  80% ────────────────────────────────►  CreatorDistPool          │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  STEP 3: Pull-based claims                                              │
│                                                                          │
│  NFT Holders claim from GlobalHolderPool:                               │
│  ┌─────────────────┐                                                    │
│  │ Holder (w=20)   │ → pending = (20 * rps - debt) / PRECISION         │
│  └─────────────────┘                                                    │
│                                                                          │
│  Creators claim from CreatorDistPool:                                   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Creator Alice: weight 1000 (50% of 2000 total)                  │   │
│  │ Creator Bob:   weight 600  (30% of 2000 total)                  │   │
│  │ Creator Carol: weight 400  (20% of 2000 total)                  │   │
│  │                                                                  │   │
│  │ If 8 SOL in pool:                                               │   │
│  │   Alice claims: 8 * (1000/2000) = 4 SOL                         │   │
│  │   Bob claims:   8 * (600/2000)  = 2.4 SOL                       │   │
│  │   Carol claims: 8 * (400/2000)  = 1.6 SOL                       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Pool Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           REWARD POOL ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PER-CONTENT:                                                                │
│  ┌─────────────────────┐                                                     │
│  │ ContentRewardPool   │  Receives: Content mint/rent/secondary (12%/8%)    │
│  │ (per content)       │  + Bundle mint/rent content share (6%)             │
│  │                     │  Claims: Content NFT holders                        │
│  └─────────────────────┘                                                     │
│                                                                              │
│  PER-BUNDLE:                                                                 │
│  ┌─────────────────────┐                                                     │
│  │ BundleRewardPool    │  Receives: Bundle mint/rent (6%) + secondary (8%)  │
│  │ (per bundle)        │  Claims: Bundle NFT holders                         │
│  └─────────────────────┘                                                     │
│                                                                              │
│  PER-CREATOR:                                                                │
│  ┌─────────────────────┐                                                     │
│  │ CreatorPatronPool   │  Receives: Membership + Subscription (12%)         │
│  │ (per creator)       │  Tracks: ALL creator NFT weights                    │
│  │                     │  Claims: Any holder of creator's NFTs               │
│  └─────────────────────┘                                                     │
│                                                                              │
│  GLOBAL (SINGLETONS):                                                        │
│  ┌─────────────────────┐  ┌─────────────────────┐                           │
│  │ GlobalHolderPool    │  │ CreatorDistPool     │                           │
│  │                     │  │                     │                           │
│  │ Receives: Ecosystem │  │ Receives: Ecosystem │                           │
│  │   subscription 12%  │  │   subscription 80%  │                           │
│  │                     │  │                     │                           │
│  │ Tracks: ALL NFT     │  │ Tracks: ALL NFT     │                           │
│  │   weights globally  │  │   weights globally  │                           │
│  │                     │  │                     │                           │
│  │ Claims: Any NFT     │  │ Claims: Creators    │                           │
│  │   holder by weight  │  │   by their weight   │                           │
│  └─────────────────────┘  └─────────────────────┘                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Unified NFT Reward State

To reduce rent costs, use single account per NFT (instead of 3):

```rust
/// Single account per NFT
/// PDA: ["nft_reward_state", nft_asset]
pub struct UnifiedNftRewardState {
    pub nft_asset: Pubkey,
    pub creator: Pubkey,              // For patron pool lookup
    pub weight: u16,
    pub is_bundle: bool,              // Content or Bundle NFT

    // Debt for each pool type (3 pools, 1 account)
    pub content_or_bundle_debt: u128, // ContentRewardPool OR BundleRewardPool
    pub patron_debt: u128,            // CreatorPatronPool
    pub global_debt: u128,            // GlobalHolderPool

    pub created_at: i64,
}
```

**Benefits:**
- 1 account instead of 3 per NFT
- ~200 bytes vs ~600 bytes rent
- Single PDA derivation for claims

---

## Weight Tracking (Eager - On Every Mint)

### On Content NFT Mint

```rust
fn mint_content_nft(...) {
    let weight = get_rarity_weight(rarity);

    // 1. Content reward pool
    content_reward_pool.total_weight += weight;

    // 2. Creator patron pool
    creator_patron_pool.total_weight += weight;

    // 3. Global holder pool
    global_holder_pool.total_weight += weight;

    // 4. Creator weight (for ecosystem creator dist)
    creator_weight.total_weight += weight;
    creator_dist_pool.total_weight += weight;

    // 5. Create unified NFT state
    create_unified_nft_state(nft, creator, weight, is_bundle: false);
}
```

### On Bundle NFT Mint

```rust
fn mint_bundle_nft(...) {
    let weight = get_rarity_weight(rarity);

    // 1. Bundle reward pool
    bundle_reward_pool.total_weight += weight;

    // 2. Creator patron pool
    creator_patron_pool.total_weight += weight;

    // 3. Global holder pool
    global_holder_pool.total_weight += weight;

    // 4. Creator weight
    creator_weight.total_weight += weight;
    creator_dist_pool.total_weight += weight;

    // 5. Create unified NFT state
    create_unified_nft_state(nft, creator, weight, is_bundle: true);

    // 6. Distribute content share to content pools (remaining accounts)
    distribute_to_content_pools(content_share, &ctx.remaining_accounts);
}
```

### On NFT Burn

```rust
fn burn_nft(nft: Pubkey) {
    let state = fetch_unified_nft_state(nft);
    let weight = state.weight;

    // Decrement ALL pools
    if state.is_bundle {
        bundle_reward_pool.total_weight -= weight;
    } else {
        content_reward_pool.total_weight -= weight;
    }
    creator_patron_pool.total_weight -= weight;
    global_holder_pool.total_weight -= weight;
    creator_weight.total_weight -= weight;
    creator_dist_pool.total_weight -= weight;

    // Close state account
    close_unified_nft_state(nft);
}
```

---

## NFT Holder Reward Sources

Each NFT can claim from **3 pools**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     NFT HOLDER REWARD SOURCES                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  CONTENT NFT HOLDER claims from:                                        │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  1. ContentRewardPool     ←── Content mints/rentals/secondary   │    │
│  │                               + Bundle mint content share        │    │
│  │  2. CreatorPatronPool     ←── Creator membership/subscription   │    │
│  │  3. GlobalHolderPool      ←── Ecosystem subscriptions           │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  BUNDLE NFT HOLDER claims from:                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  1. BundleRewardPool      ←── Bundle mints/rentals/secondary    │    │
│  │  2. CreatorPatronPool     ←── Creator membership/subscription   │    │
│  │  3. GlobalHolderPool      ←── Ecosystem subscriptions           │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  All tracked in single UnifiedNftRewardState account                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
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

    // Level 3: NFT/Rental only - stop here
    if visibility == 3 {
        return AccessResult::Denied;
    }

    // Check 5: Is active SUBSCRIBER of creator? (visibility <= 2)
    // Note: Membership does NOT grant access, only Subscription does
    if visibility <= 2 && user_is_subscriber(user, content_entry.creator) {
        return AccessResult::Granted(AccessType::Subscriber);
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

### Revenue Sources & Distribution

| Source | Holder % | Pool(s) |
|--------|----------|---------|
| Content Mint | 12% | ContentRewardPool |
| Content Rental | 12% | ContentRewardPool |
| Content Secondary | 8% | ContentRewardPool |
| Bundle Mint | 12% | 50% BundleRewardPool + 50% ContentRewardPools |
| Bundle Rental | 12% | 50% BundleRewardPool + 50% ContentRewardPools |
| Bundle Secondary | 8% | BundleRewardPool only |
| Creator Membership | 12% | CreatorPatronPool |
| Creator Subscription | 12% | CreatorPatronPool |
| Ecosystem Subscription | 12% | GlobalHolderPool |

### Access vs Rewards

| Access Type | Content Access | Earns Rewards? |
|-------------|----------------|----------------|
| Content NFT Owner | Specific content | Yes (3 pools) |
| Bundle NFT Owner | All bundle contents | Yes (3 pools) |
| Renter | Specific content/bundle | No |
| Creator Membership | None | No (funds holder rewards) |
| Creator Subscription | Level 2 content | No (funds holder rewards) |
| Ecosystem Subscriber | Level 1 content | No (funds holder rewards) |

### Claim Instructions

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
- [ ] Create UnifiedNftRewardState account + PDA
- [ ] Create CreatorPatronPool account + PDA
- [ ] Create GlobalHolderPool account + PDA
- [ ] Create CreatorDistPool account + PDA
- [ ] Create CreatorWeight account + PDA
- [ ] Update all mint instructions to track weights in new pools (eager)
- [ ] Implement burn reconciliation for all pools

### Phase 2: Creator Patronage
- [ ] CreatorPatronConfig account (membership/subscription tiers)
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
