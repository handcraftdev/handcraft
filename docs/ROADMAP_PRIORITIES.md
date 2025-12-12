# Handcraft - Feature Roadmap & Priorities

## Priority Framework

Features are prioritized based on:
1. **User Value** - Direct impact on user experience
2. **Revenue Impact** - Enables monetization or growth
3. **Technical Foundation** - Required for other features
4. **Implementation Complexity** - Effort vs reward

---

## Priority 1: Critical Path (Next 2-4 weeks)

These features are essential for a usable product.

### 1.1 Search & Discovery
**Why:** Users cannot find content without search. Critical for retention.

| Feature | Complexity | Description |
|---------|------------|-------------|
| Basic Search | Medium | Full-text search on title, description, tags |
| Content Filters | Low | Filter by type, domain, price, rarity |
| Search Results Page | Low | Display matching content with cards |
| Search History | Low | Recent searches stored locally |

**Implementation:**
- Add search API route using on-chain content metadata
- Create `/search` page with results
- Add filter dropdowns to search UI

### 1.2 ~~Content Type Pages~~ ✅ DONE
**Status:** Implemented as filters instead of separate pages.

- ✅ Content type filters (17 types) on Feed tab
- ✅ Bundle type filters (7 types) on Bundles tab
- ✅ Persistent filter/tab selection via localStorage
- ✅ Centered, wrapping filter chips

**Remaining:**
| Feature | Complexity | Description |
|---------|------------|-------------|
| /trending Page | Medium | Sort by recent mints/tips (simple algorithm) |

### 1.3 Social Features (Requires Backend Service)
**Why:** Core social features. Too expensive/complex for on-chain.

**Recommendation:** Build a lightweight social backend service to handle:

| Feature | Storage | Description |
|---------|---------|-------------|
| Following System | PostgreSQL | Follow/unfollow creators |
| Comments & Reactions | PostgreSQL | Comments, replies, emoji reactions |
| Notifications | PostgreSQL + WebSocket | Real-time alerts |
| View Counts | Redis/PostgreSQL | Track content views |
| Watch Later / Liked | PostgreSQL | User library features |

**Architecture Options:**

| Option | Pros | Cons | Cost |
|--------|------|------|------|
| **Supabase** | Fast setup, real-time, auth | Vendor lock-in | $25/mo+ |
| **Railway + PostgreSQL** | Flexible, cheap | More setup | $5-20/mo |
| **PlanetScale + Vercel** | Serverless, scalable | MySQL not Postgres | $0-29/mo |
| **Self-hosted** | Full control | Maintenance burden | VPS cost |

**Recommended: Supabase**
- Built-in auth (wallet signature verification)
- Real-time subscriptions for notifications
- Row-level security for user data
- Easy integration with Next.js

**Implementation Order:**
1. Set up Supabase project
2. User profiles table (wallet address as ID)
3. Follows table (follower → following)
4. Comments table (content_cid, user, text, parent_id)
5. Notifications table (user, type, data, read)
6. Real-time subscriptions for notifications

---

## Priority 2: Engagement & Retention

These features require the social backend.

### 2.1 Following System
| Feature | Complexity | Description |
|---------|------------|-------------|
| Follow/Unfollow | Low | Button on profiles/cards |
| Following Feed | Medium | Filter feed to followed creators |
| Follower Count | Low | Display on profiles |

### 2.2 Comments & Reactions
| Feature | Complexity | Description |
|---------|------------|-------------|
| Comments | Medium | Text comments on content |
| Emoji Reactions | Low | Quick reactions (❤️ 🔥 etc.) |
| Reply Threading | Medium | Nested comment replies |

### 2.3 Notifications
| Feature | Complexity | Description |
|---------|------------|-------------|
| In-App Notifications | Medium | Bell icon with dropdown |
| Real-time Updates | Medium | Supabase real-time |
| Push Notifications | High | Browser/mobile push |

### 2.4 Library Features
| Feature | Complexity | Description |
|---------|------------|-------------|
| Watch Later | Low | Save content for later |
| Liked Content | Low | Track liked content |
| Playlists | Medium | User-created playlists |

---

## Priority 3: Creator Tools (Weeks 5-8)

Help creators succeed to attract more content.

### 3.1 Analytics Dashboard
**Why:** Creators need data to improve. Current dashboard is basic.

| Feature | Complexity | Description |
|---------|------------|-------------|
| View Counts | Medium | Track content views |
| Revenue Charts | Medium | Visualize earnings over time |
| Top Content | Low | Show best performing content |
| Audience Stats | High | Geographic, referral data |

### 3.2 Scheduling
**Why:** Creators want to plan content releases.

| Feature | Complexity | Description |
|---------|------------|-------------|
| Scheduled Publishing | Medium | Set future publish date |
| Draft Saving | Low | Save incomplete uploads |

### 3.3 Better Upload Experience
**Why:** Current upload is basic. Large files may fail.

| Feature | Complexity | Description |
|---------|------------|-------------|
| Resumable Uploads | High | Handle large file interruptions |
| Progress Persistence | Medium | Recover from browser close |
| Batch Upload | Medium | Upload multiple files at once |

---

## Priority 4: Advanced Features (Weeks 7-12)

Differentiation and advanced use cases.

### 4.1 Communities
**Why:** Reddit-style communities for discussion and content curation.

| Feature | Complexity | Description |
|---------|------------|-------------|
| Community Creation | High | Create named communities |
| Community Posts | High | Text posts with upvotes |
| Community Moderation | High | Mod tools, rules |
| Token Gating | Medium | NFT required to join |

### 4.2 Advanced Minting
**Why:** More monetization options for creators.

| Feature | Complexity | Description |
|---------|------------|-------------|
| Batch Minting | Medium | Mint multiple at once |
| Auction Minting | High | Time-limited bidding |
| Whitelist Minting | Medium | Allowlist for early access |
| Bonding Curve | High | Price increases with supply |

### 4.3 Marketplace Integration
**Why:** Secondary trading increases NFT value.

| Feature | Complexity | Description |
|---------|------------|-------------|
| Listing NFTs | High | List for sale at fixed price |
| Buying Listed NFTs | High | Purchase from listings |
| Marketplace Page | Medium | Browse all listings |

---

## Priority 5: Platform Expansion (Weeks 10+)

Scale and new platforms.

### 5.1 Mobile App
**Why:** Mobile is primary consumption platform.

| Feature | Complexity | Description |
|---------|------------|-------------|
| React Native App | Very High | Full mobile experience |
| TikTok-style Feed | High | Vertical swipe navigation |
| Background Audio | Medium | Play audio while browsing |

### 5.2 Indexer
**Why:** Faster queries, historical data, analytics.

| Feature | Complexity | Description |
|---------|------------|-------------|
| Event Indexing | High | Index all program events |
| GraphQL API | High | Query indexed data |
| Historical Analytics | Medium | Track metrics over time |

### 5.3 Token Integration
**Why:** Platform token creates ecosystem value.

| Feature | Complexity | Description |
|---------|------------|-------------|
| $CRAFT Token | High | Launch platform token |
| Token Payments | Medium | Pay with $CRAFT |
| Staking Rewards | High | Stake for benefits |

---

## Recommended Starting Point

Based on the analysis, here's the **recommended first feature to implement**:

### 🎯 Search & Discovery

**Rationale:**
1. **High Impact** - Users literally cannot find content
2. **Low Complexity** - Uses existing data, no new on-chain work
3. **Foundation** - Required for all discovery features
4. **Quick Win** - Can be done in 2-3 days

**Scope:**
1. Add `/api/search` route that queries content by title/description/tags
2. Create `/search` page with search results
3. Wire up header search bar to search page
4. Add basic filters (content type, domain)

**Alternative Starting Point:**

### 🎯 Content Type Pages (/videos, /audio)

**Rationale:**
1. **Very Low Effort** - Just filter existing feed
2. **Fixes Broken UX** - Sidebar links currently lead nowhere
3. **Quick Win** - Can be done in 1 day

---

## Implementation Order Summary

```
Week 1-2:  Search + Content Type Pages
Week 2-3:  Following System
Week 3-4:  Trending Algorithm
Week 4-5:  Comments (basic)
Week 5-6:  Notifications
Week 6-7:  Library Features
Week 7-8:  Analytics Dashboard
Week 8-10: Communities (basic)
Week 10+:  Mobile, Marketplace, Token
```

---

## Quick Wins (< 1 day each)

1. **Content Type Pages** - Filter existing feed by type
2. **Watch Later** - Local storage bookmark
3. **Liked Content** - Local storage with wallet
4. **Search History** - Local storage recent searches
5. **Copy Share Link** - Copy content URL button
6. **Content Duration** - Show video/audio length
7. **View Count** - Simple view counter (local or API)

---

*Which feature would you like to start with?*
