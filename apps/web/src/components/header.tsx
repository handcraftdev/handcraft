"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { UploadModal } from "./upload";

export function Header() {
  const { publicKey } = useWallet();
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const handleUploadSuccess = (result: {
    content: { cid: string; url: string };
    metadata: { cid: string; url: string } | null;
  }) => {
    console.log("Upload successful:", result);
    // TODO: Add to feed or navigate to content page
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-b border-gray-800">
        <div className="flex items-center justify-between px-4 h-16">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-lg" />
            <span className="text-xl font-bold hidden sm:block">Handcraft</span>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-xl mx-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search videos, audio, communities..."
                className="w-full bg-gray-900 border border-gray-700 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-primary-500 transition-colors"
              />
              <svg
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          {/* Wallet & Actions */}
          <div className="flex items-center gap-3">
            {publicKey && (
              <button
                onClick={() => setIsUploadOpen(true)}
                className="p-2 hover:bg-gray-800 rounded-full transition-colors"
                title="Upload content"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </button>
            )}
            <WalletMultiButton className="!bg-primary-600 hover:!bg-primary-700 !rounded-full !py-2 !px-4 !text-sm !font-medium" />
          </div>
        </div>
      </header>

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={handleUploadSuccess}
      />
    </>
  );
}
