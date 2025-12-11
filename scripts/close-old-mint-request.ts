import { Connection, PublicKey, Keypair, Transaction, SystemProgram } from "@solana/web3.js";
import * as fs from "fs";

// This script closes old mint request accounts that can't be deserialized
// due to struct layout changes. Since the program owns the account, we need
// to use a migration instruction or close them via the old version.

// For now, let's just check the account info and if it's too small for the new
// struct, we'll need to use a different content for testing.

async function main() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  const keypairPath = process.env.HOME + "/.config/solana/id.json";
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf8"));
  const wallet = Keypair.fromSecretKey(new Uint8Array(keypairData));

  const mintRequestPda = new PublicKey("NN53QrfkS7FvreNGPTbmfdeG4c4fSVjYpvFiyk7pYoA");

  const info = await connection.getAccountInfo(mintRequestPda);
  if (!info) {
    console.log("Mint request account doesn't exist");
    return;
  }

  console.log("Mint request account:");
  console.log("  Size:", info.data.length, "bytes");
  console.log("  Lamports:", info.lamports);
  console.log("  Owner:", info.owner.toBase58());

  // Calculate expected sizes
  // Old struct: 8 + 32 + 32 + 32 + 8 + 8 + 1 + 1 + 1 + 1 + 32 + 32 + 32 + 32 + 1 = 253 bytes
  // New struct: Old + 4 + 64 + 8 = 253 + 76 = 329 bytes (4 for string len, 64 for string, 8 for u64)
  console.log("\nOld struct size: ~253 bytes");
  console.log("New struct size: ~329 bytes");

  if (info.data.length < 329) {
    console.log("\nThis is an OLD format account. Cannot be used with new program.");
    console.log("Options:");
    console.log("1. Test with a different content (use registerContent to create new)");
    console.log("2. Create a migration instruction to close old accounts");
    console.log("3. Manually close via upgrade authority (if possible)");
  }

  // Also check nft_reward_state and nft_rarity accounts
  const PROGRAM_ID = new PublicKey("3kLBPNtsBwqwb9xZRims2HC5uCeT6rUG9AqpKQfq2Vdn");

  const [nftAsset] = PublicKey.findProgramAddressSync(
    [Buffer.from("orao_nft"), mintRequestPda.toBuffer()],
    PROGRAM_ID
  );

  const [nftRewardState] = PublicKey.findProgramAddressSync(
    [Buffer.from("nft_reward"), nftAsset.toBuffer()],
    PROGRAM_ID
  );

  const [nftRarity] = PublicKey.findProgramAddressSync(
    [Buffer.from("nft_rarity"), nftAsset.toBuffer()],
    PROGRAM_ID
  );

  console.log("\nRelated accounts:");
  console.log("  NFT Asset:", nftAsset.toBase58());
  console.log("  NFT Reward State:", nftRewardState.toBase58());
  console.log("  NFT Rarity:", nftRarity.toBase58());

  const rewardInfo = await connection.getAccountInfo(nftRewardState);
  if (rewardInfo) {
    console.log("  NFT Reward State exists, size:", rewardInfo.data.length);
  }

  const rarityInfo = await connection.getAccountInfo(nftRarity);
  if (rarityInfo) {
    console.log("  NFT Rarity exists, size:", rarityInfo.data.length);
  }
}

main().catch(console.error);
