/**
 * Test MagicBlock VRF single-transaction minting
 *
 * This script tests the end-to-end flow:
 * 1. User calls magicblock_request_mint (single transaction)
 * 2. MagicBlock oracle fulfills and calls magicblock_fulfill_mint (automatic)
 * 3. NFT is minted with VRF-determined rarity
 *
 * Run with: npx tsx scripts/test-magicblock-mint.ts
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
  SYSVAR_SLOT_HASHES_PUBKEY,
} from "@solana/web3.js";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";
import {
  PROGRAM_ID,
  getContentPda,
  getMintConfigPda,
  getContentRewardPoolPda,
  getContentCollectionPda,
  getWalletContentStatePda,
  getNftRewardStatePda,
  getNftRarityPda,
  getEcosystemConfigPda,
} from "@handcraft/sdk";

// MagicBlock VRF Constants (from ephemeral-vrf-sdk)
const MAGICBLOCK_VRF_PROGRAM_ID = new PublicKey("Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz");
const MAGICBLOCK_DEFAULT_QUEUE = new PublicKey("Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh");
const MAGICBLOCK_VRF_PROGRAM_IDENTITY = new PublicKey("9irBy75QS2BN81FUgXuHcjqceJJRuc9oDkAe8TKVvvAw");

const MPL_CORE_ID = new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");

// Seeds for MagicBlock mint (from magicblock_mint.rs)
const MB_MINT_REQUEST_SEED = Buffer.from("mb_mint_request");
const MB_NFT_SEED = Buffer.from("mb_nft");
const IDENTITY_SEED = Buffer.from("identity");

async function main() {
  console.log("=== Test MagicBlock VRF Single-Transaction Minting ===\n");

  // Load wallet
  const keypairPath = path.join(process.env.HOME!, ".config/solana/id.json");
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(new Uint8Array(keypairData));
  console.log("Wallet:", wallet.publicKey.toBase58());

  // Use standard devnet RPC
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  // Check balance
  const balance = await connection.getBalance(wallet.publicKey);
  console.log("Balance:", balance / LAMPORTS_PER_SOL, "SOL\n");

  if (balance < 0.5 * LAMPORTS_PER_SOL) {
    console.log("Insufficient balance. Requesting airdrop...");
    const sig = await connection.requestAirdrop(wallet.publicKey, 2 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig);
    console.log("Airdrop confirmed!\n");
  }

  // Load IDL and create program
  const idlPath = path.join(__dirname, "../packages/sdk/src/program/content_registry.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const provider = new AnchorProvider(connection, new Wallet(wallet), { commitment: "confirmed" });
  const program = new Program(idl, provider);

  // Use the content CID from the recently registered content
  const testContentCid = "QmHybridCallbackTest001";

  // Derive content PDA
  const [contentPda] = getContentPda(testContentCid);
  console.log("Content PDA:", contentPda.toBase58());

  // Check if content exists
  let contentData: any;
  try {
    contentData = await (program.account as any).contentEntry.fetch(contentPda);
    console.log("Content found! Creator:", contentData.creator.toBase58());
  } catch (error: any) {
    console.error("Content not found. Please register content first.");
    console.log("\nTo register content, use: npx tsx scripts/test-register-content.ts");
    return;
  }

  // Get ecosystem config
  const [ecosystemConfigPda] = getEcosystemConfigPda();

  // Derive all required PDAs
  const [mintConfigPda] = getMintConfigPda(contentPda);
  const [contentRewardPoolPda] = getContentRewardPoolPda(contentPda);
  const [contentCollectionPda] = getContentCollectionPda(contentPda);
  const [buyerWalletStatePda] = getWalletContentStatePda(wallet.publicKey, contentPda);

  // MagicBlock-specific PDAs
  const [mintRequestPda] = PublicKey.findProgramAddressSync(
    [MB_MINT_REQUEST_SEED, wallet.publicKey.toBuffer(), contentPda.toBuffer()],
    PROGRAM_ID
  );

  const [nftAssetPda] = PublicKey.findProgramAddressSync(
    [MB_NFT_SEED, mintRequestPda.toBuffer()],
    PROGRAM_ID
  );

  const [nftRewardStatePda] = getNftRewardStatePda(nftAssetPda);
  const [nftRarityPda] = getNftRarityPda(nftAssetPda);

  // Program identity PDA (added by #[vrf] macro)
  const [programIdentityPda] = PublicKey.findProgramAddressSync(
    [IDENTITY_SEED],
    PROGRAM_ID
  );

  // Use content data already fetched earlier
  const creator = contentData.creator;

  // Get collection asset from ContentCollection
  let contentCollectionData: any;
  try {
    contentCollectionData = await (program.account as any).contentCollection.fetch(contentCollectionPda);
  } catch (error: any) {
    console.error("Content collection not found. Please create collection for this content.");
    return;
  }
  const collectionAsset = contentCollectionData.collectionAsset;

  // Get mint config for price
  let mintConfigData: any;
  try {
    mintConfigData = await (program.account as any).mintConfig.fetch(mintConfigPda);
  } catch (error: any) {
    console.error("Mint config not found. Please enable minting for this content.");
    return;
  }
  const mintPrice = mintConfigData.price;

  // Get ecosystem config for treasury
  let ecosystemConfigData: any;
  try {
    ecosystemConfigData = await (program.account as any).ecosystemConfig.fetch(ecosystemConfigPda);
  } catch (error: any) {
    console.error("Ecosystem config not found. Please initialize ecosystem first.");
    return;
  }
  const treasury = ecosystemConfigData.treasury;

  console.log("\n=== MagicBlock VRF Constants ===");
  console.log("VRF Program ID:", MAGICBLOCK_VRF_PROGRAM_ID.toBase58());
  console.log("Default Queue:", MAGICBLOCK_DEFAULT_QUEUE.toBase58());
  console.log("VRF Program Identity:", MAGICBLOCK_VRF_PROGRAM_IDENTITY.toBase58());

  console.log("\n=== PDAs ===");
  console.log("Mint Request:", mintRequestPda.toBase58());
  console.log("NFT Asset:", nftAssetPda.toBase58());
  console.log("Program Identity:", programIdentityPda.toBase58());
  console.log("Creator:", creator.toBase58());
  console.log("Treasury:", treasury.toBase58());
  console.log("Collection Asset:", collectionAsset.toBase58());
  console.log("Mint Price:", mintPrice.toString(), "lamports");

  console.log("\n=== Requesting MagicBlock VRF Mint ===");

  try {
    // Check if there's already a pending request
    const existingRequest = await connection.getAccountInfo(mintRequestPda);
    if (existingRequest) {
      console.log("Pending mint request already exists!");
      console.log("Mint Request:", mintRequestPda.toBase58());

      // Try to decode and show status
      try {
        const requestData = await (program.account as any).magicBlockMintRequest.fetch(mintRequestPda);
        console.log("  Is Fulfilled:", requestData.isFulfilled);
        console.log("  Created At:", new Date(requestData.createdAt.toNumber() * 1000).toISOString());
      } catch (e) {
        console.log("  (Could not decode request data)");
      }

      console.log("\nTo cancel: npx tsx scripts/cancel-magicblock-mint.ts");
      return;
    }

    // Build the transaction
    // Note: The #[vrf] macro adds these accounts automatically:
    // - program_identity (PDA with "identity" seed)
    // - vrf_program (MagicBlock VRF program)
    // - slot_hashes (sysvar)
    // - system_program
    const tx = await (program.methods as any)
      .magicblockRequestMint()
      .accounts({
        ecosystemConfig: ecosystemConfigPda,
        content: contentPda,
        mintConfig: mintConfigPda,
        mintRequest: mintRequestPda,
        contentRewardPool: contentRewardPoolPda,
        contentCollection: contentCollectionPda,
        collectionAsset: collectionAsset,
        creator: creator,
        treasury: treasury,
        platform: null, // Optional platform wallet
        buyerWalletState: buyerWalletStatePda,
        nftAsset: nftAssetPda,
        nftRewardState: nftRewardStatePda,
        nftRarity: nftRarityPda,
        payer: wallet.publicKey,
        oracleQueue: MAGICBLOCK_DEFAULT_QUEUE,
        // These are added by #[vrf] macro but we need to pass them explicitly for the client
        programIdentity: programIdentityPda,
        vrfProgram: MAGICBLOCK_VRF_PROGRAM_ID,
        slotHashes: SYSVAR_SLOT_HASHES_PUBKEY,
        systemProgram: SystemProgram.programId,
      })
      .signers([wallet])
      .rpc();

    console.log("✅ MagicBlock Request Mint TX:", tx);
    console.log("\nWaiting for oracle callback...");
    console.log("MagicBlock oracle should respond within seconds (10-50ms on rollup).");
    console.log("\nYou can check the status with:");
    console.log(`  solana account ${mintRequestPda.toBase58()} --url devnet`);

    // Poll for fulfillment (MagicBlock should be much faster than ORAO)
    console.log("\nPolling for fulfillment (timeout: 30 seconds)...");
    const startTime = Date.now();
    const timeout = 30000; // 30 seconds (MagicBlock is fast)

    while (Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

      const requestAccount = await connection.getAccountInfo(mintRequestPda);
      if (!requestAccount) {
        console.log("✅ Mint request fulfilled and closed! NFT minted successfully!");

        // Check the NFT
        const nftAccount = await connection.getAccountInfo(nftAssetPda);
        if (nftAccount) {
          console.log("\n=== Minted NFT ===");
          console.log("NFT Asset:", nftAssetPda.toBase58());

          // Check rarity
          try {
            const rarityData = await (program.account as any).nftRarity.fetch(nftRarityPda);
            console.log("Rarity:", JSON.stringify(rarityData.rarity));
            console.log("Weight:", rarityData.weight.toString());
          } catch (e) {
            console.log("Could not fetch rarity data");
          }
        }
        return;
      }

      // Check if fulfilled
      try {
        const requestData = await (program.account as any).magicBlockMintRequest.fetch(mintRequestPda);
        if (requestData.isFulfilled) {
          console.log("✅ Request marked as fulfilled!");
          break;
        }
      } catch (e) {
        // Account may be closed, will be caught above
      }

      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      console.log(`  Still waiting... (${elapsed}s elapsed)`);
    }

    console.log("\n⏱️ Timeout reached. Oracle may still fulfill later.");
    console.log("Check manually with: solana account", mintRequestPda.toBase58());
    console.log("\nNote: MagicBlock VRF works best with their Ephemeral Rollup infrastructure.");
    console.log("On mainnet/devnet without rollup, response time may be longer.");

  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    if (error.logs) {
      console.error("\nLogs:");
      error.logs.forEach((log: string) => console.error("  ", log));
    }
  }
}

main().catch(console.error);
