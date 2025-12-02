import { NextRequest, NextResponse } from "next/server";

const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_API_SECRET = process.env.PINATA_API_SECRET;
const PINATA_GATEWAY = process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud/ipfs/";

/**
 * POST /api/upload - Upload a file to IPFS via Pinata
 */
export async function POST(request: NextRequest) {
  try {
    // Check for API keys
    if (!PINATA_API_KEY || !PINATA_API_SECRET) {
      return NextResponse.json(
        { error: "IPFS service not configured" },
        { status: 503 }
      );
    }

    // Get form data - cast to any to avoid TypeScript issues with FormData
    const formData = await request.formData();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const file = (formData as any).get("file") as File | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const name = (formData as any).get("name") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Prepare form data for Pinata
    const pinataFormData = new FormData();
    pinataFormData.append("file", file, name || file.name);

    // Add metadata
    const metadata = JSON.stringify({
      name: name || file.name,
      keyvalues: {
        app: "handcraft",
        uploadedAt: new Date().toISOString(),
      },
    });
    pinataFormData.append("pinataMetadata", metadata);

    // Upload to Pinata
    const response = await fetch(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      {
        method: "POST",
        headers: {
          pinata_api_key: PINATA_API_KEY,
          pinata_secret_api_key: PINATA_API_SECRET,
        },
        body: pinataFormData,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("Pinata upload error:", error);
      return NextResponse.json(
        { error: "Failed to upload to IPFS" },
        { status: 500 }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      cid: data.IpfsHash,
      size: data.PinSize,
      name: name || file.name,
      url: `${PINATA_GATEWAY}${data.IpfsHash}`,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/upload - Check upload service status
 */
export async function GET() {
  const configured = !!(PINATA_API_KEY && PINATA_API_SECRET);

  return NextResponse.json({
    service: "ipfs",
    provider: "pinata",
    configured,
    gateway: PINATA_GATEWAY,
  });
}
