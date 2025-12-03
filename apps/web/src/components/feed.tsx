"use client";

import { useState, useEffect, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useContentRegistry, ContentType, MintConfig } from "@/hooks/useContentRegistry";
import { getIpfsUrl, ContentEntry, getContentCategory, getContentTypeLabel as sdkGetContentTypeLabel } from "@handcraft/sdk";
import { MintConfigModal, BuyNftModal } from "@/components/mint";
import { EditContentModal, DeleteContentModal } from "@/components/content";

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
  const { publicKey } = useWallet();
  const { content: userContent, globalContent: rawGlobalContent, client } = useContentRegistry();

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
  const [showTipModal, setShowTipModal] = useState(false);
  const [showMintConfigModal, setShowMintConfigModal] = useState(false);
  const [showBuyNftModal, setShowBuyNftModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const { publicKey } = useWallet();
  const { useMintConfig, ecosystemConfig } = useContentRegistry();

  const { data: mintConfig, refetch: refetchMintConfig } = useMintConfig(content.contentCid);

  const contentUrl = getIpfsUrl(content.contentCid);
  const contentTypeLabel = getContentTypeLabel(content.contentType);
  const timeAgo = getTimeAgo(Number(content.createdAt) * 1000);
  const shortAddress = content.creatorAddress
    ? `${content.creatorAddress.slice(0, 4)}...${content.creatorAddress.slice(-4)}`
    : "Unknown";

  // Check if current user is the creator
  const isCreator = publicKey?.toBase58() === content.creatorAddress;
  const hasMintConfig = mintConfig && mintConfig.isActive;
  // Content is locked if NFTs have been minted (mintedCount > 0)
  const isLocked = content.isLocked || (content.mintedCount && content.mintedCount > BigInt(0));
  const canEdit = isCreator && !isLocked;
  const canDelete = isCreator && !isLocked;

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
          {isLocked && (
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
          <video
            src={contentUrl}
            className="w-full h-full object-contain"
            controls
            preload="metadata"
          />
        </div>
      )}

      {getContentCategory(content.contentType) === "audio" && (
        <div className="relative aspect-video bg-gradient-to-br from-primary-900/50 to-secondary-900/50 flex items-center justify-center">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary-500/20 flex items-center justify-center">
              <svg className="w-10 h-10 text-primary-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </div>
            <audio src={contentUrl} controls className="w-full max-w-xs" />
          </div>
        </div>
      )}

      {getContentCategory(content.contentType) === "image" && (
        <div className="relative aspect-video bg-gray-800">
          <img
            src={contentUrl}
            alt={content.metadata?.title || content.metadata?.name || "Content"}
            className="w-full h-full object-contain"
          />
        </div>
      )}

      {getContentCategory(content.contentType) === "book" && (
        <div className="relative aspect-video bg-gradient-to-br from-amber-900/30 to-orange-900/30 flex items-center justify-center">
          <div className="text-center">
            <svg className="w-20 h-20 mx-auto text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <p className="text-amber-200 mt-2">{content.metadata?.title || content.metadata?.name || "Book"}</p>
          </div>
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
        <div className="flex items-center gap-2 text-gray-500">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm">
            {(Number(content.tipsReceived) / 1e9).toFixed(3)} SOL tips
          </span>
        </div>

        {/* NFT Minted Count */}
        {hasMintConfig && (
          <div className="flex items-center gap-2 text-gray-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span className="text-sm">
              {content.mintedCount?.toString() || "0"} minted
            </span>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Tip Button */}
          {!isCreator && (
            <button
              onClick={() => setShowTipModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-full transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Tip
            </button>
          )}

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

      {/* Tip Modal */}
      {showTipModal && (
        <TipModal
          content={content}
          onClose={() => setShowTipModal(false)}
        />
      )}

      {/* Mint Config Modal - for creators */}
      {showMintConfigModal && (
        <MintConfigModal
          isOpen={showMintConfigModal}
          onClose={() => setShowMintConfigModal(false)}
          contentCid={content.contentCid}
          contentTitle={content.metadata?.title || content.metadata?.name}
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
          mintedCount={content.mintedCount || BigInt(0)}
          onSuccess={() => {
            refetchMintConfig();
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
    </article>
  );
}

function TipModal({ content, onClose }: { content: EnrichedContent; onClose: () => void }) {
  const [amount, setAmount] = useState("0.01");
  const [isTipping, setIsTipping] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const { tipContent } = useContentRegistry();
  const shortAddress = content.creatorAddress
    ? `${content.creatorAddress.slice(0, 4)}...${content.creatorAddress.slice(-4)}`
    : "Unknown";

  const handleTip = async () => {
    setIsTipping(true);
    setError("");

    try {
      const lamports = Math.floor(parseFloat(amount) * 1e9);
      await tipContent({
        contentCid: content.contentCid,
        creator: content.creator,
        amountLamports: lamports,
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to tip");
    } finally {
      setIsTipping(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 rounded-2xl w-full max-w-sm mx-4 overflow-hidden border border-gray-800 p-6">
        {success ? (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Tip Sent!</h3>
            <p className="text-gray-400 text-sm mb-4">
              You tipped {amount} SOL to {shortAddress}
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors font-medium"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-semibold mb-4">Tip {shortAddress}</h3>

            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Amount (SOL)</label>
              <div className="flex gap-2 mb-3">
                {["0.01", "0.05", "0.1", "0.5"].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setAmount(preset)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      amount === preset
                        ? "bg-primary-600 text-white"
                        : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                step="0.01"
                min="0.001"
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
              />
            </div>

            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleTip}
                disabled={isTipping || !amount || parseFloat(amount) <= 0}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
              >
                {isTipping ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Sending...
                  </>
                ) : (
                  `Send ${amount} SOL`
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
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
