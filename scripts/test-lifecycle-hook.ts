import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction, SystemProgram } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import {
  createContentRegistryClient,
  getContentPda,
  getWalletContentStatePda,
  getContentRewardPoolPda,
  getContentCollectionPda,
  getEcosystemConfigPda,
  ContentType,
  PROGRAM_ID,
  MPL_CORE_PROGRAM_ID,
} from "@handcraft/sdk";

const RPC_URL = "https://api.devnet.solana.com";

async function main() {
  const connection = new Connection(RPC_URL, "confirmed");
  const client = createContentRegistryClient(connection);

  // Load wallet
  const keypairPath = path.join(process.env.HOME!, ".config/solana/id.json");
  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(new Uint8Array(secretKey));
  console.log("Wallet:", wallet.publicKey.toBase58());

  // Check balance
  const balance = await connection.getBalance(wallet.publicKey);
  console.log("Balance:", balance / 1e9, "SOL");

  if (balance < 0.5 * 1e9) {
    console.error("Insufficient balance. Need at least 0.5 SOL");
    return;
  }

  // Create a receiver wallet for testing
  const receiver = Keypair.generate();
  console.log("Receiver:", receiver.publicKey.toBase58());

  // Fund receiver with some SOL for rent
  console.log("\nFunding receiver...");
  const fundTx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: receiver.publicKey,
      lamports: 0.1 * 1e9, // 0.1 SOL
    })
  );
  await sendAndConfirmTransaction(connection, fundTx, [wallet]);
  console.log("Funded receiver with 0.1 SOL");

  // Fetch treasury from ecosystem config
  const ecosystemData = await client.fetchEcosystemConfig();
  if (!ecosystemData) {
    console.error("Ecosystem not initialized!");
    return;
  }
  const treasury = ecosystemData.treasury;
  console.log("Treasury:", treasury.toBase58());

  // Step 1: Register content with mint config (creates Collection with LinkedLifecycleHook)
  const contentCid = `test-collection-${Date.now()}`;
  const metadataCid = "QmTestMetadata123";
  const previewCid = "QmTestPreview123";

  console.log("\n--- Step 1: Registering content with Collection + LinkedLifecycleHook ---");
  console.log("Content CID:", contentCid);

  const [contentPda] = getContentPda(contentCid);
  const [contentCollectionPda] = getContentCollectionPda(contentPda);

  // registerContentWithMintInstruction now returns { instruction, collectionAssetKeypair }
  const { instruction: registerIx, collectionAssetKeypair } = await client.registerContentWithMintInstruction(
    wallet.publicKey,
    contentCid,
    metadataCid,
    ContentType.GeneralImage,
    BigInt(0.01 * 1e9), // 0.01 SOL
    null, // unlimited supply
    500, // 5% royalty
    false,
    previewCid,
    ""
  );

  console.log("Collection Asset Keypair:", collectionAssetKeypair.publicKey.toBase58());

  const registerTx = new Transaction().add(registerIx);
  registerTx.feePayer = wallet.publicKey;
  registerTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  registerTx.partialSign(collectionAssetKeypair);

  try {
    const registerSig = await sendAndConfirmTransaction(connection, registerTx, [wallet, collectionAssetKeypair]);
    console.log("Registered content with collection:", registerSig);
  } catch (err: any) {
    console.error("Registration failed:", err.message);
    if (err.logs) {
      console.error("Logs:", err.logs);
    }
    return;
  }

  // Verify collection was created
  const contentCollection = await client.fetchContentCollection(contentCid);
  if (contentCollection) {
    console.log("ContentCollection created:");
    console.log("  - Content:", contentCollection.content.toBase58());
    console.log("  - Collection Asset:", contentCollection.collectionAsset.toBase58());
    console.log("  - Creator:", contentCollection.creator.toBase58());
  } else {
    console.error("ContentCollection not found!");
    return;
  }

  // Step 2: Mint NFT (added to collection, inherits LinkedLifecycleHook)
  console.log("\n--- Step 2: Minting NFT into collection ---");

  const { instruction: mintIx, nftAssetKeypair } = await client.mintNftSolInstruction(
    wallet.publicKey,
    contentCid,
    wallet.publicKey, // creator
    treasury,
    treasury, // platform = treasury for test
    contentCollection.collectionAsset // collection asset
  );

  console.log("NFT Asset Keypair:", nftAssetKeypair.publicKey.toBase58());

  const mintTx = new Transaction().add(mintIx);
  mintTx.feePayer = wallet.publicKey;
  mintTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  mintTx.partialSign(nftAssetKeypair);

  try {
    const mintSig = await sendAndConfirmTransaction(connection, mintTx, [wallet, nftAssetKeypair]);
    console.log("Minted NFT:", mintSig);
  } catch (err: any) {
    console.error("Minting failed:", err.message);
    if (err.logs) {
      console.error("Logs:", err.logs);
    }
    return;
  }

  // Check wallet state after mint
  const walletStateAfterMint = await client.fetchWalletContentState(wallet.publicKey, contentCid);
  console.log("Wallet state after mint:", {
    nftCount: walletStateAfterMint?.nftCount.toString(),
    rewardDebt: walletStateAfterMint?.rewardDebt.toString(),
  });

  // Step 3: Transfer NFT to receiver using Metaplex Core transfer
  // The LinkedLifecycleHook on the collection should trigger automatically
  console.log("\n--- Step 3: Transferring NFT (LinkedLifecycleHook should trigger) ---");

  // Build transfer instruction using Metaplex Core TransferV1
  const TRANSFER_V1_DISCRIMINATOR = 14;
  const transferData = Buffer.alloc(2);
  transferData.writeUInt8(TRANSFER_V1_DISCRIMINATOR, 0);
  transferData.writeUInt8(0, 1); // CompressionProof: None

  // Get the extra accounts for the lifecycle hook
  const [contentRewardPool] = getContentRewardPoolPda(contentPda);
  const [senderWalletState] = getWalletContentStatePda(wallet.publicKey, contentPda);
  const [receiverWalletState] = getWalletContentStatePda(receiver.publicKey, contentPda);

  // TransferV1 with collection and lifecycle hook
  const transferIx = {
    programId: MPL_CORE_PROGRAM_ID,
    keys: [
      { pubkey: nftAssetKeypair.publicKey, isSigner: false, isWritable: true }, // asset
      { pubkey: contentCollection.collectionAsset, isSigner: false, isWritable: false }, // collection
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true }, // payer
      { pubkey: wallet.publicKey, isSigner: true, isWritable: false }, // authority (owner)
      { pubkey: receiver.publicKey, isSigner: false, isWritable: false }, // newOwner
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // systemProgram
      // LinkedLifecycleHook extra accounts (resolved by Metaplex Core from collection plugin)
      { pubkey: PROGRAM_ID, isSigner: false, isWritable: false }, // hooked program
      { pubkey: contentRewardPool, isSigner: false, isWritable: true }, // extra account 1
      { pubkey: senderWalletState, isSigner: false, isWritable: true }, // extra account 2
      { pubkey: receiverWalletState, isSigner: false, isWritable: true }, // extra account 3
    ],
    data: transferData,
  };

  const transferTx = new Transaction().add(transferIx);

  try {
    const transferSig = await sendAndConfirmTransaction(connection, transferTx, [wallet]);
    console.log("Transfer successful:", transferSig);
    console.log("LinkedLifecycleHook should have been triggered!");
  } catch (err: any) {
    console.log("Transfer error:", err.message);
    if (err.logs) {
      // Check if it's the "Feature not available" error
      const notAvailableLog = err.logs.find((log: string) => log.includes("NotAvailable") || log.includes("0x17"));
      if (notAvailableLog) {
        console.log("\n⚠️  LinkedLifecycleHook feature is not available on devnet yet.");
        console.log("The collection was created with the hook, but transfers won't trigger it.");
      } else {
        console.log("Logs:", err.logs.slice(-10));
      }
    }
  }

  // Step 4: Check wallet states after transfer
  console.log("\n--- Step 4: Checking wallet states ---");

  // Wait a bit for state to update
  await new Promise(resolve => setTimeout(resolve, 2000));

  const senderStateAfter = await client.fetchWalletContentState(wallet.publicKey, contentCid);
  const receiverStateAfter = await client.fetchWalletContentState(receiver.publicKey, contentCid);

  console.log("Sender wallet state:", {
    nftCount: senderStateAfter?.nftCount.toString() ?? "not found",
    rewardDebt: senderStateAfter?.rewardDebt.toString() ?? "not found",
  });

  console.log("Receiver wallet state:", {
    nftCount: receiverStateAfter?.nftCount.toString() ?? "not found",
    rewardDebt: receiverStateAfter?.rewardDebt.toString() ?? "not found",
  });

  // Check if lifecycle hook updated the states
  if (receiverStateAfter && receiverStateAfter.nftCount > 0) {
    console.log("\n✅ LinkedLifecycleHook worked! Receiver's NFT count was updated automatically.");
  } else {
    console.log("\n⚠️  Receiver's wallet state was not updated. LinkedLifecycleHook may not have triggered.");
    console.log("This is expected if the feature is not available on devnet.");
  }

  console.log("\n--- Test Complete ---");
}

main().catch(console.error);
