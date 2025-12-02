import { NextRequest, NextResponse } from "next/server";

const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_API_SECRET = process.env.PINATA_API_SECRET;
const PINATA_GATEWAY = process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud/ipfs/";

/**
 * POST /api/upload/metadata - Upload JSON metadata to IPFS
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

    // Get JSON body
    const body = await request.json();
    const { metadata, name } = body;

    if (!metadata) {
      return NextResponse.json(
        { error: "No metadata provided" },
        { status: 400 }
      );
    }

    // Upload to Pinata
    const response = await fetch(
      "https://api.pinata.cloud/pinning/pinJSONToIPFS",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          pinata_api_key: PINATA_API_KEY,
          pinata_secret_api_key: PINATA_API_SECRET,
        },
        body: JSON.stringify({
          pinataContent: metadata,
          pinataMetadata: {
            name: name || "handcraft-metadata",
            keyvalues: {
              app: "handcraft",
              type: "metadata",
              uploadedAt: new Date().toISOString(),
            },
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("Pinata JSON upload error:", error);
      return NextResponse.json(
        { error: "Failed to upload metadata to IPFS" },
        { status: 500 }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      cid: data.IpfsHash,
      url: `${PINATA_GATEWAY}${data.IpfsHash}`,
    });
  } catch (error) {
    console.error("Metadata upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
