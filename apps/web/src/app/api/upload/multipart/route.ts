import { NextRequest, NextResponse } from "next/server";
import { createFilebaseClient } from "@handcraft/sdk";
import { createAuthenticatedClient, getAccessTokenFromHeader } from "@/lib/supabase";

const filebase = process.env.FILEBASE_KEY && process.env.FILEBASE_SECRET && process.env.FILEBASE_BUCKET
  ? createFilebaseClient({
      accessKey: process.env.FILEBASE_KEY,
      secretKey: process.env.FILEBASE_SECRET,
      bucket: process.env.FILEBASE_BUCKET,
    })
  : null;

// Minimum part size: 5MB (S3 requirement, except for last part)
const MIN_PART_SIZE = 5 * 1024 * 1024;

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

/**
 * POST /api/upload/multipart
 * Initialize a new multipart upload
 */
export async function POST(request: NextRequest) {
  if (!filebase) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  // Get access token from Authorization header
  const accessToken = getAccessTokenFromHeader(request.headers.get("authorization"));

  if (!accessToken) {
    return NextResponse.json(
      { error: "Authentication required", code: "MISSING_AUTH" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { fileName, fileSize, contentType, encrypt = false } = body;

    if (!fileName || !fileSize) {
      return NextResponse.json(
        { error: "fileName and fileSize are required", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    // Create authenticated Supabase client
    const supabase = createAuthenticatedClient(accessToken);

    // SECURITY: Extract wallet from JWT, don't trust client-provided value
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: "Invalid session", code: "AUTH_ERROR" },
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
        { error: "Wallet address not found in session", code: "WALLET_ERROR" },
        { status: 400 }
      );
    }

    // Calculate number of parts
    const chunkSize = MIN_PART_SIZE;
    const totalParts = Math.ceil(fileSize / chunkSize);

    // Initialize multipart upload with Filebase
    const { uploadId, key } = await filebase.createMultipartUpload(fileName, contentType);

    // Store upload state in database
    const { error: dbError } = await supabase
      .from('multipart_uploads')
      .insert({
        upload_id: uploadId,
        s3_key: key,
        creator_wallet: walletAddress, // Use JWT wallet, not client-provided
        file_name: fileName,
        file_size: fileSize,
        content_type: contentType,
        chunk_size: chunkSize,
        total_parts: totalParts,
        encrypt,
      });

    if (dbError) {
      // Abort the S3 upload if DB insert fails
      await filebase.abortMultipartUpload(key, uploadId);
      console.error("[POST /api/upload/multipart] DB insert failed:", dbError);
      return NextResponse.json(
        { error: "Failed to initialize upload", code: "INSERT_ERROR", details: formatError(dbError) },
        { status: 500 }
      );
    }

    return NextResponse.json({
      uploadId,
      key,
      chunkSize,
      totalParts,
    });
  } catch (error) {
    console.error("[POST /api/upload/multipart] Error:", error);
    return NextResponse.json(
      { error: "Failed to initialize upload", code: "UNEXPECTED_ERROR", details: formatError(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/upload/multipart?uploadId=xxx
 * Get status of a multipart upload (for resume)
 */
export async function GET(request: NextRequest) {
  // Get access token from Authorization header
  const accessToken = getAccessTokenFromHeader(request.headers.get("authorization"));

  if (!accessToken) {
    return NextResponse.json(
      { error: "Authentication required", code: "MISSING_AUTH" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const uploadId = searchParams.get("uploadId");

  if (!uploadId) {
    return NextResponse.json(
      { error: "uploadId required", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  try {
    // Create authenticated Supabase client - RLS will filter by wallet
    const supabase = createAuthenticatedClient(accessToken);

    // Get upload from database
    const { data: upload, error: uploadError } = await supabase
      .from('multipart_uploads')
      .select('*')
      .eq('upload_id', uploadId)
      .single();

    if (uploadError || !upload) {
      return NextResponse.json(
        { error: "Upload not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Get uploaded parts
    const { data: parts, error: partsError } = await supabase
      .from('multipart_upload_parts')
      .select('part_number, etag, size')
      .eq('upload_id', uploadId)
      .order('part_number');

    if (partsError) {
      console.error("[GET /api/upload/multipart] Parts query failed:", partsError);
    }

    return NextResponse.json({
      uploadId: upload.upload_id,
      key: upload.s3_key,
      fileName: upload.file_name,
      fileSize: upload.file_size,
      contentType: upload.content_type,
      chunkSize: upload.chunk_size,
      totalParts: upload.total_parts,
      encrypt: upload.encrypt,
      status: upload.status,
      uploadedParts: parts || [],
      createdAt: upload.created_at,
      expiresAt: upload.expires_at,
    });
  } catch (error) {
    console.error("[GET /api/upload/multipart] Error:", error);
    return NextResponse.json(
      { error: "Failed to get upload status", code: "UNEXPECTED_ERROR", details: formatError(error) },
      { status: 500 }
    );
  }
}
