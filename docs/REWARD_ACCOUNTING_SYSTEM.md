# Reward Accounting System

## Overview

The Reward Accounting System provides comprehensive transaction tracking and analytics for all reward-related activities in the Handcraft ecosystem. It uses an event-sourcing pattern to build an immutable ledger of all reward transactions from on-chain events.

## Architecture

### 1. On-Chain Events (Solana Program)

**Location:** `programs/content-registry/src/events.rs`

All reward-related activities emit structured events that are captured in transaction logs:

- **RewardDepositEvent**: Emitted when rewards are deposited to pools (mints, secondary sales)
- **RewardDistributionEvent**: Emitted when epoch-based lazy distributions occur
- **RewardClaimEvent**: Emitted when users claim rewards from pools
- **RewardTransferEvent**: Emitted when NFT transfers cause reward debt transfers
- **SubscriptionCreatedEvent**: Emitted when subscriptions are created
- **SubscriptionCancelledEvent**: Emitted when subscriptions are cancelled

### 2. Event Processing (Helius Webhook)

**Location:** `apps/web/src/app/api/webhooks/helius/route.ts`

The webhook handler:
- Receives real-time transaction notifications from Helius
- Parses Anchor events from transaction logs using `BorshCoder`
- Inserts events into the `reward_transactions` table
- Triggers automatic aggregation updates via database triggers

**Configuration:**
```env
HELIUS_WEBHOOK_SECRET=your_webhook_secret
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

### 3. Database Schema (Supabase/PostgreSQL)

**Location:** `supabase/migrations/003_reward_ledger.sql`

#### Core Tables

**reward_transactions**
- Immutable event log of all reward transactions
- Indexed by signature, wallet, creator, content, pool type, timestamp
- Stores full event data as JSONB for debugging

**creator_revenue**
- Aggregated revenue data per creator
- Automatically updated by triggers on transaction inserts
- Tracks primary sales, patron revenue, ecosystem payouts, secondary royalties

**user_earnings**
- Aggregated earnings data per user
- Automatically updated by triggers on claim events
- Tracks content, bundle, patron, and global holder rewards

**pool_snapshots**
- Time-series snapshots of pool states
- Used for historical analytics and charting
- Should be populated by periodic cron job

**subscriptions**
- Active and historical subscription records
- Tracks Streamflow stream IDs and subscription states

#### Database Functions

**get_creator_revenue_breakdown(creator TEXT)**
- Returns revenue breakdown by source with percentages

**get_user_earnings_breakdown(user_wallet TEXT)**
- Returns earnings breakdown by pool type with percentages

#### Automatic Triggers

All aggregation updates happen automatically via database triggers:
- `trigger_update_creator_revenue` - Updates creator_revenue on transaction insert
- `trigger_update_user_earnings` - Updates user_earnings on claim insert
- `trigger_update_creator_subscription_counts` - Updates subscription counts

### 4. API Endpoints (Next.js)

#### Transaction History
**GET /api/rewards/history**

Query reward transactions with flexible filters:

```typescript
// Query parameters
{
  wallet?: string;           // Filter by source or receiver wallet
  creator?: string;          // Filter by creator wallet
  content?: string;          // Filter by content pubkey
  pool_type?: string;        // Filter by pool type
  transaction_type?: string; // Filter by transaction type
  limit?: number;            // Max results (default 50, max 1000)
  offset?: number;           // Pagination offset
  sort?: "asc" | "desc";     // Sort order (default desc)
}
```

**POST /api/rewards/history/summary**

Get transaction summary for a wallet:

```typescript
// Request body
{
  wallet: string;
}

// Response
{
  wallet: string;
  transaction_counts: Record<string, number>;
  earnings_by_pool: Record<string, number>;
  total_earned_lamports: number;
  total_earned_sol: number;
}
```

#### Analytics
**GET /api/rewards/analytics**

Get comprehensive analytics for creators or users:

```typescript
// Query parameters
{
  type: "creator" | "user"; // Required
  wallet: string;           // Required
  period: "7d" | "30d" | "90d" | "1y" | "all"; // Default: "30d"
}

// Response (creator)
{
  wallet: string;
  revenue: CreatorRevenue;
  breakdown: RevenueBreakdown[];
  time_series: TimeSeriesDataPoint[];
  recent_transactions: Transaction[];
}

// Response (user)
{
  wallet: string;
  earnings: UserEarnings;
  breakdown: EarningsBreakdown[];
  time_series: TimeSeriesDataPoint[];
  recent_claims: Transaction[];
}
```

#### CSV Export
**GET /api/rewards/export**

Export transactions as CSV or JSON:

```typescript
// Query parameters
{
  type: "creator" | "user"; // Required
  wallet?: string;          // Required for user export
  creator?: string;         // Required for creator export
  start_date?: string;      // ISO date
  end_date?: string;        // ISO date
  format?: "csv" | "json";  // Default: csv
}
```

### 5. React Components

**Location:** `apps/web/src/components/rewards/`

#### TransactionHistory
Displays paginated list of reward transactions with filtering:

```tsx
<TransactionHistory
  wallet={wallet}          // Optional: filter by wallet
  creator={creator}        // Optional: filter by creator
  content={content}        // Optional: filter by content
  poolType={poolType}      // Optional: filter by pool type
  transactionType={type}   // Optional: filter by transaction type
  limit={50}               // Optional: max results
/>
```

#### TransactionRow
Expandable transaction row showing full details:
- Transaction signature with Solscan link
- Fee split breakdown
- Participant wallets
- NFT details and weight

#### RevenueChart
Time-series line chart for revenue/earnings visualization:

```tsx
<RevenueChart
  data={timeSeriesData}    // TimeSeriesDataPoint[]
  title="Revenue Over Time"
  type="revenue"           // or "earnings"
/>
```

#### EarningsSummary
Summary cards showing total revenue/earnings breakdown:

```tsx
<EarningsSummary
  data={revenueData}       // CreatorRevenue or UserEarnings
  type="creator"           // or "user"
/>
```

### 6. React Hooks

**Location:** `apps/web/src/hooks/`

#### useRewardHistory
Fetches transaction history with filtering:

```tsx
const {
  transactions,    // RewardTransaction[]
  total,          // Total count
  loading,        // Loading state
  error,          // Error message
  refetch,        // Refetch function
} = useRewardHistory({
  wallet,
  creator,
  content,
  pool_type,
  transaction_type,
  limit,
  offset,
  sort,
});
```

#### useRevenueAnalytics
Fetches analytics data with automatic refetch:

```tsx
const {
  revenue,              // CreatorRevenue (for creators)
  earnings,             // UserEarnings (for users)
  breakdown,            // Revenue/earnings breakdown
  timeSeries,           // Time-series data
  recentTransactions,   // Recent transactions
  loading,              // Loading state
  error,                // Error message
  refetch,              // Refetch function
} = useRevenueAnalytics(
  "creator",            // or "user"
  wallet,
  "30d"                 // period
);
```

### 7. Analytics Dashboard

**Location:** `apps/web/src/app/studio/analytics/page.tsx`

Full-featured creator analytics dashboard with:
- Summary cards showing total revenue across all sources
- Revenue breakdown by source (primary sales, patron, ecosystem, royalties)
- Time-series chart with selectable periods (7d, 30d, 90d, 1y, all)
- Recent transaction history
- CSV export functionality
- Real-time refresh

## Implementation Guide

### Phase 1: Enable Event Emissions (Rust)

Follow the guide in `programs/content-registry/EVENT_EMISSION_GUIDE.md` to add `emit!` calls to existing instructions.

**Critical locations:**
1. Mint handlers - emit RewardDepositEvent after depositing to pools
2. Claim handlers - emit RewardClaimEvent after successful claims
3. Distribution helpers - emit RewardDistributionEvent after epoch distributions
4. Subscription handlers - emit SubscriptionCreatedEvent/CancelledEvent

### Phase 2: Deploy Database Schema

Run the migration:

```bash
# Using Supabase CLI
supabase db push

# Or apply directly to PostgreSQL
psql -U your_user -d your_database -f supabase/migrations/003_reward_ledger.sql
```

### Phase 3: Configure Helius Webhook

1. Create webhook in Helius dashboard:
   - Webhook URL: `https://your-domain.com/api/webhooks/helius`
   - Account addresses: [Your Content Registry Program ID]
   - Transaction types: All
   - Webhook type: Enhanced
   - Auth header: `Bearer your_webhook_secret`

2. Set environment variables:
   ```env
   HELIUS_WEBHOOK_SECRET=your_webhook_secret
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_key
   ```

3. Update program ID in webhook handler:
   ```typescript
   // apps/web/src/app/api/webhooks/helius/route.ts
   const PROGRAM_ID = new PublicKey("YOUR_PROGRAM_ID_HERE");
   ```

### Phase 4: Test Event Flow

1. Perform a test mint transaction
2. Check Helius webhook logs for delivery
3. Verify event parsing in webhook handler logs
4. Check `reward_transactions` table for new records
5. Verify `creator_revenue` and `user_earnings` were updated
6. Test API endpoints to fetch data
7. View analytics dashboard

## Revenue Flow Reference

### Primary Sales (NFT Mint)
- **Total**: 100% of mint price
- **Creator**: 80%
- **Platform**: 5%
- **Ecosystem**: 3%
- **Holder Pool**: 12% (deposited to ContentRewardPool or BundleRewardPool)

### Secondary Sales (Marketplace)
- Handled by Metaplex Core Royalties plugin
- **Total**: 10% of sale price (configurable)
- **Creator**: 4%
- **Platform**: 1%
- **Ecosystem**: 1%
- **Holder Pool**: 4% (sent directly to ContentRewardPool via royalty plugin)

### Patron Subscriptions
- **Total**: 100% of monthly subscription
- Flows to CreatorPatronStreamingTreasury
- Distributed at epoch end:
  - **Creator**: 80%
  - **Platform**: 5%
  - **Ecosystem**: 3%
  - **Holder Pool**: 12% (to CreatorPatronPool)

### Ecosystem Subscriptions
- **Total**: 100% of monthly subscription
- Flows to EcosystemStreamingTreasury
- Distributed at epoch end:
  - **Creator Distribution Pool**: 80% (split by NFT weight)
  - **Platform**: 5%
  - **Ecosystem**: 3%
  - **Global Holder Pool**: 12%

## Analytics Queries

### Top Creators by Revenue
```sql
SELECT * FROM top_creators_by_revenue LIMIT 10;
```

### Top Users by Earnings
```sql
SELECT * FROM top_earners_by_rewards LIMIT 10;
```

### Revenue Breakdown for Creator
```sql
SELECT * FROM get_creator_revenue_breakdown('creator_wallet');
```

### Earnings Breakdown for User
```sql
SELECT * FROM get_user_earnings_breakdown('user_wallet');
```

### Recent Transactions
```sql
SELECT * FROM recent_transactions;
```

### Active Subscriptions Summary
```sql
SELECT * FROM active_subscriptions_summary;
```

## Monitoring & Maintenance

### Health Checks

1. **Webhook Health**
   - GET `/api/webhooks/helius` should return status OK
   - Monitor webhook delivery success rate in Helius dashboard

2. **Database Health**
   - Monitor `reward_transactions` insert rate
   - Check trigger execution times
   - Verify aggregation accuracy

3. **API Health**
   - Monitor endpoint response times
   - Check error rates in logs
   - Verify data consistency

### Periodic Tasks

1. **Pool Snapshots** (Recommended: Daily)
   - Fetch current pool states from on-chain
   - Insert into `pool_snapshots` table
   - Use for historical charts

2. **Data Validation** (Recommended: Weekly)
   - Compare aggregations to raw transaction sums
   - Verify trigger calculations
   - Check for missing events

3. **Cleanup** (Optional)
   - Archive old transactions (>1 year)
   - Compress event_data JSONB
   - Vacuum database tables

## Troubleshooting

### Events Not Appearing in Database

1. Check Helius webhook logs for delivery errors
2. Verify webhook secret matches environment variable
3. Check webhook handler logs for parsing errors
4. Ensure program ID matches in webhook handler
5. Verify event discriminators match IDL

### Aggregations Not Updating

1. Check database trigger logs
2. Verify trigger functions are enabled
3. Test trigger manually with sample insert
4. Check for constraint violations

### Analytics Dashboard Showing Zero

1. Verify wallet is connected
2. Check API endpoint responses in Network tab
3. Verify Supabase credentials
4. Check for CORS issues
5. Verify creator/user has transactions

### CSV Export Failing

1. Check transaction count (may timeout for large exports)
2. Verify date filters are valid
3. Check Supabase query performance
4. Consider paginating large exports

## Future Enhancements

1. **Email Reports**
   - Weekly revenue summaries for creators
   - Monthly earnings reports for users

2. **Real-time Notifications**
   - WebSocket updates for new transactions
   - Push notifications for large claims

3. **Advanced Analytics**
   - Revenue forecasting
   - Subscriber churn analysis
   - Pool performance metrics

4. **Tax Reporting**
   - Annual tax forms (1099-MISC)
   - Transaction categorization
   - Cost basis tracking

5. **Comparative Analytics**
   - Creator leaderboards
   - Pool performance comparisons
   - Benchmark metrics

## Security Considerations

1. **Webhook Authentication**
   - Always verify webhook secret
   - Use HTTPS only
   - Rate limit webhook endpoint

2. **Database Access**
   - Use service role key server-side only
   - Never expose service key to client
   - Implement Row Level Security (RLS)

3. **API Rate Limiting**
   - Implement per-user rate limits
   - Add request throttling
   - Monitor for abuse

4. **Data Privacy**
   - Wallet addresses are public
   - Transaction amounts are public
   - Consider GDPR compliance for EU users

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review Helius webhook logs
3. Check database trigger logs
4. Review API endpoint logs
5. File an issue with full error context

## License

This system is part of the Handcraft platform and follows the same license terms.
