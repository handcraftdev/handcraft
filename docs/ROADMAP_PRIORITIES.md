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

### 1.2 Content Type Pages
**Why:** Sidebar links exist but lead nowhere. Confusing UX.

| Feature | Complexity | Description |
|---------|------------|-------------|
| /videos Page | Low | Filter feed to video content types |
| /audio Page | Low | Filter feed to audio content types |
| /trending Page | Medium | Sort by recent mints/tips (simple algorithm) |

**Implementation:**
- Reuse Feed component with content type filter
- Add simple trending score (mints + tips in 24h)

### 1.3 Following System
**Why:** Core social feature. Users need to follow creators they like.

| Feature | Complexity | Description |
|---------|------------|-------------|
| Follow/Unfollow | Medium | On-chain or local storage |
| Following Feed | Medium | Show content from followed creators |
| Follower Count | Low | Display on profiles |

**Implementation Options:**
- **Option A:** On-chain (new instruction, ~3 days)
- **Option B:** Off-chain with signature verification (~1 day)
- Recommend Option B first, migrate to on-chain later

---

## Priority 2: Engagement & Retention (Weeks 3-6)

These features keep users coming back.

### 2.1 Comments & Reactions
**Why:** Social interaction drives engagement. Users want to discuss content.

| Feature | Complexity | Description |
|---------|------------|-------------|
| Comments | High | On-chain or hybrid comments |
| Emoji Reactions | Medium | Quick reactions (❤️ 🔥 etc.) |
| Reply Threading | High | Nested comment replies |

**Implementation:**
- Start with local/signed comments (faster)
- Add on-chain comments later for permanence

### 2.2 Notifications
**Why:** Re-engage users. Alert on sales, rewards, follows.

| Feature | Complexity | Description |
|---------|------------|-------------|
| In-App Notifications | Medium | Bell icon with dropdown |
| Notification Preferences | Low | Toggle notification types |
| Push Notifications | High | Browser/mobile push |

**Implementation:**
- Start with polling-based in-app notifications
- Add WebSocket for real-time later

### 2.3 Library Features
**Why:** Sidebar shows these but they're not implemented.

| Feature | Complexity | Description |
|---------|------------|-------------|
| Watch Later | Low | Save content for later (local) |
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
