import { Connection, PublicKey } from "@solana/web3.js";
import { getContentPda, getSrsMintRequestPda } from "../packages/sdk/src/program/pda";

const WALLET = process.argv[2];
const CONTENT_CID = process.argv[3];

if (!WALLET || !CONTENT_CID) {
  console.log("Usage: npx ts-node scripts/check-srs-account.ts <wallet> <content_cid>");
  process.exit(1);
}

async function main() {
  const connection = new Connection("https://api.devnet.solana.com");
  const wallet = new PublicKey(WALLET);
  
  const [contentPda] = getContentPda(CONTENT_CID);
  console.log("Content PDA:", contentPda.toBase58());
  
  const [mintRequestPda] = getSrsMintRequestPda(wallet, contentPda);
  console.log("SRS Mint Request PDA:", mintRequestPda.toBase58());
  
  const info = await connection.getAccountInfo(mintRequestPda);
  if (info) {
    console.log("\n⚠️  Account EXISTS:");
    console.log("  Lamports:", info.lamports / 1e9, "SOL");
    console.log("  Data length:", info.data.length, "bytes");
    console.log("\nThis is causing the error. You need to close this account.");
  } else {
    console.log("\n✓ Account does NOT exist - the error is elsewhere");
  }
}

main().catch(console.error);
