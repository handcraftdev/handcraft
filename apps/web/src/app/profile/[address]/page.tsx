"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/sidebar";
import { useContentRegistry } from "@/hooks/useContentRegistry";
import { BurnNftModal } from "@/components/nft";
import { RarityBadge } from "@/components/rarity";
import { CreatorMembershipBanner, EcosystemMembershipCard, CustomMembershipCard } from "@/components/membership";
import { getIpfsUrl, getContentCollectionPda, getContentPda, Rarity, getRarityFromWeight, getCreatorPatronTreasuryPda, StreamflowClient, NETWORKS } from "@handcraft/sdk";
import { useConnection } from "@solana/wallet-adapter-react";
import Link from "next/link";

const SOLANA_NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet") as keyof typeof NETWORKS;

type Tab = "content" | "collected" | "members";

export default function ProfilePage() {
  const params = useParams();
  const addressParam = params.address as string;
  const { publicKey: connectedWallet } = useWallet();
  const { connection } = useConnection();
  const queryClient = useQueryClient();
  const {
    globalContent,
    globalBundles,
    client,
  } = useContentRegistry();

  // Create Streamflow client for membership queries
  const streamflowClient = useMemo(() => new StreamflowClient({
    cluster: SOLANA_NETWORK as "mainnet" | "devnet" | "testnet",
    rpcUrl: connection.rpcEndpoint,
  }), [connection.rpcEndpoint]);

  const [activeTab, setActiveTab] = useState<Tab>("content");
  const [burnModalData, setBurnModalData] = useState<{
    nftAsset: PublicKey;
    collectionAsset: PublicKey;
    contentCid: string;
    title: string;
    previewUrl: string | null;
  } | null>(null);

  // Validate address
  const profileAddress = useMemo(() => {
    try {
      return new PublicKey(addressParam);
    } catch {
      return null;
    }
  }, [addressParam]);

  const isOwnProfile = profileAddress && connectedWallet?.equals(profileAddress);

  // Fetch user profile for the viewed address
  const { data: profileData } = useQuery({
    queryKey: ["userProfile", profileAddress?.toBase58()],
    queryFn: async () => {
      if (!client || !profileAddress) return null;
      return client.fetchUserProfile(profileAddress);
    },
    enabled: !!profileAddress && !!client,
    staleTime: 60000,
  });

  // Get unique creators from global content
  const uniqueCreators = useMemo(() => {
    const creatorSet = new Set<string>();
    for (const content of globalContent) {
      if (content.creator) {
        creatorSet.add(content.creator.toBase58());
      }
    }
    return Array.from(creatorSet);
  }, [globalContent]);

  // Fetch active membership streams (creators this user is a member of)
  const { data: activeMemberships = [], isLoading: isLoadingMemberships } = useQuery({
    queryKey: ["profileMemberships", profileAddress?.toBase58(), uniqueCreators.length],
    queryFn: async () => {
      if (!profileAddress || uniqueCreators.length === 0) return [];

      try {
        // Get all streams from this wallet
        const streams = await streamflowClient.getStreamsForWallet(profileAddress);
        const now = Math.floor(Date.now() / 1000);

        // Build a map of treasury PDA -> creator address
        const treasuryToCreator = new Map<string, string>();
        for (const creatorAddr of uniqueCreators) {
          const creatorPubkey = new PublicKey(creatorAddr);
          const [treasuryPda] = getCreatorPatronTreasuryPda(creatorPubkey);
          treasuryToCreator.set(treasuryPda.toBase58(), creatorAddr);
        }

        // Find active streams to creator treasuries
        const memberships: Array<{
          creatorAddress: string;
          streamId: string;
          startTime: number;
          endTime: number;
        }> = [];

        for (const stream of streams) {
          const creatorAddr = treasuryToCreator.get(stream.recipient);
          if (creatorAddr) {
            const hasTimeRemaining = stream.endTime > now;
            const wasFunded = stream.depositedAmount.toNumber() > 0;
            const isNotCancelled = stream.canceledAt === 0;

            if (hasTimeRemaining && wasFunded && isNotCancelled) {
              memberships.push({
                creatorAddress: creatorAddr,
                streamId: stream.id,
                startTime: stream.startTime,
                endTime: stream.endTime,
              });
            }
          }
        }

        return memberships;
      } catch (err) {
        console.error("Error fetching memberships:", err);
        return [];
      }
    },
    enabled: !!profileAddress && uniqueCreators.length > 0,
    staleTime: 60000,
  });

  // Fetch profile data for membership creators
  const { data: membershipCreatorProfiles = new Map<string, { username?: string }>() } = useQuery({
    queryKey: ["membershipCreatorProfiles", activeMemberships.map(m => m.creatorAddress).join(",")],
    queryFn: async () => {
      if (!client || activeMemberships.length === 0) return new Map();

      const profiles = new Map<string, { username?: string }>();
      for (const membership of activeMemberships) {
        try {
          const creatorPubkey = new PublicKey(membership.creatorAddress);
          const profile = await client.fetchUserProfile(creatorPubkey);
          if (profile) {
            profiles.set(membership.creatorAddress, { username: profile.username });
          }
        } catch {
          // Profile not found, use address
        }
      }
      return profiles;
    },
    enabled: !!client && activeMemberships.length > 0,
    staleTime: 300000,
  });

  // Fetch owned NFTs with react-query (properly cached)
  const { data: allNfts = [], isLoading: isLoadingNfts } = useQuery({
    queryKey: ["profileNfts", profileAddress?.toBase58()],
    queryFn: async () => {
      if (!profileAddress || !client) return [];
      return client.fetchWalletNftMetadata(profileAddress);
    },
    enabled: !!profileAddress && !!client,
    staleTime: 60000, // Cache for 60 seconds
  });

  // Fetch rental NFT assets to exclude from owned count
  const { data: rentalNftAssets = new Set<string>(), isLoading: isLoadingRentals } = useQuery({
    queryKey: ["profileRentalNfts", profileAddress?.toBase58(), allNfts.length],
    queryFn: async () => {
      if (!profileAddress || !client || allNfts.length === 0) return new Set<string>();
      return client.fetchRentalNftsFromMetadata(allNfts);
    },
    enabled: !!profileAddress && !!client && allNfts.length > 0,
    staleTime: 60000,
  });

  // Filter out rental NFTs from owned NFTs
  const ownedNfts = useMemo(() => {
    return allNfts.filter(nft => !rentalNftAssets.has(nft.nftAsset.toBase58()));
  }, [allNfts, rentalNftAssets]);

  // Fetch rarities for owned NFTs (from UnifiedNftRewardState)
  const { data: nftRarities = new Map<string, Rarity>(), isLoading: isLoadingRarities } = useQuery({
    queryKey: ["profileNftRarities", profileAddress?.toBase58(), ownedNfts.length],
    queryFn: async () => {
      if (!profileAddress || !client || ownedNfts.length === 0) return new Map<string, Rarity>();
      const nftAssets = ownedNfts.map(nft => nft.nftAsset);
      const rewardStates = await client.fetchNftRewardStatesBatch(nftAssets);
      const result = new Map<string, Rarity>();
      for (const [key, state] of rewardStates) {
        // Convert weight to rarity enum
        result.set(key, getRarityFromWeight(state.weight));
      }
      return result;
    },
    enabled: !!profileAddress && !!client && ownedNfts.length > 0,
    staleTime: 300000,
  });

  // Filter to this user's content
  const userContent = useMemo(() => {
    if (!profileAddress) return [];
    return globalContent.filter(c => c.creator?.toBase58() === profileAddress.toBase58());
  }, [globalContent, profileAddress]);

  // Fetch all content collections (for getting collection asset when burning)
  const { data: allContentCollections = new Map() } = useQuery({
    queryKey: ["allContentCollections"],
    queryFn: async () => {
      if (!client) return new Map();
      return client.fetchAllContentCollections();
    },
    enabled: !!client,
    staleTime: 60000,
  });

  // Open burn NFT modal
  const openBurnModal = (nftAsset: PublicKey, contentCid: string, title: string, previewUrl: string | null) => {
    // Get collection asset from content collections
    const [contentPda] = getContentPda(contentCid);
    const collection = allContentCollections.get(contentPda.toBase58());

    if (!collection) {
      console.error("Collection not found for this content");
      return;
    }

    setBurnModalData({
      nftAsset,
      collectionAsset: collection.collectionAsset,
      contentCid,
      title,
      previewUrl,
    });
  };

  const handleBurnSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["profileNfts"] });
  };

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
      membershipCount: activeMemberships.length,
    };
  }, [userContent, ownedNfts, activeMemberships]);

  // Invalid address
  if (!profileAddress) {
    return (
      <div className="min-h-screen bg-black text-white flex">
        <Sidebar />
        <main className="flex-1 min-w-0">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-4">Invalid Address</h1>
              <p className="text-gray-400">The provided wallet address is not valid</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const fullAddress = profileAddress.toBase58();

  return (
    <div className="min-h-screen bg-black text-white flex">
      <Sidebar />
      <main className="flex-1 min-w-0">
          <div className="max-w-6xl mx-auto p-6">
            {/* Profile Header */}
            <div className="bg-gradient-to-br from-primary-500/20 to-secondary-500/20 rounded-2xl p-8 mb-8 border border-gray-800">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                {/* Avatar */}
                <div className="w-24 h-24 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center text-4xl font-bold">
                  {profileData?.username?.charAt(0).toUpperCase() || fullAddress.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 text-center sm:text-left">
                  {profileData?.username && (
                    <h1 className="text-2xl font-bold mb-1">{profileData.username}</h1>
                  )}
                  <div className="flex items-center justify-center sm:justify-start gap-3 mb-2">
                    <p className={`font-mono break-all ${profileData?.username ? "text-sm text-gray-400" : "text-lg font-bold"}`}>
                      {fullAddress}
                    </p>
                    {isOwnProfile && (
                      <span className="px-2 py-0.5 bg-primary-500/20 text-primary-400 text-xs rounded-full flex-shrink-0">
                        You
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-center sm:justify-start gap-3">
                    <button
                      onClick={() => navigator.clipboard.writeText(fullAddress)}
                      className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
                    >
                      <span>Copy address</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>

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
                  </div>
                </div>
              </div>
            </div>

            {/* Membership Banners */}
            {isOwnProfile ? (
              /* Ecosystem Membership for own profile */
              <div className="mb-8">
                <EcosystemMembershipCard />
              </div>
            ) : (
              /* Creator Membership for other profiles */
              <div className="mb-8 space-y-4">
                <CreatorMembershipBanner creator={profileAddress} />
                <CustomMembershipCard creator={profileAddress} />
              </div>
            )}

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
                <button
                  onClick={() => setActiveTab("members")}
                  className={`pb-3 text-sm font-medium transition-colors relative ${
                    activeTab === "members"
                      ? "text-white"
                      : "text-gray-400 hover:text-gray-300"
                  }`}
                >
                  Members ({stats.membershipCount})
                  {activeTab === "members" && (
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
                {(isLoadingNfts || isLoadingRentals) ? (
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
                      const title = metadata?.title || metadata?.name || nft.name || "Untitled";
                      const previewUrl = contentData?.previewCid
                        ? getIpfsUrl(contentData.previewCid)
                        : null;
                      const rarity = nftRarities.get(nft.nftAsset.toBase58());
                      // Parse edition from NFT name if it matches the new format: "Content Name (R #000001)"
                      const editionMatch = nft.name?.match(/\(([CURLE])\s*#(\d+)\)\s*$/);
                      const edition = editionMatch ? editionMatch[2] : null;

                      return (
                        <div
                          key={nft.nftAsset.toBase58()}
                          className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden hover:border-gray-700 transition-colors"
                        >
                          {/* Image */}
                          <div className="aspect-square bg-gray-800 relative">
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
                            {/* Rarity badge overlay */}
                            {rarity !== undefined && (
                              <div className="absolute top-2 left-2">
                                <RarityBadge rarity={rarity} size="sm" showGlow />
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <h3 className="font-medium text-sm truncate">{title}</h3>
                                {edition ? (
                                  <p className="text-xs text-gray-400 mt-0.5">
                                    Edition <span className="font-mono">#{edition}</span>
                                  </p>
                                ) : (
                                  <p className="text-[10px] text-gray-500 font-mono break-all mt-1">
                                    {nft.nftAsset.toBase58()}
                                  </p>
                                )}
                              </div>
                              {isOwnProfile && nft.contentCid && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openBurnModal(nft.nftAsset, nft.contentCid!, title, previewUrl);
                                  }}
                                  className="flex-shrink-0 p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
                                  title="Burn NFT"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* Members Tab - Creators this user has active memberships with */}
            {activeTab === "members" && (
              <>
                {isLoadingMemberships ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400"></div>
                  </div>
                ) : activeMemberships.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium mb-2">No active memberships</h3>
                    <p className="text-gray-400">This user hasn't joined any creator memberships yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeMemberships.map((membership) => {
                      const creatorProfile = membershipCreatorProfiles.get(membership.creatorAddress);
                      const displayName = creatorProfile?.username || `${membership.creatorAddress.slice(0, 4)}...${membership.creatorAddress.slice(-4)}`;
                      const daysRemaining = Math.max(0, Math.ceil((membership.endTime - Math.floor(Date.now() / 1000)) / (24 * 60 * 60)));
                      const memberSince = new Date(membership.startTime * 1000).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      });

                      return (
                        <Link
                          key={membership.streamId}
                          href={`/profile/${membership.creatorAddress}`}
                          className="bg-gray-900 rounded-xl border border-gray-800 p-4 hover:border-primary-500/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {/* Creator Avatar */}
                            <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0">
                              {(creatorProfile?.username || membership.creatorAddress).charAt(0).toUpperCase()}
                            </div>

                            {/* Creator Info */}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium truncate">{displayName}</h3>
                              <p className="text-sm text-gray-400">Member since {memberSince}</p>
                            </div>
                          </div>

                          {/* Membership Status */}
                          <div className="mt-3 pt-3 border-t border-gray-800 flex items-center justify-between">
                            <span className="text-xs text-green-400 flex items-center gap-1">
                              <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                              Active
                            </span>
                            <span className="text-xs text-gray-400">
                              {daysRemaining} days remaining
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </main>

      {/* Burn NFT Modal */}
      {burnModalData && (
        <BurnNftModal
          isOpen={!!burnModalData}
          onClose={() => setBurnModalData(null)}
          nftAsset={burnModalData.nftAsset}
          collectionAsset={burnModalData.collectionAsset}
          contentCid={burnModalData.contentCid}
          nftTitle={burnModalData.title}
          previewUrl={burnModalData.previewUrl}
          onSuccess={handleBurnSuccess}
        />
      )}
    </div>
  );
}
