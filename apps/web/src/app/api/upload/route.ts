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
    const formData = await request.formData();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const file = (formData as any).get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await filebase.upload(buffer, file.name, file.type);

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ configured: !!filebase, provider: "filebase" });
}
