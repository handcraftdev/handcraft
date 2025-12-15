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
 * POST /api/upload/multipart/complete
 * Complete a multipart upload
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
      .select('*')
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
        { error: `Upload is ${upload.status}`, code: "INVALID_STATUS" },
        { status: 400 }
      );
    }

    // Get all uploaded parts
    const { data: parts, error: partsError } = await supabase
      .from('multipart_upload_parts')
      .select('part_number, etag, size')
      .eq('upload_id', uploadId)
      .order('part_number');

    if (partsError || !parts) {
      return NextResponse.json(
        { error: "Failed to get uploaded parts", code: "QUERY_ERROR", details: formatError(partsError) },
        { status: 500 }
      );
    }

    // Verify all parts are uploaded
    if (parts.length !== upload.total_parts) {
      return NextResponse.json({
        error: `Missing parts. Expected ${upload.total_parts}, got ${parts.length}`,
        code: "INCOMPLETE_UPLOAD",
        uploadedParts: parts.map(p => p.part_number),
        totalParts: upload.total_parts,
      }, { status: 400 });
    }

    // Complete the multipart upload
    const result = await filebase.completeMultipartUpload(
      upload.s3_key,
      uploadId,
      parts.map(p => ({
        partNumber: p.part_number,
        etag: p.etag,
        size: p.size,
      }))
    );

    // Update upload status
    await supabase
      .from('multipart_uploads')
      .update({ status: 'completed' })
      .eq('upload_id', uploadId);

    const IPFS_GATEWAY = "https://ipfs.filebase.io/ipfs";

    return NextResponse.json({
      success: true,
      cid: result.cid,
      url: `${IPFS_GATEWAY}/${result.cid}`,
      size: result.size,
      fileName: upload.file_name,
    });
  } catch (error) {
    console.error("[POST /api/upload/multipart/complete] Error:", error);
    return NextResponse.json(
      { error: "Failed to complete upload", code: "UNEXPECTED_ERROR", details: formatError(error) },
      { status: 500 }
    );
  }
}
