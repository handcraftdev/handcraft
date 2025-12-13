import { Connection, Transaction, VersionedTransaction, VersionedMessage, MessageV0 } from "@solana/web3.js";

export interface TransactionError {
  message: string;
  logs?: string[];
  code?: string;
}

/**
 * Simulate a transaction and return detailed error information if it fails.
 */
export async function simulateTransaction(
  connection: Connection,
  transaction: Transaction | VersionedTransaction
): Promise<{ success: boolean; error?: TransactionError; logs?: string[] }> {
  try {
    let result;

    if (transaction instanceof Transaction) {
      result = await connection.simulateTransaction(transaction);
    } else {
      result = await connection.simulateTransaction(transaction);
    }

    if (result.value.err) {
      // Parse the error
      const error = parseSimulationError(result.value.err, result.value.logs || []);
      return {
        success: false,
        error,
        logs: result.value.logs || [],
      };
    }

    return {
      success: true,
      logs: result.value.logs || [],
    };
  } catch (err: any) {
    return {
      success: false,
      error: {
        message: err.message || "Simulation failed",
      },
    };
  }
}

/**
 * Parse simulation error into a human-readable format.
 */
function parseSimulationError(err: any, logs: string[]): TransactionError {
  // Check for common error patterns in logs
  const errorLog = logs.find(log =>
    log.includes("Error") ||
    log.includes("failed") ||
    log.includes("insufficient")
  );

  // Check for instruction errors
  if (typeof err === "object" && err !== null) {
    if ("InstructionError" in err) {
      const [index, instructionError] = err.InstructionError;
      return parseInstructionError(index, instructionError, logs);
    }
  }

  // Check for insufficient funds
  if (logs.some(log => log.toLowerCase().includes("insufficient"))) {
    return {
      message: "Insufficient funds for this transaction",
      logs,
      code: "INSUFFICIENT_FUNDS",
    };
  }

  // Check for account not found
  if (logs.some(log => log.includes("AccountNotFound"))) {
    return {
      message: "Required account not found. The creator may not have set up memberships.",
      logs,
      code: "ACCOUNT_NOT_FOUND",
    };
  }

  return {
    message: errorLog || "Transaction simulation failed",
    logs,
  };
}

/**
 * Parse instruction-level errors.
 */
function parseInstructionError(index: number, error: any, logs: string[]): TransactionError {
  if (typeof error === "object" && error !== null) {
    // Custom program error
    if ("Custom" in error) {
      const code = error.Custom;
      const message = getCustomErrorMessage(code, logs);
      return {
        message,
        logs,
        code: `CUSTOM_${code}`,
      };
    }

    // Built-in errors
    const errorName = Object.keys(error)[0];
    const errorMessages: Record<string, string> = {
      InsufficientFunds: "Insufficient funds for this transaction",
      InvalidAccountData: "Invalid account data",
      AccountAlreadyInitialized: "Account already exists",
      UninitializedAccount: "Account not initialized",
      InvalidSeeds: "Invalid program address",
      AccountNotRentExempt: "Account needs more SOL for rent",
      MissingRequiredSignature: "Missing required signature",
    };

    return {
      message: errorMessages[errorName] || `Instruction ${index} failed: ${errorName}`,
      logs,
      code: errorName,
    };
  }

  return {
    message: `Instruction ${index} failed: ${String(error)}`,
    logs,
  };
}

/**
 * Get human-readable message for custom program errors.
 */
function getCustomErrorMessage(code: number, logs: string[]): string {
  // Common Anchor/program error codes
  const commonErrors: Record<number, string> = {
    0: "Operation failed",
    1: "Invalid argument",
    2: "Invalid instruction data",
    3: "Invalid account data",
    100: "Account not initialized",
    101: "Account already initialized",
    102: "Invalid owner",
    103: "Not enough SOL",
    2000: "Constraints violated",
    2001: "Account discriminator mismatch",
    2002: "Account did not deserialize",
    2003: "Account did not serialize",
    2006: "Account not mutable",
    2007: "Account not signer",
    2012: "Invalid program ID",
    3000: "Constraint was violated",
    6000: "Already subscribed to this creator",
    6001: "Subscription not found",
    6002: "Subscription not active",
    6003: "Invalid subscription tier",
    6004: "Creator config not found",
    6005: "Creator config not active",
  };

  // Try to find error message in logs
  const programLog = logs.find(log =>
    log.includes("Program log:") &&
    (log.includes("Error") || log.includes("error"))
  );

  if (programLog) {
    const match = programLog.match(/Program log: (.+)/);
    if (match) {
      return match[1];
    }
  }

  return commonErrors[code] || `Transaction failed (error code: ${code})`;
}

/**
 * Send transaction with simulation-first approach for better errors.
 * Simulates BEFORE asking for wallet signature, so users don't see wallet popup for failing txs.
 */
export async function sendTransactionWithSimulation(
  connection: Connection,
  transaction: Transaction,
  signTransaction: (tx: Transaction) => Promise<Transaction>,
  options?: {
    skipSimulation?: boolean;
    commitment?: "processed" | "confirmed" | "finalized";
  }
): Promise<string> {
  const commitment = options?.commitment || "confirmed";

  // Get latest blockhash
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash(commitment);
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;

  // Simulate FIRST (before signing) - skip signature verification since tx is unsigned
  if (!options?.skipSimulation) {
    const simulation = await simulateTransactionUnsigned(connection, transaction);

    if (!simulation.success && simulation.error) {
      const error = new Error(simulation.error.message) as any;
      error.logs = simulation.error.logs;
      error.code = simulation.error.code;
      throw error;
    }
  }

  // Only ask for signature AFTER simulation passes
  const signedTx = await signTransaction(transaction);

  // Send the transaction
  const signature = await connection.sendRawTransaction(signedTx.serialize(), {
    skipPreflight: true, // We already simulated
    preflightCommitment: commitment,
  });

  // Confirm the transaction
  await connection.confirmTransaction({
    signature,
    blockhash,
    lastValidBlockHeight,
  }, commitment);

  return signature;
}

/**
 * Simulate an unsigned transaction (skips signature verification).
 */
async function simulateTransactionUnsigned(
  connection: Connection,
  transaction: Transaction
): Promise<{ success: boolean; error?: TransactionError; logs?: string[] }> {
  try {
    // Compile legacy transaction to V0 message for simulation with sigVerify: false
    const { blockhash } = await connection.getLatestBlockhash();

    // Create a MessageV0 from the legacy transaction
    const messageV0 = MessageV0.compile({
      payerKey: transaction.feePayer!,
      instructions: transaction.instructions,
      recentBlockhash: blockhash,
    });

    // Create VersionedTransaction (without signatures for simulation)
    const versionedTx = new VersionedTransaction(messageV0);

    // Simulate without signature verification
    const result = await connection.simulateTransaction(versionedTx, {
      sigVerify: false,
      replaceRecentBlockhash: true,
    });

    if (result.value.err) {
      const error = parseSimulationError(result.value.err, result.value.logs || []);
      return {
        success: false,
        error,
        logs: result.value.logs || [],
      };
    }

    return {
      success: true,
      logs: result.value.logs || [],
    };
  } catch (err: any) {
    return {
      success: false,
      error: {
        message: err.message || "Simulation failed",
      },
    };
  }
}

/**
 * Send transaction with additional signers (e.g., for Streamflow CPI where stream metadata is a signer).
 * Simulates BEFORE asking for wallet signature.
 */
export async function sendTransactionWithSigners(
  connection: Connection,
  transaction: Transaction,
  signTransaction: (tx: Transaction) => Promise<Transaction>,
  additionalSigners: import("@solana/web3.js").Keypair[],
  options?: {
    skipSimulation?: boolean;
    commitment?: "processed" | "confirmed" | "finalized";
  }
): Promise<string> {
  const commitment = options?.commitment || "confirmed";

  // Get latest blockhash
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash(commitment);
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;

  // Sign with additional signers first (they're usually PDAs or keypairs we control)
  if (additionalSigners.length > 0) {
    transaction.partialSign(...additionalSigners);
  }

  // Simulate FIRST (before asking wallet) - skip signature verification since wallet hasn't signed yet
  if (!options?.skipSimulation) {
    const simulation = await simulateTransactionUnsigned(connection, transaction);

    if (!simulation.success && simulation.error) {
      const error = new Error(simulation.error.message) as any;
      error.logs = simulation.error.logs;
      error.code = simulation.error.code;
      throw error;
    }
  }

  // Only ask for wallet signature AFTER simulation passes
  const signedTx = await signTransaction(transaction);

  // Send the transaction
  const signature = await connection.sendRawTransaction(signedTx.serialize(), {
    skipPreflight: true, // We already simulated
    preflightCommitment: commitment,
  });

  // Confirm the transaction
  await connection.confirmTransaction({
    signature,
    blockhash,
    lastValidBlockHeight,
  }, commitment);

  return signature;
}

/**
 * Format error for display to user.
 */
export function formatTransactionError(error: any): string {
  if (error.code) {
    switch (error.code) {
      case "INSUFFICIENT_FUNDS":
        return "You don't have enough SOL for this transaction.";
      case "ACCOUNT_NOT_FOUND":
        return "This creator hasn't set up memberships yet.";
      case "CUSTOM_6000":
        return "You're already a member of this creator.";
      case "CUSTOM_6001":
        return "Membership not found.";
      case "CUSTOM_6005":
        return "This creator's memberships are not active.";
      default:
        break;
    }
  }

  // Clean up common error messages
  const message = error.message || "Transaction failed";

  if (message.includes("User rejected")) {
    return "Transaction cancelled.";
  }

  if (message.includes("Blockhash not found")) {
    return "Transaction expired. Please try again.";
  }

  return message;
}
