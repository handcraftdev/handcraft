"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ContentDraft } from '@/lib/supabase';

interface PublishStepProps {
  draft: ContentDraft | null;
  onPublish: (scheduleAt?: Date) => Promise<void>;
  isPublishing?: boolean;
  error?: string | null;
  isEditMode?: boolean;
  onSaveEdit?: () => Promise<void>;
}

// Helper to format date for datetime-local input
function formatDateTimeLocal(date: Date): string {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function PublishStep({ draft, onPublish, isPublishing: externalPublishing, error, isEditMode = false, onSaveEdit }: PublishStepProps) {
  const router = useRouter();
  const [localPublishing, setLocalPublishing] = useState(false);
  const [publishMode, setPublishMode] = useState<'now' | 'later' | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState(5);

  // Auto-redirect to studio after successful publish (not in edit mode)
  useEffect(() => {
    // In edit mode, content is already published - don't auto-redirect
    if (isEditMode) return;

    if (draft?.status === 'published') {
      const timer = setInterval(() => {
        setRedirectCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            router.push('/studio');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [draft?.status, router, isEditMode]);
  const [scheduleDateTime, setScheduleDateTime] = useState(() => {
    // Initialize from draft.scheduled_at if available, otherwise use current time
    if (draft?.scheduled_at) {
      return formatDateTimeLocal(new Date(draft.scheduled_at));
    }
    return formatDateTimeLocal(new Date());
  });

  // Update scheduleDateTime when draft.scheduled_at changes
  useEffect(() => {
    if (draft?.scheduled_at) {
      setScheduleDateTime(formatDateTimeLocal(new Date(draft.scheduled_at)));
    }
  }, [draft?.scheduled_at]);

  // Use external publishing state if provided, otherwise use local state
  const isPublishing = externalPublishing ?? localPublishing;

  const handlePublishNow = async () => {
    setLocalPublishing(true);
    try {
      await onPublish();
    } finally {
      setLocalPublishing(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!onSaveEdit) return;
    setLocalPublishing(true);
    try {
      await onSaveEdit();
    } finally {
      setLocalPublishing(false);
    }
  };

  const handleSchedule = async () => {
    if (!scheduleDateTime) return;

    const scheduledAt = new Date(scheduleDateTime);
    if (scheduledAt <= new Date()) {
      alert('Please select a future date and time');
      return;
    }

    setLocalPublishing(true);
    try {
      await onPublish(scheduledAt);
    } finally {
      setLocalPublishing(false);
    }
  };

  // Get minimum datetime (now) for datetime picker
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const minDateTime = now.toISOString().slice(0, 16);

  // Edit mode UI - simpler save changes flow
  if (isEditMode) {
    return (
      <div className="max-w-2xl mx-auto">
        <h2 className="text-lg font-medium text-white/90 mb-1">Save Changes</h2>
        <p className="text-sm text-white/40 mb-6">Update your content metadata on IPFS and blockchain</p>

        {/* Error Display */}
        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4 className="text-sm text-red-400 font-medium mb-0.5">Save failed</h4>
                <p className="text-xs text-red-300/70">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-md bg-purple-500/20 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h4 className="text-sm text-white/90 font-medium mb-1">Ready to Save</h4>
              <p className="text-sm text-white/50">
                Your updated metadata will be uploaded to IPFS and the on-chain record will be updated.
                You will be asked to sign a transaction to confirm the changes.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleSaveEdit}
          disabled={isPublishing}
          className="w-full py-2 bg-purple-500/20 hover:bg-purple-500/30 disabled:opacity-30 rounded-lg text-sm font-medium transition-all duration-200 border border-purple-500/30 hover:border-purple-500/50 text-white/90"
        >
          {isPublishing ? 'Saving...' : 'Sign & Save Changes'}
        </button>
      </div>
    );
  }

  if (draft?.status === 'published') {
    return (
      <div className="max-w-2xl mx-auto text-center py-8">
        <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-emerald-500/20 flex items-center justify-center">
          <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-lg font-medium text-white/90 mb-1">Content Published!</h2>
        <p className="text-sm text-white/40 mb-4">Your content is now live on the blockchain</p>
        <button
          onClick={() => router.push('/studio')}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white/90 rounded-lg text-sm transition-colors"
        >
          Go to Studio {redirectCountdown > 0 && `(${redirectCountdown}s)`}
        </button>
        <p className="text-white/30 text-xs mt-2">
          Redirecting automatically in {redirectCountdown} seconds...
        </p>
      </div>
    );
  }

  if (draft?.status === 'scheduled') {
    return (
      <div className="max-w-2xl mx-auto">
        {/* Current Schedule Status */}
        <div className="text-center py-6 mb-6 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-medium text-white/90 mb-1">Publication Scheduled</h2>
          <p className="text-sm text-white/40 mb-1">
            Your content will be published on{' '}
            <span className="text-amber-400 font-medium">
              {draft.scheduled_at ? new Date(draft.scheduled_at).toLocaleString() : 'the scheduled date'}
            </span>
          </p>
        </div>

        {/* Reschedule Options */}
        <h3 className="text-base font-medium text-white/90 mb-3">Change Publication Time</h3>

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1.5 text-white/70">New Date & Time</label>
            <input
              type="datetime-local"
              min={minDateTime}
              value={scheduleDateTime}
              onChange={(e) => setScheduleDateTime(e.target.value)}
              onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-amber-500/50 text-white/90 [color-scheme:dark] cursor-pointer"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handlePublishNow}
            disabled={isPublishing}
            className="flex-1 py-2 bg-purple-500/20 hover:bg-purple-500/30 disabled:opacity-30 rounded-lg text-sm font-medium transition-all duration-200 border border-purple-500/30 hover:border-purple-500/50 text-white/90"
          >
            {isPublishing ? 'Publishing...' : 'Publish Now'}
          </button>
          <button
            onClick={handleSchedule}
            disabled={!scheduleDateTime || isPublishing}
            className="flex-1 py-2 bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-30 rounded-lg text-sm font-medium transition-all duration-200 border border-amber-500/30 hover:border-amber-500/50 text-white/90"
          >
            {isPublishing ? 'Updating...' : 'Update Schedule'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-lg font-medium text-white/90 mb-1">Publish</h2>
      <p className="text-sm text-white/40 mb-6">Choose when to publish your content</p>

      {/* Error Display */}
      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="text-sm text-red-400 font-medium mb-0.5">Publishing failed</h4>
              <p className="text-xs text-red-300/70">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Mode Selection */}
      {publishMode === null && (
        <div className="space-y-3">
          <button
            onClick={() => setPublishMode('now')}
            className="w-full p-4 bg-white/[0.02] border border-white/10 hover:border-purple-500/50 rounded-lg text-left transition-all duration-200 group"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-md bg-purple-500/20 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-medium text-white/90 mb-0.5">Publish Now</h3>
                <p className="text-sm text-white/50">
                  Your content will be immediately published to the blockchain and available for purchase.
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setPublishMode('later')}
            className="w-full p-4 bg-white/[0.02] border border-white/10 hover:border-amber-500/50 rounded-lg text-left transition-all duration-200 group"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-md bg-amber-500/20 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-medium text-white/90 mb-0.5">Schedule for Later</h3>
                <p className="text-sm text-white/50">
                  Sign the transaction now and your content will be automatically published at your chosen time.
                </p>
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Publish Now Confirmation */}
      {publishMode === 'now' && (
        <div className="space-y-4">
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-md bg-purple-500/20 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm text-white/90 font-medium mb-1">Ready to Publish</h4>
                <p className="text-sm text-white/50">
                  You will be asked to sign a transaction to register your content on the blockchain.
                  Once confirmed, your content will be live and available for purchase or rental.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setPublishMode(null)}
              className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-medium transition-all duration-200 border border-white/10 text-white/70"
            >
              Back
            </button>
            <button
              onClick={handlePublishNow}
              disabled={isPublishing}
              className="flex-1 py-2 bg-purple-500/20 hover:bg-purple-500/30 disabled:opacity-30 rounded-lg text-sm font-medium transition-all duration-200 border border-purple-500/30 hover:border-purple-500/50 text-white/90"
            >
              {isPublishing ? 'Publishing...' : 'Sign & Publish'}
            </button>
          </div>
        </div>
      )}

      {/* Schedule for Later */}
      {publishMode === 'later' && (
        <div className="space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-md bg-amber-500/20 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm text-white/90 font-medium mb-1">How Scheduled Publishing Works</h4>
                <ul className="text-sm text-white/50 space-y-0.5">
                  <li>1. Choose your publish date and time</li>
                  <li>2. Sign the transaction to authorize the publish</li>
                  <li>3. Your content will be automatically published at the scheduled time</li>
                </ul>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5 text-white/70">Schedule Date & Time</label>
            <input
              type="datetime-local"
              min={minDateTime}
              value={scheduleDateTime}
              onChange={(e) => setScheduleDateTime(e.target.value)}
              onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-amber-500/50 text-white/90 [color-scheme:dark] cursor-pointer"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setPublishMode(null)}
              className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-medium transition-all duration-200 border border-white/10 text-white/70"
            >
              Back
            </button>
            <button
              onClick={handleSchedule}
              disabled={!scheduleDateTime || isPublishing}
              className="flex-1 py-2 bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-30 rounded-lg text-sm font-medium transition-all duration-200 border border-amber-500/30 hover:border-amber-500/50 text-white/90"
            >
              {isPublishing ? 'Scheduling...' : 'Sign & Schedule'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
