import { NextRequest, NextResponse } from "next/server";
import { createFilebaseClient, createEncryptedBundleWithDerivedKey } from "@handcraft/sdk";
import { randomBytes } from "crypto";
import { verifySessionToken } from "@/lib/session";

const filebase = process.env.FILEBASE_KEY && process.env.FILEBASE_SECRET && process.env.FILEBASE_BUCKET
  ? createFilebaseClient({
      accessKey: process.env.FILEBASE_KEY,
      secretKey: process.env.FILEBASE_SECRET,
      bucket: process.env.FILEBASE_BUCKET,
    })
  : null;

const MASTER_SECRET = process.env.CONTENT_ENCRYPTION_SECRET;

// Maximum file size: 2GB (same as video limit, the largest domain)
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;

/**
 * Generate a preview from content
 * Preview should be a teaser, not the full content
 * - Images: No preview (show placeholder) - full image would defeat encryption
 * - Video: First few seconds (corrupted without full file)
 * - Audio: First few seconds (corrupted without full file)
 */
async function generatePreview(
  buffer: Buffer,
  contentType: string
): Promise<Buffer | null> {
  // For images: Don't generate preview - would expose the content
  // The feed will show a placeholder instead
  if (contentType.startsWith("image/")) {
    return null;
  }

  // For video/audio: return first 10% or 5MB max as preview
  // This creates a corrupted/partial preview that can't be fully played
  // TODO: Use ffmpeg for proper video/audio previews (first 10 seconds)
  if (contentType.startsWith("video/") || contentType.startsWith("audio/")) {
    const maxPreviewSize = 5 * 1024 * 1024; // 5MB
    const previewSize = Math.min(buffer.length * 0.1, maxPreviewSize);
    return buffer.slice(0, previewSize);
  }

  // For other types, no preview
  return null;
}

export async function POST(request: NextRequest) {
  if (!filebase) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  // SECURITY: Verify session token before allowing upload
  const authHeader = request.headers.get("authorization");
  const sessionToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!sessionToken) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const wallet = verifySessionToken(sessionToken);
  if (!wallet) {
    return NextResponse.json(
      { error: "Invalid or expired session" },
      { status: 401 }
    );
  }

  try {
    const formData = await request.formData();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const file = (formData as any).get("file") as File | null;
    const encrypt = (formData as any).get("encrypt") === "true";
    const generatePreviewFlag = (formData as any).get("generatePreview") === "true";

    if (!file) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }

    // Check file size before processing
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is 2 GB.` },
        { status: 413 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const contentType = file.type;

    let contentCid: string;
    let encryptionMeta: object | null = null;

    if (encrypt) {
      if (!MASTER_SECRET) {
        return NextResponse.json(
          { error: "Encryption not configured" },
          { status: 503 }
        );
      }

      // Generate a unique content ID for key derivation
      const contentId = randomBytes(16).toString("hex");

      // Encrypt the content using server-derived key
      const { encryptedContent, meta } = createEncryptedBundleWithDerivedKey(
        new Uint8Array(buffer),
        MASTER_SECRET,
        contentId
      );

      // Upload encrypted content
      const encryptedBuffer = Buffer.from(encryptedContent);
      const result = await filebase.upload(
        encryptedBuffer,
        `${file.name}.encrypted`,
        "application/octet-stream"
      );
      contentCid = result.cid;

      // Store contentId in metadata for later key derivation
      encryptionMeta = { ...meta, contentId };
    } else {
      // Upload unencrypted
      const result = await filebase.upload(buffer, file.name, contentType);
      contentCid = result.cid;
    }

    // Generate and upload preview if requested
    let previewCid: string | null = null;
    if (generatePreviewFlag) {
      const previewBuffer = await generatePreview(buffer, contentType);
      if (previewBuffer) {
        const previewResult = await filebase.upload(
          previewBuffer,
          `preview_${file.name}`,
          contentType
        );
        previewCid = previewResult.cid;
      }
    }

    const IPFS_GATEWAY = "https://ipfs.filebase.io/ipfs";

    return NextResponse.json({
      success: true,
      cid: contentCid,
      name: file.name,
      url: `${IPFS_GATEWAY}/${contentCid}`,
      previewCid,
      encryptionMeta, // Only present if encrypted, contains contentId for server-side decryption
      size: buffer.length,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ configured: !!filebase, provider: "filebase" });
}
