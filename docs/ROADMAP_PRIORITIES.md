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
- URL-based filter/tab selection (shareable links)
- Centered, wrapping filter chips

### ✅ Search & Discovery
- Basic search page with client-side filtering
- Search by title, description, creator address
- Filter search results by content type
- Sort results by relevance, newest, oldest, most minted

### ✅ Sorting Options
- Sort by date (newest/oldest)
- Sort by mints (most minted)
- Sort by price (highest/lowest)
- Sort by random (consistent within session, new on refresh)
- Separate sort type and direction controls
- Bundle sorting includes item count

### ✅ UI/UX Improvements
- Copy share link button on content/bundle cards
- Content duration badges for video/audio
- Infinite scroll replacing pagination
- URL params for shareable filter/sort state
- Landing page with Creator/Fan value propositions
- Feed moved to /explore route
- Sidebar navigation (Home, Explore, Trending, Communities)

---

# Part A: On-Chain Only (No Backend Required)

These features use only on-chain data + IPFS metadata + client-side storage.

## A1. Search & Discovery ✅ DONE

**Why:** Users cannot find content without search. Critical for retention.

| Feature | Complexity | Status |
|---------|------------|--------|
| Basic Search | Medium | ✅ Done |
| Search Results Page | Low | ✅ Done |
| Search History | Low | Pending |
| Advanced Filters | Low | ✅ Done |

**Implementation:**
- Query IPFS metadata (already cached in React Query)
- Client-side filtering and sorting
- URL params for shareable search state

## A2. Sorting Options ✅ DONE

| Feature | Complexity | Status |
|---------|------------|--------|
| Sort by Date | Low | ✅ Done |
| Sort by Price | Low | ✅ Done |
| Sort by Mints | Low | ✅ Done |
| Sort by Random | Low | ✅ Done |
| Sort Type/Direction Split | Low | ✅ Done |
| Bundle Sort by Items | Low | ✅ Done |

## A3. UI/UX Improvements ✅ DONE

| Feature | Complexity | Status |
|---------|------------|--------|
| Copy Share Link | Low | ✅ Done |
| Content Duration | Low | ✅ Done |
| Infinite Scroll | Low | ✅ Done |
| Better Loading States | Low | ✅ Done (skeleton loaders) |
| Landing Page | Low | ✅ Done |
| Creator/Fan Sections | Low | ✅ Done |
| /explore Route | Low | ✅ Done |
| Keyboard Shortcuts | Low | Pending |

## A4. Creator Dashboard Enhancements

| Feature | Complexity | Description |
|---------|------------|-------------|
| Content List Sorting | Low | Sort by date, mints, revenue |
| Bundle Management | Low | Reorder items, edit metadata |
| Draft Saving | Low | localStorage for incomplete uploads |

## A5. Advanced Minting (On-Chain Program Changes)

| Feature | Complexity | Description |
|---------|------------|-------------|
| Batch Minting | Medium | Mint multiple NFTs at once |
| Whitelist Minting | Medium | Allowlist for early access |
| Auction Minting | High | Time-limited bidding |
| Bonding Curve | High | Price increases with supply |

## A6. Marketplace (On-Chain Program Changes)

| Feature | Complexity | Description |
|---------|------------|-------------|
| List NFTs for Sale | High | Fixed price listings |
| Buy Listed NFTs | High | Purchase from listings |
| Marketplace Page | Medium | Browse all listings |

---

# Part B: Requires Indexer/Analytics Backend

These features need historical data, aggregations, or high-frequency writes that aren't practical with direct RPC calls.

## Backend Options for Indexing

| Option | Pros | Cons | Cost |
|--------|------|------|------|
| **Helius Webhooks** | Easy setup, reliable | Limited customization | $49/mo+ |
| **Custom Geyser** | Full control, real-time | Complex setup | $100+/mo |
| **Shyft/Helius DAS** | Managed, GraphQL | Vendor lock-in | Varies |

## B1. Trending & Rankings

| Feature | Complexity | Description |
|---------|------------|-------------|
| Trending Content | Medium | Score by recent mints + tips over time window |
| Top Creators | Medium | Rank by total sales/tips |
| Hot Bundles | Medium | Trending bundles |

**Why Backend:** Need to track activity over time windows (24h, 7d) and compute scores efficiently.

## B2. Analytics Dashboard

| Feature | Complexity | Description |
|---------|------------|-------------|
| View Counts | Medium | Track content views |
| Revenue Over Time | Medium | Historical earnings charts |
| Mint History | Medium | When NFTs were minted |
| Audience Insights | High | Geographic, referral data |

**Why Backend:** High-frequency writes (views), time-series data, aggregations.

## B3. Activity Feeds

| Feature | Complexity | Description |
|---------|------------|-------------|
| Global Activity | Medium | Recent mints, tips across platform |
| Creator Activity | Medium | Activity on creator's content |
| User Activity | Medium | User's own transaction history |

**Why Backend:** Need to index and query program events efficiently.

## B4. Recommendations

| Feature | Complexity | Description |
|---------|------------|-------------|
| Similar Content | High | Content-based recommendations |
| Personalized Feed | High | Based on user behavior |

**Why Backend:** Requires ML/algorithms on historical data.

---

# Part C: Requires Social Backend

These features need user-generated data storage and real-time updates.

## Backend Options for Social

| Option | Pros | Cons | Cost |
|--------|------|------|------|
| **Supabase** | Fast setup, real-time, auth | Vendor lock-in | $25/mo+ |
| **Railway + Postgres** | Flexible, cheap | More setup | $5-20/mo |
| **PlanetScale** | Serverless, scalable | MySQL not Postgres | $0-29/mo |

## Database Schema

```sql
-- Users (wallet-based)
users (wallet_address PK, display_name, avatar_cid, bio, created_at)

-- Social graph
follows (follower, following, created_at)

-- Engagement
comments (id, content_cid, user, text, parent_id, created_at)
reactions (id, content_cid, user, emoji, created_at)

-- Library
bookmarks (user, content_cid, list_type, created_at)  -- watch_later, liked

-- Notifications
notifications (id, user, type, data, read, created_at)
```

## C1. Following System

| Feature | Complexity | Description |
|---------|------------|-------------|
| Follow/Unfollow | Low | Button on profiles/cards |
| Following Feed | Medium | Filter feed to followed creators |
| Follower Count | Low | Display on profiles |
| Following List | Low | View who user follows |

## C2. Comments & Reactions

| Feature | Complexity | Description |
|---------|------------|-------------|
| Comments | Medium | Text comments on content |
| Emoji Reactions | Low | Quick reactions |
| Reply Threading | Medium | Nested comment replies |
| Comment Moderation | Medium | Delete, report, hide |

## C3. Notifications

| Feature | Complexity | Description |
|---------|------------|-------------|
| In-App Notifications | Medium | Bell icon with dropdown |
| Real-time Updates | Medium | WebSocket/Supabase real-time |
| Email Notifications | Medium | Optional email alerts |
| Push Notifications | High | Browser/mobile push |

**Notification Types:**
- New follower
- Comment on your content
- Reply to your comment
- NFT sold (primary/secondary)
- Rewards available to claim
- New content from followed creator

## C4. Library Features

| Feature | Complexity | Description |
|---------|------------|-------------|
| Watch Later | Low | Save content for later |
| Liked Content | Low | Track liked content |
| View History | Low | Recently viewed content |
| Custom Playlists | Medium | User-created playlists |

## C5. User Profiles

| Feature | Complexity | Description |
|---------|------------|-------------|
| Display Name | Low | Custom username |
| Avatar | Low | Profile picture (IPFS) |
| Bio | Low | User description |
| Social Links | Low | Twitter, Discord, etc. |

## C6. Communities

| Feature | Complexity | Description |
|---------|------------|-------------|
| Community Creation | High | Create named communities |
| Community Posts | High | Text posts with upvotes |
| Community Moderation | High | Mod tools, rules |
| Token Gating | Medium | NFT required to join |

---

# Part D: Platform Expansion

Long-term features for scale.

## D1. Mobile App

| Feature | Complexity | Description |
|---------|------------|-------------|
| React Native App | Very High | Full mobile experience |
| TikTok-style Feed | High | Vertical swipe navigation |
| Background Audio | Medium | Play audio while browsing |

## D2. Token Integration

| Feature | Complexity | Description |
|---------|------------|-------------|
| $CRAFT Token | High | Launch platform token |
| Token Payments | Medium | Pay with $CRAFT |
| Staking Rewards | High | Stake for benefits |

---

## Implementation Order

### Phase 1: On-Chain Only (Part A)
```
1. Search & Discovery
2. Sorting Options
3. UI/UX Improvements (share link, duration)
4. Creator Dashboard Enhancements
```

### Phase 2: Indexer Backend (Part B)
```
1. Set up Helius Webhooks → PostgreSQL
2. Trending algorithm
3. Activity feeds
4. Analytics dashboard
```

### Phase 3: Social Backend (Part C)
```
1. Set up Supabase
2. User profiles
3. Following system
4. Library (watch later, liked)
5. Comments & reactions
6. Notifications
```

### Phase 4: Advanced On-Chain (Part A continued)
```
1. Advanced minting options
2. Marketplace
```

### Phase 5: Scale (Part D)
```
1. Mobile app
2. Token integration
```

---

## Quick Wins (< 1 day each)

**Part A - On-Chain Only:**
- ~~Copy Share Link button~~ ✅
- ~~Content Duration display~~ ✅
- ~~Search with client-side filtering~~ ✅
- ~~Sort by date/mints/price~~ ✅
- ~~Better loading states~~ ✅
- ~~Landing page~~ ✅
- ~~/explore route~~ ✅
- Search history (localStorage)

**Part B - Needs Indexer:**
- Trending score display
- Activity feed

**Part C - Needs Social Backend:**
- Follow button
- Like button
- View count display

---

## Summary

| Part | Backend Required | Examples |
|------|------------------|----------|
| **A** | None (on-chain + IPFS) | Search, sort, share, UI |
| **B** | Indexer (Helius/Geyser) | Trending, analytics, activity |
| **C** | Social DB (Supabase) | Follow, comment, notify, library |
| **D** | All of the above | Mobile, token |

*Start with Part A, then decide between Part B (indexer) or Part C (social) based on priority.*
