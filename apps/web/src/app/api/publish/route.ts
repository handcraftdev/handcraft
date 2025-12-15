import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient, getAccessTokenFromHeader } from '@/lib/supabase';

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

// POST /api/publish - Publish a draft to the blockchain
// Note: This endpoint marks a draft as ready to publish, but the actual
// blockchain transaction must be signed by the user's wallet on the client
export async function POST(request: NextRequest) {
  try {
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
      console.error('[POST /api/publish] JSON parse error:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON body', code: 'PARSE_ERROR', details: formatError(parseError) },
        { status: 400 }
      );
    }

    const { draft_id, content_pda, scheduled_at } = body;

    if (!draft_id) {
      return NextResponse.json(
        { error: 'draft_id is required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Create authenticated Supabase client - RLS will validate ownership
    const supabase = createAuthenticatedClient(accessToken);

    // If scheduled_at is provided, update the draft to scheduled status
    if (scheduled_at) {
      const { data, error } = await supabase
        .from('content_drafts')
        .update({
          status: 'scheduled',
          scheduled_at,
          updated_at: new Date().toISOString(),
        })
        .eq('id', draft_id)
        .select()
        .single();

      if (error) {
        console.error('[POST /api/publish] Schedule failed:', error);
        return NextResponse.json(
          { error: 'Failed to schedule draft', code: 'UPDATE_ERROR', details: formatError(error) },
          { status: 500 }
        );
      }

      // Create a publish job
      const { error: jobError } = await supabase
        .from('publish_jobs')
        .insert({
          draft_id,
          scheduled_at,
          status: 'pending',
        });

      if (jobError) {
        console.error('[POST /api/publish] Job creation failed:', jobError);
        // Don't fail the whole request, job is optional
      }

      return NextResponse.json({
        draft: data,
        message: 'Draft scheduled for publishing',
      });
    }

    // If content_pda is provided, mark the draft as published
    if (content_pda) {
      const { data, error } = await supabase
        .from('content_drafts')
        .update({
          status: 'published',
          content_pda,
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', draft_id)
        .select()
        .single();

      if (error) {
        console.error('[POST /api/publish] Publish failed:', error);
        return NextResponse.json(
          { error: 'Failed to publish draft', code: 'UPDATE_ERROR', details: formatError(error) },
          { status: 500 }
        );
      }

      return NextResponse.json({
        draft: data,
        message: 'Draft published successfully',
      });
    }

    // If neither scheduled_at nor content_pda is provided, just return the draft
    const { data, error } = await supabase
      .from('content_drafts')
      .select('*')
      .eq('id', draft_id)
      .single();

    if (error) {
      console.error('[POST /api/publish] Fetch failed:', error);
      return NextResponse.json(
        { error: 'Failed to fetch draft', code: 'QUERY_ERROR', details: formatError(error) },
        { status: 500 }
      );
    }

    return NextResponse.json({ draft: data });
  } catch (error) {
    console.error('[POST /api/publish] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'UNEXPECTED_ERROR', details: formatError(error) },
      { status: 500 }
    );
  }
}
