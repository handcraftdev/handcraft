import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { pda as tcPda, IDL as tcIdl, type SubjectStatus } from "@tribunalcraft/sdk";
import { BorshAccountsCoder } from "@coral-xyz/anchor";
import { sha256 } from "js-sha256";
import { createContentRegistryClient } from "@handcraft/sdk";

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

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

  console.log("\n=== 1. Fetching via fetchGlobalContent (raw accounts) ===\n");

  try {
    const rawContent = await client.fetchGlobalContent();
    console.log(`Raw content entries: ${rawContent.length}`);

    for (const item of rawContent) {
      console.log(`  - ${item.pubkey?.toBase58().slice(0, 20)}... | Creator: ${item.creator.toBase58().slice(0, 12)}... | Preview: ${(item.previewCid || "").slice(0, 12)}...`);
    }
  } catch (err) {
    console.error("Error in fetchGlobalContent:", err);
  }

  console.log("\n=== 2. Fetching via fetchGlobalContentWithMetadata (enriched) ===\n");

  try {
    const enrichedContent = await client.fetchGlobalContentWithMetadata();
    console.log(`Enriched content entries: ${enrichedContent.length}`);

    for (const item of enrichedContent) {
      console.log(`  - ${item.collectionName || "Untitled"} | CID: ${(item.contentCid || "").slice(0, 12)}... | Creator: ${item.creator.toBase58().slice(0, 12)}...`);
    }
  } catch (err) {
    console.error("Error in fetchGlobalContentWithMetadata:", err);
  }

  console.log("\n=== 3. Checking TC Subject accounts for each content ===\n");

  try {
    const rawContent = await client.fetchGlobalContent();
    const tcCoder = new BorshAccountsCoder(tcIdl as any);

    for (const item of rawContent) {
      const previewCid = item.previewCid || "";
      let tcStatus = "no previewCid";

      if (previewCid) {
        try {
          const subjectId = deriveSubjectId(previewCid);
          const [subjectPda] = tcPda.subject(subjectId);
          const subjectAccount = await connection.getAccountInfo(subjectPda);

          if (subjectAccount?.data) {
            const decoded = tcCoder.decode("subject", subjectAccount.data);
            tcStatus = parseSubjectStatus(decoded.status);
          } else {
            tcStatus = "none (no TC subject)";
          }
        } catch (e: any) {
          tcStatus = `error: ${e.message?.slice(0, 30)}`;
        }
      }

      console.log(`  Content: ${item.pubkey?.toBase58().slice(0, 20)}...`);
      console.log(`    Preview CID: ${previewCid.slice(0, 30)}...`);
      console.log(`    TC Status: ${tcStatus}`);
      console.log("");
    }
  } catch (err) {
    console.error("Error checking TC status:", err);
  }

  console.log("\n=== 4. Fetching ALL TC Subject accounts ===\n");

  try {
    // Query all TC subject accounts directly
    const TC_PROGRAM_ID = new PublicKey("TCPx6o1VzHDTJsATXtpvzmKqh8oLN9rNrT2hhLz3rHD");
    const accounts = await connection.getProgramAccounts(TC_PROGRAM_ID);
    console.log(`Total TC program accounts: ${accounts.length}`);

    const tcCoder = new BorshAccountsCoder(tcIdl as any);

    for (const acc of accounts) {
      try {
        // Try to decode as subject
        const decoded = tcCoder.decode("subject", acc.account.data);
        console.log(`  Subject: ${acc.pubkey.toBase58().slice(0, 20)}...`);
        console.log(`    Status: ${parseSubjectStatus(decoded.status)}`);
        console.log(`    Defender: ${decoded.defender?.toBase58().slice(0, 20)}...`);
        console.log("");
      } catch {
        // Not a subject account, try other types
        try {
          const dispute = tcCoder.decode("dispute", acc.account.data);
          console.log(`  Dispute: ${acc.pubkey.toBase58().slice(0, 20)}...`);
          console.log(`    Subject: ${dispute.subject?.toBase58().slice(0, 20)}...`);
          console.log("");
        } catch {
          // Other account type
        }
      }
    }
  } catch (err) {
    console.error("Error fetching TC accounts:", err);
  }
}

main().catch(console.error);
