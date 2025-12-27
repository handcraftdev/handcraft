"use client";

import { useState } from "react";

interface BioEditorProps {
  isOpen: boolean;
  onClose: () => void;
  currentBio: string | null;
  currentTagline: string | null;
  onSave: (bio: string | null, tagline: string | null) => Promise<void>;
}

export function BioEditor({
  isOpen,
  onClose,
  currentBio,
  currentTagline,
  onSave,
}: BioEditorProps) {
  const [bio, setBio] = useState(currentBio || "");
  const [tagline, setTagline] = useState(currentTagline || "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      await onSave(
        bio.trim() || null,
        tagline.trim() || null
      );
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (isSaving) return;
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative bg-black rounded-lg w-full max-w-lg mx-4 overflow-hidden border border-white/10">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none" />

        {/* Header */}
        <div className="relative flex items-center justify-between px-4 py-3 border-b border-white/5">
          <h2 className="text-lg font-medium text-white/90">Edit Bio</h2>
          <button
            onClick={handleClose}
            disabled={isSaving}
            className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-all text-white/40 hover:text-white/70 disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="relative p-4 space-y-4">
          {/* Tagline */}
          <div>
            <label className="block text-sm uppercase tracking-[0.2em] text-white/30 mb-2">
              Tagline
            </label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="A short catchy phrase about you..."
              maxLength={100}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-base focus:outline-none focus:border-cyan-500/50 focus:bg-white/[0.07] text-white/90 placeholder:text-white/20 transition-all"
            />
            <p className="text-xs text-white/30 mt-1 text-right">
              {tagline.length}/100
            </p>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm uppercase tracking-[0.2em] text-white/30 mb-2">
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell your audience about yourself, your work, and what they can expect..."
              rows={4}
              maxLength={500}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-base focus:outline-none focus:border-cyan-500/50 focus:bg-white/[0.07] resize-none text-white/90 placeholder:text-white/20 transition-all"
            />
            <p className="text-xs text-white/30 mt-1 text-right">
              {bio.length}/500
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={handleClose}
              disabled={isSaving}
              className="px-4 py-2 text-sm text-white/50 hover:text-white/70 hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium text-white text-sm transition-all"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
