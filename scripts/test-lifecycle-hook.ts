import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction, SystemProgram } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import {
  createContentRegistryClient,
  getContentPda,
  getWalletContentStatePda,
  getContentRewardPoolPda,
  getMintConfigPda,
  getEcosystemConfigPda,
  hashCid,
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

  // Create a receiver wallet for testing
  const receiver = Keypair.generate();
  console.log("Receiver:", receiver.publicKey.toBase58());

  // Fund receiver with some SOL for rent
  const fundTx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: receiver.publicKey,
      lamports: 0.1 * 1e9, // 0.1 SOL
    })
  );
  await sendAndConfirmTransaction(connection, fundTx, [wallet]);
  console.log("Funded receiver with 0.1 SOL");

  // Step 1: Register content with mint config
  const contentCid = `test-lifecycle-${Date.now()}`;
  const metadataCid = "QmTestMetadata123";
  const previewCid = "QmTestPreview123";

  console.log("\n--- Step 1: Registering content with mint config ---");
  console.log("Content CID:", contentCid);

  const [contentPda] = getContentPda(contentCid);
  const [ecosystemConfig] = getEcosystemConfigPda();

  // Fetch treasury from ecosystem config
  const ecosystemData = await client.fetchEcosystemConfig();
  if (!ecosystemData) {
    console.error("Ecosystem not initialized!");
    return;
  }
  const treasury = ecosystemData.treasury;
  console.log("Treasury:", treasury.toBase58());

  const registerIx = await client.registerContentWithMintInstruction(
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

  const registerTx = new Transaction().add(registerIx);
  const registerSig = await sendAndConfirmTransaction(connection, registerTx, [wallet]);
  console.log("Registered content:", registerSig);

  // Step 2: Mint NFT (this should include lifecycle hook)
  console.log("\n--- Step 2: Minting NFT with lifecycle hook ---");

  const { instruction: mintIx, nftAssetKeypair } = await client.mintNftSolInstruction(
    wallet.publicKey,
    contentCid,
    wallet.publicKey, // creator
    treasury,
    treasury // platform = treasury for test
  );

  const mintTx = new Transaction().add(mintIx);
  const mintSig = await sendAndConfirmTransaction(connection, mintTx, [wallet, nftAssetKeypair]);
  console.log("Minted NFT:", mintSig);
  console.log("NFT Asset:", nftAssetKeypair.publicKey.toBase58());

  // Check wallet state after mint
  const walletStateAfterMint = await client.fetchWalletContentState(wallet.publicKey, contentCid);
  console.log("Wallet state after mint:", {
    nftCount: walletStateAfterMint?.nftCount.toString(),
    rewardDebt: walletStateAfterMint?.rewardDebt.toString(),
  });

  // Step 3: Transfer NFT to receiver
  console.log("\n--- Step 3: Transferring NFT to receiver ---");

  // Build transfer instruction using Metaplex Core
  // TransferV1 discriminator is 14
  const TRANSFER_V1_DISCRIMINATOR = 14;
  const transferData = Buffer.alloc(2);
  transferData.writeUInt8(TRANSFER_V1_DISCRIMINATOR, 0);
  transferData.writeUInt8(0, 1); // CompressionProof: None

  // Get the extra accounts for the lifecycle hook
  const [contentRewardPool] = getContentRewardPoolPda(contentPda);
  const [senderWalletState] = getWalletContentStatePda(wallet.publicKey, contentPda);
  const [receiverWalletState] = getWalletContentStatePda(receiver.publicKey, contentPda);

  const transferIx = {
    programId: MPL_CORE_PROGRAM_ID,
    keys: [
      { pubkey: nftAssetKeypair.publicKey, isSigner: false, isWritable: true }, // asset
      { pubkey: MPL_CORE_PROGRAM_ID, isSigner: false, isWritable: false }, // collection (none)
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true }, // payer
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true }, // authority (owner)
      { pubkey: receiver.publicKey, isSigner: false, isWritable: false }, // newOwner
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // systemProgram
      { pubkey: MPL_CORE_PROGRAM_ID, isSigner: false, isWritable: false }, // logWrapper (none)
      // Lifecycle hook accounts (our program will be called)
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
  } catch (err: any) {
    console.log("Transfer error:", err.message);
    console.log("This might be expected if lifecycle hook account resolution differs");
  }

  // Step 4: Check wallet states after transfer
  console.log("\n--- Step 4: Checking wallet states after transfer ---");

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

  // Verify NFT ownership changed
  const nftAccounts = await connection.getProgramAccounts(MPL_CORE_PROGRAM_ID, {
    filters: [
      { memcmp: { offset: 0, bytes: "2" } }, // AssetV1
      { dataSize: 200 }, // Approximate size
    ],
  });

  for (const { pubkey, account } of nftAccounts) {
    if (pubkey.equals(nftAssetKeypair.publicKey)) {
      const ownerBytes = account.data.slice(1, 33);
      const owner = new PublicKey(ownerBytes);
      console.log("\nNFT current owner:", owner.toBase58());
      console.log("Expected receiver:", receiver.publicKey.toBase58());
      console.log("Ownership transferred:", owner.equals(receiver.publicKey));
    }
  }

  console.log("\n--- Test Complete ---");
}

main().catch(console.error);
