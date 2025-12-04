"use client";

import { useState, useRef, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { UploadModal } from "./upload";
import { useContentRegistry } from "@/hooks/useContentRegistry";
import { useSession } from "@/hooks/useSession";

export function Header() {
  const { publicKey, disconnect } = useWallet();
  const { connection } = useConnection();
  const { content } = useContentRegistry();
  const { clearSession } = useSession();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Prevent hydration mismatch by waiting for client mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch SOL balance
  useEffect(() => {
    if (publicKey) {
      connection.getBalance(publicKey).then((bal) => {
        setBalance(bal / LAMPORTS_PER_SOL);
      }).catch(() => setBalance(null));
    } else {
      setBalance(null);
    }
  }, [publicKey, connection]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleUploadSuccess = (result: {
    content: { cid: string; url: string };
    metadata: { cid: string; url: string } | null;
  }) => {
    console.log("Upload successful:", result);
  };

  // Generate a short display name from the wallet address
  const shortAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : "";

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
          <div className="flex items-center gap-2">
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
            {publicKey ? (
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center gap-2 px-2 py-1.5 bg-gray-900 hover:bg-gray-800 rounded-full border border-gray-800 transition-colors"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center text-sm text-white font-bold">
                    {publicKey.toBase58().charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden sm:block text-sm font-medium pr-1">{shortAddress}</span>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Profile Dropdown Card */}
                {isProfileOpen && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-gray-900 rounded-xl border border-gray-800 shadow-xl overflow-hidden z-50">
                    {/* Wallet Header */}
                    <div className="p-4 bg-gradient-to-br from-primary-500/20 to-secondary-500/20 border-b border-gray-800">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center text-lg text-white font-bold">
                          {publicKey.toBase58().charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white truncate">Wallet</p>
                          <p className="text-xs text-gray-400 truncate">
                            {publicKey.toBase58().slice(0, 8)}...{publicKey.toBase58().slice(-8)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 divide-x divide-gray-800 border-b border-gray-800">
                      <div className="p-3 text-center">
                        <p className="text-lg font-semibold text-white">{content.length}</p>
                        <p className="text-xs text-gray-500">My Content</p>
                      </div>
                      <div className="p-3 text-center">
                        <p className="text-lg font-semibold text-white">
                          {balance !== null ? balance.toFixed(2) : '-'}
                        </p>
                        <p className="text-xs text-gray-500">SOL Balance</p>
                      </div>
                    </div>

                    {/* Network Badge */}
                    <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between">
                      <span className="text-xs text-gray-500">Network</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">
                        Devnet
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="p-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(publicKey.toBase58());
                          setIsProfileOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy Address
                      </button>
                      <button
                        onClick={() => {
                          clearSession();
                          disconnect();
                          setIsProfileOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Disconnect
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : mounted ? (
              <WalletMultiButton className="!bg-primary-600 hover:!bg-primary-700 !rounded-full !py-2 !px-4 !text-sm !font-medium" />
            ) : (
              <div className="h-10 w-32 bg-primary-600 rounded-full animate-pulse" />
            )}
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
