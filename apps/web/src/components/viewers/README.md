# Content Viewers System

A comprehensive, type-specific content viewing system for the Handcraft platform. Each content type has its own optimized viewer component with tailored UI and functionality.

## Architecture

### Directory Structure

```
viewers/
├── base/                   # Base viewer components
│   ├── BaseVideoViewer.tsx
│   ├── BaseAudioViewer.tsx
│   └── BaseImageViewer.tsx
├── hooks/                  # Shared hooks
│   ├── useViewerState.ts
│   └── useMediaPlayback.ts
├── video/                  # Video viewers (5 types)
│   ├── VideoViewer.tsx
│   ├── ShortViewer.tsx
│   ├── MovieViewer.tsx
│   ├── TelevisionViewer.tsx
│   └── MusicVideoViewer.tsx
├── audio/                  # Audio viewers (3 types)
│   ├── MusicViewer.tsx
│   ├── PodcastViewer.tsx
│   └── AudiobookViewer.tsx
├── image/                  # Image viewers (2 types)
│   ├── PhotoViewer.tsx
│   └── ArtworkViewer.tsx
├── document/              # Document viewers (2 types)
│   ├── BookViewer.tsx
│   └── ComicViewer.tsx
├── file/                  # File viewers (4 types)
│   ├── AssetViewer.tsx
│   ├── GameViewer.tsx
│   ├── SoftwareViewer.tsx
│   └── DatasetViewer.tsx
├── text/                  # Text viewers (1 type)
│   └── PostViewer.tsx
├── types.ts              # TypeScript interfaces
└── index.ts              # Viewer registry
```

## Usage

### Basic Usage

```tsx
import { Suspense } from "react";
import { getViewer } from "@/components/viewers";
import { ContentType } from "@handcraft/sdk";

function ContentPlayer({ contentType, contentUrl, metadata }) {
  const Viewer = getViewer(contentType);

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Viewer
        contentUrl={contentUrl}
        contentCid="QmXxx..."
        contentType={contentType}
        metadata={metadata}
        isActive={true}
        showControls={true}
      />
    </Suspense>
  );
}
```

### ViewerProps Interface

All viewers accept the same base props:

```tsx
interface ViewerProps {
  contentUrl: string;           // IPFS URL or CDN URL
  contentCid: string;           // Content CID
  contentType: ContentType;     // ContentType enum value
  metadata: ContentMetadata | null;
  title?: string;
  isActive?: boolean;           // Auto-play for active content
  isBlurred?: boolean;          // Blur for locked content
  showControls?: boolean;       // Show/hide playback controls
  className?: string;
}
```

## Content Types & Features

### Video Domain (5 viewers)

#### 1. VideoViewer
- Generic video playback
- Standard controls
- Loop support

#### 2. ShortViewer
- Vertical/portrait optimized
- Mobile-first design
- Quick action overlays
- Tap-to-play/pause

#### 3. MovieViewer
- Chapter navigation
- Chapter menu overlay
- Movie metadata display

#### 4. TelevisionViewer
- Episode information (S1E1 format)
- Show name display
- Episode description

#### 5. MusicVideoViewer
- Artist information overlay
- Album details
- Release year display

### Audio Domain (3 viewers)

#### 1. MusicViewer
- Large album art display
- Custom playback controls
- Progress bar with timestamps
- Skip 10s forward/backward
- Gradient background

#### 2. PodcastViewer
- Episode cover art
- Skip 15s/30s buttons
- Chapter navigation
- Playback speed control (0.75x - 2x)
- Timestamps display

#### 3. AudiobookViewer
- Book cover display (portrait aspect)
- Chapter navigation
- Skip 30s buttons
- Playback speed control (0.75x - 2.5x)
- Chapter list with metadata

### Image Domain (2 viewers)

#### 1. PhotoViewer
- Zoom and pan support
- Double-click to zoom
- Mouse wheel zoom
- Drag when zoomed
- Photo metadata overlay

#### 2. ArtworkViewer
- Artwork information overlay
- Artist statement display
- Medium and dimensions
- Bottom gradient overlay

### Document Domain (2 viewers)

#### 1. BookViewer
- PDF viewer (iframe)
- Book metadata display
- Cover art support
- Download option
- Author, publisher, ISBN info

#### 2. ComicViewer
- Page navigation
- Zoom controls
- PDF support with page parameter
- Comic series information
- Issue number display

### File Domain (4 viewers)

#### 1. AssetViewer
- File preview
- Format and size display
- Version information
- Download button
- Technical metadata

#### 2. GameViewer
- Game cover/screenshots
- Platform and genre info
- Developer/publisher details
- Version and file size
- Download with prominent CTA

#### 3. SoftwareViewer
- Software icon/logo
- Version and platform info
- License display
- Developer information
- Download with license agreement

#### 4. DatasetViewer
- Dataset statistics
- Record count formatting
- Schema preview
- Format and size info
- Download option

### Text Domain (1 viewer)

#### 1. PostViewer
- Markdown-style rendering
- Headers (h1, h2, h3)
- Links with styling
- Bullet points
- Author and publish date
- Tags display
- Loading state

## Shared Hooks

### useViewerState

Manages UI state for viewers:

```tsx
const {
  controlsVisible,
  isFullscreen,
  showInfo,
  toggleControls,
  toggleFullscreen,
  toggleInfo,
  hideControls,
  showControls,
} = useViewerState();
```

### useMediaPlayback

Handles audio/video playback:

```tsx
const { state, controls } = useMediaPlayback(mediaRef, isActive);

// State
state.isPlaying
state.currentTime
state.duration
state.volume
state.isMuted
state.playbackRate

// Controls
controls.play()
controls.pause()
controls.togglePlay()
controls.seek(time)
controls.setVolume(volume)
controls.toggleMute()
controls.setPlaybackRate(rate)
controls.skipForward(seconds)
controls.skipBackward(seconds)
```

## Base Viewers

### BaseVideoViewer
Provides shared video functionality with render props pattern.

### BaseAudioViewer
Provides audio playback with album art display.

### BaseImageViewer
Provides zoom/pan functionality for images.

## Metadata Support

Each content type can include type-specific metadata:

```tsx
interface ContentMetadata {
  name?: string;
  description?: string;
  image?: string;
  duration?: number;
  artist?: string;
  album?: string;
  // ... type-specific fields
}
```

## Styling

All viewers use:
- Tailwind CSS for styling
- Consistent color scheme (white/transparent)
- Backdrop blur effects
- Smooth transitions
- Responsive design
- Dark theme optimized

## Performance

- Lazy loading via React.lazy()
- Code splitting per viewer type
- Efficient metadata handling
- Optimized render cycles
- Memoized components where applicable

## Future Enhancements

- [ ] Virtual scrolling for long documents
- [ ] Advanced video chapters UI
- [ ] Playlist support for music
- [ ] 3D model viewer for assets
- [ ] Code syntax highlighting for software
- [ ] Interactive data visualization for datasets
- [ ] Full markdown support for posts
- [ ] Accessibility improvements (ARIA labels, keyboard navigation)
