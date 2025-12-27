"use client";

import { ContentDraft } from '@/lib/supabase';
import { VideoMetadataForm } from '../forms/VideoMetadataForm';
import { MusicMetadataForm } from '../forms/MusicMetadataForm';
import { PhotoMetadataForm } from '../forms/PhotoMetadataForm';
import { BookMetadataForm } from '../forms/BookMetadataForm';
import { PostMetadataForm } from '../forms/PostMetadataForm';
import { getCollectionNameInfo } from '@/utils/nft-naming';

interface DetailsStepProps {
  draft: ContentDraft | null;
  onUpdate: (updates: Partial<ContentDraft>) => void;
  onNext: () => void;
  username?: string;
  isEditMode?: boolean;
}

export function DetailsStep({ draft, onUpdate, onNext, username = '', isEditMode = false }: DetailsStepProps) {
  const handleMetadataUpdate = (field: string, value: any) => {
    const typeMetadata = draft?.type_metadata || {};
    onUpdate({
      type_metadata: {
        ...typeMetadata,
        [field]: value,
      }
    });
  };

  const handleBasicUpdate = (field: string, value: any) => {
    onUpdate({ [field]: value });
  };

  // Collection name preview
  const collectionName = draft?.type_metadata?.collection_name || '';
  const collectionNameInfo = getCollectionNameInfo(username, collectionName);

  // Render appropriate form based on content type
  const renderForm = () => {
    const contentType = draft?.content_type;
    const metadata = draft?.type_metadata || {};

    switch (contentType) {
      case 0: // Video
      case 1: // Movie
      case 2: // Television
      case 3: // Music Video
      case 4: // Short
        return (
          <VideoMetadataForm
            contentType={contentType}
            metadata={metadata}
            title={draft?.title || ''}
            description={draft?.description || ''}
            tags={draft?.tags || []}
            onUpdate={handleMetadataUpdate}
            onBasicUpdate={handleBasicUpdate}
            isEditMode={isEditMode}
          />
        );
      case 5: // Music
      case 6: // Podcast
      case 7: // Audiobook
        return (
          <MusicMetadataForm
            contentType={contentType}
            metadata={metadata}
            title={draft?.title || ''}
            description={draft?.description || ''}
            tags={draft?.tags || []}
            onUpdate={handleMetadataUpdate}
            onBasicUpdate={handleBasicUpdate}
            isEditMode={isEditMode}
          />
        );
      case 8: // Photo
      case 9: // Artwork
        return (
          <PhotoMetadataForm
            contentType={contentType}
            metadata={metadata}
            title={draft?.title || ''}
            description={draft?.description || ''}
            tags={draft?.tags || []}
            onUpdate={handleMetadataUpdate}
            onBasicUpdate={handleBasicUpdate}
            isEditMode={isEditMode}
          />
        );
      case 10: // Book
      case 11: // Comic
        return (
          <BookMetadataForm
            contentType={contentType}
            metadata={metadata}
            title={draft?.title || ''}
            description={draft?.description || ''}
            tags={draft?.tags || []}
            onUpdate={handleMetadataUpdate}
            onBasicUpdate={handleBasicUpdate}
            isEditMode={isEditMode}
          />
        );
      case 16: // Post
        return (
          <PostMetadataForm
            metadata={metadata}
            title={draft?.title || ''}
            description={draft?.description || ''}
            tags={draft?.tags || []}
            onUpdate={handleMetadataUpdate}
            onBasicUpdate={handleBasicUpdate}
            isEditMode={isEditMode}
          />
        );
      default:
        return <div className="text-white/40">Unsupported content type</div>;
    }
  };

  // Details step only requires title (thumbnail moved to file step)
  const canProceed = !!draft?.title?.trim();

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-lg font-medium text-white/90 mb-1">Content Details</h2>
      <p className="text-sm text-white/40 mb-6">Add information about your content</p>

      <div className="space-y-4">
        {/* Collection Name - disabled in edit mode since it's on-chain */}
        {isEditMode ? (
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-white/70">Collection Name</label>
            <div className="px-3 py-2 bg-white/[0.02] border border-white/5 rounded-lg text-sm text-white/50">
              {collectionNameInfo.formatted || 'Not set'}
            </div>
            <p className="text-xs text-amber-400/70">Collection name cannot be changed after publishing</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-white/70">Collection Name (Optional)</label>
            <input
              type="text"
              value={collectionName}
              onChange={(e) => handleMetadataUpdate('collection_name', e.target.value)}
              placeholder="e.g., Summer Photos 2024"
              maxLength={collectionNameInfo.maxInputLength}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-purple-500/50 text-white/90 placeholder:text-white/30"
            />
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/30">
                Preview: <code className="text-purple-400 font-mono">{collectionNameInfo.formatted}</code>
              </span>
              <span className={collectionNameInfo.length > 32 ? 'text-red-400' : 'text-white/30'}>
                {collectionNameInfo.length}/32
              </span>
            </div>
          </div>
        )}

        {renderForm()}

        <button
          onClick={onNext}
          disabled={!canProceed}
          className="w-full py-2 bg-purple-500/20 hover:bg-purple-500/30 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-all duration-200 border border-purple-500/30 hover:border-purple-500/50 text-white/90"
        >
          Continue to File Upload
        </button>
      </div>
    </div>
  );
}
