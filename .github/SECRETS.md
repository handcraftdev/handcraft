# GitHub Secrets Configuration

This document lists all secrets required for CI/CD workflows.

## Required Secrets

### Authentication & Security

| Secret | Description | How to Generate |
|--------|-------------|-----------------|
| `SESSION_SECRET` | HMAC key for session tokens | `openssl rand -hex 32` |
| `CONTENT_ENCRYPTION_SECRET` | Key for content encryption | `openssl rand -hex 32` |

### Supabase

| Secret | Description | Source |
|--------|-------------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Supabase Dashboard → Settings → API |

### Solana

| Secret | Description | Source |
|--------|-------------|--------|
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Solana RPC endpoint | Helius, QuickNode, or public RPC |
| `CONTENT_REGISTRY_PROGRAM_ID` | Deployed program address | From `anchor deploy` output |

### Storage (Filebase/IPFS)

| Secret | Description | Source |
|--------|-------------|--------|
| `FILEBASE_KEY` | Filebase access key | Filebase Dashboard → Access Keys |
| `FILEBASE_SECRET` | Filebase secret key | Filebase Dashboard → Access Keys |
| `FILEBASE_BUCKET` | Filebase bucket name | Filebase Dashboard → Buckets |

### Webhooks (Optional)

| Secret | Description | How to Generate |
|--------|-------------|-----------------|
| `HELIUS_WEBHOOK_SECRET` | Helius webhook auth token | `openssl rand -hex 32` |

### Vercel Deployment

| Secret | Description | Source |
|--------|-------------|--------|
| `VERCEL_TOKEN` | Vercel API token | Vercel Dashboard → Settings → Tokens |
| `VERCEL_ORG_ID` | Vercel organization ID | `vercel link` → `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | Vercel project ID | `vercel link` → `.vercel/project.json` |

## Setup Instructions

### 1. Generate Security Secrets

```bash
# Generate unique secrets (run each separately)
openssl rand -hex 32  # SESSION_SECRET
openssl rand -hex 32  # CONTENT_ENCRYPTION_SECRET
openssl rand -hex 32  # HELIUS_WEBHOOK_SECRET
```

### 2. Add Secrets to GitHub

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret from the tables above

### 3. Link Vercel Project

```bash
# Install Vercel CLI
pnpm add -g vercel

# Link project (creates .vercel/project.json)
cd apps/web
vercel link

# Get org and project IDs from .vercel/project.json
cat .vercel/project.json
```

### 4. Create Vercel Token

1. Go to [Vercel Dashboard](https://vercel.com/account/tokens)
2. Click **Create Token**
3. Name it (e.g., "GitHub Actions")
4. Copy the token and add as `VERCEL_TOKEN` secret

## Environment-Specific Configuration

### Production vs Preview

The deploy workflow supports two environments:
- **production**: Deployed to main domain
- **preview**: Deployed to preview URL

Configure environment-specific secrets in GitHub:
1. Go to **Settings** → **Environments**
2. Create `production` and `preview` environments
3. Add environment-specific secrets if needed

## Security Notes

1. **Never commit secrets** to the repository
2. **Rotate secrets** regularly (every 90 days recommended)
3. **Use separate secrets** for SESSION_SECRET and CONTENT_ENCRYPTION_SECRET
4. **Limit secret access** to required workflows only
