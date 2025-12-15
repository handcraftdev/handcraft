import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { BN, Program } from "@coral-xyz/anchor";
import { ReportCategory, VoteChoice, reportCategoryToAnchor, voteChoiceToAnchor } from "./types";
import {
  getModerationPoolPDA,
  getContentReportPDA,
  getModeratorRegistryPDA,
  getModeratorAccountPDA,
  getVoteRecordPDA,
} from "./pdas";

export interface SubmitReportParams {
  program: Program;
  content: PublicKey;
  reporter: PublicKey;
  category: ReportCategory;
  detailsCid: string;
}

export async function createSubmitReportInstruction(
  params: SubmitReportParams
): Promise<TransactionInstruction> {
  const { program, content, reporter, category, detailsCid } = params;

  const moderationPool = getModerationPoolPDA(program.programId, content);
  const moderatorRegistry = getModeratorRegistryPDA(program.programId);

  // Report PDA uses timestamp, so we use current time
  const timestamp = Math.floor(Date.now() / 1000);
  const report = getContentReportPDA(program.programId, content, reporter, timestamp);

  return await program.methods
    .submitReport(reportCategoryToAnchor(category), detailsCid)
    .accounts({
      content,
      moderationPool,
      report,
      moderatorRegistry,
      reporter,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export interface VoteOnReportParams {
  program: Program;
  report: PublicKey;
  moderator: PublicKey;
  choice: VoteChoice;
}

export async function createVoteOnReportInstruction(
  params: VoteOnReportParams
): Promise<TransactionInstruction> {
  const { program, report, moderator, choice } = params;

  const moderatorAccount = getModeratorAccountPDA(program.programId, moderator);
  const voteRecord = getVoteRecordPDA(program.programId, report, moderator);
  const moderatorRegistry = getModeratorRegistryPDA(program.programId);

  return await program.methods
    .voteOnReport(voteChoiceToAnchor(choice))
    .accounts({
      report,
      moderatorAccount,
      voteRecord,
      moderatorRegistry,
      moderator,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export interface ResolveModerationParams {
  program: Program;
  content: PublicKey;
  report: PublicKey;
  reporter: PublicKey;
  resolver: PublicKey;
}

export async function createResolveModerationInstruction(
  params: ResolveModerationParams
): Promise<TransactionInstruction> {
  const { program, content, report, reporter, resolver } = params;

  const moderationPool = getModerationPoolPDA(program.programId, content);
  const moderatorRegistry = getModeratorRegistryPDA(program.programId);

  return await program.methods
    .resolveModeration()
    .accounts({
      content,
      moderationPool,
      report,
      moderatorRegistry,
      reporter,
      resolver,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export interface ResolveModerationWithAttestationParams extends ResolveModerationParams {
  attestationId: PublicKey;
}

export async function createResolveModerationWithAttestationInstruction(
  params: ResolveModerationWithAttestationParams
): Promise<TransactionInstruction> {
  const { program, content, report, reporter, resolver, attestationId } = params;

  const moderationPool = getModerationPoolPDA(program.programId, content);
  const moderatorRegistry = getModeratorRegistryPDA(program.programId);

  return await program.methods
    .resolveModerationWithAttestation(attestationId)
    .accounts({
      content,
      moderationPool,
      report,
      moderatorRegistry,
      reporter,
      resolver,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export interface VoluntaryRemovalParams {
  program: Program;
  content: PublicKey;
  report: PublicKey;
  creator: PublicKey;
}

export async function createVoluntaryRemovalInstruction(
  params: VoluntaryRemovalParams
): Promise<TransactionInstruction> {
  const { program, content, report, creator } = params;

  const moderationPool = getModerationPoolPDA(program.programId, content);

  return await program.methods
    .voluntaryRemoval()
    .accounts({
      content,
      moderationPool,
      report,
      creator,
    })
    .instruction();
}

export interface InitializeModeratorRegistryParams {
  program: Program;
  admin: PublicKey;
  ecosystemConfig: PublicKey;
}

export async function createInitializeModeratorRegistryInstruction(
  params: InitializeModeratorRegistryParams
): Promise<TransactionInstruction> {
  const { program, admin, ecosystemConfig } = params;

  const moderatorRegistry = getModeratorRegistryPDA(program.programId);

  return await program.methods
    .initializeModeratorRegistry()
    .accounts({
      moderatorRegistry,
      ecosystemConfig,
      admin,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export interface RegisterModeratorParams {
  program: Program;
  moderator: PublicKey;
  stakeAmount: number | BN;
}

export async function createRegisterModeratorInstruction(
  params: RegisterModeratorParams
): Promise<TransactionInstruction> {
  const { program, moderator, stakeAmount } = params;

  const moderatorAccount = getModeratorAccountPDA(program.programId, moderator);
  const moderatorRegistry = getModeratorRegistryPDA(program.programId);

  const stake = typeof stakeAmount === "number" ? new BN(stakeAmount) : stakeAmount;

  return await program.methods
    .registerModerator(stake)
    .accounts({
      moderatorAccount,
      moderatorRegistry,
      moderator,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export interface UnregisterModeratorParams {
  program: Program;
  moderator: PublicKey;
}

export async function createUnregisterModeratorInstruction(
  params: UnregisterModeratorParams
): Promise<TransactionInstruction> {
  const { program, moderator } = params;

  const moderatorAccount = getModeratorAccountPDA(program.programId, moderator);
  const moderatorRegistry = getModeratorRegistryPDA(program.programId);

  return await program.methods
    .unregisterModerator()
    .accounts({
      moderatorAccount,
      moderatorRegistry,
      moderator,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export interface SlashModeratorParams {
  program: Program;
  target: PublicKey;
  admin: PublicKey;
  ecosystemConfig: PublicKey;
}

export async function createSlashModeratorInstruction(
  params: SlashModeratorParams
): Promise<TransactionInstruction> {
  const { program, target, admin, ecosystemConfig } = params;

  const moderatorAccount = getModeratorAccountPDA(program.programId, target);
  const moderatorRegistry = getModeratorRegistryPDA(program.programId);

  return await program.methods
    .slashModerator()
    .accounts({
      moderatorAccount,
      moderatorRegistry,
      ecosystemConfig,
      target,
      admin,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}
