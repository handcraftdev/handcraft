import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID as TRIBUNALCRAFT_PROGRAM_ID } from "@tribunalcraft/sdk";
import { sha256 } from "js-sha256";

// Handcraft's seed for deriving Tribunalcraft subject IDs
// This namespaces all Handcraft content under our own moderation scope
const HANDCRAFT_SEED = Buffer.from("handcraft");

/**
 * Derive a Tribunalcraft subject ID from a Handcraft content CID
 *
 * Subject ID = PDA([HANDCRAFT_SEED, sha256(contentCid)], TRIBUNALCRAFT_PROGRAM_ID)
 *
 * This ensures:
 * - 1:1 mapping between content CID and subject
 * - Namespaced under Handcraft (other apps get different subject IDs for same CID)
 * - Deterministic and verifiable
 */
export function deriveSubjectId(contentCid: string): PublicKey {
  const cidHash = sha256.array(contentCid);
  const [subjectId] = PublicKey.findProgramAddressSync(
    [HANDCRAFT_SEED, Buffer.from(cidHash)],
    TRIBUNALCRAFT_PROGRAM_ID
  );
  return subjectId;
}

/**
 * Verify if a subject ID matches the expected derivation for a content CID
 */
export function verifySubjectId(subjectId: PublicKey, contentCid: string): boolean {
  const expected = deriveSubjectId(contentCid);
  return subjectId.equals(expected);
}

/**
 * Get the Handcraft seed used for subject ID derivation
 * Useful for third-party verification
 */
export function getHandcraftSeed(): Buffer {
  return HANDCRAFT_SEED;
}
