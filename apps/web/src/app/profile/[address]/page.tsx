"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { useContentRegistry } from "@/hooks/useContentRegistry";
import { getIpfsUrl } from "@handcraft/sdk";

const LAMPORTS_PER_SOL = 1_000_000_000;

type Tab = "content" | "collected";

export default function ProfilePage() {
  const params = useParams();
  const addressParam = params.address as string;
  const { publicKey: connectedWallet } = useWallet();
  const { connection } = useConnection();
  const { globalContent, client } = useContentRegistry();

  const [activeTab, setActiveTab] = useState<Tab>("content");

  // Validate address
  const profileAddress = useMemo(() => {
    try {
      return new PublicKey(addressParam);
    } catch {
      return null;
    }
  }, [addressParam]);

  const isOwnProfile = profileAddress && connectedWallet?.equals(profileAddress);

  // Fetch balance with react-query
  const { data: balance } = useQuery({
    queryKey: ["walletBalance", profileAddress?.toBase58()],
    queryFn: async () => {
      if (!profileAddress) return null;
      const bal = await connection.getBalance(profileAddress);
      return bal / LAMPORTS_PER_SOL;
    },
    enabled: !!profileAddress,
    staleTime: 30000,
  });

  // Fetch owned NFTs with react-query (properly cached)
  const { data: ownedNfts = [], isLoading: isLoadingNfts } = useQuery({
    queryKey: ["profileNfts", profileAddress?.toBase58()],
    queryFn: async () => {
      if (!profileAddress) return [];
      return client.fetchWalletNftMetadata(profileAddress);
    },
    enabled: !!profileAddress,
    staleTime: 60000, // Cache for 60 seconds
  });

  // Filter to this user's content
  const userContent = useMemo(() => {
    if (!profileAddress) return [];
    return globalContent.filter(c => c.creator?.toBase58() === profileAddress.toBase58());
  }, [globalContent, profileAddress]);

  // Calculate stats
  const stats = useMemo(() => {
    let totalMints = 0;

    for (const c of userContent) {
      totalMints += Number(c.mintedCount || 0);
    }

    return {
      totalMints,
      contentCount: userContent.length,
      collectedCount: ownedNfts.length,
    };
  }, [userContent, ownedNfts]);

  // Invalid address
  if (!profileAddress) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 ml-0 md:ml-64 pt-16">
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center">
                <h1 className="text-2xl font-bold mb-4">Invalid Address</h1>
                <p className="text-gray-400">The provided wallet address is not valid</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const shortAddress = `${profileAddress.toBase58().slice(0, 4)}...${profileAddress.toBase58().slice(-4)}`;

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 ml-0 md:ml-64 pt-16">
          <div className="max-w-6xl mx-auto p-6">
            {/* Profile Header */}
            <div className="bg-gradient-to-br from-primary-500/20 to-secondary-500/20 rounded-2xl p-8 mb-8 border border-gray-800">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                {/* Avatar */}
                <div className="w-24 h-24 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center text-4xl font-bold">
                  {profileAddress.toBase58().charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-3 mb-2">
                    <h1 className="text-2xl font-bold">{shortAddress}</h1>
                    {isOwnProfile && (
                      <span className="px-2 py-0.5 bg-primary-500/20 text-primary-400 text-xs rounded-full">
                        You
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(profileAddress.toBase58())}
                    className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    <span className="font-mono">{profileAddress.toBase58().slice(0, 16)}...</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>

                  {/* Stats Row */}
                  <div className="flex items-center justify-center sm:justify-start gap-6 mt-4">
                    <div>
                      <p className="text-xl font-bold">{stats.contentCount}</p>
                      <p className="text-sm text-gray-400">Created</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold">{stats.collectedCount}</p>
                      <p className="text-sm text-gray-400">Collected</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold">{stats.totalMints}</p>
                      <p className="text-sm text-gray-400">Total Mints</p>
                    </div>
                    {balance != null && (
                      <div>
                        <p className="text-xl font-bold">{balance.toFixed(2)}</p>
                        <p className="text-sm text-gray-400">SOL</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-800 mb-6">
              <div className="flex gap-8">
                <button
                  onClick={() => setActiveTab("content")}
                  className={`pb-3 text-sm font-medium transition-colors relative ${
                    activeTab === "content"
                      ? "text-white"
                      : "text-gray-400 hover:text-gray-300"
                  }`}
                >
                  Created ({stats.contentCount})
                  {activeTab === "content" && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("collected")}
                  className={`pb-3 text-sm font-medium transition-colors relative ${
                    activeTab === "collected"
                      ? "text-white"
                      : "text-gray-400 hover:text-gray-300"
                  }`}
                >
                  Collected ({stats.collectedCount})
                  {activeTab === "collected" && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />
                  )}
                </button>
              </div>
            </div>

            {/* Content Grid */}
            {activeTab === "content" && (
              <>
                {userContent.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium mb-2">No content yet</h3>
                    <p className="text-gray-400">This user hasn't uploaded any content</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {userContent.map((item) => {
                      const metadata = (item as any).metadata;
                      const title = metadata?.title || metadata?.name || "Untitled";
                      const description = metadata?.description || "";
                      const previewUrl = item.previewCid ? getIpfsUrl(item.previewCid) : null;

                      return (
                        <div
                          key={item.contentCid}
                          className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden hover:border-gray-700 transition-colors"
                        >
                          {/* Thumbnail */}
                          <div className="aspect-video bg-gray-800 relative">
                            {previewUrl ? (
                              <img
                                src={previewUrl}
                                alt={title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <svg className="w-12 h-12 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                            {item.isEncrypted && (
                              <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 rounded-full text-xs flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                Gated
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="p-4">
                            <h3 className="font-medium mb-1 truncate">{title}</h3>
                            {description && (
                              <p className="text-sm text-gray-400 line-clamp-2 mb-3">{description}</p>
                            )}
                            <div className="text-sm text-gray-500">
                              <span>{Number(item.mintedCount || 0)} mints</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* Collected NFTs Grid */}
            {activeTab === "collected" && (
              <>
                {isLoadingNfts ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400"></div>
                  </div>
                ) : ownedNfts.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium mb-2">No NFTs collected</h3>
                    <p className="text-gray-400">This user hasn't collected any NFTs yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {ownedNfts.map((nft) => {
                      // Find content metadata from globalContent
                      const contentData = globalContent.find(c => c.contentCid === nft.contentCid);
                      const metadata = (contentData as any)?.metadata;
                      const title = metadata?.title || metadata?.name || "NFT";
                      const previewUrl = contentData?.previewCid
                        ? getIpfsUrl(contentData.previewCid)
                        : null;

                      return (
                        <div
                          key={nft.assetPubkey}
                          className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden hover:border-gray-700 transition-colors"
                        >
                          {/* Image */}
                          <div className="aspect-square bg-gray-800">
                            {previewUrl ? (
                              <img
                                src={previewUrl}
                                alt={title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <svg className="w-12 h-12 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="p-3">
                            <h3 className="font-medium text-sm truncate">{title}</h3>
                            <p className="text-xs text-gray-500 truncate">
                              {nft.assetPubkey.slice(0, 8)}...
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
