# Handcraft - Current Features Documentation

## Overview

Handcraft is a decentralized content platform on Solana combining features of TikTok, YouTube, Spotify, Patreon, and Reddit with on-chain monetization through content editions and rentals.

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
| Content Locking | ✅ Done | Content locks after first mint (immutable) |
| CID Uniqueness | ✅ Done | SHA256-based CID registry prevents duplicates |
| Tips | ✅ Done | Direct SOL tipping to creators |

### 2. Content Encryption & Access Control

| Feature | Status | Description |
|---------|--------|-------------|
| Content Encryption | ✅ Done | NaCl symmetric encryption for gated content |
| Preview Generation | ✅ Done | Auto-generate preview (first 10% or 5MB) |
| Session Authentication | ✅ Done | Wallet signature-based 24h sessions |
| Access Verification | ✅ Done | Check creator/edition owner status for decryption |
| Bundle Access | ✅ Done | Bundle edition owners can access all content in the bundle |
| Server-held Keys | ✅ Done | Deterministic key derivation (no per-content storage) |

### 3. Content Minting System

| Feature | Status | Description |
|---------|--------|-------------|
| Mint Configuration | ✅ Done | Set price, supply (limited/unlimited), royalty |
| SOL Payments | ✅ Done | Pay with SOL for minting |
| Simple Mint | ✅ Done | Single-transaction minting with slot hash randomness |
| Rarity Distribution | ✅ Done | Fair rarity distribution (Common 55%, Uncommon 27%, Rare 13%, Epic 4%, Legendary 1%) |
| Metaplex Core | ✅ Done | Modern on-chain asset standard with plugins |
| Edition Numbering | ✅ Done | Sequential edition numbers per content |
| Rarity Weights | ✅ Done | 1/5/20/60/120 for Common/Uncommon/Rare/Epic/Legendary |
| Fixed Royalty | ✅ Done | 4% creator royalty on secondary sales |

### 4. Fee Structure & Revenue Splits

| Feature | Status | Description |
|---------|--------|-------------|
| Primary Sale Split | ✅ Done | Creator 80%, Platform 5%, Ecosystem 3%, Holders 12% |
| Secondary Royalties | ✅ Done | Fixed 4% creator royalty via Metaplex plugin |
| Holder Rewards | ✅ Done | 12% primary / 8% secondary to edition holders |
| Rarity-Weighted Rewards | ✅ Done | Higher rarity = more rewards |
| First-Mint Logic | ✅ Done | Holder portion goes to creator if no existing holders |

### 5. Reward System

| Feature | Status | Description |
|---------|--------|-------------|
| Content Reward Pools | ✅ Done | Per-content accumulated rewards with reward_per_share |
| Bundle Reward Pools | ✅ Done | Per-bundle accumulated rewards for bundle edition holders |
| Per-Edition Tracking | ✅ Done | Individual reward debt per edition with weight |
| Weighted Rewards | ✅ Done | Formula: `(weight * reward_per_share - debt) / PRECISION` |
| Claim Rewards | ✅ Done | Claim pending rewards from content |
| Unified Claim | ✅ Done | Claim content + bundle rewards in combined transactions |
| Batch Bundle Claims | ✅ Done | All editions per bundle claimed in single instruction |
| Transaction Batching | ✅ Done | Up to 4 instructions per transaction (content + bundle) |
| Multi-Content Claims | ✅ Done | Claim from multiple contents across transactions |
| Verified Claims | ✅ Done | On-chain edition ownership verification for claims |
| Transfer Sync | ✅ Done | Update reward positions on edition transfer |
| Rarity Multipliers | ✅ Done | Weighted reward distribution by rarity |
| Mint Sequence Display | ✅ Done | Editions sorted by createdAt in claim modal |
| Secondary Sale Sync | ✅ Done | Auto-sync royalties to reward pool on claim |

### 6. Rental System

| Feature | Status | Description |
|---------|--------|-------------|
| Rental Configuration | ✅ Done | 3-tier pricing (6h, 1d, 7d) |
| Rental Execution | ✅ Done | Create frozen rental token with expiry |
| Rental Extensions | ✅ Done | Extend active rentals |
| Expiry Tracking | ✅ Done | On-chain expiration timestamp |
| Freeze Delegate | ✅ Done | Prevent rental token transfers |
| Rental Access Check | ✅ Done | Verify rental is still valid |

### 7. Bundle System

| Feature | Status | Description |
|---------|--------|-------------|
| Bundle Creation | ✅ Done | Create named bundles (Album, Series, Playlist, Course, etc.) |
| Bundle Items | ✅ Done | Add/remove content with ordering |
| Bundle Types | ✅ Done | 7 types: Album, Series, Playlist, Course, Newsletter, Collection, ProductPack |
| Bundle Metadata | ✅ Done | IPFS metadata for bundle info |
| Drag-and-Drop Ordering | ✅ Done | Reorder items via metadata with position tracking |
| Bundle Minting | ✅ Done | Mint editions for bundles with rarity |
| Bundle Rentals | ✅ Done | 3-tier rental pricing (6h, 1d, 7d) for bundles |
| Bundle Reward Pools | ✅ Done | 12% holder rewards distributed to bundle edition holders |
| Bundle Collections | ✅ Done | Metaplex Core collection per bundle |
| Bundle Content Access | ✅ Done | Bundle edition grants access to all encrypted content |
| Bundle Locking | ✅ Done | Bundle locks after first mint |
| Bundle Page | ✅ Done | Dedicated page showing bundle contents and purchase options |

### 8. Web Application

| Feature | Status | Description |
|---------|--------|-------------|
| Landing Page | ✅ Done | Hero, features, Creator/Fan value propositions |
| Explore Feed | ✅ Done | Content and Bundles tabs at /explore |
| Bundle Feed | ✅ Done | Dedicated tab for browsing bundles |
| Content Cards | ✅ Done | Preview, metadata, actions, rarity badges, duration |
| Bundle Cards | ✅ Done | Bundle preview with item count and pricing |
| Search Page | ✅ Done | Client-side search by title, description, creator |
| Sorting Options | ✅ Done | Date, minted, price, random with asc/desc toggle |
| Infinite Scroll | ✅ Done | Auto-load more content on scroll |
| URL Params | ✅ Done | Shareable links with filter/sort/tab state |
| Copy Share Link | ✅ Done | Share content/bundle URLs |
| Duration Display | ✅ Done | Video/audio length badges |
| Creator Dashboard | ✅ Done | Stats, content table, bundles, rewards overview |
| User Profiles | ✅ Done | Created/Collected/Rewards tabs |
| Wallet Integration | ✅ Done | Solana Wallet Adapter (auto-detect) |
| Upload Wizard | ✅ Done | Multi-step with encryption option |
| Buy Content Modal | ✅ Done | Minting with rarity reveal |
| Buy Bundle Modal | ✅ Done | Purchase bundle editions with rarity |
| Rent Modal | ✅ Done | Tier selection, extension support |
| Rent Bundle Modal | ✅ Done | Rent bundles with tier selection |
| Sell Modal | ✅ Done | Secondary market sale |
| Burn Modal | ✅ Done | Burn owned editions |
| Claim Modal | ✅ Done | Unified content + bundle rewards claim |
| Manage Content Modal | ✅ Done | Configure mint/rent settings for content |
| Manage Bundle Modal | ✅ Done | Configure mint/rent settings, manage items |
| Create Bundle Modal | ✅ Done | Create bundles with metadata and items |
| Edit/Delete Modals | ✅ Done | Content management for creators |
| Session Auth | ✅ Done | Sign message for encrypted access |
| Rarity Display | ✅ Done | Colored badges/bubbles by rarity |
| Combined Rewards Header | ✅ Done | Header shows total pending (content + bundle) |
| Transaction Simulation | ✅ Done | All mutations simulate before wallet prompt |

### 9. SDK Capabilities

| Feature | Status | Description |
|---------|--------|-------------|
| Client Factory | ✅ Done | `createContentRegistryClient()` |
| All Instructions | ✅ Done | 45+ instruction builders (content, bundle, mint, rent, rewards) |
| Fetch Functions | ✅ Done | Single and batch fetching with caching |
| PDA Derivation | ✅ Done | All 20+ PDA types (content, bundle, mint, rent, rewards) |
| Bundle Instructions | ✅ Done | Create, update, delete, add/remove items |
| Bundle Mint/Rent | ✅ Done | Configure and execute bundle minting/rentals |
| Batch Claims | ✅ Done | Batch claim instructions for content and bundles |
| IPFS Upload | ✅ Done | Filebase S3 integration |
| Encryption Utils | ✅ Done | NaCl encrypt/decrypt |
| Format Utils | ✅ Done | Address, duration, count formatting |

---

## Partially Implemented / Placeholder Features

| Feature | Status | Notes |
|---------|--------|-------|
| Trending | 🔶 Placeholder | Sidebar link only, no algorithm |
| Communities | 🔶 Placeholder | Sidebar link only |
| Library (Watch Later, Liked, Playlists) | 🔶 Placeholder | Sidebar links only |
| USDC Payments | 🔶 Partial | Token mint defined, not integrated |
| $CRAFT Token | 🔶 Placeholder | Constants defined, not integrated |
| Mobile App | 🔶 Scaffold | React Native setup, not developed |
| Indexer | 🔶 Scaffold | Folder exists, not implemented |

---

## Not Yet Implemented

### Critical Missing Features
1. **Feed Algorithm** - Just chronological/random, no personalization
2. **Following System** - No follow/unfollow creators
3. **Notifications** - No notification system
4. **Comments/Reactions** - No social interaction
5. **Mobile App** - Only web implemented

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

### Advanced Content Features
- Batch minting
- Auctions
- Dutch auctions
- Whitelist minting
- Marketplace integration

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                      Web App (Next.js 15)                        │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│    Pages     │  Components  │    Hooks     │    API Routes      │
│  - Home      │  - Header    │  - Registry  │  - /session        │
│  - Explore   │  - Sidebar   │  - Session   │  - /content        │
│  - Bundle    │  - Modals    │  - Upload    │  - /upload         │
│  - Profile   │  - Cards     │              │                    │
│  - Dashboard │              │              │                    │
└──────┬───────┴──────┬───────┴──────┬───────┴────────────────────┘
       │              │              │
       ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         SDK Package                              │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│  Instructions│   Fetching   │    Types     │    Utilities       │
│  (45+ total) │  (batch opt) │  (20+ accts) │  - IPFS            │
│              │              │              │  - Crypto          │
└──────────────┴──────┬───────┴──────────────┴────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│               Solana Program (content-registry)                  │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────┤
│   Content   │   Bundles   │   Minting   │   Rewards   │ Rentals │
│  - Register │  - Create   │  - VRF      │  - Pools    │ - Config│
│  - Update   │  - Items    │  - Escrow   │  - Claims   │ - Exec  │
│  - Delete   │  - Mint/Rent│  - Fallback │  - Batch    │ - Extend│
└─────────────┴─────────────┴─────────────┴─────────────┴─────────┘
        │              │              │
        ▼              ▼              ▼
┌───────────────┐ ┌───────────────┐
│ Metaplex Core │ │    IPFS       │
│  - Assets     │ │  - Content    │
│  - Royalties  │ │  - Metadata   │
└───────────────┘ └───────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, React, TailwindCSS |
| State | React Query (TanStack) |
| Blockchain | Solana, Anchor 0.32.1 |
| Assets | Metaplex Core |
| Randomness | Slot hash based randomness |
| Storage | IPFS (Filebase S3) |
| Encryption | TweetNaCl |
| Wallet | Solana Wallet Adapter |
| Monorepo | Turborepo, PNPM |

---

*Last updated: December 13, 2025*
