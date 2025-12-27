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
      <div className="relative rounded-lg bg-white/[0.02] border border-white/5 p-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none" />
        <div className="relative animate-pulse">
          <div className="h-5 bg-white/5 rounded w-1/3 mb-3"></div>
          <div className="h-8 bg-white/5 rounded-lg mb-2"></div>
          <div className="h-8 bg-white/5 rounded-lg"></div>
        </div>
      </div>
    );
  }

  // Determine border color based on highlight prop
  const borderClass = highlight
    ? "border-red-500/50 ring-1 ring-red-500/20"
    : "border-white/5 hover:border-white/10";

  const isSubmitting = isCreatingUserProfile || isUpdatingUserProfile;

  return (
    <div className={`relative rounded-lg bg-white/[0.02] border overflow-hidden transition-all duration-200 ${borderClass}`}>
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none" />

      {/* Header */}
      <div className="relative px-4 py-3 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-medium text-white/90">Creator Profile</h2>
              <p className="text-sm text-white/40">Your username appears on your NFT collections</p>
            </div>
          </div>
          {hasExistingProfile && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-md text-sm font-medium transition-all duration-200 flex items-center gap-1.5 text-white/70 hover:text-white/90"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="relative p-4">
        {hasExistingProfile && !isEditing ? (
          <div className="space-y-3">
            {/* Active Status */}
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm font-medium text-emerald-400">Profile Active</span>
              </div>
              <p className="text-xs text-white/40">Your creator profile is set up and ready</p>
            </div>

            {/* Username Display */}
            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-lg">
              <p className="text-2xs uppercase tracking-[0.15em] text-white/30 mb-1">Username</p>
              <p className="text-lg font-bold text-white/90">{userProfile.username}</p>
            </div>

            {/* Collection Name Preview */}
            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-lg">
              <p className="text-2xs uppercase tracking-[0.15em] text-white/30 mb-2">NFT Collection Name</p>
              <div className="bg-black/40 rounded-md p-2.5 border border-white/5">
                <code className="text-sm text-purple-400 font-mono">HC: {userProfile.username}</code>
              </div>
              <p className="text-xs text-white/30 mt-1.5">This is how your NFT collections will be named</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Info Banner */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
              <p className="text-sm text-blue-300/80">
                {isEditing
                  ? "Update your creator username. This will affect how new NFT collections are named."
                  : "Set your creator username. This is required before you can create content and sell editions. Your NFT collections will be named \"HC: YourUsername\"."}
              </p>
            </div>

            {/* Username Input */}
            <div>
              <label className="block text-2xs uppercase tracking-[0.15em] text-white/30 mb-1.5">
                Username
              </label>
              <input
                type="text"
                maxLength={MAX_USERNAME_LENGTH}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-base text-white/90 focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.07] transition-all duration-200 placeholder:text-white/20"
                placeholder="Enter your username"
              />
              <div className="flex justify-between mt-1.5">
                <p className="text-xs text-white/30">Letters, numbers, underscores, and spaces only</p>
                <p className={`text-xs ${username.length > MAX_USERNAME_LENGTH ? "text-red-400" : "text-white/30"}`}>
                  {username.length}/{MAX_USERNAME_LENGTH}
                </p>
              </div>
            </div>

            {/* Preview */}
            {username.trim() && (
              <div className="p-3 bg-white/[0.02] border border-white/5 rounded-lg">
                <p className="text-2xs uppercase tracking-[0.15em] text-white/30 mb-1.5">Preview</p>
                <div className="bg-black/40 rounded-md p-2.5 border border-white/5">
                  <p className="text-xs text-white/30 mb-0.5">Collection Name:</p>
                  <code className="text-sm text-purple-400 font-mono">HC: {username.trim()}</code>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5">
                <p className="text-sm text-emerald-400">
                  {isEditing ? "Username updated successfully!" : "Profile created successfully!"}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className={isEditing ? "flex gap-2" : ""}>
              {isEditing && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg text-sm font-medium transition-all duration-200 text-white/70 hover:text-white/90"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className={`${isEditing ? "flex-1" : "w-full"} py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 hover:border-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-1.5 text-white/90`}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>{isEditing ? "Updating..." : "Creating..."}</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
