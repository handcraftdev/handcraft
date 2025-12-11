"use client";

import { useState } from "react";
import { BundleType, getBundleTypeLabel, getSuggestedBundleTypes, ContentDomain } from "@handcraft/sdk";
import { useContentRegistry } from "@/hooks/useContentRegistry";

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

export function CreateBundleModal({
  isOpen,
  onClose,
  onSuccess,
  creatorDomain,
}: CreateBundleModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [bundleType, setBundleType] = useState<BundleType>(BundleType.Playlist);
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { createBundle, isCreatingBundle } = useContentRegistry();

  // Get suggested bundle types based on creator's primary domain
  const suggestedTypes = creatorDomain
    ? getSuggestedBundleTypes(creatorDomain)
    : ALL_BUNDLE_TYPES;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    try {
      // Generate a bundle ID from title (slug-like)
      const bundleId = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 32);

      // Create bundle metadata
      const metadata = {
        name: title.trim(),
        description: description.trim(),
        bundleType: getBundleTypeLabel(bundleType),
        createdAt: new Date().toISOString(),
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

      // Create bundle on-chain
      await createBundle.mutateAsync({
        bundleId,
        metadataCid,
        bundleType,
      });

      // Success
      onSuccess?.(bundleId);
      onClose();

      // Reset form
      setTitle("");
      setDescription("");
      setBundleType(BundleType.Playlist);
      setCoverImage(null);
    } catch (err) {
      console.error("Failed to create bundle:", err);
      setError(err instanceof Error ? err.message : "Failed to create bundle");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />

      <div className="relative bg-gray-900 rounded-xl w-full max-w-lg p-6 m-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Create Bundle</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Bundle Type */}
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
            {suggestedTypes.length < ALL_BUNDLE_TYPES.length && (
              <p className="text-xs text-gray-500 mt-2">
                Showing suggested types based on your content. All types are available.
              </p>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`Enter ${getBundleTypeLabel(bundleType).toLowerCase()} title`}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your bundle..."
              rows={3}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500 resize-none"
            />
          </div>

          {/* Cover Image (optional) */}
          <div>
            <label className="block text-sm font-medium mb-2">Cover Image (Optional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setCoverImage(e.target.files?.[0] || null)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-primary-500 file:text-white file:text-sm"
            />
          </div>

          {/* Bundle Type Info */}
          <div className="bg-gray-800/50 rounded-lg p-3">
            <h4 className="text-sm font-medium text-gray-300 mb-1">
              {getBundleTypeLabel(bundleType)}
            </h4>
            <p className="text-xs text-gray-500">
              {bundleType === BundleType.Album && "A music album with ordered tracks. Perfect for releasing EPs or full albums."}
              {bundleType === BundleType.Series && "A video series with seasons and episodes. Ideal for TV shows or web series."}
              {bundleType === BundleType.Playlist && "A curated collection of any content type. Flexible ordering."}
              {bundleType === BundleType.Course && "Educational content with ordered lessons. Great for tutorials and courses."}
              {bundleType === BundleType.Newsletter && "Recurring posts in chronological order. Perfect for blogs and newsletters."}
              {bundleType === BundleType.Collection && "A collection of related items like photos or artwork."}
              {bundleType === BundleType.ProductPack && "Digital products sold together as a package."}
            </p>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreatingBundle}
              className="flex-1 py-3 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
            >
              {isCreatingBundle ? "Creating..." : "Create Bundle"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
