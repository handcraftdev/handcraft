import { Connection, PublicKey } from '@solana/web3.js';
import { sha256 } from '@noble/hashes/sha256';

const PROGRAM_ID = new PublicKey('3kLBPNtsBwqwb9xZRims2HC5uCeT6rUG9AqpKQfq2Vdn');
const connection = new Connection('https://api.devnet.solana.com');

// Calculate Anchor discriminator for an account
function getDiscriminator(accountName: string): Buffer {
  const hash = sha256(`account:${accountName}`);
  return Buffer.from(hash.slice(0, 8));
}

async function test() {
  try {
    // Calculate expected discriminators
    const contentEntryDisc = getDiscriminator('ContentEntry');
    const cidRegistryDisc = getDiscriminator('CidRegistry');
    const mintConfigDisc = getDiscriminator('MintConfig');
    const ecosystemConfigDisc = getDiscriminator('EcosystemConfig');
    const contentRewardPoolDisc = getDiscriminator('ContentRewardPool');
    const nftRewardStateDisc = getDiscriminator('NftRewardState');
    const contentCollectionDisc = getDiscriminator('ContentCollection');

    console.log('Expected discriminators:');
    console.log('  ContentEntry:', contentEntryDisc.toString('hex'));
    console.log('  CidRegistry:', cidRegistryDisc.toString('hex'));
    console.log('  MintConfig:', mintConfigDisc.toString('hex'));
    console.log('  EcosystemConfig:', ecosystemConfigDisc.toString('hex'));
    console.log('  ContentRewardPool:', contentRewardPoolDisc.toString('hex'));
    console.log('  NftRewardState:', nftRewardStateDisc.toString('hex'));
    console.log('  ContentCollection:', contentCollectionDisc.toString('hex'));

    // Get full accounts
    console.log('\nFetching all program accounts...');
    const allAccounts = await connection.getProgramAccounts(PROGRAM_ID);

    console.log('Total accounts:', allAccounts.length);

    // Group by discriminator and size
    const byDiscriminator: Map<string, { count: number; sizes: number[] }> = new Map();

    for (const { pubkey, account } of allAccounts) {
      const disc = account.data.slice(0, 8).toString('hex');
      const size = account.data.length;

      const existing = byDiscriminator.get(disc) || { count: 0, sizes: [] };
      existing.count++;
      if (!existing.sizes.includes(size)) {
        existing.sizes.push(size);
      }
      byDiscriminator.set(disc, existing);
    }

    console.log('\nAccounts grouped by discriminator:');
    for (const [disc, info] of byDiscriminator) {
      let name = 'Unknown';
      if (disc === contentEntryDisc.toString('hex')) name = 'ContentEntry';
      else if (disc === cidRegistryDisc.toString('hex')) name = 'CidRegistry';
      else if (disc === mintConfigDisc.toString('hex')) name = 'MintConfig';
      else if (disc === ecosystemConfigDisc.toString('hex')) name = 'EcosystemConfig';
      else if (disc === contentRewardPoolDisc.toString('hex')) name = 'ContentRewardPool';
      else if (disc === nftRewardStateDisc.toString('hex')) name = 'NftRewardState';
      else if (disc === contentCollectionDisc.toString('hex')) name = 'ContentCollection';

      console.log(`  ${disc} (${name}): ${info.count} accounts, sizes: ${info.sizes.join(', ')}`);
    }

    // Show content entry accounts specifically
    console.log('\nContent entry accounts:');
    for (const { pubkey, account } of allAccounts) {
      const disc = account.data.slice(0, 8).toString('hex');
      if (disc === contentEntryDisc.toString('hex')) {
        console.log(`  ${pubkey.toBase58()}: ${account.data.length} bytes`);
      }
    }

  } catch (err: any) {
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);
  }
}
test();
