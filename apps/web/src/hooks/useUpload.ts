"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export interface UploadResult {
  cid: string;
  size: number;
  name: string;
  url: string;
  // Encryption fields (present when encrypt=true)
  previewCid?: string;
  encryptionMeta?: {
    version: number;
    algorithm: string;
    nonce: string;
    contentId: string;
  };
}

export interface UploadState {
  isUploading: boolean;
  progress: number;
  error: string | null;
  result: UploadResult | null;
}

export interface UseUploadOptions {
  onSuccess?: (result: UploadResult) => void;
  onError?: (error: string) => void;
}

/**
 * Upload session tracking for atomic uploads.
 * Tracks all CIDs uploaded in a session so they can be associated together.
 * Persisted to localStorage to survive page refresh/close.
 */
export interface UploadSession {
  id: string;
  startedAt: number;
  uploadedCids: string[];
  status: "in_progress" | "completed" | "failed" | "cancelled" | "abandoned";
  contentCid?: string;
  previewCid?: string;
  encryptionMetaCid?: string;
  metadataCid?: string;
  // Additional context for recovery
  fileName?: string;
  fileSize?: number;
  title?: string;
}

const UPLOAD_SESSIONS_KEY = "handcraft_upload_sessions";
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Persist session to localStorage
 */
function saveSession(session: UploadSession): void {
  if (typeof window === "undefined") return;
  try {
    const sessions = getSessions();
    const existingIndex = sessions.findIndex(s => s.id === session.id);
    if (existingIndex >= 0) {
      sessions[existingIndex] = session;
    } else {
      sessions.push(session);
    }
    localStorage.setItem(UPLOAD_SESSIONS_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.error("[Upload] Failed to save session:", e);
  }
}

/**
 * Get all sessions from localStorage
 */
function getSessions(): UploadSession[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(UPLOAD_SESSIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Remove a session from localStorage
 */
function removeSession(sessionId: string): void {
  if (typeof window === "undefined") return;
  try {
    const sessions = getSessions().filter(s => s.id !== sessionId);
    localStorage.setItem(UPLOAD_SESSIONS_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.error("[Upload] Failed to remove session:", e);
  }
}

/**
 * Get orphaned sessions (in_progress sessions older than threshold, or abandoned)
 */
export function getOrphanedSessions(): UploadSession[] {
  const sessions = getSessions();
  const now = Date.now();

  return sessions.filter(s => {
    // Completed sessions are not orphaned
    if (s.status === "completed") return false;

    // Explicitly abandoned/cancelled/failed sessions are orphaned
    if (s.status === "abandoned" || s.status === "cancelled" || s.status === "failed") {
      return true;
    }

    // In-progress sessions older than expiry are considered abandoned
    if (s.status === "in_progress" && (now - s.startedAt) > SESSION_EXPIRY_MS) {
      return true;
    }

    return false;
  });
}

/**
 * Clean up old completed and orphaned sessions
 */
export function cleanupSessions(): { orphaned: UploadSession[]; cleaned: number } {
  const sessions = getSessions();
  const now = Date.now();
  const orphaned: UploadSession[] = [];

  const cleanedSessions = sessions.filter(s => {
    // Keep recent in-progress sessions (might be active in another tab)
    if (s.status === "in_progress" && (now - s.startedAt) < SESSION_EXPIRY_MS) {
      return true;
    }

    // Mark old in-progress as abandoned
    if (s.status === "in_progress" && (now - s.startedAt) >= SESSION_EXPIRY_MS) {
      s.status = "abandoned";
      orphaned.push(s);
      return false; // Remove from storage
    }

    // Collect orphaned sessions
    if (s.status === "abandoned" || s.status === "cancelled" || s.status === "failed") {
      orphaned.push(s);
      return false; // Remove from storage
    }

    // Keep completed sessions for 24 hours for reference, then remove
    if (s.status === "completed") {
      return (now - s.startedAt) < SESSION_EXPIRY_MS;
    }

    return true;
  });

  if (typeof window !== "undefined") {
    localStorage.setItem(UPLOAD_SESSIONS_KEY, JSON.stringify(cleanedSessions));
  }

  return { orphaned, cleaned: sessions.length - cleanedSessions.length };
}

export function useUpload(hookOptions: UseUploadOptions = {}) {
  const [state, setState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    error: null,
    result: null,
  });

  const uploadFile = useCallback(
    async (file: File, name?: string, options?: { encrypt?: boolean; generatePreview?: boolean }): Promise<UploadResult | null> => {
      setState({
        isUploading: true,
        progress: 0,
        error: null,
        result: null,
      });

      try {
        const formData = new FormData();
        formData.append("file", file);
        if (name) {
          formData.append("name", name);
        }
        // Always encrypt and generate preview by default
        if (options?.encrypt !== false) {
          formData.append("encrypt", "true");
        }
        if (options?.generatePreview !== false) {
          formData.append("generatePreview", "true");
        }

        // Simulate progress for now (XHR would give real progress)
        setState((prev) => ({ ...prev, progress: 30 }));

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        setState((prev) => ({ ...prev, progress: 70 }));

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Upload failed");
        }

        const result = await response.json();

        setState({
          isUploading: false,
          progress: 100,
          error: null,
          result,
        });

        hookOptions.onSuccess?.(result);
        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Upload failed";

        setState({
          isUploading: false,
          progress: 0,
          error: errorMessage,
          result: null,
        });

        hookOptions.onError?.(errorMessage);
        return null;
      }
    },
    [hookOptions]
  );

  const uploadMetadata = useCallback(
    async (
      metadata: Record<string, unknown>,
      name?: string
    ): Promise<{ cid: string; url: string } | null> => {
      try {
        const response = await fetch("/api/upload/metadata", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ metadata, name }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Metadata upload failed");
        }

        return response.json();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Metadata upload failed";
        hookOptions.onError?.(errorMessage);
        return null;
      }
    },
    [hookOptions]
  );

  const reset = useCallback(() => {
    setState({
      isUploading: false,
      progress: 0,
      error: null,
      result: null,
    });
  }, []);

  return {
    ...state,
    uploadFile,
    uploadMetadata,
    reset,
  };
}

/**
 * Complete upload result including all CIDs for tracking
 */
export interface ContentUploadResult {
  content: UploadResult;
  thumbnail: UploadResult | null;
  metadata: { cid: string; url: string } | null;
  isEncrypted: boolean;
  previewCid: string | null;
  encryptionMetaCid: string | null;
  // Session tracking for cleanup/retry
  session: UploadSession;
}

/**
 * Hook for uploading content with metadata.
 * Implements atomic upload tracking - all steps are tracked in a session
 * so the upload can be retried or cleaned up properly.
 *
 * Sessions are persisted to localStorage to survive:
 * - Page refresh
 * - Browser close
 * - Tab close
 * - Navigation away
 */
export function useContentUpload(options: UseUploadOptions = {}) {
  const upload = useUpload(options);
  const [thumbnailResult, setThumbnailResult] = useState<UploadResult | null>(null);
  const [session, setSession] = useState<UploadSession | null>(null);
  const sessionRef = useRef<UploadSession | null>(null);

  // Clean up orphaned sessions on mount
  useEffect(() => {
    const { orphaned, cleaned } = cleanupSessions();
    if (orphaned.length > 0) {
      console.log(`[Upload] Found ${orphaned.length} orphaned sessions with CIDs:`,
        orphaned.flatMap(s => s.uploadedCids)
      );
    }
    if (cleaned > 0) {
      console.log(`[Upload] Cleaned up ${cleaned} old sessions`);
    }
  }, []);

  // Handle page unload - mark in-progress sessions as abandoned
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (sessionRef.current && sessionRef.current.status === "in_progress") {
        // Mark as abandoned in localStorage before page unloads
        sessionRef.current.status = "abandoned";
        saveSession(sessionRef.current);
        console.log("[Upload] Session marked as abandoned due to page unload");
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  /**
   * Start a new upload session
   */
  const startSession = useCallback((fileName?: string, fileSize?: number, title?: string) => {
    const newSession: UploadSession = {
      id: `upload_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      startedAt: Date.now(),
      uploadedCids: [],
      status: "in_progress",
      fileName,
      fileSize,
      title,
    };
    sessionRef.current = newSession;
    setSession(newSession);
    // Persist immediately
    saveSession(newSession);
    return newSession;
  }, []);

  /**
   * Track a CID in the current session
   */
  const trackCid = useCallback((cid: string, type: "content" | "preview" | "encryptionMeta" | "metadata" | "thumbnail") => {
    if (sessionRef.current) {
      sessionRef.current.uploadedCids.push(cid);
      if (type === "content") sessionRef.current.contentCid = cid;
      if (type === "preview") sessionRef.current.previewCid = cid;
      if (type === "encryptionMeta") sessionRef.current.encryptionMetaCid = cid;
      if (type === "metadata") sessionRef.current.metadataCid = cid;
      setSession({ ...sessionRef.current });
      // Persist after each CID is tracked
      saveSession(sessionRef.current);
    }
  }, []);

  /**
   * Mark session as complete or failed
   */
  const finalizeSession = useCallback((status: "completed" | "failed" | "cancelled" | "abandoned") => {
    if (sessionRef.current) {
      sessionRef.current.status = status;
      setSession({ ...sessionRef.current });
      // Persist final status
      saveSession(sessionRef.current);

      // If completed, we can remove from storage after a delay
      // (keeping for reference/debugging)
      if (status === "completed") {
        // Session stays in storage but marked complete
        console.log("[Upload] Session completed successfully:", sessionRef.current.id);
      }
    }
  }, []);

  /**
   * Upload content with full tracking.
   * Returns null if any step fails, with session tracking for cleanup.
   */
  const uploadContent = useCallback(
    async (
      file: File,
      metadata: {
        // Required
        title: string;
        // Content Architecture - Layer 1 & 2 (domain derived from type)
        contentType?: string; // e.g., "movie", "music", "photo"
        contentDomain?: string; // e.g., "video", "audio", "image" (derived, for reference)
        // Layer 3: Context (metadata for discovery)
        description?: string;
        tags?: string[];
        genre?: string; // For music, movies, etc.
        category?: string; // For posts, assets
        // Type-specific context fields
        artist?: string;
        album?: string;
        director?: string;
        cast?: string;
        showName?: string;
        season?: string;
        episode?: string;
        author?: string;
        narrator?: string;
        publisher?: string;
        year?: string;
        duration?: string;
        // Layer 4: Bundle reference
        bundleId?: string; // If part of a bundle (album, series, course)
        bundlePosition?: number; // Position within bundle (track #, episode #)
        // All other fields passed through
        [key: string]: string | string[] | number | undefined;
      },
      thumbnail?: Blob
    ): Promise<ContentUploadResult | null> => {
      // Start a new session for this upload with file context
      const currentSession = startSession(file.name, file.size, metadata.title);

      try {
        // 1. Upload main content (encrypted by default)
        const contentResult = await upload.uploadFile(file, metadata.title);
        if (!contentResult) {
          finalizeSession("failed");
          return null;
        }
        trackCid(contentResult.cid, "content");
        if (contentResult.previewCid) {
          trackCid(contentResult.previewCid, "preview");
        }

        // 2. Upload thumbnail if provided
        let thumbResult: UploadResult | null = null;
        if (thumbnail) {
          const thumbFile = new File(
            [thumbnail],
            `${metadata.title}-thumbnail.jpg`,
            { type: "image/jpeg" }
          );
          // Don't encrypt thumbnails
          thumbResult = await upload.uploadFile(
            thumbFile,
            `${metadata.title}-thumbnail`,
            { encrypt: false, generatePreview: false }
          );
          if (thumbResult) {
            trackCid(thumbResult.cid, "thumbnail");
          }
          setThumbnailResult(thumbResult);
        }

        // 3. Upload encryption metadata to IPFS if content was encrypted
        let encryptionMetaCid: string | null = null;
        if (contentResult.encryptionMeta) {
          const encryptionMetaResult = await upload.uploadMetadata(
            contentResult.encryptionMeta,
            `${metadata.title}-encryption-meta`
          );
          if (encryptionMetaResult) {
            encryptionMetaCid = encryptionMetaResult.cid;
            trackCid(encryptionMetaCid, "encryptionMeta");
          }
        }

        // 4. Upload content metadata in standard Metaplex NFT format
        // This ensures NFTs display correctly on Magic Eden, Tensor, etc.
        const isVideo = file.type.startsWith("video/");
        const isAudio = file.type.startsWith("audio/");
        const isImage = file.type.startsWith("image/");
        const isDocument = file.type === "application/pdf" || file.type.includes("epub");

        // Derive domain from file type if not provided
        const contentDomain = metadata.contentDomain || (
          isVideo ? "video" :
          isAudio ? "audio" :
          isImage ? "image" :
          isDocument ? "document" : "file"
        );

        // Determine the display image (preview for encrypted, thumbnail, or original for images)
        const displayImage = contentResult.previewCid
          ? `https://ipfs.filebase.io/ipfs/${contentResult.previewCid}`
          : thumbResult?.url
          || (isImage ? contentResult.url : null);

        // Build attributes array for marketplace display
        // Include content architecture attributes
        const attributes: Array<{ trait_type: string; value: string }> = [];

        // Layer 1: Domain (derived)
        if (contentDomain) {
          attributes.push({ trait_type: "Domain", value: contentDomain });
        }

        // Layer 2: Content Type
        if (metadata.contentType) {
          attributes.push({ trait_type: "Type", value: metadata.contentType });
        }

        // Layer 3: Context attributes
        if (metadata.genre) {
          attributes.push({ trait_type: "Genre", value: metadata.genre });
        }
        if (metadata.category) {
          attributes.push({ trait_type: "Category", value: metadata.category });
        }
        if (metadata.artist) {
          attributes.push({ trait_type: "Artist", value: metadata.artist });
        }
        if (metadata.director) {
          attributes.push({ trait_type: "Director", value: metadata.director });
        }
        if (metadata.author) {
          attributes.push({ trait_type: "Author", value: metadata.author });
        }
        if (metadata.album) {
          attributes.push({ trait_type: "Album", value: metadata.album });
        }
        if (metadata.showName) {
          attributes.push({ trait_type: "Show", value: metadata.showName });
        }
        if (metadata.year) {
          attributes.push({ trait_type: "Year", value: metadata.year });
        }

        // Tags
        if (metadata.tags) {
          metadata.tags.forEach(tag => {
            attributes.push({ trait_type: "Tag", value: tag });
          });
        }

        // Build standard Metaplex metadata with full content architecture
        const fullMetadata: Record<string, unknown> = {
          // Standard fields - these are required for marketplace display
          name: metadata.title,
          description: metadata.description || "",
          image: displayImage,
          external_url: `https://handcraft.app`,

          // Animation URL for video/audio content
          ...(isVideo || isAudio ? { animation_url: contentResult.url } : {}),

          // Standard attributes array for marketplace trait display
          attributes,

          // Properties object - standard Metaplex format
          properties: {
            files: [
              {
                uri: contentResult.url,
                type: file.type,
              },
              ...(displayImage ? [{
                uri: displayImage,
                type: "image/jpeg",
              }] : []),
            ],
            category: contentDomain,
          },

          // ========== HANDCRAFT CONTENT ARCHITECTURE ==========
          // Layer 1: Domain (derived from type)
          domain: contentDomain,

          // Layer 2: Content Type (atomic type)
          contentType: metadata.contentType || null,

          // Layer 3: Context (discovery metadata)
          context: {
            genre: metadata.genre || null,
            category: metadata.category || null,
            tags: metadata.tags || [],
            // Type-specific context
            artist: metadata.artist || null,
            album: metadata.album || null,
            director: metadata.director || null,
            cast: metadata.cast || null,
            showName: metadata.showName || null,
            season: metadata.season || null,
            episode: metadata.episode || null,
            author: metadata.author || null,
            narrator: metadata.narrator || null,
            publisher: metadata.publisher || null,
            year: metadata.year || null,
            duration: metadata.duration || null,
          },

          // Layer 4: Bundle reference
          bundle: metadata.bundleId ? {
            id: metadata.bundleId,
            position: metadata.bundlePosition || null,
          } : null,

          // Technical metadata
          contentCid: contentResult.cid,
          thumbnailCid: thumbResult?.cid || null,
          mimeType: file.type,
          size: file.size,
          isEncrypted: !!contentResult.encryptionMeta,
          previewCid: contentResult.previewCid || null,
          encryptionMetaCid,
        };

        const metadataResult = await upload.uploadMetadata(
          fullMetadata,
          `${metadata.title}-metadata`
        );

        if (!metadataResult) {
          finalizeSession("failed");
          return null;
        }
        trackCid(metadataResult.cid, "metadata");

        // All uploads successful - session will be marked complete after on-chain registration
        // Don't mark as complete here - that happens after blockchain tx succeeds

        return {
          content: contentResult,
          thumbnail: thumbResult,
          metadata: metadataResult,
          isEncrypted: !!contentResult.encryptionMeta,
          previewCid: contentResult.previewCid || null,
          encryptionMetaCid,
          session: sessionRef.current!,
        };
      } catch (error) {
        console.error("Upload failed:", error);
        finalizeSession("failed");
        return null;
      }
    },
    [upload, startSession, trackCid, finalizeSession]
  );

  /**
   * Mark the current upload session as successfully completed.
   * Call this after on-chain registration succeeds.
   */
  const markComplete = useCallback(() => {
    finalizeSession("completed");
  }, [finalizeSession]);

  /**
   * Mark the current upload session as cancelled.
   * Call this when user closes modal without completing.
   */
  const markCancelled = useCallback(() => {
    if (sessionRef.current && sessionRef.current.status === "in_progress") {
      finalizeSession("cancelled");
    }
  }, [finalizeSession]);

  /**
   * Get list of orphaned CIDs from a failed/cancelled session.
   * These can be logged for cleanup or ignored (IPFS dedup handles it).
   */
  const getOrphanedCids = useCallback(() => {
    if (session && (session.status === "failed" || session.status === "cancelled")) {
      return session.uploadedCids;
    }
    return [];
  }, [session]);

  /**
   * Reset session state (does not remove from localStorage - session persists for tracking)
   */
  const resetSession = useCallback(() => {
    sessionRef.current = null;
    setSession(null);
    setThumbnailResult(null);
  }, []);

  /**
   * Check if there's a recent incomplete session that could be resumed
   * (e.g., user refreshed page during upload)
   */
  const getIncompleteSession = useCallback((): UploadSession | null => {
    const sessions = getSessions();
    const now = Date.now();
    const recentThreshold = 5 * 60 * 1000; // 5 minutes

    // Find recent in-progress or abandoned sessions
    return sessions.find(s =>
      (s.status === "in_progress" || s.status === "abandoned") &&
      (now - s.startedAt) < recentThreshold &&
      s.metadataCid // Has metadata = upload was complete, just needs on-chain registration
    ) || null;
  }, []);

  return {
    ...upload,
    thumbnailResult,
    uploadContent,
    // Session management
    session,
    markComplete,
    markCancelled,
    getOrphanedCids,
    resetSession,
    getIncompleteSession,
  };
}
