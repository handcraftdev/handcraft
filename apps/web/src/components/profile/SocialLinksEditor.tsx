"use client";

import { useState } from "react";
import { SocialLinkIcon, getPlatformDisplayName } from "./SocialLinkIcon";
import type { CreatorSocialLink } from "@/lib/supabase";

type SocialPlatform =
  | "twitter"
  | "discord"
  | "youtube"
  | "instagram"
  | "tiktok"
  | "twitch"
  | "website"
  | "other";

interface LinkInput {
  id?: number;
  platform: SocialPlatform;
  url: string;
  displayName: string;
}

interface SocialLinksEditorProps {
  isOpen: boolean;
  onClose: () => void;
  currentLinks: CreatorSocialLink[];
  onSave: (links: Array<{ platform: string; url: string; display_name: string | null; position: number }>) => Promise<void>;
}

const PLATFORMS: { key: SocialPlatform; label: string }[] = [
  { key: "twitter", label: "Twitter / X" },
  { key: "discord", label: "Discord" },
  { key: "youtube", label: "YouTube" },
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "twitch", label: "Twitch" },
  { key: "website", label: "Website" },
  { key: "other", label: "Other" },
];

export function SocialLinksEditor({
  isOpen,
  onClose,
  currentLinks,
  onSave,
}: SocialLinksEditorProps) {
  const [links, setLinks] = useState<LinkInput[]>(
    currentLinks.map((l) => ({
      id: l.id,
      platform: l.platform as SocialPlatform,
      url: l.url,
      displayName: l.display_name || "",
    }))
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addLink = () => {
    setLinks([
      ...links,
      { platform: "twitter", url: "", displayName: "" },
    ]);
  };

  const removeLink = (index: number) => {
    setLinks(links.filter((_, i) => i !== index));
  };

  const updateLink = (index: number, field: keyof LinkInput, value: string) => {
    const updated = [...links];
    updated[index] = { ...updated[index], [field]: value };
    setLinks(updated);
  };

  const moveLink = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= links.length) return;

    const updated = [...links];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setLinks(updated);
  };

  const validateUrl = (url: string): boolean => {
    if (!url) return false;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSave = async () => {
    // Filter out empty links and validate
    const validLinks = links.filter((l) => l.url.trim());

    for (const link of validLinks) {
      if (!validateUrl(link.url)) {
        setError(`Invalid URL: ${link.url}`);
        return;
      }
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(
        validLinks.map((l, i) => ({
          platform: l.platform,
          url: l.url,
          display_name: l.displayName.trim() || null,
          position: i,
        }))
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

      <div className="relative bg-black rounded-lg w-full max-w-lg mx-4 overflow-hidden border border-white/10 max-h-[90vh] flex flex-col">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none" />

        {/* Header */}
        <div className="relative flex items-center justify-between px-4 py-3 border-b border-white/5">
          <h2 className="text-lg font-medium text-white/90">Social Links</h2>
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
        <div className="relative p-4 overflow-y-auto flex-1 space-y-3">
          {links.length === 0 && (
            <p className="text-center text-white/30 text-sm py-8">
              No links added yet. Click "Add Link" to get started.
            </p>
          )}

          {links.map((link, index) => (
            <div
              key={index}
              className="p-3 bg-white/[0.02] border border-white/10 rounded-lg space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SocialLinkIcon
                    platform={link.platform}
                    className="w-5 h-5 text-white/50"
                  />
                  <span className="text-sm text-white/70">
                    {getPlatformDisplayName(link.platform)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => moveLink(index, "up")}
                    disabled={index === 0}
                    className="p-1 hover:bg-white/5 rounded disabled:opacity-20 transition-colors"
                  >
                    <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => moveLink(index, "down")}
                    disabled={index === links.length - 1}
                    className="p-1 hover:bg-white/5 rounded disabled:opacity-20 transition-colors"
                  >
                    <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => removeLink(index)}
                    className="p-1 hover:bg-red-500/10 rounded transition-colors ml-1"
                  >
                    <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs uppercase tracking-[0.15em] text-white/30 mb-1.5">
                    Platform
                  </label>
                  <select
                    value={link.platform}
                    onChange={(e) => updateLink(index, "platform", e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white/90 focus:outline-none focus:border-cyan-500/50"
                  >
                    {PLATFORMS.map((p) => (
                      <option key={p.key} value={p.key} className="bg-black">
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-[0.15em] text-white/30 mb-1.5">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={link.displayName}
                    onChange={(e) => updateLink(index, "displayName", e.target.value)}
                    placeholder="Optional"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white/90 placeholder:text-white/20 focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-[0.15em] text-white/30 mb-1.5">
                  URL
                </label>
                <input
                  type="url"
                  value={link.url}
                  onChange={(e) => updateLink(index, "url", e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white/90 placeholder:text-white/20 focus:outline-none focus:border-cyan-500/50"
                />
              </div>
            </div>
          ))}

          {/* Add button */}
          <button
            onClick={addLink}
            className="w-full py-2.5 border border-dashed border-white/10 rounded-lg text-base text-white/40 hover:text-white/60 hover:border-white/20 hover:bg-white/[0.02] transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Link
          </button>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="relative px-4 py-3 border-t border-white/5 flex items-center justify-end gap-2">
          <button
            onClick={handleClose}
            disabled={isSaving}
            className="px-3 py-1.5 text-sm text-white/50 hover:text-white/70 hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-1.5 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium text-white text-sm transition-all"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
