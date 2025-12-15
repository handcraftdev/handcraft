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
 * POST /api/upload/multipart/part
 * Upload a single part of a multipart upload
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
    const formData = await request.formData() as unknown as globalThis.FormData;
    const partData = formData.get("part");
    const part = partData instanceof Blob ? partData : null;
    const uploadIdValue = formData.get("uploadId");
    const uploadId = typeof uploadIdValue === "string" ? uploadIdValue : "";
    const partNumberValue = formData.get("partNumber");
    const partNumber = parseInt(typeof partNumberValue === "string" ? partNumberValue : "");

    if (!part || !uploadId || isNaN(partNumber)) {
      return NextResponse.json(
        { error: "part, uploadId, and partNumber are required", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    // Create authenticated Supabase client - RLS will filter by wallet
    const supabase = createAuthenticatedClient(accessToken);

    // Verify upload exists and belongs to user (RLS handles ownership)
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
        { error: `Upload is ${upload.status}`, code: "INVALID_STATUS" },
        { status: 400 }
      );
    }

    // Check if part already exists
    const { data: existingPart } = await supabase
      .from('multipart_upload_parts')
      .select('etag')
      .eq('upload_id', uploadId)
      .eq('part_number', partNumber)
      .single();

    if (existingPart) {
      // Part already uploaded, return existing etag
      return NextResponse.json({
        success: true,
        partNumber,
        etag: existingPart.etag,
        alreadyUploaded: true,
      });
    }

    // Upload part to Filebase
    const partBuffer = Buffer.from(await part.arrayBuffer());
    const result = await filebase.uploadPart(
      upload.s3_key,
      uploadId,
      partNumber,
      partBuffer
    );

    // Store part info in database
    const { error: partError } = await supabase
      .from('multipart_upload_parts')
      .insert({
        upload_id: uploadId,
        part_number: partNumber,
        etag: result.etag,
        size: result.size,
      });

    if (partError) {
      console.error("[POST /api/upload/multipart/part] Part insert failed:", partError);
      // Part was uploaded but not recorded - could cause issues on resume
      // For now, we'll still return success since the part is in S3
    }

    return NextResponse.json({
      success: true,
      partNumber,
      etag: result.etag,
      size: result.size,
    });
  } catch (error) {
    console.error("[POST /api/upload/multipart/part] Error:", error);
    return NextResponse.json(
      { error: "Failed to upload part", code: "UNEXPECTED_ERROR", details: formatError(error) },
      { status: 500 }
    );
  }
}
