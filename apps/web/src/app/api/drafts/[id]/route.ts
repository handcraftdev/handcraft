import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient, getAccessTokenFromHeader } from '@/lib/supabase';
import { createFilebaseClient } from '@handcraft/sdk';

// Initialize Filebase client for file cleanup
const filebase = process.env.FILEBASE_KEY && process.env.FILEBASE_SECRET && process.env.FILEBASE_BUCKET
  ? createFilebaseClient({
      accessKey: process.env.FILEBASE_KEY,
      secretKey: process.env.FILEBASE_SECRET,
      bucket: process.env.FILEBASE_BUCKET,
    })
  : null;

// Helper to format error for response
function formatError(error: unknown): { message: string; details?: unknown } {
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    return {
      message: String(e.message || e.error || 'Unknown error'),
      details: e.details || e.hint || e.code || undefined,
    };
  }
  return { message: String(error) };
}

// GET /api/drafts/[id] - Get a single draft
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get access token from Authorization header
    const accessToken = getAccessTokenFromHeader(request.headers.get('authorization'));

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'MISSING_AUTH' },
        { status: 401 }
      );
    }

    // Create authenticated Supabase client - RLS will filter by wallet
    const supabase = createAuthenticatedClient(accessToken);

    const { data, error } = await supabase
      .from('content_drafts')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Draft not found', code: 'NOT_FOUND' },
          { status: 404 }
        );
      }
      console.error('[GET /api/drafts/[id]] Query failed:', error);
      return NextResponse.json(
        { error: 'Failed to fetch draft', code: 'QUERY_ERROR', details: formatError(error) },
        { status: 500 }
      );
    }

    return NextResponse.json({ draft: data });
  } catch (error) {
    console.error('[GET /api/drafts/[id]] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'UNEXPECTED_ERROR', details: formatError(error) },
      { status: 500 }
    );
  }
}

// PATCH /api/drafts/[id] - Update a draft
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get access token from Authorization header
    const accessToken = getAccessTokenFromHeader(request.headers.get('authorization'));

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'MISSING_AUTH' },
        { status: 401 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('[PATCH /api/drafts/[id]] JSON parse error:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON body', code: 'PARSE_ERROR', details: formatError(parseError) },
        { status: 400 }
      );
    }

    // Create authenticated Supabase client - RLS will validate ownership
    const supabase = createAuthenticatedClient(accessToken);

    // Build update object (only include fields that are present)
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.status !== undefined) updates.status = body.status;
    if (body.domain !== undefined) updates.domain = body.domain;
    if (body.content_type !== undefined) updates.content_type = body.content_type;
    if (body.content_cid !== undefined) updates.content_cid = body.content_cid;
    if (body.preview_cid !== undefined) updates.preview_cid = body.preview_cid;
    if (body.thumbnail_cid !== undefined) updates.thumbnail_cid = body.thumbnail_cid;
    if (body.metadata_cid !== undefined) updates.metadata_cid = body.metadata_cid;
    if (body.encryption_meta_cid !== undefined) updates.encryption_meta_cid = body.encryption_meta_cid;
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.tags !== undefined) updates.tags = body.tags;
    if (body.type_metadata !== undefined) updates.type_metadata = body.type_metadata;
    if (body.mint_price !== undefined) updates.mint_price = body.mint_price;
    if (body.supply_limit !== undefined) updates.supply_limit = body.supply_limit;
    if (body.visibility_level !== undefined) updates.visibility_level = body.visibility_level;
    if (body.rental_config !== undefined) updates.rental_config = body.rental_config;
    if (body.scheduled_at !== undefined) updates.scheduled_at = body.scheduled_at;
    if (body.published_at !== undefined) updates.published_at = body.published_at;
    if (body.content_pda !== undefined) updates.content_pda = body.content_pda;

    console.log('[PATCH /api/drafts/[id]] Updating draft:', id, 'with fields:', Object.keys(updates));

    const { data, error } = await supabase
      .from('content_drafts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Draft not found or not owned by you', code: 'NOT_FOUND' },
          { status: 404 }
        );
      }
      console.error('[PATCH /api/drafts/[id]] Update failed:', error);
      return NextResponse.json(
        { error: 'Failed to update draft', code: 'UPDATE_ERROR', details: formatError(error) },
        { status: 500 }
      );
    }

    return NextResponse.json({ draft: data });
  } catch (error) {
    console.error('[PATCH /api/drafts/[id]] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'UNEXPECTED_ERROR', details: formatError(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/drafts/[id] - Delete a draft and associated files
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get access token from Authorization header
    const accessToken = getAccessTokenFromHeader(request.headers.get('authorization'));

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'MISSING_AUTH' },
        { status: 401 }
      );
    }

    // Create authenticated Supabase client - RLS will validate ownership
    const supabase = createAuthenticatedClient(accessToken);

    // First, fetch the draft to get file CIDs
    const { data: draft, error: fetchError } = await supabase
      .from('content_drafts')
      .select('content_cid, preview_cid, thumbnail_cid, metadata_cid, encryption_meta_cid')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Draft not found or not owned by you', code: 'NOT_FOUND' },
          { status: 404 }
        );
      }
      console.error('[DELETE /api/drafts/[id]] Fetch failed:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch draft', code: 'FETCH_ERROR', details: formatError(fetchError) },
        { status: 500 }
      );
    }

    // Collect all CIDs to delete from Filebase
    const cidsToDelete: string[] = [];
    if (draft?.content_cid) cidsToDelete.push(draft.content_cid);
    if (draft?.preview_cid) cidsToDelete.push(draft.preview_cid);
    if (draft?.thumbnail_cid) cidsToDelete.push(draft.thumbnail_cid);
    if (draft?.metadata_cid) cidsToDelete.push(draft.metadata_cid);
    if (draft?.encryption_meta_cid) cidsToDelete.push(draft.encryption_meta_cid);

    // Delete files from Filebase (if client is configured)
    const deletedFiles: string[] = [];
    const failedFiles: string[] = [];

    if (filebase && cidsToDelete.length > 0) {
      console.log(`[DELETE /api/drafts/[id]] Deleting ${cidsToDelete.length} files from Filebase...`);

      for (const cid of cidsToDelete) {
        try {
          const deleted = await filebase.deleteByCid(cid);
          if (deleted) {
            deletedFiles.push(cid);
          } else {
            // Not found is OK - file may have already been deleted
            console.log(`[DELETE /api/drafts/[id]] File not found in Filebase: ${cid}`);
          }
        } catch (fileErr) {
          console.error(`[DELETE /api/drafts/[id]] Failed to delete file ${cid}:`, fileErr);
          failedFiles.push(cid);
        }
      }

      console.log(`[DELETE /api/drafts/[id]] Deleted ${deletedFiles.length} files, ${failedFiles.length} failed`);
    }

    // Delete the draft from Supabase
    const { error: deleteError } = await supabase
      .from('content_drafts')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('[DELETE /api/drafts/[id]] Delete failed:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete draft', code: 'DELETE_ERROR', details: formatError(deleteError) },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      deleted_files: deletedFiles.length,
      failed_files: failedFiles.length,
    });
  } catch (error) {
    console.error('[DELETE /api/drafts/[id]] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'UNEXPECTED_ERROR', details: formatError(error) },
      { status: 500 }
    );
  }
}
