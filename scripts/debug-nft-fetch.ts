import { Connection, PublicKey } from "@solana/web3.js";
import { createContentRegistryClient } from "@handcraft/sdk";
import bs58 from "bs58";

async function main() {
  const connection = new Connection(
    "https://devnet.helius-rpc.com/?api-key=88ac54a3-8850-4686-a521-70d116779182",
    "confirmed"
  );

  const client = createContentRegistryClient(connection);

  // Test wallet - replace with your wallet address
  const walletAddress = process.argv[2];
  if (!walletAddress) {
    console.log("Usage: npx tsx scripts/debug-nft-fetch.ts <wallet_address>");
    process.exit(1);
  }

  const wallet = new PublicKey(walletAddress);

  console.log("\n=== Debugging NFT Fetch ===\n");
  console.log("Wallet:", wallet.toBase58());

  // 1. Fetch all content collections
  console.log("\n--- Fetching Content Collections ---");
  const collections = await client.fetchAllContentCollections();
  console.log("Total collections found:", collections.size);

  for (const [contentKey, collection] of collections) {
    console.log(`  Content PDA: ${contentKey}`);
    console.log(`    Collection Asset: ${collection.collectionAsset.toBase58()}`);
  }

  // 2. Fetch all content entries
  console.log("\n--- Fetching Content Entries ---");
  const globalContent = await client.fetchGlobalContent();
  console.log("Total content entries:", globalContent.length);

  for (const entry of globalContent.slice(0, 5)) {
    console.log(`  CID: ${entry.contentCid.slice(0, 20)}...`);
    console.log(`    Creator: ${entry.creator.toBase58()}`);
  }

  // 3. Fetch wallet NFT metadata
  console.log("\n--- Fetching Wallet NFT Metadata ---");
  const nfts = await client.fetchWalletNftMetadata(wallet);
  console.log("NFTs found for wallet:", nfts.length);

  for (const nft of nfts) {
    console.log(`  NFT Asset: ${nft.nftAsset.toBase58()}`);
    console.log(`    Content CID: ${nft.contentCid}`);
    console.log(`    Collection: ${nft.collectionAsset?.toBase58()}`);
    console.log(`    Name: ${nft.name}`);
  }

  // 3b. Check raw Metaplex Core assets for this wallet
  console.log("\n--- Raw Metaplex Core Assets (owned by wallet) ---");
  const MPL_CORE_PROGRAM_ID = new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");
  const rawAccounts = await connection.getProgramAccounts(MPL_CORE_PROGRAM_ID, {
    filters: [
      { memcmp: { offset: 1, bytes: wallet.toBase58() } },
    ],
  });
  console.log("Total raw Metaplex Core assets:", rawAccounts.length);

  for (const { pubkey, account } of rawAccounts.slice(0, 5)) {
    console.log(`  Asset: ${pubkey.toBase58()}`);
    const data = account.data;
    console.log(`    Data length: ${data.length}, First byte: ${data[0]}`);
    if (data.length >= 66) {
      const updateAuthorityType = data[33];
      console.log(`    Update authority type: ${updateAuthorityType}`);
      if (updateAuthorityType === 2) {
        const collectionBytes = data.slice(34, 66);
        const collectionAsset = new PublicKey(collectionBytes);
        console.log(`    Collection Asset: ${collectionAsset.toBase58()}`);
      }
    }
  }

  // 3c. Check all NftRarity accounts (VRF minted NFTs)
  console.log("\n--- All NftRarity Accounts (VRF minted NFTs) ---");
  const PROGRAM_ID = new PublicKey("3kLBPNtsBwqwb9xZRims2HC5uCeT6rUG9AqpKQfq2Vdn");
  // NftRarity discriminator - check IDL for exact bytes
  const nftRarityAccounts = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [
      // Filter by NftRarity discriminator - sha256("account:NftRarity")[0..8]
      { memcmp: { offset: 0, bytes: "A35xkpD7zK7" } }, // base58 for nft_rarity discriminator
    ],
  });
  console.log("Total NftRarity accounts:", nftRarityAccounts.length);

  // Try without discriminator filter
  const allProgramAccounts = await connection.getProgramAccounts(PROGRAM_ID, { dataSlice: { offset: 0, length: 16 } });
  console.log("Total program accounts:", allProgramAccounts.length);

  // Check ALL Metaplex Core NFTs that belong to any of our collections
  console.log("\n--- All Metaplex Core NFTs in our Collections ---");
  for (const [contentKey, collection] of collections) {
    const collectionNfts = await connection.getProgramAccounts(MPL_CORE_PROGRAM_ID, {
      filters: [
        { memcmp: { offset: 0, bytes: bs58.encode([1]) } }, // Asset discriminator
        { memcmp: { offset: 34, bytes: collection.collectionAsset.toBase58() } }, // Collection at offset 34
      ],
    });
    if (collectionNfts.length > 0) {
      console.log(`  Collection ${collection.collectionAsset.toBase58().slice(0, 16)}...`);
      for (const { pubkey, account } of collectionNfts.slice(0, 3)) {
        const owner = new PublicKey(account.data.slice(1, 33));
        console.log(`    NFT: ${pubkey.toBase58().slice(0, 20)}... Owner: ${owner.toBase58().slice(0, 16)}...`);
      }
      if (collectionNfts.length > 3) {
        console.log(`    ... and ${collectionNfts.length - 3} more`);
      }
    }
  }

  // 4. Check WalletContentState for this wallet
  console.log("\n--- Checking WalletContentState ---");
  for (const entry of globalContent.slice(0, 3)) {
    const count = await client.countNftsOwned(wallet, entry.contentCid);
    if (count > 0) {
      console.log(`  Content ${entry.contentCid.slice(0, 20)}...: ${count} NFTs owned`);
    }
  }

  // 5. Check NFT Rarities
  if (nfts.length > 0) {
    console.log("\n--- Checking NFT Rarities ---");
    const rarities = await client.fetchNftRaritiesBatch(nfts.map(n => n.nftAsset));
    console.log("Rarities found:", rarities.size);
    for (const [nftKey, rarity] of rarities) {
      console.log(`  ${nftKey.slice(0, 20)}...: Rarity ${rarity.rarity} (weight: ${rarity.weight})`);
    }
  }
}

main().catch(console.error);
