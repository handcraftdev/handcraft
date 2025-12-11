import { Connection, Transaction, PublicKey } from "@solana/web3.js";

/**
 * Simulate a transaction before sending to wallet
 * Throws an error with a descriptive message if simulation fails
 */
export async function simulateTransaction(
  connection: Connection,
  tx: Transaction,
  feePayer: PublicKey
): Promise<void> {
  tx.feePayer = feePayer;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  const simulation = await connection.simulateTransaction(tx);

  if (simulation.value.err) {
    // Extract error details
    const logs = simulation.value.logs || [];
    const errorLog = logs.find(log =>
      log.includes("Error") ||
      log.includes("error") ||
      log.includes("failed")
    );

    // Check for specific error patterns
    if (logs.some(log => log.includes("already in use"))) {
      throw new Error("Account already exists - this content may already be registered");
    }
    if (logs.some(log => log.includes("CidAlreadyRegistered"))) {
      throw new Error("This content CID is already registered on-chain");
    }
    if (logs.some(log => log.includes("insufficient funds"))) {
      throw new Error("Insufficient funds for transaction");
    }

    throw new Error(
      errorLog ||
      `Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`
    );
  }
}

/**
 * Simulate a transaction that has already been partially signed
 * (e.g., by a keypair for a new account)
 */
export async function simulatePartiallySignedTransaction(
  connection: Connection,
  tx: Transaction
): Promise<void> {
  const simulation = await connection.simulateTransaction(tx);

  if (simulation.value.err) {
    const logs = simulation.value.logs || [];

    // Check for specific error patterns
    const insufficientLamportsLog = logs.find(log => log.includes("insufficient lamports"));
    if (insufficientLamportsLog) {
      // Parse "Transfer: insufficient lamports X, need Y" pattern
      const match = insufficientLamportsLog.match(/insufficient lamports (\d+), need (\d+)/);
      if (match) {
        const has = parseInt(match[1]) / 1e9;
        const need = parseInt(match[2]) / 1e9;
        throw new Error(`Insufficient balance. You have ${has.toFixed(3)} SOL but need ${need.toFixed(3)} SOL.`);
      }
      throw new Error("Insufficient balance for this transaction");
    }

    if (logs.some(log => log.includes("already in use"))) {
      throw new Error("Account already exists - please try again");
    }

    const errorLog = logs.find(log =>
      log.includes("Error") || log.includes("error") || log.includes("failed")
    );
    throw new Error(errorLog || `Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
  }
}
