"use client";

import { useState, useRef } from "react";
import { useUpload } from "@/hooks/useUpload";
import { getIpfsUrl } from "@handcraft/sdk";

interface BannerEditorProps {
  isOpen: boolean;
  onClose: () => void;
  currentBannerCid: string | null;
  currentBannerUrl: string | null;
  onSave: (bannerCid: string | null, bannerUrl: string | null) => Promise<void>;
}

export function BannerEditor({
  isOpen,
  onClose,
  currentBannerCid,
  currentBannerUrl,
  onSave,
}: BannerEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { uploadFile, isUploading, progress } = useUpload({
    onError: (err) => setError(err),
  });

  const currentImageUrl = currentBannerCid
    ? getIpfsUrl(currentBannerCid)
    : currentBannerUrl;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be smaller than 5MB");
      return;
    }

    setError(null);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemove = async () => {
    setPreviewUrl(null);
    setSelectedFile(null);
    setIsSaving(true);
    setError(null);
    try {
      await onSave(null, null);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to remove banner");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!selectedFile) {
      onClose();
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Upload to IPFS
      const result = await uploadFile(selectedFile);
      if (!result) {
        throw new Error("Upload failed");
      }

      // Save to database
      await onSave(result.cid, result.url);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save banner");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (isSaving || isUploading) return;
    setPreviewUrl(null);
    setSelectedFile(null);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  const displayUrl = previewUrl || currentImageUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={handleClose} />

      <div className="relative bg-black rounded-lg w-full max-w-md mx-4 overflow-hidden border border-white/[0.08]">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none" />

        {/* Header */}
        <div className="relative flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <h2 className="text-lg font-medium text-white/90">Edit Banner</h2>
          <button
            onClick={handleClose}
            disabled={isSaving || isUploading}
            className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-all text-white/40 hover:text-white/70 disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="relative p-4 space-y-4">
          {/* Preview */}
          <div
            className="relative aspect-[3/1] rounded-lg overflow-hidden border border-white/[0.08] cursor-pointer group"
            onClick={() => fileInputRef.current?.click()}
          >
            {displayUrl ? (
              <img
                src={displayUrl}
                alt="Banner preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-purple-900/30 via-cyan-900/20 to-black flex items-center justify-center">
                <div className="text-center">
                  <svg className="w-8 h-8 text-white/20 mx-auto mb-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm text-white/30">Click to upload</p>
                </div>
              </div>
            )}

            {/* Overlay */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <p className="text-white text-sm font-medium">Click to change</p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Upload progress */}
          {isUploading && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-white/50">
                <span>Uploading...</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1 bg-white/[0.08] rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Recommendation */}
          <p className="text-xs text-white/30">
            Recommended size: 1500 x 500 pixels (3:1 aspect ratio)
          </p>

          {/* Error */}
          {error && (
            <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            {currentImageUrl && (
              <button
                onClick={handleRemove}
                disabled={isSaving || isUploading}
                className="px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
              >
                Remove Banner
              </button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={handleClose}
                disabled={isSaving || isUploading}
                className="px-3 py-1.5 text-sm text-white/50 hover:text-white/70 hover:bg-white/[0.06] rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || isUploading || !selectedFile}
                className="px-4 py-1.5 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium text-white text-sm transition-all"
              >
                {isSaving ? "Saving..." : isUploading ? "Uploading..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
