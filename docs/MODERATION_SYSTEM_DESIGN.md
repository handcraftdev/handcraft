# Moderation System Design

## Overview

A decentralized, creator-funded content moderation system where creators stake SOL to publish content, reporters bond SOL to submit reports, and moderators vote with stake-weighted power.

---

## Roles

### Creator
- Stakes SOL into a pool to publish content
- Pool covers all creator's content
- Loses stake equal to reporter bond if content is removed

### Reporter
- Pays bond to submit a report (any amount, minimum 0.01 SOL)
- Bond amount shows seriousness of report
- Bond cannot exceed creator's available pool
- Loses bond if report is dismissed
- Receives 50% of creator's slashed stake if report is upheld
- Cannot be a moderator voter on their own report
- Builds reputation through accurate reports
- Higher reputation = lower minimum bond requirement

### Moderator
- Stakes SOL to become a moderator (minimum 0.1 SOL)
- Allocates portion of stake per vote (minimum 10% of reporter bond)
- Earns rewards from resolved reports
- Builds reputation through correct votes

---

## Stake & Bond Requirements

| Role | Minimum | Maximum | Lock Period |
|------|---------|---------|-------------|
| Creator Pool | 0.1 SOL | None | Until withdraw (available only) |
| Reporter Bond | 0.01 SOL × rep_multiplier | Creator's available pool | Until resolution |
| Moderator Total Stake | 0.1 SOL | None | Until withdraw (available only) |
| Moderator Vote Allocation | 10% of reporter bond | Moderator's available stake | 7 days |

**Reporter Bond Multiplier** (reputation-based):
```
multiplier = sqrt(0.5 / reporter_reputation)
min_bond = 0.01 SOL × multiplier

100% rep: 0.71x → 0.007 SOL min
50% rep:  1.0x  → 0.01 SOL min (baseline)
25% rep:  1.41x → 0.014 SOL min
10% rep:  2.24x → 0.022 SOL min
```

---

## Creator Pool

### Structure

```
Creator Pool
├── total_stake: Total SOL deposited
├── available: Can be reported against / withdrawn
├── held: Locked by pending reports
└── Invariant: total_stake = available + held
```

### Behavior

- Creator deposits SOL to pool before publishing content
- When report submitted: `available -= bond`, `held += bond`
- When report dismissed: `available += bond`, `held -= bond`
- When report upheld: `total_stake -= bond`, `held -= bond`
- Creator can only withdraw from `available`, not `held`
- Creator can add stake anytime (increases `available`)

### Content Publishing

- Content cannot be published if creator has no pool
- Content remains accessible as long as pool exists
- If pool reaches 0, content may be disabled/hidden

---

## Report Submission

### Constraints

```
bond >= 0.01 SOL                    // Minimum bond
bond <= creator_pool.available       // Cannot exceed creator's available
reporter != creator                  // Cannot self-report
reporter != moderator (for this report)  // Cannot vote on own report
```

### Actions

1. Transfer bond from reporter to escrow
2. Hold equivalent amount from creator pool
3. Start 1-day voting period
4. Record report details (content, category, evidence CID)

### Cumulative Reports (Same Content)

When multiple reporters report the same content:

```
Report 1 on Content X: 0.1 SOL bond
  → Creator holds 0.1 SOL
  → 1-day voting starts

Report 2 on Content X (within voting period): 0.05 SOL bond
  → Adds to existing report (no new voting period)
  → Creator now holds 0.15 SOL total
  → Reporter 2 joins reporter pool

Total bond pool: 0.15 SOL
```

**Reward Distribution (if Upheld)**:
```
Creator loses: 0.15 SOL (total bonds)

Reporter rewards (50% of pot = 0.075 SOL):
  Reporter 1: 0.075 × (0.10 / 0.15) = 0.05 SOL
  Reporter 2: 0.075 × (0.05 / 0.15) = 0.025 SOL

Moderator rewards: remaining 0.075 SOL (split by weight)
```

**If Dismissed**: All reporters lose their bonds to moderators.

### Different Content Reports

- Multiple reports on different content processed independently
- Each holds its own bond from creator pool
- Limited by remaining available balance
- First-come, first-served basis

---

## Moderator Voting

### Voting Power Formula

```
voting_power = sqrt(stake_allocated) × (reputation / 10000) × sqrt(votes_cast + 1)
```

All three factors use quadratic scaling:

**Quadratic Stake** (`sqrt(stake)`):
- Diminishing returns for large stakes
- Protection against whale takeover
- Sybil resistance (splitting stake reduces total power)

**Quadratic Votes** (`sqrt(votes_cast + 1)`):
- +1 ensures first vote has power (sqrt(1) = 1)
- No artificial cap - more contribution always adds value
- Diminishing returns reward consistency over bursts
- Long-term moderators more valuable than new accounts

**Vote Power Growth**:
```
Votes    sqrt(v+1)    Power multiplier
0        1.0          1x (first vote works)
1        1.41         1.41x
3        2.0          2x
8        3.0          3x
24       5.0          5x
99       10.0         10x
399      20.0         20x
```

**Account Hopping Prevention**:
```
Old account: 30% rep, 100 votes
  Power factor = 0.30 × sqrt(101) = 0.30 × 10.05 = 3.01

New account: 50% rep, 0 votes
  Power factor = 0.50 × sqrt(1) = 0.50

To match old account:
  0.50 × sqrt(x+1) = 3.01 → x = 35 votes needed

Veteran moderator always has advantage over fresh accounts.
```

### Vote Allocation

- Moderator chooses how much stake to allocate per vote
- Minimum allocation: 10% of reporter bond
- Maximum allocation: Moderator's available stake
- Allocated stake locked for 7 days
- Higher allocation = more voting power = more potential reward

### Voting Period

- Duration: 1 day from report submission (fast resolution)
- Stake lock: 7 days (prevents gaming)
- No early resolution
- Votes are final (no changing)

### Vote Choices

- **Remove**: Content violates rules, should be removed
- **Keep**: Content is acceptable, report is invalid
- **Abstain**: No opinion (no reputation impact)

---

## Resolution

### Outcome Determination

```
total_remove_power = sum(voting_power) for Remove votes
total_keep_power = sum(voting_power) for Keep votes
total_power = total_remove_power + total_keep_power

if total_power == 0:
    outcome = NoParticipation (no votes cast)
else if total_remove_power > total_power × 0.5:
    outcome = Upheld (content removed)
else:
    outcome = Dismissed
```

Note: Simple majority (>50%) of weighted votes determines outcome.

### Reward Distribution

#### If No Participation (No Votes Cast)

```
No moderators voted during the 7-day period.

Reporter: Bond returned (no penalty)
Creator: Held amount released back to available
Moderators: Nothing (no one participated)

This protects reporters when moderator pool is inactive.
```

#### If Upheld (Content Removed)

```
Pot = creator_held amount (from creator pool)

Reporter receives: 50% of pot
Correct Moderators: 50% of pot, split by reward_weight

reward_weight = sqrt(stake_allocated) × (reputation / 10000) × sqrt(votes_cast + 1)
moderator_share = (moderator_reward_weight / total_correct_weight) × pot × 0.5
```

#### If Dismissed

```
Pot = reporter_bond

Correct Moderators: 100% of pot, split by reward_weight
Reporter: Loses entire bond
```

#### Quadratic Rewards

Rewards are distributed quadratically:
- Prevents large stakers from taking disproportionate rewards
- New moderators with low reputation earn minimal
- Incentivizes building reputation over time

---

## Reputation System

### Initial State

- New moderators start at 50% reputation (5000 basis points)
- No hard minimum or maximum reputation
- Reputation asymptotically approaches 0% and 100% but never reaches them

### Asymptotic Reputation Updates

Reputation changes are calculated as a percentage of current/remaining reputation:

```
On Incorrect Vote (Loss):
  change = current_reputation × loss_rate × s_curve_multiplier
  new_reputation = current_reputation - change

On Correct Vote (Gain):
  remaining = 100% - current_reputation
  change = remaining × gain_rate × s_curve_multiplier
  new_reputation = current_reputation + change

On Abstain:
  No change
```

This ensures:
- Reputation never reaches 0% (always losing a percentage of remaining)
- Reputation never reaches 100% (always gaining a percentage of gap)
- Low reputation moderators have smaller absolute losses
- High reputation moderators have smaller absolute gains

### S-Curve Multiplier

Two S-curves provide variable speed based on position:

```
              Grace Zone
                  │
                 ╭┴╮
    Fast Loss   ╱   ╲   Fast Gain
               ╱     ╲
              ╱       ╲
    Slow at ─╯         ╰─ Slow at
    Extremes             Extremes

    0%   25%    50%    75%   100%
```

**Behavior by Zone**:

| Zone | Multiplier | Purpose |
|------|------------|---------|
| Near 50% (40-60%) | 0.1x | Grace period for new moderators |
| Middle (25-40%, 60-75%) | 1.0x | Normal accountability zone |
| Extremes (0-25%, 75-100%) | 0.3x | Slow approach to limits |

**S-Curve Formula**:

```
For reputation R (as decimal 0-1):

if R >= 0.5:  // Above 50%
    distance = (R - 0.5) / 0.5  // 0 to 1
    multiplier = s_curve(distance)
else:  // Below 50%
    distance = (0.5 - R) / 0.5  // 0 to 1
    multiplier = s_curve(distance)

s_curve(d) = 0.1 + 0.9 × (4d² × (1-d)² × 16)  // Peak at d=0.5
```

### Correct vs Incorrect

- **Correct**: Vote aligned with final outcome
  - Remove vote + Upheld outcome
  - Keep vote + Dismissed outcome
- **Incorrect**: Vote opposed final outcome
  - Remove vote + Dismissed outcome
  - Keep vote + Upheld outcome

### Reputation Impact

- Affects voting power: `sqrt(stake) × reputation`
- Affects reward share: `sqrt(stake) × reputation`
- Low reputation = low influence = low earnings
- Natural progression through consistent correct voting
- Grace period at 50% allows new moderators to learn

### Example Calculations

```
Moderator at 50% reputation (5000 bps):
├── S-curve multiplier: 0.1x (grace zone)
├── Incorrect vote: 5000 × 0.03 × 0.1 = -15 bps → 4985 bps (49.85%)
└── Correct vote: 5000 × 0.01 × 0.1 = +5 bps → 5005 bps (50.05%)

Moderator at 75% reputation (7500 bps):
├── S-curve multiplier: 1.0x (accountability zone)
├── Incorrect vote: 7500 × 0.03 × 1.0 = -225 bps → 7275 bps (72.75%)
└── Correct vote: 2500 × 0.01 × 1.0 = +25 bps → 7525 bps (75.25%)

Moderator at 20% reputation (2000 bps):
├── S-curve multiplier: 0.3x (extreme zone)
├── Incorrect vote: 2000 × 0.03 × 0.3 = -18 bps → 1982 bps (19.82%)
└── Correct vote: 8000 × 0.01 × 0.3 = +24 bps → 2024 bps (20.24%)

Moderator at 95% reputation (9500 bps):
├── S-curve multiplier: 0.3x (extreme zone)
├── Incorrect vote: 9500 × 0.03 × 0.3 = -85.5 bps → 9414 bps (94.14%)
└── Correct vote: 500 × 0.01 × 0.3 = +1.5 bps → 9501 bps (95.01%)
```

### Recovery Scenarios

```
From 50% with 1 incorrect vote:
  50% → 49.85% (grace zone, minimal impact)

From 75% with 1 incorrect vote:
  75% → 72.75% (accountability zone, significant impact)
  Recovery: ~10 correct votes to return to 75%

From 20% building back up:
  Slow gains due to large "remaining" but also slow multiplier
  ~50 correct votes to reach 50%
```

---

## Reporter Reputation

Reporters also have reputation, using the same S-curve system as moderators.

### Initial State

- New reporters start at 50% reputation (5000 basis points)
- No hard minimum or maximum (asymptotic)

### Reputation Updates

```
On Upheld Report (reporter was correct):
  remaining = 100% - current_reputation
  change = remaining × gain_rate × s_curve_multiplier
  new_reputation = current_reputation + change

On Dismissed Report (reporter was wrong):
  change = current_reputation × loss_rate × s_curve_multiplier
  new_reputation = current_reputation - change
```

Uses same S-curve multiplier zones as moderator (grace at 50%, fast at 25%/75%, slow at extremes).

### Bond Requirement

Higher reputation = lower minimum bond (quadratic):

```
multiplier = sqrt(0.5 / reporter_reputation)
min_bond = BASE_REPORTER_BOND × multiplier

Examples:
  100% rep → 0.71x multiplier → lower barrier for trusted reporters
  50% rep  → 1.0x multiplier  → baseline for new reporters
  25% rep  → 1.41x multiplier → higher cost for poor track record
  10% rep  → 2.24x multiplier → significant penalty for spam reporters
```

### Benefits

- Trusted reporters get easier access
- Spam reporters pay increasing costs
- Self-correcting: bad actors priced out over time
- No hard bans needed - economic deterrent

---

## Stake Locking

### Moderator Stake Lock

```
Per Vote:
├── Allocation locked for 7 days from vote
├── Cannot be used for other votes during lock
├── Cannot be withdrawn during lock
└── Unlocks after 7 days (regardless of resolution timing)
```

### Example

```
Moderator total stake: 1 SOL

Day 1: Vote on Report A, allocate 0.3 SOL
├── Available: 0.7 SOL
└── Locked: 0.3 SOL (unlocks Day 8)

Day 2: Vote on Report B, allocate 0.4 SOL
├── Available: 0.3 SOL
└── Locked: 0.7 SOL

Day 3: Vote on Report C, allocate 0.5 SOL
└── REJECTED: Only 0.3 SOL available

Day 8: Report A lock expires
├── Available: 0.6 SOL
└── Locked: 0.4 SOL (Report B until Day 9)
```

### Stake Withdrawal (Reputation-Based Return)

When moderator withdraws stake, return percentage is based on current reputation:

```
if reputation >= 50%:
    return_percentage = 100%
else:
    return_percentage = reputation × 2

slashed_amount = stake × (1 - return_percentage)
slashed_amount → Treasury
```

**Examples**:
```
Moderator with 1 SOL stake:

At 50% rep: return 100% → 1.0 SOL back, 0 to treasury
At 40% rep: return 80%  → 0.8 SOL back, 0.2 to treasury
At 25% rep: return 50%  → 0.5 SOL back, 0.5 to treasury
At 10% rep: return 20%  → 0.2 SOL back, 0.8 to treasury
```

**Implications**:
- New moderators (50%) can exit with full stake
- Bad actors face real economic loss
- Incentivizes maintaining reputation above 50%
- Abandoned low-rep accounts = treasury gains
- Cannot withdraw locked stake (must wait for unlock)

---

## Attack Resistance

### Sybil Attack (Multiple Fake Moderators)

**Attack**: Create many moderator accounts to control votes.

**Defense**:
- Quadratic voting: `sqrt(stake)` penalizes splitting stake
- Minimum stake per account: 0.1 SOL
- Minimum allocation per vote: 10% of reporter bond
- Cost increases faster than benefit

**Example**:
```
1 account × 1 SOL = sqrt(1) = 1.0 power
10 accounts × 0.1 SOL = 10 × sqrt(0.1) = 3.16 power

But cost is same (1 SOL total), and:
- 10x account management overhead
- 10x minimum allocations needed
- Reputation must be built on each account
```

### Whale Takeover

**Attack**: One person stakes massive amount to control all votes.

**Defense**:
- Quadratic diminishing returns
- Reputation still matters (new whale starts at 50%)
- Stake lock limits parallel attacks

**Example**:
```
Whale: 100 SOL, 50% rep
  Power: sqrt(100) × 0.5 = 5.0

Community: 10 moderators × 1 SOL, 80% avg rep
  Power: 10 × sqrt(1) × 0.8 = 8.0

Community wins despite 10x less capital
```

### Moderator Collusion

**Attack**: Group coordinates to always vote Remove.

**Defense**:
- Incorrect votes lose reputation fast (-3%)
- Low reputation = low voting power
- Low reputation = low reward share
- Economic incentive to vote correctly

### Spam Reports

**Attack**: Flood with low-bond reports.

**Defense**:
- Minimum bond: 0.01 SOL
- Reporter loses bond if dismissed
- Bond limited by creator's available pool
- Economic cost per report

### Pool Drain Attack

**Attack**: Coordinate high-bond reports to drain creator.

**Defense**:
- Bond cannot exceed creator's available pool
- Sequential processing limits parallel attacks
- Creator can add stake to defend
- Attackers lose bonds if dismissed

### Self-Voting Exploit

**Attack**: Report own content, vote to dismiss, collect bonds.

**Defense**:
- Reporter cannot vote on own report
- Different wallets still cost stake
- Quadratic reduces benefit of splitting

### Account Hopping

**Attack**: Abandon low-reputation account, create new one at 50%.

**Defense**:
- Quadratic votes: `sqrt(votes_cast + 1)` in power formula
- New accounts have base power but veterans scale much higher
- Vote history compounds value over time
- No cap means veterans always have advantage

**Example**:
```
Old account: 30% rep, 100 votes
  Power factor = 0.30 × sqrt(101) = 3.01

New account: 50% rep, 0 votes
  Power factor = 0.50 × sqrt(1) = 0.50

After 24 votes on new account:
  Power factor = 0.50 × sqrt(25) = 2.5 (still less!)

After 35 votes on new account:
  Power factor = 0.50 × sqrt(36) = 3.0 (break even)

Veteran at 80% rep, 400 votes:
  Power factor = 0.80 × sqrt(401) = 16.0
  New account needs: 0.50 × sqrt(x+1) = 16 → x = 1023 votes!
```

---

## State Accounts

### CreatorPool

```rust
pub struct CreatorPool {
    pub creator: Pubkey,
    pub total_stake: u64,
    pub available: u64,
    pub held: u64,
    pub created_at: i64,
}
```

### ModeratorAccount

```rust
pub struct ModeratorAccount {
    pub moderator: Pubkey,
    pub total_stake: u64,
    pub available_stake: u64,
    pub reputation: u16,          // Basis points (0-10000)
    pub votes_cast: u64,
    pub correct_votes: u64,
    pub is_active: bool,
    pub joined_at: i64,
}
```

### ReporterAccount

```rust
pub struct ReporterAccount {
    pub reporter: Pubkey,
    pub reputation: u16,          // Basis points (0-10000)
    pub reports_submitted: u64,
    pub reports_upheld: u64,
    pub reports_dismissed: u64,
    pub created_at: i64,
}
```

### ContentReport

```rust
pub struct ContentReport {
    pub content: Pubkey,
    pub creator: Pubkey,
    pub category: ReportCategory,
    pub total_bond: u64,           // Sum of all reporter bonds
    pub creator_held: u64,         // Amount held from creator pool
    pub reporter_count: u16,       // Number of reporters
    pub status: ReportStatus,
    pub outcome: ResolutionOutcome,
    pub votes_remove_weight: u64,  // Scaled by 1e9
    pub votes_keep_weight: u64,    // Scaled by 1e9
    pub voting_ends_at: i64,
    pub resolved_at: Option<i64>,
    pub created_at: i64,
}
```

### ReporterRecord

```rust
pub struct ReporterRecord {
    pub report: Pubkey,
    pub reporter: Pubkey,
    pub bond: u64,
    pub details_cid: String,       // Evidence CID from this reporter
    pub reward_claimed: bool,
    pub reported_at: i64,
}
```

### VoteRecord

```rust
pub struct VoteRecord {
    pub report: Pubkey,
    pub moderator: Pubkey,
    pub choice: VoteChoice,
    pub stake_allocated: u64,
    pub voting_power: u64,        // Scaled by 1e9
    pub unlock_at: i64,
    pub reputation_processed: bool,
    pub reward_claimed: bool,
    pub voted_at: i64,
}
```

### Treasury

```rust
pub struct Treasury {
    pub authority: Pubkey,        // Admin or DAO
    pub balance: u64,             // Accumulated from slashed stakes
    pub total_collected: u64,     // Lifetime total
}
```

**Treasury receives funds from**:
- Moderator stake slashing (reputation < 50% on withdrawal)

---

## Instructions

### Creator Instructions

| Instruction | Description |
|-------------|-------------|
| `stake_creator_pool` | Deposit SOL to creator pool |
| `add_to_creator_pool` | Add more SOL to existing pool |
| `withdraw_from_creator_pool` | Withdraw available SOL (not held) |

### Reporter Instructions

| Instruction | Description |
|-------------|-------------|
| `submit_report` | Submit report with bond |

### Moderator Instructions

| Instruction | Description |
|-------------|-------------|
| `register_moderator` | Stake SOL to become moderator |
| `add_moderator_stake` | Add more SOL to moderator stake |
| `vote_on_report` | Vote with stake allocation |
| `unregister_moderator` | Withdraw available stake and exit |

### Resolution Instructions

| Instruction | Description |
|-------------|-------------|
| `resolve_report` | Finalize outcome after voting ends |
| `process_vote_result` | Update moderator reputation, unlock stake |
| `claim_reward` | Moderator claims earned rewards |

---

## Constants

```rust
// Stake minimums
pub const MIN_CREATOR_POOL: u64 = 100_000_000;      // 0.1 SOL
pub const MIN_REPORTER_BOND: u64 = 10_000_000;      // 0.01 SOL
pub const MIN_MODERATOR_STAKE: u64 = 100_000_000;   // 0.1 SOL

// Vote allocation
pub const MIN_VOTE_ALLOCATION_BPS: u16 = 1000;      // 10% of reporter bond

// Voting period
pub const VOTING_PERIOD_SECONDS: i64 = 24 * 60 * 60;      // 1 day (fast resolution)

// Stake lock period
pub const STAKE_LOCK_SECONDS: i64 = 7 * 24 * 60 * 60;     // 7 days (anti-gaming)

// Reputation (asymptotic with S-curve) - applies to moderators AND reporters
pub const INITIAL_REPUTATION: u16 = 5000;           // 50%
pub const REPUTATION_GAIN_RATE: u16 = 100;          // 1% of remaining (100 - current)
pub const REPUTATION_LOSS_RATE: u16 = 300;          // 3% of current reputation

// Reporter bond multiplier
pub const BASE_REPORTER_BOND: u64 = 10_000_000;     // 0.01 SOL base
// min_bond = BASE_REPORTER_BOND × sqrt(0.5 / reporter_reputation)

// S-curve multiplier zones (basis points thresholds)
pub const GRACE_ZONE_LOW: u16 = 4000;               // 40%
pub const GRACE_ZONE_HIGH: u16 = 6000;              // 60%
pub const GRACE_ZONE_MULTIPLIER: u16 = 1000;        // 0.1x (10%)
pub const EXTREME_ZONE_LOW: u16 = 2500;             // 25%
pub const EXTREME_ZONE_HIGH: u16 = 7500;            // 75%
pub const EXTREME_ZONE_MULTIPLIER: u16 = 3000;      // 0.3x (30%)
pub const NORMAL_ZONE_MULTIPLIER: u16 = 10000;      // 1.0x (100%)

// Reward distribution
pub const REPORTER_REWARD_BPS: u16 = 5000;          // 50% to reporter (if upheld)

// Precision for weight calculations
pub const WEIGHT_PRECISION: u64 = 1_000_000_000;    // 1e9
```

---

## Flow Diagrams

### Report Lifecycle

```
[Creator Stakes Pool]
         │
         ▼
[Content Published]
         │
         ▼
[Reporter Submits Report] ──────────────────┐
         │                                   │
         │ bond <= creator.available         │ bond > creator.available
         │                                   │
         ▼                                   ▼
[Report Created]                        [REJECTED]
         │
         │ creator.available -= bond
         │ creator.held += bond
         │
         ▼
[7-Day Voting Period]
         │
         │ Moderators vote with stake allocation
         │ voting_power = sqrt(allocation) × reputation
         │
         ▼
[Voting Ends]
         │
         ▼
[Anyone Calls Resolve]
         │
    ┌────┴────┐
    │         │
    ▼         ▼
[Upheld]  [Dismissed]
    │         │
    │         │ creator.available += bond
    │         │ reporter loses bond
    │         │ moderators split bond
    │         │
    │         ▼
    │    [Reporter Bond → Correct Moderators]
    │
    │ creator.total -= bond
    │ reporter gets 50%
    │ moderators get 50%
    │
    ▼
[Creator Stake → Reporter + Correct Moderators]
         │
         ▼
[Update Reputations]
         │
         │ Correct voters: +0.5%
         │ Incorrect voters: -3%
         │
         ▼
[Unlock Stakes After 7 Days]
```

---

## Future Considerations

### Appeal System
- Loser can appeal with higher bond
- Escalates to larger moderator pool
- Increases cost of frivolous appeals

### Content Categories
- Different minimum bonds per category
- Specialized moderators per category
- Category-specific reputation

### Delegation
- Allow stake delegation to trusted moderators
- Share rewards with delegators
- Reputation remains with voter

### Automated Detection
- Optional AI pre-screening (off-chain)
- Flag obvious violations for faster review
- Reduce moderator workload

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-12 | Initial design |
| 1.1 | 2024-12 | Added S-curve asymptotic reputation system, no-participation outcome handling |
| 1.2 | 2024-12 | Added quadratic votes factor - sqrt(votes_cast + 1) |
| 1.3 | 2024-12 | Voting period 1 day, cumulative reports, ReporterRecord struct |
| 1.4 | 2024-12 | Reputation-based stake withdrawal (slashing below 50%), Treasury |
| 1.5 | 2024-12 | Reporter reputation system, reputation-based bond multiplier |
