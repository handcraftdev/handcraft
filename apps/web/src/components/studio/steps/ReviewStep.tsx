"use client";

import { ContentDraft } from '@/lib/supabase';
import { isStepComplete } from '../UploadStudio';

interface ReviewStepProps {
  draft: ContentDraft | null;
  onNext: () => void;
}

const LAMPORTS_PER_SOL = 1_000_000_000;

function formatSol(lamports: number | null | undefined): string {
  if (lamports == null) return '-';
  return (lamports / LAMPORTS_PER_SOL).toFixed(3);
}

export function ReviewStep({ draft, onNext }: ReviewStepProps) {
  if (!draft) return null;

  const rentalConfig = draft.rental_config || {};

  // Check for incomplete steps
  const incompleteSteps: string[] = [];
  if (!isStepComplete('type', draft)) incompleteSteps.push('Content Type');
  if (!isStepComplete('file', draft)) incompleteSteps.push('File Upload');
  if (!isStepComplete('details', draft)) incompleteSteps.push('Details');
  if (!isStepComplete('monetization', draft)) incompleteSteps.push('Monetization');

  const canProceed = incompleteSteps.length === 0;

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-2xl font-medium text-white/90 mb-2">Review</h2>
      <p className="text-white/40 mb-8">Review your content before publishing</p>

      <div className="space-y-6">
        {/* Content Details */}
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6">
          <h3 className="text-lg font-medium text-white/90 mb-4">Content Details</h3>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-white/40 mb-1">Title</div>
              <div className="text-white/90">{draft.title || 'Untitled'}</div>
            </div>
            {draft.description && (
              <div>
                <div className="text-xs text-white/40 mb-1">Description</div>
                <div className="text-white/70 text-sm">{draft.description}</div>
              </div>
            )}
            {draft.tags && draft.tags.length > 0 && (
              <div>
                <div className="text-xs text-white/40 mb-1">Tags</div>
                <div className="flex gap-2 flex-wrap">
                  {draft.tags.map((tag, i) => (
                    <span key={i} className="px-2 py-1 bg-white/5 rounded text-xs text-white/70">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6">
          <h3 className="text-lg font-medium text-white/90 mb-4">Buy Price</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-white/40">Price</span>
              <span className="text-white/90 font-medium">
                {formatSol(draft.mint_price)} SOL
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Supply Limit</span>
              <span className="text-white/90">{(draft.supply_limit || 999999).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Rental Prices */}
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6">
          <h3 className="text-lg font-medium text-white/90 mb-4">Rental Prices</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-white/[0.02] rounded-lg">
              <div className="text-xs text-white/40 mb-1">6 Hours</div>
              <div className="text-white/90 font-medium">{formatSol(rentalConfig.rentFee6h)} SOL</div>
            </div>
            <div className="text-center p-3 bg-white/[0.02] rounded-lg">
              <div className="text-xs text-white/40 mb-1">1 Day</div>
              <div className="text-white/90 font-medium">{formatSol(rentalConfig.rentFee1d)} SOL</div>
            </div>
            <div className="text-center p-3 bg-white/[0.02] rounded-lg">
              <div className="text-xs text-white/40 mb-1">7 Days</div>
              <div className="text-white/90 font-medium">{formatSol(rentalConfig.rentFee7d)} SOL</div>
            </div>
          </div>
        </div>

        {/* Visibility */}
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6">
          <h3 className="text-lg font-medium text-white/90 mb-4">Visibility</h3>
          <div className="text-white/90">
            {['Public', 'Subscribers', 'Members', 'Buyers Only'][draft.visibility_level || 0]}
          </div>
          <div className="text-xs text-white/40 mt-1">
            {draft.visibility_level === 0 && 'Anyone can preview this content'}
            {draft.visibility_level === 1 && 'Only platform subscribers can preview'}
            {draft.visibility_level === 2 && 'Only your members can preview'}
            {draft.visibility_level === 3 && 'Must buy or rent to access'}
          </div>
        </div>

        {/* Incomplete Steps Warning */}
        {!canProceed && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <div className="text-amber-400 font-medium mb-1">Incomplete Steps</div>
                <div className="text-amber-400/70 text-sm">
                  Please complete the following before publishing:
                  <ul className="list-disc list-inside mt-1">
                    {incompleteSteps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={onNext}
          disabled={!canProceed}
          className="w-full py-3 bg-purple-500/20 hover:bg-purple-500/30 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl font-medium transition-all border border-purple-500/30 hover:border-purple-500/50 text-white/90"
        >
          Next
        </button>
      </div>
    </div>
  );
}
