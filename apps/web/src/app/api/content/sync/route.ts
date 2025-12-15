import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { getContentPda } from "@handcraft/sdk";
import { syncContent } from "@/lib/indexer/sync";
import { createAuthenticatedClient, getAccessTokenFromHeader } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    // Authenticate request
    const accessToken = getAccessTokenFromHeader(request.headers.get("authorization"));
    if (!accessToken) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const supabase = createAuthenticatedClient(accessToken);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { content_cid } = body;

    if (!content_cid) {
      return NextResponse.json({ error: "content_cid is required" }, { status: 400 });
    }

    // Get RPC URL
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
    if (!rpcUrl) {
      console.error("[content/sync] Missing RPC_URL");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    // Create connection and derive content PDA
    const connection = new Connection(rpcUrl);
    const [contentPda] = getContentPda(content_cid);

    console.log(`[content/sync] Syncing content: ${content_cid} -> ${contentPda.toBase58()}`);

    // Sync content to indexed_content table
    const success = await syncContent(connection, contentPda);

    if (!success) {
      return NextResponse.json({
        error: "Failed to sync content. Content may not exist on-chain yet."
      }, { status: 404 });
    }

    console.log(`[content/sync] Successfully synced: ${content_cid}`);

    return NextResponse.json({
      success: true,
      content_cid,
      content_pda: contentPda.toBase58(),
    });
  } catch (error) {
    console.error("[content/sync] Error:", error);
    return NextResponse.json({
      error: "Internal server error"
    }, { status: 500 });
  }
}
