# Handcraft - Current Features Documentation

## Overview

Handcraft is a decentralized content platform on Solana combining features of TikTok, YouTube, Spotify, Patreon, and Reddit with on-chain monetization through NFTs and rentals.

---

## Implemented Features

### 1. Content Management

| Feature | Status | Description |
|---------|--------|-------------|
| Content Registration | ✅ Done | Register content with IPFS CID, metadata, and content type |
| Content Types | ✅ Done | 17 types: Video, Movie, TV, MusicVideo, Short, Music, Podcast, Audiobook, Photo, Artwork, Book, Comic, Asset, Game, Software, Dataset, Post |
| Content Domains | ✅ Done | 6 domains: Video, Audio, Image, Document, File, Text |
| Content Update | ✅ Done | Update metadata CID (before first mint) |
| Content Delete | ✅ Done | Delete content (before first mint) |
| Content Locking | ✅ Done | Content locks after first NFT mint (immutable) |
| CID Uniqueness | ✅ Done | SHA256-based CID registry prevents duplicates |
| Tips | ✅ Done | Direct SOL tipping to creators |

### 2. Content Encryption & Access Control

| Feature | Status | Description |
|---------|--------|-------------|
| Content Encryption | ✅ Done | NaCl symmetric encryption for gated content |
| Preview Generation | ✅ Done | Auto-generate preview (first 10% or 5MB) |
| Session Authentication | ✅ Done | Wallet signature-based 24h sessions |
| Access Verification | ✅ Done | Check creator/NFT owner status for decryption |
| Server-held Keys | ✅ Done | Deterministic key derivation (no per-content storage) |

### 3. NFT Minting System

| Feature | Status | Description |
|---------|--------|-------------|
| Mint Configuration | ✅ Done | Set price, supply (limited/unlimited), royalty |
| SOL Payments | ✅ Done | Pay with SOL for minting |
| VRF Rarity | ✅ Done | Switchboard VRF for fair rarity (Common→Legendary) |
| Commit-Reveal Flow | ✅ Done | Two-step minting with randomness |
| Pending Mint Recovery | ✅ Done | Cross-device recovery of interrupted mints |
| Cancel Expired Mint | ✅ Done | Refund after 10min oracle timeout |
| Escrow Pattern | ✅ Done | Payment held until reveal completes |
| Metaplex Core NFTs | ✅ Done | Modern NFT standard with plugins |
| Edition Numbering | ✅ Done | Sequential edition numbers |
| Rarity Weights | ✅ Done | 100/150/200/300/500 for C/U/R/E/L |

### 4. Fee Structure & Revenue Splits

| Feature | Status | Description |
|---------|--------|-------------|
| Primary Sale Split | ✅ Done | Creator 80%, Platform 5%, Ecosystem 3%, Holders 12% |
| Secondary Royalties | ✅ Done | 2-10% configurable via Metaplex plugin |
| Holder Rewards | ✅ Done | 12% primary / 8% secondary to NFT holders |
| Rarity-Weighted Rewards | ✅ Done | Higher rarity = more rewards |
| First-Mint Logic | ✅ Done | Holder portion goes to creator if no existing holders |

### 5. Reward System

| Feature | Status | Description |
|---------|--------|-------------|
| Content Reward Pools | ✅ Done | Per-content accumulated rewards |
| Per-NFT Tracking | ✅ Done | Individual reward debt per NFT |
| Claim Rewards | ✅ Done | Claim pending rewards from content |
| Batch Claims | ✅ Done | Claim from multiple contents at once |
| Verified Claims | ✅ Done | On-chain NFT verification for claims |
| Transfer Sync | ✅ Done | Update reward positions on NFT transfer |
| Rarity Multipliers | ✅ Done | Weighted reward distribution |

### 6. Rental System

| Feature | Status | Description |
|---------|--------|-------------|
| Rental Configuration | ✅ Done | 3-tier pricing (6h, 1d, 7d) |
| Rental Execution | ✅ Done | Create frozen rental NFT with expiry |
| Rental Extensions | ✅ Done | Extend active rentals |
| Expiry Tracking | ✅ Done | On-chain expiration timestamp |
| Freeze Delegate | ✅ Done | Prevent rental NFT transfers |
| Rental Access Check | ✅ Done | Verify rental is still valid |

### 7. Bundle System

| Feature | Status | Description |
|---------|--------|-------------|
| Bundle Creation | ✅ Done | Create named bundles (Album, Series, Playlist, Course, etc.) |
| Bundle Items | ✅ Done | Add/remove content with ordering |
| Bundle Types | ✅ Done | 7 types: Album, Series, Playlist, Course, Newsletter, Collection, ProductPack |
| Bundle Metadata | ✅ Done | IPFS metadata for bundle info |

### 8. Web Application

| Feature | Status | Description |
|---------|--------|-------------|
| Home Feed | ✅ Done | "For You" and "Your Content" tabs |
| Content Cards | ✅ Done | Preview, metadata, actions, rarity badges |
| Creator Dashboard | ✅ Done | Stats, content table, rewards overview |
| User Profiles | ✅ Done | Created/Collected/Rewards tabs |
| Wallet Integration | ✅ Done | Solana Wallet Adapter (auto-detect) |
| Upload Wizard | ✅ Done | Multi-step with encryption option |
| Buy NFT Modal | ✅ Done | VRF minting with rarity reveal |
| Rent Modal | ✅ Done | Tier selection, extension support |
| Sell NFT Modal | ✅ Done | Secondary market sale |
| Burn NFT Modal | ✅ Done | Burn owned NFTs |
| Claim Modal | ✅ Done | View and claim pending rewards |
| Edit/Delete Modals | ✅ Done | Content management for creators |
| Session Auth | ✅ Done | Sign message for encrypted access |
| Rarity Display | ✅ Done | Colored badges/bubbles by rarity |

### 9. SDK Capabilities

| Feature | Status | Description |
|---------|--------|-------------|
| Client Factory | ✅ Done | `createContentRegistryClient()` |
| All Instructions | ✅ Done | 31 instruction builders |
| Fetch Functions | ✅ Done | Single and batch fetching |
| PDA Derivation | ✅ Done | All 12 PDA types |
| IPFS Upload | ✅ Done | Filebase S3 integration |
| Encryption Utils | ✅ Done | NaCl encrypt/decrypt |
| Format Utils | ✅ Done | Address, duration, count formatting |

---

## Partially Implemented / Placeholder Features

| Feature | Status | Notes |
|---------|--------|-------|
| Search | 🔶 UI Only | Search bar exists but no backend |
| Trending | 🔶 Placeholder | Route exists, no algorithm |
| Communities | 🔶 Placeholder | Sidebar link only |
| Audio Page | 🔶 Placeholder | Route exists, no content filtering |
| Videos Page | 🔶 Placeholder | Route exists, no content filtering |
| Library (Watch Later, Liked, Playlists) | 🔶 Placeholder | Sidebar links only |
| USDC Payments | 🔶 Partial | Token mint defined, not integrated |
| $CRAFT Token | 🔶 Placeholder | Constants defined, not integrated |
| Mobile App | 🔶 Scaffold | React Native setup, not developed |
| Indexer | 🔶 Scaffold | Folder exists, not implemented |

---

## Not Yet Implemented

### Critical Missing Features
1. **Search & Discovery** - No search functionality
2. **Feed Algorithm** - Just chronological, no personalization
3. **Following System** - No follow/unfollow creators
4. **Notifications** - No notification system
5. **Comments/Reactions** - No social interaction
6. **Mobile App** - Only web implemented

### Content Features
- Video player controls (chapters, quality, speed)
- Audio player (playlist, queue, shuffle)
- Document reader/viewer
- Long-form video support (resumable uploads)
- Live streaming

### Social Features
- Follow/Following
- Comments & replies
- Likes/reactions
- Direct messaging
- Activity feed
- User mentions

### Community Features
- Community creation
- Posts/discussions
- Upvoting/downvoting
- Moderation tools
- Community token gating

### Discovery Features
- Search with filters
- Trending algorithm
- Personalized recommendations
- Category/genre browsing
- Creator leaderboards

### Creator Tools
- Analytics dashboard (detailed)
- Audience demographics
- Revenue forecasting
- A/B testing
- Scheduling

### Advanced NFT Features
- Batch minting
- Auctions
- Dutch auctions
- Whitelist minting
- NFT marketplace integration

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                     Web App (Next.js 15)                     │
├──────────────┬──────────────┬──────────────┬────────────────┤
│    Pages     │  Components  │    Hooks     │   API Routes   │
│  - Feed      │  - Header    │  - Registry  │  - /session    │
│  - Profile   │  - Sidebar   │  - Session   │  - /content    │
│  - Dashboard │  - Modals    │  - Upload    │  - /upload     │
└──────┬───────┴──────┬───────┴──────┬───────┴────────────────┘
       │              │              │
       ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────┐
│                        SDK Package                           │
├──────────────┬──────────────┬──────────────┬────────────────┤
│  Instructions│   Fetching   │    Types     │   Utilities    │
│  (31 total)  │  (batch opt) │  (14 accts)  │  - IPFS        │
│              │              │              │  - Crypto      │
└──────────────┴──────┬───────┴──────────────┴────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Solana Program (content-registry)               │
├──────────────┬──────────────┬──────────────┬────────────────┤
│   Content    │   Minting    │   Rewards    │   Rentals      │
│  - Register  │  - VRF       │  - Pools     │  - Configure   │
│  - Update    │  - Escrow    │  - Claims    │  - Execute     │
│  - Delete    │  - Reveal    │  - Sync      │  - Extend      │
└──────────────┴──────────────┴──────────────┴────────────────┘
        │              │              │
        ▼              ▼              ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│ Metaplex Core │ │ Switchboard   │ │    IPFS       │
│  - NFTs       │ │  - VRF        │ │  - Content    │
│  - Royalties  │ │  - Randomness │ │  - Metadata   │
└───────────────┘ └───────────────┘ └───────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, React, TailwindCSS |
| State | React Query (TanStack) |
| Blockchain | Solana, Anchor 0.32.1 |
| NFTs | Metaplex Core |
| Randomness | Switchboard VRF |
| Storage | IPFS (Filebase S3) |
| Encryption | TweetNaCl |
| Wallet | Solana Wallet Adapter |
| Monorepo | Turborepo, PNPM |

---

*Last updated: December 2024*
