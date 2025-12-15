"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { useSupabaseAuth } from './useSupabaseAuth';

// Files larger than this use multipart upload
const MULTIPART_THRESHOLD = 50 * 1024 * 1024; // 50MB

export interface UploadProgress {
  uploadId: string;
  fileName: string;
  fileSize: number;
  uploadedBytes: number;
  uploadedParts: number;
  totalParts: number;
  progress: number; // 0-100
  status: 'pending' | 'uploading' | 'paused' | 'completing' | 'completed' | 'failed';
  error?: string;
  cid?: string;
  previewCid?: string;
  encryptionMetaCid?: string;
  startedAt: number;
  lastUpdatedAt: number;
  // For multipart resume
  s3Key?: string;
  chunkSize?: number;
}

interface StoredUpload {
  uploadId: string;
  s3Key: string;
  fileName: string;
  fileSize: number;
  chunkSize: number;
  totalParts: number;
  encrypt: boolean;
}

// Store upload IDs in localStorage for resume capability
const UPLOAD_STORAGE_KEY = 'handcraft_multipart_uploads';

function getStoredUploads(): StoredUpload[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(UPLOAD_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function storeUpload(upload: StoredUpload) {
  if (typeof window === 'undefined') return;
  try {
    const uploads = getStoredUploads();
    const existing = uploads.findIndex(u => u.uploadId === upload.uploadId);
    if (existing >= 0) {
      uploads[existing] = upload;
    } else {
      uploads.push(upload);
    }
    localStorage.setItem(UPLOAD_STORAGE_KEY, JSON.stringify(uploads));
  } catch (e) {
    console.error('Failed to store upload:', e);
  }
}

function removeStoredUpload(uploadId: string) {
  if (typeof window === 'undefined') return;
  try {
    const uploads = getStoredUploads().filter(u => u.uploadId !== uploadId);
    localStorage.setItem(UPLOAD_STORAGE_KEY, JSON.stringify(uploads));
  } catch (e) {
    console.error('Failed to remove upload:', e);
  }
}

export function useFileUpload() {
  const { session } = useSupabaseAuth();
  const sessionToken = session?.access_token;
  const [uploads, setUploads] = useState<Map<string, UploadProgress>>(new Map());
  const [currentUploadId, setCurrentUploadId] = useState<string | null>(null);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const isPausedRef = useRef<Set<string>>(new Set());

  // Load any pending uploads from storage on mount
  useEffect(() => {
    const loadPendingUploads = async () => {
      if (!sessionToken) return;

      const storedUploads = getStoredUploads();
      const pendingUploads = new Map<string, UploadProgress>();

      for (const stored of storedUploads) {
        try {
          // Check status from server
          const response = await fetch(`/api/upload/multipart?uploadId=${stored.uploadId}`, {
            headers: { 'Authorization': `Bearer ${sessionToken}` },
          });

          if (response.ok) {
            const data = await response.json();
            if (data.status === 'active') {
              const uploadedBytes = data.uploadedParts.reduce(
                (sum: number, p: { size: number }) => sum + p.size,
                0
              );
              pendingUploads.set(stored.uploadId, {
                uploadId: stored.uploadId,
                fileName: stored.fileName,
                fileSize: stored.fileSize,
                uploadedBytes,
                uploadedParts: data.uploadedParts.length,
                totalParts: stored.totalParts,
                progress: Math.round((uploadedBytes / stored.fileSize) * 100),
                status: 'paused',
                startedAt: Date.now(),
                lastUpdatedAt: Date.now(),
                s3Key: stored.s3Key,
                chunkSize: stored.chunkSize,
              });
            } else {
              // Upload completed or expired, remove from storage
              removeStoredUpload(stored.uploadId);
            }
          } else {
            // Upload not found, remove from storage
            removeStoredUpload(stored.uploadId);
          }
        } catch {
          // Ignore errors loading pending uploads
        }
      }

      if (pendingUploads.size > 0) {
        setUploads(pendingUploads);
      }
    };

    loadPendingUploads();
  }, [sessionToken]);

  // Simple upload for smaller files
  const uploadSimple = useCallback(async (
    file: File,
    options: {
      encrypt?: boolean;
      generatePreview?: boolean;
      onProgress?: (progress: UploadProgress) => void;
      onComplete?: (result: { cid: string; previewCid?: string; encryptionMetaCid?: string }) => void;
      onError?: (error: string) => void;
    } = {}
  ): Promise<string> => {
    const { encrypt = false, generatePreview = true, onProgress, onComplete, onError } = options;

    const uploadId = `simple_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const abortController = new AbortController();
    abortControllersRef.current.set(uploadId, abortController);

    const progress: UploadProgress = {
      uploadId,
      fileName: file.name,
      fileSize: file.size,
      uploadedBytes: 0,
      uploadedParts: 0,
      totalParts: 1,
      progress: 0,
      status: 'uploading',
      startedAt: Date.now(),
      lastUpdatedAt: Date.now(),
    };

    setUploads(prev => new Map(prev).set(uploadId, progress));
    setCurrentUploadId(uploadId);
    onProgress?.(progress);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('encrypt', encrypt.toString());
      formData.append('generatePreview', generatePreview.toString());

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sessionToken}` },
        body: formData,
        signal: abortController.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(error.error || 'Upload failed');
      }

      const result = await response.json();

      const completedProgress: UploadProgress = {
        ...progress,
        status: 'completed',
        progress: 100,
        uploadedBytes: file.size,
        uploadedParts: 1,
        cid: result.cid,
        previewCid: result.previewCid,
        encryptionMetaCid: result.encryptionMetaCid,
        lastUpdatedAt: Date.now(),
      };

      setUploads(prev => new Map(prev).set(uploadId, completedProgress));
      abortControllersRef.current.delete(uploadId);

      onProgress?.(completedProgress);
      onComplete?.({ cid: result.cid, previewCid: result.previewCid, encryptionMetaCid: result.encryptionMetaCid });

      return uploadId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';

      const failedProgress: UploadProgress = {
        ...progress,
        status: 'failed',
        error: errorMessage,
        lastUpdatedAt: Date.now(),
      };

      setUploads(prev => new Map(prev).set(uploadId, failedProgress));
      abortControllersRef.current.delete(uploadId);

      onProgress?.(failedProgress);
      onError?.(errorMessage);

      return uploadId;
    }
  }, [sessionToken]);

  // Multipart upload for large files
  const uploadMultipart = useCallback(async (
    file: File,
    options: {
      encrypt?: boolean;
      onProgress?: (progress: UploadProgress) => void;
      onComplete?: (result: { cid: string; previewCid?: string; encryptionMetaCid?: string }) => void;
      onError?: (error: string) => void;
    } = {}
  ): Promise<string> => {
    const { encrypt = false, onProgress, onComplete, onError } = options;

    try {
      // Initialize multipart upload
      const initResponse = await fetch('/api/upload/multipart', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          contentType: file.type,
          encrypt,
        }),
      });

      if (!initResponse.ok) {
        const error = await initResponse.json().catch(() => ({ error: 'Failed to initialize upload' }));
        throw new Error(error.error || 'Failed to initialize upload');
      }

      const { uploadId, key, chunkSize, totalParts } = await initResponse.json();

      // Store for resume
      storeUpload({
        uploadId,
        s3Key: key,
        fileName: file.name,
        fileSize: file.size,
        chunkSize,
        totalParts,
        encrypt,
      });

      const abortController = new AbortController();
      abortControllersRef.current.set(uploadId, abortController);

      const progress: UploadProgress = {
        uploadId,
        fileName: file.name,
        fileSize: file.size,
        uploadedBytes: 0,
        uploadedParts: 0,
        totalParts,
        progress: 0,
        status: 'uploading',
        startedAt: Date.now(),
        lastUpdatedAt: Date.now(),
        s3Key: key,
        chunkSize,
      };

      setUploads(prev => new Map(prev).set(uploadId, progress));
      setCurrentUploadId(uploadId);
      onProgress?.(progress);

      // Upload parts
      const fileBuffer = await file.arrayBuffer();

      for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
        // Check for pause/abort
        if (isPausedRef.current.has(uploadId)) {
          const pausedProgress: UploadProgress = {
            ...progress,
            status: 'paused',
            lastUpdatedAt: Date.now(),
          };
          setUploads(prev => new Map(prev).set(uploadId, pausedProgress));
          onProgress?.(pausedProgress);
          return uploadId;
        }

        if (abortController.signal.aborted) {
          throw new Error('Upload cancelled');
        }

        const start = (partNumber - 1) * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const partData = fileBuffer.slice(start, end);

        const formData = new FormData();
        formData.append('part', new Blob([partData]));
        formData.append('uploadId', uploadId);
        formData.append('partNumber', partNumber.toString());

        const partResponse = await fetch('/api/upload/multipart/part', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${sessionToken}` },
          body: formData,
          signal: abortController.signal,
        });

        if (!partResponse.ok) {
          const error = await partResponse.json().catch(() => ({ error: 'Failed to upload part' }));
          throw new Error(error.error || `Failed to upload part ${partNumber}`);
        }

        const uploadedBytes = end;
        const uploadProgress = Math.round((uploadedBytes / file.size) * 100);

        const updatedProgress: UploadProgress = {
          ...progress,
          uploadedBytes,
          uploadedParts: partNumber,
          progress: uploadProgress,
          lastUpdatedAt: Date.now(),
        };

        progress.uploadedBytes = uploadedBytes;
        progress.uploadedParts = partNumber;
        progress.progress = uploadProgress;

        setUploads(prev => new Map(prev).set(uploadId, updatedProgress));
        onProgress?.(updatedProgress);
      }

      // Complete the upload
      const completingProgress: UploadProgress = {
        ...progress,
        status: 'completing',
        progress: 100,
        lastUpdatedAt: Date.now(),
      };
      setUploads(prev => new Map(prev).set(uploadId, completingProgress));
      onProgress?.(completingProgress);

      const completeResponse = await fetch('/api/upload/multipart/complete', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uploadId }),
      });

      if (!completeResponse.ok) {
        const error = await completeResponse.json().catch(() => ({ error: 'Failed to complete upload' }));
        throw new Error(error.error || 'Failed to complete upload');
      }

      const result = await completeResponse.json();

      // Clean up
      removeStoredUpload(uploadId);
      abortControllersRef.current.delete(uploadId);

      const completedProgress: UploadProgress = {
        ...progress,
        status: 'completed',
        progress: 100,
        uploadedBytes: file.size,
        cid: result.cid,
        lastUpdatedAt: Date.now(),
      };

      setUploads(prev => new Map(prev).set(uploadId, completedProgress));
      onProgress?.(completedProgress);
      onComplete?.({ cid: result.cid });

      return uploadId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';

      if (errorMessage !== 'Upload cancelled') {
        onError?.(errorMessage);
      }

      return '';
    }
  }, [sessionToken]);

  // Main upload function - chooses multipart or simple based on file size
  const upload = useCallback(async (
    file: File,
    options: {
      encrypt?: boolean;
      generatePreview?: boolean;
      onProgress?: (progress: UploadProgress) => void;
      onComplete?: (result: { cid: string; previewCid?: string; encryptionMetaCid?: string }) => void;
      onError?: (error: string) => void;
    } = {}
  ): Promise<string> => {
    if (file.size > MULTIPART_THRESHOLD) {
      return uploadMultipart(file, options);
    }
    return uploadSimple(file, options);
  }, [uploadMultipart, uploadSimple]);

  // Pause upload
  const pauseUpload = useCallback((uploadId: string) => {
    isPausedRef.current.add(uploadId);

    // Abort any in-flight request
    const controller = abortControllersRef.current.get(uploadId);
    if (controller) {
      controller.abort();
    }

    setUploads(prev => {
      const updated = new Map(prev);
      const upload = updated.get(uploadId);
      if (upload && upload.status === 'uploading') {
        updated.set(uploadId, { ...upload, status: 'paused' });
      }
      return updated;
    });
  }, []);

  // Resume upload
  const resumeUpload = useCallback(async (
    uploadId: string,
    file: File,
    options: {
      onProgress?: (progress: UploadProgress) => void;
      onComplete?: (result: { cid: string; previewCid?: string; encryptionMetaCid?: string }) => void;
      onError?: (error: string) => void;
    } = {}
  ) => {
    const { onProgress, onComplete, onError } = options;

    isPausedRef.current.delete(uploadId);

    // Get current status from server
    const statusResponse = await fetch(`/api/upload/multipart?uploadId=${uploadId}`, {
      headers: { 'Authorization': `Bearer ${sessionToken}` },
    });

    if (!statusResponse.ok) {
      onError?.('Upload not found or expired');
      removeStoredUpload(uploadId);
      return;
    }

    const status = await statusResponse.json();
    const uploadedPartNumbers = new Set(status.uploadedParts.map((p: { part_number: number }) => p.part_number));

    const abortController = new AbortController();
    abortControllersRef.current.set(uploadId, abortController);

    const progress: UploadProgress = {
      uploadId,
      fileName: status.fileName,
      fileSize: status.fileSize,
      uploadedBytes: status.uploadedParts.reduce((sum: number, p: { size: number }) => sum + p.size, 0),
      uploadedParts: status.uploadedParts.length,
      totalParts: status.totalParts,
      progress: Math.round((status.uploadedParts.length / status.totalParts) * 100),
      status: 'uploading',
      startedAt: Date.now(),
      lastUpdatedAt: Date.now(),
      s3Key: status.key,
      chunkSize: status.chunkSize,
    };

    setUploads(prev => new Map(prev).set(uploadId, progress));
    onProgress?.(progress);

    try {
      const fileBuffer = await file.arrayBuffer();

      // Upload remaining parts
      for (let partNumber = 1; partNumber <= status.totalParts; partNumber++) {
        // Skip already uploaded parts
        if (uploadedPartNumbers.has(partNumber)) {
          continue;
        }

        // Check for pause/abort
        if (isPausedRef.current.has(uploadId)) {
          const pausedProgress: UploadProgress = {
            ...progress,
            status: 'paused',
            lastUpdatedAt: Date.now(),
          };
          setUploads(prev => new Map(prev).set(uploadId, pausedProgress));
          onProgress?.(pausedProgress);
          return;
        }

        if (abortController.signal.aborted) {
          throw new Error('Upload cancelled');
        }

        const start = (partNumber - 1) * status.chunkSize;
        const end = Math.min(start + status.chunkSize, file.size);
        const partData = fileBuffer.slice(start, end);

        const formData = new FormData();
        formData.append('part', new Blob([partData]));
        formData.append('uploadId', uploadId);
        formData.append('partNumber', partNumber.toString());

        const partResponse = await fetch('/api/upload/multipart/part', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${sessionToken}` },
          body: formData,
          signal: abortController.signal,
        });

        if (!partResponse.ok) {
          const error = await partResponse.json().catch(() => ({ error: 'Failed to upload part' }));
          throw new Error(error.error || `Failed to upload part ${partNumber}`);
        }

        uploadedPartNumbers.add(partNumber);
        const uploadedBytes = uploadedPartNumbers.size * status.chunkSize;
        const uploadProgress = Math.round((uploadedPartNumbers.size / status.totalParts) * 100);

        const updatedProgress: UploadProgress = {
          ...progress,
          uploadedBytes: Math.min(uploadedBytes, file.size),
          uploadedParts: uploadedPartNumbers.size,
          progress: uploadProgress,
          lastUpdatedAt: Date.now(),
        };

        setUploads(prev => new Map(prev).set(uploadId, updatedProgress));
        onProgress?.(updatedProgress);
      }

      // Complete the upload
      const completingProgress: UploadProgress = {
        ...progress,
        status: 'completing',
        progress: 100,
        uploadedParts: status.totalParts,
        lastUpdatedAt: Date.now(),
      };
      setUploads(prev => new Map(prev).set(uploadId, completingProgress));
      onProgress?.(completingProgress);

      const completeResponse = await fetch('/api/upload/multipart/complete', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uploadId }),
      });

      if (!completeResponse.ok) {
        const error = await completeResponse.json().catch(() => ({ error: 'Failed to complete upload' }));
        throw new Error(error.error || 'Failed to complete upload');
      }

      const result = await completeResponse.json();

      // Clean up
      removeStoredUpload(uploadId);
      abortControllersRef.current.delete(uploadId);

      const completedProgress: UploadProgress = {
        ...progress,
        status: 'completed',
        progress: 100,
        uploadedBytes: file.size,
        uploadedParts: status.totalParts,
        cid: result.cid,
        lastUpdatedAt: Date.now(),
      };

      setUploads(prev => new Map(prev).set(uploadId, completedProgress));
      onProgress?.(completedProgress);
      onComplete?.({ cid: result.cid });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';

      if (errorMessage !== 'Upload cancelled') {
        const failedProgress: UploadProgress = {
          ...progress,
          status: 'failed',
          error: errorMessage,
          lastUpdatedAt: Date.now(),
        };
        setUploads(prev => new Map(prev).set(uploadId, failedProgress));
        onError?.(errorMessage);
      }
    }
  }, [sessionToken]);

  // Cancel upload
  const cancelUpload = useCallback(async (uploadId: string) => {
    isPausedRef.current.delete(uploadId);

    const controller = abortControllersRef.current.get(uploadId);
    if (controller) {
      controller.abort();
    }

    // Abort on server if multipart
    if (!uploadId.startsWith('simple_')) {
      try {
        await fetch('/api/upload/multipart/abort', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uploadId }),
        });
      } catch {
        // Ignore abort errors
      }
    }

    setUploads(prev => {
      const updated = new Map(prev);
      updated.delete(uploadId);
      return updated;
    });

    removeStoredUpload(uploadId);
    abortControllersRef.current.delete(uploadId);
  }, [sessionToken]);

  // Get current upload progress
  const getUploadProgress = useCallback((uploadId: string): UploadProgress | undefined => {
    return uploads.get(uploadId);
  }, [uploads]);

  // Get all uploads
  const getAllUploads = useCallback((): UploadProgress[] => {
    return Array.from(uploads.values());
  }, [uploads]);

  return {
    upload,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    getUploadProgress,
    getAllUploads,
    currentUploadId,
    uploads: Array.from(uploads.values()),
    hasActiveUpload: Array.from(uploads.values()).some(u => u.status === 'uploading'),
    hasPausedUpload: Array.from(uploads.values()).some(u => u.status === 'paused'),
  };
}
