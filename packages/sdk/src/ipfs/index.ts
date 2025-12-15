import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListPartsCommand,
  CompletedPart,
} from "@aws-sdk/client-s3";
import { createHash } from "crypto";

const FILEBASE_ENDPOINT = "https://s3.filebase.com";
const IPFS_GATEWAY = "https://ipfs.filebase.io/ipfs/";

/**
 * Generate a content-based hash for consistent naming
 */
function contentHash(data: Buffer | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex").slice(0, 16);
}

export interface UploadResult {
  cid: string;
  url: string;
  size: number;
}

export interface FilebaseConfig {
  accessKey: string;
  secretKey: string;
  bucket: string;
}

export interface MultipartUploadInit {
  uploadId: string;
  key: string;
}

export interface UploadedPart {
  partNumber: number;
  etag: string;
  size: number;
}

export interface MultipartUploadStatus {
  uploadId: string;
  key: string;
  parts: UploadedPart[];
  totalParts: number;
}

export function createFilebaseClient(config: FilebaseConfig) {
  const client = new S3Client({
    endpoint: FILEBASE_ENDPOINT,
    region: "us-east-1",
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
  });

  return {
    async upload(file: Buffer | Uint8Array, name: string, contentType?: string): Promise<UploadResult> {
      // Use content-based key for deduplication - same content = same key = same CID
      const hash = contentHash(file instanceof Buffer ? file : Buffer.from(file));
      const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
      const key = `${hash}${ext}`;

      // Check if this content already exists
      try {
        const head = await client.send(new HeadObjectCommand({
          Bucket: config.bucket,
          Key: key,
        }));

        const existingCid = head.Metadata?.cid;
        if (existingCid) {
          // Content already uploaded, return existing CID
          console.log(`Content already exists with CID: ${existingCid}`);
          return {
            cid: existingCid,
            url: `${IPFS_GATEWAY}${existingCid}`,
            size: file.length,
          };
        }
      } catch {
        // Object doesn't exist, proceed with upload
      }

      // Upload new content
      await client.send(new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: file,
        ContentType: contentType,
      }));

      // Get CID from response headers - retry with delay for eventual consistency
      let cid = "";
      let retries = 3;
      while (retries > 0) {
        try {
          // Small delay to allow Filebase to process
          await new Promise(resolve => setTimeout(resolve, 500));

          const head = await client.send(new HeadObjectCommand({
            Bucket: config.bucket,
            Key: key,
          }));

          cid = head.Metadata?.cid || "";
          if (cid) break;
        } catch (err) {
          retries--;
          if (retries === 0) throw err;
          // Wait longer on retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      return {
        cid,
        url: `${IPFS_GATEWAY}${cid}`,
        size: file.length,
      };
    },

    async uploadJSON(data: Record<string, unknown>, name: string): Promise<UploadResult> {
      const json = JSON.stringify(data);
      return this.upload(Buffer.from(json), `${name}.json`, "application/json");
    },

    /**
     * Upload JSON with a fixed key (not content-based)
     * Useful for data that needs to be looked up by a known key
     */
    async uploadJSONWithKey(data: Record<string, unknown>, key: string): Promise<UploadResult> {
      const json = JSON.stringify(data);
      const buffer = Buffer.from(json);

      await client.send(new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: buffer,
        ContentType: "application/json",
      }));

      // Get CID from response headers
      let cid = "";
      let retries = 3;
      while (retries > 0) {
        try {
          await new Promise(resolve => setTimeout(resolve, 500));
          const head = await client.send(new HeadObjectCommand({
            Bucket: config.bucket,
            Key: key,
          }));
          cid = head.Metadata?.cid || "";
          if (cid) break;
        } catch (err) {
          retries--;
          if (retries === 0) throw err;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      return {
        cid,
        url: `${IPFS_GATEWAY}${cid}`,
        size: buffer.length,
      };
    },

    /**
     * Get JSON by fixed key
     * Returns null if not found
     */
    async getJSONByKey<T = Record<string, unknown>>(key: string): Promise<{ data: T; cid: string } | null> {
      try {
        const response = await client.send(new GetObjectCommand({
          Bucket: config.bucket,
          Key: key,
        }));

        const body = await response.Body?.transformToString();
        if (!body) return null;

        // Get CID from metadata
        const head = await client.send(new HeadObjectCommand({
          Bucket: config.bucket,
          Key: key,
        }));
        const cid = head.Metadata?.cid || "";

        return {
          data: JSON.parse(body) as T,
          cid,
        };
      } catch {
        return null;
      }
    },

    getUrl: (cid: string) => cid.startsWith("http") ? cid : `${IPFS_GATEWAY}${cid}`,

    // ============ Delete Methods ============

    /**
     * Delete an object by its S3 key
     */
    async deleteByKey(key: string): Promise<boolean> {
      try {
        await client.send(new DeleteObjectCommand({
          Bucket: config.bucket,
          Key: key,
        }));
        return true;
      } catch (err) {
        console.error(`Failed to delete object with key ${key}:`, err);
        return false;
      }
    },

    /**
     * Delete an object by its IPFS CID
     * Searches through the bucket to find the object with matching CID metadata
     * Returns true if found and deleted, false otherwise
     */
    async deleteByCid(cid: string): Promise<boolean> {
      if (!cid) return false;

      try {
        // List objects in the bucket and find the one with matching CID
        // This is not ideal for large buckets but works for reasonable sizes
        let continuationToken: string | undefined;

        do {
          const listResponse = await client.send(new ListObjectsV2Command({
            Bucket: config.bucket,
            ContinuationToken: continuationToken,
            MaxKeys: 1000,
          }));

          const objects = listResponse.Contents || [];

          // Check each object's metadata for matching CID
          for (const obj of objects) {
            if (!obj.Key) continue;

            try {
              const head = await client.send(new HeadObjectCommand({
                Bucket: config.bucket,
                Key: obj.Key,
              }));

              if (head.Metadata?.cid === cid) {
                // Found it - delete it
                await client.send(new DeleteObjectCommand({
                  Bucket: config.bucket,
                  Key: obj.Key,
                }));
                console.log(`Deleted object with CID ${cid}, key: ${obj.Key}`);
                return true;
              }
            } catch {
              // Skip objects we can't read metadata for
              continue;
            }
          }

          continuationToken = listResponse.NextContinuationToken;
        } while (continuationToken);

        console.log(`Object with CID ${cid} not found in bucket`);
        return false;
      } catch (err) {
        console.error(`Failed to delete object with CID ${cid}:`, err);
        return false;
      }
    },

    /**
     * Delete multiple objects by their CIDs
     * Returns array of successfully deleted CIDs
     */
    async deleteMultipleByCid(cids: string[]): Promise<string[]> {
      const deleted: string[] = [];

      for (const cid of cids) {
        if (cid && await this.deleteByCid(cid)) {
          deleted.push(cid);
        }
      }

      return deleted;
    },

    // ============ Multipart Upload Methods ============

    /**
     * Initialize a multipart upload
     * Returns uploadId and key for subsequent part uploads
     */
    async createMultipartUpload(fileName: string, contentType?: string): Promise<MultipartUploadInit> {
      // Generate a unique key for this upload
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 10);
      const ext = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")) : "";
      const key = `multipart/${timestamp}_${random}${ext}`;

      const response = await client.send(new CreateMultipartUploadCommand({
        Bucket: config.bucket,
        Key: key,
        ContentType: contentType,
      }));

      if (!response.UploadId) {
        throw new Error("Failed to create multipart upload");
      }

      return {
        uploadId: response.UploadId,
        key,
      };
    },

    /**
     * Upload a single part of a multipart upload
     * Parts must be at least 5MB (except the last part)
     * Part numbers start at 1
     */
    async uploadPart(
      key: string,
      uploadId: string,
      partNumber: number,
      data: Buffer | Uint8Array
    ): Promise<UploadedPart> {
      const response = await client.send(new UploadPartCommand({
        Bucket: config.bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
        Body: data,
      }));

      if (!response.ETag) {
        throw new Error(`Failed to upload part ${partNumber}`);
      }

      return {
        partNumber,
        etag: response.ETag,
        size: data.length,
      };
    },

    /**
     * Complete a multipart upload
     * All parts must be provided in order
     */
    async completeMultipartUpload(
      key: string,
      uploadId: string,
      parts: UploadedPart[]
    ): Promise<UploadResult> {
      // Sort parts by part number and format for S3
      const completedParts: CompletedPart[] = parts
        .sort((a, b) => a.partNumber - b.partNumber)
        .map(part => ({
          PartNumber: part.partNumber,
          ETag: part.etag,
        }));

      await client.send(new CompleteMultipartUploadCommand({
        Bucket: config.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: completedParts,
        },
      }));

      // Get CID from Filebase metadata
      let cid = "";
      let retries = 5;
      while (retries > 0) {
        try {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const head = await client.send(new HeadObjectCommand({
            Bucket: config.bucket,
            Key: key,
          }));
          cid = head.Metadata?.cid || "";
          if (cid) break;
        } catch (err) {
          retries--;
          if (retries === 0) throw err;
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      const totalSize = parts.reduce((sum, p) => sum + p.size, 0);

      return {
        cid,
        url: `${IPFS_GATEWAY}${cid}`,
        size: totalSize,
      };
    },

    /**
     * Abort a multipart upload
     * Cleans up any uploaded parts
     */
    async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
      await client.send(new AbortMultipartUploadCommand({
        Bucket: config.bucket,
        Key: key,
        UploadId: uploadId,
      }));
    },

    /**
     * List uploaded parts for a multipart upload
     * Useful for resuming uploads
     */
    async listParts(key: string, uploadId: string): Promise<UploadedPart[]> {
      const response = await client.send(new ListPartsCommand({
        Bucket: config.bucket,
        Key: key,
        UploadId: uploadId,
      }));

      return (response.Parts || []).map(part => ({
        partNumber: part.PartNumber || 0,
        etag: part.ETag || "",
        size: part.Size || 0,
      }));
    },
  };
}

// Re-export gateway constant
export { IPFS_GATEWAY };
