import { ContentEntry, MintConfig } from "@handcraft/sdk";

export type FeedTab = "foryou" | "your-content";

export interface ContentContext {
  genre?: string;
  category?: string;
  tags?: string[];
  artist?: string;
  album?: string;
  director?: string;
  cast?: string[];
  showName?: string;
  season?: number;
  episode?: number;
  author?: string;
  narrator?: string;
  publisher?: string;
  year?: number;
  duration?: number;
}

export interface BundleReference {
  id?: string;
  position?: number;
}

export interface ContentMetadata {
  name?: string;
  title?: string;
  description?: string;
  tags?: string[];
  contentType?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  createdAt?: string;

  // Content architecture fields
  domain?: string;
  context?: ContentContext;
  bundle?: BundleReference;

  // Legacy flat context fields (for backward compatibility)
  genre?: string;
  artist?: string;
  album?: string;
}

export interface EnrichedContent extends ContentEntry {
  metadata?: ContentMetadata;
  creatorAddress?: string;
  mintConfig?: MintConfig | null;
}
