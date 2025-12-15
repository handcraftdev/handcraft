import { lazy, ComponentType } from "react";
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

export * from "./types";
