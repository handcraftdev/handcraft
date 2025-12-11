import { Connection, PublicKey } from "@solana/web3.js";

// The randomness request from the previous test
const RANDOMNESS_REQUEST = process.argv[2];

if (!RANDOMNESS_REQUEST) {
  console.log("Usage: pnpm tsx scripts/decode-srs-request.ts <randomness_request_pubkey>");
  process.exit(1);
}

// State structure from solana-randomness-service-lite
// pub struct State {
//     pub is_completed: u8,        // offset 8
//     pub num_bytes: u8,           // offset 9
//     pub user: Pubkey,            // offset 10 (32 bytes)
//     pub escrow: Pubkey,          // offset 42 (32 bytes)
//     pub request_slot: u64,       // offset 74 (8 bytes)
//     pub callback: Callback,      // offset 82 (variable)
//     pub compute_units: u32,      // after callback
//     pub priority_fee_micro_lamports: u64,
//     pub error_message: String,
// }

async function main() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  const requestPubkey = new PublicKey(RANDOMNESS_REQUEST);

  console.log("=== SRS Request State Decode ===\n");
  console.log("Request Account:", requestPubkey.toBase58());

  const requestInfo = await connection.getAccountInfo(requestPubkey);
  if (!requestInfo) {
    console.log("\n❌ Request account does not exist");
    return;
  }

  const data = requestInfo.data;
  console.log("\nData Length:", data.length);

  // Discriminator (8 bytes)
  const discriminator = data.slice(0, 8);
  console.log("Discriminator:", discriminator.toString("hex"));

  // is_completed (1 byte at offset 8)
  const isCompleted = data[8];
  console.log("\n=== State Fields ===");
  console.log("is_completed:", isCompleted, isCompleted === 0 ? "(pending)" : isCompleted === 1 ? "(completed)" : "(failed?)");

  // num_bytes (1 byte at offset 9)
  const numBytes = data[9];
  console.log("num_bytes:", numBytes);

  // user (32 bytes at offset 10)
  const user = new PublicKey(data.slice(10, 42));
  console.log("user:", user.toBase58());

  // escrow (32 bytes at offset 42)
  const escrow = new PublicKey(data.slice(42, 74));
  console.log("escrow:", escrow.toBase58());

  // request_slot (8 bytes at offset 74)
  const requestSlot = data.readBigUInt64LE(74);
  console.log("request_slot:", requestSlot.toString());

  // Get current slot for comparison
  const currentSlot = await connection.getSlot();
  console.log("current_slot:", currentSlot);
  console.log("slots since request:", currentSlot - Number(requestSlot));

  // Callback starts at offset 82
  // Callback structure:
  //   program_id: Pubkey (32 bytes)
  //   accounts: Vec<AccountMetaBorsh> (4 bytes length + data)
  //   ix_data: Vec<u8> (4 bytes length + data)

  console.log("\n=== Callback ===");
  const callbackProgramId = new PublicKey(data.slice(82, 114));
  console.log("callback program_id:", callbackProgramId.toBase58());

  // accounts vec length (4 bytes)
  const accountsLength = data.readUInt32LE(114);
  console.log("accounts count:", accountsLength);

  // Each AccountMetaBorsh is: pubkey (32) + is_signer (1) + is_writable (1) = 34 bytes
  let offset = 118; // Start of accounts array
  console.log("\n=== Callback Accounts ===");
  for (let i = 0; i < accountsLength && offset + 34 <= data.length; i++) {
    const pubkey = new PublicKey(data.slice(offset, offset + 32));
    const isSigner = data[offset + 32] === 1;
    const isWritable = data[offset + 33] === 1;
    console.log(`${i}: ${pubkey.toBase58().slice(0, 20)}... signer=${isSigner} writable=${isWritable}`);
    offset += 34;
  }

  // ix_data vec length (4 bytes)
  const ixDataLength = data.readUInt32LE(offset);
  console.log("\nix_data length:", ixDataLength);
  offset += 4;

  // Skip ix_data
  offset += ixDataLength;

  // compute_units (4 bytes)
  if (offset + 4 <= data.length) {
    const computeUnits = data.readUInt32LE(offset);
    console.log("\n=== Transaction Options ===");
    console.log("compute_units:", computeUnits);
    offset += 4;
  }

  // priority_fee_micro_lamports (8 bytes)
  if (offset + 8 <= data.length) {
    const priorityFee = data.readBigUInt64LE(offset);
    console.log("priority_fee_micro_lamports:", priorityFee.toString());
    offset += 8;
  }

  // error_message (String = 4 byte length + data)
  if (offset + 4 <= data.length) {
    const errorMsgLength = data.readUInt32LE(offset);
    console.log("\n=== Error Message ===");
    console.log("error_message length:", errorMsgLength);
    offset += 4;
    if (errorMsgLength > 0 && offset + errorMsgLength <= data.length) {
      const errorMsg = data.slice(offset, offset + errorMsgLength).toString("utf-8");
      console.log("error_message:", errorMsg);
    } else {
      console.log("(no error message)");
    }
  }
}

main().catch(console.error);
