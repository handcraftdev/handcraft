# Environment Variables Setup

This document outlines how to set up environment variables for the Handcraft Mini App across different environments.

## Local Development

1. Create a `.env.local` file in the project root:

```bash
cp .env.example .env.local
```

2. Edit the `.env.local` file and set the following required variables:

```env
# App Configuration
NEXT_PUBLIC_APP_ID=your_mini_app_id_from_developer_portal
HMAC_SECRET_KEY=your_hmac_secret
NEXTAUTH_SECRET=generated_auth_secret_using_npx_auth_secret
AUTH_URL=http://localhost:3000

# Verification Action IDs
NEXT_PUBLIC_VERIFY_ACTION_ID=your_general_verification_action_id
NEXT_PUBLIC_VERIFY_ACTION_ROCK=your_rock_move_verification_action_id
NEXT_PUBLIC_VERIFY_ACTION_PAPER=your_paper_move_verification_action_id
NEXT_PUBLIC_VERIFY_ACTION_SCISSORS=your_scissors_move_verification_action_id

# Supabase (Local Development)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_local_supabase_anon_key
```

## GitHub Actions & Deployments

For CI/CD environments (both Preview and Production), environment variables need to be set in GitHub Secrets and Vercel.

### GitHub Secrets

Set up the following secrets in your GitHub repository:

1. `VERCEL_TOKEN`: Your Vercel API token
2. `VERCEL_ORG_ID`: Your Vercel organization ID
3. `VERCEL_PROJECT_ID`: Your Vercel project ID
4. `SUPABASE_ACCESS_TOKEN`: Your Supabase access token
5. `SUPABASE_DB_PASSWORD`: Your Supabase database password
6. `SUPABASE_PROJECT_ID`: Your Supabase project reference ID

### Vercel Environment Variables

Configure the following variables in your Vercel project settings:

#### Preview Environment (Development)

```
NEXT_PUBLIC_APP_ID=your_dev_mini_app_id
HMAC_SECRET_KEY=your_dev_hmac_secret
NEXTAUTH_SECRET=your_dev_nextauth_secret
AUTH_URL=https://preview-branch-url.vercel.app
NEXT_PUBLIC_VERIFY_ACTION_ID=your_dev_verification_action_id
NEXT_PUBLIC_VERIFY_ACTION_ROCK=your_dev_rock_verification_id
NEXT_PUBLIC_VERIFY_ACTION_PAPER=your_dev_paper_verification_id
NEXT_PUBLIC_VERIFY_ACTION_SCISSORS=your_dev_scissors_verification_id
NEXT_PUBLIC_SUPABASE_URL=your_dev_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_dev_supabase_anon_key
```

#### Production Environment

```
NEXT_PUBLIC_APP_ID=your_prod_mini_app_id
HMAC_SECRET_KEY=your_prod_hmac_secret
NEXTAUTH_SECRET=your_prod_nextauth_secret
AUTH_URL=https://your-production-domain.com
NEXT_PUBLIC_VERIFY_ACTION_ID=your_prod_verification_action_id
NEXT_PUBLIC_VERIFY_ACTION_ROCK=your_prod_rock_verification_id
NEXT_PUBLIC_VERIFY_ACTION_PAPER=your_prod_paper_verification_id
NEXT_PUBLIC_VERIFY_ACTION_SCISSORS=your_prod_scissors_verification_id
NEXT_PUBLIC_SUPABASE_URL=your_prod_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_prod_supabase_anon_key
```

## Environment Branching Strategy

Our environment setup follows this branching strategy:

- **Feature branches**: Deploy to preview environments
- **Main branch**: Deploy to production environment

When a pull request is opened, a preview deployment is automatically created with preview environment variables.

## Vercel and Supabase Integration

Here's how our CI/CD pipeline integrates Vercel deployments with Supabase:

1. When code is pushed to the main branch or a PR is created, GitHub Actions runs tests and linting
2. For Supabase migrations, we validate migration files and apply them to the appropriate environment
3. For deployment, we use Vercel's GitHub integration to deploy the application:
   - PR branches deploy to preview environments
   - Main branch deploys to production

## Managing Secrets Securely

- Never commit secrets or environment files to the repository
- Rotate secrets periodically for security
- Use different sets of secrets for each environment to maintain isolation