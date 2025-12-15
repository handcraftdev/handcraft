import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { ContentDraft } from '@/lib/supabase';
import { useSupabaseAuth } from './useSupabaseAuth';

// Helper to extract error details from API response
async function parseApiError(response: Response, fallbackMessage: string): Promise<string> {
  try {
    const data = await response.json();
    const parts = [data.error || fallbackMessage];
    if (data.code) parts.push(`[${data.code}]`);
    if (data.details?.message) parts.push(data.details.message);
    if (data.details?.details) parts.push(String(data.details.details));
    if (data.received) parts.push(`Received: ${JSON.stringify(data.received)}`);
    return parts.join(' - ');
  } catch {
    return `${fallbackMessage} (Status: ${response.status})`;
  }
}

export function useDraft(draftId?: string) {
  const { publicKey } = useWallet();
  const { session, isAuthenticated } = useSupabaseAuth();
  const [draft, setDraft] = useState<ContentDraft | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load draft from API
  const loadDraft = useCallback(async (id: string) => {
    if (!isAuthenticated || !session?.access_token) {
      // Silently skip - will retry when auth is ready
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/drafts/${id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorMsg = await parseApiError(response, 'Failed to load draft');
        throw new Error(errorMsg);
      }

      const data = await response.json();
      setDraft(data.draft);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load draft';
      setError(errorMsg);
      console.error('Error loading draft:', errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, session]);

  // Load draft on mount if draftId is provided, or when auth becomes ready
  useEffect(() => {
    if (draftId) {
      // Skip if we already have this draft loaded (e.g., after auto-save URL update)
      if (draft?.id === draftId) {
        return;
      }
      // Only load if authenticated
      if (isAuthenticated && session?.access_token) {
        loadDraft(draftId);
      }
    } else if (!draft) {
      // Create empty draft
      setDraft({
        id: '',
        creator_wallet: publicKey?.toBase58() || '',
        content_type: 0,
        domain: '',
        status: 'draft',
        content_cid: null,
        preview_cid: null,
        thumbnail_cid: null,
        metadata_cid: null,
        encryption_meta_cid: null,
        title: null,
        description: null,
        tags: null,
        type_metadata: null,
        mint_price: null,
        supply_limit: 999999,
        visibility_level: 0,
        rental_config: null,
        scheduled_at: null,
        published_at: null,
        content_pda: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }, [draftId, loadDraft, publicKey, isAuthenticated, session, draft?.id]);

  // Update draft (local state only)
  const updateDraft = useCallback((updates: Partial<ContentDraft>) => {
    setDraft(prev => {
      if (!prev) return null;
      return {
        ...prev,
        ...updates,
        updated_at: new Date().toISOString(),
      };
    });
  }, []);

  // Save draft to API
  const saveDraft = useCallback(async (updates?: Partial<ContentDraft>) => {
    if (!isAuthenticated || !session?.access_token || !publicKey || !draft) {
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const draftToSave = {
        ...draft,
        ...updates,
        creator_wallet: publicKey.toBase58(), // Always include wallet address
      };

      // If draft has an ID, update it; otherwise create new
      if (draftToSave.id) {
        const response = await fetch(`/api/drafts/${draftToSave.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(draftToSave),
        });

        if (!response.ok) {
          const errorMsg = await parseApiError(response, 'Failed to save draft');
          throw new Error(errorMsg);
        }

        const data = await response.json();
        setDraft(data.draft);
        return data.draft;
      } else {
        const response = await fetch('/api/drafts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(draftToSave),
        });

        if (!response.ok) {
          const errorMsg = await parseApiError(response, 'Failed to create draft');
          throw new Error(errorMsg);
        }

        const data = await response.json();
        setDraft(data.draft);
        return data.draft;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to save draft';
      setError(errorMsg);
      console.error('Error saving draft:', errorMsg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, session, publicKey, draft]);

  // Delete draft
  const deleteDraft = useCallback(async () => {
    if (!isAuthenticated || !session?.access_token || !draft?.id) return false;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/drafts/${draft.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorMsg = await parseApiError(response, 'Failed to delete draft');
        throw new Error(errorMsg);
      }

      setDraft(null);
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete draft';
      setError(errorMsg);
      console.error('Error deleting draft:', errorMsg);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, session, draft]);

  // Publish draft (schedule or immediate)
  const publishDraft = useCallback(async (scheduleAt?: Date, contentPda?: string) => {
    if (!isAuthenticated || !session?.access_token || !draft?.id) return null;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          draft_id: draft.id,
          scheduled_at: scheduleAt?.toISOString(),
          content_pda: contentPda,
        }),
      });

      if (!response.ok) {
        const errorMsg = await parseApiError(response, 'Failed to publish draft');
        throw new Error(errorMsg);
      }

      const data = await response.json();
      setDraft(data.draft);
      return data.draft;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to publish draft';
      setError(errorMsg);
      console.error('Error publishing draft:', errorMsg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, session, draft]);

  return {
    draft,
    isLoading,
    error,
    updateDraft,
    saveDraft,
    deleteDraft,
    publishDraft,
    reload: draftId ? () => loadDraft(draftId) : undefined,
  };
}
