import { Connection, PublicKey } from "@solana/web3.js";
import { NATIVE_MINT, getAssociatedTokenAddressSync } from "@solana/spl-token";

// The randomness request from the previous test
const RANDOMNESS_REQUEST = process.argv[2];

if (!RANDOMNESS_REQUEST) {
  console.log("Usage: pnpm tsx scripts/inspect-srs-request.ts <randomness_request_pubkey>");
  process.exit(1);
}

async function main() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  const requestPubkey = new PublicKey(RANDOMNESS_REQUEST);
  const escrowPubkey = getAssociatedTokenAddressSync(NATIVE_MINT, requestPubkey, true);

  console.log("=== SRS Request Inspection ===\n");
  console.log("Request Account:", requestPubkey.toBase58());
  console.log("Escrow Account:", escrowPubkey.toBase58());

  // Check request account
  const requestInfo = await connection.getAccountInfo(requestPubkey);
  if (!requestInfo) {
    console.log("\n❌ Request account does not exist (may have been consumed or expired)");
  } else {
    console.log("\n=== Request Account ===");
    console.log("Owner:", requestInfo.owner.toBase58());
    console.log("Lamports:", requestInfo.lamports / 1e9, "SOL");
    console.log("Data Length:", requestInfo.data.length);

    // Parse some known fields from the data
    const data = requestInfo.data;

    // Try to extract key fields - based on Switchboard SRS layout
    // Byte 0-7: Anchor discriminator
    // Byte 8-39: authority (32 bytes)
    // etc.

    if (data.length >= 40) {
      const authority = new PublicKey(data.slice(8, 40));
      console.log("\nAuthority:", authority.toBase58());
    }

    if (data.length >= 72) {
      const callbackPid = new PublicKey(data.slice(40, 72));
      console.log("Callback PID:", callbackPid.toBase58());
    }

    // Look for callback program in other locations
    const OUR_PROGRAM = "3kLBPNtsBwqwb9xZRims2HC5uCeT6rUG9AqpKQfq2Vdn";
    console.log("\n=== Searching for Callback Program ID ===");
    for (let i = 0; i <= data.length - 32; i++) {
      try {
        const slice = data.slice(i, i + 32);
        const pubkey = new PublicKey(slice);
        if (pubkey.toBase58() === OUR_PROGRAM) {
          console.log("Found at offset " + i);
        }
      } catch {}
    }

    // Check for status byte (usually near start)
    console.log("\n=== First 100 bytes (hex) ===");
    console.log(data.slice(0, 100).toString("hex"));

    // Look for specific status indicators
    console.log("\n=== Status Analysis ===");
    // Common status byte locations
    for (const offset of [72, 73, 74, 75, 80, 104, 105]) {
      if (data.length > offset) {
        const byteVal = data[offset];
        console.log("Byte " + offset + ": " + byteVal + " (0x" + byteVal.toString(16) + ")");
      }
    }
  }

  // Check escrow account
  console.log("\n=== Escrow Account ===");
  const escrowInfo = await connection.getAccountInfo(escrowPubkey);
  if (!escrowInfo) {
    console.log("❌ Escrow does not exist!");
    console.log("This means the oracle fee was not paid!");
  } else {
    console.log("Owner:", escrowInfo.owner.toBase58());
    console.log("Lamports:", escrowInfo.lamports / 1e9, "SOL");
    console.log("Data Length:", escrowInfo.data.length);

    // Parse token account balance
    if (escrowInfo.data.length >= 72) {
      // SPL Token account layout: mint (32) + owner (32) + amount (8)
      const amount = escrowInfo.data.readBigUInt64LE(64);
      console.log("Token Balance:", Number(amount) / 1e9, "SOL (wrapped)");
    }
  }

  // Check SRS state
  const SRS_PROGRAM_ID = new PublicKey("RANDMo5gFnqnXJW5Z52KNmd24sAo95KAd5VbiCtq5Rh");
  const [srsStatePda] = PublicKey.findProgramAddressSync([Buffer.from("STATE")], SRS_PROGRAM_ID);

  console.log("\n=== SRS State ===");
  const srsStateInfo = await connection.getAccountInfo(srsStatePda);
  if (!srsStateInfo) {
    console.log("❌ SRS State does not exist!");
    console.log("The SRS program may not be initialized on devnet.");
  } else {
    console.log("Address:", srsStatePda.toBase58());
    console.log("Owner:", srsStateInfo.owner.toBase58());
    console.log("Lamports:", srsStateInfo.lamports / 1e9, "SOL");
    console.log("Data Length:", srsStateInfo.data.length);

    // Try to find oracle wallet in state
    if (srsStateInfo.data.length >= 40) {
      const adminOrOracle = new PublicKey(srsStateInfo.data.slice(8, 40));
      console.log("\nFirst pubkey in state (admin/oracle):", adminOrOracle.toBase58());
    }
    if (srsStateInfo.data.length >= 72) {
      const secondPubkey = new PublicKey(srsStateInfo.data.slice(40, 72));
      console.log("Second pubkey in state:", secondPubkey.toBase58());
    }
  }
}

main().catch(console.error);
