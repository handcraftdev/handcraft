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
- **Slot hash randomness** for rarity determination (no VRF dependency)

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

## Terminology

**Important distinctions:**

| Term | Meaning | Example |
|------|---------|---------|
| **Pool Account** | PDA that holds SOL for reward claims | ContentRewardPool, BundleRewardPool, CreatorPatronPool |
| **Treasury Account** | Permanent platform-owned account | Platform Treasury, Ecosystem Treasury |
| **Streaming Treasury** | Temporary PDA that receives subscription streams | Creator Patron Treasury, Ecosystem Subscription Treasury |

- **Pool accounts** hold actual SOL that NFT holders claim from
- **Treasury accounts** are permanent platform wallets (5% platform, 3% ecosystem fees)
- **Streaming treasuries** accumulate subscription payments before epoch distribution

---

## Fee Structure (All Sources)

**Primary (Mint / Rental / Membership / Subscription):**
```
Creator:     80%  → creator wallet (or CreatorDistPool for ecosystem subscription)
Platform:     5%  → platform treasury (permanent)
Ecosystem:    3%  → ecosystem treasury (permanent)
Holders:     12%  → Pool accounts (holds SOL for claims)
─────────────────
Total:      100%
```

**Note:** For Ecosystem Subscription specifically:
- 80% → CreatorDistPool (creators claim based on their NFT weight share)
- 12% → GlobalHolderPool (all NFT holders claim by weight)

**Secondary Sale (Resale):**
```
Seller:      90%  → seller wallet (remaining after fees)
Creator:      4%  → creator wallet (fixed royalty)
Platform:     1%  → platform treasury
Ecosystem:    1%  → ecosystem treasury
Holders:      4%  → Pool accounts (split 50/50 for bundles)
─────────────────
Total:      100%
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
| Seller | 90% | Seller wallet |
| Creator | 4% | Creator wallet (fixed royalty) |
| Platform | 1% | Platform treasury |
| Ecosystem | 1% | Ecosystem treasury |
| **Holders** | **4%** | **ContentRewardPool** (content NFT holders only) |

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
| Seller | 90% | Seller wallet |
| Creator | 4% | Creator wallet (fixed royalty) |
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

One pool per creator. **This pool account holds actual SOL for claims.**

```rust
/// PDA: ["creator_patron_pool", creator]
/// Holds SOL for NFT holder claims (12% of patron subscriptions)
pub struct CreatorPatronPool {
    pub creator: Pubkey,
    pub reward_per_share: u128,
    pub total_weight: u64,              // Sum of ALL creator NFT weights
    pub total_deposited: u64,           // Total SOL deposited into this pool
    pub total_claimed: u64,             // Total SOL claimed from this pool
    pub last_distribution_at: i64,      // Epoch tracking
    pub epoch_duration: i64,            // 30 days in seconds
}
```

### CreatorPatronStreamingTreasury

```rust
/// PDA: ["creator_patron_treasury", creator]
/// Receives Streamflow payments from subscribers, distributed at epoch end
pub struct CreatorPatronStreamingTreasury {
    // Just a PDA that accumulates SOL from subscription streams
    // No state needed - we read lamports() directly
}
```

- **CreatorPatronStreamingTreasury**: Accumulates subscription payments via Streamflow
- **CreatorPatronPool**: Receives 12% at epoch distribution, holds SOL for claims
- Any holder of creator's NFTs can claim from CreatorPatronPool

### CreatorPatronConfig

```rust
/// PDA: ["creator_patron_config", creator]
/// Creator's subscription/membership tier configuration
pub struct CreatorPatronConfig {
    pub creator: Pubkey,
    pub membership_price: u64,        // SOL per month for support-only tier (0 = disabled)
    pub subscription_price: u64,      // SOL per month for support + access tier (0 = disabled)
    pub is_active: bool,
}
```

### CreatorPatronSubscription

```rust
/// PDA: ["creator_patron_sub", subscriber, creator]
/// Tracks a user's subscription to a specific creator
pub struct CreatorPatronSubscription {
    pub subscriber: Pubkey,
    pub creator: Pubkey,
    pub tier: PatronTier,             // Membership or Subscription
    pub stream_id: Pubkey,            // Streamflow stream account
    pub started_at: i64,
    pub is_active: bool,
}

pub enum PatronTier {
    Membership,   // Support only, no access
    Subscription, // Support + Level 2 access
}
```

### Claim with Lazy Distribution

```rust
pub fn claim_patron_rewards(ctx: Context<ClaimPatronRewards>, nft: Pubkey) {
    let pool = &mut ctx.accounts.creator_patron_pool;
    let streaming_treasury = &ctx.accounts.creator_patron_streaming_treasury;
    let now = Clock::get()?.unix_timestamp;

    // ═══════════════════════════════════════════════════════════════════
    // STEP 1: If epoch ended, distribute streaming treasury
    // ═══════════════════════════════════════════════════════════════════

    maybe_distribute_patron_pool(pool, streaming_treasury, now, &ctx.accounts);

    // ═══════════════════════════════════════════════════════════════════
    // STEP 2: Claim from pool (with saturating subtraction)
    // ═══════════════════════════════════════════════════════════════════

    let nft_state = &mut ctx.accounts.nft_reward_state;
    let weighted_rps = nft_state.weight as u128 * pool.reward_per_share;

    // Saturating subtraction prevents underflow if debt > weighted_rps
    // (can happen if claiming before distribution when virtual RPS was used at mint)
    let pending = weighted_rps.saturating_sub(nft_state.patron_debt) / PRECISION;

    if pending > 0 {
        // Transfer SOL from pool account to holder
        **pool.to_account_info().try_borrow_mut_lamports()? -= pending as u64;
        **ctx.accounts.holder.try_borrow_mut_lamports()? += pending as u64;

        pool.total_claimed += pending as u64;

        // ONLY update debt if we actually claimed (preserves virtual RPS protection)
        nft_state.patron_debt = weighted_rps;
    }
    // If pending = 0, debt stays unchanged
}

/// Shared distribution logic - called by BOTH mint and claim
fn maybe_distribute_patron_pool(
    pool: &mut CreatorPatronPool,
    streaming_treasury: &AccountInfo,
    now: i64,
    accounts: &...,
) {
    if now >= pool.last_distribution_at + pool.epoch_duration
       && streaming_treasury.lamports() > 0
    {
        let balance = streaming_treasury.lamports();
        let creator_share = balance * 80 / 100;
        let platform_share = balance * 5 / 100;
        let ecosystem_share = balance * 3 / 100;
        let holder_share = balance * 12 / 100;

        // Transfer to permanent accounts (80/5/3)
        transfer(streaming_treasury → creator_wallet, creator_share);
        transfer(streaming_treasury → platform_treasury, platform_share);
        transfer(streaming_treasury → ecosystem_treasury, ecosystem_share);

        // Transfer 12% to pool account (holds SOL for claims)
        transfer(streaming_treasury → pool, holder_share);

        // Update pool accounting
        pool.reward_per_share += (holder_share as u128 * PRECISION) / pool.total_weight as u128;
        pool.total_deposited += holder_share;
        pool.last_distribution_at = now;
    }
}
```

### Patron Distribution Simulation

**When claim_patron_rewards() triggers distribution:**

| Account | Field | Update |
|---------|-------|--------|
| CreatorPatronStreamingTreasury | `lamports` | Drain to 0 |
| Creator Wallet | `lamports` | `+= 80%` |
| Platform Treasury | `lamports` | `+= 5%` |
| Ecosystem Treasury | `lamports` | `+= 3%` |
| CreatorPatronPool | `lamports` | `+= 12%` (SOL transferred in) |
| CreatorPatronPool | `reward_per_share` | `+= (12% * PRECISION) / total_weight` |
| CreatorPatronPool | `total_deposited` | `+= 12%` |
| CreatorPatronPool | `last_distribution_at` | `= now` |
| UnifiedNftRewardState | `patron_debt` | Update after claim |

**Total: 6 accounts + claim transfer = ~40,000 CU**

### Patron Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      CREATOR PATRONAGE FLOW                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  SUBSCRIBE (one-time setup):                                            │
│  ┌──────────┐   Streamflow    ┌─────────────────────────┐               │
│  │   User   │ ──────────────► │  CreatorPatronStreaming │ (accumulates) │
│  │  Wallet  │    streaming    │       Treasury          │               │
│  └──────────┘                 └─────────────────────────┘               │
│                                                                          │
│  CLAIM (when epoch ends):                                               │
│  ┌──────────┐                 ┌─────────────────────────┐               │
│  │   NFT    │ ── claim() ──►  │ If streaming treasury   │               │
│  │  Holder  │                 │ has funds & epoch ended │               │
│  └──────────┘                 │ → DISTRIBUTE            │               │
│       │                       └──────────┬──────────────┘               │
│       │                                  │                               │
│       │                                  ▼                               │
│       │         ┌────────────────────────────────────────────┐          │
│       │         │  80% → Creator Wallet (permanent)          │          │
│       │         │   5% → Platform Treasury (permanent)       │          │
│       │         │   3% → Ecosystem Treasury (permanent)      │          │
│       │         │  12% → CreatorPatronPool (SOL transferred) │          │
│       │         └────────────────────────────────────────────┘          │
│       │                                  │                               │
│       │                                  ▼                               │
│       │                   ┌──────────────────────────┐                  │
│       └─────────────────► │ Transfer SOL from        │                  │
│                           │ CreatorPatronPool        │                  │
│                           │ to holder's wallet       │                  │
│                           └──────────────────────────┘                  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Ecosystem Subscription

### Concept

Users pay platform for access to ALL Level 1 content. Revenue distributed:
- 80% to creators (by their NFT weight share) → CreatorDistPool
- 12% to all NFT holders (by weight) → GlobalHolderPool
- 5% to Platform Treasury (permanent)
- 3% to Ecosystem Treasury (permanent)

### EcosystemStreamingTreasury

```rust
/// PDA: ["ecosystem_streaming_treasury"]
/// Receives Streamflow payments from ecosystem subscribers
pub struct EcosystemStreamingTreasury {
    // Just a PDA that accumulates SOL from subscription streams
    // No state needed - we read lamports() directly
}
```

### EcosystemSubConfig

```rust
/// PDA: ["ecosystem_sub_config"]
/// Platform-wide ecosystem subscription configuration (singleton)
pub struct EcosystemSubConfig {
    pub price: u64,                   // SOL per month for ecosystem access
    pub is_active: bool,
    pub authority: Pubkey,            // Admin who can update config
}
```

### EcosystemSubscription

```rust
/// PDA: ["ecosystem_sub", subscriber]
/// Tracks a user's ecosystem subscription
pub struct EcosystemSubscription {
    pub subscriber: Pubkey,
    pub stream_id: Pubkey,            // Streamflow stream account
    pub started_at: i64,
    pub is_active: bool,
}
```

### GlobalHolderPool

For ecosystem subscription holder rewards (12%). **This pool account holds actual SOL.**

```rust
/// PDA: ["global_holder_pool"]
/// Holds SOL for NFT holder claims (12% of ecosystem subscriptions)
pub struct GlobalHolderPool {
    pub reward_per_share: u128,
    pub total_weight: u64,              // Sum of ALL NFT weights globally
    pub total_deposited: u64,           // Total SOL deposited into this pool
    pub total_claimed: u64,             // Total SOL claimed from this pool
}
```

### CreatorDistPool

For ecosystem subscription creator payouts (80%). **This pool account holds actual SOL.**

```rust
/// PDA: ["creator_dist_pool"]
/// Holds SOL for creator claims (80% of ecosystem subscriptions)
pub struct CreatorDistPool {
    pub reward_per_share: u128,
    pub total_weight: u64,              // Sum of ALL NFT weights globally
    pub total_deposited: u64,           // Total SOL deposited into this pool
    pub total_claimed: u64,             // Total SOL claimed from this pool
}
```

### EcosystemEpochState

**Shared epoch state for GlobalHolderPool and CreatorDistPool** (both distribute from same streaming treasury):

```rust
/// PDA: ["ecosystem_epoch_state"]
/// Shared epoch tracking for ecosystem subscription distribution
pub struct EcosystemEpochState {
    pub last_distribution_at: i64,      // When last epoch distribution happened
    pub epoch_duration: i64,            // 30 days in seconds
}
```

### CreatorWeight

```rust
/// PDA: ["creator_weight", creator]
pub struct CreatorWeight {
    pub creator: Pubkey,
    pub total_weight: u64,              // Sum of creator's NFT weights
    pub reward_debt: u128,              // For CreatorDistPool claims
    pub total_claimed: u64,
}
```

**Why separate pools with shared epoch?**
- GlobalHolderPool and CreatorDistPool both source from EcosystemStreamingTreasury
- They must distribute at the same time (same epoch boundary)
- But they hold SOL separately for clear accounting
- Shared EcosystemEpochState ensures synchronized distribution

### Ecosystem Claim with Lazy Distribution

**Single instruction handles both holder claim AND triggers distribution for both pools:**

```rust
pub fn claim_ecosystem_rewards(ctx: Context<ClaimEcosystemRewards>, nft: Pubkey) {
    let now = Clock::get()?.unix_timestamp;

    // ═══════════════════════════════════════════════════════════════════
    // STEP 1: If epoch ended, distribute streaming treasury to BOTH pools
    // ═══════════════════════════════════════════════════════════════════

    maybe_distribute_ecosystem_pools(&mut ctx.accounts, now);

    // ═══════════════════════════════════════════════════════════════════
    // STEP 2: Claim holder's share from GlobalHolderPool (saturating subtraction)
    // ═══════════════════════════════════════════════════════════════════

    let nft_state = &mut ctx.accounts.nft_reward_state;
    let pool = &mut ctx.accounts.global_holder_pool;

    let weighted_rps = nft_state.weight as u128 * pool.reward_per_share;
    let pending = weighted_rps.saturating_sub(nft_state.global_debt) / PRECISION;

    if pending > 0 {
        // Transfer SOL from pool account to holder
        **pool.to_account_info().try_borrow_mut_lamports()? -= pending as u64;
        **ctx.accounts.holder.try_borrow_mut_lamports()? += pending as u64;

        pool.total_claimed += pending as u64;

        // ONLY update debt if we actually claimed
        nft_state.global_debt = weighted_rps;
    }
}

/// Shared distribution logic - called by BOTH mint and claim
fn maybe_distribute_ecosystem_pools(accounts: &mut ..., now: i64) {
    let epoch_state = &mut accounts.ecosystem_epoch_state;
    let streaming_treasury = &accounts.ecosystem_streaming_treasury;

    if now >= epoch_state.last_distribution_at + epoch_state.epoch_duration
       && streaming_treasury.lamports() > 0
    {
        let balance = streaming_treasury.lamports();
        let platform_share = balance * 5 / 100;
        let ecosystem_share = balance * 3 / 100;
        let holder_share = balance * 12 / 100;
        let creator_share = balance * 80 / 100;

        // Transfer to permanent treasuries (5% + 3%)
        transfer(streaming_treasury → platform_treasury, platform_share);
        transfer(streaming_treasury → ecosystem_treasury, ecosystem_share);

        // Transfer SOL to pool accounts (12% + 80%)
        transfer(streaming_treasury → global_holder_pool, holder_share);
        transfer(streaming_treasury → creator_dist_pool, creator_share);

        // Update pool accounting
        accounts.global_holder_pool.reward_per_share +=
            (holder_share as u128 * PRECISION) / accounts.global_holder_pool.total_weight as u128;
        accounts.global_holder_pool.total_deposited += holder_share;

        accounts.creator_dist_pool.reward_per_share +=
            (creator_share as u128 * PRECISION) / accounts.creator_dist_pool.total_weight as u128;
        accounts.creator_dist_pool.total_deposited += creator_share;

        // Update shared epoch state
        epoch_state.last_distribution_at = now;
    }
}
```

### Creator Ecosystem Payout

**Separate instruction for creators to claim their 80% share:**

```rust
pub fn claim_creator_ecosystem_payout(ctx: Context<ClaimCreatorPayout>) {
    let now = Clock::get()?.unix_timestamp;

    // ═══════════════════════════════════════════════════════════════════
    // STEP 1: Trigger distribution if epoch ended (same logic as holder claim)
    // ═══════════════════════════════════════════════════════════════════

    maybe_distribute_ecosystem_pools(&mut ctx.accounts, now);

    // ═══════════════════════════════════════════════════════════════════
    // STEP 2: Claim creator's share from CreatorDistPool (saturating subtraction)
    // ═══════════════════════════════════════════════════════════════════

    let creator_weight = &mut ctx.accounts.creator_weight;
    let pool = &mut ctx.accounts.creator_dist_pool;

    let weighted_rps = creator_weight.total_weight as u128 * pool.reward_per_share;
    let pending = weighted_rps.saturating_sub(creator_weight.reward_debt) / PRECISION;

    if pending > 0 {
        // Transfer SOL from pool account to creator
        **pool.to_account_info().try_borrow_mut_lamports()? -= pending as u64;
        **ctx.accounts.creator.try_borrow_mut_lamports()? += pending as u64;

        pool.total_claimed += pending as u64;
        creator_weight.total_claimed += pending as u64;

        // ONLY update debt if we actually claimed
        creator_weight.reward_debt = weighted_rps;
    }
}
```

**Note:** Either `claim_ecosystem_rewards` or `claim_creator_ecosystem_payout` can trigger the epoch distribution. Whichever is called first after epoch ends will distribute to BOTH pools (GlobalHolderPool and CreatorDistPool) using the shared EcosystemEpochState.

### Ecosystem Distribution Simulation

**When `claim_ecosystem_rewards()` or `claim_creator_ecosystem_payout()` triggers distribution:**

| Account | Field | Update |
|---------|-------|--------|
| EcosystemStreamingTreasury | `lamports` | Drain to 0 |
| Platform Treasury | `lamports` | `+= 5%` |
| Ecosystem Treasury | `lamports` | `+= 3%` |
| GlobalHolderPool | `lamports` | `+= 12%` (SOL transferred in) |
| GlobalHolderPool | `reward_per_share` | `+= (12% * PRECISION) / total_weight` |
| GlobalHolderPool | `total_deposited` | `+= 12%` |
| CreatorDistPool | `lamports` | `+= 80%` (SOL transferred in) |
| CreatorDistPool | `reward_per_share` | `+= (80% * PRECISION) / total_weight` |
| CreatorDistPool | `total_deposited` | `+= 80%` |
| EcosystemEpochState | `last_distribution_at` | `= now` |

**Total: 6 accounts = ~40,000 CU**

### Ecosystem Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ECOSYSTEM SUBSCRIPTION FLOW                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  SUBSCRIBE:                                                             │
│  ┌──────────┐     Stream      ┌──────────────────────┐                  │
│  │  User A  │ ──────────────► │                      │                  │
│  └──────────┘                 │  EcosystemStreaming  │  (accumulates)   │
│  ┌──────────┐     Stream      │     Treasury         │                  │
│  │  User B  │ ──────────────► │                      │                  │
│  └──────────┘                 └──────────────────────┘                  │
│                                                                          │
│  CLAIM (when epoch ends):                                               │
│  First claimer triggers distribution to BOTH pools:                     │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │   5% → Platform Treasury (permanent)                             │   │
│  │   3% → Ecosystem Treasury (permanent)                            │   │
│  │  12% → GlobalHolderPool (SOL transferred, holds for claims)      │   │
│  │  80% → CreatorDistPool (SOL transferred, holds for claims)       │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  HOLDER CLAIMS (from GlobalHolderPool):                                 │
│  ┌─────────────────┐                                                    │
│  │ Holder (w=20)   │ → SOL transferred from pool to holder wallet      │
│  │                 │   pending = (20 * rps - debt) / PRECISION         │
│  └─────────────────┘                                                    │
│                                                                          │
│  CREATOR CLAIMS (from CreatorDistPool):                                 │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Creator Alice: weight 1000 (50% of 2000 total)                  │   │
│  │ Creator Bob:   weight 600  (30% of 2000 total)                  │   │
│  │                                                                  │   │
│  │ If 8 SOL in CreatorDistPool:                                    │   │
│  │   Alice claims: 8 * (1000/2000) = 4 SOL from pool               │   │
│  │   Bob claims:   8 * (600/2000)  = 2.4 SOL from pool             │   │
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
│  │ ContentRewardPool   │  Receives: Content mint/rent (12%) + secondary (4%)│
│  │ (per content)       │  + Bundle mint/rent/secondary content share         │
│  │ ** Holds SOL **     │  Distribution: IMMEDIATE on transaction            │
│  │                     │  Claims: Content NFT holders                        │
│  └─────────────────────┘                                                     │
│                                                                              │
│  PER-BUNDLE:                                                                 │
│  ┌─────────────────────┐                                                     │
│  │ BundleRewardPool    │  Receives: Bundle mint/rent (6%) + secondary (2%)  │
│  │ (per bundle)        │  Distribution: IMMEDIATE on transaction            │
│  │ ** Holds SOL **     │  Claims: Bundle NFT holders                         │
│  └─────────────────────┘                                                     │
│                                                                              │
│  PER-CREATOR:                                                                │
│  ┌─────────────────────┐                                                     │
│  │ CreatorPatronPool   │  Receives: Membership + Subscription (12%)         │
│  │ (per creator)       │  Distribution: LAZY on first claim after epoch     │
│  │ ** Holds SOL **     │  Claims: Any holder of creator's NFTs               │
│  └─────────────────────┘                                                     │
│                                                                              │
│  GLOBAL (SINGLETONS):                                                        │
│  ┌─────────────────────┐  ┌─────────────────────┐                           │
│  │ GlobalHolderPool    │  │ CreatorDistPool     │                           │
│  │ ** Holds SOL **     │  │ ** Holds SOL **     │                           │
│  │                     │  │                     │                           │
│  │ Receives: Ecosystem │  │ Receives: Ecosystem │                           │
│  │   subscription 12%  │  │   subscription 80%  │                           │
│  │                     │  │                     │                           │
│  │ Distribution: LAZY  │  │ Distribution: LAZY  │                           │
│  │ (shared epoch)      │  │ (shared epoch)      │                           │
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
    let now = Clock::get()?.unix_timestamp;

    // ═══════════════════════════════════════════════════════════════════
    // STEP 0: Trigger epoch distribution if needed (Option B: distribute on mint AND claim)
    // This ensures RPS reflects all past epochs before we add new weight
    // ═══════════════════════════════════════════════════════════════════

    maybe_distribute_patron_pool(
        &mut ctx.accounts.creator_patron_pool,
        &ctx.accounts.creator_patron_streaming_treasury,
        now,
        &ctx.accounts,
    );
    maybe_distribute_ecosystem_pools(&mut ctx.accounts, now);

    // ═══════════════════════════════════════════════════════════════════
    // STEP 1: Add weight to ALL pools (after any distribution)
    // ═══════════════════════════════════════════════════════════════════

    ctx.accounts.content_reward_pool.total_weight += weight;
    ctx.accounts.creator_patron_pool.total_weight += weight;
    ctx.accounts.global_holder_pool.total_weight += weight;
    ctx.accounts.creator_weight.total_weight += weight;
    ctx.accounts.creator_dist_pool.total_weight += weight;

    // ═══════════════════════════════════════════════════════════════════
    // STEP 2: Calculate Virtual RPS for lazy pools (include undistributed streaming treasury)
    // ═══════════════════════════════════════════════════════════════════

    // Patron pool: 12% of creator's streaming treasury goes to holders
    let streaming_balance = ctx.accounts.creator_patron_streaming_treasury.lamports();
    let virtual_patron_rps = if ctx.accounts.creator_patron_pool.total_weight > 0 {
        ctx.accounts.creator_patron_pool.reward_per_share
            + (streaming_balance as u128 * 12 * PRECISION / 100)
              / ctx.accounts.creator_patron_pool.total_weight as u128
    } else {
        0
    };

    // Global pool: 12% of ecosystem streaming treasury goes to all holders
    let eco_streaming_balance = ctx.accounts.ecosystem_streaming_treasury.lamports();
    let virtual_global_rps = if ctx.accounts.global_holder_pool.total_weight > 0 {
        ctx.accounts.global_holder_pool.reward_per_share
            + (eco_streaming_balance as u128 * 12 * PRECISION / 100)
              / ctx.accounts.global_holder_pool.total_weight as u128
    } else {
        0
    };

    // Creator dist pool: 80% of ecosystem streaming treasury goes to creators
    let virtual_creator_dist_rps = if ctx.accounts.creator_dist_pool.total_weight > 0 {
        ctx.accounts.creator_dist_pool.reward_per_share
            + (eco_streaming_balance as u128 * 80 * PRECISION / 100)
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
    let now = Clock::get()?.unix_timestamp;

    // ═══════════════════════════════════════════════════════════════════
    // STEP 0: Trigger epoch distribution if needed (Option B: distribute on mint AND claim)
    // This ensures RPS reflects all past epochs before we add new weight
    // ═══════════════════════════════════════════════════════════════════

    maybe_distribute_patron_pool(
        &mut ctx.accounts.creator_patron_pool,
        &ctx.accounts.creator_patron_streaming_treasury,
        now,
        &ctx.accounts,
    );
    maybe_distribute_ecosystem_pools(&mut ctx.accounts, now);

    // ═══════════════════════════════════════════════════════════════════
    // STEP 1: Add weight to ALL pools (after any distribution)
    // ═══════════════════════════════════════════════════════════════════

    ctx.accounts.bundle_reward_pool.total_weight += weight;
    ctx.accounts.creator_patron_pool.total_weight += weight;
    ctx.accounts.global_holder_pool.total_weight += weight;
    ctx.accounts.creator_weight.total_weight += weight;
    ctx.accounts.creator_dist_pool.total_weight += weight;

    // ═══════════════════════════════════════════════════════════════════
    // STEP 2: Calculate Virtual RPS for lazy pools (include undistributed streaming treasury)
    // ═══════════════════════════════════════════════════════════════════

    let streaming_balance = ctx.accounts.creator_patron_streaming_treasury.lamports();
    let virtual_patron_rps = if ctx.accounts.creator_patron_pool.total_weight > 0 {
        ctx.accounts.creator_patron_pool.reward_per_share
            + (streaming_balance as u128 * 12 * PRECISION / 100)
              / ctx.accounts.creator_patron_pool.total_weight as u128
    } else {
        0
    };

    let eco_streaming_balance = ctx.accounts.ecosystem_streaming_treasury.lamports();
    let virtual_global_rps = if ctx.accounts.global_holder_pool.total_weight > 0 {
        ctx.accounts.global_holder_pool.reward_per_share
            + (eco_streaming_balance as u128 * 12 * PRECISION / 100)
              / ctx.accounts.global_holder_pool.total_weight as u128
    } else {
        0
    };

    let virtual_creator_dist_rps = if ctx.accounts.creator_dist_pool.total_weight > 0 {
        ctx.accounts.creator_dist_pool.reward_per_share
            + (eco_streaming_balance as u128 * 80 * PRECISION / 100)
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
    let eco_streaming_balance = ctx.accounts.ecosystem_streaming_treasury.lamports();
    let virtual_creator_dist_rps = if ctx.accounts.creator_dist_pool.total_weight > 0 {
        ctx.accounts.creator_dist_pool.reward_per_share
            + (eco_streaming_balance as u128 * 80 * PRECISION / 100)
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

## Immediate Pool Claims (Content & Bundle)

These claims are simpler than lazy pool claims - no epoch distribution needed.

### claim_content_rewards

```rust
pub fn claim_content_rewards(ctx: Context<ClaimContentRewards>, nft: Pubkey) {
    let nft_state = &mut ctx.accounts.nft_reward_state;
    let pool = &mut ctx.accounts.content_reward_pool;

    // Verify this is a content NFT (not bundle)
    require!(!nft_state.is_bundle, ErrorCode::InvalidNftType);

    let weighted_rps = nft_state.weight as u128 * pool.reward_per_share;
    let pending = weighted_rps.saturating_sub(nft_state.content_or_bundle_debt) / PRECISION;

    if pending > 0 {
        // Transfer SOL from pool account to holder
        **pool.to_account_info().try_borrow_mut_lamports()? -= pending as u64;
        **ctx.accounts.holder.try_borrow_mut_lamports()? += pending as u64;

        pool.total_claimed += pending as u64;
        nft_state.content_or_bundle_debt = weighted_rps;
    }
}
```

### claim_bundle_rewards

```rust
pub fn claim_bundle_rewards(ctx: Context<ClaimBundleRewards>, nft: Pubkey) {
    let nft_state = &mut ctx.accounts.nft_reward_state;
    let pool = &mut ctx.accounts.bundle_reward_pool;

    // Verify this is a bundle NFT
    require!(nft_state.is_bundle, ErrorCode::InvalidNftType);

    let weighted_rps = nft_state.weight as u128 * pool.reward_per_share;
    let pending = weighted_rps.saturating_sub(nft_state.content_or_bundle_debt) / PRECISION;

    if pending > 0 {
        // Transfer SOL from pool account to holder
        **pool.to_account_info().try_borrow_mut_lamports()? -= pending as u64;
        **ctx.accounts.holder.try_borrow_mut_lamports()? += pending as u64;

        pool.total_claimed += pending as u64;
        nft_state.content_or_bundle_debt = weighted_rps;
    }
}
```

**Note:** These immediate pool claims are simpler because:
- No epoch distribution needed (rewards added immediately on each mint/sale)
- Uses `saturating_sub` for safety (though shouldn't be needed for immediate pools)
- Just read current pool RPS and calculate pending

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
| Content Secondary | 4% | ContentRewardPool | Immediate |
| Bundle Mint | 12% | 50% Bundle + 50% Content pools | Immediate |
| Bundle Rental | 12% | 50% Bundle + 50% Content pools | Immediate |
| Bundle Secondary | 4% | 50% Bundle + 50% Content pools | Immediate |
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
| `claim_ecosystem_rewards(nft)` | Any NFT owner | GlobalHolderPool + CreatorDistPool | Yes (if epoch ended, both pools) |
| `claim_creator_ecosystem_payout()` | Any creator | CreatorDistPool | Yes (if epoch ended, both pools) |

**Note:** `claim_ecosystem_rewards` and `claim_creator_ecosystem_payout` share EcosystemEpochState. Whichever is called first triggers distribution to BOTH GlobalHolderPool and CreatorDistPool.

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

## Account Initialization

### Singleton Accounts (One-Time Setup)

These accounts are created once by admin:

```rust
pub fn initialize_ecosystem_pools(ctx: Context<InitEcosystemPools>) -> Result<()> {
    // GlobalHolderPool - PDA: ["global_holder_pool"]
    let holder_pool = &mut ctx.accounts.global_holder_pool;
    holder_pool.reward_per_share = 0;
    holder_pool.total_weight = 0;
    holder_pool.total_deposited = 0;
    holder_pool.total_claimed = 0;

    // CreatorDistPool - PDA: ["creator_dist_pool"]
    let dist_pool = &mut ctx.accounts.creator_dist_pool;
    dist_pool.reward_per_share = 0;
    dist_pool.total_weight = 0;
    dist_pool.total_deposited = 0;
    dist_pool.total_claimed = 0;

    // EcosystemEpochState - PDA: ["ecosystem_epoch_state"]
    let epoch_state = &mut ctx.accounts.ecosystem_epoch_state;
    epoch_state.last_distribution_at = Clock::get()?.unix_timestamp;
    epoch_state.epoch_duration = 30 * 24 * 60 * 60; // 30 days

    Ok(())
}
```

### Per-Creator Accounts (Lazy Initialization)

Created on first NFT mint for a creator:

```rust
// In mint_content_nft or mint_bundle_nft:
// If CreatorPatronPool doesn't exist, create it
if ctx.accounts.creator_patron_pool.total_weight == 0 {
    // First NFT for this creator - initialize pool
    ctx.accounts.creator_patron_pool.creator = ctx.accounts.creator.key();
    ctx.accounts.creator_patron_pool.epoch_duration = 30 * 24 * 60 * 60;
    ctx.accounts.creator_patron_pool.last_distribution_at = Clock::get()?.unix_timestamp;
}

// If CreatorWeight doesn't exist, create it
if ctx.accounts.creator_weight.total_weight == 0 {
    ctx.accounts.creator_weight.creator = ctx.accounts.creator.key();
}
```

### Per-NFT Accounts

Created on each NFT mint (UnifiedNftRewardState).

---

## Implementation Phases

### Phase 1: Foundation & Pool Accounts ✅ (Complete)
- [x] Add `visibility_level` to Content/Bundle accounts (default: 0)
- [x] **Fix bundle mint to distribute 50/50 to bundle + content pools**
- [x] Create UnifiedNftRewardState account + PDA
- [x] Create CreatorPatronPool account + PDA (holds SOL, has epoch fields)
- [x] Create GlobalHolderPool account + PDA (holds SOL, singleton)
- [x] Create CreatorDistPool account + PDA (holds SOL, singleton)
- [x] Create EcosystemEpochState account + PDA (shared epoch tracking)
- [x] Create CreatorWeight account + PDA (per creator)
- [x] Create CreatorPatronStreamingTreasury PDA (receives subscription payments)
- [x] Create EcosystemStreamingTreasury PDA (receives ecosystem subscription payments)
- [x] Implement `initialize_ecosystem_pools` instruction (admin, one-time)
- [x] Implement `initialize_ecosystem_sub_config` instruction
- [x] Implement `register_nft_in_subscription_pools` instruction (creates UnifiedNftRewardState)
- [x] Implement `register_bundle_nft_in_subscription_pools` instruction
- [x] **Simplified mint system** (replaced VRF with slot hash randomness):
  - [x] `simple_mint` - Content NFT with slot hash randomness + full subscription pool tracking
  - [x] `simple_mint_bundle` - Bundle NFT with slot hash randomness + full subscription pool tracking
  - [x] Removed all VRF-based mint instructions (commit_mint, reveal_mint, magicblock_*, direct_mint)
  - [x] Lazy-init CreatorPatronPool and CreatorWeight on first mint
  - [x] Track weights in all pools (eager)
  - [x] **Call `maybe_distribute_*` at start of mint (Option B - full implementation)**
  - [x] **Calculate virtual RPS using streaming treasury balances**
  - [x] Set debts with virtual RPS for lazy pools
  - [x] **SDK: `simpleMintInstruction` with streaming treasury accounts**
  - [x] **SDK: `simpleMintBundleInstruction` with streaming treasury accounts**
- [x] Implement `claim_unified_content_rewards` and `claim_unified_bundle_rewards` instructions
- [x] Implement `claim_patron_rewards` instruction
- [x] Implement `claim_global_holder_rewards` instruction
- [x] Implement `claim_creator_ecosystem_payout` instruction
- [x] Implement burn reconciliation for all pools (`burn_nft_with_subscription`, `burn_bundle_nft_with_subscription`)

### Phase 2: Creator Patronage ✅ (Complete)
- [x] CreatorPatronConfig account (membership/subscription tiers)
- [x] CreatorPatronStreamingTreasury PDA (receives subscription payments for lazy distribution)
- [x] `init_patron_config` instruction
- [x] `update_patron_config` instruction
- [x] `subscribe_patron` instruction (payment to streaming treasury)
- [x] `cancel_patron_subscription` instruction
- [x] `renew_patron_subscription` instruction (payment to streaming treasury)
- [x] SDK types: `CreatorPatronConfig`, `CreatorPatronSubscription`, `PatronTier`
- [x] SDK PDAs: `getCreatorPatronConfigPda`, `getCreatorPatronSubscriptionPda`, `getCreatorPatronTreasuryPda`
- [ ] Web: Patron setup modal (creator)
- [ ] Web: Patron subscribe modal (user)

### Phase 3: Ecosystem Subscription ✅ (Complete)
- [x] EcosystemSubConfig account
- [x] EcosystemStreamingTreasury PDA (receives subscription payments for lazy distribution)
- [x] `subscribe_ecosystem` instruction (payment to streaming treasury)
- [x] `cancel_ecosystem_subscription` instruction
- [x] `renew_ecosystem_subscription` instruction (payment to streaming treasury)
- [x] `check_subscription_access` instruction (verifies access for visibility level)
- [x] SDK types: `EcosystemSubConfig`, `EcosystemSubscription`, `VisibilityLevel`
- [x] SDK PDAs: `getEcosystemSubConfigPda`, `getEcosystemSubscriptionPda`, `getEcosystemStreamingTreasuryPda`
- [x] SDK helpers: `isSubscriptionValid`, `calculateSubscriptionPendingReward`
- [x] SDK cleanup: Deprecated legacy PDA functions (getNftRewardStatePda, getNftRarityPda, etc.)
- [ ] Web: Ecosystem subscribe modal
- [ ] Web: Global rewards in claim modal

### Phase 4: Streamflow Integration (Future - Optional)
- [ ] Integrate Streamflow SDK for continuous streaming payments
- [ ] Update subscribe instructions to create streams instead of lump-sum payments
- [ ] Add stream cancellation handling with pro-rata refunds
- [ ] Automatic renewal via stream continuation

### Phase 5: Testing & Polish ✅ (Core Tests Complete)
- [x] E2E testing: `simple_mint` with subscription pool tracking
- [x] E2E testing: Patron subscription (payment to streaming treasury)
- [x] E2E testing: Ecosystem subscription (payment to streaming treasury)
- [x] E2E testing: Content reward claims
- [x] E2E testing: Virtual RPS calculations protect late minters
- [ ] E2E testing: `simple_mint_bundle` with 50/50 distribution
- [ ] E2E testing: Subscription renew/cancel flows
- [ ] E2E testing: Patron/global holder claims (after epoch distribution)
- [x] E2E testing: Burn reconciliation updates all pools (verified with common & uncommon NFTs)
- [ ] Edge cases (burn during claim, epoch boundaries)
- [ ] UI for epoch status and estimated rewards

**Test Results (December 13, 2025):**
| Test | Status | Details |
|------|--------|---------|
| Register Content | ✅ | Content + MintConfig + Collection created |
| Simple Mint #1 | ✅ | NFT with rarity, weight tracked in 3 pools |
| Init Patron Config | ✅ | Creator sets membership/subscription prices |
| Subscribe Patron | ✅ | 0.05 SOL → streaming treasury |
| Subscribe Ecosystem | ✅ | 0.1 SOL → streaming treasury |
| Simple Mint #2 | ✅ | Generates 12% holder rewards (0.006 SOL) |
| Claim Content Rewards | ✅ | NFT #1 claimed 0.006 SOL successfully |
| Rarity Distribution | ✅ | Chi-square 4.87 < 9.49 threshold (statistically valid) |
| Pool Weight Tracking (Mint) | ✅ | All 5 pools correctly increment on mint |
| Burn Common NFT | ✅ | All 5 pools correctly decrement by weight=1 |
| Burn Uncommon NFT | ✅ | All 5 pools correctly decrement by weight=5 |

---

## Current Implementation Notes

### Simplified Mint System (Current)
The mint system uses **slot hash randomness** instead of external VRF:
- Single transaction mint (no commit/reveal or callback required)
- Rarity determined by `solana_sha256_hasher::hashv()` using slot hashes sysvar
- **Full subscription integration:**
  - Includes streaming treasury accounts for epoch-based lazy distribution
  - Calls `maybe_distribute_patron_pool` and `maybe_distribute_ecosystem_pools` at start (Option B)
  - Calculates virtual RPS using streaming treasury balances
  - Sets debts using virtual RPS to protect early minters
- **Available instructions:**
  - `simple_mint` - Content NFT with full subscription pool tracking
  - `simple_mint_bundle` - Bundle NFT with full subscription pool tracking
- **Removed instructions:**
  - `mint_nft_sol` - Legacy mint without rarity
  - `commit_mint`, `reveal_mint`, `cancel_expired_mint` - VRF commit/reveal flow
  - `magicblock_*` - All MagicBlock VRF instructions (content and bundle)
  - `direct_mint`, `direct_mint_bundle` - Slot hash mint without subscription pools

### Streaming Treasury Accounts in Mint
The `simple_mint` and `simple_mint_bundle` instructions include:
```rust
// Streaming treasury accounts (for lazy distribution)
pub creator_patron_treasury: AccountInfo<'info>,      // PDA: ["creator_patron_treasury", creator]
pub ecosystem_streaming_treasury: AccountInfo<'info>, // PDA: ["ecosystem_streaming_treasury"]
pub ecosystem_epoch_state: Account<'info, EcosystemEpochState>, // PDA: ["ecosystem_epoch_state"]
pub platform_treasury: AccountInfo<'info>,            // For distribution transfers
pub ecosystem_treasury: AccountInfo<'info>,           // For distribution transfers
```

### Rarity Determination
```rust
let slot_hashes_data = ctx.accounts.slot_hashes.try_borrow_data()?;
let randomness_seed = solana_sha256_hasher::hashv(&[
    &slot_hashes_data[..64],
    nft_asset_key.as_ref(),
    payer_key.as_ref(),
    &timestamp.to_le_bytes(),
    &clock.slot.to_le_bytes(),
]);
let (rarity, weight) = determine_rarity_from_bytes(randomness_seed.to_bytes());
```

### Distribution at Mint Time (Option B)
```rust
// STEP 2.5: Trigger epoch distribution if needed (Option B - call first)
// Patron pool distribution (drains creator_patron_treasury at epoch end)
maybe_distribute_patron_pool(
    &mut ctx.accounts.creator_patron_pool,
    &ctx.accounts.creator_patron_treasury,
    &ctx.accounts.creator,
    &ctx.accounts.platform_treasury,
    &ctx.accounts.ecosystem_treasury,
    timestamp,
)?;

// Ecosystem pools distribution (drains ecosystem_streaming_treasury at epoch end)
maybe_distribute_ecosystem_pools(
    &mut ctx.accounts.global_holder_pool,
    &mut ctx.accounts.creator_dist_pool,
    &mut ctx.accounts.ecosystem_epoch_state,
    &ctx.accounts.ecosystem_streaming_treasury,
    &ctx.accounts.platform_treasury,
    &ctx.accounts.ecosystem_treasury,
    timestamp,
)?;
```

### Virtual RPS Calculation
```rust
// Get streaming treasury balances for virtual RPS calculation
let patron_treasury_balance = ctx.accounts.creator_patron_treasury.lamports();
let eco_treasury_balance = ctx.accounts.ecosystem_streaming_treasury.lamports();

// Patron pool virtual RPS (12% of streaming treasury goes to holder pool)
let virtual_patron_rps = calculate_virtual_rps(
    ctx.accounts.creator_patron_pool.reward_per_share,
    patron_treasury_balance,
    12, // holder share percentage
    ctx.accounts.creator_patron_pool.total_weight + weight as u64,
);

// Global holder pool virtual RPS (12% of ecosystem treasury)
let virtual_global_rps = calculate_virtual_rps(
    ctx.accounts.global_holder_pool.reward_per_share,
    eco_treasury_balance,
    12, // holder share percentage
    ctx.accounts.global_holder_pool.total_weight + weight as u64,
);

// Creator dist pool virtual RPS (80% of ecosystem treasury)
let virtual_creator_dist_rps = calculate_virtual_rps(
    ctx.accounts.creator_dist_pool.reward_per_share,
    eco_treasury_balance,
    80, // creator share percentage
    ctx.accounts.creator_dist_pool.total_weight + weight as u64,
);
```

### Bundle 50/50 Distribution
When minting a bundle NFT, the 12% holder reward amount is split equally:
- **50% (6%) → BundleRewardPool** - Rewards bundle NFT holders
- **50% (6%) → ContentRewardPools** - Distributed equally among all content items in the bundle

```rust
// 50/50 HOLDER REWARD DISTRIBUTION
if had_existing_nfts && holder_reward_amount > 0 {
    let bundle_share = holder_reward_amount / 2;  // 6% of mint price
    let content_share = holder_reward_amount - bundle_share;  // 6% of mint price

    // Send 50% to BundleRewardPool
    ctx.accounts.bundle_reward_pool.add_rewards(bundle_share);

    // Distribute 50% to ContentRewardPools (via remaining_accounts)
    for pool_info in ctx.remaining_accounts.iter() {
        // Transfer SOL and update reward_per_share
    }
}
```

**SDK Usage:**
```typescript
// Pass content CIDs to enable 50/50 distribution
const contentCids = ['QmContent1...', 'QmContent2...', 'QmContent3...'];
const { instruction, nftAsset, edition } = await simpleMintBundleInstruction(
  program,
  buyer,
  bundleId,
  creator,
  treasury,
  platform,
  collectionAsset,
  contentCids  // Pass content CIDs for ContentRewardPool distribution
);
```

### Simplified Subscription Model (Current)
The current implementation uses **direct SOL payments** instead of Streamflow streaming:
- User pays full 30-day subscription amount upfront
- Subscription valid for 30 days from `started_at` timestamp
- User must manually renew before expiration
- Fee distribution happens immediately on subscribe/renew

### Fee Distribution on Subscribe
| Pool | Patron Sub | Ecosystem Sub |
|------|-----------|---------------|
| Creator wallet | 80% | - |
| Creator Dist Pool | - | 80% |
| Patron Pool (per creator) | 12% | - |
| Global Holder Pool | - | 12% |
| Platform Treasury | 5% | 5% |
| Ecosystem Treasury | 3% | 3% |

### Subscription Validity Check
```typescript
function isSubscriptionValid(startedAt: bigint, now?: number): boolean {
  const currentTime = now ?? Math.floor(Date.now() / 1000);
  const epochDuration = 30 * 24 * 60 * 60; // 30 days
  return currentTime < Number(startedAt) + epochDuration;
}
```

### On-Chain Access Check
The `check_subscription_access` instruction verifies:
1. Content visibility level (0=Public, 1=Basic, 2=CreatorSubscription)
2. For level 1: Valid ecosystem subscription
3. For level 2: Valid creator subscription (Subscription tier, not Membership)

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
├── 0. Trigger epoch distribution if needed (Option B)
│   ├── maybe_distribute_patron_pool() - if epoch ended
│   └── maybe_distribute_ecosystem_pools() - if epoch ended
├── 1. Add weight to ContentRewardPool
├── 2. Add weight to CreatorPatronPool
├── 3. Add weight to GlobalHolderPool
├── 4. Add weight to CreatorWeight
├── 5. Add weight to CreatorDistPool
├── 6. Calculate virtual_patron_rps (using updated weights + streaming treasury)
├── 7. Calculate virtual_global_rps (using updated weights + streaming treasury)
├── 8. Calculate virtual_creator_dist_rps (using updated weights + streaming treasury)
├── 9. SET nft_state.content_or_bundle_debt = weight × actual_rps
├── 10. SET nft_state.patron_debt = weight × virtual_patron_rps
├── 11. SET nft_state.global_debt = weight × virtual_global_rps
└── 12. ADD creator_weight.reward_debt += weight × virtual_creator_dist_rps
```

---

*Last updated: December 13, 2025 - E2E tests passed (rarity, pool weights, burn reconciliation), subscription system deployed to devnet*

---

## Next Steps (Priority Order)

### Immediate (Before Production)

1. **E2E Testing** (Phase 5) - ✅ CORE TESTS COMPLETE
   - [x] Test `simple_mint` content NFT with full subscription pool tracking
   - [x] Test subscription flows: subscribe (patron & ecosystem)
   - [x] Test claim flows: content rewards
   - [x] Test virtual RPS calculations protect late minters
   - [x] Test rarity distribution (chi-square validation passed)
   - [x] Test pool weight tracking on mint (all 5 pools)
   - [x] Test burn reconciliation decrements weight from all 5 pools (common & uncommon NFTs)
   - [ ] Test `simple_mint_bundle` with 50/50 holder reward distribution
   - [ ] Test subscription renew/cancel flows
   - [ ] Test claim flows: patron, global holder, creator payout
   - [ ] Test epoch distribution triggers on first claim after 30 days

2. **Init Ecosystem Script** - ✅ COMPLETE
   - [x] Update `scripts/init-ecosystem.ts` to initialize all subscription pools
   - [x] Initialize GlobalHolderPool, CreatorDistPool, EcosystemEpochState singletons
   - [x] Initialize EcosystemSubConfig with default price (0.1 SOL)

3. **SDK Subscription Helpers** - ✅ COMPLETE
   - [x] Add `initPatronConfigInstruction` for creator setup
   - [x] Add `subscribePatronInstruction` and `cancelPatronSubscriptionInstruction`
   - [x] Add `subscribeEcosystemInstruction` and `cancelEcosystemSubscriptionInstruction`
   - [x] Add `claimUnifiedContentRewardsInstruction` (uses UnifiedNftRewardState)
   - [x] Add `claimPatronRewardsInstruction` for patron pool claims
   - [x] Add `claimGlobalHolderRewardsInstruction` for ecosystem holder claims
   - [x] Export all subscription PDA helpers in client

### Short-term (For User Testing)

4. **Web UI - Patron System**
   - [ ] Creator: Patron setup modal (set membership/subscription prices)
   - [ ] User: Patron subscribe modal (choose tier, pay SOL)
   - [ ] Display patron subscription status on creator profile

5. **Web UI - Ecosystem Subscription**
   - [ ] Ecosystem subscribe modal with price display
   - [ ] Global rewards display in claim modal
   - [ ] Subscription status indicator in navigation

6. **Web UI - Claims Enhancement**
   - [ ] Show all claimable pools for an NFT (content/bundle + patron + global)
   - [ ] Batch claim across multiple pools
   - [ ] Estimated rewards before claim

### Future (Phase 4 - Streamflow - Optional)

7. **Streamflow Integration**
   - Replace lump-sum payments with continuous streams
   - Automatic renewal via stream continuation
   - Pro-rata refunds on cancellation

---

## Technical Debt

| Issue | Severity | Description | Status |
|-------|----------|-------------|--------|
| Streamflow | Low | Using simplified direct payments instead of streams | Planned |
| Bundle secondary | Low | Secondary sales don't yet distribute 50/50 (only primary mints) | Planned |
| ~~Missing PermanentBurnDelegate~~ | ~~High~~ | ~~`simple_mint` and `simple_mint_bundle` don't add `PermanentBurnDelegate` plugin when creating NFTs, preventing burns~~ | **Fixed & Verified Dec 13, 2025** |

### Bug Fix: PermanentBurnDelegate Plugin (Dec 13, 2025)

**Problem:** NFTs minted with `simple_mint` and `simple_mint_bundle` could not be burned because they were missing the `PermanentBurnDelegate` plugin.

**Root cause:** The `CreateV2CpiBuilder` calls in `simple_mint.rs` didn't include the `.plugins()` call that adds the burn delegate, unlike the helper function `create_core_nft()` in `lib.rs`.

**Fix:** Added `PermanentBurnDelegate` plugin to both `simple_mint` and `simple_mint_bundle` instructions:

```rust
use mpl_core::types::{Plugin, PluginAuthority, PluginAuthorityPair, PermanentBurnDelegate};

// Create PermanentBurnDelegate plugin with content_collection PDA as authority
let burn_delegate_plugin = PluginAuthorityPair {
    plugin: Plugin::PermanentBurnDelegate(PermanentBurnDelegate {}),
    authority: Some(PluginAuthority::Address {
        address: ctx.accounts.content_collection.key()
    }),
};

CreateV2CpiBuilder::new(&ctx.accounts.mpl_core_program)
    .asset(&ctx.accounts.nft_asset)
    // ... other fields ...
    .plugins(vec![burn_delegate_plugin])  // <-- Added this
    .invoke_signed(&[content_collection_seeds, nft_seeds])?;
```

**Impact:** NFTs minted before this fix cannot be burned via `burn_nft_with_subscription`. Only newly minted NFTs (after fix) will have the burn delegate plugin.

**Verification:** Burn functionality tested and verified working:
- Common NFT (weight: 1) - All 5 pools decremented correctly
- Uncommon NFT (weight: 5) - All 5 pools decremented correctly
- UnifiedNftRewardState account closed and rent refunded to user
