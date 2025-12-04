"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useContentRegistry, ContentType, MintConfig } from "@/hooks/useContentRegistry";
import { useSession } from "@/hooks/useSession";
import { getIpfsUrl, ContentEntry, getContentCategory, getContentTypeLabel as sdkGetContentTypeLabel } from "@handcraft/sdk";
import { MintConfigModal, BuyNftModal } from "@/components/mint";
import { EditContentModal, DeleteContentModal } from "@/components/content";
import { ClaimRewardsModal } from "@/components/claim";

// Global cache for decrypted content URLs (persists across component re-renders)
// Key: `${walletAddress}:${contentCid}`, Value: blob URL
const decryptedContentCache = new Map<string, string>();

function getCachedDecryptedUrl(wallet: string, contentCid: string): string | null {
  return decryptedContentCache.get(`${wallet}:${contentCid}`) || null;
}

function setCachedDecryptedUrl(wallet: string, contentCid: string, url: string): void {
  decryptedContentCache.set(`${wallet}:${contentCid}`, url);
}

type FeedTab = "foryou" | "your-content";

interface ContentMetadata {
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

interface EnrichedContent extends ContentEntry {
  metadata?: ContentMetadata;
  creatorAddress?: string;
  mintConfig?: MintConfig | null;
}

export function Feed() {
  const [activeTab, setActiveTab] = useState<FeedTab>("foryou");
  const { publicKey, connected } = useWallet();
  const { content: userContent, globalContent: rawGlobalContent, client } = useContentRegistry();
  const { isValid: hasValidSession, isCreating: isCreatingSession, createSession, needsSession } = useSession();

  // Global feed state
  const [globalContent, setGlobalContent] = useState<EnrichedContent[]>([]);
  const [isLoadingGlobal, setIsLoadingGlobal] = useState(true);

  // User content state
  const [enrichedUserContent, setEnrichedUserContent] = useState<EnrichedContent[]>([]);
  const [isLoadingUser, setIsLoadingUser] = useState(false);

  const lastUserFetchRef = useRef<string>("");
  const hasFetchedGlobal = useRef(false);

  // Fetch global content on mount
  useEffect(() => {
    if (hasFetchedGlobal.current) return;
    hasFetchedGlobal.current = true;

    async function fetchGlobalFeed() {
      setIsLoadingGlobal(true);
      try {
        // Fetch all content
        const allContent = await client.fetchGlobalContent();

        // Enrich with metadata
        const enriched = await Promise.all(
          allContent.map(async (item) => {
            const creatorAddress = item.creator.toBase58();
            try {
              const metadataUrl = getIpfsUrl(item.metadataCid);
              const res = await fetch(metadataUrl);
              const metadata = await res.json();
              return {
                ...item,
                metadata,
                creatorAddress,
              };
            } catch {
              return {
                ...item,
                creatorAddress,
              };
            }
          })
        );

        setGlobalContent(enriched);
      } catch (err) {
        console.error("Error fetching global feed:", err);
      } finally {
        setIsLoadingGlobal(false);
      }
    }

    fetchGlobalFeed();
  }, [client]);

  // Fetch user's content metadata
  useEffect(() => {
    const contentKey = userContent.map(c => c.contentCid).join(",");
    if (contentKey === lastUserFetchRef.current) return;
    lastUserFetchRef.current = contentKey;

    async function fetchUserMetadata() {
      if (!userContent.length) {
        setEnrichedUserContent([]);
        return;
      }

      setIsLoadingUser(true);
      const creatorAddress = publicKey?.toBase58() || "Unknown";
      const enriched = await Promise.all(
        userContent.map(async (item) => {
          try {
            const metadataUrl = getIpfsUrl(item.metadataCid);
            const res = await fetch(metadataUrl);
            const metadata = await res.json();
            return {
              ...item,
              metadata,
              creatorAddress,
            };
          } catch {
            return {
              ...item,
              creatorAddress,
            };
          }
        })
      );
      setEnrichedUserContent(enriched.reverse());
      setIsLoadingUser(false);
    }

    fetchUserMetadata();
  }, [userContent, publicKey]);

  const isLoading = activeTab === "foryou" ? isLoadingGlobal : isLoadingUser;
  const displayContent = activeTab === "foryou" ? globalContent : enrichedUserContent;

  return (
    <div className="pt-16 pb-20">
      {/* Session Required Banner - Show when wallet connected but no valid session */}
      {needsSession && (
        <div className="sticky top-16 z-50 bg-amber-900/90 backdrop-blur-md border-b border-amber-700">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span className="text-amber-100 text-sm">
                Sign to verify your wallet and access your content
              </span>
            </div>
            <button
              onClick={() => createSession()}
              disabled={isCreatingSession}
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-600 text-black font-medium rounded-full text-sm transition-colors flex items-center gap-2"
            >
              {isCreatingSession ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Signing...
                </>
              ) : (
                "Sign to Verify"
              )}
            </button>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="sticky top-16 z-40 bg-black/90 backdrop-blur-md border-b border-gray-800" style={{ top: needsSession ? '116px' : '64px' }}>
        <div className="flex gap-1 px-4 py-2">
          <button
            onClick={() => setActiveTab("foryou")}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeTab === "foryou"
                ? "bg-white text-black"
                : "text-gray-400 hover:bg-gray-900 hover:text-white"
            }`}
          >
            For You
          </button>
          {publicKey && (
            <button
              onClick={() => setActiveTab("your-content")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === "your-content"
                  ? "bg-white text-black"
                  : "text-gray-400 hover:bg-gray-900 hover:text-white"
              }`}
            >
              Your Content
            </button>
          )}
        </div>
      </div>

      {/* Feed Content */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {isLoading ? (
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-900 rounded-xl p-4 animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gray-800 rounded-full" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-800 rounded w-24 mb-2" />
                    <div className="h-3 bg-gray-800 rounded w-16" />
                  </div>
                </div>
                <div className="aspect-video bg-gray-800 rounded-lg" />
              </div>
            ))}
          </div>
        ) : displayContent.length > 0 ? (
          displayContent.map((item) => (
            <ContentCard key={item.contentCid} content={item} />
          ))
        ) : (
          <EmptyState showExplore={activeTab === "foryou"} />
        )}
      </div>
    </div>
  );
}

function ContentCard({ content }: { content: EnrichedContent }) {
  const [showMintConfigModal, setShowMintConfigModal] = useState(false);
  const [showBuyNftModal, setShowBuyNftModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [decryptedUrl, setDecryptedUrl] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const { publicKey } = useWallet();
  const { token: sessionToken, createSession, isCreating: isCreatingSession } = useSession();
  const { useMintConfig, useNftOwnership, getPendingRewardForContent, pendingRewardsQuery, ecosystemConfig } = useContentRegistry();

  const { data: mintConfig, refetch: refetchMintConfig } = useMintConfig(content.contentCid);
  const { data: ownedNftCount = 0, refetch: refetchOwnership } = useNftOwnership(content.contentCid);

  // Get pending reward for this content (per-content pool model)
  const pendingReward = getPendingRewardForContent(content.contentCid);
  const refetchPending = pendingRewardsQuery.refetch;

  // User owns NFT if count > 0
  const ownsNft = ownedNftCount > 0;

  // Get total pending rewards for this content
  const totalPendingRewards = pendingReward?.pending || BigInt(0);
  const hasPendingRewards = pendingReward && totalPendingRewards > BigInt(0);

  // Determine content URL based on encryption and access
  // Use strict boolean check - content is encrypted only if explicitly true
  const isEncrypted = content.isEncrypted === true;
  const previewUrl = content.previewCid ? getIpfsUrl(content.previewCid) : null;
  const fullContentUrl = getIpfsUrl(content.contentCid);
  const contentTypeLabel = getContentTypeLabel(content.contentType);
  const timeAgo = getTimeAgo(Number(content.createdAt) * 1000);
  const shortAddress = content.creatorAddress
    ? `${content.creatorAddress.slice(0, 4)}...${content.creatorAddress.slice(-4)}`
    : "Unknown";

  // Check if current user is the creator
  const isCreator = publicKey?.toBase58() === content.creatorAddress;
  const hasMintConfig = mintConfig && mintConfig.isActive;
  // Content is locked if NFTs have been minted - use mintedCount from content entry
  const actualMintedCount = Number(content.mintedCount ?? 0);
  const isLocked = content.isLocked || actualMintedCount > 0;
  const canEdit = isCreator && !isLocked;
  const canDelete = isCreator && !isLocked;

  // For encrypted content, only show full content if decrypted
  // Creators and NFT owners need a valid session to decrypt
  const contentUrl = !isEncrypted
    ? fullContentUrl
    : decryptedUrl || previewUrl || null;

  // Show locked overlay for non-owners without access
  const showLockedOverlay = isEncrypted && !isCreator && hasAccess !== true && !ownsNft;

  // Show "needs session" state for creators/owners with encrypted content but no session
  const needsSession = isEncrypted && (isCreator || ownsNft) && !decryptedUrl && !sessionToken;

  // Show placeholder if encrypted but no content URL available (no preview)
  const showPlaceholder = isEncrypted && !contentUrl;

  // Request decrypted content - requires valid session (session must exist before calling)
  const requestDecryptedContent = useCallback(async () => {
    if (!publicKey || !content.encryptionMetaCid || isDecrypting || !sessionToken) return;

    const walletAddress = publicKey.toBase58();

    // Check decrypted content cache first
    const cachedContent = getCachedDecryptedUrl(walletAddress, content.contentCid);
    if (cachedContent) {
      setDecryptedUrl(cachedContent);
      setHasAccess(true);
      return;
    }

    setIsDecrypting(true);
    try {
      const params = new URLSearchParams({
        contentCid: content.contentCid,
        metaCid: content.encryptionMetaCid,
        sessionToken,
      });

      const response = await fetch(`/api/content?${params}`);

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setDecryptedUrl(url);
        setCachedDecryptedUrl(walletAddress, content.contentCid, url);
        setHasAccess(true);
      } else if (response.status === 403) {
        setHasAccess(false);
      } else if (response.status === 401) {
        // Session expired - user needs to sign again
        setHasAccess(false);
      }
    } catch (err) {
      console.error("Failed to request decrypted content:", err);
      setHasAccess(false);
    } finally {
      setIsDecrypting(false);
    }
  }, [publicKey, content.contentCid, content.encryptionMetaCid, isDecrypting, sessionToken]);

  // Auto-decrypt for creators and NFT owners when session is valid
  useEffect(() => {
    if (!isEncrypted) {
      setHasAccess(true);
      return;
    }
    if (!publicKey) {
      setHasAccess(false);
      return;
    }
    // Check cache first
    const cached = getCachedDecryptedUrl(publicKey.toBase58(), content.contentCid);
    if (cached) {
      setDecryptedUrl(cached);
      setHasAccess(true);
      return;
    }
    // Only auto-decrypt if we have a valid session
    if (!sessionToken) {
      return;
    }
    // Auto-decrypt if creator or owns NFT and hasn't decrypted yet
    if ((isCreator || ownsNft) && !decryptedUrl && !isDecrypting) {
      requestDecryptedContent();
    }
  }, [isEncrypted, publicKey, isCreator, ownsNft, decryptedUrl, isDecrypting, content.contentCid, requestDecryptedContent, sessionToken]);


  return (
    <article className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800 hover:border-gray-700 transition-colors">
      {/* Creator Info */}
      <div className="flex items-center gap-3 p-4">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white font-bold">
          {content.creatorAddress?.charAt(0).toUpperCase() || "?"}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{shortAddress}</span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-green-500/20 text-green-400">
              On-chain
            </span>
          </div>
          <span className="text-xs text-gray-500">{timeAgo}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-full">
            {contentTypeLabel}
          </span>
          {isCreator && isLocked && (
            <span className="text-xs text-amber-500 bg-amber-500/20 px-2 py-1 rounded-full flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Locked
            </span>
          )}
          {/* Edit/Delete dropdown for creators */}
          {isCreator && (
            <div className="relative group">
              <button className="text-gray-400 hover:text-white p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
              <div className="absolute right-0 top-8 bg-gray-800 border border-gray-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 min-w-[120px]">
                <button
                  onClick={() => setShowEditModal(true)}
                  disabled={!canEdit}
                  className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 rounded-t-lg ${
                    canEdit
                      ? "hover:bg-gray-700 text-gray-300"
                      : "text-gray-600 cursor-not-allowed"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  disabled={!canDelete}
                  className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 rounded-b-lg ${
                    canDelete
                      ? "hover:bg-gray-700 text-red-400"
                      : "text-gray-600 cursor-not-allowed"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content Preview */}
      {getContentCategory(content.contentType) === "video" && (
        <div className="relative aspect-video bg-gray-800">
          {showPlaceholder ? (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-16 h-16 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
          ) : (
            <video
              src={contentUrl!}
              className={`w-full h-full object-contain ${showLockedOverlay || needsSession ? "blur-sm" : ""}`}
              controls={!showLockedOverlay && !needsSession}
              preload="metadata"
            />
          )}
          {showLockedOverlay && <LockedOverlay hasMintConfig={!!hasMintConfig} onBuyClick={() => setShowBuyNftModal(true)} />}
          {needsSession && <NeedsSessionOverlay onSignIn={createSession} isSigningIn={isCreatingSession} />}
        </div>
      )}

      {getContentCategory(content.contentType) === "audio" && (
        <div className="relative aspect-video bg-gradient-to-br from-primary-900/50 to-secondary-900/50 flex items-center justify-center">
          <div className={`text-center ${showLockedOverlay || needsSession ? "blur-sm" : ""}`}>
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary-500/20 flex items-center justify-center">
              <svg className="w-10 h-10 text-primary-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </div>
            {!showLockedOverlay && !needsSession && !showPlaceholder && contentUrl && (
              <audio src={contentUrl} controls className="w-full max-w-xs" />
            )}
          </div>
          {showLockedOverlay && <LockedOverlay hasMintConfig={!!hasMintConfig} onBuyClick={() => setShowBuyNftModal(true)} />}
          {needsSession && <NeedsSessionOverlay onSignIn={createSession} isSigningIn={isCreatingSession} />}
        </div>
      )}

      {getContentCategory(content.contentType) === "image" && (
        <div className="relative aspect-video bg-gray-800">
          {showPlaceholder ? (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-16 h-16 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          ) : (
            <img
              src={contentUrl!}
              alt={content.metadata?.title || content.metadata?.name || "Content"}
              className={`w-full h-full object-contain ${showLockedOverlay || needsSession ? "blur-md" : ""}`}
            />
          )}
          {showLockedOverlay && <LockedOverlay hasMintConfig={!!hasMintConfig} onBuyClick={() => setShowBuyNftModal(true)} />}
          {needsSession && <NeedsSessionOverlay onSignIn={createSession} isSigningIn={isCreatingSession} />}
        </div>
      )}

      {getContentCategory(content.contentType) === "book" && (
        <div className="relative aspect-video bg-gradient-to-br from-amber-900/30 to-orange-900/30 flex items-center justify-center">
          <div className={`text-center ${showLockedOverlay || needsSession ? "blur-sm" : ""}`}>
            <svg className="w-20 h-20 mx-auto text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <p className="text-amber-200 mt-2">{content.metadata?.title || content.metadata?.name || "Book"}</p>
          </div>
          {showLockedOverlay && <LockedOverlay hasMintConfig={!!hasMintConfig} onBuyClick={() => setShowBuyNftModal(true)} />}
          {needsSession && <NeedsSessionOverlay onSignIn={createSession} isSigningIn={isCreatingSession} />}
        </div>
      )}

      {/* Title & Description */}
      {content.metadata && (
        <div className="px-4 py-3">
          <h2 className="font-medium line-clamp-2">{content.metadata.title || content.metadata.name}</h2>
          {content.metadata.description && (
            <p className="text-sm text-gray-400 mt-1 line-clamp-2">
              {content.metadata.description}
            </p>
          )}
          {content.metadata.tags && content.metadata.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {content.metadata.tags.slice(0, 5).map((tag) => (
                <span
                  key={tag}
                  className="text-xs text-primary-400 bg-primary-500/10 px-2 py-0.5 rounded-full"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats & Actions */}
      <div className="flex items-center gap-4 px-4 py-3 border-t border-gray-800">
        {/* NFT Minted Count - use on-chain count */}
        {hasMintConfig && (
          <div className="flex items-center gap-2 text-gray-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span className="text-sm">
              {actualMintedCount} minted
            </span>
          </div>
        )}

        {/* Owned NFT Count - show how many the user owns */}
        {!isCreator && ownedNftCount > 0 && (
          <div className="flex items-center gap-2 text-green-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm">
              You own {ownedNftCount}
            </span>
          </div>
        )}

        {/* Claim Rewards Button - show if user has pending rewards */}
        {hasPendingRewards && (
          <button
            onClick={() => setShowClaimModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-full transition-colors text-sm font-medium animate-pulse hover:animate-none"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Claim {(Number(totalPendingRewards) / 1_000_000_000).toFixed(4)} SOL
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Buy NFT Button - for non-creators when mint config exists */}
          {!isCreator && hasMintConfig && (
            <button
              onClick={() => setShowBuyNftModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-primary-500/10 hover:bg-primary-500/20 text-primary-400 rounded-full transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Buy NFT
            </button>
          )}

          {/* Set Up NFT Button - for creators without mint config */}
          {isCreator && !hasMintConfig && (
            <button
              onClick={() => setShowMintConfigModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded-full transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Set Up NFT
            </button>
          )}

          {/* Edit Mint Settings - for creators with mint config */}
          {isCreator && hasMintConfig && (
            <button
              onClick={() => setShowMintConfigModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-700/50 hover:bg-gray-700 text-gray-300 rounded-full transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              NFT Settings
            </button>
          )}
        </div>
      </div>

      {/* Mint Config Modal - for creators */}
      {showMintConfigModal && (
        <MintConfigModal
          isOpen={showMintConfigModal}
          onClose={() => setShowMintConfigModal(false)}
          contentCid={content.contentCid}
          contentTitle={content.metadata?.title || content.metadata?.name}
          isLocked={!!isLocked}
          onSuccess={() => {
            refetchMintConfig();
          }}
        />
      )}

      {/* Buy NFT Modal - for buyers */}
      {showBuyNftModal && mintConfig && ecosystemConfig && (
        <BuyNftModal
          isOpen={showBuyNftModal}
          onClose={() => setShowBuyNftModal(false)}
          contentCid={content.contentCid}
          contentTitle={content.metadata?.title || content.metadata?.name}
          creator={content.creator}
          mintConfig={mintConfig}
          mintedCount={BigInt(actualMintedCount)}
          ownedCount={ownedNftCount}
          onSuccess={() => {
            refetchMintConfig();
            refetchOwnership();
          }}
        />
      )}

      {/* Edit Content Modal - for creators */}
      {showEditModal && (
        <EditContentModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          contentCid={content.contentCid}
          currentTitle={content.metadata?.title || content.metadata?.name}
          currentDescription={content.metadata?.description}
          currentTags={content.metadata?.tags}
        />
      )}

      {/* Delete Content Modal - for creators */}
      {showDeleteModal && (
        <DeleteContentModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          contentCid={content.contentCid}
          contentTitle={content.metadata?.title || content.metadata?.name}
          hasMintConfig={!!mintConfig}
        />
      )}

      {/* Claim Rewards Modal - for NFT holders (global pool) */}
      {showClaimModal && (
        <ClaimRewardsModal
          isOpen={showClaimModal}
          onClose={() => setShowClaimModal(false)}
          onSuccess={() => {
            refetchPending();
          }}
        />
      )}
    </article>
  );
}

function EmptyState({ showExplore = false }: { showExplore?: boolean }) {
  return (
    <div className="text-center py-12">
      <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
        <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      </div>
      <h3 className="text-lg font-medium mb-2">No content yet</h3>
      <p className="text-gray-500 mb-4">
        {showExplore
          ? "Be the first to upload content to the decentralized feed!"
          : "Upload your first content to see it here."}
      </p>
    </div>
  );
}

function LockedOverlay({
  hasMintConfig,
  onBuyClick,
}: {
  hasMintConfig: boolean;
  onBuyClick: () => void;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
      <div className="w-16 h-16 mb-4 rounded-full bg-gray-800/80 flex items-center justify-center">
        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <p className="text-white font-medium mb-2">Premium Content</p>
      <p className="text-gray-400 text-sm mb-4 text-center px-4">
        {hasMintConfig
          ? "Purchase the NFT to unlock full access"
          : "This content is encrypted"
        }
      </p>
      {hasMintConfig && (
        <button
          onClick={onBuyClick}
          className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-full font-medium transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Buy NFT
        </button>
      )}
    </div>
  );
}

function NeedsSessionOverlay({
  onSignIn,
  isSigningIn,
}: {
  onSignIn: () => void;
  isSigningIn: boolean;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
      <div className="w-16 h-16 mb-4 rounded-full bg-primary-800/80 flex items-center justify-center">
        <svg className="w-8 h-8 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
      </div>
      <p className="text-white font-medium mb-2">Sign to View Content</p>
      <p className="text-gray-400 text-sm mb-4 text-center px-4">
        Sign a message to verify ownership and decrypt your content
      </p>
      <button
        onClick={onSignIn}
        disabled={isSigningIn}
        className="px-6 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 disabled:cursor-wait text-white rounded-full font-medium transition-colors flex items-center gap-2"
      >
        {isSigningIn ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Signing...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
            Sign In
          </>
        )}
      </button>
    </div>
  );
}

function getContentTypeLabel(type: ContentType): string {
  return sdkGetContentTypeLabel(type);
}

function getTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}
