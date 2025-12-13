# Content System Reference

**Last Updated:** December 13, 2025

This document describes the complete content upload, storage, retrieval, and monetization system for Handcraft.

---

## Overview

Handcraft uses a hybrid on-chain/off-chain architecture:
- **On-chain**: Content registration, ownership, access control, monetization
- **Off-chain**: File storage (IPFS via Filebase), metadata JSON, encryption

```
┌─────────────────────────────────────────────────────────────────┐
│                        Content System                            │
├─────────────────────────────────────────────────────────────────┤
│  Upload Flow                                                     │
│  ├── File → Filebase/IPFS → contentCid                          │
│  ├── Metadata → Filebase/IPFS → metadataCid                     │
│  └── On-chain registration → ContentEntry PDA                   │
├─────────────────────────────────────────────────────────────────┤
│  Retrieval Flow                                                  │
│  ├── Query ContentEntry accounts from Solana                    │
│  ├── Fetch metadata JSON from IPFS                              │
│  └── Access control → Decrypt if authorized                     │
├─────────────────────────────────────────────────────────────────┤
│  Monetization                                                    │
│  ├── Primary Sales (Minting) → 80/5/3/12 split                  │
│  ├── Rentals (Temporary access) → 80/5/3/12 split               │
│  └── Secondary Sales (Resale) → 90/4/1/1/4 split                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Status

### Completed Features

| Feature | Status | Notes |
|---------|--------|-------|
| Content Registration | ✅ Done | SHA256-based CID uniqueness |
| 17 Content Types | ✅ Done | Video, Music, Photo, etc. |
| 6 Content Domains | ✅ Done | Video, Audio, Image, Document, File, Text |
| File Upload to IPFS | ✅ Done | Filebase S3 integration |
| Metadata Upload | ✅ Done | Metaplex-compliant JSON |
| Content Encryption | ✅ Done | NaCl Secretbox |
| Preview Generation | ✅ Done | First 10% or 5MB |
| Minting System | ✅ Done | Simple mint with slot hash randomness |
| Rarity Distribution | ✅ Done | 55/27/13/4/1% for C/U/R/E/L |
| Rental System | ✅ Done | 3-tier pricing (6h/1d/7d) |
| Reward Pools | ✅ Done | Per-content holder rewards |
| Fixed Royalty | ✅ Done | 4% on secondary sales |
| File Size Validation | ✅ Done | Client + server validation |
| CID Format Validation | ✅ Done | CIDv0/v1 format checking |
| Visibility Level UI | ✅ Done | 4-tier selector in upload |
| No Free Minting | ✅ Done | Minimum 0.001 SOL enforced |
| Locked Overlay Pricing | ✅ Done | Shows mint/rent prices |

### In Progress

| Feature | Status | Notes |
|---------|--------|-------|
| Visibility Level Enforcement | 🔶 Partial | UI done, on-chain pending |
| Subscription Access Check | 🔶 Partial | Awaiting subscription system |

### Planned

| Feature | Priority | Notes |
|---------|----------|-------|
| Language metadata field | High | ISO 639-1 code |
| Duration as number | Medium | Seconds instead of string |
| Content warnings | Low | NSFW, spoilers flags |
| License metadata | Low | CC-BY, MIT, proprietary |

---

## Content Types & Domains

### Domains (6)

| Domain | Description | Types |
|--------|-------------|-------|
| **Video** | Moving image content | Video, Movie, Television, MusicVideo, Short |
| **Audio** | Sound-only content | Music, Podcast, Audiobook |
| **Image** | Static visual content | Photo, Artwork |
| **Document** | Readable content | Book, Comic |
| **File** | Downloadable assets | Asset, Game, Software, Dataset |
| **Text** | Written posts | Post |

### Types (17)

| ID | Type | Domain | Typical Use |
|----|------|--------|-------------|
| 0 | Video | Video | General video content |
| 1 | Movie | Video | Feature films |
| 2 | Television | Video | TV episodes/series |
| 3 | MusicVideo | Video | Music videos |
| 4 | Short | Video | Short-form video (<60s) |
| 5 | Music | Audio | Songs, albums |
| 6 | Podcast | Audio | Podcast episodes |
| 7 | Audiobook | Audio | Audio books |
| 8 | Photo | Image | Photography |
| 9 | Artwork | Image | Digital art, illustrations |
| 10 | Book | Document | E-books, PDFs |
| 11 | Comic | Document | Comics, manga |
| 12 | Asset | File | 3D models, templates |
| 13 | Game | File | Games, interactive content |
| 14 | Software | File | Applications, tools |
| 15 | Dataset | File | Data files, datasets |
| 16 | Post | Text | Written content |

### Type-Specific Metadata Fields

| Type | Fields |
|------|--------|
| Movie | year, duration, director, cast, genre |
| Television | showName, season, episode, year, cast, duration |
| Music | artist, album, duration, genre, year |
| Podcast | showName, episode, host, duration |
| Audiobook | author, narrator, duration, chapter |
| Book | author, publisher, year, ISBN |
| Comic | writer, artist, issue, publisher |
| Game | platform, genre, version, requirements |

---

## Content Monetization

### Pricing Rules

| Rule | Value | Enforcement |
|------|-------|-------------|
| **Minimum Price** | 0.001 SOL | On-chain + client |
| **Free Minting** | **Not allowed** | On-chain validation |
| **Creator Royalty** | Fixed 4% | Cannot be changed |
| **Minimum Rent** | 0.001 SOL per tier | On-chain validation |

### Primary Sale Split (Mint / Rental)

When someone mints an edition or rents content:

| Recipient | Share | Destination |
|-----------|-------|-------------|
| Creator | 80% | Creator wallet (immediate) |
| Platform | 5% | Platform treasury |
| Ecosystem | 3% | Ecosystem treasury |
| **Holders** | **12%** | **ContentRewardPool** |

**Note:** On first mint (no existing holders), the 12% holder share goes to the creator.

### Secondary Sale Split (Resale)

When an edition is resold on marketplace:

| Recipient | Share | Destination |
|-----------|-------|-------------|
| Seller | 90% | Seller wallet |
| Creator | 4% | Creator wallet (fixed royalty) |
| Platform | 1% | Platform treasury |
| Ecosystem | 1% | Ecosystem treasury |
| **Holders** | **4%** | **ContentRewardPool** |

### Rental Pricing Tiers

| Tier | Duration | Typical Price |
|------|----------|---------------|
| Tier 1 | 6 hours | 0.001-0.01 SOL |
| Tier 2 | 1 day | 0.01-0.05 SOL |
| Tier 3 | 7 days | 0.05-0.2 SOL |

**Important:** Renters do NOT earn rewards - access only.

### Rarity System

| Rarity | Weight | Probability | Reward Multiplier |
|--------|--------|-------------|-------------------|
| Common | 1 | 55% | 1x |
| Uncommon | 5 | 27% | 5x |
| Rare | 20 | 13% | 20x |
| Epic | 60 | 4% | 60x |
| Legendary | 120 | 1% | 120x |

Rarity is determined at mint time using slot hash randomness (single transaction, no VRF).

### Reward Pool Mechanics

Each content has a **ContentRewardPool** that:
- Receives 12% of primary sales (mint/rental)
- Receives 4% of secondary sales
- Distributes to edition holders by rarity weight
- Uses `reward_per_share` accounting

```rust
// Reward calculation
reward_per_share += (amount * PRECISION) / total_weight
pending = (nft_weight * reward_per_share - reward_debt) / PRECISION
```

---

## Upload Flow

### Architecture

```
User Browser (UploadModal.tsx)
├── 1. Domain Selection (6 domains)
├── 2. Content Type Selection (17 types)
├── 3. File Selection + Local Preview
├── 4. Metadata Details (type-specific fields)
└── 5. Monetization Config (price, supply, visibility, rent tiers)
         │
         ▼
/api/upload (POST)
├── Validate file size (per domain limits)
├── Generate unique contentId (nanoid)
├── Optional: Encrypt file (NaCl Secretbox)
├── Optional: Generate preview (first 10% or 5MB)
├── Upload to Filebase (S3-compatible → IPFS pinning)
└── Returns: { contentCid, previewCid?, encryptionMetaCid? }
         │
         ▼
/api/upload/metadata (POST)
├── Build Metaplex-compliant JSON
├── Upload to Filebase
└── Returns: { metadataCid }
         │
         ▼
SDK: registerContentWithMintInstruction()
├── Validate price >= MIN_PRICE_LAMPORTS (no free minting)
├── Create ContentEntry PDA (seeded by SHA256 of CID)
├── Create MintConfig PDA
├── Create ContentCollection (Metaplex Core)
└── Optional: Create RentConfig PDA
```

### File Size Limits

| Domain | Max Size | Enforced At |
|--------|----------|-------------|
| Video | 2 GB | Client + Server |
| Audio | 500 MB | Client + Server |
| Image | 50 MB | Client + Server |
| Document | 100 MB | Client + Server |
| File | 1 GB | Client + Server |
| Text | 10 MB | Client + Server |

### File Upload API

**Endpoint:** `POST /api/upload`

**Request:**
```typescript
{
  file: File,              // The content file
  encrypt?: boolean,       // Enable encryption
  contentType: string,     // e.g., "Music", "Video"
  domain: string,          // e.g., "audio", "video"
}
```

**Response:**
```typescript
{
  contentCid: string,           // IPFS CID of content
  previewCid?: string,          // IPFS CID of preview (video/audio)
  encryptionMetaCid?: string,   // IPFS CID of encryption metadata
  mimeType: string,
  size: number,
}
```

### Metadata Upload API

**Endpoint:** `POST /api/upload/metadata`

**Request:**
```typescript
{
  name: string,
  description: string,
  contentCid: string,
  thumbnailCid?: string,
  domain: string,
  contentType: string,
  mimeType: string,
  size: number,
  isEncrypted: boolean,
  context: {
    genre?: string,
    artist?: string,
    album?: string,
    duration?: string,
    // ... type-specific fields
  }
}
```

**Response:**
```typescript
{
  metadataCid: string,  // IPFS CID of metadata JSON
}
```

### On-Chain Registration

**SDK Function:** `registerContentWithMintInstruction()`

Creates:
1. **ContentEntry PDA** - Stores content reference and state
2. **MintConfig PDA** - Stores pricing and supply settings
3. **ContentCollection** - Metaplex Core collection for editions
4. **RentConfig PDA** (optional) - Stores rental tier pricing

---

## Encryption System

### How It Works

1. **Key Derivation**: Server derives deterministic key from `MASTER_SECRET + contentId`
2. **Encryption**: NaCl Secretbox (ChaCha20-Poly1305) with random nonce
3. **Storage**: Encrypted file uploaded to IPFS, encryption metadata stored separately
4. **Decryption**: Authorized users request decryption via API

```
Upload (Encryption)
├── Generate key: HKDF(MASTER_SECRET, contentId)
├── Generate nonce: random 24 bytes
├── Encrypt: NaCl.secretbox(file, nonce, key)
├── Store: encrypted file → IPFS
└── Store: { nonce, originalSize } → encryptionMetaCid

Download (Decryption)
├── Verify access: ownership, rental, or subscription
├── Fetch encrypted file from IPFS
├── Derive key: HKDF(MASTER_SECRET, contentId)
├── Decrypt: NaCl.secretbox.open(encrypted, nonce, key)
└── Return decrypted stream
```

### Preview Generation

For video/audio content, an unencrypted preview is generated:
- **Size**: First 10% of file OR first 5MB (whichever is smaller)
- **Storage**: Separate IPFS CID (`previewCid`)
- **Access**: Public, no decryption needed

---

## Retrieval Flow

### Architecture

```
UI Component (Feed.tsx, Profile.tsx)
         │
         ▼
useContentRegistry() Hook
         │
         ▼
React Query Cache
├── Key: ["globalContent"] or ["creatorContent", address]
├── Stale time: 60 seconds
└── GC time: 120 seconds
         │
         ▼
SDK Fetch Functions
├── fetchGlobalContent()
├── fetchContentByCreator(address)
├── fetchMintableContent()
└── fetchContent(cid)
         │
         ▼
Solana RPC: getProgramAccounts()
├── Filter by discriminator (ContentEntry accounts)
└── Decode account data
         │
         ▼
Return: ContentEntry[]
```

### SDK Fetch Functions

| Function | Description | Returns |
|----------|-------------|---------|
| `fetchGlobalContent()` | All registered content | `ContentEntry[]` |
| `fetchContentByCreator(pubkey)` | Content by specific creator | `ContentEntry[]` |
| `fetchMintableContent()` | Content with active mint configs | `ContentEntry[]` |
| `fetchContent(cid)` | Single content by CID | `ContentEntry \| null` |
| `fetchContentBatch(cids)` | Multiple contents by CID | `Map<string, ContentEntry>` |

### ContentEntry Type

```typescript
interface ContentEntry {
  creator: PublicKey;
  contentCid: string;
  metadataCid: string;
  contentType: ContentType;
  tipsReceived: bigint;
  createdAt: bigint;
  isLocked: boolean;        // True after first mint
  mintedCount: bigint;
  pendingCount: bigint;
  isEncrypted: boolean;
  previewCid: string;
  encryptionMetaCid: string;
  visibilityLevel: number;  // 0=Public, 1=Ecosystem, 2=Subscriber, 3=Edition-only
}
```

### Content Decryption API

**Endpoint:** `POST /api/content`

**Request:**
```typescript
{
  contentCid: string,
  metaCid: string,
  sessionToken: string,    // Session signature
}
```

**Validation:**
- CID format validation (CIDv0/v1)
- Session token verification
- Access control check

---

## Visibility Levels (4-Tier Model)

### Definition

| Level | Name | Access Granted To |
|-------|------|-------------------|
| 0 | Public | Everyone (no restrictions) |
| 1 | Ecosystem | Ecosystem subscribers, Creator subscribers, Edition owners, Renters |
| 2 | Subscriber | Creator subscribers, Edition owners, Renters |
| 3 | Edition Only | Edition owners, Renters only |

### Access Control Flow

```
Content Access Request
         │
         ▼
┌─────────────────────────────────────┐
│ Is user the creator?                │
│ YES → Grant access                  │
│ NO  → Continue                      │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Does user own edition?              │
│ YES → Grant access (all levels)     │
│ NO  → Continue                      │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Does user own bundle with content?  │
│ YES → Grant access (all levels)     │
│ NO  → Continue                      │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Does user have active rental?       │
│ YES → Grant access (all levels)     │
│ NO  → Continue                      │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Level 3 (Edition Only)?             │
│ YES → Deny access                   │
│ NO  → Continue                      │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Level 2 (Subscriber)?               │
│ YES → Check creator subscription    │
│       Subscribed → Grant            │
│       Not subscribed → Deny         │
│ NO  → Continue                      │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Level 1 (Ecosystem)?                │
│ YES → Check ecosystem subscription  │
│       OR creator subscription       │
│       Either → Grant                │
│       Neither → Deny                │
│ NO  → Continue                      │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Level 0 (Public)?                   │
│ YES → Grant access                  │
└─────────────────────────────────────┘
```

### Key Points

- **Rental** = Edition-like access with time limit, NO reward participation
- **Membership** = Pure support, NO content access (see SUBSCRIPTION_SYSTEM.md)
- **Subscription** = Support + Level 1-2 content access
- **Level 3 content** = Premium exclusive, requires purchase/rental
- **Level 0 content** = Free samples, trailers, public posts

---

## Metadata Schema

### Metaplex-Compliant Structure

```json
{
  "name": "Content Title",
  "description": "Content description",
  "image": "ipfs://Qm.../thumbnail.jpg",
  "external_url": "https://handcraft.app/content/...",
  "animation_url": "ipfs://Qm.../video.mp4",
  "attributes": [
    { "trait_type": "Domain", "value": "video" },
    { "trait_type": "Type", "value": "Movie" },
    { "trait_type": "Genre", "value": "Action" },
    { "trait_type": "Rarity", "value": "Rare" }
  ],
  "properties": {
    "files": [
      { "uri": "ipfs://Qm.../video.mp4", "type": "video/mp4" }
    ],
    "category": "video"
  },
  "domain": "video",
  "contentType": "Movie",
  "context": {
    "genre": "Action",
    "director": "Director Name",
    "cast": "Actor 1, Actor 2",
    "year": "2024",
    "duration": "120"
  },
  "contentCid": "Qm...",
  "thumbnailCid": "Qm...",
  "mimeType": "video/mp4",
  "size": 1234567890,
  "isEncrypted": true
}
```

### Field Reference

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Display title |
| `description` | Yes | Content description |
| `image` | Yes | Thumbnail IPFS URL |
| `external_url` | No | Link to content page |
| `animation_url` | No | Video/audio IPFS URL |
| `attributes` | Yes | Marketplace display traits |
| `properties.files` | Yes | File list with MIME types |
| `properties.category` | Yes | Domain name |
| `domain` | Yes | One of 6 domains |
| `contentType` | Yes | One of 17 types |
| `context` | No | Type-specific metadata |
| `contentCid` | Yes | IPFS CID of content |
| `thumbnailCid` | No | IPFS CID of thumbnail |
| `mimeType` | Yes | Content MIME type |
| `size` | Yes | File size in bytes |
| `isEncrypted` | Yes | Encryption status |

---

## On-Chain Accounts

### ContentEntry PDA

**Seeds:** `["content", SHA256(contentCid)[0..32]]`

```rust
pub struct ContentEntry {
    pub creator: Pubkey,           // Content creator
    pub content_cid: String,       // IPFS CID (max 64 chars)
    pub metadata_cid: String,      // Metadata IPFS CID
    pub content_type: ContentType, // Enum (0-16)
    pub tips_received: u64,        // Total tips in lamports
    pub created_at: i64,           // Unix timestamp
    pub is_locked: bool,           // Locked after first mint
    pub minted_count: u64,         // Total editions minted
    pub pending_count: u64,        // Pending mints (legacy)
    pub is_encrypted: bool,        // Encryption enabled
    pub preview_cid: String,       // Preview IPFS CID
    pub encryption_meta_cid: String, // Encryption metadata CID
    pub visibility_level: u8,      // Access level (0-3)
}
```

### MintConfig PDA

**Seeds:** `["mint_config", content_pda]`

```rust
pub struct MintConfig {
    pub content: Pubkey,           // ContentEntry PDA
    pub creator: Pubkey,           // Creator who owns this config
    pub price: u64,                // Price in lamports (min 0.001 SOL, no free)
    pub currency: PaymentCurrency, // SOL or USDC
    pub max_supply: Option<u64>,   // None = unlimited
    pub creator_royalty_bps: u16,  // Fixed at 400 (4%)
    pub is_active: bool,           // Minting enabled
}
```

### RentConfig PDA

**Seeds:** `["rent_config", content_pda]`

```rust
pub struct RentConfig {
    pub content: Pubkey,           // ContentEntry PDA
    pub creator: Pubkey,           // Creator who can update
    pub rent_fee_6h: u64,          // 6-hour rental price
    pub rent_fee_1d: u64,          // 1-day rental price
    pub rent_fee_7d: u64,          // 7-day rental price
    pub is_active: bool,           // Rentals enabled
}
```

### ContentRewardPool PDA

**Seeds:** `["content_reward_pool", content_pda]`

```rust
pub struct ContentRewardPool {
    pub content: Pubkey,
    pub reward_per_share: u128,    // Accumulated rewards per weight unit
    pub total_weight: u64,         // Sum of all edition weights
    pub total_deposited: u64,      // Total SOL deposited
    pub total_claimed: u64,        // Total SOL claimed
}
```

### ContentCollection PDA

**Seeds:** `["content_collection", content_pda]`

Metaplex Core collection that groups all editions of a content piece.

---

## Validation Rules

### CID Format

Valid IPFS CID formats:
- **CIDv0**: `Qm...` (46 characters, base58btc)
- **CIDv1**: `bafy...` or `bafk...` (base32)

```typescript
function isValidCid(cid: string): boolean {
  if (!cid || typeof cid !== "string") return false;

  // CIDv0: 46 character base58btc starting with Qm
  if (cid.startsWith("Qm") && cid.length === 46) {
    return /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(cid);
  }

  // CIDv1: base32 encoded, starts with "baf"
  if (cid.startsWith("baf") && cid.length >= 50) {
    return /^[a-z2-7]+$/.test(cid);
  }

  return false;
}
```

### Price Constraints

| Constraint | Value | Enforced |
|------------|-------|----------|
| Minimum mint price | 0.001 SOL (1,000,000 lamports) | On-chain |
| Minimum rent price | 0.001 SOL per tier | On-chain |
| Free minting | **Not allowed** | On-chain + Client |
| Creator royalty | Fixed 4% (400 bps) | On-chain |

---

## Bundle System

Bundles group multiple content pieces (albums, series, courses, etc.).

### Bundle Types (7)

| Type | Use Case |
|------|----------|
| Album | Music albums |
| Series | TV series, video series |
| Playlist | Curated collections |
| Course | Educational content |
| Newsletter | Ongoing publications |
| Collection | Art collections |
| ProductPack | Software bundles |

### Bundle Monetization

**Primary Sale (Bundle Mint/Rental):**

| Recipient | Share | Destination |
|-----------|-------|-------------|
| Creator | 80% | Creator wallet |
| Platform | 5% | Platform treasury |
| Ecosystem | 3% | Ecosystem treasury |
| **Holders** | **12%** | **Split: 6% Bundle + 6% Content** |

The 12% holder share is split 50/50:
- 50% (6%) → BundleRewardPool (bundle edition holders)
- 50% (6%) → ContentRewardPools (distributed by weight to content in bundle)

This prevents bundle sales from cannibalizing individual content sales.

#### Bundle Secondary Sale Split

When a bundle edition is resold:

| Recipient | Share | Destination |
|-----------|-------|-------------|
| Seller | 90% | Seller wallet |
| Creator | 4% | Creator wallet (fixed royalty) |
| Platform | 1% | Platform treasury |
| Ecosystem | 1% | Ecosystem treasury |
| **Holders** | **4%** | **Split: 2% Bundle + 2% Content** |

The 4% holder share is also split 50/50:
- 50% (2%) → BundleRewardPool (bundle edition holders)
- 50% (2%) → ContentRewardPools (distributed by weight to content in bundle)

The content share is accumulated in `pending_content_share` on the BundleRewardPool and distributed via `distribute_bundle_secondary_to_content` instruction.

### Bundle Access

Bundle edition owners can access ALL encrypted content within the bundle, regardless of individual content visibility levels.

---

## Related Documentation

- [CURRENT_FEATURES.md](./CURRENT_FEATURES.md) - Feature overview
- [SUBSCRIPTION_SYSTEM.md](./SUBSCRIPTION_SYSTEM.md) - Subscription and creator patronage
- [ROADMAP_PRIORITIES.md](./ROADMAP_PRIORITIES.md) - Development roadmap
