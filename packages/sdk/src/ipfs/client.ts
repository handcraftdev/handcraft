import type {
  IPFSUploadResult,
  IPFSUploadOptions,
  IPFSClientConfig,
  ContentMetadata,
} from "./types";

const DEFAULT_GATEWAY = "https://gateway.pinata.cloud/ipfs/";

/**
 * IPFS Client for uploading and retrieving content via Pinata
 */
export class IPFSClient {
  private apiKey: string;
  private apiSecret: string;
  private gateway: string;
  private baseUrl = "https://api.pinata.cloud";

  constructor(config: IPFSClientConfig) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.gateway = config.gateway || DEFAULT_GATEWAY;
  }

  /**
   * Upload a file to IPFS
   */
  async uploadFile(
    file: File | Blob,
    options: IPFSUploadOptions = {}
  ): Promise<IPFSUploadResult> {
    const formData = new FormData();
    formData.append("file", file, options.name || "file");

    // Add pinata metadata
    const metadata = JSON.stringify({
      name: options.name || "handcraft-upload",
    });
    formData.append("pinataMetadata", metadata);

    const response = await fetch(`${this.baseUrl}/pinning/pinFileToIPFS`, {
      method: "POST",
      headers: {
        pinata_api_key: this.apiKey,
        pinata_secret_api_key: this.apiSecret,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`IPFS upload failed: ${error}`);
    }

    const data = await response.json();

    return {
      cid: data.IpfsHash,
      size: data.PinSize,
      name: options.name || "file",
      url: `${this.gateway}${data.IpfsHash}`,
    };
  }

  /**
   * Upload JSON metadata to IPFS
   */
  async uploadJSON(
    json: Record<string, unknown>,
    options: IPFSUploadOptions = {}
  ): Promise<IPFSUploadResult> {
    const response = await fetch(`${this.baseUrl}/pinning/pinJSONToIPFS`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        pinata_api_key: this.apiKey,
        pinata_secret_api_key: this.apiSecret,
      },
      body: JSON.stringify({
        pinataContent: json,
        pinataMetadata: {
          name: options.name || "handcraft-metadata",
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`IPFS JSON upload failed: ${error}`);
    }

    const data = await response.json();
    const jsonString = JSON.stringify(json);

    return {
      cid: data.IpfsHash,
      size: new Blob([jsonString]).size,
      name: options.name || "metadata.json",
      url: `${this.gateway}${data.IpfsHash}`,
    };
  }

  /**
   * Upload content with metadata
   * Uploads the file and creates a metadata JSON pointing to it
   */
  async uploadContent(
    file: File,
    metadata: Omit<ContentMetadata, "size" | "createdAt">,
    options: IPFSUploadOptions = {}
  ): Promise<{ content: IPFSUploadResult; metadata: IPFSUploadResult }> {
    // 1. Upload the actual file
    const contentResult = await this.uploadFile(file, {
      name: metadata.name,
      onProgress: options.onProgress,
    });

    // 2. Create and upload metadata
    const fullMetadata: ContentMetadata = {
      ...metadata,
      size: file.size,
      createdAt: new Date().toISOString(),
    };

    const metadataResult = await this.uploadJSON(fullMetadata, {
      name: `${metadata.name}-metadata`,
    });

    return {
      content: contentResult,
      metadata: metadataResult,
    };
  }

  /**
   * Get the gateway URL for a CID
   */
  getUrl(cid: string): string {
    if (!cid) return "";
    if (cid.startsWith("http")) return cid;
    if (cid.startsWith("ipfs://")) {
      return `${this.gateway}${cid.replace("ipfs://", "")}`;
    }
    return `${this.gateway}${cid}`;
  }

  /**
   * Fetch content from IPFS
   */
  async fetch(cid: string): Promise<Response> {
    const url = this.getUrl(cid);
    return fetch(url);
  }

  /**
   * Fetch JSON from IPFS
   */
  async fetchJSON<T = unknown>(cid: string): Promise<T> {
    const response = await this.fetch(cid);
    if (!response.ok) {
      throw new Error(`Failed to fetch IPFS content: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Check if a CID is pinned
   */
  async isPinned(cid: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/pinning/pinJobs?ipfs_pin_hash=${cid}`,
        {
          headers: {
            pinata_api_key: this.apiKey,
            pinata_secret_api_key: this.apiSecret,
          },
        }
      );
      const data = await response.json();
      return data.count > 0;
    } catch {
      return false;
    }
  }

  /**
   * Unpin content from IPFS
   */
  async unpin(cid: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/pinning/unpin/${cid}`, {
      method: "DELETE",
      headers: {
        pinata_api_key: this.apiKey,
        pinata_secret_api_key: this.apiSecret,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to unpin: ${error}`);
    }
  }
}

/**
 * Create an IPFS client from environment variables
 */
export function createIPFSClient(): IPFSClient {
  const apiKey = process.env.PINATA_API_KEY || process.env.NEXT_PUBLIC_PINATA_API_KEY;
  const apiSecret = process.env.PINATA_API_SECRET || process.env.NEXT_PUBLIC_PINATA_API_SECRET;
  const gateway = process.env.PINATA_GATEWAY || process.env.NEXT_PUBLIC_PINATA_GATEWAY;

  if (!apiKey || !apiSecret) {
    throw new Error("PINATA_API_KEY and PINATA_API_SECRET are required");
  }

  return new IPFSClient({
    apiKey,
    apiSecret,
    gateway,
  });
}
