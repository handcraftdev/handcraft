# Content Indexing System

This document describes the Helius webhook-based indexing system for the Handcraft Content Registry.

## Overview

The indexing system provides fast, searchable access to on-chain content, bundles, and ownership data using:

- **Supabase PostgreSQL** for indexed data storage
- **Helius Enhanced Webhooks** for real-time on-chain event processing
- **Full-text search** with PostgreSQL's tsvector
- **React hooks** for easy client-side integration

## Architecture

```
┌─────────────┐
│   Solana    │ On-chain events
│ Blockchain  │
└──────┬──────┘
       │
       │ Webhook events
       ▼
┌─────────────────┐
│     Helius      │ Enhanced transaction webhooks
│    Webhooks     │
└──────┬──────────┘
       │
       │ POST /api/webhooks/helius
       ▼
┌─────────────────┐
│  Next.js API    │ Parse & index events
│  Route Handler  │
└──────┬──────────┘
       │
       │ Write indexed data
       ▼
┌─────────────────┐
│    Supabase     │ PostgreSQL database
│   PostgreSQL    │
└──────┬──────────┘
       │
       │ Read indexed data
       ▼
┌─────────────────┐
│  Search APIs    │ /api/search, /api/trending
│  React Hooks    │ useSearch, useTrending
└─────────────────┘
```

## Database Schema

### Tables

#### `indexed_content`
Stores indexed content entries with metadata from IPFS.

Key fields:
- `content_address` - On-chain PDA address (unique)
- `content_cid` - IPFS content CID (unique)
- `creator_address` - Creator wallet
- `name`, `description`, `image_url` - From metadata
- `content_type`, `content_domain` - Content classification
- `visibility_level` - Access control level (0-3)
- `minted_count`, `tips_received` - On-chain stats
- `tags`, `category`, `genre` - Discovery metadata
- `search_vector` - Full-text search index (auto-generated)

#### `indexed_bundles`
Stores indexed bundle entries with metadata.

Key fields:
- `bundle_address` - On-chain PDA address (unique)
- `bundle_id` - Bundle identifier
- `bundle_type` - Album, Series, Course, etc.
- `item_count` - Number of items in bundle
- Similar metadata fields as content

#### `bundle_content`
Links bundles to their content items.

Fields:
- `bundle_id` - Foreign key to indexed_bundles
- `content_id` - Foreign key to indexed_content
- `position` - Order within bundle
- `custom_title`, `duration` - Per-item metadata

#### `indexed_creators`
Aggregated creator profiles and stats.

Fields:
- `creator_address` - Wallet address (unique)
- `username` - From UserProfile if exists
- `total_content_count`, `total_bundle_count`
- `total_mints`, `total_tips`

#### `indexed_ownership`
Tracks NFT ownership for access control.

Fields:
- `nft_address` - NFT mint address (unique)
- `owner_address` - Current owner
- `content_id`, `bundle_id` - What this NFT grants access to
- `collection_address` - Metaplex collection
- `rarity`, `weight` - NFT rarity tier

### Views

- **`trending_content`** - Content with most mints in last 7 days
- **`trending_bundles`** - Bundles with most mints in last 7 days
- **`creator_leaderboard`** - Top creators by total mints

## API Routes

### POST `/api/webhooks/helius`

Helius webhook handler for real-time indexing.

**Authentication**: HMAC signature verification using `HELIUS_WEBHOOK_SECRET`

**Events Processed**:
1. Content registration - Indexes new content
2. Bundle creation - Indexes new bundles
3. NFT mints - Updates stats and ownership
4. NFT transfers - Updates ownership

**Environment Variables**:
```bash
HELIUS_WEBHOOK_SECRET=your_webhook_secret
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### GET `/api/search`

Full-text search for content and bundles.

**Query Parameters**:
- `q` - Search query (full-text)
- `type` - "content" or "bundle"
- `domain` - Filter by content domain (video, audio, etc.)
- `creator` - Filter by creator address
- `tags` - Comma-separated tags
- `category` - Category filter
- `visibility` - Visibility level (0-3)
- `sort` - "relevance", "recent", "popular", "mints"
- `limit` - Results per page (max 100)
- `offset` - Pagination offset

**Response**:
```json
{
  "results": [...],
  "total": 123,
  "limit": 20,
  "offset": 0,
  "type": "content"
}
```

### GET `/api/trending`

Trending content and bundles.

**Query Parameters**:
- `type` - "content" or "bundle"
- `period` - "1d", "7d", "30d", "all"
- `limit` - Results limit (max 100)

**Response**:
```json
{
  "results": [...],
  "type": "content",
  "period": "7d"
}
```

## React Hooks

### `useSearch(query, filters)`

Search hook with filters.

```tsx
import { useSearch } from "@/hooks/useSearch";

function SearchPage() {
  const { data, isLoading, error } = useSearch("music", {
    type: "content",
    domain: "audio",
    sort: "popular",
    limit: 20,
  });

  return <SearchResults results={data?.results} />;
}
```

### `useTrending(type, period, limit)`

Trending content hook.

```tsx
import { useTrendingContent } from "@/hooks/useTrending";

function TrendingPage() {
  const { data, isLoading } = useTrendingContent("7d", 20);

  return <TrendingGrid items={data?.results} />;
}
```

### `useCreatorContent(creatorAddress, options)`

Creator's content hook.

```tsx
import { useCreatorContent } from "@/hooks/useCreatorContent";

function CreatorProfile({ address }) {
  const { data } = useCreatorContent(address, {
    sort: "recent",
    limit: 12,
  });

  return <ContentGrid items={data?.results} />;
}
```

## Components

### `<SearchBar />`

Search input with debouncing.

```tsx
import { SearchBar } from "@/components/search/SearchBar";

<SearchBar
  onSearch={(query) => setSearchQuery(query)}
  placeholder="Search content..."
  debounceMs={300}
/>
```

### `<SearchFilters />`

Filter controls for search.

```tsx
import { SearchFilters } from "@/components/search/SearchFilters";

<SearchFilters
  filters={filters}
  onChange={setFilters}
  showVisibilityFilter={true}
/>
```

### `<SearchResults />`

Display search results.

```tsx
import { SearchResults } from "@/components/search/SearchResults";

<SearchResults
  results={data?.results || []}
  type="content"
  isLoading={isLoading}
  onItemClick={(item) => router.push(`/content/${item.content_cid}`)}
/>
```

## Indexer Utilities

### Parser (`lib/indexer/parser.ts`)

Parse on-chain account data.

```ts
import { parseContentAccount, parseBundleAccount } from "@/lib/indexer/parser";

const content = parseContentAccount(address, accountData);
const bundle = parseBundleAccount(address, accountData);
```

### Metadata (`lib/indexer/metadata.ts`)

Fetch and parse IPFS metadata.

```ts
import { fetchContentMetadata, buildIndexableContentMetadata } from "@/lib/indexer/metadata";

const metadata = await fetchContentMetadata(metadataCid);
const indexable = buildIndexableContentMetadata(metadata);
```

### Sync (`lib/indexer/sync.ts`)

Sync utilities for backfilling and updates.

```ts
import { syncContent, syncBundle, backfillAllContent } from "@/lib/indexer/sync";

// Sync single content
await syncContent(connection, contentAddress);

// Backfill all content
const synced = await backfillAllContent(connection);
```

## Setup Instructions

### 1. Create Supabase Project

1. Sign up at [supabase.com](https://supabase.com)
2. Create a new project
3. Note your project URL and API keys

### 2. Run Database Migration

```bash
# Using Supabase CLI
supabase db push

# Or execute SQL directly in Supabase dashboard
# Copy contents of supabase/migrations/002_indexing_schema.sql
```

### 3. Configure Environment Variables

Add to `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Helius
HELIUS_WEBHOOK_SECRET=your_webhook_secret

# IPFS Gateway (optional, defaults to filebase)
IPFS_GATEWAY=https://ipfs.filebase.io/ipfs
```

### 4. Set Up Helius Webhook

1. Go to [Helius Dashboard](https://dashboard.helius.dev)
2. Create a new webhook
3. Set webhook URL: `https://your-domain.com/api/webhooks/helius`
4. Select "Enhanced Transactions"
5. Add account addresses to monitor:
   - Your program ID
   - Metaplex Core program: `CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d`
6. Set webhook secret and add to environment variables

### 5. Backfill Existing Data (Optional)

Run a one-time backfill to index existing on-chain data:

```ts
import { backfillAllContent, backfillAllBundles } from "@/lib/indexer/sync";
import { Connection } from "@solana/web3.js";

const connection = new Connection(rpcUrl);

// Backfill content
await backfillAllContent(connection);

// Backfill bundles
await backfillAllBundles(connection);
```

## Search Best Practices

### Full-Text Search

The search uses PostgreSQL's `tsvector` for full-text search with weighted fields:

- **A weight**: Title/name (highest relevance)
- **B weight**: Description
- **C weight**: Tags, category, genre

Search tips:
- Use plain text queries, no special operators needed
- Searches are case-insensitive
- Common words (stop words) are automatically filtered
- Partial word matching works automatically

### Performance

- All search queries use database indexes
- Full-text search uses GIN indexes
- Results are paginated (max 100 per page)
- React Query caches results for 1 minute

### Filters

Combine filters for precise results:

```tsx
const { data } = useSearch("music video", {
  type: "content",
  domain: "video",
  category: "music",
  visibility: 0, // Public only
  sort: "popular",
});
```

## Monitoring

### Check Indexing Status

Query creator stats to verify indexing:

```sql
SELECT * FROM indexed_creators ORDER BY total_mints DESC LIMIT 10;
```

### Verify Search Index

Test full-text search:

```sql
SELECT name, ts_rank(search_vector, plainto_tsquery('music')) AS rank
FROM indexed_content
WHERE search_vector @@ plainto_tsquery('music')
ORDER BY rank DESC
LIMIT 10;
```

### Monitor Webhook Events

Check Next.js logs for webhook processing:

```bash
# Development
pnpm dev

# Production
pm2 logs
```

## Troubleshooting

### Webhook Signature Fails

- Verify `HELIUS_WEBHOOK_SECRET` matches Helius dashboard
- Check webhook secret hasn't been regenerated

### Content Not Appearing

- Check Helius webhook is configured for your program ID
- Verify webhook endpoint is accessible (not localhost)
- Check Next.js API route logs for errors
- Ensure Supabase service role key is set

### Search Returns No Results

- Verify database has indexed content: `SELECT COUNT(*) FROM indexed_content;`
- Check search vector is populated: `SELECT search_vector FROM indexed_content LIMIT 1;`
- Try broader search terms

### Metadata Not Loading

- Verify IPFS gateway is accessible
- Check metadata CID is valid
- Ensure IPFS content is public
- Try alternative gateway in environment variables

## Future Enhancements

Potential improvements:

1. **Real-time subscriptions** - Supabase Realtime for live updates
2. **Advanced filters** - Price ranges, date filters, content length
3. **Recommendation engine** - ML-based content recommendations
4. **Analytics dashboard** - Content performance metrics
5. **Search suggestions** - Autocomplete based on popular searches
6. **Image search** - Visual similarity search for artwork/photos
7. **Geographic filters** - Location-based content discovery
8. **Social features** - Likes, saves, shares tracking
