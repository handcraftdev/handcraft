import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";

// Load IDL from SDK (up to date)
const idlPath = path.join(__dirname, "../packages/sdk/src/program/content_registry.json");
const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));

// Program ID (from IDL)
const PROGRAM_ID = new PublicKey("3kLBPNtsBwqwb9xZRims2HC5uCeT6rUG9AqpKQfq2Vdn");
const ORAO_VRF_CB_ID = new PublicKey("VRFCBePmGTpZ234BhbzNNzmyg39Rgdd6VgdfhHwKypU");
const MPL_CORE_ID = new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");

// Seeds
const VRF_CLIENT_STATE_SEED = Buffer.from("vrf_client_state");
const CB_CLIENT_ACCOUNT_SEED = Buffer.from("OraoVrfCbClient");
const CB_REQUEST_ACCOUNT_SEED = Buffer.from("OraoVrfCbRequest");

// Manual decoder for OraoMintRequest to avoid Anchor version issues
// Layout: 8 byte discriminator + fields
// buyer: Pubkey (32)
// content: Pubkey (32)
// creator: Pubkey (32)
// amount_paid: u64 (8)
// created_at: i64 (8)
// had_existing_nfts: bool (1)
// bump: u8 (1)
// nft_bump: u8 (1)
// is_fulfilled: bool (1)
// platform: Pubkey (32)
// collection_asset: Pubkey (32)
// treasury: Pubkey (32)
// vrf_seed: [u8; 32] (32)
// content_collection_bump: u8 (1)
function decodeMintRequest(data: Buffer) {
  let offset = 8; // skip discriminator

  const buyer = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  const content = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  const creator = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  const amountPaid = data.readBigUInt64LE(offset);
  offset += 8;

  const createdAt = data.readBigInt64LE(offset);
  offset += 8;

  const hadExistingNfts = data[offset] !== 0;
  offset += 1;

  const bump = data[offset];
  offset += 1;

  const nftBump = data[offset];
  offset += 1;

  const isFulfilled = data[offset] !== 0;
  offset += 1;

  const platform = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  const collectionAsset = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  const treasury = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  const vrfSeed = data.subarray(offset, offset + 32);
  offset += 32;

  const contentCollectionBump = data[offset];

  return {
    buyer,
    content,
    creator,
    amountPaid,
    createdAt,
    hadExistingNfts,
    bump,
    nftBump,
    isFulfilled,
    platform,
    collectionAsset,
    treasury,
    vrfSeed,
    contentCollectionBump,
  };
}

async function main() {
  console.log("=== Complete ORAO Mint (Two-Phase) ===\n");

  // Setup connection
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  // Load wallet
  const keypairPath = process.env.HOME + "/.config/solana/id.json";
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf8"));
  const wallet = Keypair.fromSecretKey(new Uint8Array(keypairData));
  console.log("Wallet:", wallet.publicKey.toBase58());

  // Setup provider and program
  const provider = new AnchorProvider(
    connection,
    new Wallet(wallet),
    { commitment: "confirmed" }
  );
  const program = new Program(idl, provider);

  // Get mint request PDA from command line or use known one
  const mintRequestArg = process.argv[2];
  const mintRequestPda = mintRequestArg
    ? new PublicKey(mintRequestArg)
    : new PublicKey("NN53QrfkS7FvreNGPTbmfdeG4c4fSVjYpvFiyk7pYoA");

  // Check if mint request exists
  const mintRequestInfo = await connection.getAccountInfo(mintRequestPda);
  if (!mintRequestInfo) {
    console.log("No pending mint request found at:", mintRequestPda.toBase58());
    return;
  }

  // Decode mint request manually
  const mintRequest = decodeMintRequest(Buffer.from(mintRequestInfo.data));
  console.log("Mint Request:", mintRequestPda.toBase58());
  console.log("  is_fulfilled:", mintRequest.isFulfilled);
  console.log("  vrf_seed:", Buffer.from(mintRequest.vrfSeed).toString("hex"));
  console.log("  content:", mintRequest.content.toBase58());
  console.log("  buyer:", mintRequest.buyer.toBase58());
  console.log("  creator:", mintRequest.creator.toBase58());
  console.log("  treasury:", mintRequest.treasury.toBase58());
  console.log("  platform:", mintRequest.platform.toBase58());
  console.log("  collection_asset:", mintRequest.collectionAsset.toBase58());

  // Get content PDA from mint request
  const contentPda = mintRequest.content;

  if (mintRequest.isFulfilled) {
    console.log("\nMint already fulfilled!");
    return;
  }

  // Derive VRF Client State
  const [vrfClientState] = PublicKey.findProgramAddressSync(
    [VRF_CLIENT_STATE_SEED],
    PROGRAM_ID
  );

  // Derive ORAO Client
  const [oraoClient] = PublicKey.findProgramAddressSync(
    [CB_CLIENT_ACCOUNT_SEED, PROGRAM_ID.toBuffer(), vrfClientState.toBuffer()],
    ORAO_VRF_CB_ID
  );

  // Derive VRF Request using the stored seed
  const [vrfRequest] = PublicKey.findProgramAddressSync(
    [CB_REQUEST_ACCOUNT_SEED, oraoClient.toBuffer(), mintRequest.vrfSeed],
    ORAO_VRF_CB_ID
  );

  console.log("\nVRF Client State:", vrfClientState.toBase58());
  console.log("ORAO Client:", oraoClient.toBase58());
  console.log("VRF Request:", vrfRequest.toBase58());

  // Check VRF request status
  const vrfRequestInfo = await connection.getAccountInfo(vrfRequest);
  if (!vrfRequestInfo) {
    console.log("VRF Request account not found!");
    return;
  }

  console.log("VRF Request size:", vrfRequestInfo.data.length, "bytes");

  // ORAO RequestAccount layout:
  // 8 bytes: discriminator
  // 1 byte: bump
  // 8 bytes: slot
  // 32 bytes: client
  // 32 bytes: seed
  // variable: state (RequestState enum)
  // STATE_OFFSET = 8 + 1 + 8 + 32 + 32 = 81
  const stateOffset = 8 + 1 + 8 + 32 + 32; // = 81
  const stateDiscriminator = vrfRequestInfo.data[stateOffset];
  console.log("VRF State discriminator:", stateDiscriminator, "(0=Pending, 1=Fulfilled)");

  if (stateDiscriminator !== 1) {
    console.log("VRF not yet fulfilled (still pending)");
    // Check responses count
    const responsesLen = vrfRequestInfo.data.readUInt32LE(stateOffset + 1);
    console.log("Responses collected:", responsesLen);
    return;
  }

  console.log("VRF is fulfilled!");
  // Fulfilled state has 64 bytes of randomness
  const randomness = vrfRequestInfo.data.subarray(stateOffset + 1, stateOffset + 1 + 64);
  console.log("Randomness (64 bytes):", Buffer.from(randomness).toString("hex"));
  console.log("First 32 bytes (for rarity):", Buffer.from(randomness.subarray(0, 32)).toString("hex"));

  // Derive other PDAs
  const [nftAsset] = PublicKey.findProgramAddressSync(
    [Buffer.from("orao_nft"), mintRequestPda.toBuffer()],
    PROGRAM_ID
  );

  const [nftRewardState] = PublicKey.findProgramAddressSync(
    [Buffer.from("nft_reward"), nftAsset.toBuffer()],  // NOTE: uses "nft_reward" not "nft_reward_state"
    PROGRAM_ID
  );

  const [nftRarity] = PublicKey.findProgramAddressSync(
    [Buffer.from("nft_rarity"), nftAsset.toBuffer()],
    PROGRAM_ID
  );

  const [ecosystemConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("ecosystem")],  // NOTE: uses "ecosystem" not "ecosystem_config"
    PROGRAM_ID
  );

  const [mintConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("mint_config"), contentPda.toBuffer()],
    PROGRAM_ID
  );

  const [contentRewardPool] = PublicKey.findProgramAddressSync(
    [Buffer.from("content_reward_pool"), contentPda.toBuffer()],
    PROGRAM_ID
  );

  const [contentCollection] = PublicKey.findProgramAddressSync(
    [Buffer.from("content_collection"), contentPda.toBuffer()],
    PROGRAM_ID
  );

  const [buyerWalletState] = PublicKey.findProgramAddressSync(
    [Buffer.from("wallet_content"), mintRequest.buyer.toBuffer(), contentPda.toBuffer()],  // NOTE: uses "wallet_content" not "wallet_content_state"
    PROGRAM_ID
  );

  console.log("\n=== Completing mint ===");
  console.log("NFT Asset:", nftAsset.toBase58());

  try {
    const tx = await program.methods
      .oraoCompleteMint()
      .accounts({
        payer: wallet.publicKey,
        ecosystemConfig,
        content: contentPda,
        mintConfig,
        mintRequest: mintRequestPda,
        contentRewardPool,
        contentCollection,
        collectionAsset: mintRequest.collectionAsset,
        buyerWalletState,
        nftAsset,
        nftRewardState,
        nftRarity,
        creator: mintRequest.creator,
        buyer: mintRequest.buyer,
        treasury: mintRequest.treasury,
        platform: mintRequest.platform,
        vrfRequest,
        mplCoreProgram: MPL_CORE_ID,
        systemProgram: PublicKey.default,
      })
      .rpc();

    console.log("\n Mint completed! TX:", tx);
    console.log("NFT Asset:", nftAsset.toBase58());
  } catch (e: any) {
    console.error("\n Failed to complete mint:", e.message);
    if (e.logs) {
      console.log("\nProgram logs:");
      e.logs.forEach((log: string) => console.log("  ", log));
    }
  }
}

main().catch(console.error);
