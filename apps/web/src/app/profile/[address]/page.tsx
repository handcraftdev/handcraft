"use client";

import { useState, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SidebarPanel } from "@/components/sidebar";
import { useContentRegistry } from "@/hooks/useContentRegistry";
import { BurnNftModal } from "@/components/nft";
import { RarityBadge } from "@/components/rarity";
import { CreatorMembershipBanner, EcosystemMembershipCard, CustomMembershipCard, CreatorPatronPoolCard } from "@/components/membership";
import { getIpfsUrl, getContentPda, Rarity, getRarityFromWeight, getCreatorPatronTreasuryPda, StreamflowClient, NETWORKS } from "@handcraft/sdk";
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [burnModalData, setBurnModalData] = useState<{
    nftAsset: PublicKey;
    collectionAsset: PublicKey;
    contentCid: string;
    title: string;
    previewUrl: string | null;
  } | null>(null);

  const toggleSidebar = useCallback(() => setIsSidebarOpen(prev => !prev), []);

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

  // Fetch owned bundle NFTs
  const { data: ownedBundleNfts = [], isLoading: isLoadingBundleNfts } = useQuery({
    queryKey: ["profileBundleNfts", profileAddress?.toBase58()],
    queryFn: async () => {
      if (!profileAddress || !client) return [];
      return client.fetchWalletBundleNftMetadata(profileAddress);
    },
    enabled: !!profileAddress && !!client,
    staleTime: 60000,
  });

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

  // Fetch rarities for owned bundle NFTs
  const { data: bundleNftRarities = new Map<string, Rarity>() } = useQuery({
    queryKey: ["profileBundleNftRarities", profileAddress?.toBase58(), ownedBundleNfts.length],
    queryFn: async () => {
      if (!profileAddress || !client || ownedBundleNfts.length === 0) return new Map<string, Rarity>();
      const nftAssets = ownedBundleNfts.map(nft => nft.nftAsset);
      const rewardStates = await client.fetchBundleNftRewardStatesBatch(nftAssets);
      const result = new Map<string, Rarity>();
      for (const [key, state] of rewardStates) {
        result.set(key, getRarityFromWeight(state.weight));
      }
      return result;
    },
    enabled: !!profileAddress && !!client && ownedBundleNfts.length > 0,
    staleTime: 300000,
  });

  // Filter to this user's content
  const userContent = useMemo(() => {
    if (!profileAddress) return [];
    return globalContent.filter(c => c.creator?.toBase58() === profileAddress.toBase58());
  }, [globalContent, profileAddress]);

  // Build a map from contentPda -> ContentEntry for getting collectionAsset
  // NOTE: ContentCollection removed - collectionAsset now stored directly in ContentEntry
  const contentByPda = useMemo(() => {
    const map = new Map<string, { collectionAsset: PublicKey }>();
    for (const content of globalContent) {
      // Use pubkey (content PDA) if available, otherwise try deriving from contentCid
      if (content.collectionAsset && content.pubkey) {
        map.set(content.pubkey.toBase58(), { collectionAsset: content.collectionAsset });
      }
    }
    return map;
  }, [globalContent]);

  // Also build a map by collectionAsset for reverse lookup
  const contentByCollection = useMemo(() => {
    const map = new Map<string, { collectionAsset: PublicKey; pubkey?: PublicKey }>();
    for (const content of globalContent) {
      if (content.collectionAsset) {
        map.set(content.collectionAsset.toBase58(), {
          collectionAsset: content.collectionAsset,
          pubkey: content.pubkey
        });
      }
    }
    return map;
  }, [globalContent]);

  // Open burn NFT modal
  const openBurnModal = (nftAsset: PublicKey, contentCid: string, title: string, previewUrl: string | null) => {
    // Get collection asset from content entry using contentCid
    const [contentPda] = getContentPda(contentCid);
    const content = contentByPda.get(contentPda.toBase58());

    if (!content) {
      console.error("Content not found for this NFT - contentCid:", contentCid);
      return;
    }

    setBurnModalData({
      nftAsset,
      collectionAsset: content.collectionAsset,
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
      collectedCount: ownedNfts.length + ownedBundleNfts.length,
      membershipCount: activeMemberships.length,
    };
  }, [userContent, ownedNfts, ownedBundleNfts, activeMemberships]);

  const fullAddress = profileAddress?.toBase58() || "";

  // Invalid address
  if (!profileAddress) {
    return (
      <div className="min-h-screen bg-black text-white">
        <SidebarPanel isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

        {/* Menu Button */}
        <button
          onClick={toggleSidebar}
          className="fixed top-4 left-4 z-50 p-3 bg-white/5 backdrop-blur-md rounded-full border border-white/10 hover:border-white/20 transition-all"
        >
          <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="flex items-center justify-center min-h-screen px-6">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-3 tracking-tight">Invalid Address</h1>
            <p className="text-white/40 max-w-sm mx-auto">The provided wallet address is not valid</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <SidebarPanel isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Menu Button */}
      <button
        onClick={toggleSidebar}
        className={`fixed top-4 z-50 p-3 bg-white/5 backdrop-blur-md rounded-full border border-white/10 hover:border-white/20 transition-all duration-300 ${isSidebarOpen ? 'left-[304px]' : 'left-4'}`}
      >
        <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <main className="max-w-5xl mx-auto px-6 py-20">
        {/* Profile Header */}
        <div className="relative rounded-3xl overflow-hidden mb-10">
          {/* Gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-transparent" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/[0.02] rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

          <div className="relative p-8 border border-white/10 rounded-3xl">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              {/* Avatar */}
              <div className="w-24 h-24 bg-gradient-to-br from-white/20 to-white/5 rounded-full flex items-center justify-center text-4xl font-bold border border-white/10">
                {profileData?.username?.charAt(0).toUpperCase() || fullAddress.charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-3 mb-2">
                  {profileData?.username && (
                    <h1 className="text-2xl font-bold tracking-tight">{profileData.username}</h1>
                  )}
                  {isOwnProfile && (
                    <span className="px-2.5 py-1 bg-white/10 text-white/70 text-[10px] uppercase tracking-wider rounded-full border border-white/10">
                      You
                    </span>
                  )}
                </div>

                <p className={`font-mono break-all ${profileData?.username ? "text-sm text-white/40" : "text-lg font-bold text-white/90"}`}>
                  {fullAddress}
                </p>

                <button
                  onClick={() => navigator.clipboard.writeText(fullAddress)}
                  className="mt-2 inline-flex items-center gap-2 text-xs text-white/40 hover:text-white/60 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy address
                </button>

                {/* Stats Row */}
                <div className="flex items-center justify-center sm:justify-start gap-8 mt-6">
                  <div>
                    <p className="text-2xl font-bold tracking-tight">{stats.contentCount}</p>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">Created</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold tracking-tight">{stats.collectedCount}</p>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">Collected</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold tracking-tight">{stats.totalMints}</p>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">Sold</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Membership Banners */}
        {isOwnProfile ? (
          <div className="mb-10">
            <EcosystemMembershipCard />
          </div>
        ) : (
          <div className="mb-10 space-y-4">
            <CreatorMembershipBanner creator={profileAddress} />
            <CustomMembershipCard creator={profileAddress} />
            <CreatorPatronPoolCard creator={profileAddress} />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-8">
          {[
            { key: "content", label: "Created", count: stats.contentCount },
            { key: "collected", label: "Collected", count: stats.collectedCount },
            { key: "members", label: "Members", count: stats.membershipCount },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as Tab)}
              className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
                activeTab === tab.key
                  ? "bg-white text-black"
                  : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80 border border-white/10"
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Content Grid */}
        {activeTab === "content" && (
          <>
            {userContent.length === 0 ? (
              <div className="relative p-16 rounded-2xl bg-white/[0.02] border border-white/5 text-center">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium mb-2">No content yet</h3>
                <p className="text-white/40 text-sm">This user hasn't uploaded any content</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {userContent.map((item) => {
                  const metadata = (item as any).metadata;
                  const title = metadata?.title || metadata?.name || "Untitled";
                  const description = metadata?.description || "";
                  const thumbnailUrl = metadata?.image || null;

                  return (
                    <div
                      key={item.pubkey?.toBase58() || item.collectionAsset?.toBase58() || Math.random()}
                      className="group relative rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden hover:border-white/10 transition-all duration-300"
                    >
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                      {/* Thumbnail */}
                      <div className="aspect-video bg-white/5 relative">
                        {thumbnailUrl ? (
                          <img
                            src={thumbnailUrl}
                            alt={title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg className="w-12 h-12 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                        {item.isEncrypted && (
                          <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-full text-[10px] flex items-center gap-1 text-white/70">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            Gated
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="relative p-4">
                        <h3 className="font-medium mb-1 truncate text-white/90">{title}</h3>
                        {description && (
                          <p className="text-sm text-white/40 line-clamp-2 mb-3">{description}</p>
                        )}
                        <div className="text-xs text-white/30">
                          <span>{Number(item.mintedCount || 0)} sold</span>
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
            {(isLoadingNfts || isLoadingRentals || isLoadingBundleNfts) ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              </div>
            ) : (ownedNfts.length === 0 && ownedBundleNfts.length === 0) ? (
              <div className="relative p-16 rounded-2xl bg-white/[0.02] border border-white/5 text-center">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium mb-2">No NFTs collected</h3>
                <p className="text-white/40 text-sm">This user hasn't collected any NFTs yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {/* Content NFTs */}
                {ownedNfts.map((nft) => {
                  // Match NFT to content using collectionAsset (contentCid removed from ContentEntry)
                  const contentData = nft.collectionAsset
                    ? globalContent.find(c => c.collectionAsset?.toBase58() === nft.collectionAsset?.toBase58())
                    : undefined;
                  const metadata = (contentData as any)?.metadata;
                  const title = nft.name || "Untitled";
                  const thumbnailUrl = metadata?.image || null;
                  const rarity = nftRarities.get(nft.nftAsset.toBase58());
                  const editionMatch = nft.name?.match(/\(([CURLE])\s*#(\d+)\)\s*$/);
                  const edition = editionMatch ? editionMatch[2] : null;

                  return (
                    <div
                      key={nft.nftAsset.toBase58()}
                      className="group relative rounded-xl bg-white/[0.02] border border-white/5 overflow-hidden hover:border-white/10 transition-all duration-300"
                    >
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                      <div className="aspect-square bg-white/5 relative">
                        {thumbnailUrl ? (
                          <img
                            src={thumbnailUrl}
                            alt={title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg className="w-10 h-10 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                        {rarity !== undefined && (
                          <div className="absolute top-2 left-2">
                            <RarityBadge rarity={rarity} size="sm" showGlow />
                          </div>
                        )}
                      </div>

                      <div className="relative p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-medium text-sm truncate text-white/90">{title}</h3>
                            {edition ? (
                              <p className="text-[10px] text-white/40 mt-0.5">
                                Edition <span className="font-mono">#{edition}</span>
                              </p>
                            ) : (
                              <p className="text-[9px] text-white/30 font-mono break-all mt-1">
                                {nft.nftAsset.toBase58().slice(0, 8)}...
                              </p>
                            )}
                          </div>
                          {isOwnProfile && nft.contentCid && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openBurnModal(nft.nftAsset, nft.contentCid!, title, thumbnailUrl);
                              }}
                              className="flex-shrink-0 p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400/80 hover:text-red-400 transition-colors border border-red-500/20"
                              title="Burn NFT"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

                {/* Bundle NFTs */}
                {ownedBundleNfts.map((nft) => {
                  if (!nft.creator || !nft.bundleId) return null;
                  const bundleData = globalBundles.find(b =>
                    b.creator.toBase58() === nft.creator!.toBase58() && b.bundleId === nft.bundleId
                  );
                  const title = nft.name || "Untitled Bundle";
                  // Bundle on-chain data only has metadataCid, not parsed metadata
                  // Preview URL would need separate metadata fetch
                  const previewUrl: string | null = null;
                  const rarity = bundleNftRarities.get(nft.nftAsset.toBase58());
                  const editionMatch = nft.name?.match(/\(([CURLE])\s*#(\d+)\)\s*$/);
                  const edition = editionMatch ? editionMatch[2] : null;

                  return (
                    <Link
                      key={nft.nftAsset.toBase58()}
                      href={`/content/${nft.bundleId}`}
                      className="group relative rounded-xl bg-white/[0.02] border border-white/5 overflow-hidden hover:border-white/10 transition-all duration-300"
                    >
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                      <div className="aspect-square bg-white/5 relative">
                        {previewUrl ? (
                          <img
                            src={previewUrl}
                            alt={title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg className="w-10 h-10 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                          </div>
                        )}
                        {rarity !== undefined && (
                          <div className="absolute top-2 left-2">
                            <RarityBadge rarity={rarity} size="sm" showGlow />
                          </div>
                        )}
                        {/* Bundle badge */}
                        <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-purple-500/80 text-white text-[9px] font-medium rounded">
                          Bundle
                        </div>
                      </div>

                      <div className="relative p-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium text-sm truncate text-white/90">{title}</h3>
                          {edition ? (
                            <p className="text-[10px] text-white/40 mt-0.5">
                              Edition <span className="font-mono">#{edition}</span>
                            </p>
                          ) : (
                            <p className="text-[9px] text-white/30 font-mono break-all mt-1">
                              {nft.nftAsset.toBase58().slice(0, 8)}...
                            </p>
                          )}
                        </div>
                      </div>
                    </Link>
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
                <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              </div>
            ) : activeMemberships.length === 0 ? (
              <div className="relative p-16 rounded-2xl bg-white/[0.02] border border-white/5 text-center">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium mb-2">No active memberships</h3>
                <p className="text-white/40 text-sm">This user hasn't joined any creator memberships yet</p>
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
                      className="group relative p-5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all duration-300"
                    >
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                      <div className="relative flex items-center gap-4">
                        {/* Creator Avatar */}
                        <div className="w-12 h-12 bg-gradient-to-br from-white/20 to-white/5 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0 border border-white/10">
                          {(creatorProfile?.username || membership.creatorAddress).charAt(0).toUpperCase()}
                        </div>

                        {/* Creator Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium truncate text-white/90">{displayName}</h3>
                          <p className="text-xs text-white/40">Member since {memberSince}</p>
                        </div>
                      </div>

                      {/* Membership Status */}
                      <div className="relative mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-wider text-emerald-400/80 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                          Active
                        </span>
                        <span className="text-xs text-white/40">
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
