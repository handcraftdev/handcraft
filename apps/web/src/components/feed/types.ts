import { ContentEntry, MintConfig } from "@handcraft/sdk";

export type FeedTab = "foryou" | "your-content";

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
}

export interface EnrichedContent extends ContentEntry {
  metadata?: ContentMetadata;
  creatorAddress?: string;
  mintConfig?: MintConfig | null;
}
