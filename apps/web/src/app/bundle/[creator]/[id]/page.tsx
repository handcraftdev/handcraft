"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { useContentRegistry, getBundleTypeLabel, Bundle, BundleWithItems, ContentEntry } from "@/hooks/useContentRegistry";
import { getIpfsUrl, BundleMetadata, BundleMetadataItem } from "@handcraft/sdk";
import { ManageBundleModal } from "@/components/bundle/ManageBundleModal";

export default function BundlePage() {
  const params = useParams();
  const { publicKey } = useWallet();
  const creatorAddress = params.creator as string;
  const bundleId = params.id as string;

  const { client, content: userContent, isLoadingContent, updateBundle, isUpdatingBundle, useBundleMintConfig, useBundleRentConfig } = useContentRegistry();
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [bundleWithItems, setBundleWithItems] = useState<BundleWithItems | null>(null);
  const [metadata, setMetadata] = useState<BundleMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Check if the current user is the bundle creator
  const isOwner = useMemo(() => {
    if (!publicKey || !bundle) return false;
    return bundle.creator.toBase58() === publicKey.toBase58();
  }, [publicKey, bundle]);

  // Parse creator address from URL for fetching configs
  const creatorPubkey = useMemo(() => {
    try {
      return new PublicKey(creatorAddress);
    } catch {
      return null;
    }
  }, [creatorAddress]);

  // Fetch mint/rent configs to check if monetization is configured
  // Use creator from URL, not the connected wallet
  const mintConfigQuery = useBundleMintConfig(creatorPubkey, bundleId);
  const rentConfigQuery = useBundleRentConfig(creatorPubkey, bundleId);
  const mintConfig = mintConfigQuery.data;
  const rentConfig = rentConfigQuery.data;

  // Check if bundle is a draft (unpublished)
  const isDraft = bundle && !bundle.isActive;

  // Handle publishing the bundle
  const handlePublish = async () => {
    if (!bundle) return;
    setIsPublishing(true);
    try {
      await updateBundle.mutateAsync({
        bundleId: bundle.bundleId,
        isActive: true,
      });
      // Update local state
      setBundle(prev => prev ? { ...prev, isActive: true } : null);
    } catch (err) {
      console.error("Failed to publish bundle:", err);
      setError(err instanceof Error ? err.message : "Failed to publish bundle");
    } finally {
      setIsPublishing(false);
    }
  };

  // Fetch bundle data
  useEffect(() => {
    async function fetchBundle() {
      if (!client || !creatorAddress || !bundleId) return;

      setIsLoading(true);
      setError(null);

      try {
        const creatorPubkey = new PublicKey(creatorAddress);

        // Fetch bundle
        const bundleData = await client.fetchBundle(creatorPubkey, bundleId);
        if (!bundleData) {
          setError("Bundle not found");
          return;
        }
        setBundle(bundleData);

        // Fetch bundle with items
        const withItems = await client.fetchBundleWithItems(creatorPubkey, bundleId);
        setBundleWithItems(withItems);

        // Fetch metadata from IPFS
        if (bundleData.metadataCid) {
          try {
            const metadataUrl = getIpfsUrl(bundleData.metadataCid);
            const res = await fetch(metadataUrl);
            if (res.ok) {
              const meta = await res.json();
              setMetadata(meta);
            }
          } catch (e) {
            console.error("Failed to fetch bundle metadata:", e);
          }
        }
      } catch (err) {
        console.error("Failed to fetch bundle:", err);
        setError(err instanceof Error ? err.message : "Failed to load bundle");
      } finally {
        setIsLoading(false);
      }
    }

    fetchBundle();
  }, [client, creatorAddress, bundleId]);

  // Get ordered items - use metadata order if available, otherwise fall back to on-chain position
  const orderedItems = useMemo(() => {
    if (!bundleWithItems?.items) return [];

    const onChainItems = bundleWithItems.items;

    // If metadata has items array, use that order
    if (metadata?.items && metadata.items.length > 0) {
      return metadata.items.map(metaItem => {
        const onChainItem = onChainItems.find(
          i => i.content?.contentCid === metaItem.contentCid
        );
        return {
          metaItem,
          content: onChainItem?.content || null,
          onChainItem: onChainItem?.item || null,
        };
      }).filter(item => item.content !== null);
    }

    // Fall back to on-chain position order
    return [...onChainItems]
      .sort((a, b) => a.item.position - b.item.position)
      .map(item => ({
        metaItem: { contentCid: item.content?.contentCid || "" } as BundleMetadataItem,
        content: item.content,
        onChainItem: item.item,
      }));
  }, [bundleWithItems, metadata]);

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 ml-0 md:ml-64 pt-16">
          <div className="max-w-4xl mx-auto p-6">
            {isLoading ? (
              <div className="flex items-center justify-center min-h-[40vh]">
                <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center min-h-[40vh]">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold mb-2">Error</h2>
                <p className="text-gray-400">{error}</p>
              </div>
            ) : bundle ? (
              <>
                {/* Draft Notice for Owners */}
                {isOwner && isDraft && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6">
                    <div className="flex items-start gap-3">
                      <svg className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div className="flex-1">
                        <h3 className="font-semibold text-yellow-400">Draft Bundle</h3>
                        <p className="text-sm text-gray-400 mt-1">
                          This bundle is not yet published. Add content, configure pricing, and publish when ready.
                        </p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <button
                            onClick={() => setIsManageModalOpen(true)}
                            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
                          >
                            Manage Bundle
                          </button>
                          <button
                            onClick={handlePublish}
                            disabled={isPublishing || bundle.itemCount === 0}
                            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors"
                          >
                            {isPublishing ? "Publishing..." : "Publish Bundle"}
                          </button>
                        </div>
                        {bundle.itemCount === 0 && (
                          <p className="text-xs text-yellow-500 mt-2">Add at least one content item before publishing</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Bundle Header */}
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
                  <div className="flex items-start gap-6">
                    {/* Cover Image */}
                    <div className="w-32 h-32 bg-gray-800 rounded-lg flex-shrink-0 overflow-hidden">
                      {metadata?.image ? (
                        <img
                          src={metadata.image as string}
                          alt={(metadata.name as string) || bundleId}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Bundle Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs px-2 py-1 bg-primary-500/20 text-primary-400 rounded">
                          {getBundleTypeLabel(bundle.bundleType)}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          bundle.isActive
                            ? "bg-green-500/20 text-green-400"
                            : "bg-yellow-500/20 text-yellow-400"
                        }`}>
                          {bundle.isActive ? "Published" : "Draft"}
                        </span>
                        {bundle.isLocked && (
                          <span className="text-xs px-2 py-1 bg-gray-600/20 text-gray-400 rounded">
                            Locked
                          </span>
                        )}
                        {isOwner && (
                          <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded">
                            Your Bundle
                          </span>
                        )}
                      </div>
                      <h1 className="text-2xl font-bold mb-2">
                        {(metadata?.name as string) || bundleId}
                      </h1>
                      {metadata?.description ? (
                        <p className="text-gray-400 mb-4">{String(metadata.description)}</p>
                      ) : null}
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>{bundle.itemCount} items</span>
                        <span>Created {new Date(Number(bundle.createdAt) * 1000).toLocaleDateString()}</span>
                        {mintConfig && (
                          <span className="text-primary-400">
                            {(Number(mintConfig.price) / LAMPORTS_PER_SOL).toFixed(2)} SOL
                          </span>
                        )}
                      </div>

                      {/* Owner Actions (for published bundles) */}
                      {isOwner && !isDraft && (
                        <div className="flex gap-2 mt-4">
                          <button
                            onClick={() => setIsManageModalOpen(true)}
                            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
                          >
                            Manage Bundle
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bundle Items */}
                <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                  <div className="p-5 border-b border-gray-800">
                    <h2 className="text-xl font-semibold">Contents</h2>
                  </div>

                  {orderedItems.length === 0 ? (
                    <div className="p-8 text-center">
                      <p className="text-gray-400">This bundle is empty.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-800">
                      {orderedItems.map((itemData, index) => {
                        const content = itemData.content;
                        if (!content) return null;

                        return (
                          <div
                            key={itemData.metaItem.contentCid}
                            className="flex items-center gap-4 p-4 hover:bg-gray-800/50 transition-colors"
                          >
                            {/* Position Number */}
                            <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center text-lg font-medium text-gray-400">
                              {index + 1}
                            </div>

                            {/* Content Preview */}
                            <div className="w-16 h-16 bg-gray-800 rounded-lg flex-shrink-0 overflow-hidden">
                              {content.previewCid ? (
                                <img
                                  src={getIpfsUrl(content.previewCid)}
                                  alt="Content preview"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                </div>
                              )}
                            </div>

                            {/* Content Info */}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">
                                {itemData.metaItem.title || `${content.contentCid.slice(0, 16)}...`}
                              </p>
                              <p className="text-sm text-gray-500">
                                {content.contentType?.toString().replace(/([A-Z])/g, ' $1').trim() || "Content"}
                              </p>
                            </div>

                            {/* Mints */}
                            <div className="text-right">
                              <p className="text-sm font-medium">{Number(content.mintedCount || 0)}</p>
                              <p className="text-xs text-gray-500">mints</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Creator Info */}
                <div className="mt-6 p-4 bg-gray-900 rounded-xl border border-gray-800">
                  <p className="text-sm text-gray-500">Created by</p>
                  <a
                    href={`/profile/${creatorAddress}`}
                    className="text-primary-400 hover:text-primary-300 font-mono text-sm"
                  >
                    {creatorAddress.slice(0, 8)}...{creatorAddress.slice(-8)}
                  </a>
                </div>

                {/* Manage Bundle Modal */}
                {isOwner && bundle && (
                  <ManageBundleModal
                    isOpen={isManageModalOpen}
                    onClose={() => {
                      setIsManageModalOpen(false);
                      // Refetch bundle data after closing modal
                      if (client && creatorAddress && bundleId) {
                        const creatorPubkey = new PublicKey(creatorAddress);
                        client.fetchBundle(creatorPubkey, bundleId).then(setBundle);
                        client.fetchBundleWithItems(creatorPubkey, bundleId).then(setBundleWithItems);
                      }
                    }}
                    bundle={bundle}
                    availableContent={userContent || []}
                  />
                )}
              </>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
