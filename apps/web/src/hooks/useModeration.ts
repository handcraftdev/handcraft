"use client";

import { useMemo, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction, PublicKey, SystemProgram } from "@solana/web3.js";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BN } from "@coral-xyz/anchor";
import {
  createContentRegistryClient,
  ReportCategory,
  VoteChoice,
  ContentReport,
  ModerationPool,
  ModeratorAccount,
  ModeratorRegistry,
  getModerationPoolPDA,
  getContentReportPDA,
  getModeratorRegistryPDA,
  getModeratorAccountPDA,
  getVoteRecordPDA,
  reportCategoryToAnchor,
  voteChoiceToAnchor,
  isVotingActive,
  hasQuorum,
  isRemovalApproved,
  MIN_MODERATOR_STAKE,
  VOTING_PERIOD,
  anchorToReportCategory,
  anchorToReportStatus,
  anchorToResolutionOutcome,
  anchorToVoteChoice,
} from "@handcraft/sdk";
import { simulateTransaction } from "@/utils/transaction";

export {
  ReportCategory,
  VoteChoice,
  isVotingActive,
  hasQuorum,
  isRemovalApproved,
  MIN_MODERATOR_STAKE,
  VOTING_PERIOD,
};
export type { ContentReport, ModerationPool, ModeratorAccount, ModeratorRegistry };

export function useModeration() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const queryClient = useQueryClient();

  // Memoize client
  const client = useMemo(() => {
    if (typeof window === "undefined") return null;
    return createContentRegistryClient(connection);
  }, [connection]);

  const program = client?.program;
  // Cast to any for dynamic account access - accounts are defined in IDL at runtime
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const accounts = program?.account as any;

  // Fetch moderator registry (global stats)
  const moderatorRegistryQuery = useQuery({
    queryKey: ["moderatorRegistry"],
    queryFn: async () => {
      if (!program || !accounts) return null;
      try {
        const pda = getModeratorRegistryPDA(program.programId);
        const data = await accounts.moderatorRegistry.fetch(pda);
        return data as ModeratorRegistry;
      } catch {
        return null;
      }
    },
    enabled: !!program,
    staleTime: 60000,
  });

  // Fetch current user's moderator account
  const moderatorAccountQuery = useQuery({
    queryKey: ["moderatorAccount", publicKey?.toBase58()],
    queryFn: async () => {
      if (!program || !publicKey || !accounts) return null;
      try {
        const pda = getModeratorAccountPDA(program.programId, publicKey);
        const data = await accounts.moderatorAccount.fetch(pda);
        return data as ModeratorAccount;
      } catch {
        return null;
      }
    },
    enabled: !!program && !!publicKey,
    staleTime: 60000,
  });

  // Fetch moderation pool for a specific content
  const fetchModerationPool = useCallback(async (content: PublicKey): Promise<ModerationPool | null> => {
    if (!program || !accounts) return null;
    try {
      const pda = getModerationPoolPDA(program.programId, content);
      const data = await accounts.moderationPool.fetch(pda);
      return data as ModerationPool;
    } catch {
      return null;
    }
  }, [program, accounts]);

  // Fetch all pending reports
  const pendingReportsQuery = useQuery({
    queryKey: ["pendingReports"],
    queryFn: async () => {
      if (!program || !accounts) return [];
      try {
        const reports = await accounts.contentReport.all();
        return reports
          .map(({ publicKey, account }: { publicKey: PublicKey; account: any }) => ({
            publicKey,
            account: {
              ...account,
              category: anchorToReportCategory(account.category),
              status: anchorToReportStatus(account.status),
              outcome: anchorToResolutionOutcome(account.outcome),
            } as ContentReport,
          }))
          .filter((r: { account: ContentReport }) => r.account.status === "Pending");
      } catch (err) {
        console.error("Failed to fetch reports:", err);
        return [];
      }
    },
    enabled: !!program,
    staleTime: 30000,
  });

  // Submit report mutation
  const submitReport = useMutation({
    mutationFn: async ({
      content,
      category,
      detailsCid,
    }: {
      content: PublicKey;
      category: ReportCategory;
      detailsCid: string;
    }) => {
      if (!publicKey) throw new Error("Wallet not connected");
      if (!program) throw new Error("Program not initialized");

      const moderationPool = getModerationPoolPDA(program.programId, content);
      const moderatorRegistry = getModeratorRegistryPDA(program.programId);
      const timestamp = Math.floor(Date.now() / 1000);
      const report = getContentReportPDA(program.programId, content, publicKey, timestamp);

      const tx = await program.methods
        .submitReport(reportCategoryToAnchor(category), detailsCid, new BN(timestamp))
        .accounts({
          content,
          moderationPool,
          report,
          moderatorRegistry,
          reporter: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .transaction();

      await simulateTransaction(connection, tx, publicKey);
      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, "confirmed");
      return signature;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pendingReports"] });
    },
  });

  // Vote on report mutation
  const voteOnReport = useMutation({
    mutationFn: async ({
      report,
      choice,
    }: {
      report: PublicKey;
      choice: VoteChoice;
    }) => {
      if (!publicKey) throw new Error("Wallet not connected");
      if (!program) throw new Error("Program not initialized");

      const moderatorAccount = getModeratorAccountPDA(program.programId, publicKey);
      const voteRecord = getVoteRecordPDA(program.programId, report, publicKey);
      const moderatorRegistry = getModeratorRegistryPDA(program.programId);

      const tx = await program.methods
        .voteOnReport(voteChoiceToAnchor(choice))
        .accounts({
          report,
          moderatorAccount,
          voteRecord,
          moderatorRegistry,
          moderator: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .transaction();

      await simulateTransaction(connection, tx, publicKey);
      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, "confirmed");
      return signature;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pendingReports"] });
      queryClient.invalidateQueries({ queryKey: ["moderatorAccount"] });
      queryClient.invalidateQueries({ queryKey: ["moderatorRegistry"] });
    },
  });

  // Register as moderator mutation
  const registerModerator = useMutation({
    mutationFn: async ({ stakeAmount }: { stakeAmount: number }) => {
      if (!publicKey) throw new Error("Wallet not connected");
      if (!program) throw new Error("Program not initialized");

      if (stakeAmount < MIN_MODERATOR_STAKE) {
        throw new Error(`Minimum stake is ${MIN_MODERATOR_STAKE / 1e9} SOL`);
      }

      const moderatorAccount = getModeratorAccountPDA(program.programId, publicKey);
      const moderatorRegistry = getModeratorRegistryPDA(program.programId);

      const tx = await program.methods
        .registerModerator(new BN(stakeAmount))
        .accounts({
          moderatorAccount,
          moderatorRegistry,
          moderator: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .transaction();

      await simulateTransaction(connection, tx, publicKey);
      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, "confirmed");
      return signature;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["moderatorAccount"] });
      queryClient.invalidateQueries({ queryKey: ["moderatorRegistry"] });
    },
  });

  // Unregister moderator mutation
  const unregisterModerator = useMutation({
    mutationFn: async () => {
      if (!publicKey) throw new Error("Wallet not connected");
      if (!program) throw new Error("Program not initialized");

      const moderatorAccount = getModeratorAccountPDA(program.programId, publicKey);
      const moderatorRegistry = getModeratorRegistryPDA(program.programId);

      const tx = await program.methods
        .unregisterModerator()
        .accounts({
          moderatorAccount,
          moderatorRegistry,
          moderator: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .transaction();

      await simulateTransaction(connection, tx, publicKey);
      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, "confirmed");
      return signature;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["moderatorAccount"] });
      queryClient.invalidateQueries({ queryKey: ["moderatorRegistry"] });
    },
  });

  // Resolve moderation mutation
  const resolveModeration = useMutation({
    mutationFn: async ({
      content,
      report,
      reporter,
    }: {
      content: PublicKey;
      report: PublicKey;
      reporter: PublicKey;
    }) => {
      if (!publicKey) throw new Error("Wallet not connected");
      if (!program) throw new Error("Program not initialized");

      const moderationPool = getModerationPoolPDA(program.programId, content);
      const moderatorRegistry = getModeratorRegistryPDA(program.programId);

      const tx = await program.methods
        .resolveModeration()
        .accounts({
          content,
          moderationPool,
          report,
          moderatorRegistry,
          reporter,
          resolver: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .transaction();

      await simulateTransaction(connection, tx, publicKey);
      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, "confirmed");
      return signature;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pendingReports"] });
      queryClient.invalidateQueries({ queryKey: ["moderatorRegistry"] });
    },
  });

  // Check if user has voted on a specific report
  const hasVotedOnReport = useCallback(async (reportPda: PublicKey): Promise<boolean> => {
    if (!program || !publicKey || !accounts) return false;
    try {
      const voteRecord = getVoteRecordPDA(program.programId, reportPda, publicKey);
      await accounts.voteRecord.fetch(voteRecord);
      return true;
    } catch {
      return false;
    }
  }, [program, publicKey, accounts]);

  return {
    // State
    isModerator: !!moderatorAccountQuery.data?.isActive,
    moderatorAccount: moderatorAccountQuery.data,
    moderatorRegistry: moderatorRegistryQuery.data,
    pendingReports: pendingReportsQuery.data || [],
    isLoadingReports: pendingReportsQuery.isLoading,
    isLoadingModerator: moderatorAccountQuery.isLoading,

    // Actions
    submitReport,
    voteOnReport,
    registerModerator,
    unregisterModerator,
    resolveModeration,

    // Helpers
    fetchModerationPool,
    hasVotedOnReport,
  };
}
