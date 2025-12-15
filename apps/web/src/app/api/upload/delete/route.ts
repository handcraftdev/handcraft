import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient, getAccessTokenFromHeader } from '@/lib/supabase';
import { createFilebaseClient } from '@handcraft/sdk';

// Initialize Filebase client for file deletion
const filebase = process.env.FILEBASE_KEY && process.env.FILEBASE_SECRET && process.env.FILEBASE_BUCKET
  ? createFilebaseClient({
      accessKey: process.env.FILEBASE_KEY,
      secretKey: process.env.FILEBASE_SECRET,
      bucket: process.env.FILEBASE_BUCKET,
    })
  : null;

// POST /api/upload/delete - Delete a file from IPFS by CID
export async function POST(request: NextRequest) {
  try {
    // Get access token from Authorization header
    const accessToken = getAccessTokenFromHeader(request.headers.get('authorization'));

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify the user is authenticated
    const supabase = createAuthenticatedClient(accessToken);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { cid } = body;

    if (!cid || typeof cid !== 'string') {
      return NextResponse.json(
        { error: 'CID is required' },
        { status: 400 }
      );
    }

    // Delete from Filebase
    if (!filebase) {
      console.warn('[DELETE /api/upload/delete] Filebase not configured, skipping delete');
      return NextResponse.json({ success: true, deleted: false, reason: 'Filebase not configured' });
    }

    try {
      const deleted = await filebase.deleteByCid(cid);
      console.log(`[DELETE /api/upload/delete] CID ${cid}: ${deleted ? 'deleted' : 'not found'}`);
      return NextResponse.json({ success: true, deleted });
    } catch (deleteError) {
      console.error(`[DELETE /api/upload/delete] Failed to delete CID ${cid}:`, deleteError);
      // Return success anyway - file might already be gone
      return NextResponse.json({ success: true, deleted: false, reason: 'Delete failed' });
    }
  } catch (error) {
    console.error('[DELETE /api/upload/delete] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
