"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useRouter } from "next/navigation";
import { ContentDraft } from "@/lib/supabase";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { ConfirmModal, AlertModal } from "@/components/ui/ConfirmModal";

interface DraftsListProps {
  onDraftSelect?: (draftId: string) => void;
  compact?: boolean;
  excludeStatuses?: string[];
}

const STATUS_STYLES = {
  draft: "bg-white/5 text-white/60 border-white/10",
  uploading: "bg-blue-500/10 text-blue-400/80 border-blue-500/20",
  scheduled: "bg-amber-500/10 text-amber-400/80 border-amber-500/20",
  ready_to_publish: "bg-yellow-500/10 text-yellow-400/80 border-yellow-500/20",
  published: "bg-emerald-500/10 text-emerald-400/80 border-emerald-500/20",
  failed: "bg-red-500/10 text-red-400/80 border-red-500/20",
};

export function DraftsList({ onDraftSelect, compact = false, excludeStatuses = [] }: DraftsListProps) {
  const { publicKey } = useWallet();
  const { session, isAuthenticated, signIn, loading: authLoading } = useSupabaseAuth();
  const router = useRouter();
  const [drafts, setDrafts] = useState<ContentDraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [alertModal, setAlertModal] = useState<{ title: string; message: string } | null>(null);

  // Use access_token string as dependency, not the whole session object
  const accessToken = session?.access_token;

  // Stabilize excludeStatuses - use ref to store value without causing re-fetches
  const excludeStatusesRef = useRef(excludeStatuses);
  excludeStatusesRef.current = excludeStatuses;

  // Track if initial fetch has completed to prevent loading flash on subsequent renders
  const hasFetchedRef = useRef(false);

  const fetchDrafts = useCallback(async (showLoading = true) => {
    if (!isAuthenticated || !accessToken) {
      setDrafts([]);
      setIsLoading(false);
      return;
    }

    // Only show loading spinner if explicitly requested AND we haven't fetched yet
    if (showLoading && !hasFetchedRef.current) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const response = await fetch("/api/drafts", {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("[DraftsList] API error response:", errorData);
        throw new Error(errorData.error || "Failed to fetch drafts");
      }

      const data = await response.json();
      const allDrafts = data.drafts || [];
      const currentExcludeStatuses = excludeStatusesRef.current;
      const filteredDrafts = currentExcludeStatuses.length > 0
        ? allDrafts.filter((d: ContentDraft) => !currentExcludeStatuses.includes(d.status))
        : allDrafts;
      setDrafts(filteredDrafts);
      hasFetchedRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load drafts");
      console.error("[DraftsList] Error fetching drafts:", err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, accessToken]);

  // Fetch drafts when auth state changes
  useEffect(() => {
    fetchDrafts(true);
  }, [fetchDrafts]);

  const handleDeleteClick = (draftId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!isAuthenticated || !session?.access_token) return;
    setDeleteConfirmId(draftId);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId || !session?.access_token) return;

    setDeletingId(deleteConfirmId);
    setDeleteConfirmId(null);

    try {
      const response = await fetch(`/api/drafts/${deleteConfirmId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete draft");
      }

      // Remove from local state
      setDrafts((prev) => prev.filter((d) => d.id !== deleteConfirmId));
    } catch (err) {
      console.error("Error deleting draft:", err);
      setAlertModal({ title: "Delete Failed", message: "Failed to delete draft. Please try again." });
    } finally {
      setDeletingId(null);
    }
  };

  const handlePublishNow = async (draftId: string, event: React.MouseEvent) => {
    event.stopPropagation();

    if (!isAuthenticated || !session?.access_token) return;

    try {
      const response = await fetch("/api/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          draft_id: draftId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to publish draft");
      }

      // Refresh the list without showing loading spinner
      fetchDrafts(false);
    } catch (err) {
      console.error("Error publishing draft:", err);
      alert("Failed to publish draft");
    }
  };

  const handleEditDraft = (draftId: string) => {
    if (onDraftSelect) {
      onDraftSelect(draftId);
    } else {
      router.push(`/studio/upload/${draftId}`);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (!isAuthenticated) {
    return (
      <div className="relative p-4 rounded-lg bg-white/[0.02] border border-white/[0.06] text-center">
        <p className="text-sm text-white/40 mb-2">
          {publicKey ? "Sign in to view and manage drafts" : "Connect your wallet to view drafts"}
        </p>
        {publicKey && (
          <button
            onClick={() => signIn()}
            disabled={authLoading}
            className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-md text-sm text-purple-400 transition-all disabled:opacity-50"
          >
            {authLoading ? "Signing..." : "Sign In"}
          </button>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
        <p className="text-sm text-red-400">Error loading drafts: {error}</p>
        <button
          onClick={() => fetchDrafts()}
          className="mt-1.5 text-sm text-red-400/80 hover:text-red-400 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <svg className="w-4 h-4 animate-spin text-white/40" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="ml-2 text-sm text-white/40">Loading drafts...</span>
      </div>
    );
  }

  if (drafts.length === 0) {
    return (
      <div className="relative p-6 rounded-lg bg-white/[0.02] border border-white/[0.06] text-center">
        <div className="w-8 h-8 rounded-md bg-white/5 flex items-center justify-center mx-auto mb-2">
          <svg className="w-4 h-4 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-sm font-medium mb-0.5 text-white/90">No drafts yet</h3>
        <p className="text-white/40 text-sm">Create your first draft to get started</p>
      </div>
    );
  }

  // Compact list view for sidebar/embedded
  if (compact) {
    return (
      <div className="space-y-1.5">
        {drafts.slice(0, 5).map((draft) => {
          const statusStyle = STATUS_STYLES[draft.status] || STATUS_STYLES.draft;
          const isDeleting = deletingId === draft.id;

          return (
            <div
              key={draft.id}
              onClick={() => handleEditDraft(draft.id)}
              className="group flex items-center gap-2.5 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] transition-all cursor-pointer"
            >
              <div className="w-8 h-8 rounded-md bg-white/5 flex items-center justify-center flex-shrink-0">
                {draft.thumbnail_cid ? (
                  <img
                    src={`https://ipfs.filebase.io/ipfs/${draft.thumbnail_cid}`}
                    alt={draft.title || "Draft thumbnail"}
                    className="w-full h-full object-cover rounded-md"
                  />
                ) : (
                  <svg className="w-4 h-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-white/90 text-sm">{draft.title || "Untitled"}</p>
                <p className="text-2xs text-white/40">{formatDate(draft.updated_at)}</p>
              </div>
              <span className={`px-1.5 py-0.5 rounded text-2xs border ${statusStyle}`}>
                {draft.status}
              </span>
              <button
                onClick={(e) => handleDeleteClick(draft.id, e)}
                disabled={isDeleting}
                className="p-1 rounded opacity-0 group-hover:opacity-100 bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-all disabled:opacity-50"
                title="Delete"
              >
                {isDeleting ? (
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
              </button>
            </div>
          );
        })}
        {drafts.length > 5 && (
          <p className="text-center text-2xs text-white/30 py-1.5">
            +{drafts.length - 5} more drafts
          </p>
        )}

        {/* Delete Confirmation Modal */}
        <ConfirmModal
          isOpen={!!deleteConfirmId}
          onClose={() => setDeleteConfirmId(null)}
          onConfirm={handleDeleteConfirm}
          title="Delete Draft"
          message="Are you sure you want to delete this draft? This will also delete all associated files and cannot be undone."
          confirmLabel="Delete"
          variant="danger"
          isLoading={!!deletingId}
        />

        {/* Alert Modal */}
        <AlertModal
          isOpen={!!alertModal}
          onClose={() => setAlertModal(null)}
          title={alertModal?.title || ""}
          message={alertModal?.message || ""}
          variant="error"
        />
      </div>
    );
  }

  // Full grid view
  return (
    <>
      <div className="space-y-1.5">
        {drafts.map((draft) => {
          const statusStyle = STATUS_STYLES[draft.status] || STATUS_STYLES.draft;
          const isDeleting = deletingId === draft.id;

          return (
            <div
              key={draft.id}
              onClick={() => handleEditDraft(draft.id)}
              className="group relative flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] transition-all duration-300 cursor-pointer"
            >
              <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              {/* Thumbnail */}
              <div className="relative w-10 h-10 rounded-md overflow-hidden bg-white/5 flex-shrink-0">
                {draft.thumbnail_cid ? (
                  <img
                    src={`https://ipfs.filebase.io/ipfs/${draft.thumbnail_cid}`}
                    alt={draft.title || "Draft thumbnail"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="relative flex-1 min-w-0">
                <p className="text-base font-medium truncate text-white/90">{draft.title || "Untitled"}</p>
                <div className="flex items-center gap-2 text-2xs text-white/40">
                  <span>{formatDate(draft.updated_at)}</span>
                  {draft.scheduled_at && draft.status === "scheduled" && (
                    <span className="text-amber-400/80">
                      Scheduled: {new Date(draft.scheduled_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Status & Actions */}
              <div className="relative flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded text-2xs border ${statusStyle}`}>
                  {draft.status}
                </span>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditDraft(draft.id);
                    }}
                    className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/90 transition-all"
                    title="Edit"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>

                  <button
                    onClick={(e) => handleDeleteClick(draft.id, e)}
                    disabled={isDeleting}
                    className="p-1.5 rounded bg-white/5 hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-all disabled:opacity-50"
                    title="Delete"
                  >
                    {isDeleting ? (
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <svg className="relative w-3.5 h-3.5 text-white/20 group-hover:text-white/40 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Draft"
        message="Are you sure you want to delete this draft? This will also delete all associated files and cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        isLoading={!!deletingId}
      />

      {/* Alert Modal */}
      <AlertModal
        isOpen={!!alertModal}
        onClose={() => setAlertModal(null)}
        title={alertModal?.title || ""}
        message={alertModal?.message || ""}
        variant="error"
      />
    </>
  );
}
