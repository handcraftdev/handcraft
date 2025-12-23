"use client";

import { useState } from "react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { BundleType, getBundleTypeLabel, getSuggestedBundleTypes, ContentDomain, getIpfsUrl } from "@handcraft/sdk";
import { useContentRegistry, ContentEntry } from "@/hooks/useContentRegistry";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";

interface CreateBundleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (bundleId: string) => void;
  creatorDomain?: ContentDomain;
}

const ALL_BUNDLE_TYPES: BundleType[] = [
  BundleType.Album,
  BundleType.Series,
  BundleType.Playlist,
  BundleType.Course,
  BundleType.Newsletter,
  BundleType.Collection,
  BundleType.ProductPack,
];

type Step = "details" | "content" | "monetization" | "creating" | "done";
type MonetizationTab = "minting" | "renting";

interface ContentMetadata {
  name?: string;
  description?: string;
  image?: string;
}

export function CreateBundleModal({
  isOpen,
  onClose,
  onSuccess,
  creatorDomain,
}: CreateBundleModalProps) {
  const { publicKey } = useWallet();
  const { session } = useSupabaseAuth();
  const [step, setStep] = useState<Step>("details");

  // Step 1: Details
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [bundleType, setBundleType] = useState<BundleType>(BundleType.Playlist);
  const [coverImage, setCoverImage] = useState<File | null>(null);

  // Step 2: Content
  const [selectedContentCids, setSelectedContentCids] = useState<string[]>([]);
  const [contentMetadata, setContentMetadata] = useState<Record<string, ContentMetadata>>({});
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);

  // Step 3: Monetization
  const [monetizationTab, setMonetizationTab] = useState<MonetizationTab>("minting");

  // NFT Minting config
  const [nftPrice, setNftPrice] = useState("");
  const [nftSupplyType, setNftSupplyType] = useState<"unlimited" | "limited">("unlimited");
  const [nftMaxSupply, setNftMaxSupply] = useState("");
  // Fixed royalty at 4%
  const FIXED_ROYALTY_PERCENT = 4;

  // Rental config
  const [rentFee6h, setRentFee6h] = useState("");
  const [rentFee1d, setRentFee1d] = useState("");
  const [rentFee7d, setRentFee7d] = useState("");

  const [error, setError] = useState<string | null>(null);

  const {
    createBundleWithMintAndRent,
    addBundleItemsBatch,
    isCreatingBundleWithMintAndRent,
    isAddingBundleItem,
    content: userContent,
    isLoadingContent: isLoadingUserContent,
  } = useContentRegistry();

  const suggestedTypes = creatorDomain
    ? getSuggestedBundleTypes(creatorDomain)
    : ALL_BUNDLE_TYPES;

  // Load metadata for user's content
  // NOTE: metadataCid and contentCid are now optional (stored in Metaplex collection metadata)
  // Use pubkey as key since contentCid may not be available from on-chain data
  const loadContentMetadata = async () => {
    if (!userContent.length) return;

    setIsLoadingMetadata(true);
    const metadataMap: Record<string, ContentMetadata> = {};

    await Promise.all(
      userContent.map(async (content) => {
        const key = content.pubkey?.toBase58();
        if (!key) return;

        // Skip if no metadataCid available
        if (!content.metadataCid) return;

        try {
          const url = getIpfsUrl(content.metadataCid);
          const res = await fetch(url);
          if (res.ok) {
            metadataMap[key] = await res.json();
          }
        } catch {
          // Ignore errors
        }
      })
    );

    setContentMetadata(metadataMap);
    setIsLoadingMetadata(false);
  };

  const handleContinueToContent = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setError(null);
    await loadContentMetadata();
    setStep("content");
  };

  const handleContinueToMonetization = () => {
    setError(null);
    setStep("monetization");
  };

  const toggleContentSelection = (contentCid: string) => {
    setSelectedContentCids((prev) =>
      prev.includes(contentCid)
        ? prev.filter((c) => c !== contentCid)
        : [...prev, contentCid]
    );
  };

  const handleSubmit = async () => {
    if (!publicKey) {
      setError("Wallet not connected");
      return;
    }

    // Validate rental fees - all or none
    const hasAnyRent = rentFee6h || rentFee1d || rentFee7d;
    const hasAllRent = rentFee6h && rentFee1d && rentFee7d;
    if (hasAnyRent && !hasAllRent) {
      setError("Please set all three rental tiers or leave them all empty");
      return;
    }

    // Parse values - free minting is not allowed
    const priceFloat = parseFloat(nftPrice);
    if (isNaN(priceFloat) || priceFloat < 0.001) {
      setError("Minimum price is 0.001 SOL");
      return;
    }

    // If rent fees provided, validate them
    if (hasAllRent) {
      const rent6hNum = parseFloat(rentFee6h);
      const rent1dNum = parseFloat(rentFee1d);
      const rent7dNum = parseFloat(rentFee7d);

      if (isNaN(rent6hNum) || rent6hNum < 0.001) {
        setError("6h rent fee must be at least 0.001 SOL");
        return;
      }
      if (isNaN(rent1dNum) || rent1dNum < 0.001) {
        setError("1d rent fee must be at least 0.001 SOL");
        return;
      }
      if (isNaN(rent7dNum) || rent7dNum < 0.001) {
        setError("7d rent fee must be at least 0.001 SOL");
        return;
      }
    }

    setError(null);
    setStep("creating");

    try {
      // Generate bundle ID
      const bundleId = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 32) + "-" + Date.now().toString(36);

      // Create bundle metadata
      const metadata = {
        name: title.trim(),
        description: description.trim(),
        bundleType: getBundleTypeLabel(bundleType),
        createdAt: new Date().toISOString(),
        contentOrder: selectedContentCids,
      };

      // Upload cover image if provided
      let coverImageCid: string | undefined;
      if (coverImage && session?.access_token) {
        const formData = new FormData();
        formData.append("file", coverImage);
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: formData,
        });
        if (uploadRes.ok) {
          const { cid } = await uploadRes.json();
          coverImageCid = cid;
        }
      }

      // Upload metadata to IPFS
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }
      const metadataRes = await fetch("/api/upload/metadata", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          metadata: {
            ...metadata,
            image: coverImageCid ? `https://ipfs.io/ipfs/${coverImageCid}` : undefined,
          },
          name: "bundle-metadata",
        }),
      });

      if (!metadataRes.ok) {
        const errorData = await metadataRes.json().catch(() => ({}));
        console.error("[CreateBundleModal] Metadata upload failed:", errorData);
        throw new Error(errorData.error || "Failed to upload bundle metadata");
      }

      const { cid: metadataCid } = await metadataRes.json();

      // Convert prices to lamports
      const mintPriceLamports = BigInt(Math.floor(priceFloat * LAMPORTS_PER_SOL));
      const royaltyBps = FIXED_ROYALTY_PERCENT * 100; // 4% = 400 bps

      // Rent fees - use minimum values if not provided (program requires > 0)
      const rent6hLamports = hasAllRent
        ? BigInt(Math.floor(parseFloat(rentFee6h) * LAMPORTS_PER_SOL))
        : BigInt(1000000); // 0.001 SOL minimum
      const rent1dLamports = hasAllRent
        ? BigInt(Math.floor(parseFloat(rentFee1d) * LAMPORTS_PER_SOL))
        : BigInt(1000000);
      const rent7dLamports = hasAllRent
        ? BigInt(Math.floor(parseFloat(rentFee7d) * LAMPORTS_PER_SOL))
        : BigInt(1000000);

      // Max supply
      const maxSupply = nftSupplyType === "limited" && nftMaxSupply
        ? BigInt(parseInt(nftMaxSupply))
        : null;

      // Create bundle with mint and rent in a single transaction
      await createBundleWithMintAndRent.mutateAsync({
        bundleId,
        metadataCid,
        bundleType,
        mintPrice: mintPriceLamports,
        mintMaxSupply: maxSupply,
        creatorRoyaltyBps: royaltyBps,
        rentFee6h: rent6hLamports,
        rentFee1d: rent1dLamports,
        rentFee7d: rent7dLamports,
        platform: publicKey,
      });

      // Add selected content items in a single transaction
      if (selectedContentCids.length > 0) {
        await addBundleItemsBatch.mutateAsync({
          bundleId,
          contentCids: selectedContentCids,
        });
      }

      // Success
      setStep("done");
      onSuccess?.(bundleId);
    } catch (err) {
      console.error("Failed to create bundle:", err);
      setError(err instanceof Error ? err.message : "Failed to create bundle");
      setStep("monetization");
    }
  };

  const handleClose = () => {
    setStep("details");
    setTitle("");
    setDescription("");
    setBundleType(BundleType.Playlist);
    setCoverImage(null);
    setError(null);
    setSelectedContentCids([]);
    setContentMetadata({});
    setMonetizationTab("minting");
    setNftPrice("");
    setNftSupplyType("unlimited");
    setNftMaxSupply("");
    setRentFee6h("");
    setRentFee1d("");
    setRentFee7d("");
    onClose();
  };

  const goBack = () => {
    switch (step) {
      case "content":
        setStep("details");
        break;
      case "monetization":
        setStep("content");
        break;
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case "details": return "Create Bundle";
      case "content": return "Add Content";
      case "monetization": return "Monetization";
      case "creating": return "Creating...";
      case "done": return "Bundle Created!";
    }
  };

  const isLoading = isCreatingBundleWithMintAndRent || isAddingBundleItem;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative bg-black rounded-2xl w-full max-w-xl mx-4 overflow-hidden border border-white/10 max-h-[90vh] flex flex-col">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent pointer-events-none" />

        {/* Header */}
        <div className="relative flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            {(step === "content" || step === "monetization") && (
              <button
                onClick={goBack}
                className="p-1.5 hover:bg-white/5 rounded-lg transition-all duration-300 text-white/40 hover:text-white/70"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h2 className="text-lg font-medium text-white/90">{getStepTitle()}</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/5 rounded-full transition-all duration-300 text-white/40 hover:text-white/70"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="relative p-6 overflow-y-auto flex-1">
          {/* Step 1: Details */}
          {step === "details" && (
            <div className="space-y-5">
              <div>
                <label className="block text-[11px] uppercase tracking-[0.2em] text-white/30 mb-3">Bundle Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {suggestedTypes.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setBundleType(type)}
                      className={`relative px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 overflow-hidden ${
                        bundleType === type
                          ? "bg-cyan-500/20 border border-cyan-500/50 text-white/90"
                          : "bg-white/[0.02] border border-white/10 text-white/50 hover:bg-white/5 hover:border-white/20"
                      }`}
                    >
                      {bundleType === type && (
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent pointer-events-none" />
                      )}
                      <span className="relative">{getBundleTypeLabel(type)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-[0.2em] text-white/30 mb-2">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`Enter ${getBundleTypeLabel(bundleType).toLowerCase()} title`}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-cyan-500/50 focus:bg-white/[0.07] text-white/90 placeholder:text-white/20 transition-all duration-300"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-[0.2em] text-white/30 mb-2">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your bundle..."
                  rows={3}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-cyan-500/50 focus:bg-white/[0.07] resize-none text-white/90 placeholder:text-white/20 transition-all duration-300"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-[0.2em] text-white/30 mb-2">Cover Image (Optional)</label>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setCoverImage(e.target.files?.[0] || null)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white/90 transition-all duration-300 file:mr-4 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:bg-cyan-500/20 file:text-cyan-300 file:text-sm file:font-medium hover:file:bg-cyan-500/30 file:transition-all file:duration-300 file:cursor-pointer"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleContinueToContent}
                disabled={!title.trim()}
                className="w-full py-3 bg-cyan-500/20 hover:bg-cyan-500/30 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl transition-all duration-300 font-medium border border-cyan-500/30 hover:border-cyan-500/50 text-white/90"
              >
                Continue to Content
              </button>
            </div>
          )}

          {/* Step 2: Content Selection */}
          {step === "content" && (
            <div className="space-y-4">
              <p className="text-sm text-white/40">
                Select content to include in your bundle. Order is based on selection.
              </p>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {isLoadingUserContent || isLoadingMetadata ? (
                  <div className="py-12 text-center text-white/40">
                    <div className="w-8 h-8 mx-auto mb-3 border-2 border-white/10 border-t-cyan-500 rounded-full animate-spin" />
                    <span className="text-sm">Loading your content...</span>
                  </div>
                ) : userContent.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
                      <svg className="w-8 h-8 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-white/50 font-medium">No content yet</p>
                    <p className="text-xs text-white/30 mt-1">Upload some content first to create a bundle</p>
                  </div>
                ) : (
                  userContent
                    .filter((content) => content.contentCid) // Only show content with CID available
                    .map((content) => {
                    // Use contentCid as identifier (required for bundle item instruction)
                    const contentKey = content.contentCid!;
                    const metaKey = content.pubkey?.toBase58() || contentKey;
                    const meta = contentMetadata[metaKey];
                    const isSelected = selectedContentCids.includes(contentKey);
                    const selectionIndex = selectedContentCids.indexOf(contentKey);

                    return (
                      <button
                        key={contentKey}
                        type="button"
                        onClick={() => toggleContentSelection(contentKey)}
                        className={`relative w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 overflow-hidden ${
                          isSelected
                            ? "bg-cyan-500/10 border-cyan-500/50"
                            : "bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/5"
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent pointer-events-none" />
                        )}

                        <div className={`relative w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                          isSelected ? "bg-cyan-500 text-white" : "bg-white/10 text-white/30"
                        }`}>
                          {isSelected ? (
                            <span className="text-xs font-medium">{selectionIndex + 1}</span>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                          )}
                        </div>

                        <div className="relative w-12 h-12 bg-white/5 rounded-lg overflow-hidden flex-shrink-0">
                          {meta?.image ? (
                            <img
                              src={getIpfsUrl(meta.image.replace("https://ipfs.io/ipfs/", ""))}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <svg className="w-5 h-5 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                        </div>

                        <div className="relative flex-1 text-left min-w-0">
                          <p className="font-medium text-white/80 truncate text-sm">
                            {meta?.name || contentKey.slice(0, 16) + "..."}
                          </p>
                          {meta?.description && (
                            <p className="text-xs text-white/40 truncate">{meta.description}</p>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {selectedContentCids.length > 0 && (
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-3 text-sm">
                  <span className="text-cyan-300 font-medium">{selectedContentCids.length} items selected</span>
                </div>
              )}

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleContinueToMonetization}
                className="w-full py-3 bg-cyan-500/20 hover:bg-cyan-500/30 rounded-xl transition-all duration-300 font-medium border border-cyan-500/30 hover:border-cyan-500/50 text-white/90"
              >
                Continue to Monetization
              </button>
            </div>
          )}

          {/* Step 3: Monetization */}
          {step === "monetization" && publicKey && (
            <div className="space-y-5">
              {/* Tabs */}
              <div className="flex rounded-xl bg-white/[0.02] p-1 border border-white/5">
                <button
                  onClick={() => setMonetizationTab("minting")}
                  className={`flex-1 py-2.5 text-center font-medium transition-all duration-300 rounded-lg text-sm ${
                    monetizationTab === "minting"
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                      : "text-white/40 hover:text-white/60 border border-transparent"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    NFT Buying
                  </div>
                </button>
                <button
                  onClick={() => setMonetizationTab("renting")}
                  className={`flex-1 py-2.5 text-center font-medium transition-all duration-300 rounded-lg text-sm ${
                    monetizationTab === "renting"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "text-white/40 hover:text-white/60 border border-transparent"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Rentals
                  </div>
                </button>
              </div>

              {/* Buying Tab Content */}
              {monetizationTab === "minting" && (
                <div className="space-y-4">
                  <p className="text-sm text-white/40">
                    Configure how others can buy editions to permanently own your bundle.
                  </p>

                  <div>
                    <label className="block text-[11px] uppercase tracking-[0.2em] text-white/30 mb-2">Buy Price (SOL)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.001"
                        min="0.001"
                        value={nftPrice}
                        onChange={(e) => setNftPrice(e.target.value)}
                        placeholder="Min 0.001"
                        className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-cyan-500/50 focus:bg-white/[0.07] text-white/90 placeholder:text-white/20 transition-all duration-300"
                      />
                      <span className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white/40 text-sm">SOL</span>
                    </div>
                    <p className="text-xs text-white/30 mt-2">Minimum price is 0.001 SOL</p>
                  </div>

                  <div>
                    <label className="block text-[11px] uppercase tracking-[0.2em] text-white/30 mb-3">Supply</label>
                    <div className="flex gap-3 mb-3">
                      <button
                        type="button"
                        onClick={() => setNftSupplyType("unlimited")}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300 text-sm ${
                          nftSupplyType === "unlimited"
                            ? "bg-cyan-500/20 border border-cyan-500/50 text-cyan-300"
                            : "bg-white/[0.02] border border-white/10 text-white/50 hover:bg-white/5"
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          nftSupplyType === "unlimited" ? "border-cyan-400" : "border-white/30"
                        }`}>
                          {nftSupplyType === "unlimited" && <div className="w-2 h-2 rounded-full bg-cyan-400" />}
                        </div>
                        Unlimited
                      </button>
                      <button
                        type="button"
                        onClick={() => setNftSupplyType("limited")}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300 text-sm ${
                          nftSupplyType === "limited"
                            ? "bg-cyan-500/20 border border-cyan-500/50 text-cyan-300"
                            : "bg-white/[0.02] border border-white/10 text-white/50 hover:bg-white/5"
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          nftSupplyType === "limited" ? "border-cyan-400" : "border-white/30"
                        }`}>
                          {nftSupplyType === "limited" && <div className="w-2 h-2 rounded-full bg-cyan-400" />}
                        </div>
                        Limited Edition
                      </button>
                    </div>
                    {nftSupplyType === "limited" && (
                      <input
                        type="number"
                        min="1"
                        value={nftMaxSupply}
                        onChange={(e) => setNftMaxSupply(e.target.value)}
                        placeholder="Max editions (e.g., 100)"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-cyan-500/50 focus:bg-white/[0.07] text-white/90 placeholder:text-white/20 transition-all duration-300"
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Primary Sale Split */}
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                      <p className="text-[11px] uppercase tracking-[0.15em] text-white/30 mb-3">Primary Sale</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-white/40">You (Creator)</span>
                          <span className="text-emerald-400 font-medium">80%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/40">Holders</span>
                          <span className="text-blue-400 font-medium">12%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/30">Platform</span>
                          <span className="text-white/30">5%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/30">Ecosystem</span>
                          <span className="text-white/30">3%</span>
                        </div>
                      </div>
                    </div>

                    {/* Secondary Sale Split */}
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                      <p className="text-[11px] uppercase tracking-[0.15em] text-white/30 mb-3">Secondary Sale</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-white/40">Seller</span>
                          <span className="text-emerald-400 font-medium">90%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/40">You (Royalty)</span>
                          <span className="text-purple-400 font-medium">4%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/40">Holders</span>
                          <span className="text-blue-400 font-medium">4%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/30">Platform</span>
                          <span className="text-white/30">1%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/30">Ecosystem</span>
                          <span className="text-white/30">1%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Renting Tab Content */}
              {monetizationTab === "renting" && (
                <div className="space-y-4">
                  <p className="text-sm text-white/40">
                    Set rental prices for each duration tier. Leave empty to disable rentals.
                  </p>

                  <div className="space-y-3">
                    <div className="flex items-center gap-4">
                      <label className="w-20 text-sm text-white/40">6 Hours</label>
                      <div className="flex-1 flex gap-2">
                        <input
                          type="number"
                          step="0.001"
                          min="0.001"
                          value={rentFee6h}
                          onChange={(e) => setRentFee6h(e.target.value)}
                          placeholder="0.01"
                          className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-amber-500/50 focus:bg-white/[0.07] text-white/90 placeholder:text-white/20 transition-all duration-300"
                        />
                        <span className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white/40 text-sm">SOL</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <label className="w-20 text-sm text-white/40">1 Day</label>
                      <div className="flex-1 flex gap-2">
                        <input
                          type="number"
                          step="0.001"
                          min="0.001"
                          value={rentFee1d}
                          onChange={(e) => setRentFee1d(e.target.value)}
                          placeholder="0.02"
                          className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-amber-500/50 focus:bg-white/[0.07] text-white/90 placeholder:text-white/20 transition-all duration-300"
                        />
                        <span className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white/40 text-sm">SOL</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <label className="w-20 text-sm text-white/40">7 Days</label>
                      <div className="flex-1 flex gap-2">
                        <input
                          type="number"
                          step="0.001"
                          min="0.001"
                          value={rentFee7d}
                          onChange={(e) => setRentFee7d(e.target.value)}
                          placeholder="0.05"
                          className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-amber-500/50 focus:bg-white/[0.07] text-white/90 placeholder:text-white/20 transition-all duration-300"
                        />
                        <span className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white/40 text-sm">SOL</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm">
                    <p className="text-amber-300 font-medium mb-2">About Rentals</p>
                    <ul className="text-amber-200/60 space-y-1.5">
                      <li className="flex items-start gap-2">
                        <span className="text-amber-400/60 mt-0.5">-</span>
                        Temporary access via non-transferable NFTs
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-amber-400/60 mt-0.5">-</span>
                        Access expires automatically after rental period
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-amber-400/60 mt-0.5">-</span>
                        Same revenue split as minting (80% to creator)
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Rental validation */}
              {(() => {
                const hasAnyRent = rentFee6h || rentFee1d || rentFee7d;
                const hasAllRent = rentFee6h && rentFee1d && rentFee7d;
                const hasPartialRent = hasAnyRent && !hasAllRent;
                return hasPartialRent ? (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-sm text-amber-400">
                    Please set all three rental tiers or leave them all empty.
                  </div>
                ) : null;
              })()}

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={
                  isLoading ||
                  Boolean((rentFee6h || rentFee1d || rentFee7d) && !(rentFee6h && rentFee1d && rentFee7d))
                }
                className="w-full py-3 bg-cyan-500/20 hover:bg-cyan-500/30 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl transition-all duration-300 font-medium border border-cyan-500/30 hover:border-cyan-500/50 text-white/90"
              >
                Create Bundle
              </button>
            </div>
          )}

          {/* Step 4: Creating */}
          {step === "creating" && (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4">
                <svg className="animate-spin w-full h-full text-cyan-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
              <p className="text-lg font-medium text-white/90 mb-2">
                {isCreatingBundleWithMintAndRent && "Creating bundle..."}
                {isAddingBundleItem && `Adding content (${selectedContentCids.length} items)...`}
              </p>
              <p className="text-sm text-white/40">Please confirm the transaction(s) in your wallet</p>
            </div>
          )}

          {/* Step 5: Done */}
          {step === "done" && (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-lg font-medium text-white/90 mb-2">Bundle Created!</p>
              <p className="text-sm text-white/40 mb-6">
                Your bundle is now published and ready for sales.
              </p>
              <button
                onClick={handleClose}
                className="px-8 py-3 bg-cyan-500/20 hover:bg-cyan-500/30 rounded-xl transition-all duration-300 font-medium border border-cyan-500/30 hover:border-cyan-500/50 text-white/90"
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
