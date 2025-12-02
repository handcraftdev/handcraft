"use client";

import { useState, useRef, useCallback } from "react";
import { useContentUpload } from "@/hooks/useUpload";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: {
    content: { cid: string; url: string };
    metadata: { cid: string; url: string } | null;
  }) => void;
}

type ContentType = "video" | "audio" | "image";

export function UploadModal({ isOpen, onClose, onSuccess }: UploadModalProps) {
  const [step, setStep] = useState<"select" | "details" | "uploading" | "done">(
    "select"
  );
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [contentType, setContentType] = useState<ContentType>("video");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { isUploading, progress, error, uploadContent, reset } =
    useContentUpload({
      onSuccess: (result) => {
        setStep("done");
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

      // Determine content type
      if (selectedFile.type.startsWith("video/")) {
        setContentType("video");
      } else if (selectedFile.type.startsWith("audio/")) {
        setContentType("audio");
      } else if (selectedFile.type.startsWith("image/")) {
        setContentType("image");
      }

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

  const handleUpload = async () => {
    if (!file) return;

    setStep("uploading");

    const result = await uploadContent(file, {
      title,
      description,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });

    if (result) {
      onSuccess?.({
        content: result.content,
        metadata: result.metadata,
      });
    }
  };

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
      <div className="relative bg-gray-900 rounded-2xl w-full max-w-lg mx-4 overflow-hidden border border-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-xl font-semibold">
            {step === "select" && "Upload Content"}
            {step === "details" && "Content Details"}
            {step === "uploading" && "Uploading..."}
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
        <div className="p-6">
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
                {contentType === "video" && preview && (
                  <video
                    src={preview}
                    className="w-full h-full object-contain"
                    controls
                  />
                )}
                {contentType === "audio" && preview && (
                  <div className="w-full h-full flex items-center justify-center">
                    <audio src={preview} controls className="w-full max-w-md" />
                  </div>
                )}
                {contentType === "image" && preview && (
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-full h-full object-contain"
                  />
                )}
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
          {step === "uploading" && (
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
              <p className="text-lg font-medium mb-2">Uploading to IPFS...</p>
              <div className="w-full bg-gray-800 rounded-full h-2 mb-2">
                <div
                  className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-500">{progress}% complete</p>
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
                Successfully uploaded to IPFS!
              </p>
              <p className="text-sm text-gray-500 mb-6">
                Your content is now stored on the decentralized web.
              </p>
              <button
                onClick={handleClose}
                className="px-6 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors font-medium"
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
