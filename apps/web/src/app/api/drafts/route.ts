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

// GET /api/drafts - List drafts for the current user
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  console.log('[GET /api/drafts] === REQUEST START ===');

  try {
    const accessToken = getAccessTokenFromHeader(request.headers.get('authorization'));

    if (!accessToken) {
      console.log('[GET /api/drafts] No access token');
      return NextResponse.json(
        { error: 'Authentication required', code: 'MISSING_AUTH' },
        { status: 401 }
      );
    }

    // Decode JWT to get wallet
    let jwtWallet = 'unknown';
    const parts = accessToken.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      jwtWallet = payload.custom_claims?.address || payload.wallet_address || 'not-found';
    }
    console.log('[GET /api/drafts] JWT wallet:', jwtWallet);

    // Create authenticated Supabase client - RLS will filter by wallet from JWT
    const supabase = createAuthenticatedClient(accessToken);

    // Query drafts - RLS policy handles filtering by creator_wallet
    const { data, error } = await supabase
      .from('content_drafts')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[GET /api/drafts] Query failed:', error);
      return NextResponse.json(
        { error: 'Failed to fetch drafts', code: 'QUERY_ERROR', details: formatError(error) },
        { status: 500 }
      );
    }

    console.log('[GET /api/drafts] Returned', data?.length || 0, 'drafts in', Date.now() - startTime, 'ms');
    return NextResponse.json({ drafts: data });
  } catch (error) {
    console.error('[GET /api/drafts] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'UNEXPECTED_ERROR', details: formatError(error) },
      { status: 500 }
    );
  }
}

// POST /api/drafts - Create a new draft
export async function POST(request: NextRequest) {
  try {
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
      return NextResponse.json(
        { error: 'Invalid JSON body', code: 'PARSE_ERROR', details: formatError(parseError) },
        { status: 400 }
      );
    }

    // Validate required fields (content_type can be 0, so check for undefined/null)
    if (body.content_type === undefined || body.content_type === null || !body.domain) {
      return NextResponse.json(
        {
          error: 'content_type and domain are required',
          code: 'VALIDATION_ERROR',
          received: { content_type: body.content_type, domain: body.domain }
        },
        { status: 400 }
      );
    }

    // Create authenticated Supabase client
    const supabase = createAuthenticatedClient(accessToken);

    // SECURITY: Extract wallet from JWT, don't trust client-provided value
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Invalid session', code: 'AUTH_ERROR' },
        { status: 401 }
      );
    }

    // Extract wallet address from Web3 auth JWT
    const walletAddress =
      user.user_metadata?.custom_claims?.address ||
      user.user_metadata?.wallet_address ||
      user.app_metadata?.address ||
      user.identities?.[0]?.identity_data?.custom_claims?.address ||
      user.identities?.[0]?.identity_data?.address ||
      null;

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address not found in session', code: 'WALLET_ERROR' },
        { status: 400 }
      );
    }

    const insertData = {
      creator_wallet: walletAddress, // Use JWT wallet, not client-provided
      content_type: body.content_type,
      domain: body.domain,
      status: body.status || 'draft',
      content_cid: body.content_cid || null,
      preview_cid: body.preview_cid || null,
      thumbnail_cid: body.thumbnail_cid || null,
      metadata_cid: body.metadata_cid || null,
      encryption_meta_cid: body.encryption_meta_cid || null,
      title: body.title || null,
      description: body.description || null,
      tags: body.tags || null,
      type_metadata: body.type_metadata || null,
      mint_price: body.mint_price || null,
      supply_limit: body.supply_limit ?? 999999,
      visibility_level: body.visibility_level ?? 0,
      rental_config: body.rental_config || null,
      scheduled_at: body.scheduled_at || null,
    };

    const { data, error } = await supabase
      .from('content_drafts')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('[POST /api/drafts] Insert failed:', error);
      return NextResponse.json(
        { error: 'Failed to create draft', code: 'INSERT_ERROR', details: formatError(error) },
        { status: 500 }
      );
    }

    return NextResponse.json({ draft: data }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/drafts] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'UNEXPECTED_ERROR', details: formatError(error) },
      { status: 500 }
    );
  }
}
