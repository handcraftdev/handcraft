"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PublicKey } from '@solana/web3.js';
import { useDraft } from '@/hooks/useDraft';
import { useFileUpload, UploadProgress } from '@/hooks/useFileUpload';
import { useContentRegistry, ContentType as OnChainContentType } from '@/hooks/useContentRegistry';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { SidebarPanel } from '@/components/sidebar';
import { UploadSidebar } from './UploadSidebar';
import { TypeSelectStep } from './steps/TypeSelectStep';
import { FileUploadStep } from './steps/FileUploadStep';
import { DetailsStep } from './steps/DetailsStep';
import { MonetizationStep } from './steps/MonetizationStep';
import { ReviewStep } from './steps/ReviewStep';
import { PublishStep } from './steps/PublishStep';
import { ContentDraft } from '@/lib/supabase';
import { isUserRejection, getTransactionErrorMessage } from '@/utils/wallet-errors';
import { ConfirmModal, AlertModal } from '@/components/ui/ConfirmModal';
import { formatCollectionName } from '@/utils/nft-naming';

// Lazy initialization to avoid SSR _bn issues
let _DEFAULT_PLATFORM_WALLET: PublicKey | null | undefined = undefined;
function getDefaultPlatformWallet(): PublicKey | null {
  if (_DEFAULT_PLATFORM_WALLET === undefined) {
    _DEFAULT_PLATFORM_WALLET = process.env.NEXT_PUBLIC_PLATFORM_WALLET
      ? new PublicKey(process.env.NEXT_PUBLIC_PLATFORM_WALLET)
      : null;
  }
  return _DEFAULT_PLATFORM_WALLET;
}

const LAMPORTS_PER_SOL = 1_000_000_000;

// Map domain to on-chain content type
function getOnChainContentType(domain: string, contentType: number): OnChainContentType {
  // The content_type in draft matches OnChainContentType enum values
  return contentType as OnChainContentType;
}

export type UploadStep = 'type' | 'file' | 'details' | 'monetization' | 'review' | 'publish';

interface UploadStudioProps {
  draftId?: string;
  editContentCid?: string; // For editing published content
}

// Helper to check if monetization is complete
function isMonetizationComplete(draft: ContentDraft | null): boolean {
  if (!draft) return false;
  const hasBuyPrice = draft.mint_price != null && draft.mint_price > 0;
  const rental = draft.rental_config || {};
  const hasAllRentals = rental.rentFee6h != null && rental.rentFee6h > 0
    && rental.rentFee1d != null && rental.rentFee1d > 0
    && rental.rentFee7d != null && rental.rentFee7d > 0;
  return hasBuyPrice && hasAllRentals;
}

// Step validation functions
export function isStepComplete(step: UploadStep, draft: ContentDraft | null): boolean {
  if (!draft) return false;

  switch (step) {
    case 'type':
      return draft.domain !== undefined && draft.domain !== '' && draft.content_type !== undefined;
    case 'details':
      // Details step requires title (thumbnail moved to file step)
      return !!draft.title?.trim();
    case 'file': {
      // File step requires content_cid and thumbnail (for non-image/text content)
      const hasContent = draft.content_cid !== null && draft.content_cid !== undefined;
      const isImageContent = draft.content_type === 8 || draft.content_type === 9;
      const isTextContent = draft.content_type === 16; // Post
      const hasThumbnail = !!draft.thumbnail_cid;
      return hasContent && (isImageContent || isTextContent || hasThumbnail);
    }
    case 'monetization':
      return isMonetizationComplete(draft);
    case 'review':
      // Review is never "complete" - it's a confirmation step before publish
      return false;
    case 'publish':
      // Publish is never "complete" until actually published
      return draft.status === 'published';
    default:
      return false;
  }
}

export function canNavigateToStep(targetStep: UploadStep, draft: ContentDraft | null): boolean {
  if (!draft) return targetStep === 'type';

  // Define what's required to navigate to each step
  // New order: type → details → file → monetization → review → publish
  switch (targetStep) {
    case 'type':
      return true; // Always can go to type
    case 'details':
      // Need type selected
      return draft.domain !== undefined && draft.domain !== '' && draft.content_type !== undefined;
    case 'file':
      // Need title filled in
      return !!draft.title?.trim();
    case 'monetization': {
      // Need file uploaded and thumbnail (for non-image/text content)
      const hasContent = !!draft.content_cid;
      const isImageContent = draft.content_type === 8 || draft.content_type === 9;
      const isTextContent = draft.content_type === 16; // Post
      const hasThumbnail = !!draft.thumbnail_cid;
      return hasContent && (isImageContent || isTextContent || hasThumbnail);
    }
    case 'review':
      // Need full monetization (buy price + all rental prices)
      return isMonetizationComplete(draft);
    case 'publish':
      // Need full monetization
      return isMonetizationComplete(draft);
    default:
      return false;
  }
}

// Determine the furthest completed step to resume from
function getResumeStep(draft: ContentDraft | null): UploadStep {
  if (!draft || !draft.id) return 'type';

  // Check from furthest to earliest
  // New order: type → details → file → monetization → review → publish
  if (isMonetizationComplete(draft)) return 'review';
  if (draft.content_cid) return 'monetization';
  if (draft.title?.trim()) return 'file';
  if (draft.domain && draft.content_type !== undefined) return 'details';
  return 'type';
}

export function UploadStudio({ draftId, editContentCid }: UploadStudioProps) {
  const router = useRouter();
  const isEditMode = !!editContentCid;
  const [step, setStep] = useState<UploadStep>(isEditMode ? 'details' : 'type');
  const [stepInitialized, setStepInitialized] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [currentUploadProgress, setCurrentUploadProgress] = useState<UploadProgress | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [alertModal, setAlertModal] = useState<{ title: string; message: string } | null>(null);
  const [editDraft, setEditDraft] = useState<ContentDraft | null>(null);
  const [editLoading, setEditLoading] = useState(isEditMode);
  const { draft: draftFromHook, updateDraft: updateDraftFromHook, saveDraft, publishDraft, isLoading: draftLoading, error: draftError } = useDraft(draftId);
  const { pauseUpload, resumeUpload, cancelUpload } = useFileUpload();
  const {
    registerContentWithMintAndRent,
    updateContentFull,
    isUpdatingContent,
    ecosystemConfig,
    content,
    useMintConfig,
    useRentConfig,
    userProfile,
    isLoadingUserProfile,
  } = useContentRegistry();
  const { session } = useSupabaseAuth();

  // In edit mode, use editDraft; otherwise use draft from hook
  const draft = isEditMode ? editDraft : draftFromHook;
  const updateDraft = isEditMode
    ? (updates: Partial<ContentDraft>) => setEditDraft(prev => prev ? { ...prev, ...updates } : null)
    : updateDraftFromHook;
  const isLoading = isEditMode ? editLoading : draftLoading;
  const error = isEditMode ? null : draftError;

  // Fetch mint/rent configs for edit mode
  const mintConfigQuery = useMintConfig(editContentCid || '');
  const rentConfigQuery = useRentConfig(editContentCid || '');

  // Load published content data for edit mode (only once)
  const editContentLoadedRef = useRef(false);
  useEffect(() => {
    if (!isEditMode || !editContentCid) return;
    // Skip if already loaded
    if (editContentLoadedRef.current || editDraft) return;

    // Find content in global content list
    const contentEntry = content.find(c => c.contentCid === editContentCid);
    // Wait for content to be available
    if (!contentEntry) return;

    async function loadPublishedContent() {
      setEditLoading(true);
      editContentLoadedRef.current = true;
      try {
        // Fetch metadata from IPFS
        let metadata: Record<string, any> = {};
        if (contentEntry!.metadataCid) {
          try {
            const res = await fetch(`https://ipfs.filebase.io/ipfs/${contentEntry!.metadataCid}`);
            if (res.ok) {
              metadata = await res.json();
            }
          } catch (e) {
            console.error('Failed to fetch metadata:', e);
          }
        }

        // Convert to draft-like object
        const editableDraft: ContentDraft = {
          id: editContentCid!, // Use contentCid as ID for edit mode
          creator_wallet: contentEntry!.creator?.toBase58() || '',
          content_type: (contentEntry!.contentType ?? 0) as number,
          domain: metadata.properties?.contentDomain || 'video',
          status: 'published',
          content_cid: contentEntry!.contentCid ?? null,
          preview_cid: contentEntry!.previewCid || null,
          thumbnail_cid: metadata.image ? metadata.image.replace('https://ipfs.filebase.io/ipfs/', '') : null,
          metadata_cid: contentEntry!.metadataCid ?? null,
          encryption_meta_cid: contentEntry!.encryptionMetaCid || null,
          title: metadata.properties?.title || metadata.name || null,
          description: metadata.description || null,
          tags: metadata.properties?.tags || [],
          type_metadata: metadata.properties || {},
          mint_price: null, // Will be loaded from mintConfig
          supply_limit: null,
          visibility_level: contentEntry!.visibilityLevel || 0,
          rental_config: null, // Will be loaded from rentConfig
          scheduled_at: null,
          published_at: null,
          content_pda: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        setEditDraft(editableDraft);
        setStepInitialized(true);
      } catch (err) {
        console.error('Failed to load content for editing:', err);
        editContentLoadedRef.current = false; // Allow retry on error
        setAlertModal({ title: 'Load Failed', message: 'Failed to load content data.' });
      } finally {
        setEditLoading(false);
      }
    }

    loadPublishedContent();
  }, [isEditMode, editContentCid, content, editDraft]);

  // Update draft with mint/rent config when loaded
  useEffect(() => {
    if (!isEditMode || !editDraft) return;

    const mintConfig = mintConfigQuery.data;
    const rentConfig = rentConfigQuery.data;

    if (mintConfig || rentConfig) {
      setEditDraft(prev => {
        if (!prev) return null;
        return {
          ...prev,
          mint_price: mintConfig?.priceSol ? Number(mintConfig.priceSol) : prev.mint_price,
          supply_limit: mintConfig?.maxSupply ? Number(mintConfig.maxSupply) : prev.supply_limit,
          rental_config: rentConfig ? {
            rentFee6h: Number(rentConfig.rentFee6h || 0),
            rentFee1d: Number(rentConfig.rentFee1d || 0),
            rentFee7d: Number(rentConfig.rentFee7d || 0),
          } : prev.rental_config,
        };
      });
    }
  }, [isEditMode, editDraft?.id, mintConfigQuery.data, rentConfigQuery.data]);

  // Restore step from draft progress on initial load
  useEffect(() => {
    if (draft && draftId && !stepInitialized && !isLoading) {
      const resumeStep = getResumeStep(draft);
      setStep(resumeStep);
      setStepInitialized(true);
    }
  }, [draft, draftId, stepInitialized, isLoading]);

  // Auto-save timer ref
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>('');

  // Auto-save function with debounce
  const triggerAutoSave = useCallback(async () => {
    // Skip auto-save in edit mode - edit mode is for published content, not drafts
    if (isEditMode) return;

    // Only auto-save when we have minimum required data
    // Must have: domain, content_type, and title
    if (!draft) return;
    if (!draft.domain || draft.content_type === undefined) return;
    if (!draft.title?.trim()) return;

    // Serialize draft to check for changes
    const draftString = JSON.stringify(draft);
    if (draftString === lastSavedRef.current) return;

    setAutoSaveStatus('saving');
    try {
      const savedDraft = await saveDraft();
      if (savedDraft) {
        lastSavedRef.current = JSON.stringify(savedDraft);
        setAutoSaveStatus('saved');
        // Reset status after 2 seconds
        setTimeout(() => setAutoSaveStatus('idle'), 2000);
      } else {
        setAutoSaveStatus('error');
        setTimeout(() => setAutoSaveStatus('idle'), 3000);
      }
    } catch {
      setAutoSaveStatus('error');
      setTimeout(() => setAutoSaveStatus('idle'), 3000);
    }
  }, [draft, saveDraft, isEditMode]);

  // Setup auto-save on draft changes
  useEffect(() => {
    if (!draft || isEditMode) return;

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new timer for auto-save (3 second debounce)
    autoSaveTimerRef.current = setTimeout(() => {
      triggerAutoSave();
    }, 3000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [draft, triggerAutoSave, isEditMode]);

  // Upload metadata to IPFS
  const uploadMetadata = useCallback(async (metadata: Record<string, unknown>): Promise<{ cid: string; url: string } | null> => {
    if (!session?.access_token) {
      console.error('[UploadStudio] No session token for metadata upload');
      return null;
    }

    try {
      const response = await fetch('/api/upload/metadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ metadata, name: 'metadata' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Metadata upload failed');
      }

      return response.json();
    } catch (error) {
      console.error('[UploadStudio] Metadata upload error:', error);
      return null;
    }
  }, [session]);

  const handlePublish = async (scheduleAt?: Date) => {
    if (!draft) return;

    setPublishError(null);
    setIsPublishing(true);

    try {
      // Both immediate and scheduled publishing require:
      // 1. Upload metadata to IPFS
      // 2. Sign and submit blockchain transaction
      // 3. Update draft status

      // Validate we have all required data
      if (!draft.content_cid) {
        throw new Error('Content file not uploaded');
      }

      if (!ecosystemConfig) {
        throw new Error('Ecosystem config not loaded. Please try again.');
      }

      // Require user profile to exist before registering content
      if (!userProfile) {
        throw new Error('Please set up your creator profile in the Studio Overview tab before publishing.');
      }

      // Build NFT naming (max 32 chars each)
      const username = userProfile?.username || '';
      const collectionName = draft.type_metadata?.collection_name as string | undefined;

      // Format names according to naming convention
      const formattedCollectionName = formatCollectionName(username, collectionName);
      // Note: NFT name and rarity are assigned at mint time, not at publish
      const nftBaseName = draft.title || 'Untitled';

      // Build metadata JSON
      const metadataJson: Record<string, unknown> = {
        name: nftBaseName,
        symbol: 'HC',
        description: draft.description || '',
        // For encrypted content without thumbnail, don't use content_cid as it's encrypted
        image: draft.thumbnail_cid
          ? `https://ipfs.filebase.io/ipfs/${draft.thumbnail_cid}`
          : draft.encryption_meta_cid
            ? undefined  // Encrypted content without thumbnail - no image
            : `https://ipfs.filebase.io/ipfs/${draft.content_cid}`,
        animation_url: `https://ipfs.filebase.io/ipfs/${draft.content_cid}`,
        external_url: `https://handcraft.app/content/${draft.content_cid}`,
        attributes: [
          { trait_type: 'Content Type', value: draft.domain },
          { trait_type: 'Creator', value: draft.creator_wallet },
        ],
        properties: {
          contentCid: draft.content_cid,
          previewCid: draft.preview_cid || '',
          encryptionMetaCid: draft.encryption_meta_cid || '',
          contentType: draft.content_type,
          contentDomain: draft.domain,
          tags: draft.tags || [],
          collection: formattedCollectionName,
          title: draft.title || 'Untitled',
          createdAt: Math.floor(Date.now() / 1000), // Unix timestamp in seconds
          ...draft.type_metadata,
        },
      };

      console.log('[UploadStudio] Uploading metadata...');
      const metadataResult = await uploadMetadata(metadataJson);
      if (!metadataResult) {
        throw new Error('Failed to upload metadata');
      }
      console.log('[UploadStudio] Metadata uploaded:', metadataResult.cid);

      // Build price and supply values
      // Note: draft.mint_price and rental fees are already stored in lamports
      const priceValue = BigInt(Math.floor(draft.mint_price || 0));
      const maxSupplyValue = draft.supply_limit ? BigInt(draft.supply_limit) : null;
      const royaltyBps = 400; // Fixed 4% royalty

      const platformWallet = getDefaultPlatformWallet() || ecosystemConfig.treasury;

      // Build rent fees if provided (already in lamports)
      const rental = draft.rental_config || {};
      let rentFees: { rentFee6h: bigint; rentFee1d: bigint; rentFee7d: bigint } | undefined;
      if (rental.rentFee6h && rental.rentFee1d && rental.rentFee7d) {
        rentFees = {
          rentFee6h: BigInt(Math.floor(rental.rentFee6h)),
          rentFee1d: BigInt(Math.floor(rental.rentFee1d)),
          rentFee7d: BigInt(Math.floor(rental.rentFee7d)),
        };
      }

      console.log('[UploadStudio] Registering on blockchain...');

      // Call blockchain registration - this triggers wallet signing
      await registerContentWithMintAndRent({
        contentCid: draft.content_cid,
        metadataCid: metadataResult.cid,
        contentType: getOnChainContentType(draft.domain, draft.content_type),
        price: priceValue,
        maxSupply: maxSupplyValue,
        creatorRoyaltyBps: royaltyBps,
        platform: platformWallet,
        isEncrypted: !!draft.encryption_meta_cid,
        previewCid: draft.preview_cid || '',
        encryptionMetaCid: draft.encryption_meta_cid || '',
        visibilityLevel: draft.visibility_level || 0,
        ...rentFees,
      });

      console.log('[UploadStudio] Blockchain registration successful!');

      // Update draft status to published (or scheduled if scheduleAt provided)
      await publishDraft(scheduleAt, draft.content_cid);

    } catch (err) {
      console.error('[UploadStudio] Publish failed:', err);

      // Don't show error for user rejection (user cancelled wallet signing)
      if (!isUserRejection(err)) {
        setPublishError(getTransactionErrorMessage(err));
      }
    } finally {
      setIsPublishing(false);
    }
  };

  // Handle saving edits for published content
  const handleSaveEdit = async () => {
    if (!draft || !editContentCid || !session?.access_token) return;

    setPublishError(null);
    setIsPublishing(true);

    try {
      // Build updated metadata JSON (preserving existing collection name from on-chain)
      const username = userProfile?.username || '';
      const collectionName = draft.type_metadata?.collection_name as string | undefined;

      const formattedCollectionName = formatCollectionName(username, collectionName);
      const nftBaseName = draft.title || 'Untitled';

      const metadataJson: Record<string, unknown> = {
        name: nftBaseName,
        symbol: 'HC',
        description: draft.description || '',
        // For encrypted content without thumbnail, don't use content_cid as it's encrypted
        image: draft.thumbnail_cid
          ? `https://ipfs.filebase.io/ipfs/${draft.thumbnail_cid}`
          : draft.encryption_meta_cid
            ? undefined  // Encrypted content without thumbnail - no image
            : `https://ipfs.filebase.io/ipfs/${draft.content_cid}`,
        animation_url: `https://ipfs.filebase.io/ipfs/${draft.content_cid}`,
        external_url: `https://handcraft.app/content/${draft.content_cid}`,
        attributes: [
          { trait_type: 'Content Type', value: draft.domain },
          { trait_type: 'Creator', value: draft.creator_wallet },
        ],
        properties: {
          contentCid: draft.content_cid,
          previewCid: draft.preview_cid || '',
          encryptionMetaCid: draft.encryption_meta_cid || '',
          contentType: draft.content_type,
          contentDomain: draft.domain,
          tags: draft.tags || [],
          collection: formattedCollectionName,
          title: draft.title || 'Untitled',
          createdAt: Math.floor(Date.now() / 1000), // Unix timestamp in seconds
          ...draft.type_metadata,
        },
      };

      console.log('[UploadStudio] Uploading updated metadata...');
      const metadataResult = await uploadMetadata(metadataJson);
      if (!metadataResult) {
        throw new Error('Failed to upload metadata');
      }
      console.log('[UploadStudio] Metadata uploaded:', metadataResult.cid);

      // Get the collection asset from content entry for metadata update
      const contentEntry = content.find(c => c.contentCid === editContentCid);
      const collectionAsset = contentEntry?.collectionAsset;

      if (!collectionAsset) {
        throw new Error('Collection asset not found - cannot update metadata');
      }

      // Build update params
      const rental = draft.rental_config || {};
      const updateParams: {
        contentCid: string;
        metadataCid: string;
        collectionAsset: typeof collectionAsset;
        price?: bigint;
        rentFee6h?: bigint;
        rentFee1d?: bigint;
        rentFee7d?: bigint;
      } = {
        contentCid: editContentCid,
        metadataCid: metadataResult.cid,
        collectionAsset: collectionAsset,
      };

      // Add price if set
      if (draft.mint_price != null) {
        updateParams.price = BigInt(Math.floor(draft.mint_price));
      }

      // Add rent fees if all are set
      if (rental.rentFee6h && rental.rentFee1d && rental.rentFee7d) {
        updateParams.rentFee6h = BigInt(Math.floor(rental.rentFee6h));
        updateParams.rentFee1d = BigInt(Math.floor(rental.rentFee1d));
        updateParams.rentFee7d = BigInt(Math.floor(rental.rentFee7d));
      }

      // Update all in a single transaction
      console.log('[UploadStudio] Updating on-chain (single tx)...', {
        collectionAsset: collectionAsset.toBase58(),
        hasPrice: !!updateParams.price,
        hasRent: !!updateParams.rentFee6h,
      });
      await updateContentFull(updateParams);
      console.log('[UploadStudio] On-chain update successful!');

      // Navigate back to studio
      router.push('/studio?tab=content');

    } catch (err) {
      console.error('[UploadStudio] Save edit failed:', err);
      if (!isUserRejection(err)) {
        setPublishError(getTransactionErrorMessage(err));
      }
    } finally {
      setIsPublishing(false);
    }
  };

  const handleStepClick = (targetStep: UploadStep) => {
    if (canNavigateToStep(targetStep, draft)) {
      setStep(targetStep);
    }
  };

  const handleDeleteClick = () => {
    if (!draft?.id || !session?.access_token) return;
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!draft?.id || !session?.access_token) return;

    setShowDeleteConfirm(false);
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/drafts/${draft.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete draft');
      }

      // Navigate back to studio
      router.push('/studio');
    } catch (err) {
      console.error('Error deleting draft:', err);
      setAlertModal({ title: 'Delete Failed', message: 'Failed to delete draft. Please try again.' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleNext = (nextStep: UploadStep) => {
    // Trust the step component - it only calls onNext when ready
    // Don't check isStepComplete here because state may not have updated yet
    setStep(nextStep);
  };

  const toggleSidebar = useCallback(() => setIsSidebarOpen(prev => !prev), []);

  // Upload handlers for sidebar controls
  const handlePauseUpload = useCallback(() => {
    if (currentUploadProgress?.uploadId) {
      pauseUpload(currentUploadProgress.uploadId);
    }
  }, [currentUploadProgress, pauseUpload]);

  const handleResumeUpload = useCallback(async () => {
    if (currentUploadProgress?.uploadId && selectedFile) {
      await resumeUpload(currentUploadProgress.uploadId, selectedFile, {
        onProgress: setCurrentUploadProgress,
        onComplete: (result) => {
          updateDraft({
            content_cid: result.cid,
            preview_cid: result.previewCid || null,
            encryption_meta_cid: result.encryptionMetaCid || null,
          });
        },
        onError: (err) => {
          console.error('Resume upload error:', err);
        },
      });
    }
  }, [currentUploadProgress, selectedFile, resumeUpload, updateDraft]);

  const handleCancelUpload = useCallback(() => {
    if (currentUploadProgress?.uploadId) {
      cancelUpload(currentUploadProgress.uploadId);
      setCurrentUploadProgress(null);
      setSelectedFile(null);
    }
  }, [currentUploadProgress, cancelUpload]);

  // Callback to receive upload state from FileUploadStep
  const handleUploadStateChange = useCallback((progress: UploadProgress | null, file: File | null) => {
    setCurrentUploadProgress(progress);
    setSelectedFile(file);
  }, []);

  // Show loading screen when loading an existing draft
  const isInitializing = draftId && (isLoading || !stepInitialized);

  // Common layout wrapper with fade transition
  const PageWrapper = ({ children, isLoading: loading }: { children: React.ReactNode; isLoading?: boolean }) => (
    <div className={`min-h-screen bg-black transition-opacity duration-300 ${loading ? 'opacity-100' : 'opacity-100'}`}>
      {children}
    </div>
  );

  if (isInitializing) {
    return (
      <PageWrapper isLoading>
        <SidebarPanel isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

        {/* Menu Button */}
        <button
          onClick={toggleSidebar}
          className={`fixed top-4 z-50 p-3 bg-white/5 backdrop-blur-md rounded-full border border-white/10 hover:border-white/20 transition-all duration-300 ${isSidebarOpen ? 'left-[264px]' : 'left-4'}`}
        >
          <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="flex h-screen pt-16">
          {/* Sidebar Skeleton */}
          <div className="w-64 border-r border-white/5 p-4">
            <div className="space-y-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white/[0.02]">
                  <div className="w-7 h-7 rounded-md bg-white/5 animate-pulse" />
                  <div className="flex-1">
                    <div className="h-3 w-20 bg-white/5 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Main Content Skeleton */}
          <main className="flex-1 overflow-auto p-6">
            <div className="max-w-5xl mx-auto">
              <div className="h-6 w-40 bg-white/5 rounded animate-pulse mb-2" />
              <div className="h-3 w-56 bg-white/5 rounded animate-pulse mb-6" />
              <div className="space-y-3">
                <div className="h-28 bg-white/[0.02] border border-white/5 rounded-lg animate-pulse" />
                <div className="h-28 bg-white/[0.02] border border-white/5 rounded-lg animate-pulse" />
              </div>
            </div>
          </main>
        </div>
      </PageWrapper>
    );
  }

  // Block access if user profile doesn't exist (not in edit mode)
  if (!isEditMode && !isLoadingUserProfile && !userProfile) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="max-w-sm text-center p-6">
          <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">Set Up Your Creator Profile</h2>
          <p className="text-sm text-white/50 mb-4">
            Before creating content, please set up your creator profile with a username in the Studio Overview tab.
          </p>
          <button
            onClick={() => router.push('/studio')}
            className="px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-white/90 transition-colors"
          >
            Go to Studio Overview
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Main App Sidebar */}
      <SidebarPanel isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Menu Button */}
      <button
        onClick={toggleSidebar}
        className={`fixed top-4 z-50 p-3 bg-white/5 backdrop-blur-md rounded-full border border-white/10 hover:border-white/20 transition-all duration-300 ${isSidebarOpen ? 'left-[264px]' : 'left-4'}`}
      >
        <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="flex h-screen pt-16">
        <UploadSidebar
          currentStep={step}
          draft={draft}
          onStepClick={handleStepClick}
          isLoading={isLoading}
          autoSaveStatus={autoSaveStatus}
          uploadProgress={currentUploadProgress}
          onPauseUpload={handlePauseUpload}
          onResumeUpload={handleResumeUpload}
          onCancelUpload={handleCancelUpload}
          onDelete={isEditMode ? undefined : handleDeleteClick}
          isDeleting={isDeleting}
          isEditMode={isEditMode}
        />

        <main className="flex-1 overflow-auto p-8">
        {error && (
          <div className="max-w-5xl mx-auto mb-6 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400">
            {error}
          </div>
        )}

        {step === 'type' && (
          <TypeSelectStep
            draft={draft}
            onUpdate={updateDraft}
            onNext={() => handleNext('details')}
          />
        )}

        {step === 'details' && (
          <DetailsStep
            draft={draft}
            onUpdate={updateDraft}
            onNext={() => handleNext('file')}
            username={userProfile?.username || ''}
            isEditMode={isEditMode}
          />
        )}

        {step === 'file' && (
          <FileUploadStep
            draft={draft}
            onUpdate={updateDraft}
            onNext={() => handleNext('monetization')}
            onUploadStateChange={handleUploadStateChange}
            username={userProfile?.username || ''}
          />
        )}

        {step === 'monetization' && (
          <MonetizationStep
            draft={draft}
            onUpdate={updateDraft}
            onNext={() => handleNext('review')}
            isEditMode={isEditMode}
          />
        )}

        {step === 'review' && (
          <ReviewStep
            draft={draft}
            onNext={() => handleNext('publish')}
          />
        )}

        {step === 'publish' && (
          <PublishStep
            draft={draft}
            onPublish={handlePublish}
            isPublishing={isPublishing}
            error={publishError}
            isEditMode={isEditMode}
            onSaveEdit={handleSaveEdit}
          />
        )}
        </main>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Draft"
        message="Are you sure you want to delete this draft? This will also delete all associated files and cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        isLoading={isDeleting}
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
