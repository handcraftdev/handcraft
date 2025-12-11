import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { createContentRegistryClient, getContentPda, getMbMintRequestPda } from '../packages/sdk/src/program/index.js';
import fs from 'fs';
import path from 'path';

async function main() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

  // Load wallet from keypair file
  const keypairPath = path.join(process.env.HOME!, '.config/solana/id.json');
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
  const wallet = new Wallet(keypair);

  const provider = new AnchorProvider(connection, wallet, {});
  const client = createContentRegistryClient(provider);

  // The content CID from the user's test
  const contentCid = 'bafkreiaudp6hgzxyzu6nwwxlnqefxpz52eutmzgz7a55yryahtfsllpvry';
  const [contentPda] = getContentPda(contentCid);
  const [mintRequestPda] = getMbMintRequestPda(wallet.publicKey, contentPda);

  console.log('Wallet:', wallet.publicKey.toBase58());
  console.log('Content PDA:', contentPda.toBase58());
  console.log('Mint Request PDA:', mintRequestPda.toBase58());

  try {
    const request = await client.fetchMbMintRequest(wallet.publicKey, contentCid);
    if (request) {
      console.log('\nFound mint request:');
      console.log('  - Is Fulfilled:', request.isFulfilled);
      console.log('  - Created At:', new Date(Number(request.createdAt) * 1000).toISOString());
      console.log('  - Amount Paid:', request.amountPaid.toString());
      console.log('  - Buyer:', request.buyer.toBase58());
      console.log('  - Content:', request.content.toBase58());
    } else {
      console.log('\nNo mint request found (account does not exist)');
    }
  } catch (e: any) {
    if (e.message?.includes('Account does not exist')) {
      console.log('\nNo mint request account exists - ready for new mint');
    } else {
      console.log('\nError fetching mint request:', e.message);
    }
  }

  // Check the account directly
  console.log('\n--- Direct account check ---');
  const accountInfo = await connection.getAccountInfo(mintRequestPda);
  if (accountInfo) {
    console.log('Account exists with', accountInfo.data.length, 'bytes');
    console.log('Owner:', accountInfo.owner.toBase58());
  } else {
    console.log('Account does not exist on chain');
  }
}

main().catch(console.error);
