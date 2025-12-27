import { Connection, PublicKey } from "@solana/web3.js";
import { sha256 } from "js-sha256";

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("2ZDX86a1YmY3AvhFrq6CYQJr938qzhgMFytr9bCaoXS5");

// Known discriminators (sha256("account:AccountName")[0..8])
const DISCRIMINATORS: Record<string, string> = {
  "ContentEntry": sha256("account:ContentEntry").slice(0, 16),
  "Bundle": sha256("account:Bundle").slice(0, 16),
  "MintConfig": sha256("account:MintConfig").slice(0, 16),
  "RentConfig": sha256("account:RentConfig").slice(0, 16),
  "EcosystemConfig": sha256("account:EcosystemConfig").slice(0, 16),
  "UserProfile": sha256("account:UserProfile").slice(0, 16),
  "ContentRewardPool": sha256("account:ContentRewardPool").slice(0, 16),
  "PendingMint": sha256("account:PendingMint").slice(0, 16),
};

async function main() {
  console.log("Connecting to:", RPC_URL);
  console.log("Program ID:", PROGRAM_ID.toBase58());
  const connection = new Connection(RPC_URL, "confirmed");

  console.log("\nKnown discriminators:");
  for (const [name, disc] of Object.entries(DISCRIMINATORS)) {
    console.log(`  ${name}: ${disc}`);
  }

  console.log("\n=== Fetching ALL program accounts ===\n");

  const allAccounts = await connection.getProgramAccounts(PROGRAM_ID);
  console.log(`Total accounts: ${allAccounts.length}\n`);

  // Count by discriminator
  const counts: Record<string, number> = {};
  const unknownDiscs: Set<string> = new Set();

  for (const { pubkey, account } of allAccounts) {
    const discHex = Buffer.from(account.data.slice(0, 8)).toString("hex");

    // Find matching account type
    let found = false;
    for (const [name, expectedDisc] of Object.entries(DISCRIMINATORS)) {
      if (discHex === expectedDisc) {
        counts[name] = (counts[name] || 0) + 1;
        found = true;
        break;
      }
    }

    if (!found) {
      unknownDiscs.add(discHex);
      counts[`Unknown (${discHex.slice(0, 8)}...)`] = (counts[`Unknown (${discHex.slice(0, 8)}...)`] || 0) + 1;
    }
  }

  console.log("=== ACCOUNT TYPE BREAKDOWN ===\n");
  for (const [type, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count}`);
  }

  if (unknownDiscs.size > 0) {
    console.log("\nUnknown discriminators:");
    for (const disc of unknownDiscs) {
      console.log(`  ${disc}`);
    }
  }

  // List all ContentEntry accounts
  console.log("\n=== ContentEntry ACCOUNTS ===\n");
  const contentEntryDisc = DISCRIMINATORS["ContentEntry"];
  let idx = 0;
  for (const { pubkey, account } of allAccounts) {
    const discHex = Buffer.from(account.data.slice(0, 8)).toString("hex");
    if (discHex === contentEntryDisc) {
      idx++;
      console.log(`#${idx}: ${pubkey.toBase58()}`);
      console.log(`    Size: ${account.data.length} bytes`);
    }
  }
  console.log(`\nTotal ContentEntry accounts: ${idx}`);
}

main().catch(console.error);
