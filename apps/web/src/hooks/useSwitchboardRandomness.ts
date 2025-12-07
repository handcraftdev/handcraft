"use client";

import { useMemo, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  PublicKey,
  Keypair,
  TransactionInstruction,
  Transaction,
} from "@solana/web3.js";
import {
  Randomness,
  AnchorUtils,
  ON_DEMAND_DEVNET_PID,
  ON_DEMAND_DEVNET_QUEUE,
  ON_DEMAND_MAINNET_PID,
  ON_DEMAND_MAINNET_QUEUE,
} from "@switchboard-xyz/on-demand";

// Determine if we're on mainnet
const IS_MAINNET = process.env.NEXT_PUBLIC_MAINNET === "true";

// Switchboard Queue and Program ID based on network
const SWITCHBOARD_QUEUE = process.env.NEXT_PUBLIC_SWITCHBOARD_QUEUE
  ? new PublicKey(process.env.NEXT_PUBLIC_SWITCHBOARD_QUEUE)
  : IS_MAINNET ? ON_DEMAND_MAINNET_QUEUE : ON_DEMAND_DEVNET_QUEUE;

const SWITCHBOARD_PROGRAM_ID = IS_MAINNET
  ? ON_DEMAND_MAINNET_PID
  : ON_DEMAND_DEVNET_PID;

// localStorage key for pending mints
const PENDING_MINTS_KEY = "handcraft_pending_vrf_mints";

export interface RandomnessResult {
  randomnessAccount: PublicKey;
  randomnessKeypair: Keypair;
  createInstruction: TransactionInstruction;
  commitInstruction: TransactionInstruction;
  // Note: create + commit can now be bundled in the same transaction!
}

export interface RevealResult {
  revealInstruction: TransactionInstruction;
}

// Pending mint stored in localStorage for recovery
export interface PendingVrfMint {
  id: string; // unique ID
  randomnessAccount: string; // base58
  nftAssetKeypair: number[]; // secret key as array
  contentCid: string;
  creator: string; // base58
  collectionAsset: string; // base58
  commitTxSignature: string;
  timestamp: number;
  status: "committed" | "revealing" | "failed";
}

// Helper to save pending mint to localStorage
export function savePendingMint(mint: PendingVrfMint): void {
  if (typeof window === "undefined") return;
  const existing = getPendingMints();
  existing.push(mint);
  localStorage.setItem(PENDING_MINTS_KEY, JSON.stringify(existing));
}

// Helper to get all pending mints from localStorage
export function getPendingMints(): PendingVrfMint[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(PENDING_MINTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// Helper to remove a pending mint from localStorage
export function removePendingMint(id: string): void {
  if (typeof window === "undefined") return;
  const existing = getPendingMints().filter(m => m.id !== id);
  localStorage.setItem(PENDING_MINTS_KEY, JSON.stringify(existing));
}

// Helper to update a pending mint in localStorage
export function updatePendingMint(id: string, updates: Partial<PendingVrfMint>): void {
  if (typeof window === "undefined") return;
  const existing = getPendingMints();
  const index = existing.findIndex(m => m.id === id);
  if (index >= 0) {
    existing[index] = { ...existing[index], ...updates };
    localStorage.setItem(PENDING_MINTS_KEY, JSON.stringify(existing));
  }
}

export function useSwitchboardRandomness() {
  const { connection } = useConnection();
  const { publicKey, signTransaction, signAllTransactions } = useWallet();

  // Memoize whether we're on client and have a wallet
  const isReady = useMemo(() => {
    return typeof window !== "undefined" && !!publicKey;
  }, [publicKey]);

  /**
   * Create a new randomness account and get both create and commit instructions
   * These can be bundled into a SINGLE transaction to reduce user signatures
   */
  const createRandomnessAccount = useCallback(async (): Promise<RandomnessResult> => {
    if (!publicKey || !signTransaction || !signAllTransactions) {
      throw new Error("Wallet not connected");
    }

    try {
      // Generate a new keypair for the randomness account
      const randomnessKeypair = Keypair.generate();

      // Create a readonly wallet adapter for Switchboard
      // The wallet adapter interface that AnchorUtils expects
      const walletAdapter = {
        publicKey,
        signTransaction,
        signAllTransactions,
      };

      // Load Switchboard program using their utility
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sbProgram = await AnchorUtils.loadProgramFromConnection(
        connection,
        walletAdapter as any,
        SWITCHBOARD_PROGRAM_ID
      );

      // Create randomness account using Switchboard SDK
      // The returned Randomness instance can be used immediately for commitIx
      // without waiting for the create transaction to confirm
      const [randomness, createIx] = await Randomness.create(
        sbProgram,
        randomnessKeypair,
        SWITCHBOARD_QUEUE
      );

      // Get commit instruction using the returned Randomness instance
      // This works because the instance has all the data it needs in memory
      const commitIx = await randomness.commitIx(SWITCHBOARD_QUEUE);

      return {
        randomnessAccount: randomnessKeypair.publicKey,
        randomnessKeypair,
        createInstruction: createIx,
        commitInstruction: commitIx,
      };
    } catch (error) {
      console.error("Failed to create randomness account:", error);
      throw error;
    }
  }, [publicKey, signTransaction, signAllTransactions, connection]);

  /**
   * Get the commit instruction for an existing randomness account
   * MUST be called AFTER the randomness account create transaction is confirmed
   */
  const getCommitInstruction = useCallback(async (
    randomnessAccount: PublicKey
  ): Promise<TransactionInstruction> => {
    if (!publicKey || !signTransaction || !signAllTransactions) {
      throw new Error("Wallet not connected");
    }

    try {
      const walletAdapter = {
        publicKey,
        signTransaction,
        signAllTransactions,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sbProgram = await AnchorUtils.loadProgramFromConnection(
        connection,
        walletAdapter as any,
        SWITCHBOARD_PROGRAM_ID
      );

      // Load the existing randomness account
      const randomness = new Randomness(sbProgram, randomnessAccount);

      // Get commit instruction
      const commitIx = await randomness.commitIx(SWITCHBOARD_QUEUE);

      return commitIx;
    } catch (error) {
      console.error("Failed to get commit instruction:", error);
      throw error;
    }
  }, [publicKey, signTransaction, signAllTransactions, connection]);

  /**
   * Get the reveal instruction for an existing randomness account
   * Call this after the commit slot has passed (~1-2 slots / 0.4-0.8 seconds)
   */
  const getRevealInstruction = useCallback(async (
    randomnessAccount: PublicKey
  ): Promise<RevealResult> => {
    if (!publicKey || !signTransaction || !signAllTransactions) {
      throw new Error("Wallet not connected");
    }

    try {
      // Create wallet adapter
      const walletAdapter = {
        publicKey,
        signTransaction,
        signAllTransactions,
      };

      // Load Switchboard program
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sbProgram = await AnchorUtils.loadProgramFromConnection(
        connection,
        walletAdapter as any,
        SWITCHBOARD_PROGRAM_ID
      );

      // Load existing randomness account
      const randomness = new Randomness(sbProgram, randomnessAccount);

      // Get reveal instruction
      const revealIx = await randomness.revealIx();

      return {
        revealInstruction: revealIx,
      };
    } catch (error) {
      console.error("Failed to get reveal instruction:", error);
      throw error;
    }
  }, [publicKey, signTransaction, signAllTransactions, connection]);

  /**
   * Get reveal instruction with retry logic for oracle availability
   * Retries up to maxRetries times with exponential backoff
   */
  const getRevealInstructionWithRetry = useCallback(async (
    randomnessAccount: PublicKey,
    maxRetries: number = 5,
    initialDelayMs: number = 2000
  ): Promise<TransactionInstruction> => {
    let delayMs = initialDelayMs;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempting to get reveal instruction (attempt ${attempt}/${maxRetries})...`);
        const result = await getRevealInstruction(randomnessAccount);
        console.log("Successfully obtained reveal instruction");
        return result.revealInstruction;
      } catch (error: any) {
        console.log(`Reveal attempt ${attempt} failed:`, error.message);

        if (attempt === maxRetries) {
          console.error("All reveal attempts failed. The Switchboard gateway may be experiencing issues.");
          throw error;
        }

        console.log(`Waiting ${delayMs}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs = Math.min(delayMs * 1.5, 10000);
      }
    }

    throw new Error("Failed to get reveal instruction after all retries");
  }, [getRevealInstruction]);

  /**
   * Wait for randomness to be available (poll until ready)
   * Returns true when randomness is available for reveal
   */
  const waitForRandomness = useCallback(async (
    randomnessAccount: PublicKey,
    maxWaitMs: number = 5000
  ): Promise<boolean> => {
    const startTime = Date.now();
    const pollInterval = 400; // ~1 slot

    while (Date.now() - startTime < maxWaitMs) {
      try {
        // Check if randomness is available by trying to get the reveal instruction
        await getRevealInstruction(randomnessAccount);
        return true;
      } catch {
        // Not ready yet, wait and try again
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    return false;
  }, [getRevealInstruction]);

  return {
    createRandomnessAccount,
    getCommitInstruction,
    getRevealInstruction,
    getRevealInstructionWithRetry,
    waitForRandomness,
    switchboardQueue: SWITCHBOARD_QUEUE,
    switchboardProgramId: SWITCHBOARD_PROGRAM_ID,
    isInitialized: isReady,
  };
}
