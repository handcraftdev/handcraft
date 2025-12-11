# Content Architecture

This document describes the four-layer content architecture used in Handcraft.

## Overview

Content in Handcraft is organized using a four-layer architecture that separates concerns and enables flexible content organization:

```
┌─────────────────────────────────────────────────────────┐
│  Layer 4: Bundle                                        │
│  (Group of content items - Course, Album, Series)       │
├─────────────────────────────────────────────────────────┤
│  Layer 3: Context                                       │
│  (Metadata - genre, category, tags)                     │
├─────────────────────────────────────────────────────────┤
│  Layer 2: Type                                          │
│  (Atomic content type - Movie, Music, Post)             │
├─────────────────────────────────────────────────────────┤
│  Layer 1: Domain                                        │
│  (Top-level category - video, audio, image)             │
└─────────────────────────────────────────────────────────┘
```

## Layer 1: Domain

Domains are top-level categories that group related content types. They are **derived from the Type** (not stored separately).

| Domain | Description |
|--------|-------------|
| `video` | Moving visual content |
| `audio` | Sound-only content |
| `image` | Static visual content |
| `document` | Text-heavy files (books, comics) |
| `file` | Downloadable resources |
| `text` | Written posts and articles |

## Layer 2: Type (Atomic Content Types)

Types describe **what the file IS** at its most fundamental level. These are stored on-chain as an enum.

### Video Domain (0-4)
| Type | Enum Value | Description | Example Metadata |
|------|------------|-------------|------------------|
| `Video` | 0 | General video content | duration |
| `Movie` | 1 | Feature films, documentaries | director, cast, year, duration, genre |
| `Television` | 2 | TV episodes, series content | showName, season, episode, cast |
| `MusicVideo` | 3 | Music videos, performances | artist, album, year, genre |
| `Short` | 4 | Clips, shorts, reels | duration |

### Audio Domain (5-7)
| Type | Enum Value | Description | Example Metadata |
|------|------------|-------------|------------------|
| `Music` | 5 | Songs, tracks | artist, album, genre, duration |
| `Podcast` | 6 | Podcast episodes | showName, episodeNumber, host |
| `Audiobook` | 7 | Audiobook chapters | author, narrator, chapter |

### Image Domain (8-9)
| Type | Enum Value | Description | Example Metadata |
|------|------------|-------------|------------------|
| `Photo` | 8 | Photography | location, dateTaken, camera |
| `Artwork` | 9 | Digital art, illustrations | artist, medium, dimensions |

### Document Domain (10-11)
| Type | Enum Value | Description | Example Metadata |
|------|------------|-------------|------------------|
| `Book` | 10 | Ebooks, documents, PDFs | author, publisher, year, ISBN |
| `Comic` | 11 | Comics, manga, graphic novels | writer, artist, issueNumber, publisher |

### File Domain (12-15)
| Type | Enum Value | Description | Example Metadata |
|------|------------|-------------|------------------|
| `Asset` | 12 | Templates, mockups, resources | format, category, software |
| `Game` | 13 | Games, interactive content | platform, genre, version, requirements |
| `Software` | 14 | Apps, plugins, tools | platform, version, license, requirements |
| `Dataset` | 15 | Data files, CSVs, models | format, size, schema |

### Text Domain (16)
| Type | Enum Value | Description | Example Metadata |
|------|------------|-------------|------------------|
| `Post` | 16 | Blog posts, newsletters, articles | author, excerpt, category |

## Layer 3: Context

Context is **metadata** that describes the content's genre, theme, or purpose. It is stored off-chain in the metadata JSON.

Examples:
- A `Music` track with context: "Electronic", "Ambient", "Study Music"
- A `Video` with context: "Tutorial", "Behind the Scenes"
- A `Post` with context: "Newsletter", "Tech Blog", "Opinion"

Context enables discovery and categorization without adding on-chain complexity.

## Layer 4: Bundle

Bundles are **collections of multiple content items** sold or accessed together. They are stored as separate on-chain accounts.

| Bundle Type | Content Types Used | Example |
|-------------|-------------------|---------|
| Course | Video, Post, Asset, Dataset | "Learn Rust Programming" |
| Album | Music | "Greatest Hits 2024" |
| TV Series | Television | "Season 1 of Show X" |
| Newsletter | Post | "Weekly Tech Digest" |
| Product Pack | Asset, Software | "UI Kit + Icon Pack" |

### Bundle vs Context

| Aspect | Context | Bundle |
|--------|---------|--------|
| Storage | Off-chain metadata | On-chain account |
| Purpose | Categorization/discovery | Grouping for sale/access |
| Example | "Newsletter" (tag on a Post) | Newsletter subscription (multiple Posts) |

## Platform Support

This architecture supports various platform models:

| Platform Model | Implementation |
|----------------|---------------|
| **Netflix/Disney+** | Television episodes in Series bundles, Movies standalone |
| **Spotify/Apple Music** | Music tracks in Album bundles |
| **Udemy/Skillshare** | Mixed content (Video, Post, Asset) in Course bundles |
| **Patreon** | Posts with various contexts, membership tiers |
| **Substack** | Posts with "Newsletter" context |
| **Gumroad** | Assets, Software, Books as standalone or bundles |
| **Shutterstock** | Photos, Artwork in Collection bundles |
| **Steam/itch.io** | Games with optional DLC bundles |

## Code References

### On-chain (Rust)
```rust
// programs/content-registry/src/state/content.rs
pub enum ContentType {
    // Video domain (0-4)
    Video,
    Movie,
    Television,
    MusicVideo,
    Short,
    // Audio domain (5-7)
    Music,
    Podcast,
    Audiobook,
    // Image domain (8-9)
    Photo,
    Artwork,
    // Document domain (10-11)
    Book,
    Comic,
    // File domain (12-15)
    Asset,
    Game,
    Software,
    Dataset,
    // Text domain (16)
    Post,
}
```

### SDK (TypeScript)
```typescript
// packages/sdk/src/program/constants.ts
import { ContentType, getContentDomain, getContentTypeLabel } from "@handcraft/sdk";

// Get domain from type
const domain = getContentDomain(ContentType.Movie); // "video"

// Get human-readable label
const label = getContentTypeLabel(ContentType.MusicVideo); // "Music Video"
```

## Design Principles

1. **Atomic types describe the file, not its use** - A video tutorial is `Video` with "Tutorial" context, not a separate "Tutorial" type.

2. **No overlap between types** - Each type has distinct metadata and consumption patterns.

3. **Bundles handle grouping** - Courses, albums, and series are bundles, not types.

4. **Context is flexible** - Genres, themes, and categories can evolve without changing the on-chain schema.

5. **Domain is derived** - No need to store domain separately; it's computed from the type.
