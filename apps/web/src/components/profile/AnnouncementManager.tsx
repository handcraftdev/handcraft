"use client";

import { useState } from "react";
import type { CreatorAnnouncement } from "@/lib/supabase";

interface AnnouncementManagerProps {
  isOpen: boolean;
  onClose: () => void;
  currentAnnouncements: CreatorAnnouncement[];
  onCreate: (announcement: {
    title: string;
    content: string;
    link_url: string | null;
    link_text: string | null;
    is_pinned: boolean;
    expires_at: string | null;
  }) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export function AnnouncementManager({
  isOpen,
  onClose,
  currentAnnouncements,
  onCreate,
  onDelete,
}: AnnouncementManagerProps) {
  const [view, setView] = useState<"list" | "create">("list");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setTitle("");
    setContent("");
    setLinkUrl("");
    setLinkText("");
    setIsPinned(false);
    setExpiresAt("");
    setError(null);
  };

  const handleCreate = async () => {
    if (!title.trim() || !content.trim()) {
      setError("Title and content are required");
      return;
    }

    if (linkUrl && !linkUrl.startsWith("http")) {
      setError("Link URL must start with http:// or https://");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onCreate({
        title: title.trim(),
        content: content.trim(),
        link_url: linkUrl.trim() || null,
        link_text: linkText.trim() || null,
        is_pinned: isPinned,
        expires_at: expiresAt || null,
      });
      resetForm();
      setView("list");
    } catch (err: any) {
      setError(err.message || "Failed to create announcement");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this announcement?")) {
      return;
    }

    setIsDeleting(id);
    try {
      await onDelete(id);
    } catch (err: any) {
      setError(err.message || "Failed to delete announcement");
    } finally {
      setIsDeleting(null);
    }
  };

  const handleClose = () => {
    if (isSaving) return;
    resetForm();
    setView("list");
    onClose();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative bg-black rounded-2xl w-full max-w-lg mx-4 overflow-hidden border border-white/10 max-h-[90vh] flex flex-col">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none" />

        {/* Header */}
        <div className="relative flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            {view === "create" && (
              <button
                onClick={() => {
                  resetForm();
                  setView("list");
                }}
                className="p-1.5 hover:bg-white/5 rounded-lg transition-all duration-300 text-white/40 hover:text-white/70"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h2 className="text-lg font-medium text-white/90">
              {view === "list" ? "Announcements" : "New Announcement"}
            </h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isSaving}
            className="p-2 hover:bg-white/5 rounded-full transition-all duration-300 text-white/40 hover:text-white/70 disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="relative p-6 overflow-y-auto flex-1">
          {view === "list" ? (
            <div className="space-y-4">
              {currentAnnouncements.length === 0 && (
                <p className="text-center text-white/30 text-sm py-8">
                  No announcements yet. Create one to engage your audience.
                </p>
              )}

              {currentAnnouncements.map((announcement) => (
                <div
                  key={announcement.id}
                  className={`p-4 rounded-xl border ${
                    announcement.is_pinned
                      ? "bg-amber-500/5 border-amber-500/20"
                      : "bg-white/[0.02] border-white/10"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {announcement.is_pinned && (
                          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-xs uppercase tracking-wider">
                            Pinned
                          </span>
                        )}
                        <h4 className="font-medium text-white/90 truncate">
                          {announcement.title}
                        </h4>
                      </div>
                      <p className="text-sm text-white/50 line-clamp-2">
                        {announcement.content}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-white/30">
                        <span>{formatDate(announcement.published_at)}</span>
                        {announcement.expires_at && (
                          <span className="text-amber-400/60">
                            Expires {formatDate(announcement.expires_at)}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(announcement.id)}
                      disabled={isDeleting === announcement.id}
                      className="p-2 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0"
                    >
                      {isDeleting === announcement.id ? (
                        <svg className="w-4 h-4 text-white/30 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              ))}

              {/* Create button */}
              <button
                onClick={() => setView("create")}
                className="w-full py-3 border border-dashed border-white/10 rounded-xl text-sm text-white/40 hover:text-white/60 hover:border-white/20 hover:bg-white/[0.02] transition-all duration-300 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                New Announcement
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Title */}
              <div>
                <label className="block text-sm uppercase tracking-[0.2em] text-white/30 mb-2">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Announcement title..."
                  maxLength={100}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-cyan-500/50 focus:bg-white/[0.07] text-white/90 placeholder:text-white/20 transition-all duration-300"
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm uppercase tracking-[0.2em] text-white/30 mb-2">
                  Content <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="What do you want to announce..."
                  rows={4}
                  maxLength={1000}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-cyan-500/50 focus:bg-white/[0.07] resize-none text-white/90 placeholder:text-white/20 transition-all duration-300"
                />
                <p className="text-xs text-white/30 mt-1 text-right">
                  {content.length}/1000
                </p>
              </div>

              {/* Link */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm uppercase tracking-[0.2em] text-white/30 mb-2">
                    Link URL
                  </label>
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-cyan-500/50 focus:bg-white/[0.07] text-white/90 placeholder:text-white/20 transition-all duration-300"
                  />
                </div>
                <div>
                  <label className="block text-sm uppercase tracking-[0.2em] text-white/30 mb-2">
                    Button Text
                  </label>
                  <input
                    type="text"
                    value={linkText}
                    onChange={(e) => setLinkText(e.target.value)}
                    placeholder="Learn more"
                    maxLength={30}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-cyan-500/50 focus:bg-white/[0.07] text-white/90 placeholder:text-white/20 transition-all duration-300"
                  />
                </div>
              </div>

              {/* Options */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm uppercase tracking-[0.2em] text-white/30 mb-2">
                    Expires
                  </label>
                  <input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-cyan-500/50 focus:bg-white/[0.07] text-white/90 transition-all duration-300"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPinned}
                      onChange={(e) => setIsPinned(e.target.checked)}
                      className="w-5 h-5 rounded bg-white/5 border border-white/20 checked:bg-amber-500 checked:border-amber-500"
                    />
                    <span className="text-sm text-white/70">Pin to top</span>
                  </label>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleCreate}
                disabled={isSaving || !title.trim() || !content.trim()}
                className="w-full py-3 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium text-white transition-all"
              >
                {isSaving ? "Creating..." : "Create Announcement"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
