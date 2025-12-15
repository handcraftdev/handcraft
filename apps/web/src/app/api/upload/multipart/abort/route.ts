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
 * POST /api/upload/multipart/abort
 * Abort a multipart upload
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
    const { uploadId } = body;

    if (!uploadId) {
      return NextResponse.json(
        { error: "uploadId is required", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    // Create authenticated Supabase client - RLS will filter by wallet
    const supabase = createAuthenticatedClient(accessToken);

    // Get upload from database (RLS handles ownership)
    const { data: upload, error: uploadError } = await supabase
      .from('multipart_uploads')
      .select('s3_key, status')
      .eq('upload_id', uploadId)
      .single();

    if (uploadError || !upload) {
      return NextResponse.json(
        { error: "Upload not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    if (upload.status !== 'active') {
      return NextResponse.json(
        { error: `Upload is already ${upload.status}`, code: "INVALID_STATUS" },
        { status: 400 }
      );
    }

    // Abort the S3 multipart upload
    try {
      await filebase.abortMultipartUpload(upload.s3_key, uploadId);
    } catch (s3Error) {
      // S3 abort may fail if upload already completed or doesn't exist
      console.warn("[POST /api/upload/multipart/abort] S3 abort warning:", s3Error);
    }

    // Update status in database (cascade will delete parts)
    await supabase
      .from('multipart_uploads')
      .update({ status: 'aborted' })
      .eq('upload_id', uploadId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/upload/multipart/abort] Error:", error);
    return NextResponse.json(
      { error: "Failed to abort upload", code: "UNEXPECTED_ERROR", details: formatError(error) },
      { status: 500 }
    );
  }
}
