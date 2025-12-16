"use client";

import { useMemo } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useQuery } from "@tanstack/react-query";
import {
  createContentRegistryClient,
  ModerationPool,
  getModerationPoolPDA,
} from "@handcraft/sdk";

export interface ContentModerationStatus {
  contentPda: PublicKey;
  pool: ModerationPool | null;
  isFlagged: boolean;
}

export function useModerationStatuses(contentPdas: PublicKey[]) {
  const { connection } = useConnection();

  const client = useMemo(() => {
    if (typeof window === "undefined") return null;
    return createContentRegistryClient(connection);
  }, [connection]);

  const program = client?.program;
  // Cast to any for dynamic account access - accounts are defined in IDL at runtime
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const accounts = program?.account as any;

  return useQuery({
    queryKey: ["moderationStatuses", contentPdas.map(c => c.toBase58()).join(",")],
    queryFn: async (): Promise<Map<string, ContentModerationStatus>> => {
      if (!program || !accounts || contentPdas.length === 0) {
        return new Map();
      }

      const statusMap = new Map<string, ContentModerationStatus>();

      // Fetch all moderation pools in parallel
      const results = await Promise.all(
        contentPdas.map(async (contentPda) => {
          try {
            const poolPda = getModerationPoolPDA(program.programId, contentPda);
            const pool = await accounts.moderationPool.fetch(poolPda) as ModerationPool;
            return {
              contentPda,
              pool,
              isFlagged: pool.isFlagged,
            };
          } catch {
            // No moderation pool exists for this content
            return {
              contentPda,
              pool: null,
              isFlagged: false,
            };
          }
        })
      );

      results.forEach((result) => {
        statusMap.set(result.contentPda.toBase58(), result);
      });

      return statusMap;
    },
    enabled: !!program && contentPdas.length > 0,
    staleTime: 30000, // Cache for 30 seconds
    gcTime: 60000,
  });
}

// Hook for single content moderation status
export function useModerationStatus(contentPda: PublicKey | null) {
  const { connection } = useConnection();

  const client = useMemo(() => {
    if (typeof window === "undefined") return null;
    return createContentRegistryClient(connection);
  }, [connection]);

  const program = client?.program;
  // Cast to any for dynamic account access - accounts are defined in IDL at runtime
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const accounts = program?.account as any;

  return useQuery({
    queryKey: ["moderationStatus", contentPda?.toBase58()],
    queryFn: async (): Promise<ModerationPool | null> => {
      if (!program || !accounts || !contentPda) return null;

      try {
        const poolPda = getModerationPoolPDA(program.programId, contentPda);
        return await accounts.moderationPool.fetch(poolPda) as ModerationPool;
      } catch {
        return null;
      }
    },
    enabled: !!program && !!contentPda,
    staleTime: 30000,
  });
}
