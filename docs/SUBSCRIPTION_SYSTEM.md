# Handcraft Subscription & Reward System

## Overview

This document describes the complete monetization and reward system:
1. **Existing Monetization** - NFT mints, rentals, secondary sales
2. **Creator Patronage** - Membership (support) and Subscription (support + access)
3. **Ecosystem Subscription** - Platform-wide content access (Spotify-style)

All systems use:
- **Immediate push distribution** for NFT mints/sales (on every transaction)
- **Epoch-based lazy distribution** for subscriptions (on first claim after epoch)
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
6. **Eager Weight Tracking** - Update all pools on every mint (user pays, cheap)
7. **Lazy Distribution** - Subscription rewards distributed on first claim after epoch

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

## Virtual RPS (Late-Mint Protection)

### The Problem

For **lazy distribution pools** (CreatorPatronPool, GlobalHolderPool, CreatorDistPool), funds accumulate in a treasury and are only distributed when someone claims after epoch ends.

```
Epoch 1:
├── Day 1: Treasury = 0 SOL, Alice mints NFT (weight 20)
├── Day 15: Treasury = 5 SOL (from subscriptions)
├── Day 28: Treasury = 9 SOL
├── Day 29: Bob mints NFT (weight 20)  ← PROBLEM
└── Day 30: Epoch ends

Without virtual RPS:
├── Distribution: 9 SOL × 12% = 1.08 SOL to holder pool
├── reward_per_share = 1.08 × PRECISION / 40 = 0.027 per weight
├── Alice claims: 20 × 0.027 = 0.54 SOL
├── Bob claims: 20 × 0.027 = 0.54 SOL  ← UNFAIR! Bob held for 1 day
```

Bob minted on Day 29 but gets the same rewards as Alice who held for 30 days.

### The Solution: Virtual RPS

When minting, calculate debt based on **what the RPS would be if treasury distributed now**:

```rust
virtual_rps = pool.reward_per_share + (treasury * share% * PRECISION) / pool.total_weight
```

This excludes the new minter from pre-existing treasury funds.

```
With virtual RPS:
├── Bob mints on Day 29
├── Treasury = 9 SOL at mint time
├── virtual_rps = 0 + (9 × 0.12 × PRECISION) / 20 = 0.054 per weight
├── Bob's debt = 20 × 0.054 = 1.08 (equals entire treasury holder share!)
├──
├── Epoch ends, distribution happens:
├── actual_rps = 0.054 per weight (same as virtual)
├── Alice claims: (20 × 0.054 - 0) / PRECISION = 1.08 SOL ✓
├── Bob claims: (20 × 0.054 - 1.08) / PRECISION = 0 SOL ✓ FAIR!
```

### Which Debts Need Virtual RPS?

| Debt Field | Pool | Distribution | Virtual RPS? |
|------------|------|--------------|--------------|
| `content_or_bundle_debt` | ContentRewardPool / BundleRewardPool | **Immediate** | **No** |
| `patron_debt` | CreatorPatronPool | **Lazy** (epoch) | **Yes** |
| `global_debt` | GlobalHolderPool | **Lazy** (epoch) | **Yes** |
| `creator_weight.reward_debt` | CreatorDistPool | **Lazy** (epoch) | **Yes** |

**Why immediate pools don't need it:**
- RPS is updated on every transaction
- No undistributed funds exist in treasury
- Pool state always reflects all past distributions

---

## NFT Debt vs Creator Debt

### Key Distinction

| Type | Operation | Reason |
|------|-----------|--------|
| **NFT Debt** | **SET** | Each NFT is independent, tracks its own entry point |
| **Creator Debt** | **ADD** | Accumulates across all NFTs the creator has |

### NFT Debt: SET

Each NFT tracks its own debt independently:

```rust
// On mint - SET (not add)
nft_state.content_or_bundle_debt = weight * pool.reward_per_share;
nft_state.patron_debt = weight * virtual_patron_rps;
nft_state.global_debt = weight * virtual_global_rps;
```

**Why SET?** Each NFT has its own lifecycle. When NFT is minted, it starts tracking from current RPS. When claimed, debt updates to current RPS. Independent of other NFTs.

### Creator Debt: ADD

Creator's debt accumulates across all their NFTs:

```rust
// On mint - ADD (not set)
creator_weight.reward_debt += nft_weight * virtual_creator_dist_rps;
```

**Why ADD?** CreatorDistPool distributes 80% of ecosystem subscription to creators by their total weight. Each new NFT adds to creator's weight AND adds corresponding debt to prevent claiming pre-existing funds.

### Verification Example

```
Setup:
├── Creator Alice has 0 NFTs, CreatorDistPool total_weight = 1000
├── Ecosystem treasury = 10 SOL
├── virtual_rps = 0 + (10 × 0.80 × PRECISION) / 1000 = 0.008 per weight

Mint 1: Alice's user mints NFT (weight 20)
├── creator_weight.total_weight = 0 + 20 = 20
├── creator_dist_pool.total_weight = 1000 + 20 = 1020
├── creator_weight.reward_debt = 0 + (20 × 0.008) = 0.16  ← ADD
├──
├── If Alice claims now (before distribution):
│   pending = (20 × 0.008 - 0.16) / PRECISION = 0 ✓

Mint 2: Another user mints Alice's NFT (weight 5)
├── creator_weight.total_weight = 20 + 5 = 25
├── creator_dist_pool.total_weight = 1020 + 5 = 1025
├── New virtual_rps = 0 + (10 × 0.80 × PRECISION) / 1025 = 0.0078
├── creator_weight.reward_debt = 0.16 + (5 × 0.0078) = 0.199  ← ADD
├──
├── If Alice claims now:
│   pending = (25 × 0.0078 - 0.199) / PRECISION ≈ 0 ✓

Distribution happens (epoch ends):
├── actual_rps = 0.0078 (matches virtual at time of last mint)
├── Alice claims: (25 × 0.0078 - 0.199) / PRECISION ≈ 0
├──
├── Alice only earns from NEW ecosystem subscriptions after her mints
```

**If we used SET instead of ADD (wrong):**
```rust
// WRONG - would reset debt on each mint
creator_weight.reward_debt = nft_weight * virtual_rps;  // Overwrites!

Mint 1: debt = 20 × 0.008 = 0.16
Mint 2: debt = 5 × 0.0078 = 0.039  ← Lost previous debt!

Alice claims: (25 × 0.0078 - 0.039) / PRECISION = 0.156 SOL
← Alice steals from pre-existing treasury!
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
- 50% (6%) → BundleRewardPool (bundle NFT holders, by weight)
- 50% (6%) → All ContentRewardPools in bundle (content NFT holders, by weight)

This prevents bundle sales from cannibalizing content sales. Users still have incentive to buy individual content.

### Bundle Rental

Same as bundle mint - 50/50 split. Renters do NOT earn rewards.

### Bundle Secondary Sale

| Recipient | Share | Destination |
|-----------|-------|-------------|
| Seller | 94% | Seller wallet |
| Creator | 4% | Creator wallet |
| Platform | 1% | Platform treasury |
| Ecosystem | 1% | Ecosystem treasury |
| **Holders** | **4%** | **Split:** 2% BundleRewardPool + 2% ContentRewardPools |

**Bundle holder rewards split (50/50):**
- 50% (2%) → BundleRewardPool (bundle NFT holders, by weight)
- 50% (2%) → All ContentRewardPools in bundle (content NFT holders, by weight)

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

## Account Update Simulations

### Content NFT Mint

| Account | Field | Update |
|---------|-------|--------|
| ContentRewardPool | `total_weight` | `+= nft_weight` |
| CreatorPatronPool | `total_weight` | `+= nft_weight` |
| GlobalHolderPool | `total_weight` | `+= nft_weight` |
| CreatorWeight | `total_weight` | `+= nft_weight` |
| CreatorDistPool | `total_weight` | `+= nft_weight` |
| UnifiedNftRewardState | (new) | Create account |

**Total: 5 account updates + 1 account creation = 6 accounts**
**Cost: ~40,000 CU (of 1,400,000 limit = 2.8%)**

### Bundle NFT Mint

| Account | Field | Update |
|---------|-------|--------|
| BundleRewardPool | `total_weight` | `+= nft_weight` |
| CreatorPatronPool | `total_weight` | `+= nft_weight` |
| GlobalHolderPool | `total_weight` | `+= nft_weight` |
| CreatorWeight | `total_weight` | `+= nft_weight` |
| CreatorDistPool | `total_weight` | `+= nft_weight` |
| UnifiedNftRewardState | (new) | Create account |
| ContentRewardPool[0..N] | `reward_per_share` | Add 6% content share |

**Total: 6 accounts + N content pools (remaining accounts)**
**Cost: ~190,000 CU for 30-item bundle (13.5% of limit)**

### NFT Burn (Content or Bundle)

| Account | Field | Update |
|---------|-------|--------|
| ContentRewardPool OR BundleRewardPool | `total_weight` | `-= nft_weight` |
| CreatorPatronPool | `total_weight` | `-= nft_weight` |
| GlobalHolderPool | `total_weight` | `-= nft_weight` |
| CreatorWeight | `total_weight` | `-= nft_weight` |
| CreatorDistPool | `total_weight` | `-= nft_weight` |
| UnifiedNftRewardState | (close) | Return rent to user |

**Total: 5 account updates + 1 account closure = 6 accounts**
**Cost: ~35,000 CU**

### Subscribe to Creator

| Account | Action |
|---------|--------|
| CreatorPatronSubscription | Create PDA |
| Streamflow Stream | Create stream: user → creator treasury |
| User Wallet | Deduct deposit amount |

**Total: 2 account creations + 1 transfer = ~30,000 CU**

No reward pool updates - just creates the stream. Treasury accumulates over time.

### Subscribe to Ecosystem

| Account | Action |
|---------|--------|
| EcosystemSubscription | Create PDA |
| Streamflow Stream | Create stream: user → ecosystem treasury |
| User Wallet | Deduct deposit amount |

**Total: 2 account creations + 1 transfer = ~30,000 CU**

No reward pool updates - just creates the stream.

---

## Distribution Approaches

### Problem: Timing Fairness

```
NFT mints/sales: Immediate distribution ✓ (no timing issue)
Subscriptions:   Treasury accumulates → Distribution later ✗ (timing issue)

If Alice sells NFT before distribution, she loses rewards she "earned"
while holding. New owner Carol gets those rewards instead.
```

### Solution: Epoch-Based Lazy Distribution

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    EPOCH-BASED LAZY DISTRIBUTION                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Rule: Whoever holds NFT when epoch ends and claims gets that epoch's   │
│        rewards. Like stock dividends with ex-dividend date.             │
│                                                                          │
│  Month 1 (Epoch 1):                                                     │
│  ├── Patrons stream to Treasury (accumulates)                           │
│  ├── No distribution happens                                            │
│  └── epoch_ended = false                                                │
│                                                                          │
│  Month 2 starts (Epoch 1 ended):                                        │
│  ├── First NFT holder to claim triggers distribution                    │
│  ├── Treasury → Pool (80/5/3/12 split)                                  │
│  ├── reward_per_share updated                                           │
│  ├── All holders can now claim from pool                                │
│  └── epoch_ended = true, last_distribution_at = now                     │
│                                                                          │
│  Key: Distribution triggered by CLAIM, not by scheduler                 │
│       NFT holders have incentive to claim (they want rewards!)          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Why Lazy Distribution?

| Approach | Monthly Cost (100k creators) | Complexity |
|----------|------------------------------|------------|
| Clockwork per creator | 0.5 SOL + 200 SOL rent | High (100k threads) |
| Clockwork batch | 0.025 SOL | Medium |
| Keeper 0.1% incentive | 100-1000 SOL | Low |
| **Lazy on claim** | **0 SOL** | **Low** |

**Lazy distribution costs nothing. Claimers pay their own transaction fees.**

### Who Triggers Distribution?

**NFT holders!** They have direct incentive - they want their rewards.

```
Bob holds Alice's NFT (weight: 20)
Alice's Treasury: 10 SOL accumulated (Month 1)
Bob's estimated share: 10 × 12% × (20/1000) = 0.024 SOL

Month 2 starts (Epoch ended):
Bob calls claim_patron_rewards(bob_nft)
├── Epoch check: now >= last_distribution + 30 days ✓
├── Distribute Alice's treasury to pool
├── Bob receives 0.024 SOL
└── Other NFT holders can now claim too
```

### What If No One Claims?

```
Creator with no active NFT holders claiming:
├── Treasury accumulates (safe, just waiting)
├── Distribution never triggered
├── Multiple epochs of rewards build up
└── Eventually someone claims, gets all accumulated rewards
```

Not a problem - funds are safe in treasury.

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

### CreatorPatronPool

One pool per creator (not per content):

```rust
/// PDA: ["creator_patron_pool", creator]
pub struct CreatorPatronPool {
    pub creator: Pubkey,
    pub reward_per_share: u128,
    pub total_weight: u64,              // Sum of ALL creator NFT weights
    pub total_deposited: u64,
    pub total_claimed: u64,
    pub last_distribution_at: i64,      // Epoch tracking
    pub epoch_duration: i64,            // 30 days in seconds
}
```

- Tracks total weight of ALL creator's NFTs (content + bundle)
- Any holder of creator's NFTs can claim from this pool

### Claim with Lazy Distribution

```rust
pub fn claim_patron_rewards(ctx: Context<ClaimPatronRewards>, nft: Pubkey) {
    let creator = ctx.accounts.nft_state.creator;
    let pool = &mut ctx.accounts.creator_patron_pool;
    let treasury = &ctx.accounts.creator_treasury;
    let now = Clock::get()?.unix_timestamp;

    // If epoch ended and treasury has funds, distribute first
    if now >= pool.last_distribution_at + pool.epoch_duration
       && treasury.lamports() > 0
    {
        // Distribute treasury to pool
        let treasury_balance = treasury.lamports();
        let creator_share = treasury_balance * 80 / 100;
        let platform_share = treasury_balance * 5 / 100;
        let ecosystem_share = treasury_balance * 3 / 100;
        let holder_share = treasury_balance * 12 / 100;

        // Transfer 80/5/3
        transfer(treasury → creator_wallet, creator_share);
        transfer(treasury → platform_treasury, platform_share);
        transfer(treasury → ecosystem_treasury, ecosystem_share);

        // Update pool reward_per_share
        pool.reward_per_share += (holder_share * PRECISION) / pool.total_weight;
        pool.total_deposited += holder_share;
        pool.last_distribution_at = now;
    }

    // Now claim from pool
    let nft_state = &mut ctx.accounts.nft_state;
    let pending = (nft_state.weight as u128 * pool.reward_per_share
                   - nft_state.patron_debt) / PRECISION;

    transfer(pool → holder, pending);
    nft_state.patron_debt = nft_state.weight as u128 * pool.reward_per_share;
}
```

### Patron Distribution Simulation

**When claim_patron_rewards() triggers distribution:**

| Account | Field | Update |
|---------|-------|--------|
| Creator Treasury PDA | `balance` | Drain to 0 |
| Creator Wallet | `balance` | `+= 80%` |
| Platform Treasury | `balance` | `+= 5%` |
| Ecosystem Treasury | `balance` | `+= 3%` |
| CreatorPatronPool | `reward_per_share` | `+= (12% * PRECISION) / total_weight` |
| CreatorPatronPool | `last_distribution_at` | `= now` |
| UnifiedNftRewardState | `patron_debt` | Update after claim |

**Total: 6 accounts + claim transfer = ~35,000 CU**

### Patron Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      CREATOR PATRONAGE FLOW                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  SUBSCRIBE (one-time):                                                  │
│  ┌──────────┐   Streamflow    ┌──────────────┐                          │
│  │   User   │ ──────────────► │   Creator    │  (accumulates over time) │
│  │  Wallet  │    streaming    │ Treasury PDA │                          │
│  └──────────┘                 └──────────────┘                          │
│                                                                          │
│  CLAIM (when epoch ends):                                               │
│  ┌──────────┐                 ┌──────────────┐                          │
│  │   NFT    │ ── claim() ──►  │ If treasury  │                          │
│  │  Holder  │                 │ has funds &  │                          │
│  └──────────┘                 │ epoch ended: │                          │
│       │                       │ DISTRIBUTE   │                          │
│       │                       └──────┬───────┘                          │
│       │                              │                                   │
│       │                              ▼                                   │
│       │         ┌────────────────────────────────────────────┐          │
│       │         │  80% → Creator Wallet                      │          │
│       │         │   5% → Platform Treasury                   │          │
│       │         │   3% → Ecosystem Treasury                  │          │
│       │         │  12% → CreatorPatronPool.reward_per_share  │          │
│       │         └────────────────────────────────────────────┘          │
│       │                              │                                   │
│       │                              ▼                                   │
│       │                   ┌──────────────────┐                          │
│       └─────────────────► │ Calculate & pay  │                          │
│                           │ holder's share   │                          │
│                           └──────────────────┘                          │
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

### GlobalHolderPool

For ecosystem subscription holder rewards (12%):

```rust
/// PDA: ["global_holder_pool"]
pub struct GlobalHolderPool {
    pub reward_per_share: u128,
    pub total_weight: u64,              // Sum of ALL NFT weights globally
    pub total_deposited: u64,
    pub total_claimed: u64,
    pub last_distribution_at: i64,      // Epoch tracking
    pub epoch_duration: i64,            // 30 days
}
```

### CreatorDistPool

For ecosystem subscription creator payouts (80%):

```rust
/// PDA: ["creator_dist_pool"]
pub struct CreatorDistPool {
    pub reward_per_share: u128,
    pub total_weight: u64,              // Sum of ALL NFT weights globally
    pub total_deposited: u64,
    pub total_claimed: u64,
    pub last_distribution_at: i64,
    pub epoch_duration: i64,
}

/// PDA: ["creator_weight", creator]
pub struct CreatorWeight {
    pub creator: Pubkey,
    pub total_weight: u64,              // Sum of creator's NFT weights
    pub reward_debt: u128,
    pub total_claimed: u64,
}
```

**Why CreatorDistPool?**
- Ecosystem subscription is platform-wide (not per-creator)
- 80% needs to go to ALL creators proportionally
- Can't distribute directly to each creator in one instruction
- Pool accumulates funds, creators pull-claim by their weight share

### Ecosystem Claim with Lazy Distribution

```rust
pub fn claim_global_holder_reward(ctx: Context<...>, nft: Pubkey) {
    let pool = &mut ctx.accounts.global_holder_pool;
    let treasury = &ctx.accounts.ecosystem_treasury;
    let now = Clock::get()?.unix_timestamp;

    // If epoch ended, distribute treasury
    if now >= pool.last_distribution_at + pool.epoch_duration
       && treasury.lamports() > 0
    {
        let balance = treasury.lamports();
        let platform_share = balance * 5 / 100;
        let ecosystem_share = balance * 3 / 100;
        let holder_share = balance * 12 / 100;
        let creator_share = balance * 80 / 100;

        // Transfers
        transfer(treasury → platform, platform_share);
        transfer(treasury → ecosystem, ecosystem_share);

        // Update pools
        global_holder_pool.reward_per_share +=
            (holder_share * PRECISION) / global_holder_pool.total_weight;
        creator_dist_pool.reward_per_share +=
            (creator_share * PRECISION) / creator_dist_pool.total_weight;

        pool.last_distribution_at = now;
    }

    // Claim holder's share
    let pending = calculate_pending(nft, pool);
    transfer(pool → holder, pending);
}
```

### Ecosystem Distribution Simulation

**When claim_global_holder_reward() triggers distribution:**

| Account | Field | Update |
|---------|-------|--------|
| Ecosystem Treasury PDA | `balance` | Drain to 0 |
| Platform Treasury | `balance` | `+= 5%` |
| Ecosystem Treasury | `balance` | `+= 3%` |
| GlobalHolderPool | `reward_per_share` | `+= (12% * PRECISION) / total_weight` |
| CreatorDistPool | `reward_per_share` | `+= (80% * PRECISION) / total_weight` |
| GlobalHolderPool | `last_distribution_at` | `= now` |

**Total: 6 accounts = ~35,000 CU**

### Ecosystem Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ECOSYSTEM SUBSCRIPTION FLOW                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  SUBSCRIBE:                                                             │
│  ┌──────────┐     Stream      ┌──────────────┐                          │
│  │  User A  │ ──────────────► │              │                          │
│  └──────────┘                 │  Ecosystem   │  (accumulates)           │
│  ┌──────────┐     Stream      │ Treasury PDA │                          │
│  │  User B  │ ──────────────► │              │                          │
│  └──────────┘                 └──────────────┘                          │
│                                                                          │
│  CLAIM (when epoch ends):                                               │
│  First claimer triggers distribution:                                   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │   5% → Platform Treasury                                         │   │
│  │   3% → Ecosystem Treasury                                        │   │
│  │  12% → GlobalHolderPool.reward_per_share                         │   │
│  │  80% → CreatorDistPool.reward_per_share                          │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  HOLDER CLAIMS:                                                         │
│  ┌─────────────────┐                                                    │
│  │ Holder (w=20)   │ → pending = (20 * rps - debt) / PRECISION         │
│  └─────────────────┘                                                    │
│                                                                          │
│  CREATOR CLAIMS:                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Creator Alice: weight 1000 (50% of 2000 total)                  │   │
│  │ Creator Bob:   weight 600  (30% of 2000 total)                  │   │
│  │                                                                  │   │
│  │ If 8 SOL in CreatorDistPool:                                    │   │
│  │   Alice claims: 8 * (1000/2000) = 4 SOL                         │   │
│  │   Bob claims:   8 * (600/2000)  = 2.4 SOL                       │   │
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
│  │                     │  Distribution: IMMEDIATE on transaction            │
│  │                     │  Claims: Content NFT holders                        │
│  └─────────────────────┘                                                     │
│                                                                              │
│  PER-BUNDLE:                                                                 │
│  ┌─────────────────────┐                                                     │
│  │ BundleRewardPool    │  Receives: Bundle mint/rent (6%) + secondary (8%)  │
│  │ (per bundle)        │  Distribution: IMMEDIATE on transaction            │
│  │                     │  Claims: Bundle NFT holders                         │
│  └─────────────────────┘                                                     │
│                                                                              │
│  PER-CREATOR:                                                                │
│  ┌─────────────────────┐                                                     │
│  │ CreatorPatronPool   │  Receives: Membership + Subscription (12%)         │
│  │ (per creator)       │  Distribution: LAZY on first claim after epoch     │
│  │                     │  Tracks: ALL creator NFT weights                    │
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
│  │ Distribution: LAZY  │  │ Distribution: LAZY  │                           │
│  │   on first claim    │  │   on first claim    │                           │
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

### On Content NFT Mint (Complete Implementation)

```rust
pub fn mint_content_nft(ctx: Context<MintContentNft>, rarity: Rarity) -> Result<()> {
    let weight = get_rarity_weight(rarity);

    // ═══════════════════════════════════════════════════════════════════
    // STEP 1: Add weight to ALL pools FIRST (before calculating virtual RPS)
    // ═══════════════════════════════════════════════════════════════════

    ctx.accounts.content_reward_pool.total_weight += weight;
    ctx.accounts.creator_patron_pool.total_weight += weight;
    ctx.accounts.global_holder_pool.total_weight += weight;
    ctx.accounts.creator_weight.total_weight += weight;
    ctx.accounts.creator_dist_pool.total_weight += weight;

    // ═══════════════════════════════════════════════════════════════════
    // STEP 2: Calculate Virtual RPS for lazy pools (include undistributed treasury)
    // ═══════════════════════════════════════════════════════════════════

    // Patron pool: 12% of creator treasury goes to holders
    let patron_treasury = ctx.accounts.creator_treasury.lamports();
    let virtual_patron_rps = if ctx.accounts.creator_patron_pool.total_weight > 0 {
        ctx.accounts.creator_patron_pool.reward_per_share
            + (patron_treasury as u128 * 12 * PRECISION / 100)
              / ctx.accounts.creator_patron_pool.total_weight as u128
    } else {
        0
    };

    // Global pool: 12% of ecosystem treasury goes to all holders
    let ecosystem_treasury = ctx.accounts.ecosystem_treasury.lamports();
    let virtual_global_rps = if ctx.accounts.global_holder_pool.total_weight > 0 {
        ctx.accounts.global_holder_pool.reward_per_share
            + (ecosystem_treasury as u128 * 12 * PRECISION / 100)
              / ctx.accounts.global_holder_pool.total_weight as u128
    } else {
        0
    };

    // Creator dist pool: 80% of ecosystem treasury goes to creators
    let virtual_creator_dist_rps = if ctx.accounts.creator_dist_pool.total_weight > 0 {
        ctx.accounts.creator_dist_pool.reward_per_share
            + (ecosystem_treasury as u128 * 80 * PRECISION / 100)
              / ctx.accounts.creator_dist_pool.total_weight as u128
    } else {
        0
    };

    // ═══════════════════════════════════════════════════════════════════
    // STEP 3: SET NFT debts (each NFT independent)
    // ═══════════════════════════════════════════════════════════════════

    let nft_state = &mut ctx.accounts.nft_reward_state;
    nft_state.nft_asset = ctx.accounts.nft_asset.key();
    nft_state.creator = ctx.accounts.creator.key();
    nft_state.weight = weight as u16;
    nft_state.is_bundle = false;
    nft_state.created_at = Clock::get()?.unix_timestamp;

    // Content pool: NO virtual RPS (immediate distribution)
    nft_state.content_or_bundle_debt = weight as u128
        * ctx.accounts.content_reward_pool.reward_per_share;

    // Patron pool: YES virtual RPS (lazy distribution)
    nft_state.patron_debt = weight as u128 * virtual_patron_rps;

    // Global pool: YES virtual RPS (lazy distribution)
    nft_state.global_debt = weight as u128 * virtual_global_rps;

    // ═══════════════════════════════════════════════════════════════════
    // STEP 4: ADD to creator debt (accumulative across all NFTs)
    // ═══════════════════════════════════════════════════════════════════

    ctx.accounts.creator_weight.reward_debt += weight as u128 * virtual_creator_dist_rps;

    Ok(())
}
```

### On Bundle NFT Mint (Complete Implementation)

```rust
pub fn mint_bundle_nft(ctx: Context<MintBundleNft>, rarity: Rarity) -> Result<()> {
    let weight = get_rarity_weight(rarity);

    // ═══════════════════════════════════════════════════════════════════
    // STEP 1: Add weight to ALL pools FIRST
    // ═══════════════════════════════════════════════════════════════════

    ctx.accounts.bundle_reward_pool.total_weight += weight;
    ctx.accounts.creator_patron_pool.total_weight += weight;
    ctx.accounts.global_holder_pool.total_weight += weight;
    ctx.accounts.creator_weight.total_weight += weight;
    ctx.accounts.creator_dist_pool.total_weight += weight;

    // ═══════════════════════════════════════════════════════════════════
    // STEP 2: Calculate Virtual RPS for lazy pools
    // ═══════════════════════════════════════════════════════════════════

    let patron_treasury = ctx.accounts.creator_treasury.lamports();
    let virtual_patron_rps = if ctx.accounts.creator_patron_pool.total_weight > 0 {
        ctx.accounts.creator_patron_pool.reward_per_share
            + (patron_treasury as u128 * 12 * PRECISION / 100)
              / ctx.accounts.creator_patron_pool.total_weight as u128
    } else {
        0
    };

    let ecosystem_treasury = ctx.accounts.ecosystem_treasury.lamports();
    let virtual_global_rps = if ctx.accounts.global_holder_pool.total_weight > 0 {
        ctx.accounts.global_holder_pool.reward_per_share
            + (ecosystem_treasury as u128 * 12 * PRECISION / 100)
              / ctx.accounts.global_holder_pool.total_weight as u128
    } else {
        0
    };

    let virtual_creator_dist_rps = if ctx.accounts.creator_dist_pool.total_weight > 0 {
        ctx.accounts.creator_dist_pool.reward_per_share
            + (ecosystem_treasury as u128 * 80 * PRECISION / 100)
              / ctx.accounts.creator_dist_pool.total_weight as u128
    } else {
        0
    };

    // ═══════════════════════════════════════════════════════════════════
    // STEP 3: SET NFT debts
    // ═══════════════════════════════════════════════════════════════════

    let nft_state = &mut ctx.accounts.nft_reward_state;
    nft_state.nft_asset = ctx.accounts.nft_asset.key();
    nft_state.creator = ctx.accounts.creator.key();
    nft_state.weight = weight as u16;
    nft_state.is_bundle = true;
    nft_state.created_at = Clock::get()?.unix_timestamp;

    // Bundle pool: NO virtual RPS (immediate distribution)
    nft_state.content_or_bundle_debt = weight as u128
        * ctx.accounts.bundle_reward_pool.reward_per_share;

    // Patron & Global: YES virtual RPS
    nft_state.patron_debt = weight as u128 * virtual_patron_rps;
    nft_state.global_debt = weight as u128 * virtual_global_rps;

    // ═══════════════════════════════════════════════════════════════════
    // STEP 4: ADD to creator debt
    // ═══════════════════════════════════════════════════════════════════

    ctx.accounts.creator_weight.reward_debt += weight as u128 * virtual_creator_dist_rps;

    // ═══════════════════════════════════════════════════════════════════
    // STEP 5: Distribute 6% content share to content pools (remaining accounts)
    // ═══════════════════════════════════════════════════════════════════

    let holder_fee = ctx.accounts.price * 12 / 100;
    let content_share = holder_fee / 2;  // 6%
    distribute_to_content_pools(content_share, &ctx.remaining_accounts);

    Ok(())
}
```

### On NFT Burn (Complete Implementation)

```rust
pub fn burn_nft(ctx: Context<BurnNft>) -> Result<()> {
    let nft_state = &ctx.accounts.nft_reward_state;
    let weight = nft_state.weight as u64;

    // ═══════════════════════════════════════════════════════════════════
    // Decrement weight from ALL pools
    // ═══════════════════════════════════════════════════════════════════

    // Content or Bundle pool
    if nft_state.is_bundle {
        ctx.accounts.bundle_reward_pool.total_weight -= weight;
    } else {
        ctx.accounts.content_reward_pool.total_weight -= weight;
    }

    // Creator patron pool
    ctx.accounts.creator_patron_pool.total_weight -= weight;

    // Global holder pool
    ctx.accounts.global_holder_pool.total_weight -= weight;

    // Creator weight & dist pool
    ctx.accounts.creator_weight.total_weight -= weight;
    ctx.accounts.creator_dist_pool.total_weight -= weight;

    // ═══════════════════════════════════════════════════════════════════
    // Reconcile creator debt (subtract the burned NFT's contribution)
    // ═══════════════════════════════════════════════════════════════════

    // Calculate what this NFT's debt contribution was at current virtual RPS
    let ecosystem_treasury = ctx.accounts.ecosystem_treasury.lamports();
    let virtual_creator_dist_rps = if ctx.accounts.creator_dist_pool.total_weight > 0 {
        ctx.accounts.creator_dist_pool.reward_per_share
            + (ecosystem_treasury as u128 * 80 * PRECISION / 100)
              / ctx.accounts.creator_dist_pool.total_weight as u128
    } else {
        0
    };

    // Subtract from creator debt (reverse of ADD on mint)
    // Note: Use min to prevent underflow if debt was already claimed
    let debt_contribution = weight as u128 * virtual_creator_dist_rps;
    ctx.accounts.creator_weight.reward_debt = ctx.accounts.creator_weight.reward_debt
        .saturating_sub(debt_contribution);

    // ═══════════════════════════════════════════════════════════════════
    // Close NFT state account (return rent to burner)
    // ═══════════════════════════════════════════════════════════════════

    // Account closure handled by Anchor close constraint

    Ok(())
}
```

### Weight Update Summary

| Operation | Pools Updated | Debt Handling |
|-----------|---------------|---------------|
| Content Mint | 5 pools + NFT state | SET NFT debts, ADD creator debt |
| Bundle Mint | 5 pools + NFT state + N content pools | SET NFT debts, ADD creator debt |
| NFT Burn | 5 pools - weight | SUB creator debt, close NFT state |

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
│  │                               (IMMEDIATE distribution)           │    │
│  │                                                                  │    │
│  │  2. CreatorPatronPool     ←── Creator membership/subscription   │    │
│  │                               (LAZY distribution on claim)       │    │
│  │                                                                  │    │
│  │  3. GlobalHolderPool      ←── Ecosystem subscriptions           │    │
│  │                               (LAZY distribution on claim)       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  BUNDLE NFT HOLDER claims from:                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  1. BundleRewardPool      ←── Bundle mints/rentals/secondary    │    │
│  │                               (IMMEDIATE distribution)           │    │
│  │                                                                  │    │
│  │  2. CreatorPatronPool     ←── Creator membership/subscription   │    │
│  │                               (LAZY distribution on claim)       │    │
│  │                                                                  │    │
│  │  3. GlobalHolderPool      ←── Ecosystem subscriptions           │    │
│  │                               (LAZY distribution on claim)       │    │
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

| Source | Holder % | Pool(s) | Distribution |
|--------|----------|---------|--------------|
| Content Mint | 12% | ContentRewardPool | Immediate |
| Content Rental | 12% | ContentRewardPool | Immediate |
| Content Secondary | 8% | ContentRewardPool | Immediate |
| Bundle Mint | 12% | 50% Bundle + 50% Content pools | Immediate |
| Bundle Rental | 12% | 50% Bundle + 50% Content pools | Immediate |
| Bundle Secondary | 8% | BundleRewardPool only | Immediate |
| Creator Membership | 12% | CreatorPatronPool | Lazy (epoch) |
| Creator Subscription | 12% | CreatorPatronPool | Lazy (epoch) |
| Ecosystem Subscription | 12% | GlobalHolderPool | Lazy (epoch) |

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

| Claim | Who Can Call | Pool | Triggers Distribution? |
|-------|--------------|------|------------------------|
| `claim_content_rewards(nft)` | Content NFT owner | ContentRewardPool | No (immediate) |
| `claim_bundle_rewards(nft)` | Bundle NFT owner | BundleRewardPool | No (immediate) |
| `claim_patron_rewards(nft)` | Any creator's NFT owner | CreatorPatronPool | Yes (if epoch ended) |
| `claim_global_holder_reward(nft)` | Any NFT owner | GlobalHolderPool | Yes (if epoch ended) |
| `claim_creator_ecosystem_payout()` | Any creator | CreatorDistPool | Yes (if epoch ended) |

### Cost Summary

| Operation | Accounts | CU Estimate |
|-----------|----------|-------------|
| Content NFT Mint | 6 | ~40,000 |
| Bundle NFT Mint (30 items) | 36 | ~190,000 |
| NFT Burn | 6 | ~35,000 |
| Subscribe to Creator | 3 | ~30,000 |
| Subscribe to Ecosystem | 3 | ~30,000 |
| Claim (with distribution) | 6 | ~35,000 |
| Claim (no distribution) | 2 | ~15,000 |

---

## Implementation Phases

### Phase 1: Foundation & Bundle Fix
- [ ] Add `visibility_level` to Content/Bundle accounts (default: 1)
- [ ] Fix bundle mint to distribute 50/50 to bundle + content pools
- [ ] Create UnifiedNftRewardState account + PDA
- [ ] Create CreatorPatronPool account + PDA (with epoch fields)
- [ ] Create GlobalHolderPool account + PDA (with epoch fields)
- [ ] Create CreatorDistPool account + PDA (with epoch fields)
- [ ] Create CreatorWeight account + PDA
- [ ] Update all mint instructions to track weights in new pools (eager)
- [ ] Implement burn reconciliation for all pools

### Phase 2: Creator Patronage
- [ ] CreatorPatronConfig account (membership/subscription tiers)
- [ ] Creator Treasury PDA for streaming
- [ ] Streamflow integration for patron streams
- [ ] `init_patron_config` instruction
- [ ] `subscribe_patron` instruction
- [ ] `claim_patron_rewards` instruction (with lazy distribution)
- [ ] SDK instruction builders
- [ ] Web: Patron setup modal (creator)
- [ ] Web: Patron subscribe modal (user)

### Phase 3: Ecosystem Subscription
- [ ] EcosystemSubConfig account
- [ ] Ecosystem Treasury PDA for streaming
- [ ] Streamflow integration for ecosystem streams
- [ ] `subscribe_ecosystem` instruction
- [ ] `claim_global_holder_reward` instruction (with lazy distribution)
- [ ] `claim_creator_ecosystem_payout` instruction
- [ ] SDK instruction builders
- [ ] Web: Ecosystem subscribe modal
- [ ] Web: Global rewards in claim modal

### Phase 4: Testing & Polish
- [ ] E2E testing all flows
- [ ] Edge cases (burn during claim, epoch boundaries, etc.)
- [ ] UI for epoch status and estimated rewards
- [ ] Documentation updates

---

*Last updated: December 12, 2025*

---

## Appendix: Order of Operations

### Critical: Weight Before Virtual RPS

When minting, the order matters:

```
1. Add weight to pools FIRST
2. Calculate virtual RPS (uses updated total_weight)
3. Set debts using virtual RPS
```

**Why this order?**

If we calculated virtual RPS before adding weight:
```
Pool total_weight = 100
New NFT weight = 20
Treasury = 10 SOL

Wrong order (virtual RPS first):
├── virtual_rps = 10 × 0.12 × PRECISION / 100 = 0.012
├── Add weight: total_weight = 120
├── debt = 20 × 0.012 = 0.24
├──
├── Later distribution: actual_rps = 10 × 0.12 × PRECISION / 120 = 0.01
├── pending = 20 × 0.01 - 0.24 = -0.04  ← NEGATIVE! Debt too high!

Correct order (weight first):
├── Add weight: total_weight = 120
├── virtual_rps = 10 × 0.12 × PRECISION / 120 = 0.01
├── debt = 20 × 0.01 = 0.20
├──
├── Later distribution: actual_rps = 10 × 0.12 × PRECISION / 120 = 0.01
├── pending = 20 × 0.01 - 0.20 = 0  ← CORRECT! Zero rewards for pre-existing funds
```

### Complete Mint Sequence

```
mint_content_nft():
├── 1. Add weight to ContentRewardPool
├── 2. Add weight to CreatorPatronPool
├── 3. Add weight to GlobalHolderPool
├── 4. Add weight to CreatorWeight
├── 5. Add weight to CreatorDistPool
├── 6. Calculate virtual_patron_rps (using updated weights)
├── 7. Calculate virtual_global_rps (using updated weights)
├── 8. Calculate virtual_creator_dist_rps (using updated weights)
├── 9. SET nft_state.content_or_bundle_debt = weight × actual_rps
├── 10. SET nft_state.patron_debt = weight × virtual_patron_rps
├── 11. SET nft_state.global_debt = weight × virtual_global_rps
└── 12. ADD creator_weight.reward_debt += weight × virtual_creator_dist_rps
```
