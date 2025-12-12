"use client";

import { useState } from "react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { BundleType, getBundleTypeLabel, getSuggestedBundleTypes, ContentDomain, getIpfsUrl } from "@handcraft/sdk";
import { useContentRegistry, ContentEntry } from "@/hooks/useContentRegistry";

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
  const [nftRoyaltyPercent, setNftRoyaltyPercent] = useState("5");

  // Rental config
  const [rentFee6h, setRentFee6h] = useState("");
  const [rentFee1d, setRentFee1d] = useState("");
  const [rentFee7d, setRentFee7d] = useState("");

  const [error, setError] = useState<string | null>(null);

  const {
    createBundleWithMintAndRent,
    addBundleItem,
    isCreatingBundleWithMintAndRent,
    isAddingBundleItem,
    content: userContent,
    isLoadingContent: isLoadingUserContent,
  } = useContentRegistry();

  const suggestedTypes = creatorDomain
    ? getSuggestedBundleTypes(creatorDomain)
    : ALL_BUNDLE_TYPES;

  // Load metadata for user's content
  const loadContentMetadata = async () => {
    if (!userContent.length) return;

    setIsLoadingMetadata(true);
    const metadataMap: Record<string, ContentMetadata> = {};

    await Promise.all(
      userContent.map(async (content) => {
        try {
          const url = getIpfsUrl(content.metadataCid);
          const res = await fetch(url);
          if (res.ok) {
            metadataMap[content.contentCid] = await res.json();
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

    // Parse values
    const priceFloat = nftPrice ? parseFloat(nftPrice) : 0;
    const royaltyNum = parseFloat(nftRoyaltyPercent);

    if (isNaN(royaltyNum) || royaltyNum < 2 || royaltyNum > 10) {
      setError("Royalty must be between 2% and 10%");
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
      if (coverImage) {
        const formData = new FormData();
        formData.append("file", coverImage);
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        if (uploadRes.ok) {
          const { cid } = await uploadRes.json();
          coverImageCid = cid;
        }
      }

      // Upload metadata to IPFS
      const metadataRes = await fetch("/api/upload/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metadata: {
            ...metadata,
            image: coverImageCid ? `https://ipfs.io/ipfs/${coverImageCid}` : undefined,
          },
          name: "bundle-metadata",
        }),
      });

      if (!metadataRes.ok) {
        throw new Error("Failed to upload bundle metadata");
      }

      const { cid: metadataCid } = await metadataRes.json();

      // Convert prices to lamports
      const mintPriceLamports = BigInt(Math.floor(priceFloat * LAMPORTS_PER_SOL));
      const royaltyBps = Math.floor(royaltyNum * 100);

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

      // Add selected content items
      for (let i = 0; i < selectedContentCids.length; i++) {
        const contentCid = selectedContentCids[i];
        await addBundleItem.mutateAsync({
          bundleId,
          contentCid,
          position: i,
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
    setNftRoyaltyPercent("5");
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

      <div className="relative bg-gray-900 rounded-2xl w-full max-w-xl mx-4 overflow-hidden border border-gray-800 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            {(step === "content" || step === "monetization") && (
              <button onClick={goBack} className="p-1 hover:bg-gray-800 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h2 className="text-xl font-semibold">{getStepTitle()}</h2>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-gray-800 rounded-full transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Step 1: Details */}
          {step === "details" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Bundle Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {suggestedTypes.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setBundleType(type)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        bundleType === type
                          ? "bg-primary-500 text-white"
                          : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                      }`}
                    >
                      {getBundleTypeLabel(type)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-gray-300">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`Enter ${getBundleTypeLabel(bundleType).toLowerCase()} title`}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-gray-300">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your bundle..."
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500 resize-none text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-gray-300">Cover Image (Optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCoverImage(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-primary-500 file:text-white file:text-sm"
                />
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleContinueToContent}
                disabled={!title.trim()}
                className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors font-medium"
              >
                Continue to Content
              </button>
            </div>
          )}

          {/* Step 2: Content Selection */}
          {step === "content" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Select content to include in your bundle. Order is based on selection.
              </p>

              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {isLoadingUserContent || isLoadingMetadata ? (
                  <div className="py-8 text-center text-gray-500">
                    <div className="w-8 h-8 mx-auto mb-2 border-2 border-gray-600 border-t-primary-500 rounded-full animate-spin" />
                    Loading your content...
                  </div>
                ) : userContent.length === 0 ? (
                  <div className="py-8 text-center text-gray-500">
                    <svg className="w-12 h-12 mx-auto mb-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p>No content yet</p>
                    <p className="text-xs mt-1">Upload some content first to create a bundle</p>
                  </div>
                ) : (
                  userContent.map((content) => {
                    const meta = contentMetadata[content.contentCid];
                    const isSelected = selectedContentCids.includes(content.contentCid);
                    const selectionIndex = selectedContentCids.indexOf(content.contentCid);

                    return (
                      <button
                        key={content.contentCid}
                        type="button"
                        onClick={() => toggleContentSelection(content.contentCid)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                          isSelected
                            ? "bg-primary-500/10 border-primary-500"
                            : "bg-gray-800 border-gray-700 hover:border-gray-600"
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isSelected ? "bg-primary-500 text-white" : "bg-gray-700"
                        }`}>
                          {isSelected ? (
                            <span className="text-xs font-medium">{selectionIndex + 1}</span>
                          ) : (
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                          )}
                        </div>

                        <div className="w-12 h-12 bg-gray-700 rounded overflow-hidden flex-shrink-0">
                          {meta?.image ? (
                            <img
                              src={getIpfsUrl(meta.image.replace("https://ipfs.io/ipfs/", ""))}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                        </div>

                        <div className="flex-1 text-left min-w-0">
                          <p className="font-medium truncate">
                            {meta?.name || content.contentCid.slice(0, 16) + "..."}
                          </p>
                          {meta?.description && (
                            <p className="text-xs text-gray-500 truncate">{meta.description}</p>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {selectedContentCids.length > 0 && (
                <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-3 text-sm">
                  <span className="text-primary-400 font-medium">{selectedContentCids.length} items selected</span>
                </div>
              )}

              {error && (
                <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleContinueToMonetization}
                className="w-full py-3 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors font-medium"
              >
                Continue to Monetization
              </button>
            </div>
          )}

          {/* Step 3: Monetization */}
          {step === "monetization" && publicKey && (
            <div className="space-y-4">
              {/* Tabs */}
              <div className="flex border-b border-gray-700">
                <button
                  onClick={() => setMonetizationTab("minting")}
                  className={`flex-1 py-3 text-center font-medium transition-colors relative ${
                    monetizationTab === "minting" ? "text-primary-400" : "text-gray-400 hover:text-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    NFT Minting
                  </div>
                  {monetizationTab === "minting" && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />
                  )}
                </button>
                <button
                  onClick={() => setMonetizationTab("renting")}
                  className={`flex-1 py-3 text-center font-medium transition-colors relative ${
                    monetizationTab === "renting" ? "text-amber-400" : "text-gray-400 hover:text-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Rentals
                  </div>
                  {monetizationTab === "renting" && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500" />
                  )}
                </button>
              </div>

              {/* Minting Tab Content */}
              {monetizationTab === "minting" && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-400">
                    Configure how others can mint NFTs to permanently own your bundle.
                  </p>

                  <div>
                    <label className="block text-sm font-medium mb-2">Mint Price (SOL)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={nftPrice}
                        onChange={(e) => setNftPrice(e.target.value)}
                        placeholder="0 for free"
                        className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
                      />
                      <span className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400">SOL</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Supply</label>
                    <div className="flex gap-4 mb-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={nftSupplyType === "unlimited"}
                          onChange={() => setNftSupplyType("unlimited")}
                          className="text-primary-500"
                        />
                        <span>Unlimited</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={nftSupplyType === "limited"}
                          onChange={() => setNftSupplyType("limited")}
                          className="text-primary-500"
                        />
                        <span>Limited Edition</span>
                      </label>
                    </div>
                    {nftSupplyType === "limited" && (
                      <input
                        type="number"
                        min="1"
                        value={nftMaxSupply}
                        onChange={(e) => setNftMaxSupply(e.target.value)}
                        placeholder="Max editions (e.g., 100)"
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Secondary Sale Royalty: {nftRoyaltyPercent}%
                    </label>
                    <input
                      type="range"
                      min="2"
                      max="10"
                      step="0.5"
                      value={nftRoyaltyPercent}
                      onChange={(e) => setNftRoyaltyPercent(e.target.value)}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>2%</span>
                      <span>10%</span>
                    </div>
                  </div>

                  <div className="bg-gray-800 rounded-lg p-4">
                    <p className="text-sm font-medium mb-3">Primary Sale Split</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">You (Creator)</span>
                        <span className="text-green-400 font-medium">80%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Existing Holders</span>
                        <span className="text-blue-400 font-medium">12%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Platform</span>
                        <span className="text-gray-500">5%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Ecosystem</span>
                        <span className="text-gray-500">3%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Renting Tab Content */}
              {monetizationTab === "renting" && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-400">
                    Set rental prices for each duration tier. Leave empty to disable rentals.
                  </p>

                  <div className="flex items-center gap-4">
                    <label className="w-24 text-sm text-gray-400">6 Hours</label>
                    <div className="flex-1 flex gap-2">
                      <input
                        type="number"
                        step="0.001"
                        min="0.001"
                        value={rentFee6h}
                        onChange={(e) => setRentFee6h(e.target.value)}
                        placeholder="0.01"
                        className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-amber-500"
                      />
                      <span className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400">SOL</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="w-24 text-sm text-gray-400">1 Day</label>
                    <div className="flex-1 flex gap-2">
                      <input
                        type="number"
                        step="0.001"
                        min="0.001"
                        value={rentFee1d}
                        onChange={(e) => setRentFee1d(e.target.value)}
                        placeholder="0.02"
                        className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-amber-500"
                      />
                      <span className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400">SOL</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="w-24 text-sm text-gray-400">7 Days</label>
                    <div className="flex-1 flex gap-2">
                      <input
                        type="number"
                        step="0.001"
                        min="0.001"
                        value={rentFee7d}
                        onChange={(e) => setRentFee7d(e.target.value)}
                        placeholder="0.05"
                        className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-amber-500"
                      />
                      <span className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400">SOL</span>
                    </div>
                  </div>

                  <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-4 text-sm">
                    <p className="text-amber-400 font-medium mb-2">About Rentals</p>
                    <ul className="text-amber-200/80 space-y-1">
                      <li>• Temporary access via non-transferable NFTs</li>
                      <li>• Access expires automatically after rental period</li>
                      <li>• Same revenue split as minting (80% to creator)</li>
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
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-400">
                    Please set all three rental tiers or leave them all empty.
                  </div>
                ) : null;
              })()}

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={
                  isLoading ||
                  Boolean((rentFee6h || rentFee1d || rentFee7d) && !(rentFee6h && rentFee1d && rentFee7d))
                }
                className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors font-medium"
              >
                Create Bundle
              </button>
            </div>
          )}

          {/* Step 4: Creating */}
          {step === "creating" && (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4">
                <svg className="animate-spin w-full h-full text-primary-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
              <p className="text-lg font-medium mb-2">
                {isCreatingBundleWithMintAndRent && "Creating bundle..."}
                {isAddingBundleItem && `Adding content (${selectedContentCids.length} items)...`}
              </p>
              <p className="text-sm text-gray-500">Please confirm the transaction(s) in your wallet</p>
            </div>
          )}

          {/* Step 5: Done */}
          {step === "done" && (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-lg font-medium mb-2">Bundle Created!</p>
              <p className="text-sm text-gray-500 mb-6">
                Your bundle is now published and ready for sales.
              </p>
              <button
                onClick={handleClose}
                className="px-8 py-3 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors font-medium"
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
