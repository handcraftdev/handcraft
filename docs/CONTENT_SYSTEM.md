# Content System Reference

**Last Updated:** December 13, 2025

This document describes the complete content upload, storage, and retrieval system for Handcraft.

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
└─────────────────────────────────────────────────────────────────┘
```

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

## Upload Flow

### Architecture

```
User Browser (UploadModal.tsx)
├── 1. Domain Selection (6 domains)
├── 2. Content Type Selection (17 types)
├── 3. File Selection + Local Preview
├── 4. Metadata Details (type-specific fields)
└── 5. Monetization Config (price, supply, rent tiers)
         │
         ▼
/api/upload (POST)
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
├── Create ContentEntry PDA (seeded by SHA256 of CID)
├── Create MintConfig PDA
├── Create ContentCollection (Metaplex Core)
└── Optional: Create RentConfig PDA
```

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
  walletAddress: string,
  signature: string,    // Session signature
}
```

**Access Verification:**
1. Check if user is content creator
2. Check if user owns edition of this content
3. Check if user owns bundle containing this content
4. Check if user has active rental
5. Check subscription status (for visibility levels 1-2)

---

## Visibility Levels

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
    pub price_sol: u64,            // Price in lamports (0 = free)
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
    pub tier1_price: u64,          // 6-hour rental price
    pub tier2_price: u64,          // 1-day rental price
    pub tier3_price: u64,          // 7-day rental price
    pub is_active: bool,           // Rentals enabled
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
- **CIDv1**: `bafy...` (59 characters, base32)

```typescript
const CID_V0_REGEX = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/;
const CID_V1_REGEX = /^b[a-z2-7]{58}$/;

function isValidCID(cid: string): boolean {
  return CID_V0_REGEX.test(cid) || CID_V1_REGEX.test(cid);
}
```

### File Size Limits

| Domain | Max Size |
|--------|----------|
| Video | 2 GB |
| Audio | 500 MB |
| Image | 50 MB |
| Document | 100 MB |
| File | 1 GB |
| Text | 10 MB |

### Price Constraints

- **Minimum price**: 0.001 SOL (if not free)
- **Free minting**: Price = 0
- **Creator royalty**: Fixed at 4%

---

## Future Enhancements

### High Priority

| Feature | Description |
|---------|-------------|
| Visibility UI | Allow creators to select visibility level during upload |
| File size enforcement | Validate file sizes before upload |
| CID validation | Validate CID format in API and SDK |
| Language field | Add ISO 639-1 language code to metadata |
| Duration standardization | Store duration as seconds (number) not string |

### Medium Priority

| Feature | Description |
|---------|-------------|
| Preview for non-owners | Display preview content for users without access |
| Metadata validation | JSON schema validation for metadata |
| Subscription queries | Pre-check subscription status before access attempt |
| Unified access control | Single instruction for all access verification |

### Lower Priority

| Feature | Description |
|---------|-------------|
| Content warnings | NSFW, spoilers, flashing lights flags |
| License metadata | CC-BY, MIT, proprietary licenses |
| Quality metadata | Resolution, bitrate, codec info |
| Accessibility | Subtitles, audio descriptions |
| Full-text search | Index content metadata for search |

---

## Related Documentation

- [CURRENT_FEATURES.md](./CURRENT_FEATURES.md) - Feature overview
- [SUBSCRIPTION_SYSTEM.md](./SUBSCRIPTION_SYSTEM.md) - Subscription and rewards
- [ROADMAP_PRIORITIES.md](./ROADMAP_PRIORITIES.md) - Development roadmap
