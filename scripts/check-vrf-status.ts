/**
 * Check VRF request and mint request status
 */
import { Connection, PublicKey } from "@solana/web3.js";

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const vrfRequestPda = new PublicKey("tQpSvZrEih7SeQnNqFNCDP1c4mB35R8g8QAhkZXeckH");
const mintRequestPda = new PublicKey("NN53QrfkS7FvreNGPTbmfdeG4c4fSVjYpvFiyk7pYoA");

async function checkStatus() {
  console.log("=== VRF and Mint Request Status ===\n");

  // Check VRF request
  const vrfAccount = await connection.getAccountInfo(vrfRequestPda);
  if (vrfAccount) {
    const data = vrfAccount.data;
    // ORAO RequestAccount layout:
    // - 8 discriminator
    // - 1 bump
    // - 8 slot
    // - 32 client
    // - 32 seed
    // - RequestState (enum: 0=Pending, 1=Fulfilled)
    const stateOffset = 8 + 1 + 8 + 32 + 32; // = 81
    const stateDiscriminator = data[stateOffset];
    console.log("VRF Request:");
    console.log("  Account size:", data.length, "bytes");
    console.log("  State:", stateDiscriminator === 0 ? "Pending" : stateDiscriminator === 1 ? "Fulfilled" : `Unknown (${stateDiscriminator})`);
    if (stateDiscriminator === 1) {
      // Fulfilled layout: 1 (discriminator) + 32 (randomness) + ...
      const randomness = data.slice(stateOffset + 1, stateOffset + 1 + 32);
      console.log("  Randomness (hex):", Buffer.from(randomness).toString("hex"));
    }
  } else {
    console.log("VRF Request: Account not found");
  }

  console.log("");

  // Check mint request
  const mintAccount = await connection.getAccountInfo(mintRequestPda);
  if (mintAccount) {
    const data = mintAccount.data;
    // OraoMintRequest layout: 8 discriminator + 32 buyer + 32 content + 32 creator + 8 amount + 8 timestamp + 1 had_existing + 1 bump + 1 nft_bump + 1 is_fulfilled
    const isFulfilledOffset = 8 + 32 + 32 + 32 + 8 + 8 + 1 + 1 + 1;
    const isFulfilled = data[isFulfilledOffset];
    console.log("Mint Request:");
    console.log("  is_fulfilled:", isFulfilled === 1 ? "Yes" : "No");
    console.log("  Balance:", mintAccount.lamports / 1e9, "SOL");
  } else {
    console.log("Mint Request: Account closed (likely fulfilled and refunded)");
  }
}

checkStatus().catch(console.error);
