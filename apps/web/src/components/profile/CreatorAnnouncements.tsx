"use client";

import { useState } from "react";
import type { CreatorAnnouncement } from "@/lib/supabase";

interface CreatorAnnouncementsProps {
  announcements: CreatorAnnouncement[];
  isEditable?: boolean;
  onEdit?: () => void;
  onDelete?: (id: number) => void;
}

export function CreatorAnnouncements({
  announcements,
  isEditable = false,
  onEdit,
  onDelete,
}: CreatorAnnouncementsProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (announcements.length === 0 && !isEditable) {
    return null;
  }

  // Sort: pinned first, then by date
  const sortedAnnouncements = [...announcements].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white/70 uppercase tracking-wider">
          Announcements
        </h3>
        {isEditable && onEdit && (
          <button
            onClick={onEdit}
            className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            New
          </button>
        )}
      </div>

      {announcements.length === 0 && isEditable && (
        <button
          onClick={onEdit}
          className="w-full p-4 border border-dashed border-white/10 rounded-xl hover:border-white/20 hover:bg-white/[0.02] transition-all duration-300 text-white/30 text-sm"
        >
          Create your first announcement
        </button>
      )}

      <div className="space-y-3">
        {sortedAnnouncements.map((announcement) => {
          const isExpanded = expandedId === announcement.id;
          const isLongContent = announcement.content.length > 150;

          return (
            <div
              key={announcement.id}
              className={`relative p-4 rounded-xl border transition-all duration-300 ${
                announcement.is_pinned
                  ? "bg-amber-500/5 border-amber-500/20"
                  : "bg-white/[0.02] border-white/10"
              }`}
            >
              {/* Pinned indicator */}
              {announcement.is_pinned && (
                <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded-full text-xs uppercase tracking-wider text-amber-400">
                  Pinned
                </div>
              )}

              {/* Header */}
              <div className="flex items-start justify-between gap-4 mb-2">
                <h4 className="font-medium text-white/90">{announcement.title}</h4>
                <span className="text-xs text-white/30 whitespace-nowrap">
                  {formatDate(announcement.published_at)}
                </span>
              </div>

              {/* Content */}
              <p className="text-sm text-white/60 leading-relaxed whitespace-pre-wrap">
                {isExpanded || !isLongContent
                  ? announcement.content
                  : `${announcement.content.slice(0, 150)}...`}
              </p>

              {/* Expand/collapse */}
              {isLongContent && (
                <button
                  onClick={() => setExpandedId(isExpanded ? null : announcement.id)}
                  className="mt-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  {isExpanded ? "Show less" : "Read more"}
                </button>
              )}

              {/* Link button */}
              {announcement.link_url && (
                <a
                  href={announcement.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 rounded-lg text-sm text-cyan-300 transition-all duration-300"
                >
                  {announcement.link_text || "Learn more"}
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}

              {/* Expiry indicator */}
              {announcement.expires_at && (
                <div className="mt-3 text-xs text-white/30">
                  Expires {new Date(announcement.expires_at).toLocaleDateString()}
                </div>
              )}

              {/* Delete button (for editable) */}
              {isEditable && onDelete && (
                <button
                  onClick={() => onDelete(announcement.id)}
                  className="absolute top-4 right-4 p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded transition-all duration-300"
                  title="Delete announcement"
                >
                  <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
