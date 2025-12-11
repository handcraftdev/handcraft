import { Connection, PublicKey, Keypair, Transaction } from "@solana/web3.js";
import { NATIVE_MINT, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { createProgram, getContentPda, getSrsMintRequestPda, getSrsNftAssetPda, getEcosystemConfigPda, getMintConfigPda, getContentRewardPoolPda, getContentCollectionPda, getWalletContentStatePda, getNftRewardStatePda, getNftRarityPda, fetchContentCollection, SRS_PROGRAM_ID } from "../packages/sdk/src/program";
import * as fs from "fs";
import * as path from "path";

const WALLET_PATH = process.argv[2] || "~/.config/solana/id.json";
const CONTENT_CID = process.argv[3] || "QmNRhV3uUg4Thq7JibXQynJy6Pt38tw6kn8GQg4emL2mnc";

async function main() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  // Load wallet
  const resolvedPath = WALLET_PATH.replace("~", process.env.HOME || "");
  const keypairData = JSON.parse(fs.readFileSync(path.resolve(resolvedPath), "utf-8"));
  const wallet = Keypair.fromSecretKey(new Uint8Array(keypairData));

  console.log("=== SRS Debug Test ===\n");
  console.log("Wallet:", wallet.publicKey.toBase58());
  console.log("Content CID:", CONTENT_CID);

  const program = createProgram(connection);

  // Derive all PDAs
  const [contentPda] = getContentPda(CONTENT_CID);
  const [mintConfigPda] = getMintConfigPda(contentPda);
  const [ecosystemConfigPda] = getEcosystemConfigPda();
  const [contentRewardPoolPda] = getContentRewardPoolPda(contentPda);
  const [contentCollectionPda] = getContentCollectionPda(contentPda);
  const [mintRequestPda] = getSrsMintRequestPda(wallet.publicKey, contentPda);
  const [nftAssetPda] = getSrsNftAssetPda(mintRequestPda);
  const [srsStatePda] = PublicKey.findProgramAddressSync([Buffer.from("STATE")], SRS_PROGRAM_ID);
  const [buyerWalletStatePda] = getWalletContentStatePda(wallet.publicKey, contentPda);
  const [nftRewardStatePda] = getNftRewardStatePda(nftAssetPda);
  const [nftRarityPda] = getNftRarityPda(nftAssetPda);

  console.log("\n=== PDAs ===");
  console.log("Content:", contentPda.toBase58());
  console.log("Mint Request:", mintRequestPda.toBase58());
  console.log("NFT Asset:", nftAssetPda.toBase58());
  console.log("SRS State:", srsStatePda.toBase58());

  // Check if content exists
  const contentInfo = await connection.getAccountInfo(contentPda);
  if (!contentInfo) {
    console.log("\n❌ Content does not exist!");
    return;
  }

  // Fetch content data
  const content = await (program.account as any).contentEntry.fetch(contentPda);
  console.log("\n=== Content ===");
  console.log("Creator:", content.creator.toBase58());
  console.log("Minted Count:", content.mintedCount);

  // Check mint config
  const mintConfig = await (program.account as any).mintConfig.fetch(mintConfigPda);
  console.log("\n=== Mint Config ===");
  console.log("Price:", Number(mintConfig.price) / 1e9, "SOL");
  console.log("Is Active:", mintConfig.isActive);

  // Check if there's already a pending request
  const existingRequest = await connection.getAccountInfo(mintRequestPda);
  if (existingRequest) {
    console.log("\n⚠️  Pending mint request already exists!");
    const request = await (program.account as any).srsMintRequest.fetch(mintRequestPda);
    console.log("  Is Fulfilled:", request.isFulfilled);
    console.log("  Created At:", new Date(Number(request.createdAt) * 1000).toISOString());
    console.log("  Amount Paid:", Number(request.amountPaid) / 1e9, "SOL");
    return;
  }

  // Fetch collection
  const contentCollection = await fetchContentCollection(connection, CONTENT_CID);
  if (!contentCollection) {
    console.log("\n❌ Content collection not found!");
    return;
  }
  console.log("\n=== Collection ===");
  console.log("Collection Asset:", contentCollection.collectionAsset.toBase58());

  // Fetch ecosystem config
  const ecosystemConfig = await (program.account as any).ecosystemConfig.fetch(ecosystemConfigPda);
  console.log("\n=== Ecosystem ===");
  console.log("Treasury:", ecosystemConfig.treasury.toBase58());

  // Check SRS state
  const srsStateInfo = await connection.getAccountInfo(srsStatePda);
  if (!srsStateInfo) {
    console.log("\n❌ SRS State does not exist! SRS may not be initialized on devnet.");
    return;
  }
  console.log("\n=== SRS State ===");
  console.log("Exists:", true);
  console.log("Owner:", srsStateInfo.owner.toBase58());
  console.log("Data Length:", srsStateInfo.data.length);

  // Generate randomness request keypair
  const randomnessRequestKeypair = Keypair.generate();
  const randomnessEscrow = getAssociatedTokenAddressSync(
    NATIVE_MINT,
    randomnessRequestKeypair.publicKey,
    true
  );

  console.log("\n=== Randomness Request ===");
  console.log("Keypair:", randomnessRequestKeypair.publicKey.toBase58());
  console.log("Escrow:", randomnessEscrow.toBase58());

  // Build instruction
  console.log("\n=== Building Transaction ===");

  try {
    const instruction = await program.methods
      .srsRequestMint()
      .accounts({
        ecosystemConfig: ecosystemConfigPda,
        content: contentPda,
        mintConfig: mintConfigPda,
        mintRequest: mintRequestPda,
        contentRewardPool: contentRewardPoolPda,
        contentCollection: contentCollectionPda,
        collectionAsset: contentCollection.collectionAsset,
        creator: content.creator,
        treasury: ecosystemConfig.treasury,
        platform: ecosystemConfig.treasury,
        buyerWalletState: buyerWalletStatePda,
        nftAsset: nftAssetPda,
        nftRewardState: nftRewardStatePda,
        nftRarity: nftRarityPda,
        srsProgram: SRS_PROGRAM_ID,
        randomnessRequest: randomnessRequestKeypair.publicKey,
        randomnessEscrow: randomnessEscrow,
        srsState: srsStatePda,
        nativeMint: NATIVE_MINT,
        payer: wallet.publicKey,
        systemProgram: new PublicKey("11111111111111111111111111111111"),
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .instruction();

    console.log("✓ Instruction built");

    const tx = new Transaction().add(instruction);
    tx.feePayer = wallet.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.partialSign(randomnessRequestKeypair);

    console.log("\n=== Simulating Transaction ===");
    const simulation = await connection.simulateTransaction(tx);

    if (simulation.value.err) {
      console.log("\n❌ Simulation FAILED:");
      console.log("Error:", JSON.stringify(simulation.value.err, null, 2));
    } else {
      console.log("✓ Simulation succeeded");
      console.log("Units consumed:", simulation.value.unitsConsumed);
    }

    console.log("\n=== Simulation Logs ===");
    simulation.value.logs?.forEach((log, i) => {
      // Highlight errors
      if (log.toLowerCase().includes("error") || log.toLowerCase().includes("failed")) {
        console.log(`❌ ${log}`);
      } else if (log.includes("Program log:")) {
        console.log(`   ${log}`);
      } else {
        console.log(`   ${log}`);
      }
    });

    // If simulation passed, ask to send
    if (!simulation.value.err) {
      console.log("\n=== Sending Transaction ===");
      tx.sign(wallet);
      const sig = await connection.sendTransaction(tx, [wallet, randomnessRequestKeypair], {
        skipPreflight: false,
      });
      console.log("Signature:", sig);

      console.log("Waiting for confirmation...");
      await connection.confirmTransaction(sig, "confirmed");
      console.log("✓ Confirmed!");

      // Now monitor the randomness request
      console.log("\n=== Monitoring for Oracle Response ===");
      console.log("Waiting up to 2 minutes for oracle callback...\n");

      const startTime = Date.now();
      const maxWait = 120000; // 2 minutes
      let fulfilled = false;

      while (Date.now() - startTime < maxWait && !fulfilled) {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);

        // Check mint request status
        try {
          const requestInfo = await connection.getAccountInfo(mintRequestPda);
          if (!requestInfo) {
            console.log(`[${elapsed}s] Mint request closed - checking if fulfilled...`);
            // Check if NFT was created
            const nftInfo = await connection.getAccountInfo(nftAssetPda);
            if (nftInfo) {
              console.log("✓ NFT was created! Oracle callback succeeded.");
              fulfilled = true;
            }
            break;
          }

          const request = await (program.account as any).srsMintRequest.fetch(mintRequestPda);
          if (request.isFulfilled) {
            console.log(`[${elapsed}s] ✓ Request fulfilled!`);
            fulfilled = true;
            break;
          }

          // Check randomness request account for any error data
          const randomnessInfo = await connection.getAccountInfo(randomnessRequestKeypair.publicKey);
          if (randomnessInfo) {
            console.log(`[${elapsed}s] Randomness request exists (${randomnessInfo.data.length} bytes). Waiting...`);
          } else {
            console.log(`[${elapsed}s] Randomness request account closed. Checking callback...`);
          }
        } catch (err) {
          console.log(`[${elapsed}s] Error checking status:`, err);
        }

        await new Promise(r => setTimeout(r, 5000)); // Check every 5 seconds
      }

      if (!fulfilled) {
        console.log("\n⚠️  Oracle did not respond within 2 minutes.");
        console.log("Check the SRS explorer or try again later.");
      }
    }

  } catch (err) {
    console.log("\n❌ Error:", err);
  }
}

main().catch(console.error);
