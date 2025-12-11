/**
 * Test ORAO VRF single-transaction minting
 *
 * This script tests the end-to-end flow:
 * 1. User calls orao_request_mint (single transaction)
 * 2. ORAO oracle fulfills and calls orao_fulfill_mint (automatic)
 * 3. NFT is minted with VRF-determined rarity
 *
 * Run with: npx tsx scripts/test-orao-mint.ts
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
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

// Constants
const ORAO_VRF_CB_ID = new PublicKey("VRFCBePmGTpZ234BhbzNNzmyg39Rgdd6VgdfhHwKypU");
const MPL_CORE_ID = new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");

// Seeds
const VRF_CLIENT_STATE_SEED = Buffer.from("vrf_client_state");
const ORAO_MINT_REQUEST_SEED = Buffer.from("orao_mint_request");
const ORAO_NFT_SEED = Buffer.from("orao_nft");
const CB_CLIENT_ACCOUNT_SEED = Buffer.from("OraoVrfCbClient");
const CB_CONFIG_ACCOUNT_SEED = Buffer.from("OraoVrfCbConfig");
const CB_REQUEST_ACCOUNT_SEED = Buffer.from("OraoVrfCbRequest");

async function main() {
  console.log("=== Test ORAO VRF Single-Transaction Minting ===\n");

  // Load wallet
  const keypairPath = path.join(process.env.HOME!, ".config/solana/id.json");
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(new Uint8Array(keypairData));
  console.log("Wallet:", wallet.publicKey.toBase58());

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

  // First, let's check if we have any existing content to mint from
  console.log("Looking for content with active minting...");

  // Use the content CID from the recently registered content
  const testContentCid = "QmHybridCallbackTest001";

  // Derive content PDA using SDK function (handles CID hashing correctly)
  const [contentPda] = getContentPda(testContentCid);
  console.log("Content PDA:", contentPda.toBase58());

  // Check if content exists using program.account
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

  // Derive all required PDAs using SDK functions
  const [vrfClientStatePda] = PublicKey.findProgramAddressSync(
    [VRF_CLIENT_STATE_SEED],
    PROGRAM_ID
  );

  const [mintConfigPda] = getMintConfigPda(contentPda);
  const [contentRewardPoolPda] = getContentRewardPoolPda(contentPda);
  const [contentCollectionPda] = getContentCollectionPda(contentPda);
  const [buyerWalletStatePda] = getWalletContentStatePda(wallet.publicKey, contentPda);

  const [mintRequestPda] = PublicKey.findProgramAddressSync(
    [ORAO_MINT_REQUEST_SEED, wallet.publicKey.toBuffer(), contentPda.toBuffer()],
    PROGRAM_ID
  );

  const [nftAssetPda] = PublicKey.findProgramAddressSync(
    [ORAO_NFT_SEED, mintRequestPda.toBuffer()],
    PROGRAM_ID
  );

  const [nftRewardStatePda] = getNftRewardStatePda(nftAssetPda);
  const [nftRarityPda] = getNftRarityPda(nftAssetPda);

  // ORAO PDAs
  const [oraoClientPda] = PublicKey.findProgramAddressSync(
    [CB_CLIENT_ACCOUNT_SEED, PROGRAM_ID.toBuffer(), vrfClientStatePda.toBuffer()],
    ORAO_VRF_CB_ID
  );

  const [oraoNetworkStatePda] = PublicKey.findProgramAddressSync(
    [CB_CONFIG_ACCOUNT_SEED],
    ORAO_VRF_CB_ID
  );

  // Generate unique VRF seed
  const vrfSeed = Keypair.generate().publicKey.toBytes();

  const [vrfRequestPda] = PublicKey.findProgramAddressSync(
    [CB_REQUEST_ACCOUNT_SEED, oraoClientPda.toBuffer(), vrfSeed],
    ORAO_VRF_CB_ID
  );

  // Get treasury from ORAO network state
  // NetworkState layout: discriminator(8) + bump(1) + config.authority(32) + config.treasury(32)...
  // So treasury is at offset 8 + 1 + 32 = 41
  const networkStateData = await connection.getAccountInfo(oraoNetworkStatePda);
  if (!networkStateData) {
    console.error("ORAO Network State not found!");
    return;
  }
  const oraoTreasury = new PublicKey(networkStateData.data.slice(41, 73));
  console.log("ORAO Treasury:", oraoTreasury.toBase58());

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

  console.log("\n=== PDAs ===");
  console.log("VRF Client State:", vrfClientStatePda.toBase58());
  console.log("Mint Request:", mintRequestPda.toBase58());
  console.log("NFT Asset:", nftAssetPda.toBase58());
  console.log("VRF Request:", vrfRequestPda.toBase58());
  console.log("ORAO Client:", oraoClientPda.toBase58());
  console.log("Creator:", creator.toBase58());
  console.log("Treasury:", treasury.toBase58());
  console.log("Collection Asset:", collectionAsset.toBase58());
  console.log("Mint Price:", mintPrice.toString(), "lamports");

  console.log("\n=== Requesting ORAO VRF Mint ===");

  try {
    // Check if there's already a pending request
    const existingRequest = await connection.getAccountInfo(mintRequestPda);
    if (existingRequest) {
      console.log("Pending mint request already exists!");
      console.log("You can cancel it with: npx tsx scripts/cancel-orao-mint.ts");
      return;
    }

    const tx = await (program.methods as any)
      .oraoRequestMint(Array.from(vrfSeed))
      .accounts({
        ecosystemConfig: ecosystemConfigPda,
        content: contentPda,
        mintConfig: mintConfigPda,
        mintRequest: mintRequestPda,
        contentRewardPool: contentRewardPoolPda,
        contentCollection: contentCollectionPda,
        vrfClientState: vrfClientStatePda,
        oraoClient: oraoClientPda,
        oraoNetworkState: oraoNetworkStatePda,
        oraoTreasury: oraoTreasury,
        vrfRequest: vrfRequestPda,
        oraoVrfProgram: ORAO_VRF_CB_ID,
        collectionAsset: collectionAsset,
        buyerWalletState: buyerWalletStatePda,
        nftAsset: nftAssetPda,
        nftRewardState: nftRewardStatePda,
        nftRarity: nftRarityPda,
        creator: creator,
        treasury: treasury,
        platform: null, // Optional platform wallet
        payer: wallet.publicKey,
        mplCoreProgram: MPL_CORE_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([wallet])
      .rpc();

    console.log("✅ ORAO Request Mint TX:", tx);
    console.log("\nWaiting for oracle callback...");
    console.log("The oracle will call orao_fulfill_mint to complete the NFT mint.");
    console.log("\nYou can check the status with:");
    console.log(`  solana account ${mintRequestPda.toBase58()} --url devnet`);

    // Poll for fulfillment
    console.log("\nPolling for fulfillment (timeout: 2 minutes)...");
    const startTime = Date.now();
    const timeout = 120000; // 2 minutes

    while (Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

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
        const requestData = await (program.account as any).oraoMintRequest.fetch(mintRequestPda);
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

  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    if (error.logs) {
      console.error("\nLogs:");
      error.logs.forEach((log: string) => console.error("  ", log));
    }
  }
}

main().catch(console.error);
