"use client";

import { useState, useRef, useCallback } from 'react';
import { ContentDraft } from '@/lib/supabase';
import { useFileUpload, UploadProgress } from '@/hooks/useFileUpload';
import { extractCover, coverToFile } from '@/hooks/useCoverExtraction';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { ThumbnailUpload } from '../ThumbnailUpload';

interface FileUploadStepProps {
  draft: ContentDraft | null;
  onUpdate: (updates: Partial<ContentDraft>) => void;
  onNext: () => void;
  onUploadStateChange?: (progress: UploadProgress | null, file: File | null) => void;
}

const FILE_SIZE_LIMITS: Record<string, number> = {
  video: 2 * 1024 * 1024 * 1024, // 2 GB
  audio: 500 * 1024 * 1024, // 500 MB
  image: 50 * 1024 * 1024, // 50 MB
  document: 100 * 1024 * 1024, // 100 MB
  file: 1024 * 1024 * 1024, // 1 GB
  text: 10 * 1024 * 1024, // 10 MB
};

const ACCEPTED_TYPES: Record<string, string> = {
  video: 'video/*',
  audio: 'audio/*',
  image: 'image/*',
  document: '.pdf,.epub,.doc,.docx,.txt',
  file: '*',
  text: '.txt,.md,.html',
};

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  }
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

export function FileUploadStep({ draft, onUpdate, onNext, onUploadStateChange }: FileUploadStepProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [coverExtractionStatus, setCoverExtractionStatus] = useState<'idle' | 'extracting' | 'uploading' | 'done' | 'failed'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { upload, pauseUpload, resumeUpload, cancelUpload, uploads } = useFileUpload();
  const { session } = useSupabaseAuth();

  // Helper to update progress and notify parent
  const updateProgress = useCallback((progress: UploadProgress | null, file: File | null = selectedFile) => {
    setUploadProgress(progress);
    onUploadStateChange?.(progress, file);
  }, [onUploadStateChange, selectedFile]);

  // Check if there's an existing paused upload
  const pausedUpload = uploads.find(u => u.status === 'paused');

  // Extract and upload cover for books/comics
  const extractAndUploadCover = useCallback(async (file: File) => {
    if (!session?.access_token) return;

    // Only extract covers for document types (books, comics)
    if (draft?.domain !== 'document') return;

    // Skip if already has a thumbnail
    if (draft?.thumbnail_cid) return;

    setCoverExtractionStatus('extracting');

    try {
      const cover = await extractCover(file);

      if (!cover) {
        setCoverExtractionStatus('failed');
        return;
      }

      setCoverExtractionStatus('uploading');

      // Convert to file and upload
      const coverFile = coverToFile(cover, file.name);
      const formData = new FormData();
      formData.append('file', coverFile);
      formData.append('encrypt', 'false'); // Thumbnails are not encrypted

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Cover upload failed');
      }

      const data = await response.json();
      onUpdate({ thumbnail_cid: data.cid });
      setCoverExtractionStatus('done');
    } catch (err) {
      console.error('[FileUpload] Cover extraction/upload error:', err);
      setCoverExtractionStatus('failed');
    }
  }, [session?.access_token, draft?.domain, draft?.thumbnail_cid, onUpdate]);

  const handleFileSelect = useCallback(async (file: File) => {
    if (!draft?.domain) return;

    const maxSize = FILE_SIZE_LIMITS[draft.domain];
    if (file.size > maxSize) {
      setError(`File too large. Maximum size is ${formatFileSize(maxSize)}`);
      return;
    }

    setError(null);
    setSelectedFile(file);
    onUploadStateChange?.(null, file); // Notify parent of file selection

    // Auto-fill title from filename if not set
    if (!draft.title) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      onUpdate({ title: nameWithoutExt });
    }

    // Extract cover for books/comics (runs in parallel with upload)
    extractAndUploadCover(file);

    // Start background upload
    // Always encrypt content - visibility level controls who can decrypt, not whether to encrypt
    // This ensures content is protected even if visibility is changed later
    await upload(file, {
      encrypt: true,
      generatePreview: true,
      onProgress: (progress) => {
        updateProgress(progress, file);
      },
      onComplete: (result) => {
        onUpdate({
          content_cid: result.cid,
          preview_cid: result.previewCid || null,
          encryption_meta_cid: result.encryptionMetaCid || null,
          // Store file info in type_metadata for viewer to use
          type_metadata: {
            ...draft?.type_metadata,
            mimeType: file.type,
            fileName: file.name,
          },
        });
        // Auto-proceed to next step after successful upload
        setTimeout(() => onNext(), 500);
      },
      onError: (err) => {
        setError(err);
      },
    });
  }, [draft, upload, onUpdate, onNext, onUploadStateChange, updateProgress, extractAndUploadCover]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handlePause = () => {
    if (uploadProgress?.uploadId) {
      pauseUpload(uploadProgress.uploadId);
    }
  };

  const handleResume = async () => {
    if (pausedUpload && selectedFile) {
      await resumeUpload(pausedUpload.uploadId, selectedFile, {
        onProgress: (progress) => {
          updateProgress(progress);
        },
        onComplete: (result) => {
          onUpdate({
            content_cid: result.cid,
            preview_cid: result.previewCid || null,
            encryption_meta_cid: result.encryptionMetaCid || null,
            // Store file info in type_metadata for viewer to use
            type_metadata: {
              ...draft?.type_metadata,
              mimeType: selectedFile?.type,
              fileName: selectedFile?.name,
            },
          });
          setTimeout(() => onNext(), 500);
        },
        onError: (err) => {
          setError(err);
        },
      });
    }
  };

  const handleCancel = () => {
    if (uploadProgress?.uploadId) {
      cancelUpload(uploadProgress.uploadId);
      updateProgress(null, null);
      setSelectedFile(null);
    }
  };

  const handleSkip = () => {
    // Allow skipping for now (file upload optional during dev)
    onNext();
  };

  // Calculate ETA
  const calculateETA = (): string | null => {
    if (!uploadProgress || uploadProgress.progress === 0) return null;
    const elapsed = Date.now() - uploadProgress.startedAt;
    const rate = uploadProgress.uploadedBytes / elapsed;
    const remaining = uploadProgress.fileSize - uploadProgress.uploadedBytes;
    const eta = remaining / rate;
    return formatTime(eta);
  };

  const isUploading = uploadProgress?.status === 'uploading';
  const isCompleted = uploadProgress?.status === 'completed' || draft?.content_cid;
  const isPaused = uploadProgress?.status === 'paused' || pausedUpload;

  // Photos and Artwork use the content itself as the image, so thumbnail is optional
  const isImageContent = draft?.content_type === 8 || draft?.content_type === 9;
  const requiresThumbnail = !isImageContent;
  const hasThumbnail = !!draft?.thumbnail_cid;
  const canProceed = isCompleted && (!requiresThumbnail || hasThumbnail);

  const handleThumbnailUpload = (cid: string) => {
    onUpdate({ thumbnail_cid: cid || null });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-medium text-white/90 mb-2">Upload your content</h2>
      <p className="text-white/40 mb-8">
        {isUploading
          ? 'Uploading in background - you can continue to the next step'
          : 'Drop your file here or click to browse'}
      </p>

      {/* Upload Progress */}
      {(isUploading || isPaused) && uploadProgress && (
        <div className="mb-6 p-4 rounded-xl bg-white/[0.02] border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                isPaused ? 'bg-yellow-500/20' : 'bg-purple-500/20'
              }`}>
                {isPaused ? (
                  <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-purple-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-white/90 truncate max-w-[200px]">
                  {uploadProgress.fileName}
                </p>
                <p className="text-xs text-white/40">
                  {formatFileSize(uploadProgress.uploadedBytes)} / {formatFileSize(uploadProgress.fileSize)}
                  {!isPaused && calculateETA() && ` • ${calculateETA()} remaining`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isUploading && (
                <button
                  onClick={handlePause}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                  title="Pause upload"
                >
                  <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
                  </svg>
                </button>
              )}
              {isPaused && (
                <button
                  onClick={handleResume}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                  title="Resume upload"
                >
                  <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  </svg>
                </button>
              )}
              <button
                onClick={handleCancel}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                title="Cancel upload"
              >
                <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                isPaused ? 'bg-yellow-500' : 'bg-purple-500'
              }`}
              style={{ width: `${uploadProgress.progress}%` }}
            />
          </div>
          <p className="text-xs text-white/30 mt-2 text-right">{uploadProgress.progress}%</p>

          {/* Cover extraction status for books/comics */}
          {draft?.domain === 'document' && coverExtractionStatus !== 'idle' && (
            <div className="mt-3 pt-3 border-t border-white/5">
              <div className="flex items-center gap-2 text-xs">
                {coverExtractionStatus === 'extracting' && (
                  <>
                    <svg className="w-3 h-3 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-white/40">Extracting cover...</span>
                  </>
                )}
                {coverExtractionStatus === 'uploading' && (
                  <>
                    <svg className="w-3 h-3 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-white/40">Uploading cover...</span>
                  </>
                )}
                {coverExtractionStatus === 'done' && (
                  <>
                    <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-emerald-400/70">Cover extracted</span>
                  </>
                )}
                {coverExtractionStatus === 'failed' && (
                  <>
                    <svg className="w-3 h-3 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-yellow-400/70">Could not extract cover</span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Completed State */}
      {isCompleted && !isUploading && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-400">Upload complete!</p>
              <p className="text-xs text-white/40">
                {selectedFile?.name || 'File uploaded'} • {draft?.content_cid?.slice(0, 20)}...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Drop Zone */}
      {!isUploading && !isCompleted && (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-300 ${
            isDragging
              ? 'border-purple-500/50 bg-purple-500/5'
              : error
              ? 'border-red-500/50 bg-red-500/5'
              : 'border-white/10 hover:border-purple-500/30 bg-white/[0.02] hover:bg-white/5'
          }`}
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
            <svg className="w-8 h-8 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="text-lg font-medium text-white/90 mb-2">
            {isDragging ? 'Drop your file' : 'Drop your file here'}
          </p>
          <p className="text-sm text-white/40">or click to browse</p>
          <p className="text-xs text-white/30 mt-2">
            Max size: {draft?.domain ? formatFileSize(FILE_SIZE_LIMITS[draft.domain]) : ''}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleInputChange}
            accept={draft?.domain ? ACCEPTED_TYPES[draft.domain] : '*'}
            className="hidden"
          />
        </div>
      )}

      {/* Thumbnail Upload - shown after file is uploaded or uploading */}
      {(isCompleted || isUploading) && (
        <div className="mt-6">
          {requiresThumbnail ? (
            <ThumbnailUpload
              thumbnailCid={draft?.thumbnail_cid || null}
              onUpload={handleThumbnailUpload}
              label="Cover Image"
            />
          ) : (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-white/70">Cover Image (Optional)</label>
              <p className="text-xs text-white/40 mb-2">Your image will be used as the cover. Upload a custom thumbnail if you prefer.</p>
              <ThumbnailUpload
                thumbnailCid={draft?.thumbnail_cid || null}
                onUpload={handleThumbnailUpload}
                label=""
              />
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="mt-6 flex gap-3">
        {isUploading && !canProceed && (
          <button
            disabled
            className="flex-1 py-3 bg-white/5 rounded-xl font-medium transition-all duration-300 border border-white/10 text-white/30 cursor-not-allowed"
          >
            {requiresThumbnail && !hasThumbnail ? 'Upload cover image to continue' : 'Uploading...'}
          </button>
        )}
        {canProceed && (
          <button
            onClick={onNext}
            className="flex-1 py-3 bg-purple-500/20 hover:bg-purple-500/30 rounded-xl font-medium transition-all duration-300 border border-purple-500/30 hover:border-purple-500/50 text-white/90"
          >
            Continue to Monetization
          </button>
        )}
        {!isUploading && !isCompleted && (
          <button
            onClick={handleSkip}
            className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-medium transition-all duration-300 border border-white/10 hover:border-white/20 text-white/50"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}
