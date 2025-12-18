# Contributing to Handcraft

## Branch Strategy

We use **GitHub Flow** - a simple, branch-based workflow.

### Branches

| Branch | Purpose | Deploys To |
|--------|---------|------------|
| `main` | Production code | Production (auto) |
| `feature/*` | New features | Preview URL (on PR) |
| `fix/*` | Bug fixes | Preview URL (on PR) |
| `hotfix/*` | Urgent production fixes | Preview URL (on PR) |

### Workflow

```
1. Create branch from main
   git checkout -b feature/my-feature

2. Make changes and commit
   git add .
   git commit -m "Add my feature"

3. Push and create PR
   git push -u origin feature/my-feature
   # Create PR on GitHub

4. Review & Test
   - CI runs automatically
   - Preview URL generated
   - Request review from team

5. Merge to main
   - Requires 1+ approval
   - CI must pass
   - Auto-deploys to production
```

## Development Workflow

### Local Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm run dev

# Run linting
pnpm run lint

# Build for production (test before PR)
pnpm run build
```

### Before Creating PR

1. **Test locally**: Run `pnpm run build` to catch build errors
2. **Lint code**: Run `pnpm run lint`
3. **Write clear commit messages**:
   ```
   feat: add user authentication
   fix: resolve login redirect issue
   docs: update API documentation
   refactor: simplify payment flow
   ```

### PR Guidelines

- **Title**: Clear, concise description
- **Description**: What changed and why
- **Screenshots**: For UI changes
- **Testing**: How to test the changes

## Branch Protection (For Admins)

Set up branch protection for `main`:

1. Go to **Settings** → **Branches**
2. Add rule for `main`:
   - ✅ Require pull request before merging
   - ✅ Require 1 approval
   - ✅ Require status checks to pass
     - `Web App`
     - `Solana Program`
     - `Security Scan`
   - ✅ Require branches to be up to date
   - ✅ Do not allow bypassing

## Deployment Environments

### Preview (PRs)

- **Trigger**: Every PR to main
- **URL**: Auto-generated Vercel preview
- **Purpose**: Test changes before merge

### Production (main)

- **Trigger**: Merge to main
- **URL**: Production domain
- **Rollback**: Manual workflow dispatch

## Solana Program Changes

⚠️ **Program changes require extra care!**

1. Always test with `anchor test` locally
2. Update IDL in SDK if changed: `cp target/idl/*.json packages/sdk/src/program/`
3. Program deployment is **manual** (not automated in CI)

### Deploying Program

```bash
# Build
anchor build

# Deploy to devnet (for testing)
anchor deploy --provider.cluster devnet

# Deploy to mainnet (production)
anchor deploy --provider.cluster mainnet-beta
```
