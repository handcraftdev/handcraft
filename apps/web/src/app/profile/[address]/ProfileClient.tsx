"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SidebarPanel } from "@/components/sidebar";
import { useContentRegistry } from "@/hooks/useContentRegistry";
import { BurnNftModal } from "@/components/nft";
import { RarityBadge } from "@/components/rarity";
import { CreatorMembershipBanner, EcosystemMembershipCard, CustomMembershipCard, CreatorPatronPoolCard } from "@/components/membership";
import {
  CreatorBanner,
  CreatorBio,
  CreatorAnnouncements,
  FeaturedContentGrid,
  InlineMembershipSection,
  BannerEditor,
  BioEditor,
  SocialLinksEditor,
  AnnouncementManager,
  FeaturedContentPicker,
} from "@/components/profile";
import { useCreatorLandingPage, useCreatorLandingPageMutations } from "@/hooks/useCreatorLandingPage";
import { useCreatorContent, useCreatorBundles } from "@/hooks/useCreatorContent";
import { getIpfsUrl, getContentPda, Rarity, getRarityFromWeight, getCreatorPatronTreasuryPda, StreamflowClient, NETWORKS, ContentType, BundleType, getContentTypeLabel, getBundleTypeLabel } from "@handcraft/sdk";
import { useConnection } from "@solana/wallet-adapter-react";
import Link from "next/link";

type SortOption = "recent" | "oldest" | "name";
type ItemTypeFilter = "all" | "content" | "bundle";
type ContentTypeFilter = "all" | ContentType;
type BundleTypeFilter = "all" | BundleType;

const ALL_CONTENT_TYPES: ContentType[] = [
  ContentType.Video,
  ContentType.Movie,
  ContentType.Television,
  ContentType.MusicVideo,
  ContentType.Short,
  ContentType.Music,
  ContentType.Podcast,
  ContentType.Audiobook,
  ContentType.Photo,
  ContentType.Artwork,
  ContentType.Book,
  ContentType.Comic,
  ContentType.Asset,
  ContentType.Game,
  ContentType.Software,
  ContentType.Dataset,
  ContentType.Post,
];

const ALL_BUNDLE_TYPES: BundleType[] = [
  BundleType.Album,
  BundleType.Series,
  BundleType.Playlist,
  BundleType.Course,
  BundleType.Newsletter,
  BundleType.Collection,
  BundleType.ProductPack,
];

const SOLANA_NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet") as keyof typeof NETWORKS;

type Tab = "overview" | "content" | "collected" | "memberships";

const VALID_TABS: Tab[] = ["overview", "content", "collected", "memberships"];

export default function ProfileClient() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
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

  // Get initial tab from URL or default to overview
  const tabFromUrl = searchParams.get("tab") as Tab | null;
  const initialTab = tabFromUrl && VALID_TABS.includes(tabFromUrl) ? tabFromUrl : "overview";
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  // Sync tab state with URL
  useEffect(() => {
    const urlTab = searchParams.get("tab") as Tab | null;
    if (urlTab && VALID_TABS.includes(urlTab) && urlTab !== activeTab) {
      setActiveTab(urlTab);
    }
  }, [searchParams]);

  // Update URL when tab changes
  const handleTabChange = useCallback((tab: Tab) => {
    setActiveTab(tab);
    const newUrl = tab === "overview"
      ? `/profile/${addressParam}`
      : `/profile/${addressParam}?tab=${tab}`;
    router.push(newUrl, { scroll: false });
  }, [addressParam, router]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (createdSortRef.current && !createdSortRef.current.contains(e.target as Node)) {
        setShowCreatedSort(false);
      }
      if (createdFilterRef.current && !createdFilterRef.current.contains(e.target as Node)) {
        setShowCreatedFilter(false);
      }
      if (collectedSortRef.current && !collectedSortRef.current.contains(e.target as Node)) {
        setShowCollectedSort(false);
      }
      if (collectedFilterRef.current && !collectedFilterRef.current.contains(e.target as Node)) {
        setShowCollectedFilter(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [burnModalData, setBurnModalData] = useState<{
    nftAsset: PublicKey;
    collectionAsset: PublicKey;
    contentCid: string;
    title: string;
    previewUrl: string | null;
  } | null>(null);

  // Landing page editor modal states
  const [showBannerEditor, setShowBannerEditor] = useState(false);
  const [showBioEditor, setShowBioEditor] = useState(false);
  const [showSocialLinksEditor, setShowSocialLinksEditor] = useState(false);
  const [showAnnouncementManager, setShowAnnouncementManager] = useState(false);
  const [showFeaturedContentPicker, setShowFeaturedContentPicker] = useState(false);

  // Created tab sort/filter/search/view/group state
  const [createdSort, setCreatedSort] = useState<SortOption>("recent");
  const [createdItemType, setCreatedItemType] = useState<ItemTypeFilter>("all");
  const [createdContentTypeFilter, setCreatedContentTypeFilter] = useState<ContentTypeFilter>("all");
  const [createdBundleTypeFilter, setCreatedBundleTypeFilter] = useState<BundleTypeFilter>("all");
  const [createdSearchQuery, setCreatedSearchQuery] = useState("");
  const [createdViewMode, setCreatedViewMode] = useState<"grid" | "list">("grid");
  const [createdGroupBy, setCreatedGroupBy] = useState<"none" | "type" | "domain">("none");
  const [showCreatedSort, setShowCreatedSort] = useState(false);
  const [showCreatedFilter, setShowCreatedFilter] = useState(false);
  const createdSortRef = useRef<HTMLDivElement>(null);
  const createdFilterRef = useRef<HTMLDivElement>(null);

  // Collected tab sort/filter/search/view/group state
  const [collectedSort, setCollectedSort] = useState<SortOption>("recent");
  const [collectedItemType, setCollectedItemType] = useState<ItemTypeFilter>("all");
  const [collectedContentTypeFilter, setCollectedContentTypeFilter] = useState<ContentTypeFilter>("all");
  const [collectedBundleTypeFilter, setCollectedBundleTypeFilter] = useState<BundleTypeFilter>("all");
  const [collectedSearchQuery, setCollectedSearchQuery] = useState("");
  const [collectedViewMode, setCollectedViewMode] = useState<"grid" | "list">("grid");
  const [collectedGroupBy, setCollectedGroupBy] = useState<"none" | "type" | "domain">("none");
  const [showCollectedSort, setShowCollectedSort] = useState(false);
  const [showCollectedFilter, setShowCollectedFilter] = useState(false);
  const collectedSortRef = useRef<HTMLDivElement>(null);
  const collectedFilterRef = useRef<HTMLDivElement>(null);

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

  // Fetch creator landing page data
  const {
    profileSettings: profileSettingsQuery,
    socialLinks: socialLinksQuery,
    announcements: announcementsQuery,
    featuredContent: featuredContentQuery,
    isLoading: isLoadingLandingPage,
  } = useCreatorLandingPage(profileAddress?.toBase58() ?? undefined);

  // Landing page mutations
  const {
    updateProfileSettings,
    updateSocialLinks,
    createAnnouncement,
    deleteAnnouncement,
    updateFeaturedContent,
  } = useCreatorLandingPageMutations();

  // Fetch indexed content/bundles for featured content picker
  const { data: creatorContentData } = useCreatorContent(profileAddress?.toBase58() ?? "", { limit: 100 });
  const { data: creatorBundlesData } = useCreatorBundles(profileAddress?.toBase58() ?? "", { limit: 100 });
  const indexedContent = creatorContentData?.results ?? [];
  const indexedBundles = creatorBundlesData?.results ?? [];

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

  // Filtered and sorted collected NFTs for Collected tab
  const filteredCollectedNfts = useMemo(() => {
    // Combine content and bundle NFTs
    let contentNfts = [...ownedNfts];
    let bundleNfts = [...ownedBundleNfts];

    // Search filter
    if (collectedSearchQuery) {
      const searchLower = collectedSearchQuery.toLowerCase();
      contentNfts = contentNfts.filter(nft => (nft.name || "").toLowerCase().includes(searchLower));
      bundleNfts = bundleNfts.filter(nft => (nft.name || "").toLowerCase().includes(searchLower));
    }

    // Filter by item type
    if (collectedItemType === "content") {
      bundleNfts = [];
    } else if (collectedItemType === "bundle") {
      contentNfts = [];
    }

    // Filter content NFTs by content type
    if (collectedContentTypeFilter !== "all") {
      contentNfts = contentNfts.filter(nft => {
        const contentData = nft.collectionAsset
          ? globalContent.find(c => c.collectionAsset?.toBase58() === nft.collectionAsset?.toBase58())
          : undefined;
        return contentData?.contentType === collectedContentTypeFilter;
      });
    }

    // Filter bundle NFTs by bundle type
    if (collectedBundleTypeFilter !== "all") {
      bundleNfts = bundleNfts.filter(nft => {
        if (!nft.creator || !nft.bundleId) return false;
        const bundleData = globalBundles.find(b =>
          b.creator.toBase58() === nft.creator!.toBase58() && b.bundleId === nft.bundleId
        );
        return bundleData?.bundleType === collectedBundleTypeFilter;
      });
    }

    // Sort content NFTs
    contentNfts.sort((a, b) => {
      if (collectedSort === "name") {
        return (a.name || "").localeCompare(b.name || "");
      }
      return 0;
    });

    // Sort bundle NFTs
    bundleNfts.sort((a, b) => {
      if (collectedSort === "name") {
        return (a.name || "").localeCompare(b.name || "");
      }
      return 0;
    });

    return { contentNfts, bundleNfts };
  }, [ownedNfts, ownedBundleNfts, collectedItemType, collectedContentTypeFilter, collectedBundleTypeFilter, collectedSort, collectedSearchQuery, globalContent, globalBundles]);

  // Grouped collected NFTs
  const groupedCollectedNfts = useMemo(() => {
    const { contentNfts, bundleNfts } = filteredCollectedNfts;

    if (collectedGroupBy === "none") {
      return [{ label: null as string | null, contentNfts, bundleNfts }];
    }

    // Group by type or domain
    const groups = new Map<string, { contentNfts: typeof contentNfts; bundleNfts: typeof bundleNfts }>();

    if (collectedGroupBy === "type") {
      // Group content and bundles separately
      if (contentNfts.length > 0) {
        groups.set("Content NFTs", { contentNfts, bundleNfts: [] });
      }
      if (bundleNfts.length > 0) {
        groups.set("Bundle NFTs", { contentNfts: [], bundleNfts });
      }
    } else {
      // Group by domain (content type / bundle type)
      for (const nft of contentNfts) {
        const contentData = nft.collectionAsset
          ? globalContent.find(c => c.collectionAsset?.toBase58() === nft.collectionAsset?.toBase58())
          : undefined;
        const key = contentData?.contentType !== undefined
          ? getContentTypeLabel(contentData.contentType as ContentType)
          : "Other";
        if (!groups.has(key)) groups.set(key, { contentNfts: [], bundleNfts: [] });
        groups.get(key)!.contentNfts.push(nft);
      }
      for (const nft of bundleNfts) {
        if (!nft.creator || !nft.bundleId) continue;
        const bundleData = globalBundles.find(b =>
          b.creator.toBase58() === nft.creator!.toBase58() && b.bundleId === nft.bundleId
        );
        const key = bundleData?.bundleType !== undefined
          ? getBundleTypeLabel(bundleData.bundleType)
          : "Other";
        if (!groups.has(key)) groups.set(key, { contentNfts: [], bundleNfts: [] });
        groups.get(key)!.bundleNfts.push(nft);
      }
    }

    return Array.from(groups.entries()).map(([label, items]) => ({ label, ...items }));
  }, [filteredCollectedNfts, collectedGroupBy, globalContent, globalBundles]);

  const hasCollectedFilters = collectedItemType !== "all" || collectedContentTypeFilter !== "all" || collectedBundleTypeFilter !== "all";

  // Filter handlers for Collected tab
  const handleCollectedContentTypeFilter = (type: ContentTypeFilter) => {
    setCollectedContentTypeFilter(type);
    if (type !== "all") {
      setCollectedBundleTypeFilter("all");
      setCollectedItemType("content");
    }
    setShowCollectedFilter(false);
  };

  const handleCollectedBundleTypeFilter = (type: BundleTypeFilter) => {
    setCollectedBundleTypeFilter(type);
    if (type !== "all") {
      setCollectedContentTypeFilter("all");
      setCollectedItemType("bundle");
    }
    setShowCollectedFilter(false);
  };

  const handleCollectedItemTypeChange = (type: ItemTypeFilter) => {
    setCollectedItemType(type);
    if (type === "all") {
      setCollectedContentTypeFilter("all");
      setCollectedBundleTypeFilter("all");
    }
    setShowCollectedFilter(false);
  };

  // Filter to this user's content
  const userContent = useMemo(() => {
    if (!profileAddress) return [];
    return globalContent.filter(c => c.creator?.toBase58() === profileAddress.toBase58());
  }, [globalContent, profileAddress]);

  // Filter to this user's bundles
  const userBundles = useMemo(() => {
    if (!profileAddress) return [];
    return globalBundles.filter(b => b.creator?.toBase58() === profileAddress.toBase58());
  }, [globalBundles, profileAddress]);

  // Filtered and sorted user content/bundles for Created tab
  const filteredCreatedItems = useMemo(() => {
    let contentItems = [...userContent];
    let bundleItems = [...userBundles];

    // Apply search filter
    if (createdSearchQuery) {
      const searchLower = createdSearchQuery.toLowerCase();
      contentItems = contentItems.filter(item => {
        const name = (item.collectionName || "").toLowerCase();
        const cid = (item.contentCid || "").toLowerCase();
        return name.includes(searchLower) || cid.includes(searchLower);
      });
      bundleItems = bundleItems.filter(item => {
        const name = (item.collectionName || "").toLowerCase();
        const id = (item.bundleId || "").toLowerCase();
        return name.includes(searchLower) || id.includes(searchLower);
      });
    }

    // Filter by item type
    if (createdItemType === "content") {
      bundleItems = [];
    } else if (createdItemType === "bundle") {
      contentItems = [];
    }

    // Apply content type filter
    if (createdContentTypeFilter !== "all") {
      contentItems = contentItems.filter(item => item.contentType === createdContentTypeFilter);
    }

    // Apply bundle type filter
    if (createdBundleTypeFilter !== "all") {
      bundleItems = bundleItems.filter(item => item.bundleType === createdBundleTypeFilter);
    }

    // Sort content
    contentItems.sort((a, b) => {
      if (createdSort === "name") {
        const nameA = a.collectionName || "";
        const nameB = b.collectionName || "";
        return nameA.localeCompare(nameB);
      }
      const timeA = a.createdAt ? Number(a.createdAt) : 0;
      const timeB = b.createdAt ? Number(b.createdAt) : 0;
      return createdSort === "recent" ? timeB - timeA : timeA - timeB;
    });

    // Sort bundles
    bundleItems.sort((a, b) => {
      if (createdSort === "name") {
        const nameA = a.collectionName || "";
        const nameB = b.collectionName || "";
        return nameA.localeCompare(nameB);
      }
      const timeA = a.createdAt ? Number(a.createdAt) : 0;
      const timeB = b.createdAt ? Number(b.createdAt) : 0;
      return createdSort === "recent" ? timeB - timeA : timeA - timeB;
    });

    return { contentItems, bundleItems };
  }, [userContent, userBundles, createdSort, createdItemType, createdContentTypeFilter, createdBundleTypeFilter, createdSearchQuery]);

  // Grouped created items
  const groupedCreatedItems = useMemo(() => {
    const { contentItems, bundleItems } = filteredCreatedItems;

    if (createdGroupBy === "none") {
      return [{ label: null as string | null, contentItems, bundleItems }];
    }

    // Group by type or domain
    const groups = new Map<string, { contentItems: typeof contentItems; bundleItems: typeof bundleItems }>();

    if (createdGroupBy === "type") {
      // Group content and bundles separately
      if (contentItems.length > 0) {
        groups.set("Content", { contentItems, bundleItems: [] });
      }
      if (bundleItems.length > 0) {
        const existing = groups.get("Bundles") || { contentItems: [], bundleItems: [] };
        groups.set("Bundles", { ...existing, bundleItems });
      }
    } else {
      // Group by domain (content type / bundle type)
      for (const item of contentItems) {
        const key = getContentTypeLabel(item.contentType as ContentType);
        if (!groups.has(key)) groups.set(key, { contentItems: [], bundleItems: [] });
        groups.get(key)!.contentItems.push(item);
      }
      for (const item of bundleItems) {
        const key = getBundleTypeLabel(item.bundleType);
        if (!groups.has(key)) groups.set(key, { contentItems: [], bundleItems: [] });
        groups.get(key)!.bundleItems.push(item);
      }
    }

    return Array.from(groups.entries()).map(([label, items]) => ({ label, ...items }));
  }, [filteredCreatedItems, createdGroupBy]);

  const hasCreatedFilters = createdItemType !== "all" || createdContentTypeFilter !== "all" || createdBundleTypeFilter !== "all";

  // Filter handlers for Created tab
  const handleCreatedContentTypeFilter = (type: ContentTypeFilter) => {
    setCreatedContentTypeFilter(type);
    if (type !== "all") {
      setCreatedBundleTypeFilter("all");
      setCreatedItemType("content");
    }
    setShowCreatedFilter(false);
  };

  const handleCreatedBundleTypeFilter = (type: BundleTypeFilter) => {
    setCreatedBundleTypeFilter(type);
    if (type !== "all") {
      setCreatedContentTypeFilter("all");
      setCreatedItemType("bundle");
    }
    setShowCreatedFilter(false);
  };

  const handleCreatedItemTypeChange = (type: ItemTypeFilter) => {
    setCreatedItemType(type);
    if (type === "all") {
      setCreatedContentTypeFilter("all");
      setCreatedBundleTypeFilter("all");
    }
    setShowCreatedFilter(false);
  };

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
        className={`fixed top-4 z-50 p-3 bg-white/5 backdrop-blur-md rounded-full border border-white/10 hover:border-white/20 transition-all duration-300 ${isSidebarOpen ? 'left-[264px]' : 'left-4'}`}
      >
        <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Compact header bar */}
      <div className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3 min-w-0">
              {/* Avatar */}
              <div className="w-8 h-8 bg-gradient-to-br from-white/20 to-white/5 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                {profileData?.username?.charAt(0).toUpperCase() || fullAddress.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-base font-medium text-white truncate">
                    {profileData?.username || `${fullAddress.slice(0, 4)}...${fullAddress.slice(-4)}`}
                  </span>
                  {isOwnProfile && (
                    <span className="px-1.5 py-0.5 bg-white/10 text-white/60 text-2xs uppercase tracking-wider rounded-md flex-shrink-0">You</span>
                  )}
                </div>
              </div>
            </div>

            {/* Compact stats */}
            <div className="hidden sm:flex items-center gap-4 text-sm">
              <div className="text-center">
                <span className="font-medium text-white">{stats.contentCount}</span>
                <span className="text-white/40 ml-1">created</span>
              </div>
              <div className="w-px h-3 bg-white/10" />
              <div className="text-center">
                <span className="font-medium text-white">{stats.collectedCount}</span>
                <span className="text-white/40 ml-1">collected</span>
              </div>
              <div className="w-px h-3 bg-white/10" />
              <div className="text-center">
                <span className="font-medium text-white">{stats.totalMints}</span>
                <span className="text-white/40 ml-1">sold</span>
              </div>
            </div>
          </div>

          {/* Tabs in header */}
          <div className="flex items-center gap-1 pb-3 overflow-x-auto no-scrollbar">
            {["Overview", "Created", "Collected", "Memberships"].map((label) => {
              const key = label.toLowerCase() === "created" ? "content" : label.toLowerCase();
              return (
                <button
                  key={key}
                  onClick={() => handleTabChange(key as Tab)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                    activeTab === key
                      ? "bg-white text-black"
                      : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
        {/* Creator Banner */}
        <CreatorBanner
          bannerCid={profileSettingsQuery.data?.banner_cid ?? null}
          bannerUrl={profileSettingsQuery.data?.banner_url ?? null}
          username={profileData?.username}
          isEditable={!!isOwnProfile}
          onEdit={() => setShowBannerEditor(true)}
        />

        {/* Profile Header - compact */}
        <div className="relative rounded-xl overflow-hidden mb-6 -mt-8">
          <div className="relative p-4 sm:p-5 border border-white/[0.06] rounded-xl bg-black/80 backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
              {/* Avatar */}
              <div className="w-16 h-16 bg-gradient-to-br from-white/20 to-white/5 rounded-full flex items-center justify-center text-2xl font-bold border border-white/10 flex-shrink-0">
                {profileData?.username?.charAt(0).toUpperCase() || fullAddress.charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 text-center sm:text-left min-w-0">
                <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                  {profileData?.username && (
                    <h1 className="text-lg font-medium text-white">{profileData.username}</h1>
                  )}
                </div>

                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <p className="font-mono text-sm text-white/40 truncate max-w-[200px]">
                    {fullAddress}
                  </p>
                  <button
                    onClick={() => navigator.clipboard.writeText(fullAddress)}
                    className="p-1 hover:bg-white/5 rounded transition-colors"
                  >
                    <svg className="w-3 h-3 text-white/30 hover:text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>

                {/* Mobile stats */}
                <div className="flex items-center justify-center sm:hidden gap-4 mt-3 text-xs">
                  <span><strong className="text-white">{stats.contentCount}</strong> <span className="text-white/40">created</span></span>
                  <span><strong className="text-white">{stats.collectedCount}</strong> <span className="text-white/40">collected</span></span>
                  <span><strong className="text-white">{stats.totalMints}</strong> <span className="text-white/40">sold</span></span>
                </div>

                {/* Bio & Social Links */}
                <div className="mt-3 pt-3 border-t border-white/[0.04]">
                  <CreatorBio
                    bio={profileSettingsQuery.data?.bio ?? null}
                    tagline={profileSettingsQuery.data?.tagline ?? null}
                    socialLinks={socialLinksQuery.data ?? []}
                    isEditable={!!isOwnProfile}
                    onEditBio={() => setShowBioEditor(true)}
                    onEditLinks={() => setShowSocialLinksEditor(true)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-8">
            {/* Announcements */}
            <CreatorAnnouncements
              announcements={announcementsQuery.data ?? []}
              isEditable={!!isOwnProfile}
              onEdit={() => setShowAnnouncementManager(true)}
              onDelete={async (id) => {
                try {
                  await deleteAnnouncement.mutateAsync(id);
                } catch (err) {
                  console.error("Failed to delete announcement:", err);
                }
              }}
            />

            {/* Featured Content */}
            <FeaturedContentGrid
              featuredContent={featuredContentQuery.data ?? []}
              contentData={indexedContent}
              bundleData={indexedBundles}
              isEditable={!!isOwnProfile}
              onEdit={() => setShowFeaturedContentPicker(true)}
            />

            {/* Inline Membership for non-owners */}
            {!isOwnProfile && profileAddress && (
              <InlineMembershipSection
                creator={profileAddress}
                creatorUsername={profileData?.username}
              />
            )}

            {/* Membership Cards */}
            {isOwnProfile ? (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider">Your Membership</h3>
                <EcosystemMembershipCard />
                <CreatorPatronPoolCard creator={profileAddress} />
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider">Creator Membership</h3>
                <CreatorMembershipBanner creator={profileAddress} />
                <CustomMembershipCard creator={profileAddress} />
                <CreatorPatronPoolCard creator={profileAddress} />
              </div>
            )}

            {/* Recent Activity Preview */}
            {userContent.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider">Recent Creations</h3>
                  <button
                    onClick={() => handleTabChange("content")}
                    className="text-xs text-white/40 hover:text-white/60 transition-colors"
                  >
                    View all →
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {userContent.slice(0, 4).map((item) => {
                    const title = item.collectionName || "Untitled";
                    const thumbnailUrl = item.thumbnail || null;

                    return (
                      <Link
                        key={item.pubkey?.toBase58() || item.collectionAsset?.toBase58() || Math.random().toString()}
                        href={item.contentCid ? `/content/${item.contentCid}` : "#"}
                        className="group relative rounded-xl bg-white/[0.02] border border-white/5 overflow-hidden hover:border-white/10 transition-all duration-300"
                      >
                        <div className="aspect-square bg-white/5 relative">
                          {thumbnailUrl ? (
                            <img
                              src={thumbnailUrl}
                              alt={title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <svg className="w-8 h-8 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="p-2">
                          <h3 className="font-medium text-xs truncate text-white/90">{title}</h3>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent Collections Preview */}
            {(ownedNfts.length > 0 || ownedBundleNfts.length > 0) && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider">Recent Collections</h3>
                  <button
                    onClick={() => handleTabChange("collected")}
                    className="text-xs text-white/40 hover:text-white/60 transition-colors"
                  >
                    View all →
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[...ownedNfts, ...ownedBundleNfts].slice(0, 4).map((nft) => {
                    const contentData = nft.collectionAsset
                      ? globalContent.find(c => c.collectionAsset?.toBase58() === nft.collectionAsset?.toBase58())
                      : undefined;
                    const title = nft.name || "Untitled";
                    const thumbnailUrl = contentData?.thumbnail || null;
                    const rarity = nftRarities.get(nft.nftAsset.toBase58()) || bundleNftRarities.get(nft.nftAsset.toBase58());

                    return (
                      <div
                        key={nft.nftAsset.toBase58()}
                        className="group relative rounded-xl bg-white/[0.02] border border-white/5 overflow-hidden hover:border-white/10 transition-all duration-300"
                      >
                        <div className="aspect-square bg-white/5 relative">
                          {thumbnailUrl ? (
                            <img
                              src={thumbnailUrl}
                              alt={title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <svg className="w-8 h-8 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                        <div className="p-2">
                          <h3 className="font-medium text-xs truncate text-white/90">{title}</h3>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Content Grid */}
        {activeTab === "content" && (
          <>
            {/* Controls Bar */}
            {(userContent.length > 0 || userBundles.length > 0) && (
              <div className="flex items-center justify-end gap-2 mb-4">
                {/* Search */}
                <div className="relative flex-1 max-w-xs mr-auto">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={createdSearchQuery}
                    onChange={(e) => setCreatedSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="w-full pl-8 pr-3 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 transition-all"
                  />
                </div>

                <div className="flex items-center gap-1">
                  {/* Sort Dropdown */}
                  <div ref={createdSortRef} className="relative">
                    <button
                      onClick={() => { setShowCreatedSort(!showCreatedSort); setShowCreatedFilter(false); }}
                      className={`p-1.5 rounded-lg transition-all duration-200 ${showCreatedSort ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}
                      title={`Sort by: ${createdSort}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7h6M3 12h9m-9 5h12M17 3v18m0 0l-3-3m3 3l3-3" />
                      </svg>
                    </button>
                    {showCreatedSort && (
                      <div className="absolute right-0 top-full mt-2 w-40 bg-black/95 backdrop-blur-xl border border-white/[0.08] rounded-lg shadow-xl z-50 overflow-hidden">
                        <div className="p-2">
                          <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1.5 px-1">Sort By</p>
                          <div className="flex flex-col gap-1">
                            {[{ value: "recent", label: "Recent" }, { value: "oldest", label: "Oldest" }, { value: "name", label: "Name" }].map((opt) => (
                              <button key={opt.value} onClick={() => { setCreatedSort(opt.value as SortOption); setShowCreatedSort(false); }} className={`px-2 py-1.5 text-sm font-medium rounded-md transition-all duration-200 text-left ${createdSort === opt.value ? "bg-white text-black" : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"}`}>{opt.label}</button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Filter Dropdown */}
                  <div ref={createdFilterRef} className="relative">
                    <button
                      onClick={() => { setShowCreatedFilter(!showCreatedFilter); setShowCreatedSort(false); }}
                      className={`p-1.5 rounded-lg transition-all duration-200 ${hasCreatedFilters ? "bg-purple-500/20 text-purple-300" : showCreatedFilter ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}
                      title="Filter"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                      </svg>
                      {hasCreatedFilters && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-purple-400 rounded-full" />}
                    </button>
                    {showCreatedFilter && (
                      <div className="absolute right-0 top-full mt-2 w-56 bg-black/95 backdrop-blur-xl border border-white/[0.08] rounded-lg shadow-xl z-50 overflow-hidden max-h-[70vh] overflow-y-auto">
                        {/* Item Type Section */}
                        <div className="p-2 border-b border-white/[0.06]">
                          <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1.5 px-1">Item Type</p>
                          <div className="flex items-center gap-1">
                            {[
                              { value: "all", label: "All" },
                              { value: "content", label: "Content" },
                              { value: "bundle", label: "Bundle" },
                            ].map((option) => (
                              <button
                                key={option.value}
                                onClick={() => handleCreatedItemTypeChange(option.value as ItemTypeFilter)}
                                className={`flex-1 px-2 py-1.5 text-sm font-medium rounded-md capitalize transition-all duration-200 ${
                                  createdItemType === option.value
                                    ? "bg-white text-black"
                                    : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
                                }`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Content Type Section */}
                        {createdItemType !== "bundle" && createdBundleTypeFilter === "all" && (
                          <div className="p-2 border-b border-white/[0.06]">
                            <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1.5 px-1">Content Type</p>
                            <div className="flex flex-wrap gap-1">
                              <button
                                onClick={() => handleCreatedContentTypeFilter("all")}
                                className={`px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                                  createdContentTypeFilter === "all"
                                    ? "bg-white text-black"
                                    : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
                                }`}
                              >
                                All
                              </button>
                              {ALL_CONTENT_TYPES.map((type) => (
                                <button
                                  key={type}
                                  onClick={() => handleCreatedContentTypeFilter(type)}
                                  className={`px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                                    createdContentTypeFilter === type
                                      ? "bg-white text-black"
                                      : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
                                  }`}
                                >
                                  {getContentTypeLabel(type)}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Bundle Type Section */}
                        {createdItemType !== "content" && createdContentTypeFilter === "all" && (
                          <div className="p-2 border-b border-white/[0.06]">
                            <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1.5 px-1">Bundle Type</p>
                            <div className="flex flex-wrap gap-1">
                              <button
                                onClick={() => handleCreatedBundleTypeFilter("all")}
                                className={`px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                                  createdBundleTypeFilter === "all"
                                    ? "bg-white text-black"
                                    : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
                                }`}
                              >
                                All
                              </button>
                              {ALL_BUNDLE_TYPES.map((type) => (
                                <button
                                  key={type}
                                  onClick={() => handleCreatedBundleTypeFilter(type)}
                                  className={`px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                                    createdBundleTypeFilter === type
                                      ? "bg-white text-black"
                                      : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
                                  }`}
                                >
                                  {getBundleTypeLabel(type)}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Clear button */}
                        {hasCreatedFilters && (
                          <div className="p-2">
                            <button
                              onClick={() => { handleCreatedItemTypeChange("all"); setShowCreatedFilter(false); }}
                              className="w-full px-2 py-1.5 text-sm font-medium text-white/50 hover:text-white/70 hover:bg-white/[0.04] rounded transition-all"
                            >
                              Clear all filters
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Group Toggle */}
                  <button
                    onClick={() => setCreatedGroupBy(createdGroupBy === "none" ? "type" : createdGroupBy === "type" ? "domain" : "none")}
                    className={`p-1.5 rounded-lg transition-all duration-200 ${createdGroupBy !== "none" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}
                    title={`Group by: ${createdGroupBy}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                    </svg>
                  </button>

                  {/* View Toggle */}
                  <div className="flex items-center bg-white/[0.03] rounded-lg p-0.5 ml-1">
                    <button onClick={() => setCreatedViewMode("grid")} className={`p-1.5 rounded-md transition-all duration-200 ${createdViewMode === "grid" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}>
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16"><path d="M1 2.5A1.5 1.5 0 012.5 1h3A1.5 1.5 0 017 2.5v3A1.5 1.5 0 015.5 7h-3A1.5 1.5 0 011 5.5v-3zm8 0A1.5 1.5 0 0110.5 1h3A1.5 1.5 0 0115 2.5v3A1.5 1.5 0 0113.5 7h-3A1.5 1.5 0 019 5.5v-3zm-8 8A1.5 1.5 0 012.5 9h3A1.5 1.5 0 017 10.5v3A1.5 1.5 0 015.5 15h-3A1.5 1.5 0 011 13.5v-3zm8 0A1.5 1.5 0 0110.5 9h3a1.5 1.5 0 011.5 1.5v3a1.5 1.5 0 01-1.5 1.5h-3A1.5 1.5 0 019 13.5v-3z"/></svg>
                    </button>
                    <button onClick={() => setCreatedViewMode("list")} className={`p-1.5 rounded-md transition-all duration-200 ${createdViewMode === "list" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}>
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16"><path fillRule="evenodd" d="M2.5 12a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5zm0-4a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5zm0-4a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5z"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {(userContent.length === 0 && userBundles.length === 0) ? (
              <div className="relative p-16 rounded-2xl bg-white/[0.02] border border-white/5 text-center">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium mb-2">No content yet</h3>
                <p className="text-white/40 text-sm">This user hasn't uploaded any content</p>
              </div>
            ) : (filteredCreatedItems.contentItems.length === 0 && filteredCreatedItems.bundleItems.length === 0) ? (
              <div className="relative p-16 rounded-2xl bg-white/[0.02] border border-white/5 text-center">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium mb-2">No matching content</h3>
                <p className="text-white/40 text-sm">Try adjusting your filters</p>
              </div>
            ) : (
              <div className="space-y-6">
                {groupedCreatedItems.map((group, groupIndex) => (
                  <div key={group.label || groupIndex}>
                    {group.label && (
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-sm font-medium text-white/50 uppercase tracking-wider">{group.label}</span>
                        <div className="flex-1 h-px bg-gradient-to-r from-white/[0.08] to-transparent" />
                        <span className="text-sm text-white/30">{group.contentItems.length + group.bundleItems.length}</span>
                      </div>
                    )}
                    {createdViewMode === "grid" ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                        {/* Content Items */}
                        {group.contentItems.map((item) => {
                          const title = item.collectionName || "Untitled";
                          const thumbnailUrl = item.thumbnail || null;
                          return (
                            <Link key={item.pubkey?.toBase58() || item.collectionAsset?.toBase58() || Math.random().toString()} href={item.contentCid ? `/content/${item.contentCid}` : "#"} className="group relative rounded-xl bg-white/[0.02] border border-white/5 overflow-hidden hover:border-white/10 transition-all duration-300">
                              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                              <div className="aspect-square bg-white/5 relative">
                                {thumbnailUrl ? <img src={thumbnailUrl} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" /> : (
                                  <div className="w-full h-full flex items-center justify-center"><svg className="w-10 h-10 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>
                                )}
                                {item.isEncrypted && <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-full text-xs flex items-center gap-1 text-white/70"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>Gated</div>}
                              </div>
                              <div className="relative p-3">
                                <h3 className="font-medium text-sm truncate text-white/90">{title}</h3>
                                <div className="text-xs text-white/40 mt-1">{Number(item.mintedCount || 0)} sold</div>
                              </div>
                            </Link>
                          );
                        })}
                        {/* Bundle Items */}
                        {group.bundleItems.map((bundle) => {
                          const title = bundle.collectionName || bundle.bundleId || "Untitled Bundle";
                          const thumbnailUrl = bundle.thumbnail || null;
                          const hasMintConfig = !!bundle.collectionAsset;
                          return (
                            <Link key={bundle.bundleId} href={`/content/${bundle.bundleId}`} className="group relative rounded-xl bg-white/[0.02] border border-white/5 overflow-hidden hover:border-white/10 transition-all duration-300">
                              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                              <div className="aspect-square bg-white/5 relative">
                                {thumbnailUrl ? (
                                  <img src={thumbnailUrl} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <svg className="w-10 h-10 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                  </div>
                                )}
                                <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-purple-500/80 text-white text-2xs font-medium rounded">Bundle</div>
                                {!hasMintConfig && (
                                  <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-amber-500/80 text-white text-2xs font-medium rounded">Draft</div>
                                )}
                              </div>
                              <div className="relative p-3">
                                <h3 className="font-medium text-sm truncate text-white/90">{title}</h3>
                                <div className="text-xs text-white/40 mt-1">{getBundleTypeLabel(bundle.bundleType)} · {bundle.itemCount} items</div>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {/* Content Items */}
                        {group.contentItems.map((item) => {
                          const title = item.collectionName || "Untitled";
                          const thumbnailUrl = item.thumbnail || null;
                          return (
                            <Link key={item.pubkey?.toBase58() || item.collectionAsset?.toBase58() || Math.random().toString()} href={item.contentCid ? `/content/${item.contentCid}` : "#"} className="group flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all duration-200">
                              <div className="w-14 h-14 bg-white/5 rounded-lg overflow-hidden flex-shrink-0">
                                {thumbnailUrl ? <img src={thumbnailUrl} alt={title} className="w-full h-full object-cover" /> : (
                                  <div className="w-full h-full flex items-center justify-center"><svg className="w-6 h-6 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-medium text-base truncate text-white/90">{title}</h3>
                                <div className="flex items-center gap-2 mt-0.5 text-sm text-white/40">
                                  <span>{getContentTypeLabel(item.contentType as ContentType)}</span>
                                  <span>·</span>
                                  <span>{Number(item.mintedCount || 0)} sold</span>
                                  {item.isEncrypted && <><span>·</span><span className="text-amber-400/70">Gated</span></>}
                                </div>
                              </div>
                              <svg className="w-4 h-4 text-white/20 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </Link>
                          );
                        })}
                        {/* Bundle Items */}
                        {group.bundleItems.map((bundle) => {
                          const title = bundle.collectionName || bundle.bundleId || "Untitled Bundle";
                          const thumbnailUrl = bundle.thumbnail || null;
                          const hasMintConfig = !!bundle.collectionAsset;
                          return (
                            <Link key={bundle.bundleId} href={`/content/${bundle.bundleId}`} className="group flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all duration-200">
                              <div className="w-14 h-14 bg-white/5 rounded-lg overflow-hidden flex-shrink-0 relative">
                                {thumbnailUrl ? (
                                  <img src={thumbnailUrl} alt={title} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <svg className="w-6 h-6 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-medium text-base truncate text-white/90">{title}</h3>
                                <div className="flex items-center gap-2 mt-0.5 text-sm text-white/40">
                                  <span className="text-purple-400/80">Bundle</span>
                                  <span>·</span>
                                  <span>{getBundleTypeLabel(bundle.bundleType)}</span>
                                  <span>·</span>
                                  <span>{bundle.itemCount} items</span>
                                  {!hasMintConfig && <><span>·</span><span className="text-amber-400/70">Draft</span></>}
                                </div>
                              </div>
                              <svg className="w-4 h-4 text-white/20 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Collected NFTs Grid */}
        {activeTab === "collected" && (
          <>
            {/* Controls Bar */}
            {(ownedNfts.length > 0 || ownedBundleNfts.length > 0) && !isLoadingNfts && !isLoadingRentals && !isLoadingBundleNfts && (
              <div className="flex items-center justify-end gap-2 mb-4">
                {/* Search */}
                <div className="relative flex-1 max-w-xs mr-auto">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={collectedSearchQuery}
                    onChange={(e) => setCollectedSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="w-full pl-8 pr-3 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 transition-all"
                  />
                </div>

                <div className="flex items-center gap-1">
                {/* Sort Dropdown */}
                <div ref={collectedSortRef} className="relative">
                  <button
                    onClick={() => { setShowCollectedSort(!showCollectedSort); setShowCollectedFilter(false); }}
                    className={`p-1.5 rounded-lg transition-all duration-200 ${
                      showCollectedSort ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
                    }`}
                    title={`Sort by: ${collectedSort}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7h6M3 12h9m-9 5h12M17 3v18m0 0l-3-3m3 3l3-3" />
                    </svg>
                  </button>
                  {showCollectedSort && (
                    <div className="absolute right-0 top-full mt-2 w-40 bg-black/95 backdrop-blur-xl border border-white/[0.08] rounded-lg shadow-xl z-50 overflow-hidden">
                      <div className="p-2">
                        <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1.5 px-1">Sort By</p>
                        <div className="flex flex-col gap-1">
                          {[
                            { value: "recent", label: "Recent" },
                            { value: "oldest", label: "Oldest" },
                            { value: "name", label: "Name" },
                          ].map((option) => (
                            <button
                              key={option.value}
                              onClick={() => { setCollectedSort(option.value as SortOption); setShowCollectedSort(false); }}
                              className={`px-2 py-1.5 text-sm font-medium rounded-md transition-all duration-200 text-left ${
                                collectedSort === option.value
                                  ? "bg-white text-black"
                                  : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Filter Dropdown */}
                <div ref={collectedFilterRef} className="relative">
                  <button
                    onClick={() => { setShowCollectedFilter(!showCollectedFilter); setShowCollectedSort(false); }}
                    className={`p-1.5 rounded-lg transition-all duration-200 ${
                      hasCollectedFilters
                        ? "bg-purple-500/20 text-purple-300"
                        : showCollectedFilter
                          ? "bg-white/10 text-white"
                          : "text-white/40 hover:text-white/60"
                    }`}
                    title="Filter"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    {hasCollectedFilters && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-purple-400 rounded-full" />
                    )}
                  </button>
                  {showCollectedFilter && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-black/95 backdrop-blur-xl border border-white/[0.08] rounded-lg shadow-xl z-50 overflow-hidden max-h-[70vh] overflow-y-auto">
                      {/* Item Type Section */}
                      <div className="p-2 border-b border-white/[0.06]">
                        <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1.5 px-1">Item Type</p>
                        <div className="flex items-center gap-1">
                          {[
                            { value: "all", label: "All" },
                            { value: "content", label: "Content" },
                            { value: "bundle", label: "Bundle" },
                          ].map((option) => (
                            <button
                              key={option.value}
                              onClick={() => handleCollectedItemTypeChange(option.value as ItemTypeFilter)}
                              className={`flex-1 px-2 py-1.5 text-sm font-medium rounded-md capitalize transition-all duration-200 ${
                                collectedItemType === option.value
                                  ? "bg-white text-black"
                                  : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Content Type Section */}
                      {collectedItemType !== "bundle" && collectedBundleTypeFilter === "all" && (
                        <div className="p-2 border-b border-white/[0.06]">
                          <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1.5 px-1">Content Type</p>
                          <div className="flex flex-wrap gap-1">
                            <button
                              onClick={() => handleCollectedContentTypeFilter("all")}
                              className={`px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                                collectedContentTypeFilter === "all"
                                  ? "bg-white text-black"
                                  : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
                              }`}
                            >
                              All
                            </button>
                            {ALL_CONTENT_TYPES.map((type) => (
                              <button
                                key={type}
                                onClick={() => handleCollectedContentTypeFilter(type)}
                                className={`px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                                  collectedContentTypeFilter === type
                                    ? "bg-white text-black"
                                    : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
                                }`}
                              >
                                {getContentTypeLabel(type)}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Bundle Type Section */}
                      {collectedItemType !== "content" && collectedContentTypeFilter === "all" && (
                        <div className="p-2 border-b border-white/[0.06]">
                          <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1.5 px-1">Bundle Type</p>
                          <div className="flex flex-wrap gap-1">
                            <button
                              onClick={() => handleCollectedBundleTypeFilter("all")}
                              className={`px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                                collectedBundleTypeFilter === "all"
                                  ? "bg-white text-black"
                                  : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
                              }`}
                            >
                              All
                            </button>
                            {ALL_BUNDLE_TYPES.map((type) => (
                              <button
                                key={type}
                                onClick={() => handleCollectedBundleTypeFilter(type)}
                                className={`px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                                  collectedBundleTypeFilter === type
                                    ? "bg-white text-black"
                                    : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
                                }`}
                              >
                                {getBundleTypeLabel(type)}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Clear button */}
                      {hasCollectedFilters && (
                        <div className="p-2">
                          <button
                            onClick={() => { handleCollectedItemTypeChange("all"); setShowCollectedFilter(false); }}
                            className="w-full px-2 py-1.5 text-sm font-medium text-white/50 hover:text-white/70 hover:bg-white/[0.04] rounded transition-all"
                          >
                            Clear all filters
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                  {/* Group Toggle */}
                  <button
                    onClick={() => setCollectedGroupBy(collectedGroupBy === "none" ? "type" : collectedGroupBy === "type" ? "domain" : "none")}
                    className={`p-1.5 rounded-lg transition-all duration-200 ${collectedGroupBy !== "none" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}
                    title={`Group by: ${collectedGroupBy}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                    </svg>
                  </button>

                  {/* View Toggle */}
                  <div className="flex items-center bg-white/[0.03] rounded-lg p-0.5 ml-1">
                    <button onClick={() => setCollectedViewMode("grid")} className={`p-1.5 rounded-md transition-all duration-200 ${collectedViewMode === "grid" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}>
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16"><path d="M1 2.5A1.5 1.5 0 012.5 1h3A1.5 1.5 0 017 2.5v3A1.5 1.5 0 015.5 7h-3A1.5 1.5 0 011 5.5v-3zm8 0A1.5 1.5 0 0110.5 1h3A1.5 1.5 0 0115 2.5v3A1.5 1.5 0 0113.5 7h-3A1.5 1.5 0 019 5.5v-3zm-8 8A1.5 1.5 0 012.5 9h3A1.5 1.5 0 017 10.5v3A1.5 1.5 0 015.5 15h-3A1.5 1.5 0 011 13.5v-3zm8 0A1.5 1.5 0 0110.5 9h3a1.5 1.5 0 011.5 1.5v3a1.5 1.5 0 01-1.5 1.5h-3A1.5 1.5 0 019 13.5v-3z"/></svg>
                    </button>
                    <button onClick={() => setCollectedViewMode("list")} className={`p-1.5 rounded-md transition-all duration-200 ${collectedViewMode === "list" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}>
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16"><path fillRule="evenodd" d="M2.5 12a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5zm0-4a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5zm0-4a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5z"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            )}

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
            ) : (filteredCollectedNfts.contentNfts.length === 0 && filteredCollectedNfts.bundleNfts.length === 0) ? (
              <div className="relative p-16 rounded-2xl bg-white/[0.02] border border-white/5 text-center">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium mb-2">No matching NFTs</h3>
                <p className="text-white/40 text-sm">Try adjusting your filters</p>
              </div>
            ) : collectedViewMode === "grid" ? (
              <div className="space-y-6">
                {groupedCollectedNfts.map((group, groupIndex) => (
                  <div key={group.label || groupIndex}>
                    {group.label && (
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-sm font-medium text-white/50 uppercase tracking-wider">{group.label}</span>
                        <div className="flex-1 h-px bg-gradient-to-r from-white/[0.08] to-transparent" />
                        <span className="text-sm text-white/30">{group.contentNfts.length + group.bundleNfts.length}</span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                      {/* Content NFTs */}
                      {group.contentNfts.map((nft) => {
                        const contentData = nft.collectionAsset
                          ? globalContent.find(c => c.collectionAsset?.toBase58() === nft.collectionAsset?.toBase58())
                          : undefined;
                        const title = nft.name || "Untitled";
                        const thumbnailUrl = contentData?.thumbnail || null;
                        const rarity = nftRarities.get(nft.nftAsset.toBase58());
                        const editionMatch = nft.name?.match(/\(([CURLE])\s*#(\d+)\)\s*$/);
                        const edition = editionMatch ? editionMatch[2] : null;

                        return (
                          <div key={nft.nftAsset.toBase58()} className="group relative rounded-xl bg-white/[0.02] border border-white/5 overflow-hidden hover:border-white/10 transition-all duration-300">
                            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className="aspect-square bg-white/5 relative">
                              {thumbnailUrl ? (
                                <img src={thumbnailUrl} alt={title} className="w-full h-full object-cover" />
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
                                    <p className="text-xs text-white/40 mt-0.5">Edition <span className="font-mono">#{edition}</span></p>
                                  ) : (
                                    <p className="text-2xs text-white/30 font-mono break-all mt-1">{nft.nftAsset.toBase58().slice(0, 8)}...</p>
                                  )}
                                </div>
                                {isOwnProfile && nft.contentCid && (
                                  <button onClick={(e) => { e.stopPropagation(); openBurnModal(nft.nftAsset, nft.contentCid!, title, thumbnailUrl); }} className="flex-shrink-0 p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400/80 hover:text-red-400 transition-colors border border-red-500/20" title="Burn NFT">
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
                      {group.bundleNfts.map((nft) => {
                        if (!nft.creator || !nft.bundleId) return null;
                        const bundleData = globalBundles.find(b => b.creator.toBase58() === nft.creator!.toBase58() && b.bundleId === nft.bundleId);
                        const title = nft.name || "Untitled Bundle";
                        const previewUrl = bundleData?.thumbnail || null;
                        const rarity = bundleNftRarities.get(nft.nftAsset.toBase58());
                        const editionMatch = nft.name?.match(/\(([CURLE])\s*#(\d+)\)\s*$/);
                        const edition = editionMatch ? editionMatch[2] : null;

                        return (
                          <Link key={nft.nftAsset.toBase58()} href={`/content/${nft.bundleId}`} className="group relative rounded-xl bg-white/[0.02] border border-white/5 overflow-hidden hover:border-white/10 transition-all duration-300">
                            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className="aspect-square bg-white/5 relative">
                              {previewUrl ? (
                                <img src={previewUrl} alt={title} className="w-full h-full object-cover" />
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
                              <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-purple-500/80 text-white text-2xs font-medium rounded">Bundle</div>
                            </div>
                            <div className="relative p-3">
                              <h3 className="font-medium text-sm truncate text-white/90">{title}</h3>
                              {edition ? (
                                <p className="text-xs text-white/40 mt-0.5">Edition <span className="font-mono">#{edition}</span></p>
                              ) : (
                                <p className="text-2xs text-white/30 font-mono break-all mt-1">{nft.nftAsset.toBase58().slice(0, 8)}...</p>
                              )}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                {groupedCollectedNfts.map((group, groupIndex) => (
                  <div key={group.label || groupIndex}>
                    {group.label && (
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-sm font-medium text-white/50 uppercase tracking-wider">{group.label}</span>
                        <div className="flex-1 h-px bg-gradient-to-r from-white/[0.08] to-transparent" />
                        <span className="text-sm text-white/30">{group.contentNfts.length + group.bundleNfts.length}</span>
                      </div>
                    )}
                    <div className="space-y-2">
                      {/* Content NFTs - List View */}
                      {group.contentNfts.map((nft) => {
                        const contentData = nft.collectionAsset
                          ? globalContent.find(c => c.collectionAsset?.toBase58() === nft.collectionAsset?.toBase58())
                          : undefined;
                        const title = nft.name || "Untitled";
                        const thumbnailUrl = contentData?.thumbnail || null;
                        const rarity = nftRarities.get(nft.nftAsset.toBase58());
                        const editionMatch = nft.name?.match(/\(([CURLE])\s*#(\d+)\)\s*$/);
                        const edition = editionMatch ? editionMatch[2] : null;

                        return (
                          <div key={nft.nftAsset.toBase58()} className="group flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all duration-200">
                            <div className="w-14 h-14 bg-white/5 rounded-lg overflow-hidden flex-shrink-0 relative">
                              {thumbnailUrl ? (
                                <img src={thumbnailUrl} alt={title} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <svg className="w-6 h-6 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                </div>
                              )}
                              {rarity !== undefined && (
                                <div className="absolute top-0.5 left-0.5">
                                  <RarityBadge rarity={rarity} size="sm" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-base truncate text-white/90">{title}</h3>
                              <div className="flex items-center gap-2 mt-0.5 text-sm text-white/40">
                                {edition && <span>Edition #{edition}</span>}
                                {contentData?.contentType !== undefined && <span>{getContentTypeLabel(contentData.contentType as ContentType)}</span>}
                              </div>
                            </div>
                            {isOwnProfile && nft.contentCid && (
                              <button onClick={(e) => { e.stopPropagation(); openBurnModal(nft.nftAsset, nft.contentCid!, title, thumbnailUrl); }} className="flex-shrink-0 p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400/80 hover:text-red-400 transition-colors border border-red-500/20" title="Burn NFT">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                                </svg>
                              </button>
                            )}
                          </div>
                        );
                      })}

                      {/* Bundle NFTs - List View */}
                      {group.bundleNfts.map((nft) => {
                        if (!nft.creator || !nft.bundleId) return null;
                        const bundleData = globalBundles.find(b => b.creator.toBase58() === nft.creator!.toBase58() && b.bundleId === nft.bundleId);
                        const title = nft.name || "Untitled Bundle";
                        const previewUrl = bundleData?.thumbnail || null;
                        const rarity = bundleNftRarities.get(nft.nftAsset.toBase58());
                        const editionMatch = nft.name?.match(/\(([CURLE])\s*#(\d+)\)\s*$/);
                        const edition = editionMatch ? editionMatch[2] : null;

                        return (
                          <Link key={nft.nftAsset.toBase58()} href={`/content/${nft.bundleId}`} className="group flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all duration-200">
                            <div className="w-14 h-14 bg-white/5 rounded-lg overflow-hidden flex-shrink-0 relative">
                              {previewUrl ? (
                                <img src={previewUrl} alt={title} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <svg className="w-6 h-6 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                  </svg>
                                </div>
                              )}
                              {rarity !== undefined && (
                                <div className="absolute top-0.5 left-0.5">
                                  <RarityBadge rarity={rarity} size="sm" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-base truncate text-white/90">{title}</h3>
                              <div className="flex items-center gap-2 mt-0.5 text-sm text-white/40">
                                <span className="text-purple-400/80">Bundle</span>
                                {edition && <><span>·</span><span>Edition #{edition}</span></>}
                                {bundleData?.bundleType !== undefined && <><span>·</span><span>{getBundleTypeLabel(bundleData.bundleType)}</span></>}
                              </div>
                            </div>
                            <svg className="w-4 h-4 text-white/20 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Memberships Tab - Creators this user has active memberships with */}
        {activeTab === "memberships" && (
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
                        <span className="text-xs uppercase tracking-wider text-emerald-400/80 flex items-center gap-1.5">
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

      {/* Creator Landing Page Editors */}
      <BannerEditor
        isOpen={showBannerEditor}
        onClose={() => setShowBannerEditor(false)}
        currentBannerCid={profileSettingsQuery.data?.banner_cid ?? null}
        currentBannerUrl={profileSettingsQuery.data?.banner_url ?? null}
        onSave={async (bannerCid, bannerUrl) => {
          await updateProfileSettings.mutateAsync({
            banner_cid: bannerCid,
            banner_url: bannerUrl,
          });
        }}
      />

      <BioEditor
        isOpen={showBioEditor}
        onClose={() => setShowBioEditor(false)}
        currentBio={profileSettingsQuery.data?.bio ?? null}
        currentTagline={profileSettingsQuery.data?.tagline ?? null}
        onSave={async (bio, tagline) => {
          await updateProfileSettings.mutateAsync({
            bio,
            tagline,
          });
        }}
      />

      <SocialLinksEditor
        isOpen={showSocialLinksEditor}
        onClose={() => setShowSocialLinksEditor(false)}
        currentLinks={socialLinksQuery.data ?? []}
        onSave={async (links) => {
          await updateSocialLinks.mutateAsync(links);
        }}
      />

      <AnnouncementManager
        isOpen={showAnnouncementManager}
        onClose={() => setShowAnnouncementManager(false)}
        currentAnnouncements={announcementsQuery.data ?? []}
        onCreate={async (announcement) => {
          await createAnnouncement.mutateAsync(announcement);
        }}
        onDelete={async (id) => {
          await deleteAnnouncement.mutateAsync(id);
        }}
      />

      <FeaturedContentPicker
        isOpen={showFeaturedContentPicker}
        onClose={() => setShowFeaturedContentPicker(false)}
        currentFeatured={featuredContentQuery.data ?? []}
        availableContent={indexedContent}
        availableBundles={indexedBundles}
        onSave={async (items) => {
          await updateFeaturedContent.mutateAsync(items);
        }}
      />
    </div>
  );
}
