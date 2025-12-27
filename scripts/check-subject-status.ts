import { Connection, PublicKey } from "@solana/web3.js";

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const subjectPda = new PublicKey("BLLWrEuH78EaXoXFqAuRUTEEJNifx7vSfdBng6ReUNfp");

async function main() {
  console.log("Subject PDA:", subjectPda.toBase58());

  const account = await connection.getAccountInfo(subjectPda);
  if (!account) {
    console.log("\nSubject account NOT FOUND");
    return;
  }

  console.log("\nSubject account exists!");
  console.log("Data size:", account.data.length, "bytes");

  // Status enum is typically at a known offset
  // For TC Subject: discriminator(8) + subjectId(32) + defender(32) = offset 72
  const statusByte = account.data[72];
  const statusMap: Record<number, string> = {
    0: "dormant",
    1: "valid",
    2: "disputed",
    3: "invalid",
    4: "restoring",
  };
  console.log("Status byte at offset 72:", statusByte);
  console.log("Status:", statusMap[statusByte] || "unknown");

  // Also print bytes around status for debugging
  console.log("\nBytes 70-80:", account.data.slice(70, 80).toString("hex"));
}

main().catch(console.error);
