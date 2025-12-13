import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
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
  };
}

// Re-export gateway constant
export { IPFS_GATEWAY };
