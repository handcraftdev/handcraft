# Specialized Content Viewers Architecture

## Summary
Replace generic domain-based rendering with type-specific viewers for all 17 content types. Uses a **Viewer Registry Pattern** with lazy-loaded components, shared base viewers, and unified state management hooks.

---

## Current Problem

ContentDisplay.tsx renders by **domain** (6 categories), not **type** (17 variants):

```
Video domain  → Basic <video> tag (same for Movie, TV, Short, MusicVideo)
Audio domain  → Icon + <audio> (same for Music, Podcast, Audiobook)
Image domain  → Basic <img> (same for Photo, Artwork)
Document/File/Text → Generic placeholder icon (NO actual viewer!)
```

**Result**: Movies lack chapters, Podcasts lack skip buttons, Books show only icons.

---

## Architecture: Type-Aware Viewer Registry

```
ContentSlide (Feed.tsx)
       ↓
ContentViewer (registry)
       ↓
┌─────────────────────────────────────────────────────┐
│  getViewer(contentType) → Lazy-loaded component     │
│                                                     │
│  ContentType.Movie    → MovieViewer                 │
│  ContentType.Podcast  → PodcastViewer               │
│  ContentType.Book     → BookViewer (PDF.js/epub.js) │
│  ...17 total viewers                                │
└─────────────────────────────────────────────────────┘
```

---

## File Structure

```
apps/web/src/components/viewers/
├── index.ts                    # Registry + ContentViewer wrapper
├── types.ts                    # ViewerProps, metadata interfaces
├── hooks/
│   ├── useViewerState.ts       # UI state (controls visibility, fullscreen)
│   ├── useMediaPlayback.ts     # Play/pause/seek/volume for audio/video
│   └── useDocumentReader.ts    # PDF.js/epub.js state management
├── base/
│   ├── BaseVideoViewer.tsx     # Shared video functionality
│   ├── BaseAudioViewer.tsx     # Shared audio functionality
│   └── BaseImageViewer.tsx     # Shared image functionality
├── video/
│   ├── VideoViewer.tsx         # Generic video
│   ├── MovieViewer.tsx         # + Chapters, cast overlay, credits skip
│   ├── TelevisionViewer.tsx    # + Episode info, next episode, series nav
│   ├── MusicVideoViewer.tsx    # + Lyrics overlay, artist info
│   └── ShortViewer.tsx         # + Quick actions, vertical optimization
├── audio/
│   ├── MusicViewer.tsx         # + Album art prominent, waveform
│   ├── PodcastViewer.tsx       # + Skip 15s/30s, timestamps, show notes
│   └── AudiobookViewer.tsx     # + Chapters, speed control, sleep timer
├── image/
│   ├── PhotoViewer.tsx         # + EXIF data, zoom/pan
│   └── ArtworkViewer.tsx       # + Artist statement, provenance
├── document/
│   ├── BookViewer.tsx          # PDF.js/epub.js reader
│   └── ComicViewer.tsx         # + Panel navigation, spread view, RTL
├── file/
│   ├── AssetViewer.tsx         # Preview + download
│   ├── GameViewer.tsx          # Screenshots, requirements, download
│   ├── SoftwareViewer.tsx      # Version, changelog, download
│   └── DatasetViewer.tsx       # Schema preview, sample rows
└── text/
    └── PostViewer.tsx          # Markdown/rich text rendering
```

---

## Core Interfaces

```typescript
// types.ts

interface ViewerProps {
  contentCid: string;
  contentUrl: string | null;      // Decrypted URL when available
  contentType: ContentType;
  metadata: ContentMetadata | null;
  isActive: boolean;              // Current slide visible
  isLocked: boolean;              // Requires purchase
  showOverlay: boolean;           // UI overlay state
  onOverlayToggle: () => void;
  bundleContext?: {
    currentIndex: number;
    totalItems: number;
    bundleType: string;
  };
}

// Type-specific metadata extensions
interface PodcastMetadata extends ContentMetadata {
  showName?: string;
  episodeNumber?: number;
  timestamps?: { label: string; time: number }[];
  showNotes?: string;
}

interface AudiobookMetadata extends ContentMetadata {
  author?: string;
  narrator?: string;
  chapters?: { title: string; startTime: number }[];
}

interface BookMetadata extends ContentMetadata {
  author?: string;
  format?: 'pdf' | 'epub';
  pageCount?: number;
}

// ... similar for all 17 types
```

---

## Viewer Registry

```typescript
// index.ts

const viewerRegistry: Record<ContentType, ViewerRegistration> = {
  [ContentType.Video]: { component: lazy(() => import("./video/VideoViewer")) },
  [ContentType.Movie]: { component: lazy(() => import("./video/MovieViewer")) },
  [ContentType.Television]: { component: lazy(() => import("./video/TelevisionViewer")) },
  [ContentType.MusicVideo]: { component: lazy(() => import("./video/MusicVideoViewer")) },
  [ContentType.Short]: { component: lazy(() => import("./video/ShortViewer")) },
  [ContentType.Music]: { component: lazy(() => import("./audio/MusicViewer")) },
  [ContentType.Podcast]: { component: lazy(() => import("./audio/PodcastViewer")) },
  [ContentType.Audiobook]: { component: lazy(() => import("./audio/AudiobookViewer")) },
  [ContentType.Photo]: { component: lazy(() => import("./image/PhotoViewer")) },
  [ContentType.Artwork]: { component: lazy(() => import("./image/ArtworkViewer")) },
  [ContentType.Book]: { component: lazy(() => import("./document/BookViewer")) },
  [ContentType.Comic]: { component: lazy(() => import("./document/ComicViewer")) },
  [ContentType.Asset]: { component: lazy(() => import("./file/AssetViewer")) },
  [ContentType.Game]: { component: lazy(() => import("./file/GameViewer")) },
  [ContentType.Software]: { component: lazy(() => import("./file/SoftwareViewer")) },
  [ContentType.Dataset]: { component: lazy(() => import("./file/DatasetViewer")) },
  [ContentType.Post]: { component: lazy(() => import("./text/PostViewer")) },
};

export function ContentViewer(props: ViewerProps) {
  const { component: Viewer } = viewerRegistry[props.contentType];
  return (
    <Suspense fallback={<ViewerPlaceholder contentType={props.contentType} />}>
      <Viewer {...props} />
    </Suspense>
  );
}
```

---

## Type-Specific Features

| Type | Base | Unique Features |
|------|------|-----------------|
| **Video** | BaseVideo | Standard controls |
| **Movie** | BaseVideo | + Chapters, cast overlay, credits skip |
| **Television** | BaseVideo | + Episode info, next episode button, series context |
| **MusicVideo** | BaseVideo | + Lyrics overlay toggle, artist sidebar |
| **Short** | BaseVideo | + Quick actions (like/share prominent), vertical aspect |
| **Music** | BaseAudio | + Album art large, waveform visualization |
| **Podcast** | BaseAudio | + Skip 15s/30s buttons, timestamps list, show notes panel |
| **Audiobook** | BaseAudio | + Chapter list, playback speed (0.5x-2x), sleep timer |
| **Photo** | BaseImage | + EXIF data panel, zoom/pan gestures |
| **Artwork** | BaseImage | + Artist statement, zoom to detail |
| **Book** | PDF.js/epub.js | Page flip, bookmarks, font sizing, progress % |
| **Comic** | PDF.js | Panel-by-panel or page view, spread mode, RTL support |
| **Asset** | Custom | Preview thumbnail + download button + file info |
| **Game** | Custom | Screenshots carousel, system requirements, download |
| **Software** | Custom | Version info, changelog accordion, download button |
| **Dataset** | Custom | Schema table, sample rows preview, download |
| **Post** | Markdown | Clean typography, read time, syntax highlighting |

---

## Dependencies

```bash
# Required
npm install pdfjs-dist epubjs

# Optional enhancements
npm install wavesurfer.js  # Audio waveforms
npm install exifr          # EXIF extraction for photos
npm install medium-zoom    # Image zoom
```

---

## Integration Point

Replace in `Feed.tsx` ContentSlide (lines ~1111-1142):

```typescript
// Before: Domain-based switches
{contentDomain === "video" && <video ... />}
{contentDomain === "audio" && <audio ... />}

// After: Single unified component
import { ContentViewer } from "@/components/viewers";

<ContentViewer
  contentCid={content.contentCid}
  contentUrl={contentUrl}
  contentType={content.contentType}
  metadata={content.metadata}
  isActive={isActive}
  isLocked={showLockedOverlay}
  showOverlay={showOverlay}
  onOverlayToggle={() => setShowOverlay(prev => !prev)}
/>
```

Also deprecate `ContentDisplay.tsx` - functionality moves to viewers.

---

## Implementation Phases

### Phase 1: Foundation
1. Create `viewers/` directory structure
2. Define `types.ts` with all interfaces
3. Implement shared hooks (`useViewerState`, `useMediaPlayback`)
4. Create base viewers (`BaseVideoViewer`, `BaseAudioViewer`, `BaseImageViewer`)
5. Set up viewer registry with lazy loading

### Phase 2: Video Domain (5 viewers)
6. `VideoViewer` - migrate existing video rendering
7. `ShortViewer` - quick actions, vertical handling
8. `MovieViewer` - chapters, cast info
9. `TelevisionViewer` - episode context, series nav
10. `MusicVideoViewer` - lyrics, artist info

### Phase 3: Audio Domain (3 viewers)
11. `MusicViewer` - album art, waveform
12. `PodcastViewer` - skip controls, timestamps
13. `AudiobookViewer` - chapters, speed, sleep timer

### Phase 4: Image Domain (2 viewers)
14. `PhotoViewer` - EXIF, zoom/pan
15. `ArtworkViewer` - artist statement

### Phase 5: Document Domain (2 viewers)
16. Implement `useDocumentReader` hook (PDF.js + epub.js)
17. `BookViewer` - full reader experience
18. `ComicViewer` - panel navigation, spreads

### Phase 6: File Domain (4 viewers)
19. `AssetViewer` - preview + download
20. `GameViewer` - screenshots, requirements
21. `SoftwareViewer` - version info
22. `DatasetViewer` - schema preview

### Phase 7: Text Domain + Integration
23. `PostViewer` - markdown rendering
24. Update ContentSlide to use ContentViewer
25. Deprecate ContentDisplay.tsx
26. Keyboard shortcuts per viewer type
27. Accessibility pass (ARIA, focus)

---

## Files to Modify

| File | Change |
|------|--------|
| `apps/web/src/components/feed/Feed.tsx` | Replace domain rendering with ContentViewer |
| `apps/web/src/components/feed/types.ts` | Add type-specific metadata interfaces |
| `apps/web/src/components/feed/ContentDisplay.tsx` | Deprecate (replaced by viewers) |
| `package.json` | Add pdfjs-dist, epubjs dependencies |

## Files to Create

| File | Purpose |
|------|---------|
| `viewers/index.ts` | Registry and ContentViewer wrapper |
| `viewers/types.ts` | All viewer interfaces |
| `viewers/hooks/*.ts` | 3 shared state hooks |
| `viewers/base/*.tsx` | 3 base viewer components |
| `viewers/video/*.tsx` | 5 video viewers |
| `viewers/audio/*.tsx` | 3 audio viewers |
| `viewers/image/*.tsx` | 2 image viewers |
| `viewers/document/*.tsx` | 2 document viewers |
| `viewers/file/*.tsx` | 4 file viewers |
| `viewers/text/*.tsx` | 1 text viewer |

**Total: ~25 new files**

---

## Notes

- All viewers lazy-loaded to minimize initial bundle
- Base viewers handle common functionality (play/pause, progress, etc.)
- Type-specific viewers add unique features as overlays/sidebars
- Document viewers use Web Workers for PDF.js (avoid main thread blocking)
- Metadata for type-specific features comes from IPFS metadata JSON
- Bundle context passed through for album/series/course navigation

---
---

# Part 2: Upload Studio Experience

## Summary
Replace the constrained UploadModal with a full-page `/studio/upload` experience featuring type-specific metadata forms, draft saving to Supabase, and scheduled publishing.

---

## Current Problems

1. **Modal constraints** - 520px width, limited vertical space
2. **No drafts** - Content goes straight to on-chain, can't save progress
3. **No scheduling** - Publish immediately or not at all
4. **Limited editing** - Can't modify type-specific metadata after upload
5. **Cluttered flow** - Domain, type, file, details, monetization all cramped together

---

## Architecture: Full-Page Upload Studio

```
/studio/upload
       ↓
┌─────────────────────────────────────────────────────────────┐
│  UPLOAD STUDIO (Full Screen)                                │
│                                                             │
│  ┌──────────┐  ┌──────────────────────────────────────────┐│
│  │ Progress │  │  Step Content                            ││
│  │ Sidebar  │  │                                          ││
│  │          │  │  [Type-specific form / File upload /     ││
│  │ 1. Type  │  │   Monetization / Preview / Schedule]     ││
│  │ 2. File  │  │                                          ││
│  │ 3. Details│ │                                          ││
│  │ 4. Price │  │                                          ││
│  │ 5. Review│  │                                          ││
│  │ 6. Publish│ │                                          ││
│  │          │  │                                          ││
│  │ [Save    │  │                                          ││
│  │  Draft]  │  │                                          ││
│  └──────────┘  └──────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## Supabase Schema

```sql
-- Drafts table for work-in-progress content
CREATE TABLE content_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_wallet TEXT NOT NULL,

  -- Content identification
  content_type INTEGER NOT NULL,        -- ContentType enum value
  domain TEXT NOT NULL,                 -- video/audio/image/document/file/text

  -- Upload state
  status TEXT NOT NULL DEFAULT 'draft', -- draft | uploading | scheduled | published | failed

  -- File references (after upload to IPFS)
  content_cid TEXT,
  preview_cid TEXT,
  thumbnail_cid TEXT,
  metadata_cid TEXT,
  encryption_meta_cid TEXT,

  -- Metadata (JSON - type-specific fields)
  title TEXT,
  description TEXT,
  tags TEXT[],
  type_metadata JSONB,                  -- Type-specific fields (artist, director, etc.)

  -- Monetization config
  mint_price BIGINT,                    -- In lamports
  supply_limit INTEGER,
  visibility_level INTEGER DEFAULT 0,
  rental_config JSONB,                  -- {6h: price, 1d: price, 7d: price}

  -- Scheduling
  scheduled_at TIMESTAMPTZ,             -- NULL = immediate publish
  published_at TIMESTAMPTZ,

  -- On-chain reference (after publish)
  content_pda TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_drafts_creator ON content_drafts(creator_wallet);
CREATE INDEX idx_drafts_status ON content_drafts(status);
CREATE INDEX idx_drafts_scheduled ON content_drafts(scheduled_at) WHERE status = 'scheduled';

-- Scheduled publish job tracking
CREATE TABLE publish_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID REFERENCES content_drafts(id),
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending',        -- pending | processing | completed | failed
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## File Structure (Upload Studio)

```
apps/web/src/
├── app/studio/
│   ├── page.tsx                        # Existing studio dashboard
│   └── upload/
│       ├── page.tsx                    # Full-page upload experience
│       ├── [draftId]/
│       │   └── page.tsx                # Edit existing draft
│       └── layout.tsx                  # Upload-specific layout (no nav)
├── components/studio/
│   ├── UploadStudio.tsx                # Main orchestrator component
│   ├── UploadSidebar.tsx               # Progress sidebar with save draft
│   ├── steps/
│   │   ├── TypeSelectStep.tsx          # Domain + type selection
│   │   ├── FileUploadStep.tsx          # Drag-drop file upload
│   │   ├── DetailsStep.tsx             # Metadata form (delegates to type forms)
│   │   ├── MonetizationStep.tsx        # Pricing, supply, visibility
│   │   ├── ReviewStep.tsx              # Preview before publish
│   │   └── PublishStep.tsx             # Publish or schedule
│   ├── forms/                          # Type-specific metadata forms
│   │   ├── VideoMetadataForm.tsx
│   │   ├── MovieMetadataForm.tsx
│   │   ├── TelevisionMetadataForm.tsx
│   │   ├── MusicVideoMetadataForm.tsx
│   │   ├── ShortMetadataForm.tsx
│   │   ├── MusicMetadataForm.tsx
│   │   ├── PodcastMetadataForm.tsx
│   │   ├── AudiobookMetadataForm.tsx
│   │   ├── PhotoMetadataForm.tsx
│   │   ├── ArtworkMetadataForm.tsx
│   │   ├── BookMetadataForm.tsx
│   │   ├── ComicMetadataForm.tsx
│   │   ├── AssetMetadataForm.tsx
│   │   ├── GameMetadataForm.tsx
│   │   ├── SoftwareMetadataForm.tsx
│   │   ├── DatasetMetadataForm.tsx
│   │   └── PostMetadataForm.tsx
│   └── DraftsList.tsx                  # List of saved drafts in studio
├── hooks/
│   └── useDraft.ts                     # Draft CRUD operations
├── lib/
│   └── supabase.ts                     # Supabase client
└── app/api/
    ├── drafts/
    │   ├── route.ts                    # GET (list), POST (create)
    │   └── [id]/
    │       └── route.ts                # GET, PATCH, DELETE
    └── publish/
        └── route.ts                    # POST - publish draft to chain
```

---

## Upload Flow (New)

```
1. TYPE SELECT
   ├── Choose domain (video/audio/image/document/file/text)
   └── Choose specific type (Movie, Podcast, Book, etc.)
           ↓
2. FILE UPLOAD
   ├── Drag & drop or click to upload
   ├── Shows upload progress
   ├── Auto-generates preview (video/audio)
   └── Encrypts content (server-side)
           ↓
3. DETAILS (Type-Specific Form)
   ├── Common: title, description, tags
   └── Type-specific: director/cast (Movie), chapters (Audiobook), etc.
           ↓
4. MONETIZATION
   ├── Mint pricing (buy price, supply)
   ├── Rental pricing (6h/1d/7d)
   └── Visibility level
           ↓
5. REVIEW
   ├── Preview content display
   ├── Review all metadata
   └── Review pricing summary
           ↓
6. PUBLISH
   ├── Publish Now → on-chain registration
   ├── Schedule → pick date/time → save to Supabase
   └── Save Draft → save current state without publishing

[SAVE DRAFT] available at any step after file upload
```

---

## Draft Workflow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   DRAFT     │────▶│  SCHEDULED  │────▶│  PUBLISHED  │
│             │     │             │     │             │
│ Editable    │     │ Waiting for │     │ On-chain    │
│ Not on-chain│     │ publish time│     │ Immutable   │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │
       ▼                   ▼
  [Edit Draft]      [Cancel Schedule]
                    [Publish Now]
```

**Draft States:**
- `draft` - Work in progress, fully editable
- `uploading` - File upload in progress
- `scheduled` - Has future publish date
- `published` - On-chain, content_pda set
- `failed` - Publish failed, can retry

---

## Scheduled Publishing

### Cron Job (Supabase Edge Function or Vercel Cron)

```typescript
// /api/cron/publish-scheduled
export async function GET() {
  const supabase = createClient();

  // Find drafts ready to publish
  const { data: drafts } = await supabase
    .from('content_drafts')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString());

  for (const draft of drafts) {
    try {
      // Register on-chain (server-side signing or queue for user)
      await publishDraftToChain(draft);

      await supabase
        .from('content_drafts')
        .update({ status: 'published', published_at: new Date() })
        .eq('id', draft.id);
    } catch (error) {
      await supabase
        .from('content_drafts')
        .update({ status: 'failed' })
        .eq('id', draft.id);
    }
  }
}
```

### Challenge: On-Chain Publishing Requires Wallet Signature

**Options:**
1. **User must be online** - Send notification, user clicks to sign
2. **Delegated signing** - User pre-authorizes server to sign (complex)
3. **Queue system** - Schedule marks "ready", user publishes from dashboard

**Recommended**: Option 3 - Queue system
- Scheduled drafts move to "ready to publish" state
- User sees notification in Studio dashboard
- One-click publish from drafts list

---

## Key Components

### UploadStudio.tsx (Orchestrator)

```typescript
export function UploadStudio({ draftId }: { draftId?: string }) {
  const [step, setStep] = useState<UploadStep>('type');
  const { draft, updateDraft, saveDraft, publishDraft } = useDraft(draftId);

  return (
    <div className="flex h-screen">
      <UploadSidebar
        currentStep={step}
        draft={draft}
        onSaveDraft={saveDraft}
        onStepClick={setStep}
      />
      <main className="flex-1 overflow-auto p-8">
        {step === 'type' && <TypeSelectStep draft={draft} onUpdate={updateDraft} onNext={() => setStep('file')} />}
        {step === 'file' && <FileUploadStep draft={draft} onUpdate={updateDraft} onNext={() => setStep('details')} />}
        {step === 'details' && <DetailsStep draft={draft} onUpdate={updateDraft} onNext={() => setStep('monetization')} />}
        {step === 'monetization' && <MonetizationStep draft={draft} onUpdate={updateDraft} onNext={() => setStep('review')} />}
        {step === 'review' && <ReviewStep draft={draft} onNext={() => setStep('publish')} />}
        {step === 'publish' && <PublishStep draft={draft} onPublish={publishDraft} />}
      </main>
    </div>
  );
}
```

### useDraft Hook

```typescript
export function useDraft(draftId?: string) {
  const [draft, setDraft] = useState<ContentDraft | null>(null);

  // Load existing draft or create new
  useEffect(() => {
    if (draftId) {
      loadDraft(draftId);
    } else {
      setDraft(createEmptyDraft());
    }
  }, [draftId]);

  const updateDraft = (updates: Partial<ContentDraft>) => {
    setDraft(prev => ({ ...prev, ...updates }));
  };

  const saveDraft = async () => {
    // POST/PATCH to /api/drafts
  };

  const publishDraft = async (scheduleAt?: Date) => {
    if (scheduleAt) {
      // Schedule for later
      await saveDraft({ status: 'scheduled', scheduled_at: scheduleAt });
    } else {
      // Publish now - call on-chain registration
      await registerOnChain(draft);
      await saveDraft({ status: 'published' });
    }
  };

  return { draft, updateDraft, saveDraft, publishDraft };
}
```

---

## Implementation Phases (Upload Studio)

### Phase 8: Supabase Setup
1. Install `@supabase/supabase-js`
2. Create Supabase project (or use existing)
3. Run migrations for `content_drafts` and `publish_jobs` tables
4. Create `/lib/supabase.ts` client

### Phase 9: Draft API Routes
5. `/api/drafts` - List and create drafts
6. `/api/drafts/[id]` - Get, update, delete draft
7. `/api/publish` - Publish draft to chain

### Phase 10: Upload Studio Page
8. Create `/app/studio/upload/page.tsx`
9. Create `UploadStudio.tsx` orchestrator
10. Create `UploadSidebar.tsx` with progress + save draft
11. Create step components (type, file, details, monetization, review, publish)

### Phase 11: Type-Specific Forms
12. Create 17 metadata form components (one per content type)
13. Extract common fields into shared components
14. Add validation per type

### Phase 12: Draft Management
15. Add `DraftsList.tsx` to Studio dashboard
16. Add draft status badges and actions
17. Add "Continue editing" flow

### Phase 13: Scheduling
18. Add date/time picker to PublishStep
19. Add scheduled drafts view
20. Create cron endpoint for publish notifications
21. Add "Publish Now" action for scheduled items

---

## Files to Create (Upload Studio)

| File | Purpose |
|------|---------|
| `lib/supabase.ts` | Supabase client |
| `app/studio/upload/page.tsx` | Upload studio page |
| `app/studio/upload/[draftId]/page.tsx` | Edit draft page |
| `components/studio/UploadStudio.tsx` | Main orchestrator |
| `components/studio/UploadSidebar.tsx` | Progress + save |
| `components/studio/steps/*.tsx` | 6 step components |
| `components/studio/forms/*.tsx` | 17 metadata forms |
| `components/studio/DraftsList.tsx` | Drafts in dashboard |
| `hooks/useDraft.ts` | Draft CRUD hook |
| `app/api/drafts/route.ts` | Drafts API |
| `app/api/drafts/[id]/route.ts` | Single draft API |
| `app/api/publish/route.ts` | Publish API |
| `app/api/cron/publish-scheduled/route.ts` | Scheduled publish cron |

**Total: ~30 new files for upload studio**

---

## Combined Implementation Order

### Foundation (Both Systems)
1-5. Viewer foundation (types, hooks, base components, registry)

### Viewers (Part 1)
6-23. All 17 type-specific viewers

### Upload Studio (Part 2)
24. Supabase setup + schema
25. Draft API routes
26. Upload studio page structure
27. Step components
28. Type-specific metadata forms (17)
29. Draft management in dashboard
30. Scheduling system

### Integration
31. Update ContentSlide to use ContentViewer
32. Deprecate UploadModal (redirect to /studio/upload)
33. End-to-end testing

---

## Summary

**Two complementary systems:**

| System | Purpose | Key Feature |
|--------|---------|-------------|
| **Viewers** | Output/consumption | Type-specific playback experiences |
| **Upload Studio** | Input/creation | Full-page draft + schedule workflow |

**Total new files: ~55**
- 25 viewer components
- 30 upload studio components

**New dependencies:**
- `pdfjs-dist`, `epubjs` (viewers)
- `@supabase/supabase-js` (drafts)
