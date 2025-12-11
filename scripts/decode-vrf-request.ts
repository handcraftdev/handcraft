/**
 * Decode VRF request account to see callback data
 */
import { Connection, PublicKey } from "@solana/web3.js";

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const vrfRequestPda = new PublicKey("tQpSvZrEih7SeQnNqFNCDP1c4mB35R8g8QAhkZXeckH");

async function decode() {
  console.log("=== Decoding VRF Request Account ===\n");

  const vrfAccount = await connection.getAccountInfo(vrfRequestPda);
  if (!vrfAccount) {
    console.log("Account not found");
    return;
  }

  const data = vrfAccount.data;
  console.log("Total size:", data.length, "bytes");

  // RequestAccount layout:
  // - 8 discriminator
  // - 1 bump
  // - 8 slot
  // - 32 client
  // - 32 seed
  // - RequestState (Pending or Fulfilled)

  let offset = 0;

  // Discriminator (8 bytes)
  const discriminator = data.slice(offset, offset + 8);
  console.log("\nDiscriminator:", Buffer.from(discriminator).toString("hex"));
  offset += 8;

  // Bump (1 byte)
  const bump = data[offset];
  console.log("Bump:", bump);
  offset += 1;

  // Slot (8 bytes)
  const slot = data.readBigUInt64LE(offset);
  console.log("Slot:", slot.toString());
  offset += 8;

  // Client (32 bytes)
  const client = new PublicKey(data.slice(offset, offset + 32));
  console.log("Client:", client.toBase58());
  offset += 32;

  // Seed (32 bytes)
  const seed = data.slice(offset, offset + 32);
  console.log("Seed:", Buffer.from(seed).toString("hex"));
  offset += 32;

  // RequestState enum discriminator
  const stateDiscriminator = data[offset];
  console.log("\nState discriminator:", stateDiscriminator, stateDiscriminator === 0 ? "(Pending)" : "(Fulfilled)");
  offset += 1;

  if (stateDiscriminator === 0) {
    // Pending state - has responses Vec and callback Option
    // Vec<Response> responses - 4 bytes length + items (each Response = 32 pubkey + 64 randomness = 96 bytes)
    const responsesLen = data.readUInt32LE(offset);
    console.log("Responses count:", responsesLen);
    offset += 4 + responsesLen * 96;

    // Option<ValidatedCallback> callback
    const hasCallback = data[offset];
    console.log("Has callback:", hasCallback === 1 ? "Yes" : "No");
    offset += 1;

    if (hasCallback === 1) {
      // ValidatedCallback struct (Borsh order matches field declaration order)
      // - Vec<ValidatedRemainingAccount> remaining_accounts
      // - Vec<u8> data

      // remaining_accounts Vec (comes first!)
      const remainingAccountsLen = data.readUInt32LE(offset);
      console.log("\nRemaining accounts count:", remainingAccountsLen);
      offset += 4;

      for (let i = 0; i < remainingAccountsLen && i < 5; i++) {
        // ValidatedRemainingAccount: pubkey (32) + is_writable (1)
        const pubkey = new PublicKey(data.slice(offset, offset + 32));
        offset += 32;
        const isWritable = data[offset];
        offset += 1;
        console.log(`  Account ${i}: ${pubkey.toBase58().slice(0, 16)}... (${isWritable ? "Writable" : "Readonly"})`);
      }

      if (remainingAccountsLen > 5) {
        console.log(`  ... and ${remainingAccountsLen - 5} more accounts`);
        // Skip remaining accounts
        for (let i = 5; i < remainingAccountsLen; i++) {
          offset += 33; // 32 pubkey + 1 is_writable
        }
      }

      // ix_data (comes after remaining_accounts)
      const ixDataLen = data.readUInt32LE(offset);
      console.log("\nCallback ix_data length:", ixDataLen);
      offset += 4;
      const ixData = data.slice(offset, offset + ixDataLen);
      if (ixDataLen >= 8) {
        console.log("Callback ix_data (discriminator):", Buffer.from(ixData.slice(0, 8)).toString("hex"));
      }
      offset += ixDataLen;
    }

    // callback_override bool
    const callbackOverride = data[offset];
    console.log("\nCallback override:", callbackOverride === 1 ? "Yes" : "No");
  }
}

decode().catch(console.error);
