# Content Indexer Setup Guide

Quick start guide for setting up the Handcraft content indexing system.

## Prerequisites

- Node.js 20+
- pnpm package manager
- Supabase account
- Helius account (for webhooks)

## Step-by-Step Setup

### 1. Supabase Setup

#### Create Project

1. Go to [supabase.com](https://supabase.com) and sign up
2. Click "New Project"
3. Choose organization and project name
4. Select region closest to your users
5. Generate a strong database password
6. Wait for project to provision (~2 minutes)

#### Get API Credentials

1. Go to Project Settings → API
2. Copy your:
   - Project URL (`NEXT_PUBLIC_SUPABASE_URL`)
   - `anon` public key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - `service_role` secret key (`SUPABASE_SERVICE_ROLE_KEY`)

**IMPORTANT**: Never expose the service role key to the client!

#### Run Database Migration

Option A: Using Supabase SQL Editor
1. Go to SQL Editor in Supabase dashboard
2. Create new query
3. Copy entire contents of `supabase/migrations/002_indexing_schema.sql`
4. Paste and click "Run"

Option B: Using Supabase CLI
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Push migration
supabase db push
```

#### Verify Schema

Run this query in SQL Editor to verify tables exist:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'indexed_%';
```

You should see:
- `indexed_content`
- `indexed_bundles`
- `indexed_creators`
- `indexed_ownership`
- `bundle_content`

### 2. Helius Webhook Setup

#### Create Webhook

1. Go to [Helius Dashboard](https://dashboard.helius.dev)
2. Select your project (or create one)
3. Go to "Webhooks" section
4. Click "Create Webhook"

#### Configure Webhook

**Webhook Type**: Enhanced Transactions

**Webhook URL**:
- Development: Use ngrok or similar tunnel
  ```bash
  ngrok http 3000
  # Use: https://your-ngrok-id.ngrok.io/api/webhooks/helius
  ```
- Production: `https://your-domain.com/api/webhooks/helius`

**Account Addresses** (add these to monitor):
```
Your content-registry program ID
CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d
```

**Webhook Secret**:
- Generate a strong secret
- Copy and save for environment variables

**Transaction Types**:
- Select "Any" or specific types you need

#### Test Webhook

1. Save webhook configuration
2. Use Helius dashboard "Test Webhook" feature
3. Check Next.js logs for incoming events

### 3. Environment Configuration

#### Copy Template

```bash
cp .env.indexer.example .env.local
```

#### Fill in Values

Edit `.env.local`:

```bash
# From Supabase dashboard
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# From Helius dashboard
HELIUS_WEBHOOK_SECRET=your_webhook_secret

# Optional configurations
IPFS_GATEWAY=https://ipfs.filebase.io/ipfs
NEXT_PUBLIC_SOLANA_NETWORK=devnet
```

### 4. Install Dependencies

```bash
# Install packages
pnpm install

# Verify @supabase/supabase-js is installed
pnpm list | grep supabase
```

If not installed:
```bash
pnpm add @supabase/supabase-js
```

### 5. Start Development Server

```bash
pnpm dev
```

Server should start at http://localhost:3000

### 6. Test Indexing

#### Test Webhook Endpoint

```bash
curl http://localhost:3000/api/webhooks/helius
```

Should return:
```json
{
  "status": "ok",
  "message": "Helius webhook handler is running"
}
```

#### Test Search API

```bash
curl "http://localhost:3000/api/search?q=test&type=content"
```

Should return empty results (before indexing):
```json
{
  "results": [],
  "total": 0,
  "limit": 20,
  "offset": 0,
  "type": "content"
}
```

### 7. Backfill Existing Data (Optional)

If you have existing on-chain data, create a backfill script:

```ts
// scripts/backfill-indexer.ts
import { Connection } from "@solana/web3.js";
import { backfillAllContent, backfillAllBundles } from "../apps/web/src/lib/indexer/sync";

async function main() {
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");

  console.log("Starting content backfill...");
  const contentCount = await backfillAllContent(connection);
  console.log(`Indexed ${contentCount} content entries`);

  console.log("Starting bundle backfill...");
  const bundleCount = await backfillAllBundles(connection);
  console.log(`Indexed ${bundleCount} bundles`);

  console.log("Backfill complete!");
}

main().catch(console.error);
```

Run with:
```bash
tsx scripts/backfill-indexer.ts
```

## Verification Checklist

- [ ] Supabase project created
- [ ] Database migration run successfully
- [ ] All 5 tables exist in database
- [ ] Helius webhook created and configured
- [ ] Environment variables set in `.env.local`
- [ ] Development server starts without errors
- [ ] Webhook endpoint returns 200 OK
- [ ] Search API returns valid JSON
- [ ] (Optional) Backfill script completed

## Testing the System

### 1. Create Test Content

Use your existing content creation flow to register content on-chain.

### 2. Check Webhook Logs

Monitor Next.js console for webhook events:

```
Received 1 webhook events
Synced content: Qm...
Indexed NFT ownership: ABC123...
```

### 3. Query Database

Check Supabase SQL Editor:

```sql
-- Check content count
SELECT COUNT(*) FROM indexed_content;

-- View recent content
SELECT name, content_cid, creator_address, created_at
FROM indexed_content
ORDER BY created_at DESC
LIMIT 10;

-- Check creator stats
SELECT * FROM indexed_creators
ORDER BY total_mints DESC
LIMIT 10;
```

### 4. Test Search

```bash
# Search by name
curl "http://localhost:3000/api/search?q=music&type=content"

# Search by creator
curl "http://localhost:3000/api/search?creator=YOUR_WALLET_ADDRESS&type=content"

# Get trending
curl "http://localhost:3000/api/trending?type=content&period=7d"
```

## Common Issues

### "Table does not exist"

**Problem**: Migration didn't run properly

**Solution**:
1. Check SQL Editor for errors
2. Manually run migration SQL
3. Verify table creation: `SELECT * FROM indexed_content LIMIT 1;`

### "Invalid signature" on webhook

**Problem**: HELIUS_WEBHOOK_SECRET mismatch

**Solution**:
1. Verify secret in Helius dashboard
2. Copy exact secret to `.env.local`
3. Restart dev server
4. Test again

### "Failed to fetch metadata"

**Problem**: IPFS gateway timeout or unreachable

**Solution**:
1. Try alternative gateway in `.env.local`
2. Increase timeout in `lib/indexer/metadata.ts`
3. Verify metadata CID is valid

### Search returns no results

**Problem**: No data indexed yet

**Solution**:
1. Create test content on-chain
2. Trigger webhook event
3. Or run backfill script
4. Query database to verify data

## Production Deployment

### Environment Variables

Add to your production environment (Vercel, Railway, etc.):

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
HELIUS_WEBHOOK_SECRET=...
IPFS_GATEWAY=...
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
```

### Webhook URL

Update Helius webhook URL to production domain:
```
https://your-production-domain.com/api/webhooks/helius
```

### Database

Consider Supabase production tier for:
- Increased performance
- Daily backups
- Point-in-time recovery
- Higher rate limits

### Monitoring

Set up monitoring for:
- Webhook endpoint uptime
- Database query performance
- Search API response times
- Error rates in logs

## Next Steps

1. Integrate search components into your UI
2. Customize search filters for your use case
3. Add creator profile pages using indexer data
4. Implement trending/discovery pages
5. Set up analytics for popular searches

## Support

If you encounter issues:

1. Check logs in Next.js console
2. Verify environment variables
3. Test individual components (webhook, search API)
4. Review Supabase logs in dashboard
5. Check Helius webhook delivery history

For more details, see [INDEXING_SYSTEM.md](./INDEXING_SYSTEM.md)
