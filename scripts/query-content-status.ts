import { Connection, PublicKey } from "@solana/web3.js";
import { createContentRegistryClient } from "@handcraft/sdk";
import { pda as tcPda, IDL as tcIdl, type SubjectStatus } from "@tribunalcraft/sdk";
import { BorshAccountsCoder } from "@coral-xyz/anchor";
import { sha256 } from "js-sha256";

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const TRIBUNALCRAFT_PROGRAM_ID = new PublicKey("TCPx6o1VzHDTJsATXtpvzmKqh8oLN9rNrT2hhLz3rHD");

function deriveSubjectId(contentCid: string): PublicKey {
  const hash = sha256.array(contentCid);
  return new PublicKey(new Uint8Array(hash));
}

function parseSubjectStatus(status: SubjectStatus | null): string {
  if (!status) return "none";
  if ("dormant" in status) return "dormant";
  if ("valid" in status) return "clean";
  if ("disputed" in status) return "disputed";
  if ("invalid" in status) return "flagged";
  if ("restoring" in status) return "restoring";
  return "none";
}

async function main() {
  console.log("Connecting to:", RPC_URL);
  const connection = new Connection(RPC_URL, "confirmed");
  const client = createContentRegistryClient(connection);

  console.log("\nFetching all content entries...\n");
  const content = await client.fetchGlobalContentWithMetadata();

  console.log(`Found ${content.length} content entries\n`);
  console.log("=".repeat(100));

  // Batch fetch TC subjects
  const contentCids = content.map(c => c.contentCid).filter((cid): cid is string => !!cid);
  const subjectPdas = contentCids.map(cid => {
    const subjectId = deriveSubjectId(cid);
    const [subjectPda] = tcPda.subject(subjectId);
    return subjectPda;
  });

  const statusMap = new Map<string, string>();

  if (subjectPdas.length > 0) {
    try {
      const coder = new BorshAccountsCoder(tcIdl as any);
      const accountInfos = await connection.getMultipleAccountsInfo(subjectPdas);

      for (let i = 0; i < contentCids.length; i++) {
        const accountInfo = accountInfos[i];
        if (accountInfo?.data) {
          try {
            const decoded = coder.decode("subject", accountInfo.data);
            statusMap.set(contentCids[i], parseSubjectStatus(decoded.status));
          } catch {
            statusMap.set(contentCids[i], "none (decode error)");
          }
        } else {
          statusMap.set(contentCids[i], "none (no account)");
        }
      }
    } catch (err) {
      console.error("Error fetching TC subjects:", err);
    }
  }

  // Display results
  for (const c of content) {
    const cid = c.contentCid || "N/A";
    const status = statusMap.get(cid) || "none";
    const creator = c.creator.toBase58();
    const name = c.collectionName || "Untitled";

    console.log(`Content: ${name}`);
    console.log(`  CID: ${cid.slice(0, 20)}...`);
    console.log(`  Creator: ${creator.slice(0, 20)}...`);
    console.log(`  TC Status: ${status}`);
    console.log(`  Locked: ${c.isLocked}, Minted: ${c.mintedCount}`);
    console.log("-".repeat(100));
  }

  // Summary
  const statusCounts: Record<string, number> = {};
  for (const status of statusMap.values()) {
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  }

  console.log("\n=== STATUS SUMMARY ===");
  for (const [status, count] of Object.entries(statusCounts)) {
    console.log(`  ${status}: ${count}`);
  }
}

main().catch(console.error);
