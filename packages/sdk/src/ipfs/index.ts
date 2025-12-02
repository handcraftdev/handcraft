import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const FILEBASE_ENDPOINT = "https://s3.filebase.com";
const IPFS_GATEWAY = "https://ipfs.filebase.io/ipfs/";

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
      const key = `${Date.now()}-${name}`;

      await client.send(new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: file,
        ContentType: contentType,
      }));

      // Get CID from response headers
      const head = await client.send(new HeadObjectCommand({
        Bucket: config.bucket,
        Key: key,
      }));

      const cid = head.Metadata?.cid || "";

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

    getUrl: (cid: string) => cid.startsWith("http") ? cid : `${IPFS_GATEWAY}${cid}`,
  };
}

// Re-export gateway constant
export { IPFS_GATEWAY };
