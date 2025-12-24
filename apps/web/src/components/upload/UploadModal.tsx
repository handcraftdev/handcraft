"use client";

import { useState, useRef, useCallback, ReactNode } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useContentUpload } from "@/hooks/useUpload";
import { useContentRegistry, ContentType as OnChainContentType } from "@/hooks/useContentRegistry";
import { isUserRejection, getTransactionErrorMessage } from "@/utils/wallet-errors";

// Lazy initialization to avoid SSR _bn issues
let _DEFAULT_PLATFORM_WALLET: PublicKey | null | undefined = undefined;
function getDefaultPlatformWallet(): PublicKey | null {
  if (_DEFAULT_PLATFORM_WALLET === undefined) {
    _DEFAULT_PLATFORM_WALLET = process.env.NEXT_PUBLIC_PLATFORM_WALLET
      ? new PublicKey(process.env.NEXT_PUBLIC_PLATFORM_WALLET)
      : null;
  }
  return _DEFAULT_PLATFORM_WALLET;
}

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: {
    content: { cid: string; url: string };
    metadata: { cid: string; url: string } | null;
  }) => void;
}

// Content type keys matching new structure
type ContentTypeKey =
  // Video domain
  | "video"
  | "movie"
  | "television"
  | "musicVideo"
  | "short"
  // Audio domain
  | "music"
  | "podcast"
  | "audiobook"
  // Image domain
  | "photo"
  | "artwork"
  // Document domain
  | "book"
  | "comic"
  // File domain
  | "asset"
  | "game"
  | "software"
  | "dataset"
  // Text domain
  | "post";

type ContentDomain = "video" | "audio" | "image" | "document" | "file" | "text";
type MonetizationTab = "minting" | "renting";
type Step = "domain" | "type" | "file" | "details" | "monetization" | "uploading" | "registering" | "done";

interface ContentTypeConfig {
  key: ContentTypeKey;
  label: string;
  onChainType: OnChainContentType;
  icon: ReactNode;
  description: string;
  accept: string;
  domain: ContentDomain;
}

interface DomainConfig {
  key: ContentDomain;
  label: string;
  icon: ReactNode;
  description: string;
  accept: string;
}

const DOMAINS: DomainConfig[] = [
  {
    key: "video",
    label: "Video",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
    description: "Movies, shows, clips",
    accept: "video/*",
  },
  {
    key: "audio",
    label: "Audio",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    ),
    description: "Music, podcasts, audiobooks",
    accept: "audio/*",
  },
  {
    key: "image",
    label: "Image",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    description: "Photos, artwork, illustrations",
    accept: "image/*",
  },
  {
    key: "document",
    label: "Document",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    description: "Books, comics, PDFs",
    accept: ".pdf,.epub,.cbz,.cbr",
  },
  {
    key: "file",
    label: "File",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
    description: "Assets, software, games, data",
    accept: "*/*",
  },
  {
    key: "text",
    label: "Text",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    description: "Posts, articles, newsletters",
    accept: ".pdf,.md,.txt,.html,text/*",
  },
];

const CONTENT_TYPES: ContentTypeConfig[] = [
  // Video domain
  {
    key: "video",
    label: "Video",
    onChainType: OnChainContentType.Video,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
    description: "General video content",
    accept: "video/*",
    domain: "video",
  },
  {
    key: "movie",
    label: "Movie",
    onChainType: OnChainContentType.Movie,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
      </svg>
    ),
    description: "Feature films, documentaries",
    accept: "video/*",
    domain: "video",
  },
  {
    key: "television",
    label: "Television",
    onChainType: OnChainContentType.Television,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    description: "TV episodes, series content",
    accept: "video/*",
    domain: "video",
  },
  {
    key: "musicVideo",
    label: "Music Video",
    onChainType: OnChainContentType.MusicVideo,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    ),
    description: "Music videos, live performances",
    accept: "video/*",
    domain: "video",
  },
  {
    key: "short",
    label: "Short",
    onChainType: OnChainContentType.Short,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
      </svg>
    ),
    description: "Clips, shorts, reels",
    accept: "video/*",
    domain: "video",
  },
  // Audio domain
  {
    key: "music",
    label: "Music",
    onChainType: OnChainContentType.Music,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    ),
    description: "Songs, tracks, albums",
    accept: "audio/*",
    domain: "audio",
  },
  {
    key: "podcast",
    label: "Podcast",
    onChainType: OnChainContentType.Podcast,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    ),
    description: "Podcast episodes",
    accept: "audio/*",
    domain: "audio",
  },
  {
    key: "audiobook",
    label: "Audiobook",
    onChainType: OnChainContentType.Audiobook,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    description: "Audiobooks, chapters",
    accept: "audio/*",
    domain: "audio",
  },
  // Image domain
  {
    key: "photo",
    label: "Photo",
    onChainType: OnChainContentType.Photo,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    description: "Photography",
    accept: "image/*",
    domain: "image",
  },
  {
    key: "artwork",
    label: "Artwork",
    onChainType: OnChainContentType.Artwork,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    description: "Digital art, illustrations",
    accept: "image/*",
    domain: "image",
  },
  // Document domain
  {
    key: "book",
    label: "Book",
    onChainType: OnChainContentType.Book,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    description: "Ebooks, documents, PDFs",
    accept: ".pdf,.epub,application/pdf",
    domain: "document",
  },
  {
    key: "comic",
    label: "Comic",
    onChainType: OnChainContentType.Comic,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
      </svg>
    ),
    description: "Comics, manga, graphic novels",
    accept: ".pdf,.cbz,.cbr,image/*",
    domain: "document",
  },
  // File domain
  {
    key: "asset",
    label: "Asset",
    onChainType: OnChainContentType.Asset,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
    description: "Templates, mockups, resources",
    accept: "*/*",
    domain: "file",
  },
  {
    key: "game",
    label: "Game",
    onChainType: OnChainContentType.Game,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    description: "Games, interactive content",
    accept: "*/*",
    domain: "file",
  },
  {
    key: "software",
    label: "Software",
    onChainType: OnChainContentType.Software,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
    description: "Apps, plugins, tools",
    accept: "*/*",
    domain: "file",
  },
  {
    key: "dataset",
    label: "Dataset",
    onChainType: OnChainContentType.Dataset,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
      </svg>
    ),
    description: "Data files, CSVs, models",
    accept: ".csv,.json,.xml,.sql,*/*",
    domain: "file",
  },
  // Text domain
  {
    key: "post",
    label: "Post",
    onChainType: OnChainContentType.Post,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    description: "Blog posts, newsletters, articles",
    accept: ".pdf,.md,.txt,.html,text/*",
    domain: "text",
  },
];

function getTypesForDomain(domain: ContentDomain) {
  return CONTENT_TYPES.filter(t => t.domain === domain);
}

// File size limits per domain (in bytes)
const FILE_SIZE_LIMITS: Record<ContentDomain, number> = {
  video: 2 * 1024 * 1024 * 1024, // 2 GB
  audio: 500 * 1024 * 1024, // 500 MB
  image: 50 * 1024 * 1024, // 50 MB
  document: 100 * 1024 * 1024, // 100 MB
  file: 1024 * 1024 * 1024, // 1 GB
  text: 10 * 1024 * 1024, // 10 MB
};

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  }
  return `${(bytes / 1024).toFixed(0)} KB`;
}

// Stable input components - defined outside to prevent re-creation on render
function InputField({ label, field, placeholder, type = "text", required = false, value, onChange }: {
  label: string;
  field: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  value: string;
  onChange: (field: string, value: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5 text-white/70">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(field, e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.07] text-white/90 placeholder:text-white/20 text-sm transition-all duration-300"
      />
    </div>
  );
}

function TextAreaField({ label, field, placeholder, rows = 3, value, onChange }: {
  label: string;
  field: string;
  placeholder?: string;
  rows?: number;
  value: string;
  onChange: (field: string, value: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5 text-white/70">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(field, e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.07] text-white/90 placeholder:text-white/20 text-sm resize-none transition-all duration-300"
      />
    </div>
  );
}

export function UploadModal({ isOpen, onClose, onSuccess }: UploadModalProps) {
  const { publicKey } = useWallet();
  const [step, setStep] = useState<Step>("domain");
  const [selectedDomain, setSelectedDomain] = useState<ContentDomain | null>(null);
  const [contentType, setContentType] = useState<ContentTypeConfig | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);

  // Monetization tab
  const [monetizationTab, setMonetizationTab] = useState<MonetizationTab>("minting");

  // Type-specific metadata state
  const [metadata, setMetadata] = useState<Record<string, string>>({
    collection_name: "",
    title: "",
    description: "",
    tags: "",
  });

  // Minting config
  const [nftPrice, setNftPrice] = useState("");
  const [nftSupplyType, setNftSupplyType] = useState<"unlimited" | "limited">("unlimited");
  const [nftMaxSupply, setNftMaxSupply] = useState("");
  // Royalty is now fixed at 4%
  const FIXED_ROYALTY_PERCENT = 4;
  // Minimum price (0.001 SOL) - free minting is not allowed
  const MIN_PRICE_SOL = 0.001;

  // Visibility level (0=Public, 1=Ecosystem, 2=Subscriber, 3=Edition-only)
  const [visibilityLevel, setVisibilityLevel] = useState<number>(0);

  // Rental config
  const [rentFee6h, setRentFee6h] = useState("");
  const [rentFee1d, setRentFee1d] = useState("");
  const [rentFee7d, setRentFee7d] = useState("");

  // Upload state
  const [uploadResult, setUploadResult] = useState<{
    content: { cid: string; url: string };
    metadata: { cid: string; url: string } | null;
    isEncrypted?: boolean;
    previewCid?: string | null;
    encryptionMetaCid?: string | null;
  } | null>(null);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [fileSizeError, setFileSizeError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  const { registerContentWithMintAndRent, ecosystemConfig, isLoadingEcosystemConfig, isEcosystemConfigError, refetchEcosystemConfig, userProfile, isLoadingUserProfile } = useContentRegistry();

  const LAMPORTS_PER_SOL = 1_000_000_000;

  const {
    isUploading,
    progress,
    error,
    uploadContent,
    reset,
    markComplete,
    markCancelled,
    session,
    resetSession,
  } = useContentUpload({
    onError: (err) => console.error("Upload error:", err),
  });

  const updateMetadata = useCallback((field: string, value: string) => {
    setMetadata(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleDomainSelect = useCallback((domain: ContentDomain) => {
    setSelectedDomain(domain);
    const types = getTypesForDomain(domain);
    // If only one type in domain, skip type selection
    if (types.length === 1) {
      setContentType(types[0]);
      setStep("file");
    } else {
      setStep("type");
    }
  }, []);

  const handleTypeSelect = useCallback((type: ContentTypeConfig) => {
    setContentType(type);
    setStep("file");
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile || !contentType) return;

    // Validate file size
    const maxSize = FILE_SIZE_LIMITS[contentType.domain];
    if (selectedFile.size > maxSize) {
      setFileSizeError(
        `File too large. Maximum size for ${contentType.domain} is ${formatFileSize(maxSize)}. Your file is ${formatFileSize(selectedFile.size)}.`
      );
      return;
    }
    setFileSizeError(null);

    setFile(selectedFile);

    // Create preview
    const url = URL.createObjectURL(selectedFile);
    setPreview(url);

    // Auto-fill title from filename
    const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, "");
    updateMetadata("title", nameWithoutExt);

    setStep("details");
  }, [updateMetadata, contentType]);

  const handleThumbnailSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate it's an image
    if (!selectedFile.type.startsWith("image/")) {
      return;
    }

    // Max 5MB for thumbnail
    if (selectedFile.size > 5 * 1024 * 1024) {
      return;
    }

    setThumbnail(selectedFile);
    const url = URL.createObjectURL(selectedFile);
    setThumbnailPreview(url);
  }, []);

  const handleUpload = useCallback(async () => {
    if (!file || !contentType) return;

    const currentNftPrice = nftPrice;
    const currentNftSupplyType = nftSupplyType;
    const currentNftMaxSupply = nftMaxSupply;
    const currentContentType = contentType.onChainType;
    const currentRentFee6h = rentFee6h;
    const currentRentFee1d = rentFee1d;
    const currentRentFee7d = rentFee7d;
    const currentMetadata = { ...metadata };

    setRegistrationError(null);

    let result = uploadResult;

    if (!result) {
      setStep("uploading");

      // Build full metadata with type-specific fields
      const tags = currentMetadata.tags?.split(",").map((t: string) => t.trim()).filter(Boolean) || [];

      result = await uploadContent(file, {
        // Required
        title: currentMetadata.title || "Untitled",
        // Content Architecture - Layer 1 & 2
        contentType: contentType?.key || undefined,
        contentDomain: contentType?.domain || undefined,
        // Layer 3: Context
        description: currentMetadata.description || "",
        tags,
        genre: currentMetadata.genre || undefined,
        category: currentMetadata.category || undefined,
        // Type-specific context
        artist: currentMetadata.artist || undefined,
        album: currentMetadata.album || undefined,
        director: currentMetadata.director || undefined,
        cast: currentMetadata.cast || undefined,
        showName: currentMetadata.showName || undefined,
        season: currentMetadata.season || undefined,
        episode: currentMetadata.episode || undefined,
        author: currentMetadata.author || undefined,
        narrator: currentMetadata.narrator || undefined,
        publisher: currentMetadata.publisher || undefined,
        year: currentMetadata.year || undefined,
        duration: currentMetadata.duration || undefined,
        // Include any other metadata fields
        ...currentMetadata,
      }, thumbnail || undefined);

      if (result) {
        setUploadResult(result);
      }
    }

    if (result) {
      if (publicKey && result.metadata) {
        setStep("registering");
        try {
          // Parse price - free minting is not allowed
          const priceFloat = parseFloat(currentNftPrice);
          if (isNaN(priceFloat) || priceFloat < MIN_PRICE_SOL) {
            throw new Error(`Price must be at least ${MIN_PRICE_SOL} SOL`);
          }
          const priceValue = BigInt(Math.floor(priceFloat * LAMPORTS_PER_SOL));

          let maxSupplyValue: bigint | null = null;
          if (currentNftSupplyType === "limited" && currentNftMaxSupply) {
            maxSupplyValue = BigInt(parseInt(currentNftMaxSupply));
          }

          const royaltyBps = FIXED_ROYALTY_PERCENT * 100; // 4% = 400 bps

          if (!ecosystemConfig) {
            throw new Error("Ecosystem config not loaded. Please try again.");
          }
          const platformWallet = getDefaultPlatformWallet() || ecosystemConfig.treasury;

          // Build rent fees if provided (all three must be set)
          let rentFees: { rentFee6h: bigint; rentFee1d: bigint; rentFee7d: bigint } | undefined;
          if (currentRentFee6h && currentRentFee1d && currentRentFee7d) {
            rentFees = {
              rentFee6h: BigInt(Math.floor(parseFloat(currentRentFee6h) * LAMPORTS_PER_SOL)),
              rentFee1d: BigInt(Math.floor(parseFloat(currentRentFee1d) * LAMPORTS_PER_SOL)),
              rentFee7d: BigInt(Math.floor(parseFloat(currentRentFee7d) * LAMPORTS_PER_SOL)),
            };
          }

          // Single transaction for content + mint + optional rent
          await registerContentWithMintAndRent({
            contentCid: result.content.cid,
            metadataCid: result.metadata.cid,
            contentType: currentContentType,
            price: priceValue,
            maxSupply: maxSupplyValue,
            creatorRoyaltyBps: royaltyBps,
            platform: platformWallet,
            isEncrypted: result.isEncrypted || false,
            previewCid: result.previewCid || "",
            encryptionMetaCid: result.encryptionMetaCid || "",
            visibilityLevel,
            ...rentFees,
          });

          markComplete();
        } catch (err) {
          console.error("Failed to register on-chain:", err);
          setStep("monetization");

          if (!isUserRejection(err)) {
            setRegistrationError(getTransactionErrorMessage(err));
          }
          return;
        }
      }

      setStep("done");
      onSuccess?.({
        content: result.content,
        metadata: result.metadata,
      });
    }
  }, [
    file, contentType, metadata, nftPrice, nftSupplyType, nftMaxSupply,
    rentFee6h, rentFee1d, rentFee7d, thumbnail,
    uploadResult, publicKey, uploadContent, registerContentWithMintAndRent,
    ecosystemConfig, onSuccess, markComplete, LAMPORTS_PER_SOL,
  ]);

  const handleClose = () => {
    if (session && session.status === "in_progress" && session.uploadedCids.length > 0) {
      markCancelled();
    }

    if (preview) URL.revokeObjectURL(preview);
    if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
    setFile(null);
    setPreview(null);
    setThumbnail(null);
    setThumbnailPreview(null);
    setMetadata({ collection_name: "", title: "", description: "", tags: "" });
    setSelectedDomain(null);
    setContentType(null);
    setStep("domain");
    setMonetizationTab("minting");
    setNftPrice("");
    setNftSupplyType("unlimited");
    setNftMaxSupply("");
    setVisibilityLevel(0);
    setRentFee6h("");
    setRentFee1d("");
    setRentFee7d("");
    setUploadResult(null);
    setRegistrationError(null);
    setFileSizeError(null);
    reset();
    resetSession();
    onClose();
  };

  const goBack = () => {
    switch (step) {
      case "type":
        setStep("domain");
        setSelectedDomain(null);
        break;
      case "file":
        const types = selectedDomain ? getTypesForDomain(selectedDomain) : [];
        if (types.length === 1) {
          // Domain only had one type, go back to domain
          setStep("domain");
          setSelectedDomain(null);
        } else {
          setStep("type");
        }
        setContentType(null);
        break;
      case "details":
        setStep("file");
        if (preview) URL.revokeObjectURL(preview);
        if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
        setFile(null);
        setPreview(null);
        setThumbnail(null);
        setThumbnailPreview(null);
        break;
      case "monetization":
        setStep("details");
        break;
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case "domain": return "What are you uploading?";
      case "type": return `What type of ${selectedDomain}?`;
      case "file": return `Upload ${contentType?.label || ""}`;
      case "details": return `${contentType?.label || ""} Details`;
      case "monetization": return "Monetization";
      case "uploading": return "Uploading...";
      case "registering": return "Registering...";
      case "done": return "Published!";
    }
  };

  // Render type-specific metadata form
  const renderMetadataForm = () => {
    if (!contentType) return null;

    // Helper to create input props
    const inputProps = (field: string) => ({
      value: metadata[field] || "",
      onChange: updateMetadata,
    });

    const commonFields = (
      <>
        <InputField label="Collection Name" field="collection_name" placeholder="e.g., Summer Photos 2024" {...inputProps("collection_name")} />
        <InputField label="Title" field="title" placeholder="Enter title" required {...inputProps("title")} />
        <TextAreaField label="Description" field="description" placeholder="Brief description..." rows={2} {...inputProps("description")} />
        <InputField label="Tags" field="tags" placeholder="comma, separated, tags" {...inputProps("tags")} />
      </>
    );

    switch (contentType.key) {
      // Video domain
      case "video":
        return (
          <div className="space-y-3">
            {commonFields}
            <InputField label="Duration" field="duration" placeholder="10:30" {...inputProps("duration")} />
          </div>
        );

      case "movie":
        return (
          <div className="space-y-3">
            {commonFields}
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Year" field="year" placeholder="2024" {...inputProps("year")} />
              <InputField label="Duration" field="duration" placeholder="120 min" {...inputProps("duration")} />
            </div>
            <InputField label="Director" field="director" placeholder="Director name" {...inputProps("director")} />
            <InputField label="Cast" field="cast" placeholder="Actor 1, Actor 2..." {...inputProps("cast")} />
            <InputField label="Genre" field="genre" placeholder="Action, Drama..." {...inputProps("genre")} />
          </div>
        );

      case "television":
        return (
          <div className="space-y-3">
            <InputField label="Show Name" field="showName" placeholder="Series title" required {...inputProps("showName")} />
            <InputField label="Episode Title" field="title" placeholder="Episode title" required {...inputProps("title")} />
            <div className="grid grid-cols-3 gap-3">
              <InputField label="Season" field="season" placeholder="1" type="number" {...inputProps("season")} />
              <InputField label="Episode" field="episode" placeholder="1" type="number" {...inputProps("episode")} />
              <InputField label="Year" field="year" placeholder="2024" {...inputProps("year")} />
            </div>
            <TextAreaField label="Synopsis" field="description" placeholder="Episode synopsis..." rows={2} {...inputProps("description")} />
            <InputField label="Duration" field="duration" placeholder="45 min" {...inputProps("duration")} />
            <InputField label="Cast" field="cast" placeholder="Actor 1, Actor 2..." {...inputProps("cast")} />
            <InputField label="Tags" field="tags" placeholder="comma, separated, tags" {...inputProps("tags")} />
          </div>
        );

      case "musicVideo":
        return (
          <div className="space-y-3">
            <InputField label="Song Title" field="title" placeholder="Song title" required {...inputProps("title")} />
            <InputField label="Artist" field="artist" placeholder="Artist name" required {...inputProps("artist")} />
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Album" field="album" placeholder="Album name" {...inputProps("album")} />
              <InputField label="Year" field="year" placeholder="2024" {...inputProps("year")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Genre" field="genre" placeholder="Pop, Rock..." {...inputProps("genre")} />
              <InputField label="Duration" field="duration" placeholder="3:45" {...inputProps("duration")} />
            </div>
            <TextAreaField label="Description" field="description" placeholder="About this video..." rows={2} {...inputProps("description")} />
            <InputField label="Tags" field="tags" placeholder="comma, separated, tags" {...inputProps("tags")} />
          </div>
        );

      case "short":
        return (
          <div className="space-y-3">
            {commonFields}
            <InputField label="Duration" field="duration" placeholder="0:30" {...inputProps("duration")} />
          </div>
        );

      // Audio domain
      case "music":
        return (
          <div className="space-y-3">
            <InputField label="Track Title" field="title" placeholder="Song title" required {...inputProps("title")} />
            <InputField label="Artist" field="artist" placeholder="Artist name" required {...inputProps("artist")} />
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Album" field="album" placeholder="Album name" {...inputProps("album")} />
              <InputField label="Duration" field="duration" placeholder="3:45" {...inputProps("duration")} />
            </div>
            <InputField label="Genre" field="genre" placeholder="Electronic, Jazz..." {...inputProps("genre")} />
            <TextAreaField label="Description" field="description" placeholder="About this track..." rows={2} {...inputProps("description")} />
            <InputField label="Tags" field="tags" placeholder="comma, separated, tags" {...inputProps("tags")} />
          </div>
        );

      case "podcast":
        return (
          <div className="space-y-3">
            <InputField label="Show Name" field="showName" placeholder="Podcast name" required {...inputProps("showName")} />
            <InputField label="Episode Title" field="title" placeholder="Episode title" required {...inputProps("title")} />
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Episode #" field="episodeNumber" placeholder="42" type="number" {...inputProps("episodeNumber")} />
              <InputField label="Duration" field="duration" placeholder="45:00" {...inputProps("duration")} />
            </div>
            <InputField label="Host(s)" field="host" placeholder="Host names" {...inputProps("host")} />
            <TextAreaField label="Show Notes" field="description" placeholder="Episode description..." rows={3} {...inputProps("description")} />
            <InputField label="Tags" field="tags" placeholder="comma, separated, tags" {...inputProps("tags")} />
          </div>
        );

      case "audiobook":
        return (
          <div className="space-y-3">
            <InputField label="Book Title" field="title" placeholder="Book title" required {...inputProps("title")} />
            <InputField label="Author" field="author" placeholder="Author name" required {...inputProps("author")} />
            <InputField label="Narrator" field="narrator" placeholder="Narrator name" {...inputProps("narrator")} />
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Chapter" field="chapter" placeholder="Chapter 1" {...inputProps("chapter")} />
              <InputField label="Duration" field="duration" placeholder="8:30:00" {...inputProps("duration")} />
            </div>
            <TextAreaField label="Description" field="description" placeholder="Book description..." rows={2} {...inputProps("description")} />
            <InputField label="Tags" field="tags" placeholder="comma, separated, tags" {...inputProps("tags")} />
          </div>
        );

      // Image domain
      case "photo":
        return (
          <div className="space-y-3">
            {commonFields}
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Location" field="location" placeholder="City, Country" {...inputProps("location")} />
              <InputField label="Date Taken" field="dateTaken" type="date" {...inputProps("dateTaken")} />
            </div>
            <InputField label="Camera" field="camera" placeholder="Camera model" {...inputProps("camera")} />
          </div>
        );

      case "artwork":
        return (
          <div className="space-y-3">
            <InputField label="Artwork Title" field="title" placeholder="Title" required {...inputProps("title")} />
            <InputField label="Artist" field="artist" placeholder="Your name" {...inputProps("artist")} />
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Medium" field="medium" placeholder="Digital, 3D..." {...inputProps("medium")} />
              <InputField label="Dimensions" field="dimensions" placeholder="1920x1080" {...inputProps("dimensions")} />
            </div>
            <TextAreaField label="Description" field="description" placeholder="About this artwork..." rows={2} {...inputProps("description")} />
            <InputField label="Tags" field="tags" placeholder="comma, separated, tags" {...inputProps("tags")} />
          </div>
        );

      // Document domain
      case "book":
        return (
          <div className="space-y-3">
            <InputField label="Book Title" field="title" placeholder="Book title" required {...inputProps("title")} />
            <InputField label="Author" field="author" placeholder="Author name" required {...inputProps("author")} />
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Publisher" field="publisher" placeholder="Publisher" {...inputProps("publisher")} />
              <InputField label="Year" field="year" placeholder="2024" {...inputProps("year")} />
            </div>
            <InputField label="ISBN" field="isbn" placeholder="978-..." {...inputProps("isbn")} />
            <TextAreaField label="Description" field="description" placeholder="Book description..." rows={3} {...inputProps("description")} />
            <InputField label="Tags" field="tags" placeholder="comma, separated, tags" {...inputProps("tags")} />
          </div>
        );

      case "comic":
        return (
          <div className="space-y-3">
            <InputField label="Title" field="title" placeholder="Comic title" required {...inputProps("title")} />
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Issue #" field="issueNumber" placeholder="1" type="number" {...inputProps("issueNumber")} />
              <InputField label="Year" field="year" placeholder="2024" {...inputProps("year")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Writer" field="writer" placeholder="Writer name" {...inputProps("writer")} />
              <InputField label="Artist" field="artist" placeholder="Artist name" {...inputProps("artist")} />
            </div>
            <InputField label="Publisher" field="publisher" placeholder="Publisher name" {...inputProps("publisher")} />
            <TextAreaField label="Synopsis" field="description" placeholder="Issue synopsis..." rows={2} {...inputProps("description")} />
            <InputField label="Tags" field="tags" placeholder="comma, separated, tags" {...inputProps("tags")} />
          </div>
        );

      // File domain
      case "asset":
        return (
          <div className="space-y-3">
            <InputField label="Asset Name" field="title" placeholder="Asset name" required {...inputProps("title")} />
            <InputField label="Format" field="format" placeholder="PSD, AI, Figma..." {...inputProps("format")} />
            <InputField label="Category" field="category" placeholder="Template, mockup, icon..." {...inputProps("category")} />
            <InputField label="Software" field="software" placeholder="Compatible software" {...inputProps("software")} />
            <TextAreaField label="Description" field="description" placeholder="What's included..." rows={2} {...inputProps("description")} />
            <InputField label="Tags" field="tags" placeholder="comma, separated, tags" {...inputProps("tags")} />
          </div>
        );

      case "game":
        return (
          <div className="space-y-3">
            <InputField label="Game Title" field="title" placeholder="Game name" required {...inputProps("title")} />
            <InputField label="Platform" field="platform" placeholder="Windows, Mac, Web..." {...inputProps("platform")} />
            <InputField label="Genre" field="genre" placeholder="Puzzle, RPG, Action..." {...inputProps("genre")} />
            <InputField label="Version" field="version" placeholder="1.0.0" {...inputProps("version")} />
            <TextAreaField label="Description" field="description" placeholder="Game description..." rows={2} {...inputProps("description")} />
            <InputField label="Requirements" field="requirements" placeholder="System requirements" {...inputProps("requirements")} />
            <InputField label="Tags" field="tags" placeholder="comma, separated, tags" {...inputProps("tags")} />
          </div>
        );

      case "software":
        return (
          <div className="space-y-3">
            <InputField label="Software Name" field="title" placeholder="App name" required {...inputProps("title")} />
            <InputField label="Platform" field="platform" placeholder="Windows, Mac, Web, Mobile..." {...inputProps("platform")} />
            <InputField label="Version" field="version" placeholder="1.0.0" {...inputProps("version")} />
            <InputField label="License" field="license" placeholder="MIT, Commercial..." {...inputProps("license")} />
            <TextAreaField label="Description" field="description" placeholder="What it does..." rows={2} {...inputProps("description")} />
            <InputField label="Requirements" field="requirements" placeholder="System requirements" {...inputProps("requirements")} />
            <InputField label="Tags" field="tags" placeholder="comma, separated, tags" {...inputProps("tags")} />
          </div>
        );

      case "dataset":
        return (
          <div className="space-y-3">
            <InputField label="Dataset Name" field="title" placeholder="Dataset name" required {...inputProps("title")} />
            <InputField label="Format" field="format" placeholder="CSV, JSON, SQL..." {...inputProps("format")} />
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Size/Rows" field="size" placeholder="10,000 rows" {...inputProps("size")} />
              <InputField label="Updated" field="updated" type="date" {...inputProps("updated")} />
            </div>
            <TextAreaField label="Description" field="description" placeholder="What data is included..." rows={2} {...inputProps("description")} />
            <InputField label="Schema" field="schema" placeholder="Brief schema description" {...inputProps("schema")} />
            <InputField label="Tags" field="tags" placeholder="comma, separated, tags" {...inputProps("tags")} />
          </div>
        );

      // Text domain
      case "post":
        return (
          <div className="space-y-3">
            <InputField label="Title" field="title" placeholder="Post title" required {...inputProps("title")} />
            <InputField label="Author" field="author" placeholder="Your name" {...inputProps("author")} />
            <TextAreaField label="Excerpt" field="excerpt" placeholder="Brief summary or teaser..." rows={2} {...inputProps("excerpt")} />
            <TextAreaField label="Content Preview" field="description" placeholder="First paragraph or overview..." rows={3} {...inputProps("description")} />
            <InputField label="Category" field="category" placeholder="Tech, Finance, Art..." {...inputProps("category")} />
            <InputField label="Tags" field="tags" placeholder="comma, separated, tags" {...inputProps("tags")} />
          </div>
        );

      default:
        return commonFields;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative bg-black rounded-2xl w-full max-w-xl mx-4 overflow-hidden border border-white/10 max-h-[90vh] flex flex-col">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none" />

        {/* Header */}
        <div className="relative flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            {step !== "domain" && step !== "uploading" && step !== "registering" && step !== "done" && (
              <button onClick={goBack} className="p-1.5 hover:bg-white/5 rounded-xl transition-colors text-white/50 hover:text-white/90">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h2 className="text-xl font-medium text-white/90">{getStepTitle()}</h2>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-white/5 rounded-xl transition-colors text-white/50 hover:text-white/90">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Profile Gate */}
        {!isLoadingUserProfile && !userProfile && publicKey && (
          <div className="relative p-6 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-medium text-white/90 mb-2">Creator Profile Required</h3>
            <p className="text-white/40 mb-6 max-w-sm">
              Set up your creator profile before uploading content. Your username will appear on your NFT collections as "HC: YourName".
            </p>
            <a
              href="/studio"
              className="px-6 py-3 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 hover:border-purple-500/50 rounded-xl font-medium transition-all duration-300 inline-flex items-center gap-2 text-white/90"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Go to Studio
            </a>
          </div>
        )}

        {/* Content - only show when profile exists */}
        {(userProfile || isLoadingUserProfile || !publicKey) && (
        <div className="relative p-6 overflow-y-auto flex-1">
          {/* Step: Domain Selection */}
          {step === "domain" && (
            <div className="grid grid-cols-2 gap-3">
              {DOMAINS.map(domain => (
                <button
                  key={domain.key}
                  onClick={() => handleDomainSelect(domain.key)}
                  className="relative p-5 rounded-xl border border-white/10 hover:border-purple-500/30 bg-white/[0.02] hover:bg-white/5 transition-all duration-300 text-left group overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-transparent group-hover:from-purple-500/5 transition-all duration-300 pointer-events-none" />
                  <div className="relative">
                    <div className="text-white/40 group-hover:text-purple-400 transition-colors mb-3">
                      {domain.icon}
                    </div>
                    <p className="font-medium text-lg text-white/90">{domain.label}</p>
                    <p className="text-sm text-white/40 mt-1">{domain.description}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Step: Type Selection */}
          {step === "type" && selectedDomain && (
            <div className="space-y-3">
              {getTypesForDomain(selectedDomain).map(type => (
                <button
                  key={type.key}
                  onClick={() => handleTypeSelect(type)}
                  className="relative w-full p-4 rounded-xl border border-white/10 hover:border-purple-500/30 bg-white/[0.02] hover:bg-white/5 transition-all duration-300 text-left group flex items-center gap-4 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-transparent group-hover:from-purple-500/5 transition-all duration-300 pointer-events-none" />
                  <div className="relative text-white/40 group-hover:text-purple-400 transition-colors">
                    {type.icon}
                  </div>
                  <div className="relative">
                    <p className="font-medium text-white/90">{type.label}</p>
                    <p className="text-sm text-white/40">{type.description}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Step: File Upload */}
          {step === "file" && contentType && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-300 ${
                  fileSizeError
                    ? "border-red-500/50 bg-red-500/5"
                    : "border-white/10 hover:border-purple-500/30 bg-white/[0.02] hover:bg-white/5"
                }`}
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center text-white/40">
                  {contentType.icon}
                </div>
                <p className="text-lg font-medium text-white/90 mb-2">
                  Drop your {contentType.label.toLowerCase()} here
                </p>
                <p className="text-sm text-white/40">or click to browse</p>
                <p className="text-xs text-white/30 mt-2">
                  Max size: {formatFileSize(FILE_SIZE_LIMITS[contentType.domain])}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={contentType.accept}
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
              {fileSizeError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">
                  {fileSizeError}
                </div>
              )}
            </div>
          )}

          {/* Step: Details */}
          {step === "details" && file && contentType && (
            <div className="space-y-4">
              {/* Preview */}
              <div className="aspect-video bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                {contentType.domain === "video" && preview && (
                  <video src={preview} className="w-full h-full object-contain" controls />
                )}
                {contentType.domain === "audio" && preview && (
                  <div className="w-full h-full flex items-center justify-center">
                    <audio src={preview} controls className="w-full max-w-md" />
                  </div>
                )}
                {contentType.domain === "image" && preview && (
                  <img src={preview} alt="Preview" className="w-full h-full object-contain" />
                )}
                {(contentType.domain === "document" || contentType.domain === "file" || contentType.domain === "text") && (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center text-white/40">
                      {contentType.icon}
                      <p className="mt-2 text-sm">{file.name}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* File info */}
              <div className="text-xs text-white/30 px-1">
                {file.name} • {(file.size / (1024 * 1024)).toFixed(2)} MB
              </div>

              {/* Thumbnail Upload - Mandatory */}
              <div>
                <label className="block text-sm font-medium mb-1.5 text-white/70">
                  Thumbnail <span className="text-red-400">*</span>
                </label>
                <div
                  onClick={() => thumbnailInputRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-xl p-4 cursor-pointer transition-all duration-300 ${
                    thumbnail
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-white/10 hover:border-purple-500/30 bg-white/[0.02] hover:bg-white/5"
                  }`}
                >
                  {thumbnailPreview ? (
                    <div className="flex items-center gap-4">
                      <img
                        src={thumbnailPreview}
                        alt="Thumbnail"
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white/70 truncate">{thumbnail?.name}</p>
                        <p className="text-xs text-white/30">
                          {thumbnail ? (thumbnail.size / 1024).toFixed(0) : 0} KB
                        </p>
                        <p className="text-xs text-emerald-400 mt-1">Click to change</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 rounded-lg bg-white/5 flex items-center justify-center text-white/20">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-white/70">Upload thumbnail image</p>
                        <p className="text-xs text-white/30">Required • Max 5MB • JPG, PNG, WebP</p>
                      </div>
                    </div>
                  )}
                  <input
                    ref={thumbnailInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleThumbnailSelect}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Type-specific metadata form */}
              {renderMetadataForm()}

              {/* Continue button */}
              <button
                onClick={() => setStep("monetization")}
                disabled={!metadata.title?.trim() || !thumbnail}
                className="w-full py-3 bg-purple-500/20 hover:bg-purple-500/30 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl font-medium transition-all duration-300 border border-purple-500/30 hover:border-purple-500/50 text-white/90"
              >
                {!thumbnail ? "Add Thumbnail to Continue" : "Continue to Monetization"}
              </button>
            </div>
          )}

          {/* Step: Monetization */}
          {step === "monetization" && publicKey && (
            <div className="space-y-4">
              {/* Tabs */}
              <div className="flex gap-1 p-1 bg-white/[0.02] rounded-xl border border-white/5">
                <button
                  onClick={() => setMonetizationTab("minting")}
                  className={`flex-1 py-2.5 text-center text-sm font-medium rounded-lg transition-all duration-300 ${
                    monetizationTab === "minting"
                      ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                      : "text-white/40 hover:text-white/60 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    Buying
                  </div>
                </button>
                <button
                  onClick={() => setMonetizationTab("renting")}
                  className={`flex-1 py-2.5 text-center text-sm font-medium rounded-lg transition-all duration-300 ${
                    monetizationTab === "renting"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "text-white/40 hover:text-white/60 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Rentals
                  </div>
                </button>
              </div>

              {/* Buying Tab Content */}
              {monetizationTab === "minting" && (
                <div className="space-y-4">
                  <p className="text-sm text-white/40">
                    Configure how others can buy editions to permanently own your content.
                  </p>

                  <div>
                    <label className="block text-[11px] uppercase tracking-[0.2em] text-white/30 mb-2">Buy Price (SOL)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.001"
                        min="0.001"
                        value={nftPrice}
                        onChange={(e) => setNftPrice(e.target.value)}
                        placeholder="Min 0.001"
                        className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.07] text-white/90 placeholder:text-white/20 transition-all duration-300"
                      />
                      <span className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white/40">SOL</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] uppercase tracking-[0.2em] text-white/30 mb-3">Supply</label>
                    <div className="flex gap-3 mb-3">
                      <button
                        type="button"
                        onClick={() => setNftSupplyType("unlimited")}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300 text-sm ${
                          nftSupplyType === "unlimited"
                            ? "bg-purple-500/20 border border-purple-500/50 text-purple-300"
                            : "bg-white/[0.02] border border-white/10 text-white/50 hover:bg-white/5"
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          nftSupplyType === "unlimited" ? "border-purple-400" : "border-white/30"
                        }`}>
                          {nftSupplyType === "unlimited" && <div className="w-2 h-2 rounded-full bg-purple-400" />}
                        </div>
                        Unlimited
                      </button>
                      <button
                        type="button"
                        onClick={() => setNftSupplyType("limited")}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300 text-sm ${
                          nftSupplyType === "limited"
                            ? "bg-purple-500/20 border border-purple-500/50 text-purple-300"
                            : "bg-white/[0.02] border border-white/10 text-white/50 hover:bg-white/5"
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          nftSupplyType === "limited" ? "border-purple-400" : "border-white/30"
                        }`}>
                          {nftSupplyType === "limited" && <div className="w-2 h-2 rounded-full bg-purple-400" />}
                        </div>
                        Limited
                      </button>
                    </div>
                    {nftSupplyType === "limited" && (
                      <input
                        type="number"
                        min="1"
                        max="999999"
                        value={nftMaxSupply}
                        onChange={(e) => setNftMaxSupply(e.target.value)}
                        placeholder="Max supply (max 999,999)"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.07] text-white/90 placeholder:text-white/20 transition-all duration-300"
                      />
                    )}
                  </div>

                  {/* Visibility Level */}
                  <div>
                    <label className="block text-[11px] uppercase tracking-[0.2em] text-white/30 mb-3">Content Visibility</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { level: 0, label: "Public", desc: "Anyone can view", icon: "🌍" },
                        { level: 1, label: "Subscriber Only", desc: "Platform subscribers", icon: "🏠" },
                        { level: 2, label: "Members Only", desc: "Your members", icon: "⭐" },
                        { level: 3, label: "Buy/Rent Only", desc: "Buyers & renters", icon: "🔒" },
                      ].map((opt) => (
                        <button
                          key={opt.level}
                          type="button"
                          onClick={() => setVisibilityLevel(opt.level)}
                          className={`p-3 rounded-xl border text-left transition-all duration-300 ${
                            visibilityLevel === opt.level
                              ? "border-purple-500/50 bg-purple-500/10"
                              : "border-white/10 hover:border-white/20 bg-white/[0.02] hover:bg-white/5"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span>{opt.icon}</span>
                            <span className="font-medium text-sm text-white/80">{opt.label}</span>
                          </div>
                          <p className="text-xs text-white/30">{opt.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Primary Sale Split */}
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                      <p className="text-[11px] uppercase tracking-[0.15em] text-white/30 mb-3">Primary Sale</p>
                      <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-white/40">You (Creator)</span>
                          <span className="text-emerald-400 font-medium">80%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/40">Holders</span>
                          <span className="text-blue-400 font-medium">12%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/30">Platform</span>
                          <span className="text-white/30">5%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/30">Ecosystem</span>
                          <span className="text-white/30">3%</span>
                        </div>
                      </div>
                    </div>

                    {/* Secondary Sale Split */}
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                      <p className="text-[11px] uppercase tracking-[0.15em] text-white/30 mb-3">Secondary Sale</p>
                      <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-white/40">Seller</span>
                          <span className="text-emerald-400 font-medium">90%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/40">You (Royalty)</span>
                          <span className="text-purple-400 font-medium">4%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/40">Holders</span>
                          <span className="text-blue-400 font-medium">4%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/30">Platform</span>
                          <span className="text-white/30">1%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/30">Ecosystem</span>
                          <span className="text-white/30">1%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Renting Tab Content */}
              {monetizationTab === "renting" && (
                <div className="space-y-4">
                  <p className="text-sm text-white/40">
                    Set rental prices for each duration tier. Leave empty to disable rentals.
                  </p>

                  <div>
                    <label className="block text-[11px] uppercase tracking-[0.2em] text-white/30 mb-3">Rental Pricing (SOL)</label>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-white/40 mb-2">6 Hours</label>
                        <input
                          type="number"
                          step="0.001"
                          min="0.001"
                          value={rentFee6h}
                          onChange={(e) => setRentFee6h(e.target.value)}
                          placeholder="0.01"
                          className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-amber-500/50 focus:bg-white/[0.07] text-white/90 placeholder:text-white/20 transition-all duration-300 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-white/40 mb-2">1 Day</label>
                        <input
                          type="number"
                          step="0.001"
                          min="0.001"
                          value={rentFee1d}
                          onChange={(e) => setRentFee1d(e.target.value)}
                          placeholder="0.02"
                          className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-amber-500/50 focus:bg-white/[0.07] text-white/90 placeholder:text-white/20 transition-all duration-300 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-white/40 mb-2">7 Days</label>
                        <input
                          type="number"
                          step="0.001"
                          min="0.001"
                          value={rentFee7d}
                          onChange={(e) => setRentFee7d(e.target.value)}
                          placeholder="0.05"
                          className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-amber-500/50 focus:bg-white/[0.07] text-white/90 placeholder:text-white/20 transition-all duration-300 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm">
                    <p className="text-amber-400 font-medium mb-2">About Rentals</p>
                    <ul className="text-amber-200/70 space-y-1">
                      <li>• Temporary access via non-transferable tokens</li>
                      <li>• Access expires automatically after rental period</li>
                      <li>• Same revenue split as minting (80% to creator)</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Error states */}
              {isLoadingEcosystemConfig && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-sm">
                  <div className="flex items-center gap-2 text-blue-400">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Loading blockchain configuration...</span>
                  </div>
                </div>
              )}

              {!isLoadingEcosystemConfig && !ecosystemConfig && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-amber-400">
                      {isEcosystemConfigError ? "Network error." : "Config not found."}
                    </span>
                    <button
                      onClick={() => refetchEcosystemConfig()}
                      className="px-3 py-1.5 text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg transition-all duration-300"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}

              {/* Rental validation - require all or none */}
              {/* Price validation - free minting not allowed */}
              {nftPrice && parseFloat(nftPrice) < MIN_PRICE_SOL && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-400">
                  Minimum price is {MIN_PRICE_SOL} SOL. Free minting is not allowed.
                </div>
              )}

              {(() => {
                const hasAnyRent = rentFee6h || rentFee1d || rentFee7d;
                const hasAllRent = rentFee6h && rentFee1d && rentFee7d;
                const hasPartialRent = hasAnyRent && !hasAllRent;
                return hasPartialRent ? (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-sm text-amber-400">
                    Please set all three rental tiers or leave them all empty.
                  </div>
                ) : null;
              })()}

              {registrationError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-400">
                  {registrationError}
                </div>
              )}

              {uploadResult && !registrationError && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-sm text-emerald-400">
                  File uploaded to IPFS. Click below to register on-chain.
                </div>
              )}

              <button
                onClick={handleUpload}
                disabled={
                  isLoadingEcosystemConfig ||
                  !ecosystemConfig ||
                  // Disable if price is too low (free minting not allowed)
                  !nftPrice ||
                  parseFloat(nftPrice) < MIN_PRICE_SOL ||
                  // Disable if partial rental fees (require all or none)
                  Boolean((rentFee6h || rentFee1d || rentFee7d) && !(rentFee6h && rentFee1d && rentFee7d))
                }
                className="w-full py-3 bg-purple-500/20 hover:bg-purple-500/30 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl font-medium transition-all duration-300 border border-purple-500/30 hover:border-purple-500/50 text-white/90"
              >
                {uploadResult ? "Register on Solana" : "Publish Content"}
              </button>
            </div>
          )}

          {/* Non-wallet user */}
          {step === "monetization" && !publicKey && (
            <div className="text-center py-8">
              <p className="text-white/40 mb-4">Connect your wallet to configure monetization and register on-chain.</p>
              <button
                onClick={handleUpload}
                className="px-6 py-3 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 hover:border-purple-500/50 rounded-xl transition-all duration-300 font-medium text-white/90"
              >
                Upload to IPFS Only
              </button>
            </div>
          )}

          {/* Step: Uploading/Registering */}
          {(step === "uploading" || step === "registering") && (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4">
                <svg className="animate-spin w-full h-full text-purple-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
              <p className="text-lg font-medium mb-2 text-white/90">
                {step === "uploading" ? "Uploading to IPFS..." : "Registering on Solana..."}
              </p>
              {step === "uploading" && (
                <>
                  <div className="w-full max-w-xs mx-auto bg-white/10 rounded-full h-2 mb-2">
                    <div className="bg-purple-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="text-sm text-white/30">{progress}% complete</p>
                </>
              )}
              {step === "registering" && (
                <p className="text-sm text-white/30">Please confirm the transaction in your wallet</p>
              )}
              {error && <p className="text-red-400 mt-4">{error}</p>}
            </div>
          )}

          {/* Step: Done */}
          {step === "done" && (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-lg font-medium mb-2 text-white/90">Content Published!</p>
              <p className="text-sm text-white/30 mb-6">
                {publicKey
                  ? "Your content is stored on IPFS and registered on Solana."
                  : "Your content is now stored on IPFS."}
              </p>
              <button
                onClick={handleClose}
                className="px-8 py-3 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 hover:border-purple-500/50 rounded-xl transition-all duration-300 font-medium text-white/90"
              >
                Done
              </button>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
