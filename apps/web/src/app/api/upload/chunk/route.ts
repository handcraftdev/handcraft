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

// In-memory chunk storage (in production, use Redis or temp file storage)
const uploadChunks = new Map<string, {
  chunks: Map<number, Buffer>;
  totalChunks: number;
  fileName: string;
  encrypt: boolean;
  createdAt: number;
}>();

// Clean up old uploads (older than 1 hour)
function cleanupOldUploads() {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [uploadId, upload] of uploadChunks.entries()) {
    if (upload.createdAt < oneHourAgo) {
      uploadChunks.delete(uploadId);
    }
  }
}

// Run cleanup every 10 minutes
setInterval(cleanupOldUploads, 10 * 60 * 1000);

/**
 * POST /api/upload/chunk
 * Receives a file chunk and stores it. When all chunks are received, assembles and uploads to IPFS.
 */
export async function POST(request: NextRequest) {
  if (!filebase) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  // Verify session token
  const authHeader = request.headers.get("authorization");
  const sessionToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!sessionToken) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const wallet = verifySessionToken(sessionToken);
  if (!wallet) {
    return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
  }

  try {
    const formData = await request.formData() as unknown as globalThis.FormData;
    const chunkValue = formData.get("chunk");
    const chunk = chunkValue instanceof Blob ? chunkValue : null;
    const uploadIdValue = formData.get("uploadId");
    const uploadId = typeof uploadIdValue === "string" ? uploadIdValue : "";
    const chunkIndexValue = formData.get("chunkIndex");
    const chunkIndex = parseInt(typeof chunkIndexValue === "string" ? chunkIndexValue : "");
    const totalChunksValue = formData.get("totalChunks");
    const totalChunks = parseInt(typeof totalChunksValue === "string" ? totalChunksValue : "");
    const fileNameValue = formData.get("fileName");
    const fileName = typeof fileNameValue === "string" ? fileNameValue : "";
    const encryptValue = formData.get("encrypt");
    const encrypt = encryptValue === "true";

    if (!chunk || !uploadId || isNaN(chunkIndex) || isNaN(totalChunks) || !fileName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Get or create upload state
    let upload = uploadChunks.get(uploadId);
    if (!upload) {
      upload = {
        chunks: new Map(),
        totalChunks,
        fileName,
        encrypt,
        createdAt: Date.now(),
      };
      uploadChunks.set(uploadId, upload);
    }

    // Store the chunk
    const chunkBuffer = Buffer.from(await chunk.arrayBuffer());
    upload.chunks.set(chunkIndex, chunkBuffer);

    // Check if all chunks are received
    if (upload.chunks.size === totalChunks) {
      // Assemble the file
      const sortedChunks: Buffer[] = [];
      for (let i = 0; i < totalChunks; i++) {
        const c = upload.chunks.get(i);
        if (!c) {
          return NextResponse.json({ error: `Missing chunk ${i}` }, { status: 400 });
        }
        sortedChunks.push(c);
      }

      const completeBuffer = Buffer.concat(sortedChunks);

      let contentCid: string;
      let encryptionMeta: object | null = null;

      if (encrypt) {
        if (!MASTER_SECRET) {
          uploadChunks.delete(uploadId);
          return NextResponse.json({ error: "Encryption not configured" }, { status: 503 });
        }

        const contentId = randomBytes(16).toString("hex");
        const { encryptedContent, meta } = createEncryptedBundleWithDerivedKey(
          new Uint8Array(completeBuffer),
          MASTER_SECRET,
          contentId
        );

        const encryptedBuffer = Buffer.from(encryptedContent);
        const result = await filebase.upload(
          encryptedBuffer,
          `${fileName}.encrypted`,
          "application/octet-stream"
        );
        contentCid = result.cid;
        encryptionMeta = { ...meta, contentId };
      } else {
        const result = await filebase.upload(completeBuffer, fileName, "application/octet-stream");
        contentCid = result.cid;
      }

      // Clean up
      uploadChunks.delete(uploadId);

      const IPFS_GATEWAY = "https://ipfs.filebase.io/ipfs";

      return NextResponse.json({
        success: true,
        complete: true,
        cid: contentCid,
        name: fileName,
        url: `${IPFS_GATEWAY}/${contentCid}`,
        encryptionMeta,
        size: completeBuffer.length,
      });
    }

    // Not all chunks received yet
    return NextResponse.json({
      success: true,
      complete: false,
      chunksReceived: upload.chunks.size,
      totalChunks,
    });
  } catch (error) {
    console.error("Chunk upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

/**
 * GET /api/upload/chunk
 * Get the status of a chunked upload
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const uploadId = searchParams.get("uploadId");

  if (!uploadId) {
    return NextResponse.json({ error: "uploadId required" }, { status: 400 });
  }

  const upload = uploadChunks.get(uploadId);
  if (!upload) {
    return NextResponse.json({
      found: false,
      message: "Upload not found or expired"
    });
  }

  return NextResponse.json({
    found: true,
    chunksReceived: upload.chunks.size,
    totalChunks: upload.totalChunks,
    completedChunks: Array.from(upload.chunks.keys()),
    fileName: upload.fileName,
  });
}

/**
 * DELETE /api/upload/chunk
 * Cancel a chunked upload
 */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const uploadId = searchParams.get("uploadId");

  if (!uploadId) {
    return NextResponse.json({ error: "uploadId required" }, { status: 400 });
  }

  uploadChunks.delete(uploadId);

  return NextResponse.json({ success: true });
}
