import { PublicKey, Connection } from "@solana/web3.js";

async function main() {
  const SRS_PROGRAM_ID = new PublicKey("RANDMo5gFnqnXJW5Z52KNmd24sAo95KAd5VbiCtq5Rh");
  const [statePda] = PublicKey.findProgramAddressSync([Buffer.from("STATE")], SRS_PROGRAM_ID);
  console.log("SRS State PDA:", statePda.toBase58());
  
  const connection = new Connection("https://api.devnet.solana.com");
  
  const programInfo = await connection.getAccountInfo(SRS_PROGRAM_ID);
  if (programInfo) {
    console.log("✓ SRS Program deployed");
  } else {
    console.log("✗ SRS Program NOT deployed on devnet!");
    return;
  }
  
  const info = await connection.getAccountInfo(statePda);
  if (info) {
    console.log("✓ SRS State exists");
    console.log("  Owner:", info.owner.toBase58());
  } else {
    console.log("✗ SRS State does NOT exist - SRS not initialized!");
  }
}
main().catch(console.error);
