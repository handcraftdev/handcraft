"use client";

import { useState, useRef, useCallback, ReactNode } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useContentUpload } from "@/hooks/useUpload";
import { useContentRegistry, ContentType as OnChainContentType } from "@/hooks/useContentRegistry";
import { isUserRejection, getTransactionErrorMessage } from "@/utils/wallet-errors";

const DEFAULT_PLATFORM_WALLET = process.env.NEXT_PUBLIC_PLATFORM_WALLET
  ? new PublicKey(process.env.NEXT_PUBLIC_PLATFORM_WALLET)
  : null;

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

export function UploadModal({ isOpen, onClose, onSuccess }: UploadModalProps) {
  const { publicKey } = useWallet();
  const [step, setStep] = useState<Step>("domain");
  const [selectedDomain, setSelectedDomain] = useState<ContentDomain | null>(null);
  const [contentType, setContentType] = useState<ContentTypeConfig | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // Monetization tab
  const [monetizationTab, setMonetizationTab] = useState<MonetizationTab>("minting");

  // Type-specific metadata state
  const [metadata, setMetadata] = useState<Record<string, string>>({
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

  const { registerContentWithMintAndRent, ecosystemConfig, isLoadingEcosystemConfig, isEcosystemConfigError, refetchEcosystemConfig } = useContentRegistry();

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
      });

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
          const platformWallet = DEFAULT_PLATFORM_WALLET || ecosystemConfig.treasury;

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
    rentFee6h, rentFee1d, rentFee7d,
    uploadResult, publicKey, uploadContent, registerContentWithMintAndRent,
    ecosystemConfig, onSuccess, markComplete, LAMPORTS_PER_SOL,
  ]);

  const handleClose = () => {
    if (session && session.status === "in_progress" && session.uploadedCids.length > 0) {
      markCancelled();
    }

    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setMetadata({ title: "", description: "", tags: "" });
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
        setFile(null);
        setPreview(null);
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

    const InputField = ({ label, field, placeholder, type = "text", required = false }: {
      label: string;
      field: string;
      placeholder?: string;
      type?: string;
      required?: boolean;
    }) => (
      <div>
        <label className="block text-sm font-medium mb-1.5 text-gray-300">
          {label} {required && <span className="text-red-400">*</span>}
        </label>
        <input
          type={type}
          value={metadata[field] || ""}
          onChange={(e) => updateMetadata(field, e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500 text-sm"
        />
      </div>
    );

    const TextAreaField = ({ label, field, placeholder, rows = 3 }: {
      label: string;
      field: string;
      placeholder?: string;
      rows?: number;
    }) => (
      <div>
        <label className="block text-sm font-medium mb-1.5 text-gray-300">{label}</label>
        <textarea
          value={metadata[field] || ""}
          onChange={(e) => updateMetadata(field, e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500 text-sm resize-none"
        />
      </div>
    );

    const commonFields = (
      <>
        <InputField label="Title" field="title" placeholder="Enter title" required />
        <TextAreaField label="Description" field="description" placeholder="Brief description..." rows={2} />
        <InputField label="Tags" field="tags" placeholder="comma, separated, tags" />
      </>
    );

    switch (contentType.key) {
      // Video domain
      case "video":
        return (
          <div className="space-y-3">
            {commonFields}
            <InputField label="Duration" field="duration" placeholder="10:30" />
          </div>
        );

      case "movie":
        return (
          <div className="space-y-3">
            {commonFields}
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Year" field="year" placeholder="2024" />
              <InputField label="Duration" field="duration" placeholder="120 min" />
            </div>
            <InputField label="Director" field="director" placeholder="Director name" />
            <InputField label="Cast" field="cast" placeholder="Actor 1, Actor 2..." />
            <InputField label="Genre" field="genre" placeholder="Action, Drama..." />
          </div>
        );

      case "television":
        return (
          <div className="space-y-3">
            <InputField label="Show Name" field="showName" placeholder="Series title" required />
            <InputField label="Episode Title" field="title" placeholder="Episode title" required />
            <div className="grid grid-cols-3 gap-3">
              <InputField label="Season" field="season" placeholder="1" type="number" />
              <InputField label="Episode" field="episode" placeholder="1" type="number" />
              <InputField label="Year" field="year" placeholder="2024" />
            </div>
            <TextAreaField label="Synopsis" field="description" placeholder="Episode synopsis..." rows={2} />
            <InputField label="Duration" field="duration" placeholder="45 min" />
            <InputField label="Cast" field="cast" placeholder="Actor 1, Actor 2..." />
            <InputField label="Tags" field="tags" placeholder="comma, separated, tags" />
          </div>
        );

      case "musicVideo":
        return (
          <div className="space-y-3">
            <InputField label="Song Title" field="title" placeholder="Song title" required />
            <InputField label="Artist" field="artist" placeholder="Artist name" required />
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Album" field="album" placeholder="Album name" />
              <InputField label="Year" field="year" placeholder="2024" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Genre" field="genre" placeholder="Pop, Rock..." />
              <InputField label="Duration" field="duration" placeholder="3:45" />
            </div>
            <TextAreaField label="Description" field="description" placeholder="About this video..." rows={2} />
            <InputField label="Tags" field="tags" placeholder="comma, separated, tags" />
          </div>
        );

      case "short":
        return (
          <div className="space-y-3">
            {commonFields}
            <InputField label="Duration" field="duration" placeholder="0:30" />
          </div>
        );

      // Audio domain
      case "music":
        return (
          <div className="space-y-3">
            <InputField label="Track Title" field="title" placeholder="Song title" required />
            <InputField label="Artist" field="artist" placeholder="Artist name" required />
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Album" field="album" placeholder="Album name" />
              <InputField label="Duration" field="duration" placeholder="3:45" />
            </div>
            <InputField label="Genre" field="genre" placeholder="Electronic, Jazz..." />
            <TextAreaField label="Description" field="description" placeholder="About this track..." rows={2} />
            <InputField label="Tags" field="tags" placeholder="comma, separated, tags" />
          </div>
        );

      case "podcast":
        return (
          <div className="space-y-3">
            <InputField label="Show Name" field="showName" placeholder="Podcast name" required />
            <InputField label="Episode Title" field="title" placeholder="Episode title" required />
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Episode #" field="episodeNumber" placeholder="42" type="number" />
              <InputField label="Duration" field="duration" placeholder="45:00" />
            </div>
            <InputField label="Host(s)" field="host" placeholder="Host names" />
            <TextAreaField label="Show Notes" field="description" placeholder="Episode description..." rows={3} />
            <InputField label="Tags" field="tags" placeholder="comma, separated, tags" />
          </div>
        );

      case "audiobook":
        return (
          <div className="space-y-3">
            <InputField label="Book Title" field="title" placeholder="Book title" required />
            <InputField label="Author" field="author" placeholder="Author name" required />
            <InputField label="Narrator" field="narrator" placeholder="Narrator name" />
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Chapter" field="chapter" placeholder="Chapter 1" />
              <InputField label="Duration" field="duration" placeholder="8:30:00" />
            </div>
            <TextAreaField label="Description" field="description" placeholder="Book description..." rows={2} />
            <InputField label="Tags" field="tags" placeholder="comma, separated, tags" />
          </div>
        );

      // Image domain
      case "photo":
        return (
          <div className="space-y-3">
            {commonFields}
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Location" field="location" placeholder="City, Country" />
              <InputField label="Date Taken" field="dateTaken" type="date" />
            </div>
            <InputField label="Camera" field="camera" placeholder="Camera model" />
          </div>
        );

      case "artwork":
        return (
          <div className="space-y-3">
            <InputField label="Artwork Title" field="title" placeholder="Title" required />
            <InputField label="Artist" field="artist" placeholder="Your name" />
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Medium" field="medium" placeholder="Digital, 3D..." />
              <InputField label="Dimensions" field="dimensions" placeholder="1920x1080" />
            </div>
            <TextAreaField label="Description" field="description" placeholder="About this artwork..." rows={2} />
            <InputField label="Tags" field="tags" placeholder="comma, separated, tags" />
          </div>
        );

      // Document domain
      case "book":
        return (
          <div className="space-y-3">
            <InputField label="Book Title" field="title" placeholder="Book title" required />
            <InputField label="Author" field="author" placeholder="Author name" required />
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Publisher" field="publisher" placeholder="Publisher" />
              <InputField label="Year" field="year" placeholder="2024" />
            </div>
            <InputField label="ISBN" field="isbn" placeholder="978-..." />
            <TextAreaField label="Description" field="description" placeholder="Book description..." rows={3} />
            <InputField label="Tags" field="tags" placeholder="comma, separated, tags" />
          </div>
        );

      case "comic":
        return (
          <div className="space-y-3">
            <InputField label="Title" field="title" placeholder="Comic title" required />
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Issue #" field="issueNumber" placeholder="1" type="number" />
              <InputField label="Year" field="year" placeholder="2024" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Writer" field="writer" placeholder="Writer name" />
              <InputField label="Artist" field="artist" placeholder="Artist name" />
            </div>
            <InputField label="Publisher" field="publisher" placeholder="Publisher name" />
            <TextAreaField label="Synopsis" field="description" placeholder="Issue synopsis..." rows={2} />
            <InputField label="Tags" field="tags" placeholder="comma, separated, tags" />
          </div>
        );

      // File domain
      case "asset":
        return (
          <div className="space-y-3">
            <InputField label="Asset Name" field="title" placeholder="Asset name" required />
            <InputField label="Format" field="format" placeholder="PSD, AI, Figma..." />
            <InputField label="Category" field="category" placeholder="Template, mockup, icon..." />
            <InputField label="Software" field="software" placeholder="Compatible software" />
            <TextAreaField label="Description" field="description" placeholder="What's included..." rows={2} />
            <InputField label="Tags" field="tags" placeholder="comma, separated, tags" />
          </div>
        );

      case "game":
        return (
          <div className="space-y-3">
            <InputField label="Game Title" field="title" placeholder="Game name" required />
            <InputField label="Platform" field="platform" placeholder="Windows, Mac, Web..." />
            <InputField label="Genre" field="genre" placeholder="Puzzle, RPG, Action..." />
            <InputField label="Version" field="version" placeholder="1.0.0" />
            <TextAreaField label="Description" field="description" placeholder="Game description..." rows={2} />
            <InputField label="Requirements" field="requirements" placeholder="System requirements" />
            <InputField label="Tags" field="tags" placeholder="comma, separated, tags" />
          </div>
        );

      case "software":
        return (
          <div className="space-y-3">
            <InputField label="Software Name" field="title" placeholder="App name" required />
            <InputField label="Platform" field="platform" placeholder="Windows, Mac, Web, Mobile..." />
            <InputField label="Version" field="version" placeholder="1.0.0" />
            <InputField label="License" field="license" placeholder="MIT, Commercial..." />
            <TextAreaField label="Description" field="description" placeholder="What it does..." rows={2} />
            <InputField label="Requirements" field="requirements" placeholder="System requirements" />
            <InputField label="Tags" field="tags" placeholder="comma, separated, tags" />
          </div>
        );

      case "dataset":
        return (
          <div className="space-y-3">
            <InputField label="Dataset Name" field="title" placeholder="Dataset name" required />
            <InputField label="Format" field="format" placeholder="CSV, JSON, SQL..." />
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Size/Rows" field="size" placeholder="10,000 rows" />
              <InputField label="Updated" field="updated" type="date" />
            </div>
            <TextAreaField label="Description" field="description" placeholder="What data is included..." rows={2} />
            <InputField label="Schema" field="schema" placeholder="Brief schema description" />
            <InputField label="Tags" field="tags" placeholder="comma, separated, tags" />
          </div>
        );

      // Text domain
      case "post":
        return (
          <div className="space-y-3">
            <InputField label="Title" field="title" placeholder="Post title" required />
            <InputField label="Author" field="author" placeholder="Your name" />
            <TextAreaField label="Excerpt" field="excerpt" placeholder="Brief summary or teaser..." rows={2} />
            <TextAreaField label="Content Preview" field="description" placeholder="First paragraph or overview..." rows={3} />
            <InputField label="Category" field="category" placeholder="Tech, Finance, Art..." />
            <InputField label="Tags" field="tags" placeholder="comma, separated, tags" />
          </div>
        );

      default:
        return commonFields;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative bg-gray-900 rounded-2xl w-full max-w-xl mx-4 overflow-hidden border border-gray-800 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            {step !== "domain" && step !== "uploading" && step !== "registering" && step !== "done" && (
              <button onClick={goBack} className="p-1 hover:bg-gray-800 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h2 className="text-xl font-semibold">{getStepTitle()}</h2>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-gray-800 rounded-full transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Step: Domain Selection */}
          {step === "domain" && (
            <div className="grid grid-cols-2 gap-3">
              {DOMAINS.map(domain => (
                <button
                  key={domain.key}
                  onClick={() => handleDomainSelect(domain.key)}
                  className="p-5 rounded-xl border border-gray-700 hover:border-primary-500 hover:bg-gray-800/50 transition-all text-left group"
                >
                  <div className="text-gray-400 group-hover:text-primary-400 transition-colors mb-3">
                    {domain.icon}
                  </div>
                  <p className="font-medium text-lg">{domain.label}</p>
                  <p className="text-sm text-gray-500 mt-1">{domain.description}</p>
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
                  className="w-full p-4 rounded-xl border border-gray-700 hover:border-primary-500 hover:bg-gray-800/50 transition-all text-left group flex items-center gap-4"
                >
                  <div className="text-gray-400 group-hover:text-primary-400 transition-colors">
                    {type.icon}
                  </div>
                  <div>
                    <p className="font-medium">{type.label}</p>
                    <p className="text-sm text-gray-500">{type.description}</p>
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
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                  fileSizeError
                    ? "border-red-500 bg-red-500/5"
                    : "border-gray-700 hover:border-primary-500 hover:bg-gray-800/50"
                }`}
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center text-gray-400">
                  {contentType.icon}
                </div>
                <p className="text-lg font-medium mb-2">
                  Drop your {contentType.label.toLowerCase()} here
                </p>
                <p className="text-sm text-gray-500">or click to browse</p>
                <p className="text-xs text-gray-600 mt-2">
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
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
                  {fileSizeError}
                </div>
              )}
            </div>
          )}

          {/* Step: Details */}
          {step === "details" && file && contentType && (
            <div className="space-y-4">
              {/* Preview */}
              <div className="aspect-video bg-gray-800 rounded-lg overflow-hidden">
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
                    <div className="text-center text-gray-400">
                      {contentType.icon}
                      <p className="mt-2 text-sm">{file.name}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* File info */}
              <div className="text-xs text-gray-500 px-1">
                {file.name} • {(file.size / (1024 * 1024)).toFixed(2)} MB
              </div>

              {/* Type-specific metadata form */}
              {renderMetadataForm()}

              {/* Continue button */}
              <button
                onClick={() => setStep("monetization")}
                disabled={!metadata.title?.trim()}
                className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors font-medium"
              >
                Continue to Monetization
              </button>
            </div>
          )}

          {/* Step: Monetization */}
          {step === "monetization" && publicKey && (
            <div className="space-y-4">
              {/* Tabs */}
              <div className="flex border-b border-gray-700">
                <button
                  onClick={() => setMonetizationTab("minting")}
                  className={`flex-1 py-3 text-center font-medium transition-colors relative ${
                    monetizationTab === "minting" ? "text-primary-400" : "text-gray-400 hover:text-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    Content Minting
                  </div>
                  {monetizationTab === "minting" && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />
                  )}
                </button>
                <button
                  onClick={() => setMonetizationTab("renting")}
                  className={`flex-1 py-3 text-center font-medium transition-colors relative ${
                    monetizationTab === "renting" ? "text-amber-400" : "text-gray-400 hover:text-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Rentals
                  </div>
                  {monetizationTab === "renting" && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500" />
                  )}
                </button>
              </div>

              {/* Minting Tab Content */}
              {monetizationTab === "minting" && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-400">
                    Configure how others can mint editions to permanently own your content.
                  </p>

                  <div>
                    <label className="block text-sm font-medium mb-2">Mint Price (SOL)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.001"
                        min="0.001"
                        value={nftPrice}
                        onChange={(e) => setNftPrice(e.target.value)}
                        placeholder="Min 0.001"
                        className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
                      />
                      <span className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400">SOL</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Supply</label>
                    <div className="flex gap-4 mb-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={nftSupplyType === "unlimited"}
                          onChange={() => setNftSupplyType("unlimited")}
                          className="text-primary-500"
                        />
                        <span>Unlimited</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={nftSupplyType === "limited"}
                          onChange={() => setNftSupplyType("limited")}
                          className="text-primary-500"
                        />
                        <span>Limited Edition</span>
                      </label>
                    </div>
                    {nftSupplyType === "limited" && (
                      <input
                        type="number"
                        min="1"
                        value={nftMaxSupply}
                        onChange={(e) => setNftMaxSupply(e.target.value)}
                        placeholder="Max editions (e.g., 100)"
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
                      />
                    )}
                  </div>

                  {/* Visibility Level */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Content Visibility</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { level: 0, label: "Public", desc: "Anyone can view", icon: "🌍" },
                        { level: 1, label: "Subscribers", desc: "Platform subscribers", icon: "🏠" },
                        { level: 2, label: "Members", desc: "Your members", icon: "⭐" },
                        { level: 3, label: "Buyers", desc: "Buyers only", icon: "🔒" },
                      ].map((opt) => (
                        <button
                          key={opt.level}
                          type="button"
                          onClick={() => setVisibilityLevel(opt.level)}
                          className={`p-3 rounded-lg border text-left transition-all ${
                            visibilityLevel === opt.level
                              ? "border-primary-500 bg-primary-500/10"
                              : "border-gray-700 hover:border-gray-600"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span>{opt.icon}</span>
                            <span className="font-medium text-sm">{opt.label}</span>
                          </div>
                          <p className="text-xs text-gray-500">{opt.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Primary Sale Split */}
                    <div className="bg-gray-800 rounded-lg p-4">
                      <p className="text-sm font-medium mb-3">Primary Sale</p>
                      <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">You (Creator)</span>
                          <span className="text-green-400 font-medium">80%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Holders</span>
                          <span className="text-blue-400 font-medium">12%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Platform</span>
                          <span className="text-gray-500">5%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Ecosystem</span>
                          <span className="text-gray-500">3%</span>
                        </div>
                      </div>
                    </div>

                    {/* Secondary Sale Split */}
                    <div className="bg-gray-800 rounded-lg p-4">
                      <p className="text-sm font-medium mb-3">Secondary Sale</p>
                      <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Seller</span>
                          <span className="text-green-400 font-medium">90%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">You (Royalty)</span>
                          <span className="text-purple-400 font-medium">4%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Holders</span>
                          <span className="text-blue-400 font-medium">4%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Platform</span>
                          <span className="text-gray-500">1%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Ecosystem</span>
                          <span className="text-gray-500">1%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Renting Tab Content */}
              {monetizationTab === "renting" && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-400">
                    Set rental prices for each duration tier. Leave empty to disable rentals.
                  </p>

                  <div className="flex items-center gap-4">
                    <label className="w-24 text-sm text-gray-400">6 Hours</label>
                    <div className="flex-1 flex gap-2">
                      <input
                        type="number"
                        step="0.001"
                        min="0.001"
                        value={rentFee6h}
                        onChange={(e) => setRentFee6h(e.target.value)}
                        placeholder="0.01"
                        className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-amber-500"
                      />
                      <span className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400">SOL</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="w-24 text-sm text-gray-400">1 Day</label>
                    <div className="flex-1 flex gap-2">
                      <input
                        type="number"
                        step="0.001"
                        min="0.001"
                        value={rentFee1d}
                        onChange={(e) => setRentFee1d(e.target.value)}
                        placeholder="0.02"
                        className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-amber-500"
                      />
                      <span className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400">SOL</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="w-24 text-sm text-gray-400">7 Days</label>
                    <div className="flex-1 flex gap-2">
                      <input
                        type="number"
                        step="0.001"
                        min="0.001"
                        value={rentFee7d}
                        onChange={(e) => setRentFee7d(e.target.value)}
                        placeholder="0.05"
                        className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-amber-500"
                      />
                      <span className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400">SOL</span>
                    </div>
                  </div>

                  <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-4 text-sm">
                    <p className="text-amber-400 font-medium mb-2">About Rentals</p>
                    <ul className="text-amber-200/80 space-y-1">
                      <li>• Temporary access via non-transferable tokens</li>
                      <li>• Access expires automatically after rental period</li>
                      <li>• Same revenue split as minting (80% to creator)</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Error states */}
              {isLoadingEcosystemConfig && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-sm">
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
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-yellow-400">
                      {isEcosystemConfigError ? "Network error." : "Config not found."}
                    </span>
                    <button
                      onClick={() => refetchEcosystemConfig()}
                      className="px-2 py-1 text-xs bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}

              {/* Rental validation - require all or none */}
              {/* Price validation - free minting not allowed */}
              {nftPrice && parseFloat(nftPrice) < MIN_PRICE_SOL && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
                  Minimum price is {MIN_PRICE_SOL} SOL. Free minting is not allowed.
                </div>
              )}

              {(() => {
                const hasAnyRent = rentFee6h || rentFee1d || rentFee7d;
                const hasAllRent = rentFee6h && rentFee1d && rentFee7d;
                const hasPartialRent = hasAnyRent && !hasAllRent;
                return hasPartialRent ? (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-400">
                    Please set all three rental tiers or leave them all empty.
                  </div>
                ) : null;
              })()}

              {registrationError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
                  {registrationError}
                </div>
              )}

              {uploadResult && !registrationError && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-sm text-green-400">
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
                className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors font-medium"
              >
                {uploadResult ? "Register on Solana" : "Publish Content"}
              </button>
            </div>
          )}

          {/* Non-wallet user */}
          {step === "monetization" && !publicKey && (
            <div className="text-center py-8">
              <p className="text-gray-400 mb-4">Connect your wallet to configure monetization and register on-chain.</p>
              <button
                onClick={handleUpload}
                className="px-6 py-3 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors font-medium"
              >
                Upload to IPFS Only
              </button>
            </div>
          )}

          {/* Step: Uploading/Registering */}
          {(step === "uploading" || step === "registering") && (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4">
                <svg className="animate-spin w-full h-full text-primary-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
              <p className="text-lg font-medium mb-2">
                {step === "uploading" ? "Uploading to IPFS..." : "Registering on Solana..."}
              </p>
              {step === "uploading" && (
                <>
                  <div className="w-full max-w-xs mx-auto bg-gray-800 rounded-full h-2 mb-2">
                    <div className="bg-primary-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="text-sm text-gray-500">{progress}% complete</p>
                </>
              )}
              {step === "registering" && (
                <p className="text-sm text-gray-500">Please confirm the transaction in your wallet</p>
              )}
              {error && <p className="text-red-500 mt-4">{error}</p>}
            </div>
          )}

          {/* Step: Done */}
          {step === "done" && (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-lg font-medium mb-2">Content Published!</p>
              <p className="text-sm text-gray-500 mb-6">
                {publicKey
                  ? "Your content is stored on IPFS and registered on Solana."
                  : "Your content is now stored on IPFS."}
              </p>
              <button
                onClick={handleClose}
                className="px-8 py-3 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors font-medium"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
