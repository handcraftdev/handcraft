"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { useContentRegistry, getBundleTypeLabel, Bundle, BundleWithItems } from "@/hooks/useContentRegistry";
import { getIpfsUrl } from "@handcraft/sdk";

export default function BundlePage() {
  const params = useParams();
  const { publicKey } = useWallet();
  const creatorAddress = params.creator as string;
  const bundleId = params.id as string;

  const { client } = useContentRegistry();
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [bundleWithItems, setBundleWithItems] = useState<BundleWithItems | null>(null);
  const [metadata, setMetadata] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if the current user is the bundle creator
  const isOwner = useMemo(() => {
    if (!publicKey || !bundle) return false;
    return bundle.creator.toBase58() === publicKey.toBase58();
  }, [publicKey, bundle]);

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

  // Sort items by position
  const sortedItems = useMemo(() => {
    if (!bundleWithItems?.items) return [];
    return [...bundleWithItems.items].sort((a, b) => a.item.position - b.item.position);
  }, [bundleWithItems]);

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
                            : "bg-gray-600/20 text-gray-400"
                        }`}>
                          {bundle.isActive ? "Active" : "Inactive"}
                        </span>
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
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bundle Items */}
                <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                  <div className="p-5 border-b border-gray-800">
                    <h2 className="text-xl font-semibold">Contents</h2>
                  </div>

                  {sortedItems.length === 0 ? (
                    <div className="p-8 text-center">
                      <p className="text-gray-400">This bundle is empty.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-800">
                      {sortedItems.map((itemData, index) => {
                        const content = itemData.content;
                        if (!content) return null;

                        return (
                          <div
                            key={itemData.item.content.toBase58()}
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
                                {content.contentCid.slice(0, 16)}...
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
              </>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
