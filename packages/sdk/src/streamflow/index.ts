import {
  SolanaStreamClient,
  getBN,
  getNumberFromBN,
  ICreateLinearStreamData,
  Stream,
  ICreateStreamExt,
  IInteractStreamExt,
  ICluster,
} from "@streamflow/stream";
import { Connection, PublicKey, Keypair, TransactionInstruction } from "@solana/web3.js";
import { SignerWalletAdapter } from "@solana/wallet-adapter-base";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  NATIVE_MINT,
} from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";

// Helper to convert bigint lamports to BN (already in smallest unit)
function lamportsToBN(lamports: bigint): BN {
  return new BN(lamports.toString());
}

// Stream durations
const SECONDS_PER_DAY = 86400;
const SECONDS_PER_MONTH = 30 * SECONDS_PER_DAY;
const SECONDS_PER_YEAR = 365 * SECONDS_PER_DAY;

export interface StreamflowConfig {
  cluster: "mainnet" | "devnet" | "testnet";
  rpcUrl?: string;
}

export interface CreateMembershipStreamParams {
  sender: PublicKey;
  /** CreatorPatronStreamingTreasury PDA - where streams go for epoch-based distribution */
  recipient: PublicKey;
  amountLamports: bigint;
  durationSeconds: number;
  name: string;
}

export interface CreateEcosystemStreamParams {
  sender: PublicKey;
  recipient: PublicKey; // Ecosystem treasury wallet address
  amountLamports: bigint;
  durationSeconds: number;
  name: string;
}

export interface StreamInfo {
  id: string;
  name: string; // Stream name - used to detect billing period (e.g., "EcoMembershipYr" = yearly)
  sender: string;
  recipient: string;
  mint: string;
  depositedAmount: BN;
  withdrawnAmount: BN;
  startTime: number;
  endTime: number;
  cliff: number;
  cliffAmount: BN;
  amountPerPeriod: BN;
  period: number;
  cancelableBySender: boolean;
  cancelableByRecipient: boolean;
  automaticWithdrawal: boolean;
  canceledAt: number; // 0 = active, >0 = timestamp when cancelled
}

// Wallet signer type - use generic to avoid web3.js version conflicts
type WalletSigner = SignerWalletAdapter | Keypair;

/**
 * Internal helper to calculate available amount from a stream.
 * Used by the class method before the exported function is defined.
 */
function calculateStreamAvailable(stream: StreamInfo, nowSeconds: number): bigint {
  // If stream hasn't started yet, nothing is released
  if (nowSeconds < stream.startTime) {
    return BigInt(0);
  }

  // Calculate elapsed time since cliff (when streaming starts)
  const elapsedSinceCliff = Math.max(0, nowSeconds - stream.cliff);

  // Calculate released amount
  const periodsElapsed = Math.floor(elapsedSinceCliff / stream.period);
  const streamedAmount = BigInt(stream.amountPerPeriod.toString()) * BigInt(periodsElapsed);
  const cliffAmount = BigInt(stream.cliffAmount.toString());
  const depositedAmount = BigInt(stream.depositedAmount.toString());

  // Released is min of (cliff + streamed, deposited)
  const released = streamedAmount + cliffAmount;
  const actualReleased = released > depositedAmount ? depositedAmount : released;

  // Available = Released - Withdrawn
  const withdrawn = BigInt(stream.withdrawnAmount.toString());
  const available = actualReleased - withdrawn;

  return available > BigInt(0) ? available : BigInt(0);
}

/**
 * Streamflow client for creating and managing payment streams.
 * Used for membership subscriptions where payments flow over time to creator treasuries.
 */
export class StreamflowClient {
  private client: SolanaStreamClient;
  private connection: Connection;

  constructor(config: StreamflowConfig) {
    const clusterUrl = config.rpcUrl || this.getDefaultRpcUrl(config.cluster);
    // Pass cluster to use correct program ID (devnet vs mainnet)
    this.client = new SolanaStreamClient(clusterUrl, config.cluster as ICluster);
    this.connection = new Connection(clusterUrl);
  }

  private getDefaultRpcUrl(cluster: "mainnet" | "devnet" | "testnet"): string {
    switch (cluster) {
      case "mainnet":
        return "https://api.mainnet-beta.solana.com";
      case "devnet":
        return "https://api.devnet.solana.com";
      case "testnet":
        return "https://api.testnet.solana.com";
    }
  }

  /**
   * Prepare instructions to set up WSOL ATAs for a native SOL stream.
   * Only creates ATAs if they don't exist - Streamflow handles SOL wrapping with isNative: true.
   *
   * This is a workaround for a Streamflow SDK bug with native SOL ATA creation.
   *
   * @param sender The sender wallet
   * @param recipient The recipient wallet
   * @returns Instructions to execute, or empty array if ATAs already exist
   */
  async prepareNativeSolStream(
    sender: PublicKey,
    recipient: PublicKey
  ): Promise<TransactionInstruction[]> {
    const senderAta = await getAssociatedTokenAddress(NATIVE_MINT, sender);
    const recipientAta = await getAssociatedTokenAddress(NATIVE_MINT, recipient);

    const [senderAtaInfo, recipientAtaInfo] = await Promise.all([
      this.connection.getAccountInfo(senderAta),
      this.connection.getAccountInfo(recipientAta),
    ]);

    const instructions: TransactionInstruction[] = [];

    // Create sender ATA if needed
    if (!senderAtaInfo) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          sender,
          senderAta,
          sender,
          NATIVE_MINT
        )
      );
    }

    // Create recipient ATA if needed
    if (!recipientAtaInfo) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          sender,
          recipientAta,
          recipient,
          NATIVE_MINT
        )
      );
    }

    return instructions;
  }

  /**
   * Create a membership stream to a creator's treasury PDA.
   * The stream releases tokens linearly over the subscription period.
   * Streams go to CreatorPatronStreamingTreasury PDA for epoch-based distribution.
   *
   * Uses isNative: true so Streamflow handles SOL wrapping in a single transaction.
   * Streamflow charges a 0.25% fee that's deducted from the stream amount.
   *
   * @param params Stream creation parameters
   * @param signer Wallet adapter or keypair to sign the transaction
   */
  async createMembershipStream(
    params: CreateMembershipStreamParams,
    signer: WalletSigner
  ): Promise<{ streamId: string; txSignature: string }> {
    const startTime = Math.floor(Date.now() / 1000) + 60; // Start 60 seconds from now

    // Calculate per-second release rate for linear streaming
    const releaseFrequency = 1; // Release every 1 second
    const amountPerPeriod = new BN(
      Math.floor(Number(params.amountLamports) / params.durationSeconds)
    );

    // Adjust amount to be evenly divisible by duration for exact end time
    // This prevents rounding errors that extend the stream duration
    const amountBN = amountPerPeriod.muln(params.durationSeconds);

    const streamData: ICreateLinearStreamData = {
      recipient: params.recipient.toBase58(), // Treasury PDA for epoch-based distribution
      tokenId: NATIVE_MINT.toBase58(), // Native SOL (wrapped by Streamflow)
      amount: amountBN,
      period: releaseFrequency, // Release every 1 second
      start: startTime,
      cliff: startTime, // Immediate start, no cliff
      cliffAmount: new BN(0),
      amountPerPeriod: amountPerPeriod, // Amount released per second
      name: params.name.slice(0, 64),
      canTopup: true, // Allow renewal via topup
      cancelableBySender: true, // User can cancel
      cancelableByRecipient: false, // Treasury can't cancel
      transferableBySender: false,
      transferableByRecipient: false,
      automaticWithdrawal: true, // Streamflow auto-withdraws to treasury
      withdrawalFrequency: 86400, // Daily (matches epoch duration)
    };

    // Use isNative: true - Streamflow wraps SOL in a single transaction
    const solanaParams = {
      sender: signer,
      isNative: true,
    } as unknown as ICreateStreamExt;

    const result = await this.client.create(streamData, solanaParams);

    return {
      streamId: result.metadataId,
      txSignature: result.txId || "",
    };
  }

  /**
   * Create an ecosystem subscription stream.
   * Streams to the ecosystem treasury wallet for platform-wide access.
   *
   * Uses isNative: true so Streamflow handles SOL wrapping in a single transaction.
   * Streamflow charges a 0.25% fee that's deducted from the stream amount.
   *
   * @param params Stream creation parameters
   * @param signer Wallet adapter or keypair to sign the transaction
   */
  async createEcosystemStream(
    params: CreateEcosystemStreamParams,
    signer: WalletSigner
  ): Promise<{ streamId: string; txSignature: string }> {
    const startTime = Math.floor(Date.now() / 1000) + 60; // Start 60 seconds from now

    // Calculate per-second release rate for linear streaming
    const releaseFrequency = 1; // Release every 1 second
    const amountPerPeriod = new BN(
      Math.floor(Number(params.amountLamports) / params.durationSeconds)
    );

    // Adjust amount to be evenly divisible by duration for exact end time
    // This prevents rounding errors that extend the stream duration
    const amountBN = amountPerPeriod.muln(params.durationSeconds);

    const streamData: ICreateLinearStreamData = {
      recipient: params.recipient.toBase58(),
      tokenId: NATIVE_MINT.toBase58(), // Native SOL (wrapped by Streamflow)
      amount: amountBN,
      period: releaseFrequency, // Release every 1 second
      start: startTime,
      cliff: startTime,
      cliffAmount: new BN(0),
      amountPerPeriod: amountPerPeriod, // Amount released per second
      name: params.name.slice(0, 64),
      canTopup: true, // Allow renewal via topup
      cancelableBySender: true,
      cancelableByRecipient: false,
      transferableBySender: false,
      transferableByRecipient: false,
      automaticWithdrawal: true, // Streamflow auto-withdraws to treasury
      withdrawalFrequency: 86400, // Daily (matches epoch duration)
    };

    // Use isNative: true - Streamflow wraps SOL in a single transaction
    const solanaParams = {
      sender: signer,
      isNative: true,
    } as unknown as ICreateStreamExt;

    const result = await this.client.create(streamData, solanaParams);

    return {
      streamId: result.metadataId,
      txSignature: result.txId || "",
    };
  }

  /**
   * Cancel an active stream. Only the sender can cancel.
   * Remaining funds are returned to the sender.
   *
   * @param streamId The stream ID to cancel
   * @param signer Wallet adapter or keypair to sign the transaction
   */
  async cancelStream(
    streamId: string,
    signer: WalletSigner
  ): Promise<{ txSignature: string }> {
    // Use double type assertion to handle web3.js version differences
    const result = await this.client.cancel({
      id: streamId,
    }, {
      invoker: signer,
    } as unknown as IInteractStreamExt);

    return {
      txSignature: result.txId || "",
    };
  }

  /**
   * Get details of a specific stream.
   *
   * @param streamId The stream ID to query
   */
  async getStream(streamId: string): Promise<StreamInfo | null> {
    try {
      const stream = await this.client.getOne({ id: streamId });
      if (!stream) return null;

      return this.mapStreamToInfo(streamId, stream);
    } catch {
      return null;
    }
  }

  /**
   * Get all streams for a wallet (as sender or recipient).
   *
   * @param wallet The wallet address to query
   */
  async getStreamsForWallet(wallet: PublicKey): Promise<StreamInfo[]> {
    try {
      const streams = await this.client.get({ address: wallet.toBase58() });

      // streams is an array of [id, stream] tuples
      return streams.map(([id, stream]) =>
        this.mapStreamToInfo(id, stream)
      );
    } catch {
      return [];
    }
  }

  /**
   * Get all streams where the wallet is the recipient (incoming streams).
   * Useful for treasury PDAs to find all membership streams.
   *
   * @param recipient The recipient wallet address
   */
  async getIncomingStreams(recipient: PublicKey): Promise<StreamInfo[]> {
    try {
      const allStreams = await this.getStreamsForWallet(recipient);
      // Filter to only streams where this wallet is the recipient
      return allStreams.filter(s => s.recipient === recipient.toBase58());
    } catch {
      return [];
    }
  }

  /**
   * Calculate total available to withdraw from all incoming streams.
   * This is the amount that can be withdrawn to the treasury's WSOL ATA.
   *
   * @param recipient The recipient wallet (treasury PDA)
   */
  async getTotalAvailableForRecipient(recipient: PublicKey): Promise<bigint> {
    const streams = await this.getIncomingStreams(recipient);
    const now = Math.floor(Date.now() / 1000);

    return streams.reduce((total, stream) => {
      // Only include active streams (not cancelled)
      if (stream.canceledAt > 0) return total;

      // Calculate available for this stream
      const available = calculateStreamAvailable(stream, now);
      return total + available;
    }, BigInt(0));
  }

  private mapStreamToInfo(id: string, stream: Stream): StreamInfo {
    // Decode stream name - Streamflow may return as string or byte array
    let name = "";
    const rawName = (stream as any).name;
    if (rawName) {
      if (typeof rawName === "string") {
        // Already a string
        name = rawName;
      } else if (Array.isArray(rawName) || rawName instanceof Uint8Array) {
        // Byte array - filter out null bytes and convert to string
        const validBytes = Array.from(rawName).filter((b: number) => b !== 0);
        name = String.fromCharCode(...validBytes);
      }
    }

    return {
      id,
      name,
      sender: stream.sender,
      recipient: stream.recipient,
      mint: stream.mint,
      depositedAmount: new BN(stream.depositedAmount.toString()),
      withdrawnAmount: new BN(stream.withdrawnAmount.toString()),
      startTime: Number(stream.start),
      endTime: Number(stream.end),
      cliff: Number(stream.cliff),
      cliffAmount: new BN(stream.cliffAmount.toString()),
      amountPerPeriod: new BN(stream.amountPerPeriod.toString()),
      period: Number(stream.period),
      cancelableBySender: stream.cancelableBySender,
      cancelableByRecipient: stream.cancelableByRecipient,
      automaticWithdrawal: stream.automaticWithdrawal,
      canceledAt: Number((stream as any).canceledAt) || 0,
    };
  }

  /**
   * Topup an existing stream to extend its duration.
   * Used for subscription renewals - adds more funds to extend the stream.
   *
   * Uses isNative: true so Streamflow handles SOL wrapping in a single transaction.
   *
   * @param streamId The stream ID to topup
   * @param amount Amount in lamports to add
   * @param signer Wallet adapter or keypair to sign the transaction
   */
  async topupStream(
    streamId: string,
    amount: bigint,
    signer: WalletSigner
  ): Promise<{ txSignature: string }> {
    // Get the stream to find its amountPerPeriod
    const stream = await this.getStream(streamId);
    if (!stream) {
      throw new Error("Stream not found");
    }

    // Adjust topup amount to be evenly divisible by amountPerPeriod
    // This ensures the extension duration is exact (no rounding errors)
    const amountPerPeriod = stream.amountPerPeriod.toNumber();
    const adjustedAmount = Math.floor(Number(amount) / amountPerPeriod) * amountPerPeriod;
    const topupAmount = new BN(adjustedAmount);

    // Use isNative: true - Streamflow handles SOL wrapping
    const result = await this.client.topup({
      id: streamId,
      amount: topupAmount,
    }, {
      invoker: signer,
      isNative: true,
    } as unknown as IInteractStreamExt);

    return {
      txSignature: result.txId || "",
    };
  }

  /**
   * Withdraw available funds from a stream.
   * Used by treasury to claim accumulated payments.
   *
   * @param streamId The stream ID to withdraw from
   * @param amount Amount in lamports to withdraw (or undefined for all available)
   * @param signer Wallet adapter or keypair to sign the transaction
   */
  async withdrawFromStream(
    streamId: string,
    amount: bigint | undefined,
    signer: WalletSigner
  ): Promise<{ txSignature: string }> {
    const withdrawAmount = amount ? lamportsToBN(amount) : undefined;

    // Use double type assertion to handle web3.js version differences
    const result = await this.client.withdraw({
      id: streamId,
      amount: withdrawAmount,
    }, {
      invoker: signer,
    } as unknown as IInteractStreamExt);

    return {
      txSignature: result.txId || "",
    };
  }
}

/**
 * Helper to calculate monthly membership stream amount.
 * Creates a stream that releases over 30 days.
 * @param treasuryPda CreatorPatronStreamingTreasury PDA where stream goes
 */
export function createMonthlyStreamParams(
  treasuryPda: PublicKey,
  monthlyPriceLamports: bigint,
  name: string = "Membership"
): Omit<CreateMembershipStreamParams, "sender"> {
  return {
    recipient: treasuryPda,
    amountLamports: monthlyPriceLamports,
    durationSeconds: SECONDS_PER_MONTH,
    name,
  };
}

/**
 * Helper to calculate yearly membership stream amount.
 * Uses 10 months price for 12 months access (2 months free).
 * Creates a stream that releases over 365 days.
 * @param treasuryPda CreatorPatronStreamingTreasury PDA where stream goes
 */
export function createYearlyStreamParams(
  treasuryPda: PublicKey,
  monthlyPriceLamports: bigint,
  name: string = "Annual Membership"
): Omit<CreateMembershipStreamParams, "sender"> {
  // 10 months for 12 months access (2 months free)
  const yearlyPrice = monthlyPriceLamports * BigInt(10);

  return {
    recipient: treasuryPda,
    amountLamports: yearlyPrice,
    durationSeconds: SECONDS_PER_YEAR,
    name,
  };
}

/**
 * Calculate available amount to withdraw from a stream.
 * Available = Released - Withdrawn
 * Released = min(deposited, timeElapsed * amountPerPeriod + cliffAmount)
 *
 * @param stream The stream info
 * @param nowSeconds Current unix timestamp in seconds
 * @returns Available amount in lamports (bigint)
 */
export function calculateAvailableToWithdraw(stream: StreamInfo, nowSeconds?: number): bigint {
  const now = nowSeconds ?? Math.floor(Date.now() / 1000);

  // If stream hasn't started yet, nothing is released
  if (now < stream.startTime) {
    return BigInt(0);
  }

  // If stream is cancelled, calculate based on cancel time
  const effectiveTime = stream.canceledAt > 0 ? stream.canceledAt : now;

  // Calculate elapsed time since cliff (when streaming starts)
  const elapsedSinceCliff = Math.max(0, effectiveTime - stream.cliff);

  // Calculate released amount
  const periodsElapsed = Math.floor(elapsedSinceCliff / stream.period);
  const streamedAmount = BigInt(stream.amountPerPeriod.toString()) * BigInt(periodsElapsed);
  const cliffAmount = BigInt(stream.cliffAmount.toString());
  const depositedAmount = BigInt(stream.depositedAmount.toString());

  // Released is min of (cliff + streamed, deposited)
  const released = streamedAmount + cliffAmount;
  const actualReleased = released > depositedAmount ? depositedAmount : released;

  // Available = Released - Withdrawn
  const withdrawn = BigInt(stream.withdrawnAmount.toString());
  const available = actualReleased - withdrawn;

  return available > BigInt(0) ? available : BigInt(0);
}

/**
 * Calculate total available to withdraw from multiple streams.
 * Useful for calculating pending treasury balance across all subscriptions.
 *
 * @param streams Array of stream infos
 * @param nowSeconds Current unix timestamp in seconds
 * @returns Total available amount in lamports (bigint)
 */
export function calculateTotalAvailableToWithdraw(streams: StreamInfo[], nowSeconds?: number): bigint {
  return streams.reduce(
    (total, stream) => total + calculateAvailableToWithdraw(stream, nowSeconds),
    BigInt(0)
  );
}

// Export constants
export {
  SECONDS_PER_DAY,
  SECONDS_PER_MONTH,
  SECONDS_PER_YEAR,
};

// Re-export useful Streamflow utilities
export { getBN, getNumberFromBN };
