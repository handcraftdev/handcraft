# Handcraft

Decentralized content platform combining the best of Reddit, TikTok, YouTube, Netflix, and Spotify - built on Solana.

## Features

- **Short-form video** - TikTok-style vertical feed
- **Long-form video** - YouTube-style player
- **Audio/Podcasts** - Spotify-style player
- **Training programmes** -  Skillshare
- **Community Support** - Patreon
- **Communities** - Reddit-style discussions
- **Token economy** - $CRAFT token + USDC payments
- **Fully decentralized** - Content on IPFS/Arweave

## Tech Stack

- **Web**: Next.js 15
- **Mobile**: React Native + Expo
- **Blockchain**: Solana
- **Storage**: IPFS + Arweave
- **Monorepo**: Turborepo + PNPM

## Getting Started

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Run web only
pnpm dev:web

# Run mobile only
pnpm dev:mobile

# Build
pnpm build
```

## Project Structure

```
handcraft/
├── apps/
│   ├── web/          # Next.js web app
│   ├── mobile/       # React Native app
│   └── indexer/      # Solana indexer
├── packages/
│   ├── ui/           # Shared UI components
│   ├── sdk/          # Core SDK
│   ├── types/        # TypeScript types
│   └── config/       # Shared configs
└── programs/         # Solana programs (coming soon)
```

## License

MIT
