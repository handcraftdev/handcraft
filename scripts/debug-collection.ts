import { Connection, PublicKey } from "@solana/web3.js";
import { getContentPda, getContentCollectionPda, PROGRAM_ID } from "@handcraft/sdk";

const RPC_URL = "https://api.devnet.solana.com";

async function main() {
  const connection = new Connection(RPC_URL, "confirmed");

  // Use the content CID from the last test run
  const contentCid = "test-verified-claim-1764898640172";

  const [contentPda] = getContentPda(contentCid);
  const [contentCollectionPda] = getContentCollectionPda(contentPda);

  console.log("Content PDA:", contentPda.toBase58());
  console.log("Content Collection PDA:", contentCollectionPda.toBase58());

  const accountInfo = await connection.getAccountInfo(contentCollectionPda);
  if (!accountInfo) {
    console.log("Account not found");
    return;
  }

  console.log("\nAccount data (first 16 bytes hex):");
  console.log(Buffer.from(accountInfo.data.slice(0, 16)).toString("hex"));

  console.log("\nExpected discriminator from IDL: [166, 25, 212, 133, 171, 96, 134, 42]");
  console.log("Actual first 8 bytes:", Array.from(accountInfo.data.slice(0, 8)));

  // Try to decode manually
  const data = accountInfo.data;
  console.log("\nManual decode:");
  console.log("Content:", new PublicKey(data.slice(8, 40)).toBase58());
  console.log("Collection Asset:", new PublicKey(data.slice(40, 72)).toBase58());
  console.log("Creator:", new PublicKey(data.slice(72, 104)).toBase58());

  const createdAt = data.readBigInt64LE(104);
  console.log("Created At:", createdAt.toString());
}

main().catch(console.error);
