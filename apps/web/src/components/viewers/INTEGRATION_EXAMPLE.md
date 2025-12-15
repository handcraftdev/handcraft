# Integration Example

This document shows how to integrate the Content Viewers system with the existing Feed component.

## Step 1: Replace ContentDisplay with Viewers

Instead of using the generic `ContentDisplay` component, use the type-specific viewers:

### Before (ContentDisplay.tsx)

```tsx
import { ContentDisplay } from "@/components/feed/ContentDisplay";

<ContentDisplay
  contentCid={contentCid}
  previewCid={previewCid}
  contentType={contentType}
  title={title}
  isActive={isActive}
  showControls={showControls}
  isBlurred={isBlurred}
/>
```

### After (Using Viewers)

```tsx
import { Suspense } from "react";
import { getViewer } from "@/components/viewers";
import { getIpfsUrl } from "@handcraft/sdk";

const Viewer = getViewer(contentType);
const contentUrl = previewCid ? getIpfsUrl(previewCid) : getIpfsUrl(contentCid);

<Suspense fallback={<ContentPlaceholder contentDomain={contentDomain} />}>
  <Viewer
    contentUrl={contentUrl}
    contentCid={contentCid}
    contentType={contentType}
    metadata={contentMetadata}
    title={title}
    isActive={isActive}
    showControls={showControls}
    isBlurred={isBlurred}
  />
</Suspense>
```

## Step 2: Fetch and Parse Metadata

Add metadata fetching to your content hooks:

```tsx
import { useState, useEffect } from "react";
import { getIpfsUrl } from "@handcraft/sdk";
import type { ContentMetadata } from "@/components/viewers";

function useFeedContent() {
  const [contentMetadata, setContentMetadata] = useState<ContentMetadata | null>(null);

  useEffect(() => {
    if (metadataCid) {
      fetch(getIpfsUrl(metadataCid))
        .then(res => res.json())
        .then(metadata => setContentMetadata(metadata))
        .catch(err => console.error("Failed to load metadata:", err));
    }
  }, [metadataCid]);

  return { contentMetadata };
}
```

## Step 3: Update Feed Component

Modify your Feed component to use the viewer system:

```tsx
// In Feed.tsx or similar component

import { Suspense } from "react";
import { getViewer } from "@/components/viewers";
import type { ContentMetadata } from "@/components/viewers";

interface FeedItemProps {
  contentCid: string;
  metadataCid: string;
  contentType: ContentType;
  isActive: boolean;
}

function FeedItem({ contentCid, metadataCid, contentType, isActive }: FeedItemProps) {
  const [metadata, setMetadata] = useState<ContentMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch metadata
    fetch(getIpfsUrl(metadataCid))
      .then(res => res.json())
      .then(data => {
        setMetadata(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Failed to load metadata:", err);
        setIsLoading(false);
      });
  }, [metadataCid]);

  const Viewer = getViewer(contentType);
  const contentUrl = getIpfsUrl(contentCid);

  return (
    <div className="feed-item">
      <Suspense fallback={<LoadingSpinner />}>
        <Viewer
          contentUrl={contentUrl}
          contentCid={contentCid}
          contentType={contentType}
          metadata={metadata}
          isActive={isActive}
          showControls={true}
        />
      </Suspense>
    </div>
  );
}
```

## Step 4: Handle Locked/Encrypted Content

For locked content, use the `isBlurred` prop:

```tsx
const isLocked = !hasAccess(content);

<Viewer
  contentUrl={previewUrl} // Use preview CID for locked content
  contentCid={contentCid}
  contentType={contentType}
  metadata={null} // Don't show metadata for locked content
  isActive={isActive}
  showControls={false} // Hide controls for locked content
  isBlurred={isLocked} // Blur the content
/>
```

## Step 5: Example Metadata Structure

Each content type should have metadata in this format:

### Music
```json
{
  "name": "Song Title",
  "description": "Song description",
  "image": "ipfs://QmAlbumArt...",
  "artist": "Artist Name",
  "album": "Album Name",
  "genre": "Pop",
  "year": "2024",
  "duration": 180
}
```

### Movie
```json
{
  "name": "Movie Title",
  "description": "Movie synopsis",
  "image": "ipfs://QmPoster...",
  "genre": "Action",
  "year": "2024",
  "duration": 7200,
  "chapters": [
    { "title": "Opening Scene", "startTime": 0 },
    { "title": "Act 1", "startTime": 600 },
    { "title": "Act 2", "startTime": 3600 }
  ]
}
```

### Podcast
```json
{
  "name": "Episode Title",
  "description": "Episode description",
  "image": "ipfs://QmCover...",
  "host": "Host Name",
  "duration": 3600,
  "chapters": [
    { "title": "Introduction", "startTime": 0 },
    { "title": "Main Topic", "startTime": 300 },
    { "title": "Q&A", "startTime": 2400 }
  ]
}
```

### Game
```json
{
  "name": "Game Title",
  "description": "Game description",
  "image": "ipfs://QmCover...",
  "genre": "RPG",
  "platform": "Windows/Mac/Linux",
  "version": "1.0.0",
  "developer": "Studio Name",
  "publisher": "Publisher Name",
  "fileSize": 5368709120
}
```

## Step 6: Loading States

Use the `ContentPlaceholder` component for loading states:

```tsx
import { ContentPlaceholder } from "@/components/feed/ContentDisplay";

<Suspense fallback={
  <ContentPlaceholder contentDomain={getContentDomain(contentType)} />
}>
  <Viewer {...props} />
</Suspense>
```

## Complete Example

Here's a complete example integrating everything:

```tsx
"use client";

import { useState, useEffect, Suspense } from "react";
import { getViewer, type ContentMetadata } from "@/components/viewers";
import { getIpfsUrl, getContentDomain, ContentType } from "@handcraft/sdk";
import { ContentPlaceholder } from "@/components/feed/ContentDisplay";

interface ContentViewerProps {
  contentCid: string;
  metadataCid: string;
  previewCid?: string;
  contentType: ContentType;
  isActive: boolean;
  hasAccess: boolean;
}

export function ContentViewer({
  contentCid,
  metadataCid,
  previewCid,
  contentType,
  isActive,
  hasAccess,
}: ContentViewerProps) {
  const [metadata, setMetadata] = useState<ContentMetadata | null>(null);

  useEffect(() => {
    if (hasAccess && metadataCid) {
      fetch(getIpfsUrl(metadataCid))
        .then(res => res.json())
        .then(data => setMetadata(data))
        .catch(err => console.error("Failed to load metadata:", err));
    }
  }, [metadataCid, hasAccess]);

  const Viewer = getViewer(contentType);
  const contentUrl = !hasAccess && previewCid
    ? getIpfsUrl(previewCid)
    : getIpfsUrl(contentCid);

  return (
    <Suspense fallback={
      <ContentPlaceholder contentDomain={getContentDomain(contentType)} />
    }>
      <Viewer
        contentUrl={contentUrl}
        contentCid={contentCid}
        contentType={contentType}
        metadata={hasAccess ? metadata : null}
        isActive={isActive}
        showControls={hasAccess}
        isBlurred={!hasAccess}
      />
    </Suspense>
  );
}
```

## Benefits of This Approach

1. **Type-specific UI**: Each content type gets optimized viewing experience
2. **Code splitting**: Viewers are lazy-loaded, reducing bundle size
3. **Consistent API**: All viewers share the same props interface
4. **Easy to extend**: Add new content types by creating new viewer components
5. **Metadata support**: Rich metadata display for each content type
6. **Performance**: Only load the viewer needed for current content
7. **Maintainability**: Separated concerns, easy to update individual viewers
