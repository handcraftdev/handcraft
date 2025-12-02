export interface IPFSUploadResult {
  cid: string;
  size: number;
  name: string;
  url: string;
}

export interface IPFSUploadOptions {
  name?: string;
  onProgress?: (progress: number) => void;
}

export interface IPFSPinOptions {
  name?: string;
  keyvalues?: Record<string, string>;
}

export interface IPFSClientConfig {
  apiKey: string;
  apiSecret: string;
  gateway?: string;
}

export type ContentType = "video" | "audio" | "image" | "json" | "other";

export interface ContentMetadata {
  name: string;
  description?: string;
  contentType: ContentType;
  mimeType: string;
  size: number;
  duration?: number; // for video/audio in seconds
  width?: number; // for video/image
  height?: number; // for video/image
  creator?: string; // wallet address
  tags?: string[];
  createdAt: string;
}
