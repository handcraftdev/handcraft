import { PublicKey } from "@solana/web3.js";

const CONTENT_REPORT_SEED = Buffer.from("content_report");
const MODERATION_POOL_SEED = Buffer.from("moderation_pool");
const MODERATOR_REGISTRY_SEED = Buffer.from("moderator_registry");
const VOTE_RECORD_SEED = Buffer.from("vote_record");
const MODERATOR_SEED = Buffer.from("moderator");

export function getModerationPoolPDA(
  programId: PublicKey,
  content: PublicKey
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [MODERATION_POOL_SEED, content.toBuffer()],
    programId
  );
  return pda;
}

export function getContentReportPDA(
  programId: PublicKey,
  content: PublicKey,
  reporter: PublicKey,
  timestamp: number
): PublicKey {
  const timestampBuffer = Buffer.alloc(8);
  timestampBuffer.writeBigInt64LE(BigInt(timestamp));

  const [pda] = PublicKey.findProgramAddressSync(
    [CONTENT_REPORT_SEED, content.toBuffer(), reporter.toBuffer(), timestampBuffer],
    programId
  );
  return pda;
}

export function getModeratorRegistryPDA(programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [MODERATOR_REGISTRY_SEED],
    programId
  );
  return pda;
}

export function getModeratorAccountPDA(
  programId: PublicKey,
  moderator: PublicKey
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [MODERATOR_SEED, moderator.toBuffer()],
    programId
  );
  return pda;
}

export function getVoteRecordPDA(
  programId: PublicKey,
  report: PublicKey,
  moderator: PublicKey
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [VOTE_RECORD_SEED, report.toBuffer(), moderator.toBuffer()],
    programId
  );
  return pda;
}
