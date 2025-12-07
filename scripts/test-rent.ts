import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import { Program, AnchorProvider, Idl, BN, Wallet } from "@coral-xyz/anchor";
import {
  PROGRAM_ID,
  MPL_CORE_PROGRAM_ID,
  getContentPda,
  getEcosystemConfigPda,
  getRentConfigPda,
  getContentCollectionPda,
  getContentRewardPoolPda,
  getRentEntryPda,
} from "@handcraft/sdk";

// Load IDL
const idlPath = path.join(__dirname, "../packages/sdk/src/program/content_registry.json");
const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

async function main() {
  // Connect to devnet
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  // Load wallet from default Solana keypair
  const keypairPath = process.env.HOME + "/.config/solana/id.json";
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(keypairData));

  console.log("Wallet:", wallet.publicKey.toBase58());

  // Create program
  const provider = new AnchorProvider(
    connection,
    new Wallet(wallet),
    { commitment: "confirmed" }
  );
  const program = new Program(idl as Idl, PROGRAM_ID, provider);

  // You need to replace this with an actual content CID that has rent configured
  const contentCid = process.argv[2];
  if (!contentCid) {
    console.log("Usage: npx ts-node scripts/test-rent.ts <content-cid>");
    console.log("\nLet me find content with rent config...");

    // Try to find content with rent config by checking recent program accounts
    const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
      filters: [
        { dataSize: 8 + 32 + 32 + 8 + 8 + 8 + 1 + 8 + 8 + 8 + 8 } // RentConfig size approximation
      ]
    });

    console.log(`Found ${accounts.length} potential RentConfig accounts`);

    if (accounts.length > 0) {
      for (const acc of accounts.slice(0, 5)) {
        console.log("Account:", acc.pubkey.toBase58());
        try {
          const decoded = program.coder.accounts.decode("RentConfig", acc.account.data);
          console.log("  Content:", decoded.content.toBase58());
          console.log("  Creator:", decoded.creator.toBase58());
          console.log("  Active:", decoded.isActive);
          console.log("  Fee 6h:", decoded.rentFee6h?.toString());

          // Try to fetch the content to get CID
          const contentAccount = await connection.getAccountInfo(decoded.content);
          if (contentAccount) {
            const content = program.coder.accounts.decode("ContentEntry", contentAccount.data);
            console.log("  Content CID:", content.contentCid);
          }
        } catch (e) {
          // Not a RentConfig
        }
      }
    }
    return;
  }

  const [contentPda] = getContentPda(contentCid);
  const [ecosystemConfigPda] = getEcosystemConfigPda();
  const [rentConfigPda] = getRentConfigPda(contentPda);
  const [contentCollectionPda] = getContentCollectionPda(contentPda);
  const [contentRewardPoolPda] = getContentRewardPoolPda(contentPda);

  console.log("\nPDAs:");
  console.log("Content:", contentPda.toBase58());
  console.log("EcosystemConfig:", ecosystemConfigPda.toBase58());
  console.log("RentConfig:", rentConfigPda.toBase58());
  console.log("ContentCollection:", contentCollectionPda.toBase58());
  console.log("ContentRewardPool:", contentRewardPoolPda.toBase58());

  // Fetch content to get creator and collection asset
  const contentAccount = await connection.getAccountInfo(contentPda);
  if (!contentAccount) {
    console.log("Content not found!");
    return;
  }

  const content = program.coder.accounts.decode("ContentEntry", contentAccount.data);
  console.log("\nContent:");
  console.log("  Creator:", content.creator.toBase58());
  console.log("  ContentCid:", content.contentCid);

  // Fetch content collection to get collection asset
  const collectionAccount = await connection.getAccountInfo(contentCollectionPda);
  if (!collectionAccount) {
    console.log("ContentCollection not found!");
    return;
  }

  const contentCollection = program.coder.accounts.decode("ContentCollection", collectionAccount.data);
  console.log("\nContentCollection:");
  console.log("  CollectionAsset:", contentCollection.collectionAsset.toBase58());

  // Fetch rent config
  const rentConfigAccount = await connection.getAccountInfo(rentConfigPda);
  if (!rentConfigAccount) {
    console.log("RentConfig not found! Configure rent first.");
    return;
  }

  const rentConfig = program.coder.accounts.decode("RentConfig", rentConfigAccount.data);
  console.log("\nRentConfig:");
  console.log("  Active:", rentConfig.isActive);
  console.log("  Fee 6h:", rentConfig.rentFee6h?.toString());

  // Fetch ecosystem config
  const ecosystemAccount = await connection.getAccountInfo(ecosystemConfigPda);
  if (!ecosystemAccount) {
    console.log("EcosystemConfig not found!");
    return;
  }

  const ecosystem = program.coder.accounts.decode("EcosystemConfig", ecosystemAccount.data);
  console.log("\nEcosystemConfig:");
  console.log("  Treasury:", ecosystem.treasury.toBase58());

  // Generate NFT asset keypair
  const nftAssetKeypair = Keypair.generate();
  const [rentEntryPda] = getRentEntryPda(nftAssetKeypair.publicKey);

  console.log("\nNew NFT Asset:", nftAssetKeypair.publicKey.toBase58());
  console.log("RentEntry:", rentEntryPda.toBase58());

  // Build rent instruction
  const tier = { sixHours: {} }; // RentTier::SixHours

  console.log("\nBuilding rent instruction...");

  try {
    const ix = await program.methods
      .rentContentSol(tier)
      .accounts({
        ecosystemConfig: ecosystemConfigPda,
        content: contentPda,
        rentConfig: rentConfigPda,
        contentCollection: contentCollectionPda,
        collectionAsset: contentCollection.collectionAsset,
        contentRewardPool: contentRewardPoolPda,
        rentEntry: rentEntryPda,
        nftAsset: nftAssetKeypair.publicKey,
        creator: content.creator,
        platform: null, // Optional
        treasury: ecosystem.treasury,
        renter: wallet.publicKey,
        mplCoreProgram: MPL_CORE_PROGRAM_ID,
        systemProgram: new PublicKey("11111111111111111111111111111111"),
      })
      .instruction();

    console.log("Instruction built successfully");

    // Simulate transaction
    console.log("\nSimulating transaction...");

    const tx = new Transaction().add(ix);
    tx.feePayer = wallet.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.sign(wallet, nftAssetKeypair);

    const simulation = await connection.simulateTransaction(tx);

    console.log("\nSimulation result:");
    console.log("Error:", simulation.value.err);
    console.log("Logs:");
    simulation.value.logs?.forEach((log, i) => console.log(`  ${i}: ${log}`));

  } catch (e) {
    console.log("Error:", e);
  }
}

main().catch(console.error);
