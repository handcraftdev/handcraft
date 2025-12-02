// User types
export interface User {
  id: string;
  walletAddress: string;
  username: string | null;
  displayName: string | null;
  avatar: string | null;
  bio: string | null;
  followerCount: number;
  followingCount: number;
  createdAt: Date;
}

// Content types
export type ContentType = "video" | "audio" | "post" | "image";

export interface Content {
  id: string;
  type: ContentType;
  title: string;
  description: string | null;
  creatorId: string;
  creator: User;

  // Media references (IPFS/Arweave CIDs)
  mediaCid: string | null;
  thumbnailCid: string | null;

  // Metadata
  duration: number | null; // in seconds, for video/audio
  tags: string[];

  // Stats
  viewCount: number;
  likeCount: number;
  commentCount: number;
  tipAmount: number; // in lamports

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Community types
export interface Community {
  id: string;
  name: string;
  slug: string;
  description: string;
  avatar: string | null;
  banner: string | null;
  creatorId: string;
  memberCount: number;
  rules: string[];
  tags: string[];
  createdAt: Date;
}

// Comment types
export interface Comment {
  id: string;
  contentId: string;
  authorId: string;
  author: User;
  parentId: string | null;
  text: string;
  likeCount: number;
  replyCount: number;
  createdAt: Date;
}

// Feed types
export type FeedType = "foryou" | "following" | "trending" | "community";

export interface FeedItem {
  content: Content;
  community?: Community;
  isLiked: boolean;
  isBookmarked: boolean;
}

// Token types
export interface TokenBalance {
  craft: number; // $CRAFT token
  usdc: number; // USDC
}

// Tip types
export interface Tip {
  id: string;
  senderId: string;
  receiverId: string;
  contentId: string | null;
  amount: number; // in lamports or token units
  tokenMint: string; // SOL, USDC, or CRAFT
  message: string | null;
  createdAt: Date;
}

// Upload types
export type UploadStatus = "pending" | "uploading" | "processing" | "complete" | "failed";

export interface UploadProgress {
  status: UploadStatus;
  progress: number; // 0-100
  cid: string | null;
  error: string | null;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  cursor: string | null;
  hasMore: boolean;
}
