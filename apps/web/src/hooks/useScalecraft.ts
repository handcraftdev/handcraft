"use client";

import { useMemo, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  ScaleCraftClient,
  DisputeTypeEnum,
  type Subject,
  type Dispute,
  type DisputeType,
} from "@scalecraft/sdk";
import { deriveSubjectId } from "@/lib/scalecraft";

/**
 * Hook to interact with Tribunalcraft protocol for content moderation
 */
export function useScalecraft() {
  const { connection } = useConnection();
  const { publicKey, signTransaction, signAllTransactions } = useWallet();

  // Create client (read-only if no wallet connected)
  const client = useMemo(() => {
    const config: { connection: typeof connection; wallet?: any } = { connection };

    if (publicKey && signTransaction && signAllTransactions) {
      config.wallet = {
        publicKey,
        signTransaction,
        signAllTransactions,
      };
    }

    return new ScaleCraftClient(config);
  }, [connection, publicKey, signTransaction, signAllTransactions]);

  /**
   * Fetch subject by content CID
   */
  const fetchSubject = useCallback(
    async (contentCid: string): Promise<Subject | null> => {
      const subjectId = deriveSubjectId(contentCid);
      return await client.fetchSubjectById(subjectId);
    },
    [client]
  );

  /**
   * Fetch dispute for a content CID
   */
  const fetchDispute = useCallback(
    async (contentCid: string): Promise<Dispute | null> => {
      const subjectId = deriveSubjectId(contentCid);
      return await client.fetchDisputeBySubjectId(subjectId);
    },
    [client]
  );

  /**
   * Create a subject for content (called at content registration)
   * This links Handcraft content to Tribunalcraft moderation
   */
  const createSubject = useCallback(
    async (params: {
      contentCid: string;
      detailsCid: string;
      votingPeriod?: number; // seconds, defaults to 1 day
      initialBond?: number; // lamports
    }) => {
      if (!publicKey) throw new Error("Wallet not connected");

      const subjectId = deriveSubjectId(params.contentCid);

      return await client.createSubject({
        subjectId,
        detailsCid: params.detailsCid,
        matchMode: true,
        votingPeriod: new BN(params.votingPeriod ?? 86400), // 1 day default
        initialBond: new BN(params.initialBond ?? 0),
      });
    },
    [client, publicKey]
  );

  /**
   * Create a dispute against content (report content)
   */
  const createDispute = useCallback(
    async (params: {
      contentCid: string;
      disputeType: DisputeType;
      detailsCid: string; // IPFS CID with report details
      stake: number; // lamports
    }) => {
      if (!publicKey) throw new Error("Wallet not connected");

      const subjectId = deriveSubjectId(params.contentCid);

      return await client.createDispute({
        subjectId,
        disputeType: params.disputeType,
        detailsCid: params.detailsCid,
        stake: new BN(params.stake),
      });
    },
    [client, publicKey]
  );

  /**
   * Join an existing dispute as additional challenger
   */
  const joinDispute = useCallback(
    async (params: {
      contentCid: string;
      detailsCid: string;
      stake: number;
    }) => {
      if (!publicKey) throw new Error("Wallet not connected");

      const subjectId = deriveSubjectId(params.contentCid);

      return await client.joinChallengers({
        subjectId,
        detailsCid: params.detailsCid,
        stake: new BN(params.stake),
      });
    },
    [client, publicKey]
  );

  /**
   * Add bond to defend content
   */
  const addBond = useCallback(
    async (contentCid: string, amount: number) => {
      if (!publicKey) throw new Error("Wallet not connected");

      const subjectId = deriveSubjectId(contentCid);
      return await client.addBondDirect(subjectId, new BN(amount));
    },
    [client, publicKey]
  );

  return {
    client,
    // Queries
    fetchSubject,
    fetchDispute,
    deriveSubjectId,
    // Mutations
    createSubject,
    createDispute,
    joinDispute,
    addBond,
    // Utils
    isConnected: !!publicKey,
    DisputeTypeEnum,
  };
}
