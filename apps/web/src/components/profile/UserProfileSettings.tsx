"use client";

import { useState, useEffect } from "react";
import { useContentRegistry } from "@/hooks/useContentRegistry";

interface UserProfileSettingsProps {
  onSuccess?: () => void;
  highlight?: boolean;
}

const MAX_USERNAME_LENGTH = 20;

export function UserProfileSettings({ onSuccess, highlight }: UserProfileSettingsProps) {
  const {
    userProfile,
    isLoadingUserProfile,
    createUserProfile,
    updateUserProfile,
    isCreatingUserProfile,
    isUpdatingUserProfile,
  } = useContentRegistry();

  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const hasExistingProfile = !!userProfile;

  // Set initial username from existing profile when entering edit mode
  useEffect(() => {
    if (isEditing && userProfile) {
      setUsername(userProfile.username);
    }
  }, [isEditing, userProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const trimmedUsername = username.trim();

    if (!trimmedUsername) {
      setError("Please enter a username");
      return;
    }

    if (trimmedUsername.length > MAX_USERNAME_LENGTH) {
      setError(`Username must be ${MAX_USERNAME_LENGTH} characters or less`);
      return;
    }

    // Validate username format (alphanumeric, underscores, and spaces)
    if (!/^[a-zA-Z0-9_ ]+$/.test(trimmedUsername)) {
      setError("Username can only contain letters, numbers, underscores, and spaces");
      return;
    }

    try {
      if (hasExistingProfile) {
        await updateUserProfile({ username: trimmedUsername });
      } else {
        await createUserProfile({ username: trimmedUsername });
      }
      setSuccess(true);
      setIsEditing(false);
      onSuccess?.();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save profile";
      setError(errorMessage);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setError(null);
    setSuccess(false);
    if (userProfile) {
      setUsername(userProfile.username);
    }
  };

  if (isLoadingUserProfile) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-800 rounded w-1/3 mb-4"></div>
          <div className="h-10 bg-gray-800 rounded mb-3"></div>
          <div className="h-10 bg-gray-800 rounded"></div>
        </div>
      </div>
    );
  }

  // Determine border color based on highlight prop
  const borderClass = highlight ? "border-red-500" : "border-gray-800";

  const isSubmitting = isCreatingUserProfile || isUpdatingUserProfile;

  return (
    <div className={`bg-gray-900 rounded-xl border overflow-hidden ${borderClass}`}>
      <div className="p-5 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold">Creator Profile</h2>
              <p className="text-sm text-gray-400">Your username appears on your NFT collections</p>
            </div>
          </div>
          {hasExistingProfile && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
          )}
        </div>
      </div>

      <div className="p-5">
        {hasExistingProfile && !isEditing ? (
          <div className="space-y-4">
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium text-green-400">Profile Active</span>
              </div>
              <p className="text-sm text-gray-400">Your creator profile is set up and ready.</p>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Username</p>
              <p className="text-2xl font-bold text-white">{userProfile.username}</p>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-4">
              <h4 className="text-sm font-medium mb-3">Your NFT Collection Name</h4>
              <div className="bg-gray-900 rounded-lg p-3">
                <code className="text-sm text-blue-400">HC: {userProfile.username}</code>
              </div>
              <p className="text-xs text-gray-500 mt-2">This is how your NFT collections will be named</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-300">
                {isEditing
                  ? "Update your creator username. This will affect how new NFT collections are named."
                  : "Set your creator username. This is required before you can create content and mint NFTs. Your NFT collections will be named \"HC: YourUsername\"."}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Username
              </label>
              <input
                type="text"
                maxLength={MAX_USERNAME_LENGTH}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Enter your username"
              />
              <div className="flex justify-between mt-1">
                <p className="text-xs text-gray-500">Letters, numbers, underscores, and spaces only</p>
                <p className={`text-xs ${username.length > MAX_USERNAME_LENGTH ? "text-red-400" : "text-gray-500"}`}>
                  {username.length}/{MAX_USERNAME_LENGTH}
                </p>
              </div>
            </div>

            {/* Preview */}
            {username.trim() && (
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h4 className="text-sm font-medium mb-2">Preview</h4>
                <div className="bg-gray-900 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Collection Name:</p>
                  <code className="text-sm text-blue-400">HC: {username.trim()}</code>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                <p className="text-sm text-green-400">
                  {isEditing ? "Username updated successfully!" : "Profile created successfully!"}
                </p>
              </div>
            )}

            <div className={isEditing ? "flex gap-3" : ""}>
              {isEditing && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className={`${isEditing ? "flex-1" : "w-full"} py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center justify-center gap-2`}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>{isEditing ? "Updating..." : "Creating..."}</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{isEditing ? "Update Username" : "Create Profile"}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
