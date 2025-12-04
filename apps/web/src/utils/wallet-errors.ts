/**
 * Check if an error is a user rejection (wallet cancelled)
 */
export function isUserRejection(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("User rejected") ||
    message.includes("rejected the request") ||
    message.includes("Transaction cancelled") ||
    message.includes("user rejected transaction") ||
    message.includes("User denied")
  );
}

/**
 * Check if an error is a simulation failure
 */
export function isSimulationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("simulation") ||
    message.includes("Simulation") ||
    message.includes("reverted") ||
    message.includes("failed to simulate")
  );
}

/**
 * Get a user-friendly error message for wallet transaction errors
 */
export function getTransactionErrorMessage(error: unknown): string {
  if (isUserRejection(error)) {
    return "Transaction cancelled";
  }

  const message = error instanceof Error ? error.message : String(error);

  // Handle simulation errors
  if (isSimulationError(error)) {
    // Check for specific causes
    if (message.includes("already in use") || message.includes("AccountAlreadyExists")) {
      return "This content is already registered on-chain";
    }
    if (message.includes("CidAlreadyRegistered")) {
      return "This content CID is already registered";
    }
    if (message.includes("AccountNotFound")) {
      return "Account not found. Make sure your wallet has some SOL";
    }
    return "Transaction would fail. Please check your inputs and try again";
  }

  // Handle common Solana errors
  if (message.includes("insufficient funds") || message.includes("Insufficient")) {
    return "Insufficient funds for transaction";
  }

  if (message.includes("blockhash not found") || message.includes("Blockhash not found")) {
    return "Transaction expired. Please try again";
  }

  if (message.includes("already been processed")) {
    return "Transaction already processed";
  }

  return message || "Transaction failed";
}
