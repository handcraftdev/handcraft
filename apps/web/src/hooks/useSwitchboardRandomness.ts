"use client";

import { useMemo, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  PublicKey,
  Keypair,
  TransactionInstruction,
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

export interface RandomnessResult {
  randomnessAccount: PublicKey;
  randomnessKeypair: Keypair;
  createInstruction: TransactionInstruction;
  commitInstruction: TransactionInstruction;
}

export interface RevealResult {
  revealInstruction: TransactionInstruction;
}

export function useSwitchboardRandomness() {
  const { connection } = useConnection();
  const { publicKey, signTransaction, signAllTransactions } = useWallet();

  // Memoize whether we're on client and have a wallet
  const isReady = useMemo(() => {
    return typeof window !== "undefined" && !!publicKey;
  }, [publicKey]);

  /**
   * Create a new randomness account and get instructions for commit flow
   * Returns the randomness keypair (must be added as signer) and instructions
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
      // This handles IDL loading internally without fetching from chain
      const sbProgram = await AnchorUtils.loadProgramFromConnection(
        connection,
        walletAdapter,
        SWITCHBOARD_PROGRAM_ID
      );

      // Create randomness account using Switchboard SDK
      const [randomness, createIx] = await Randomness.create(
        sbProgram,
        randomnessKeypair,
        SWITCHBOARD_QUEUE
      );

      // Get commit instruction
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
      const sbProgram = await AnchorUtils.loadProgramFromConnection(
        connection,
        walletAdapter,
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
    getRevealInstruction,
    waitForRandomness,
    switchboardQueue: SWITCHBOARD_QUEUE,
    switchboardProgramId: SWITCHBOARD_PROGRAM_ID,
    isInitialized: isReady,
  };
}
