/**
 * Cancel a pending MagicBlock VRF mint request
 */

import {
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";
import {
  PROGRAM_ID,
  getContentPda,
  getNftRewardStatePda,
  getNftRarityPda,
} from "@handcraft/sdk";

const MB_MINT_REQUEST_SEED = Buffer.from("mb_mint_request");
const MB_NFT_SEED = Buffer.from("mb_nft");

async function main() {
  console.log("=== Cancel MagicBlock VRF Mint Request ===\n");

  // Load wallet
  const keypairPath = path.join(process.env.HOME!, ".config/solana/id.json");
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(new Uint8Array(keypairData));
  console.log("Wallet:", wallet.publicKey.toBase58());

  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  // Load IDL and create program
  const idlPath = path.join(__dirname, "../packages/sdk/src/program/content_registry.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const provider = new AnchorProvider(connection, new Wallet(wallet), { commitment: "confirmed" });
  const program = new Program(idl, provider);

  // Use the same content CID as the test
  const testContentCid = "QmHybridCallbackTest001";

  // Derive content PDA
  const [contentPda] = getContentPda(testContentCid);
  console.log("Content PDA:", contentPda.toBase58());

  // Derive mint request PDA
  const [mintRequestPda] = PublicKey.findProgramAddressSync(
    [MB_MINT_REQUEST_SEED, wallet.publicKey.toBuffer(), contentPda.toBuffer()],
    PROGRAM_ID
  );
  console.log("Mint Request PDA:", mintRequestPda.toBase58());

  // Check if request exists
  const requestAccount = await connection.getAccountInfo(mintRequestPda);
  if (!requestAccount) {
    console.log("\nNo pending mint request found.");
    return;
  }

  // Derive NFT asset PDA (from mint request)
  const [nftAssetPda] = PublicKey.findProgramAddressSync(
    [MB_NFT_SEED, mintRequestPda.toBuffer()],
    PROGRAM_ID
  );
  console.log("NFT Asset PDA:", nftAssetPda.toBase58());

  // Derive rarity and reward state PDAs
  const [nftRarityPda] = getNftRarityPda(nftAssetPda);
  const [nftRewardStatePda] = getNftRewardStatePda(nftAssetPda);
  console.log("NFT Rarity PDA:", nftRarityPda.toBase58());
  console.log("NFT Reward State PDA:", nftRewardStatePda.toBase58());

  console.log("\nCanceling...");

  try {
    const tx = await (program.methods as any)
      .magicblockCancelMint()
      .accounts({
        content: contentPda,
        mintRequest: mintRequestPda,
        nftAsset: nftAssetPda,
        nftRarity: nftRarityPda,
        nftRewardState: nftRewardStatePda,
        buyer: wallet.publicKey,
      })
      .signers([wallet])
      .rpc();

    console.log("✅ Cancel TX:", tx);
    console.log("Mint request cancelled and funds returned.");
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    if (error.logs) {
      console.error("\nLogs:");
      error.logs.forEach((log: string) => console.error("  ", log));
    }
  }
}

main().catch(console.error);
