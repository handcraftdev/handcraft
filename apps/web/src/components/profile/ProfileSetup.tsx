"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useContentRegistry } from "@/hooks/useContentRegistry";

export function ProfileSetup() {
  const { publicKey } = useWallet();
  const { hasProfile, isLoadingProfile, createProfile, isCreatingProfile } = useContentRegistry();
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");

  // Don't show if no wallet or already has profile
  if (!publicKey || isLoadingProfile || hasProfile) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username.trim()) {
      setError("Username is required");
      return;
    }

    if (username.length > 32) {
      setError("Username must be 32 characters or less");
      return;
    }

    try {
      await createProfile(username.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create profile");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md mx-4 border border-gray-800">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold">Create Your Profile</h2>
          <p className="text-gray-400 mt-2">
            Set up your creator profile to start publishing content on Handcraft
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              maxLength={32}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 transition-colors"
              disabled={isCreatingProfile}
            />
            <p className="text-xs text-gray-500 mt-1">{username.length}/32 characters</p>
          </div>

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={isCreatingProfile || !username.trim()}
            className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isCreatingProfile ? (
              <>
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating Profile...
              </>
            ) : (
              "Create Profile"
            )}
          </button>

          <p className="text-xs text-gray-500 text-center">
            Your profile will be stored on the Solana blockchain
          </p>
        </form>
      </div>
    </div>
  );
}
