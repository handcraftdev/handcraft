import { NextRequest, NextResponse } from "next/server";
import { createFilebaseClient } from "@handcraft/sdk";

const filebase = process.env.FILEBASE_KEY && process.env.FILEBASE_SECRET && process.env.FILEBASE_BUCKET
  ? createFilebaseClient({
      accessKey: process.env.FILEBASE_KEY,
      secretKey: process.env.FILEBASE_SECRET,
      bucket: process.env.FILEBASE_BUCKET,
    })
  : null;

export async function POST(request: NextRequest) {
  if (!filebase) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  try {
    const { metadata, name } = await request.json();

    if (!metadata) {
      return NextResponse.json({ error: "No metadata provided" }, { status: 400 });
    }

    const result = await filebase.uploadJSON(metadata, name || "metadata");

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Metadata upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
