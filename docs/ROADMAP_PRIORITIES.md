# Handcraft - Feature Roadmap & Priorities

## Priority Framework

Features are prioritized based on:
1. **User Value** - Direct impact on user experience
2. **Revenue Impact** - Enables monetization or growth
3. **Technical Foundation** - Required for other features
4. **Implementation Complexity** - Effort vs reward

---

## Completed Features

### ✅ Content Type Filters
- Content type filters (17 types) on Feed tab
- Bundle type filters (7 types) on Bundles tab
- Persistent filter/tab selection via localStorage
- Centered, wrapping filter chips

---

# Part A: Core Features (No Backend Required)

These features can be built using on-chain data and client-side storage only.

## A1. Search & Discovery

**Why:** Users cannot find content without search. Critical for retention.

| Feature | Complexity | Description |
|---------|------------|-------------|
| Basic Search | Medium | Full-text search on title, description, tags |
| Search Results Page | Low | Display matching content with cards |
| Search History | Low | Recent searches stored locally |
| Advanced Filters | Low | Filter by price range, rarity, date |

**Implementation:**
- Query IPFS metadata (already cached in React Query)
- Client-side filtering and sorting
- localStorage for search history

## A2. Trending & Discovery

| Feature | Complexity | Description |
|---------|------------|-------------|
| Trending Page | Medium | Sort by recent mints/tips (on-chain data) |
| New Releases | Low | Sort by creation date |
| Top Creators | Medium | Rank by total sales/tips |

**Implementation:**
- Use existing on-chain data (mintedCount, tips)
- Simple scoring algorithm
- No backend needed

## A3. Creator Tools

| Feature | Complexity | Description |
|---------|------------|-------------|
| Revenue Charts | Medium | Visualize on-chain earnings |
| Top Content | Low | Sort creator's content by performance |
| Draft Saving | Low | localStorage for incomplete uploads |
| Batch Upload | Medium | Upload multiple files at once |

## A4. Advanced Minting (On-Chain)

| Feature | Complexity | Description |
|---------|------------|-------------|
| Batch Minting | Medium | Mint multiple NFTs at once |
| Whitelist Minting | Medium | Allowlist for early access |
| Auction Minting | High | Time-limited bidding |
| Bonding Curve | High | Price increases with supply |

## A5. Marketplace (On-Chain)

| Feature | Complexity | Description |
|---------|------------|-------------|
| List NFTs for Sale | High | Fixed price listings |
| Buy Listed NFTs | High | Purchase from listings |
| Marketplace Page | Medium | Browse all listings |

## A6. UI/UX Improvements

| Feature | Complexity | Description |
|---------|------------|-------------|
| Copy Share Link | Low | Copy content URL button |
| Content Duration | Low | Show video/audio length |
| Better Video Player | Medium | Chapters, quality, speed controls |
| Audio Player | Medium | Playlist, queue, shuffle |

---

# Part B: Social Features (Requires Backend Service)

These features require a backend service for efficient storage and real-time updates.

## Backend Architecture

**Recommended: Supabase**
- Built-in auth (wallet signature verification)
- Real-time subscriptions for notifications
- Row-level security for user data
- Easy integration with Next.js

| Option | Pros | Cons | Cost |
|--------|------|------|------|
| **Supabase** | Fast setup, real-time, auth | Vendor lock-in | $25/mo+ |
| **Railway + PostgreSQL** | Flexible, cheap | More setup | $5-20/mo |
| **PlanetScale + Vercel** | Serverless, scalable | MySQL not Postgres | $0-29/mo |
| **Self-hosted** | Full control | Maintenance burden | VPS cost |

**Database Schema:**
```sql
-- Users (wallet-based)
users (wallet_address PK, display_name, avatar_cid, bio, created_at)

-- Social graph
follows (follower, following, created_at)

-- Engagement
comments (id, content_cid, user, text, parent_id, created_at)
reactions (id, content_cid, user, emoji, created_at)
views (content_cid, user, viewed_at)

-- Library
bookmarks (user, content_cid, list_type, created_at)  -- watch_later, liked

-- Notifications
notifications (id, user, type, data, read, created_at)
```

## B1. Following System

| Feature | Complexity | Description |
|---------|------------|-------------|
| Follow/Unfollow | Low | Button on profiles/cards |
| Following Feed | Medium | Filter feed to followed creators |
| Follower Count | Low | Display on profiles |
| Following List | Low | View who user follows |

## B2. Comments & Reactions

| Feature | Complexity | Description |
|---------|------------|-------------|
| Comments | Medium | Text comments on content |
| Emoji Reactions | Low | Quick reactions |
| Reply Threading | Medium | Nested comment replies |
| Comment Moderation | Medium | Delete, report, hide |

## B3. Notifications

| Feature | Complexity | Description |
|---------|------------|-------------|
| In-App Notifications | Medium | Bell icon with dropdown |
| Real-time Updates | Medium | Supabase real-time subscriptions |
| Email Notifications | Medium | Optional email alerts |
| Push Notifications | High | Browser/mobile push |

**Notification Types:**
- New follower
- Comment on your content
- Reply to your comment
- NFT sold (primary/secondary)
- Rewards available to claim
- New content from followed creator

## B4. Library Features

| Feature | Complexity | Description |
|---------|------------|-------------|
| Watch Later | Low | Save content for later |
| Liked Content | Low | Track liked content |
| View History | Low | Recently viewed content |
| Custom Playlists | Medium | User-created playlists |

## B5. Analytics (Backend Required)

| Feature | Complexity | Description |
|---------|------------|-------------|
| View Counts | Medium | Track content views |
| Audience Demographics | High | Geographic, device data |
| Referral Tracking | Medium | Traffic sources |
| Engagement Metrics | Medium | Watch time, completion rate |

## B6. Communities

| Feature | Complexity | Description |
|---------|------------|-------------|
| Community Creation | High | Create named communities |
| Community Posts | High | Text posts with upvotes |
| Community Moderation | High | Mod tools, rules |
| Token Gating | Medium | NFT required to join |

---

# Part C: Platform Expansion

Long-term features for scale.

## C1. Mobile App

| Feature | Complexity | Description |
|---------|------------|-------------|
| React Native App | Very High | Full mobile experience |
| TikTok-style Feed | High | Vertical swipe navigation |
| Background Audio | Medium | Play audio while browsing |

## C2. Indexer Service

| Feature | Complexity | Description |
|---------|------------|-------------|
| Event Indexing | High | Index all program events |
| GraphQL API | High | Query indexed data |
| Historical Analytics | Medium | Track metrics over time |

**Options:**
- Helius Webhooks → PostgreSQL
- Custom Geyser plugin
- Managed service (Shyft, Helius DAS)

## C3. Token Integration

| Feature | Complexity | Description |
|---------|------------|-------------|
| $CRAFT Token | High | Launch platform token |
| Token Payments | Medium | Pay with $CRAFT |
| Staking Rewards | High | Stake for benefits |

---

## Implementation Order

### Phase 1: No Backend Required
```
1. Search & Discovery
2. Trending Page
3. UI/UX Improvements (share link, duration)
4. Creator Revenue Charts
```

### Phase 2: Set Up Social Backend (Supabase)
```
1. User profiles
2. Following system
3. View counts
4. Library (watch later, liked)
```

### Phase 3: Social Engagement
```
1. Comments & reactions
2. Notifications
3. Activity feed
```

### Phase 4: Advanced Features
```
1. Advanced minting options
2. Marketplace
3. Communities
```

### Phase 5: Scale
```
1. Indexer service
2. Mobile app
3. Token integration
```

---

## Quick Wins (< 1 day each)

**No Backend:**
- Copy Share Link button
- Content Duration display
- Search History (localStorage)
- Better loading states

**With Backend:**
- View Count display
- Follow button
- Like button

---

*Start with Part A features, then set up Supabase for Part B.*
