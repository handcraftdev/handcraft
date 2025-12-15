"use client";

import { ContentDraft } from '@/lib/supabase';
import { UploadStep, isStepComplete, canNavigateToStep } from './UploadStudio';
import { UploadProgress } from '@/hooks/useFileUpload';

interface UploadSidebarProps {
  currentStep: UploadStep;
  draft: ContentDraft | null;
  onStepClick: (step: UploadStep) => void;
  isLoading: boolean;
  autoSaveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  uploadProgress?: UploadProgress | null;
  onPauseUpload?: () => void;
  onResumeUpload?: () => void;
  onCancelUpload?: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
  isEditMode?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  }
  return `${(bytes / 1024).toFixed(0)} KB`;
}

const STEPS: Array<{ key: UploadStep; label: string; icon: string }> = [
  { key: 'type', label: 'Content Type', icon: '📋' },
  { key: 'file', label: 'Upload File', icon: '📤' },
  { key: 'details', label: 'Details', icon: '✏️' },
  { key: 'monetization', label: 'Monetization', icon: '💰' },
  { key: 'review', label: 'Review', icon: '👁️' },
  { key: 'publish', label: 'Publish', icon: '🚀' },
];

export function UploadSidebar({
  currentStep,
  draft,
  onStepClick,
  isLoading,
  autoSaveStatus = 'idle',
  uploadProgress,
  onPauseUpload,
  onResumeUpload,
  onCancelUpload,
  onDelete,
  isDeleting = false,
  isEditMode = false,
}: UploadSidebarProps) {
  // In edit mode, skip type and file steps (content already uploaded)
  const displaySteps = isEditMode
    ? STEPS.filter(s => s.key !== 'type' && s.key !== 'file')
    : STEPS;
  const currentIndex = displaySteps.findIndex(s => s.key === currentStep);
  const isUploading = uploadProgress?.status === 'uploading';
  const isPaused = uploadProgress?.status === 'paused';

  return (
    <aside className="w-80 border-r border-white/5 bg-black/50 backdrop-blur-sm flex flex-col">
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-medium text-white/90">
              {isEditMode ? 'Edit Content' : 'Upload Content'}
            </h1>
            <p className="text-sm text-white/40 mt-1">
              {isEditMode ? 'Update metadata' : draft?.status === 'published' ? 'Published' : draft?.id ? 'Editing draft' : 'New upload'}
            </p>
          </div>
          {/* Auto-save status indicator */}
          {autoSaveStatus !== 'idle' && (
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs ${
              autoSaveStatus === 'saving' ? 'text-white/40' :
              autoSaveStatus === 'saved' ? 'text-emerald-400/80' :
              'text-red-400/80'
            }`}>
              {autoSaveStatus === 'saving' && (
                <>
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving...
                </>
              )}
              {autoSaveStatus === 'saved' && (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Saved
                </>
              )}
              {autoSaveStatus === 'error' && (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Error
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Upload Progress Indicator */}
      {uploadProgress && (isUploading || isPaused) && (
        <div className="mx-4 mt-4 p-3 rounded-xl bg-white/[0.02] border border-white/10">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isPaused ? 'bg-yellow-500/20' : 'bg-purple-500/20'
            }`}>
              {isPaused ? (
                <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-purple-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white/90 truncate">
                {uploadProgress.fileName}
              </p>
              <p className="text-[10px] text-white/40">
                {formatFileSize(uploadProgress.uploadedBytes)} / {formatFileSize(uploadProgress.fileSize)}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {isUploading && onPauseUpload && (
                <button
                  onClick={onPauseUpload}
                  className="p-1.5 hover:bg-white/5 rounded-lg transition-colors"
                  title="Pause upload"
                >
                  <svg className="w-3 h-3 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
                  </svg>
                </button>
              )}
              {isPaused && onResumeUpload && (
                <button
                  onClick={onResumeUpload}
                  className="p-1.5 hover:bg-white/5 rounded-lg transition-colors"
                  title="Resume upload"
                >
                  <svg className="w-3 h-3 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  </svg>
                </button>
              )}
              {onCancelUpload && (
                <button
                  onClick={onCancelUpload}
                  className="p-1.5 hover:bg-white/5 rounded-lg transition-colors"
                  title="Cancel upload"
                >
                  <svg className="w-3 h-3 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                isPaused ? 'bg-yellow-500' : 'bg-purple-500'
              }`}
              style={{ width: `${uploadProgress.progress}%` }}
            />
          </div>
          <p className="text-[10px] text-white/30 mt-1 text-right">{uploadProgress.progress}%</p>
        </div>
      )}

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {displaySteps.map((s, index) => {
            const isActive = currentStep === s.key;
            const stepComplete = isStepComplete(s.key, draft);
            const canNavigate = canNavigateToStep(s.key, draft);

            return (
              <li key={s.key}>
                <button
                  onClick={() => canNavigate && onStepClick(s.key)}
                  disabled={!canNavigate}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isActive
                      ? 'bg-purple-500/20 border border-purple-500/50 text-purple-300'
                      : stepComplete
                      ? 'bg-white/[0.02] border border-white/5 text-white/70 hover:bg-white/5'
                      : canNavigate
                      ? 'bg-white/[0.02] border border-white/5 text-white/40 hover:bg-white/5'
                      : 'bg-white/[0.01] border border-white/5 text-white/20 cursor-not-allowed'
                  }`}
                >
                  <span className="text-2xl">{s.icon}</span>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium">{s.label}</div>
                    {stepComplete && (
                      <div className="text-xs opacity-50">Completed</div>
                    )}
                    {!canNavigate && !isActive && !stepComplete && (
                      <div className="text-xs opacity-40">Complete previous steps</div>
                    )}
                  </div>
                  {stepComplete && (
                    <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-white/5 space-y-3">
        <p className="text-xs text-white/30 text-center">
          Changes are auto-saved
        </p>
        {draft?.id && onDelete && (
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/5 hover:bg-red-500/20 disabled:opacity-50 rounded-xl text-sm font-medium transition-all border border-white/10 hover:border-red-500/30 text-white/60 hover:text-red-400"
          >
            {isDeleting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Deleting...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete Draft
              </>
            )}
          </button>
        )}
      </div>
    </aside>
  );
}
