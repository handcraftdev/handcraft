import { NextRequest, NextResponse } from "next/server";
import { createFilebaseClient } from "@handcraft/sdk";
import { createAuthenticatedClient, getAccessTokenFromHeader } from "@/lib/supabase";

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

  // SECURITY: Verify Supabase JWT token before allowing upload
  const accessToken = getAccessTokenFromHeader(request.headers.get("authorization"));

  if (!accessToken) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  // Verify the token by making a request to Supabase
  const supabase = createAuthenticatedClient(accessToken);
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Invalid or expired session" },
      { status: 401 }
    );
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
