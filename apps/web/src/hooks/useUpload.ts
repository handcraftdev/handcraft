"use client";

import { useState, useCallback } from "react";

export interface UploadResult {
  cid: string;
  size: number;
  name: string;
  url: string;
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

export function useUpload(options: UseUploadOptions = {}) {
  const [state, setState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    error: null,
    result: null,
  });

  const uploadFile = useCallback(
    async (file: File, name?: string): Promise<UploadResult | null> => {
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

        options.onSuccess?.(result);
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

        options.onError?.(errorMessage);
        return null;
      }
    },
    [options]
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
        options.onError?.(errorMessage);
        return null;
      }
    },
    [options]
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
 * Hook for uploading content with metadata
 */
export function useContentUpload(options: UseUploadOptions = {}) {
  const upload = useUpload(options);
  const [thumbnailResult, setThumbnailResult] = useState<UploadResult | null>(
    null
  );

  const uploadContent = useCallback(
    async (
      file: File,
      metadata: {
        title: string;
        description?: string;
        tags?: string[];
      },
      thumbnail?: Blob
    ) => {
      // 1. Upload main content
      const contentResult = await upload.uploadFile(file, metadata.title);
      if (!contentResult) return null;

      // 2. Upload thumbnail if provided
      let thumbResult: UploadResult | null = null;
      if (thumbnail) {
        const thumbFile = new File(
          [thumbnail],
          `${metadata.title}-thumbnail.jpg`,
          { type: "image/jpeg" }
        );
        thumbResult = await upload.uploadFile(
          thumbFile,
          `${metadata.title}-thumbnail`
        );
        setThumbnailResult(thumbResult);
      }

      // 3. Upload metadata
      const fullMetadata = {
        name: metadata.title,
        description: metadata.description || "",
        tags: metadata.tags || [],
        contentCid: contentResult.cid,
        contentUrl: contentResult.url,
        thumbnailCid: thumbResult?.cid || null,
        thumbnailUrl: thumbResult?.url || null,
        mimeType: file.type,
        size: file.size,
        createdAt: new Date().toISOString(),
      };

      const metadataResult = await upload.uploadMetadata(
        fullMetadata,
        `${metadata.title}-metadata`
      );

      return {
        content: contentResult,
        thumbnail: thumbResult,
        metadata: metadataResult,
      };
    },
    [upload]
  );

  return {
    ...upload,
    thumbnailResult,
    uploadContent,
  };
}
