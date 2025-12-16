import { ContentType } from "@handcraft/sdk";

export interface ContentMetadata {
  name?: string;
  description?: string;
  image?: string;
  // File info (can be at root level or inside properties)
  mimeType?: string;
  fileName?: string;
  // Nested properties object (from IPFS metadata structure)
  properties?: Record<string, unknown>;
  // Common
  duration?: number;
  // Video/Audio
  artist?: string;
  album?: string;
  genre?: string;
  year?: string;
  // TV/Series
  showName?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  // Book/Document/Audiobook/Comic
  author?: string;
  narrator?: string;
  publisher?: string;
  isbn?: string;
  pages?: number;
  series?: string;
  issue?: number;
  // Chapter support
  chapters?: Chapter[];
  // Asset/Software/Game
  version?: string;
  fileSize?: number;
  format?: string;
  platform?: string;
  developer?: string;
  license?: string;
  // Dataset
  schema?: string;
  records?: number;
  // Photo/Artwork
  photographer?: string;
  location?: string;
  camera?: string;
  lens?: string;
  medium?: string;
  dimensions?: string;
  artistStatement?: string;
  // Podcast
  host?: string;
  guests?: string[];
  // Post
  publishedAt?: string;
  tags?: string[];
}

export interface Chapter {
  title: string;
  startTime: number; // in seconds
  endTime?: number;
}

export interface ViewerProps {
  contentUrl: string;
  contentCid: string;
  contentType: ContentType;
  metadata: ContentMetadata | null;
  title?: string;
  isActive?: boolean;
  isBlurred?: boolean;
  showControls?: boolean;
  className?: string;
}

// Type-specific metadata interfaces

export interface VideoMetadata extends ContentMetadata {
  chapters?: Chapter[];
  duration?: number;
}

export interface MusicVideoMetadata extends ContentMetadata {
  artist?: string;
  album?: string;
  genre?: string;
  year?: string;
}

export interface ShortMetadata extends ContentMetadata {
  duration?: number;
}

export interface MovieMetadata extends ContentMetadata {
  chapters?: Chapter[];
  duration?: number;
  genre?: string;
  year?: string;
  director?: string;
  cast?: string[];
}

export interface TelevisionMetadata extends ContentMetadata {
  showName?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  duration?: number;
}

export interface MusicMetadata extends ContentMetadata {
  artist?: string;
  album?: string;
  genre?: string;
  year?: string;
  duration?: number;
}

export interface PodcastMetadata extends ContentMetadata {
  duration?: number;
  chapters?: Chapter[];
  host?: string;
  guests?: string[];
}

export interface AudiobookMetadata extends ContentMetadata {
  author?: string;
  narrator?: string;
  chapters?: Chapter[];
  duration?: number;
}

export interface PhotoMetadata extends ContentMetadata {
  photographer?: string;
  location?: string;
  date?: string;
  camera?: string;
  lens?: string;
}

export interface ArtworkMetadata extends ContentMetadata {
  artist?: string;
  medium?: string;
  dimensions?: string;
  artistStatement?: string;
}

export interface BookMetadata extends ContentMetadata {
  author?: string;
  publisher?: string;
  isbn?: string;
  pages?: number;
}

export interface ComicMetadata extends ContentMetadata {
  author?: string;
  artist?: string;
  publisher?: string;
  issue?: number;
  series?: string;
}

export interface AssetMetadata extends ContentMetadata {
  fileSize?: number;
  format?: string;
  version?: string;
}

export interface GameMetadata extends ContentMetadata {
  version?: string;
  platform?: string;
  genre?: string;
  developer?: string;
  publisher?: string;
}

export interface SoftwareMetadata extends ContentMetadata {
  version?: string;
  platform?: string;
  license?: string;
  developer?: string;
}

export interface DatasetMetadata extends ContentMetadata {
  schema?: string;
  records?: number;
  format?: string;
  fileSize?: number;
}

export interface PostMetadata extends ContentMetadata {
  author?: string;
  publishedAt?: string;
  tags?: string[];
}
