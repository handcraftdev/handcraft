# Moderation System Comparison

Comparison of Handcraft's moderation system with similar decentralized dispute/oracle protocols.

---

## Quick Comparison

| Feature | Handcraft | Kleros | UMA | Aragon Court | Reality.eth | The Graph | Augur |
|---------|-----------|--------|-----|--------------|-------------|-----------|-------|
| **Purpose** | Content moderation | General arbitration | Oracle/data verification | DAO disputes | Crowdsourced oracle | Data indexing | Prediction markets |
| **Chain** | Solana | Ethereum/L2 | Ethereum/Multi | Ethereum | Ethereum/Multi | Ethereum/Multi | Ethereum |
| **Native Token** | SOL (no token) | PNK | UMA | ANJ (from ANT) | None (uses arbitrator) | GRT | REP |
| **Voter Selection** | Self-selected | Random (stake-weighted) | Any disputer | Random (stake-weighted) | Any participant | N/A (indexers) | Any REP holder |
| **Min Stake** | 0.1 SOL | Varies by court | Bond amount | 10,000 ANJ | Bond amount | 100,000 GRT | REP amount |
| **Voting Period** | 1 day | Varies | 2 hours (liveness) | Varies | Timeout period | N/A | 7 days |
| **Appeals** | No | Yes (escalating) | Yes (to DVM) | Yes (escalating) | Yes (to arbitrator) | Disputes | Yes (16 rounds) |
| **Reputation** | Yes (S-curve) | No (stake only) | No | No | No | No | No |
| **Quadratic Voting** | Yes (triple) | No | No | No | No | No | No |

---

## Detailed Comparison

### 1. Kleros

**Overview**: Decentralized arbitration protocol using Schelling point game theory.

| Aspect | Kleros | Handcraft |
|--------|--------|-----------|
| **Juror Selection** | Random, weighted by staked PNK | Self-selected moderators |
| **Voting Power** | 1 juror = 1 vote | sqrt(stake) × reputation × sqrt(votes+1) |
| **Incentive** | Coherent with majority = rewards | Correct outcome = rewards |
| **Penalty** | Lose stake if incoherent | Lose reputation, stake slashed on withdraw |
| **Appeals** | Yes, doubles jurors each round | No appeals |
| **Specialized Courts** | Yes (by category) | Single pool |
| **Anonymity** | Jurors don't know each other | Votes hidden until resolution |

**Key Difference**: Kleros uses random selection and Schelling point (vote with majority). Handcraft uses self-selection and objective outcomes.

**Source**: [Kleros Whitepaper](https://kleros.io/whitepaper.pdf), [Kleros Documentation](https://kleros.io/)

---

### 2. UMA Optimistic Oracle

**Overview**: Optimistic oracle assuming data is correct unless disputed.

| Aspect | UMA | Handcraft |
|--------|-----|-----------|
| **Model** | Optimistic (assume correct) | Active voting required |
| **Proposer Bond** | Required | Reporter bond required |
| **Dispute** | Disputer matches bond | Moderators vote |
| **Resolution** | Auto-accept if no dispute | Always requires votes |
| **Liveness Period** | ~2 hours typical | 1 day |
| **Backstop** | DVM (UMA token holder vote) | No backstop |
| **Dispute Rate** | ~1.5% | N/A (all reports voted) |

**Key Difference**: UMA is optimistic (most pass without vote). Handcraft requires active moderation on every report.

**Source**: [UMA Documentation](https://docs.uma.xyz/protocol-overview/how-does-umas-oracle-work), [UMA Protocol](https://uma.xyz/)

---

### 3. Aragon Court

**Overview**: Subjective oracle for DAO dispute resolution.

| Aspect | Aragon Court | Handcraft |
|--------|--------------|-----------|
| **Juror Selection** | Random, stake-weighted sortition | Self-selected |
| **Min Jurors** | 3 (or 1) initially | 1 minimum |
| **Staking** | ANJ tokens (from ANT bonding curve) | Direct SOL |
| **Voting** | Commit-reveal scheme | Direct vote (hidden totals) |
| **Appeals** | Yes, increases juror count | No |
| **Subscription Model** | Monthly fees from DAOs | Per-report rewards |
| **Coherence Penalty** | Slashed if minority vote | Reputation loss |

**Key Difference**: Aragon uses commit-reveal voting and subscription fees. Handcraft has simpler direct voting and per-case rewards.

**Source**: [Aragon Court GitHub](https://github.com/aragon/aragon-court), [Aragon Blog](https://blog.aragon.org/aragon-court-is-live-on-mainnet/)

---

### 4. Reality.eth

**Overview**: Crowdsourced oracle with bond escalation.

| Aspect | Reality.eth | Handcraft |
|--------|-------------|-----------|
| **Model** | Bond escalation (double to challenge) | Fixed bond + voting |
| **Participants** | Anyone can answer/challenge | Reporters + moderators |
| **Escalation** | 2x bond each challenge | Cumulative reports (additive) |
| **Resolution** | Timeout = last answer wins | Voting determines outcome |
| **Arbitration** | External (Kleros, etc.) | Internal moderator pool |
| **Cost Structure** | Exponential (doubling) | Linear (additive bonds) |

**Key Difference**: Reality.eth uses exponential bond escalation. Handcraft uses voting with additive cumulative bonds.

**Source**: [Reality.eth](https://reality.eth.link/), [Reality.eth Whitepaper](https://reality.eth.link/app/docs/html/whitepaper.html)

---

### 5. The Graph

**Overview**: Decentralized indexing protocol with curator/indexer economics.

| Aspect | The Graph | Handcraft |
|--------|-----------|-----------|
| **Purpose** | Data indexing quality | Content moderation |
| **Roles** | Indexers, Curators, Delegators | Creators, Reporters, Moderators |
| **Staking** | 100,000 GRT minimum (indexers) | 0.1 SOL minimum |
| **Slashing** | 2.5% of stake for misbehavior | Reputation-based (up to 100% below 50% rep) |
| **Delegation** | Yes (up to 16x self-stake) | No |
| **Curation** | Signal quality via bonding curve | Report via bond |
| **Disputes** | Fishermen report bad indexing | Reporters report bad content |

**Key Difference**: The Graph focuses on data quality with fishermen disputes. Handcraft focuses on content policy with community voting.

**Source**: [The Graph Documentation](https://thegraph.com/docs/en/resources/tokenomics/), [The Graph Blog](https://thegraph.com/blog/the-graph-network-in-depth-part-2/)

---

### 6. Augur

**Overview**: Prediction market with REP token dispute resolution.

| Aspect | Augur | Handcraft |
|--------|-------|-----------|
| **Reporting** | Designated reporter first | Any reporter |
| **Dispute Rounds** | Up to 16 rounds | Single round |
| **Bond Escalation** | Progressive (dispute bonds) | Cumulative (additive) |
| **Final Backstop** | Fork the protocol | None (majority rules) |
| **Dispute Period** | 7 days per round | 1 day total |
| **Token Split** | REP forks on major disputes | No token |
| **Reward Source** | Market settlement fees | Creator slashed stake |

**Key Difference**: Augur has extreme backstop (protocol fork). Handcraft accepts majority decision as final.

**Source**: [Augur Documentation](https://v1-docs.augur.net/), [Gemini Cryptopedia](https://www.gemini.com/cryptopedia/augur-prediction-market-rep-coin-augur-betting)

---

## Unique Handcraft Features

Features not found in comparable systems:

| Feature | Description | Benefit |
|---------|-------------|---------|
| **Triple Quadratic** | sqrt(stake) × rep × sqrt(votes+1) | Balanced influence, anti-whale |
| **S-Curve Reputation** | Asymptotic, grace zone at 50% | Forgiving start, accountability middle |
| **Reporter Reputation** | Same curve as moderators | Self-correcting spam prevention |
| **Reputation-Based Bond** | sqrt(0.5/rep) multiplier | Trusted reporters pay less |
| **Reputation-Based Withdrawal** | <50% rep = slashed stake | Economic consequence for bad actors |
| **Cumulative Reports** | Multiple reporters join one case | Shared signal, proportional rewards |
| **Creator Pool Model** | One pool covers all content | Simpler than per-content staking |
| **No Native Token** | Uses SOL directly | No token economics complexity |

---

## Design Philosophy

### On Bias and Objectivity

**Key insight**: There is no economic incentive for moderator bias.

- Moderators are paid from the losing side regardless of outcome
- Upheld → paid from creator's slashed stake
- Dismissed → paid from reporter's lost bond
- No financial preference for either outcome

**On "random" vs "self-selected":**

Random selection (Kleros, Aragon) doesn't eliminate bias - it randomizes which biases participate. Self-selection with proper economic design achieves the same goal: aggregate individual judgments into collective decision.

**On objectivity:**

> "How objective is objective when everything else is equal? Only individual biases are the sole contributor of human decision."

Even systems claiming objectivity (UMA's DVM, Kleros arbitration) ultimately rely on human judgment. There is no oracle for "truth" in content moderation - only consensus. What is "acceptable content" is inherently subjective and defined by community standards.

**Majority rules IS the standard:**
- Individual biases are unavoidable
- Aggregated biases = community consensus
- Community consensus = platform policy in action
- No external "truth" exists for subjective content decisions

### Self-Regulating Through Reputation

The system naturally calibrates itself:

```
Moderator votes against majority consistently
  → Reputation decreases (S-curve loss)
  → Lower voting power: sqrt(stake) × rep × sqrt(votes+1)
  → Lower reward share
  → Below 50% rep = stake slashing on withdrawal
  → Economic pressure to align or exit
```

**Effects:**
- Outlier biases get less influence over time
- Persistent disagreement with community = self-removal
- No central authority decides "wrong" - the collective does
- Moderators whose biases align with consensus gain influence

**Key difference from Kleros/Aragon:**
- Those systems: No persistent reputation, each case independent
- Handcraft: Track record matters, influence earned over time

This creates natural selection for moderators who understand and apply community standards consistently.

---

## Accepted Trade-offs

| Handcraft Choice | Reasoning |
|------------------|-----------|
| No appeals | Faster resolution; majority decision IS the community standard |
| 1-day voting | Sufficient for content decisions; longer periods don't improve accuracy |
| Self-selection | No economic bias incentive; random selection only randomizes which biases participate |
| No native token | Simpler; avoids token speculation affecting moderation quality |
| Single pool | Starts simple; can add specialized pools later if needed |

---

## When to Use Each

| System | Best For |
|--------|----------|
| **Kleros** | Complex disputes needing expert arbitration |
| **UMA** | High-volume oracle data with rare disputes |
| **Aragon Court** | DAO governance disputes |
| **Reality.eth** | Simple factual questions with escalation |
| **The Graph** | Data indexing quality assurance |
| **Augur** | Prediction market outcome verification |
| **Handcraft** | Platform content moderation with creator accountability |

---

## References

- [Kleros](https://kleros.io/) - Decentralized arbitration
- [UMA Protocol](https://uma.xyz/) - Optimistic oracle
- [Aragon Court](https://github.com/aragon/aragon-court) - DAO disputes
- [Reality.eth](https://reality.eth.link/) - Crowdsourced oracle
- [The Graph](https://thegraph.com/) - Decentralized indexing
- [Augur](https://www.augur.net/) - Prediction markets

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-12 | Initial comparison |
