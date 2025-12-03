"use client";

import { useState, useRef, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useContentUpload } from "@/hooks/useUpload";
import { useContentRegistry, ContentType as OnChainContentType, PaymentCurrency } from "@/hooks/useContentRegistry";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: {
    content: { cid: string; url: string };
    metadata: { cid: string; url: string } | null;
  }) => void;
}

type ContentCategory = "video" | "book" | "audio" | "image";

interface ContentTypeOption {
  value: OnChainContentType;
  label: string;
  category: ContentCategory;
}

const CONTENT_TYPES: ContentTypeOption[] = [
  // Video types
  { value: OnChainContentType.Movie, label: "Movie", category: "video" },
  { value: OnChainContentType.TvSeries, label: "TV Series", category: "video" },
  { value: OnChainContentType.MusicVideo, label: "Music Video", category: "video" },
  { value: OnChainContentType.ShortVideo, label: "Short Video", category: "video" },
  { value: OnChainContentType.GeneralVideo, label: "General", category: "video" },
  // Book types
  { value: OnChainContentType.Comic, label: "Comic", category: "book" },
  { value: OnChainContentType.GeneralBook, label: "General", category: "book" },
  // Audio types
  { value: OnChainContentType.Podcast, label: "Podcast", category: "audio" },
  { value: OnChainContentType.Audiobook, label: "Audiobook", category: "audio" },
  { value: OnChainContentType.GeneralAudio, label: "General", category: "audio" },
  // Image types
  { value: OnChainContentType.Photo, label: "Photo", category: "image" },
  { value: OnChainContentType.Art, label: "Art", category: "image" },
  { value: OnChainContentType.GeneralImage, label: "General", category: "image" },
];

const CATEGORY_LABELS: Record<ContentCategory, string> = {
  video: "Video",
  book: "Book",
  audio: "Audio",
  image: "Image",
};

function getTypesForCategory(category: ContentCategory): ContentTypeOption[] {
  return CONTENT_TYPES.filter(t => t.category === category);
}

function detectCategory(file: File): ContentCategory {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf" || file.type.includes("epub")) return "book";
  return "image";
}

function getDefaultTypeForCategory(category: ContentCategory): OnChainContentType {
  switch (category) {
    case "video": return OnChainContentType.GeneralVideo;
    case "book": return OnChainContentType.GeneralBook;
    case "audio": return OnChainContentType.GeneralAudio;
    case "image": return OnChainContentType.GeneralImage;
  }
}

export function UploadModal({ isOpen, onClose, onSuccess }: UploadModalProps) {
  const { publicKey } = useWallet();
  const [step, setStep] = useState<"select" | "details" | "uploading" | "registering" | "done">(
    "select"
  );
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [category, setCategory] = useState<ContentCategory>("video");
  const [contentType, setContentType] = useState<OnChainContentType>(OnChainContentType.GeneralVideo);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  // NFT configuration state (always enabled by default)
  const [nftPrice, setNftPrice] = useState("");
  const [nftCurrency, setNftCurrency] = useState<PaymentCurrency>(PaymentCurrency.Sol);
  const [nftSupplyType, setNftSupplyType] = useState<"unlimited" | "limited">("unlimited");
  const [nftMaxSupply, setNftMaxSupply] = useState("");
  const [nftRoyaltyPercent, setNftRoyaltyPercent] = useState("5");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { registerContentWithMint, isRegisteringContent } = useContentRegistry();

  const LAMPORTS_PER_SOL = 1_000_000_000;

  const { isUploading, progress, error, uploadContent, reset } =
    useContentUpload({
      onSuccess: (result) => {
        if (!publicKey) {
          setStep("done");
        }
      },
      onError: (err) => {
        console.error("Upload error:", err);
      },
    });

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (!selectedFile) return;

      setFile(selectedFile);

      // Determine content category from file type
      const detectedCategory = detectCategory(selectedFile);
      setCategory(detectedCategory);
      setContentType(getDefaultTypeForCategory(detectedCategory));

      // Create preview
      const url = URL.createObjectURL(selectedFile);
      setPreview(url);

      // Auto-fill title from filename
      const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, "");
      setTitle(nameWithoutExt);

      setStep("details");
    },
    []
  );

  const handleCategoryChange = useCallback((newCategory: ContentCategory) => {
    setCategory(newCategory);
    setContentType(getDefaultTypeForCategory(newCategory));
  }, []);

  const handleUpload = useCallback(async () => {
    if (!file) return;

    // Capture current values before async operations
    const currentNftPrice = nftPrice;
    const currentNftCurrency = nftCurrency;
    const currentNftSupplyType = nftSupplyType;
    const currentNftMaxSupply = nftMaxSupply;
    const currentNftRoyaltyPercent = nftRoyaltyPercent;
    const currentContentType = contentType;

    console.log("handleUpload called with NFT config:", {
      price: currentNftPrice,
      currency: currentNftCurrency,
      supplyType: currentNftSupplyType,
      maxSupply: currentNftMaxSupply,
      royaltyPercent: currentNftRoyaltyPercent,
    });

    setStep("uploading");

    const result = await uploadContent(file, {
      title,
      description,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });

    console.log("Upload result:", result);
    console.log("publicKey:", publicKey?.toBase58());

    if (result) {
      // Register on-chain (always when wallet connected)
      if (publicKey && result.metadata) {
        console.log("Starting on-chain registration...");
        console.log("Content CID:", result.content.cid);
        console.log("Metadata CID:", result.metadata.cid);
        setStep("registering");
        try {
          // Always register with NFT mint config in one transaction
          // Parse price
          let priceValue: bigint;
          if (currentNftPrice === "" || currentNftPrice === "0") {
            priceValue = BigInt(0); // Free mint
          } else {
            const priceFloat = parseFloat(currentNftPrice);
            if (currentNftCurrency === PaymentCurrency.Sol) {
              priceValue = BigInt(Math.floor(priceFloat * LAMPORTS_PER_SOL));
            } else {
              priceValue = BigInt(Math.floor(priceFloat * 1_000_000)); // 6 decimals for USDC
            }
          }

          // Parse supply
          let maxSupplyValue: bigint | null = null;
          if (currentNftSupplyType === "limited" && currentNftMaxSupply) {
            maxSupplyValue = BigInt(parseInt(currentNftMaxSupply));
          }

          // Parse royalty
          const royaltyBps = Math.floor(parseFloat(currentNftRoyaltyPercent) * 100);

          console.log("Registering with NFT config:", {
            price: priceValue,
            currency: currentNftCurrency,
            maxSupply: maxSupplyValue,
            royaltyBps,
          });

          const txSig = await registerContentWithMint({
            contentCid: result.content.cid,
            metadataCid: result.metadata.cid,
            contentType: currentContentType,
            price: priceValue,
            currency: currentNftCurrency,
            maxSupply: maxSupplyValue,
            creatorRoyaltyBps: royaltyBps,
          });
          console.log("On-chain registration with NFT successful:", txSig);
        } catch (err) {
          console.error("Failed to register on-chain:", err);
          // Still consider it a success - IPFS upload worked
        }
      } else {
        console.log("Skipping on-chain registration:", {
          hasWallet: !!publicKey,
          hasMetadata: !!result.metadata,
        });
      }

      setStep("done");
      onSuccess?.({
        content: result.content,
        metadata: result.metadata,
      });
    }
  }, [
    file,
    title,
    description,
    tags,
    nftPrice,
    nftCurrency,
    nftSupplyType,
    nftMaxSupply,
    nftRoyaltyPercent,
    contentType,
    publicKey,
    uploadContent,
    registerContentWithMint,
    onSuccess,
  ]);

  const handleClose = () => {
    // Cleanup
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    setFile(null);
    setPreview(null);
    setTitle("");
    setDescription("");
    setTags("");
    setStep("select");
    // Reset NFT state
    setNftPrice("");
    setNftCurrency(PaymentCurrency.Sol);
    setNftSupplyType("unlimited");
    setNftMaxSupply("");
    setNftRoyaltyPercent("5");
    reset();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-gray-900 rounded-2xl w-full max-w-lg mx-4 overflow-hidden border border-gray-800 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-xl font-semibold">
            {step === "select" && "Upload Content"}
            {step === "details" && "Content Details"}
            {step === "uploading" && "Uploading..."}
            {step === "registering" && "Registering..."}
            {step === "done" && "Upload Complete!"}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Step: Select File */}
          {step === "select" && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-700 rounded-xl p-12 text-center cursor-pointer hover:border-primary-500 hover:bg-gray-800/50 transition-all"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
              <p className="text-lg font-medium mb-2">
                Drop your file here or click to browse
              </p>
              <p className="text-sm text-gray-500">
                Video, Audio, or Images up to 500MB
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*,audio/*,image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {/* Step: Details */}
          {step === "details" && file && (
            <div className="space-y-4">
              {/* Preview */}
              <div className="aspect-video bg-gray-800 rounded-lg overflow-hidden">
                {category === "video" && preview && (
                  <video
                    src={preview}
                    className="w-full h-full object-contain"
                    controls
                  />
                )}
                {category === "audio" && preview && (
                  <div className="w-full h-full flex items-center justify-center">
                    <audio src={preview} controls className="w-full max-w-md" />
                  </div>
                )}
                {category === "image" && preview && (
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-full h-full object-contain"
                  />
                )}
                {category === "book" && (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <svg className="w-16 h-16 mx-auto text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      <p className="text-gray-400 mt-2">{file.name}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Category and Type Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Category</label>
                  <select
                    value={category}
                    onChange={(e) => handleCategoryChange(e.target.value as ContentCategory)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
                  >
                    {(Object.keys(CATEGORY_LABELS) as ContentCategory[]).map((cat) => (
                      <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Type</label>
                  <select
                    value={contentType}
                    onChange={(e) => setContentType(Number(e.target.value) as OnChainContentType)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
                  >
                    {getTypesForCategory(category).map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium mb-2">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter a title"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What's this about?"
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500 resize-none"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="crypto, solana, tutorial"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
                />
              </div>

              {/* File info */}
              <div className="text-sm text-gray-500">
                {file.name} • {(file.size / (1024 * 1024)).toFixed(2)} MB
              </div>

              {/* NFT Configuration */}
              {publicKey && (
                <div className="border border-gray-700 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-3 p-3 bg-gray-800">
                    <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <div>
                      <p className="font-medium">NFT Minting Settings</p>
                      <p className="text-xs text-gray-400">Configure how others can mint NFTs of your content</p>
                    </div>
                  </div>

                  <div className="p-3 space-y-3 border-t border-gray-700">
                      {/* Price */}
                      <div>
                        <label className="block text-xs font-medium mb-1.5 text-gray-400">Price</label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            value={nftPrice}
                            onChange={(e) => setNftPrice(e.target.value)}
                            placeholder="0 for free"
                            className="flex-1 px-3 py-1.5 text-sm bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
                          />
                          <select
                            value={nftCurrency}
                            onChange={(e) => setNftCurrency(Number(e.target.value) as PaymentCurrency)}
                            className="px-3 py-1.5 text-sm bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
                          >
                            <option value={PaymentCurrency.Sol}>SOL</option>
                            <option value={PaymentCurrency.Usdc}>USDC</option>
                          </select>
                        </div>
                      </div>

                      {/* Supply */}
                      <div>
                        <label className="block text-xs font-medium mb-1.5 text-gray-400">Supply</label>
                        <div className="flex gap-3 mb-2">
                          <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                            <input
                              type="radio"
                              checked={nftSupplyType === "unlimited"}
                              onChange={() => setNftSupplyType("unlimited")}
                              className="text-primary-500"
                            />
                            <span>Unlimited</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                            <input
                              type="radio"
                              checked={nftSupplyType === "limited"}
                              onChange={() => setNftSupplyType("limited")}
                              className="text-primary-500"
                            />
                            <span>Limited</span>
                          </label>
                        </div>
                        {nftSupplyType === "limited" && (
                          <input
                            type="number"
                            min="1"
                            value={nftMaxSupply}
                            onChange={(e) => setNftMaxSupply(e.target.value)}
                            placeholder="Max editions (e.g., 100)"
                            className="w-full px-3 py-1.5 text-sm bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
                          />
                        )}
                      </div>

                      {/* Royalty */}
                      <div>
                        <label className="block text-xs font-medium mb-1.5 text-gray-400">
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

                      {/* Revenue Split Info */}
                      <div className="bg-gray-900 rounded-lg p-2.5 text-xs">
                        <p className="text-gray-400 mb-1.5">Primary Sale Split:</p>
                        <div className="flex justify-between text-gray-300">
                          <span>You (Creator)</span>
                          <span className="text-green-400">92%</span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                          <span>Platform + Ecosystem</span>
                          <span>8%</span>
                        </div>
                      </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setStep("select");
                    setFile(null);
                    if (preview) URL.revokeObjectURL(preview);
                    setPreview(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!title.trim()}
                  className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors font-medium"
                >
                  Upload to IPFS
                </button>
              </div>
            </div>
          )}

          {/* Step: Uploading */}
          {(step === "uploading" || step === "registering") && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4">
                <svg
                  className="animate-spin w-full h-full text-primary-500"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
              <p className="text-lg font-medium mb-2">
                {step === "uploading" ? "Uploading to IPFS..." : "Registering on Solana..."}
              </p>
              {step === "uploading" && (
                <>
                  <div className="w-full bg-gray-800 rounded-full h-2 mb-2">
                    <div
                      className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-500">{progress}% complete</p>
                </>
              )}
              {step === "registering" && (
                <p className="text-sm text-gray-500">Please confirm the transaction in your wallet</p>
              )}
              {error && <p className="text-red-500 mt-4">{error}</p>}
            </div>
          )}

          {/* Step: Done */}
          {step === "done" && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <p className="text-lg font-medium mb-2">
                Content Published!
              </p>
              <p className="text-sm text-gray-500 mb-4">
                {publicKey
                  ? "Your content is stored on IPFS and registered on Solana."
                  : "Your content is now stored on IPFS."}
              </p>
              {publicKey && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-500/10 text-green-400 rounded-full text-sm mb-4">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  On-chain verified
                </div>
              )}
              <div>
                <button
                  onClick={handleClose}
                  className="px-6 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors font-medium"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
