"use client";

import { useQuery } from "@tanstack/react-query";
import { useConnection } from "@solana/wallet-adapter-react";
import {
  TribunalCraftClient,
  type Subject,
  type Dispute,
  isSubjectDormant,
  isSubjectValid,
  isSubjectDisputed,
  isSubjectInvalid,
  isSubjectRestoring,
  isDisputePending,
  isDisputeResolved,
  isChallengerWins,
  isDefenderWins,
} from "@tribunalcraft/sdk";
import { deriveSubjectId } from "@/lib/tribunalcraft";

export type ModerationStatus =
  | "none"      // No subject exists (not registered with Tribunalcraft)
  | "clean"     // Subject valid, no active disputes
  | "disputed"  // Active dispute in progress
  | "flagged"   // Challenger won, content removed
  | "restoring" // Previously flagged, restoration in progress
  | "dormant";  // Subject exists but no bond (unprotected)

export interface SubjectStatusResult {
  status: ModerationStatus;
  subject: Subject | null;
  dispute: Dispute | null;
  subjectId: string;
  // Dispute details (if any)
  votingEndsAt?: Date;
  isVotingActive?: boolean;
  challengerCount?: number;
  defenderCount?: number;
  voteCount?: number;
}

/**
 * Determine moderation status from subject and dispute
 * Note: When defender wins, TC sets subject back to "valid", so we return "clean"
 */
function getModerationStatus(subject: Subject | null, dispute: Dispute | null): ModerationStatus {
  if (!subject) return "none";

  if (isSubjectDormant(subject.status)) return "dormant";
  if (isSubjectRestoring(subject.status)) return "restoring";
  if (isSubjectInvalid(subject.status)) return "flagged";

  if (isSubjectDisputed(subject.status) && dispute && isDisputePending(dispute.status)) {
    return "disputed";
  }

  // Resolved disputes: challenger wins = flagged, defender wins = back to valid/clean
  if (dispute && isDisputeResolved(dispute.status) && isChallengerWins(dispute.outcome)) {
    return "flagged";
  }

  if (isSubjectValid(subject.status)) return "clean";

  return "none";
}

/**
 * Hook to fetch moderation status for a single content
 */
export function useSubjectStatus(contentCid: string | null) {
  const { connection } = useConnection();

  return useQuery<SubjectStatusResult>({
    queryKey: ["tribunalcraft-subject", contentCid],
    queryFn: async (): Promise<SubjectStatusResult> => {
      if (!contentCid) {
        return {
          status: "none",
          subject: null,
          dispute: null,
          subjectId: "",
        };
      }

      const client = new TribunalCraftClient({ connection });
      const subjectId = deriveSubjectId(contentCid);

      const [subject, dispute] = await Promise.all([
        client.fetchSubjectById(subjectId),
        client.fetchDisputeBySubjectId(subjectId),
      ]);

      const status = getModerationStatus(subject, dispute);
      const now = Date.now();

      return {
        status,
        subject,
        dispute,
        subjectId: subjectId.toBase58(),
        votingEndsAt: dispute ? new Date(dispute.votingEndsAt.toNumber() * 1000) : undefined,
        isVotingActive: dispute
          ? isDisputePending(dispute.status) && dispute.votingEndsAt.toNumber() * 1000 > now
          : undefined,
        challengerCount: dispute?.challengerCount,
        defenderCount: dispute?.defenderCount,
        voteCount: dispute?.voteCount,
      };
    },
    enabled: !!contentCid,
    staleTime: 30_000, // 30 seconds
    refetchInterval: 60_000, // Refetch every minute
  });
}

/**
 * Hook to fetch moderation statuses for multiple contents
 */
export function useSubjectStatuses(contentCids: string[]) {
  const { connection } = useConnection();

  return useQuery<Map<string, SubjectStatusResult>>({
    queryKey: ["tribunalcraft-subjects", contentCids.join(",")],
    queryFn: async () => {
      const client = new TribunalCraftClient({ connection });
      const results = new Map<string, SubjectStatusResult>();

      await Promise.all(
        contentCids.map(async (cid) => {
          const subjectId = deriveSubjectId(cid);

          try {
            const [subject, dispute] = await Promise.all([
              client.fetchSubjectById(subjectId),
              client.fetchDisputeBySubjectId(subjectId),
            ]);

            const status = getModerationStatus(subject, dispute);
            const now = Date.now();

            results.set(cid, {
              status,
              subject,
              dispute,
              subjectId: subjectId.toBase58(),
              votingEndsAt: dispute ? new Date(dispute.votingEndsAt.toNumber() * 1000) : undefined,
              isVotingActive: dispute
                ? isDisputePending(dispute.status) && dispute.votingEndsAt.toNumber() * 1000 > now
                : undefined,
              challengerCount: dispute?.challengerCount,
              defenderCount: dispute?.defenderCount,
              voteCount: dispute?.voteCount,
            });
          } catch {
            results.set(cid, {
              status: "none",
              subject: null,
              dispute: null,
              subjectId: subjectId.toBase58(),
            });
          }
        })
      );

      return results;
    },
    enabled: contentCids.length > 0,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
