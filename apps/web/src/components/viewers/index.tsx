import { lazy, Suspense, ComponentType } from "react";
import { ContentType } from "@handcraft/sdk";
import { ViewerProps } from "./types";

// Lazy load all viewers
const VideoViewer = lazy(() => import("./video/VideoViewer"));
const ShortViewer = lazy(() => import("./video/ShortViewer"));
const MovieViewer = lazy(() => import("./video/MovieViewer"));
const TelevisionViewer = lazy(() => import("./video/TelevisionViewer"));
const MusicVideoViewer = lazy(() => import("./video/MusicVideoViewer"));

const MusicViewer = lazy(() => import("./audio/MusicViewer"));
const PodcastViewer = lazy(() => import("./audio/PodcastViewer"));
const AudiobookViewer = lazy(() => import("./audio/AudiobookViewer"));

const PhotoViewer = lazy(() => import("./image/PhotoViewer"));
const ArtworkViewer = lazy(() => import("./image/ArtworkViewer"));

const BookViewer = lazy(() => import("./document/BookViewer"));
const ComicViewer = lazy(() => import("./document/ComicViewer"));

const AssetViewer = lazy(() => import("./file/AssetViewer"));
const GameViewer = lazy(() => import("./file/GameViewer"));
const SoftwareViewer = lazy(() => import("./file/SoftwareViewer"));
const DatasetViewer = lazy(() => import("./file/DatasetViewer"));

const PostViewer = lazy(() => import("./text/PostViewer"));

// Viewer registry mapping content type to viewer component
const VIEWER_REGISTRY: Record<ContentType, ComponentType<ViewerProps>> = {
  [ContentType.Video]: VideoViewer,
  [ContentType.Short]: ShortViewer,
  [ContentType.Movie]: MovieViewer,
  [ContentType.Television]: TelevisionViewer,
  [ContentType.MusicVideo]: MusicVideoViewer,
  [ContentType.Music]: MusicViewer,
  [ContentType.Podcast]: PodcastViewer,
  [ContentType.Audiobook]: AudiobookViewer,
  [ContentType.Photo]: PhotoViewer,
  [ContentType.Artwork]: ArtworkViewer,
  [ContentType.Book]: BookViewer,
  [ContentType.Comic]: ComicViewer,
  [ContentType.Asset]: AssetViewer,
  [ContentType.Game]: GameViewer,
  [ContentType.Software]: SoftwareViewer,
  [ContentType.Dataset]: DatasetViewer,
  [ContentType.Post]: PostViewer,
};

/**
 * Get the appropriate viewer component for a content type
 */
export function getViewer(contentType: ContentType): ComponentType<ViewerProps> {
  return VIEWER_REGISTRY[contentType] || VideoViewer;
}

// Domain icons for placeholders
const DOMAIN_ICONS: Record<string, string> = {
  video: "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z",
  audio: "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3",
  image: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
  document: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  file: "M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z",
  text: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
};

// Map content types to domains for placeholder icons
function getContentDomain(contentType: ContentType): string {
  if ([ContentType.Video, ContentType.Movie, ContentType.Television, ContentType.MusicVideo, ContentType.Short].includes(contentType)) {
    return "video";
  }
  if ([ContentType.Music, ContentType.Podcast, ContentType.Audiobook].includes(contentType)) {
    return "audio";
  }
  if ([ContentType.Photo, ContentType.Artwork].includes(contentType)) {
    return "image";
  }
  if ([ContentType.Book, ContentType.Comic].includes(contentType)) {
    return "document";
  }
  if ([ContentType.Asset, ContentType.Game, ContentType.Software, ContentType.Dataset].includes(contentType)) {
    return "file";
  }
  return "text";
}

/**
 * Loading placeholder shown while viewer loads
 */
export function ViewerPlaceholder({ contentType }: { contentType: ContentType }) {
  const domain = getContentDomain(contentType);
  const iconPath = DOMAIN_ICONS[domain] || DOMAIN_ICONS.file;

  return (
    <div className="w-full h-full flex items-center justify-center bg-black/50">
      <div className="animate-pulse">
        <svg
          className="w-24 h-24 text-white/20"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d={iconPath}
          />
        </svg>
      </div>
    </div>
  );
}

/**
 * Unified content viewer component that renders the appropriate
 * type-specific viewer based on content type.
 */
export function ContentViewer(props: ViewerProps) {
  const Viewer = VIEWER_REGISTRY[props.contentType] || VideoViewer;

  return (
    <Suspense fallback={<ViewerPlaceholder contentType={props.contentType} />}>
      <Viewer {...props} />
    </Suspense>
  );
}

export * from "./types";
