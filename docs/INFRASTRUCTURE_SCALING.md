# Infrastructure Scaling Evaluation

*Last Updated: December 2024*

## Current Architecture

```
User Browser → React Query (cache) → SDK → Direct RPC calls → Solana
```

### Data Flow
- Client-side caching with React Query (TanStack Query)
- Direct Solana RPC calls via `@solana/web3.js`
- No server-side persistence or indexing
- `getProgramAccounts` scans for data fetching

## RPC Usage Analysis

### Query Patterns

| Query | Method | Cache Duration | Trigger |
|-------|--------|----------------|---------|
| `fetchGlobalContent` | getProgramAccounts | 60s | Page load |
| `fetchAllBundles` | getProgramAccounts | 60s | Page load |
| `fetchAllMintConfigs` | Anchor .all() | 60s | Page load |
| `fetchAllRentConfigs` | Anchor .all() | 60s | Page load |
| `fetchAllContentCollections` | Anchor .all() | 60s | Page load |
| `fetchAllRewardPools` | Anchor .all() | 60s | Page load |
| `contentToBundles` | Anchor .all() | 120s | Page load |
| `walletNfts` | getProgramAccounts | 300s | Connected wallet |
| `walletBundleNfts` | getProgramAccounts | 300s | Connected wallet |
| `walletRarities` | getMultipleAccountsInfo | 300s | After walletNfts |
| `pendingRewards` | getMultipleAccountsInfo | 120s | Connected wallet |
| Per-content queries | Individual fetches | 60s | Per card render |

### Estimated Monthly RPC Calls by Scale

#### Small Scale (100 MAU, 50 content items)
| Scenario | Calls/Action | Actions/Month | Total |
|----------|-------------|---------------|-------|
| Page loads (anon) | ~7 | 1,000 | 7,000 |
| Page loads (connected) | ~12 | 500 | 6,000 |
| Content card renders | ~4 | 5,000 | 20,000 |
| Transactions (mint/claim) | ~3 | 200 | 600 |
| **Total** | | | **~35,000** |

#### Medium Scale (1,000 MAU, 500 content items)
| Scenario | Calls/Action | Actions/Month | Total |
|----------|-------------|---------------|-------|
| Page loads (anon) | ~7 | 10,000 | 70,000 |
| Page loads (connected) | ~12 | 5,000 | 60,000 |
| Content card renders | ~4 | 50,000 | 200,000 |
| Transactions | ~3 | 2,000 | 6,000 |
| **Total** | | | **~340,000** |

#### Large Scale (10,000 MAU, 2,000 content items)
| Scenario | Calls/Action | Actions/Month | Total |
|----------|-------------|---------------|-------|
| Page loads (anon) | ~7 | 100,000 | 700,000 |
| Page loads (connected) | ~12 | 50,000 | 600,000 |
| Content card renders | ~4 | 500,000 | 2,000,000 |
| Transactions | ~3 | 20,000 | 60,000 |
| **Total** | | | **~3.4M** |

### Cost Analysis

| Scale | RPC/Month | Helius Free (1M) | Helius Dev ($49/mo) |
|-------|-----------|------------------|---------------------|
| Small (100 MAU) | 35K | Covered | Overkill |
| Medium (1K MAU) | 340K | Covered | Overkill |
| Large (10K MAU) | 3.4M | Need upgrade | 10M credits |

## Comparison with MagicEden

### MagicEden's Architecture
*Source: [MagicEden Engineering Blog](https://eng.magiceden.dev/scaling-magic-eden-part-1)*

```
Solana Validator (custom) → Geyser Plugin → Kafka → Indexers → PostgreSQL → API
```

**Their scale:**
- 3,000 - 50,000 account updates/second
- 4,000 API queries/second peak
- 300 transactions/second peak
- <1 second indexing latency (was 20+ seconds before Geyser)

**Key infrastructure:**
- Own validators (no RPC dependency)
- Geyser plugin (streams all account changes real-time)
- Kafka (message broker for reliability/decoupling)
- PostgreSQL (read-optimized views of on-chain data)
- Zero RPC calls for reads

### Side-by-Side Comparison

| Aspect | Handcraft (Current) | MagicEden |
|--------|---------------------|-----------|
| Data source | Direct RPC | Own validators + Geyser |
| Latency | 1-5 seconds | <1 second |
| Scale limit | ~10K MAU | Millions |
| Infrastructure cost | ~$0-50/mo | $10,000+/mo |
| Query flexibility | Limited (on-chain only) | Full SQL queries |
| Historical data | None | Full history |
| Real-time updates | Polling (60s) | Push (<1s) |
| Complexity | Simple | Very complex |

## Scaling Bottlenecks

1. **`getProgramAccounts` scans** - O(n) with content/bundle growth
2. **Per-card queries** - 4 RPC calls per content card visible
3. **Wallet NFT scans** - Slow for wallets with many NFTs
4. **No historical data** - Can't show analytics/trends

## Scaling Roadmap

### Phase 1: Current (Free)
- Direct RPC + React Query caching
- Helius free tier (1M credits/month)
- Suitable for: <1K MAU

### Phase 2: Server Caching (~$100/mo)
```
Browser → Next.js API → Redis Cache → RPC (cache miss only)
```
- Add Redis/Upstash for server-side caching
- Reduce RPC calls by 80%+
- Suitable for: 1K-5K MAU

### Phase 3: Webhook-based Indexing (~$300/mo)
```
Helius Webhooks → PostgreSQL (Supabase) → API → Browser
```
- Helius webhooks push updates to database
- Queries hit database, not RPC
- Real-time updates via webhooks
- Suitable for: 5K-50K MAU

### Phase 4: Custom Indexer (~$1,000+/mo)
```
Geyser Plugin → Message Queue → Custom Indexer → PostgreSQL → API
```
- Use Geyser plugin (Jito, Triton) for real-time streaming
- Or managed indexer (Helius DAS, Shyft)
- Full control over data model
- Suitable for: 50K+ MAU

### Phase 5: MagicEden-level ($10,000+/mo)
```
Own Validators → Geyser → Kafka → Multi-region PostgreSQL → CDN → API
```
- Own validator infrastructure
- Multi-region deployment
- Full redundancy and DR
- Suitable for: 1M+ MAU

## Quick Optimizations (No Infrastructure Change)

1. **Batch per-card queries** - Fetch all mintConfigs/rentConfigs upfront
2. **Increase staleTime** - 60s → 300s for rarely-changing data
3. **Pagination** - Don't load all content at once
4. **Lazy loading** - Only fetch data for visible cards

## Helius Pricing Reference

| Plan | Credits/Month | Rate Limits | Cost |
|------|---------------|-------------|------|
| Free | 1M | 10 RPC/s, 2 DAS/s | $0 |
| Developer | 10M | Higher limits | $49/mo |
| Business | 100M | Enhanced WebSockets | $499/mo |
| Professional | 200M | LaserStream (gRPC) | Custom |

## Key Insights

1. **Current architecture is fine for early stage** - Free tier covers medium scale
2. **Main bottleneck is `getProgramAccounts`** - Becomes slow with 1000+ accounts
3. **Indexer becomes valuable at ~10K MAU** - Performance issues before cost issues
4. **Incremental scaling is possible** - Don't need to jump to full Geyser setup

## References

- [Scaling Magic Eden (Part 1)](https://eng.magiceden.dev/scaling-magic-eden-part-1)
- [Scaling Magic Eden (Part 2)](https://eng.magiceden.dev/scaling-magic-eden-part-2)
- [Scaling Magic Eden (Part 3)](https://eng.magiceden.dev/scaling-magic-eden-part-3)
- [Helius Pricing](https://www.helius.dev/pricing)
- [Helius Plans and Rate Limits](https://www.helius.dev/docs/billing/plans-and-rate-limits)
