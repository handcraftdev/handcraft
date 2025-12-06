"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useContentRegistry, ContentType } from "@/hooks/useContentRegistry";
import { useSession } from "@/hooks/useSession";
import { getIpfsUrl, getContentCategory, getContentDomain, getDomainLabel, getContentTypeLabel as getSDKContentTypeLabel } from "@handcraft/sdk";
import { MintConfigModal, BuyNftModal, SellNftModal } from "@/components/mint";
import { EditContentModal, DeleteContentModal } from "@/components/content";
import { ClaimRewardsModal } from "@/components/claim";
import { ConfigureRentModal, RentContentModal } from "@/components/rent";
import { type FeedTab, type EnrichedContent } from "./types";
import { getCachedDecryptedUrl, setCachedDecryptedUrl } from "./cache";
import { getContentTypeLabel, getTimeAgo } from "./helpers";
import { EmptyState, LockedOverlay, NeedsSessionOverlay } from "./Overlays";

export function Feed() {
  const [activeTab, setActiveTab] = useState<FeedTab>("foryou");
  const { publicKey, connected } = useWallet();
  const { content: userContent, globalContent: rawGlobalContent, isLoadingGlobalContent, client } = useContentRegistry();
  const { isValid: hasValidSession } = useSession();

  // Global feed state - enrich from cached query data
  const [globalContent, setGlobalContent] = useState<EnrichedContent[]>([]);
  const [isEnrichingGlobal, setIsEnrichingGlobal] = useState(false);

  // User content state
  const [enrichedUserContent, setEnrichedUserContent] = useState<EnrichedContent[]>([]);
  const [isLoadingUser, setIsLoadingUser] = useState(false);

  const lastUserFetchRef = useRef<string>("");
  const lastGlobalFetchRef = useRef<string>("");

  // Enrich global content when query data changes (uses cached data, no RPC call)
  useEffect(() => {
    const contentKey = rawGlobalContent.map(c => c.contentCid).join(",");
    if (contentKey === lastGlobalFetchRef.current || !contentKey) return;
    lastGlobalFetchRef.current = contentKey;

    async function enrichGlobalFeed() {
      setIsEnrichingGlobal(true);
      try {
        // Enrich with metadata from IPFS (not Solana RPC)
        const enriched = await Promise.all(
          rawGlobalContent.map(async (item) => {
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
        console.error("Error enriching global feed:", err);
      } finally {
        setIsEnrichingGlobal(false);
      }
    }

    enrichGlobalFeed();
  }, [rawGlobalContent]);

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

  // Include !client check to ensure consistent SSR/client hydration
  // On server, client is null, so we show loading state to match client initial render
  const isLoading = activeTab === "foryou"
    ? (!client || isLoadingGlobalContent || isEnrichingGlobal)
    : isLoadingUser;
  const displayContent = activeTab === "foryou" ? globalContent : enrichedUserContent;

  return (
    <div className="pt-16 pb-20">
      {/* Tab Navigation */}
      <div className="sticky top-16 z-40 bg-black/90 backdrop-blur-md border-b border-gray-800">
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
  const [showConfigureRentModal, setShowConfigureRentModal] = useState(false);
  const [showRentModal, setShowRentModal] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [decryptedUrl, setDecryptedUrl] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const { publicKey } = useWallet();
  const { token: sessionToken, createSession, isCreating: isCreatingSession } = useSession();
  const { useMintConfig, useRentConfig, useNftOwnership, useActiveRental, getPendingRewardForContent, pendingRewardsQuery, walletNfts } = useContentRegistry();

  const { data: mintConfig, isLoading: isLoadingMintConfig, refetch: refetchMintConfig } = useMintConfig(content.contentCid);
  const { data: rentConfig, isLoading: isLoadingRentConfig, refetch: refetchRentConfig } = useRentConfig(content.contentCid);
  const { data: ownedNftCount = 0, isLoading: isLoadingOwnership, refetch: refetchOwnership } = useNftOwnership(content.contentCid);
  const { data: activeRental, isLoading: isLoadingActiveRental, refetch: refetchActiveRental } = useActiveRental(content.contentCid);

  // Unified loading state - wait for all data before showing actions
  const isLoadingCardData = isLoadingMintConfig || isLoadingRentConfig || isLoadingOwnership || isLoadingActiveRental;

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
  const contentDomain = getContentDomain(content.contentType);
  const domainLabel = getDomainLabel(contentDomain);
  const timeAgo = getTimeAgo(Number(content.createdAt) * 1000);

  // Context metadata from the new architecture
  const contextData = content.metadata?.context || {};
  const genre = contextData.genre || content.metadata?.genre;
  const artist = contextData.artist || content.metadata?.artist;
  const album = contextData.album || content.metadata?.album;
  const showName = contextData.showName;
  const season = contextData.season;
  const episode = contextData.episode;
  const bundleInfo = content.metadata?.bundle;

  const shortAddress = content.creatorAddress
    ? `${content.creatorAddress.slice(0, 4)}...${content.creatorAddress.slice(-4)}`
    : "Unknown";

  // Check if current user is the creator
  const isCreator = publicKey?.toBase58() === content.creatorAddress;
  const hasMintConfig = mintConfig && mintConfig.isActive;
  const hasRentConfig = rentConfig && rentConfig.isActive;
  // Content is locked if NFTs have been minted - use mintedCount from content entry
  const actualMintedCount = Number(content.mintedCount ?? 0);
  const isLocked = content.isLocked || actualMintedCount > 0;
  const canEdit = isCreator && !isLocked;
  const canDelete = isCreator && !isLocked;
  const canConfigureRent = isCreator && hasMintConfig; // Need mint config first

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

    // Check decrypted content cache first (validates against current session)
    const cachedContent = getCachedDecryptedUrl(walletAddress, content.contentCid, sessionToken);
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
        setCachedDecryptedUrl(walletAddress, content.contentCid, url, sessionToken);
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
    // Only proceed if we have a valid session
    if (!sessionToken) {
      // No session - clear any stale decrypted state
      if (decryptedUrl) {
        setDecryptedUrl(null);
        setHasAccess(null);
      }
      return;
    }
    // Check cache first (validates against current session)
    const cached = getCachedDecryptedUrl(publicKey.toBase58(), content.contentCid, sessionToken);
    if (cached) {
      setDecryptedUrl(cached);
      setHasAccess(true);
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
          <span className="text-xs text-gray-400 bg-gray-800/50 px-2 py-1 rounded-full">
            {domainLabel}
          </span>
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-full">
            {contentTypeLabel}
          </span>
          {genre && (
            <span className="text-xs text-primary-400 bg-primary-500/10 px-2 py-1 rounded-full">
              {genre}
            </span>
          )}
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
          {showLockedOverlay && <LockedOverlay hasMintConfig={!!hasMintConfig} hasRentConfig={!!hasRentConfig} onBuyClick={() => setShowBuyNftModal(true)} onRentClick={() => setShowRentModal(true)} />}
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
          {showLockedOverlay && <LockedOverlay hasMintConfig={!!hasMintConfig} hasRentConfig={!!hasRentConfig} onBuyClick={() => setShowBuyNftModal(true)} onRentClick={() => setShowRentModal(true)} />}
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
          {showLockedOverlay && <LockedOverlay hasMintConfig={!!hasMintConfig} hasRentConfig={!!hasRentConfig} onBuyClick={() => setShowBuyNftModal(true)} onRentClick={() => setShowRentModal(true)} />}
          {needsSession && <NeedsSessionOverlay onSignIn={createSession} isSigningIn={isCreatingSession} />}
        </div>
      )}

      {(getContentCategory(content.contentType) === "document" || getContentCategory(content.contentType) === "text" || getContentCategory(content.contentType) === "file") && (
        <div className="relative aspect-video bg-gradient-to-br from-amber-900/30 to-orange-900/30 flex items-center justify-center">
          <div className={`text-center ${showLockedOverlay || needsSession ? "blur-sm" : ""}`}>
            <svg className="w-20 h-20 mx-auto text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <p className="text-amber-200 mt-2">{content.metadata?.title || content.metadata?.name || "Book"}</p>
          </div>
          {showLockedOverlay && <LockedOverlay hasMintConfig={!!hasMintConfig} hasRentConfig={!!hasRentConfig} onBuyClick={() => setShowBuyNftModal(true)} onRentClick={() => setShowRentModal(true)} />}
          {needsSession && <NeedsSessionOverlay onSignIn={createSession} isSigningIn={isCreatingSession} />}
        </div>
      )}

      {/* Title & Description */}
      {content.metadata && (
        <div className="px-4 py-3">
          <h2 className="font-medium line-clamp-2">{content.metadata.title || content.metadata.name}</h2>

          {/* Context info: artist, album, series info */}
          {(artist || album || showName) && (
            <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-sm text-gray-400 mt-1">
              {artist && (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {artist}
                </span>
              )}
              {album && (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                  </svg>
                  {album}
                </span>
              )}
              {showName && (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M7 8h8a2 2 0 002-2V4M7 12h10M7 16h10" />
                  </svg>
                  {showName}
                  {season && ` S${season}`}
                  {episode && `E${episode}`}
                </span>
              )}
            </div>
          )}

          {/* Bundle reference */}
          {bundleInfo && bundleInfo.id && (
            <div className="flex items-center gap-1 text-xs text-secondary-400 mt-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Part of bundle{bundleInfo.position !== undefined ? ` (#${bundleInfo.position + 1})` : ''}
            </div>
          )}

          {content.metadata.description && (
            <p className="text-sm text-gray-400 mt-1 line-clamp-2">
              {content.metadata.description}
            </p>
          )}
          {content.metadata.tags && content.metadata.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {content.metadata.tags.slice(0, 5).map((tag: string) => (
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
        {isLoadingCardData ? (
          /* Loading skeleton for actions */
          <>
            <div className="h-4 w-20 bg-gray-800 rounded animate-pulse" />
            <div className="ml-auto flex items-center gap-2">
              <div className="h-8 w-16 bg-gray-800 rounded-full animate-pulse" />
              <div className="h-8 w-16 bg-gray-800 rounded-full animate-pulse" />
            </div>
          </>
        ) : (
          <>
            {/* NFT Minted Count - use on-chain count */}
            {hasMintConfig && (
              <div className="flex items-center gap-2 text-gray-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span className="text-sm">
                  {actualMintedCount}
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
                  {ownedNftCount}
                </span>
              </div>
            )}

            {/* Claim Rewards Button - show if user has pending rewards */}
            {hasPendingRewards && (
          <button
            onClick={() => setShowClaimModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-full transition-colors text-sm font-medium animate-pulse hover:animate-none group relative"
            title="Rewards accumulated from holder share"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {(Number(totalPendingRewards) / 1_000_000_000).toFixed(4)} SOL
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
              Buy
            </button>
          )}

          {/* Rent Button - for non-creators when rent config exists */}
          {!isCreator && hasRentConfig && rentConfig && (
            <button
              onClick={() => setShowRentModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-full transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {activeRental ? "Extend" : "Rent"}
            </button>
          )}

          {/* Sell Button - for NFT owners */}
          {!isCreator && ownedNftCount > 0 && (
            <button
              onClick={() => setShowSellModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-full transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Sell
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

          {/* Set Up Rental Button - for creators with mint config but no rent config */}
          {canConfigureRent && !hasRentConfig && (
            <button
              onClick={() => setShowConfigureRentModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-full transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Set Up Rental
            </button>
          )}

          {/* Edit Rental Settings - for creators with rent config */}
          {isCreator && hasRentConfig && (
            <button
              onClick={() => setShowConfigureRentModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-full transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Rental Settings
            </button>
          )}
          </div>
          </>
        )}
      </div>

      {/* Rental Expiry Notice - separate line for better UI */}
      {!isCreator && activeRental && !isLoadingCardData && (
        <div className="px-4 py-2 border-t border-gray-800 bg-amber-500/5">
          <div className="flex items-center gap-2 text-xs text-amber-400/80">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Rental expires {new Date(Number(activeRental.expiresAt) * 1000).toLocaleString()}</span>
          </div>
        </div>
      )}

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
      {showBuyNftModal && mintConfig && (
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

      {/* Configure Rent Modal - for creators */}
      {showConfigureRentModal && (
        <ConfigureRentModal
          isOpen={showConfigureRentModal}
          onClose={() => setShowConfigureRentModal(false)}
          contentCid={content.contentCid}
          contentTitle={content.metadata?.title || content.metadata?.name}
          onSuccess={() => {
            refetchRentConfig();
          }}
        />
      )}

      {/* Rent Content Modal - for renters */}
      {showRentModal && rentConfig && (
        <RentContentModal
          isOpen={showRentModal}
          onClose={() => setShowRentModal(false)}
          contentCid={content.contentCid}
          contentTitle={content.metadata?.title || content.metadata?.name}
          creator={content.creator}
          rentConfig={rentConfig}
          activeRental={activeRental}
          onSuccess={() => {
            refetchRentConfig();
            refetchOwnership();
            refetchActiveRental();
          }}
          onBuyClick={mintConfig ? () => setShowBuyNftModal(true) : undefined}
        />
      )}

      {/* Sell NFT Modal - for NFT holders */}
      {showSellModal && (
        <SellNftModal
          isOpen={showSellModal}
          onClose={() => setShowSellModal(false)}
          contentCid={content.contentCid}
          contentTitle={content.metadata?.title || content.metadata?.name}
          ownedCount={ownedNftCount}
          userNfts={walletNfts}
        />
      )}
    </article>
  );
}
