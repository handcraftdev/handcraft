"use client";

import { useState, useCallback, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { useConnection } from "@solana/wallet-adapter-react";
import { BN } from "@coral-xyz/anchor";
import {
  TribunalCraftClient,
  isDisputePending,
  getDisputeTypeName,
  type Dispute,
  type Subject,
} from "@tribunalcraft/sdk";
import { SidebarPanel } from "@/components/sidebar";
import { useTribunalcraft } from "@/hooks/useTribunalcraft";

type Tab = "disputes" | "juror";

// Countdown component
function Countdown({ endTime }: { endTime: number }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = Date.now();
      const diff = endTime - now;
      if (diff <= 0) {
        setTimeLeft("Ended");
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      if (days > 0) setTimeLeft(`${days}d ${hours}h`);
      else if (hours > 0) setTimeLeft(`${hours}h ${minutes}m`);
      else setTimeLeft(`${minutes}m`);
    };
    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 60000);
    return () => clearInterval(interval);
  }, [endTime]);

  const isUrgent = endTime - Date.now() < 1000 * 60 * 60;
  return <span className={isUrgent ? "text-red-400" : "text-orange-400"}>{timeLeft}</span>;
}

// Dispute Card Component - Tribunalcraft SubjectModal style
function DisputeCard({
  subject,
  dispute,
  onVoteSuccess,
}: {
  subject: Subject;
  dispute: Dispute;
  onVoteSuccess?: () => void;
}) {
  const [defenderAmount, setDefenderAmount] = useState("0.1");
  const [challengerAmount, setChallengerAmount] = useState("0.05");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { client, isConnected } = useTribunalcraft();

  const now = Date.now();
  const votingEndsAt = dispute.votingEndsAt.toNumber() * 1000;
  const isActive = isDisputePending(dispute.status) && votingEndsAt > now;
  const votingPeriodHours = Math.floor(subject.votingPeriod.toNumber() / 3600);

  // Bond/Stake values
  const totalBond = subject.availableBond.toNumber() / 1e9;
  const bondAtRisk = dispute.bondAtRisk.toNumber() / 1e9;
  const safeBond = totalBond - bondAtRisk;
  const totalStake = dispute.totalStake.toNumber() / 1e9;

  // Vote counts
  const defenderVotes = dispute.votesForDefender.toNumber() / 1e9;
  const challengerVotes = dispute.votesForChallenger.toNumber() / 1e9;
  const totalVotes = defenderVotes + challengerVotes;
  const defenderPercent = totalVotes > 0 ? (defenderVotes / totalVotes) * 100 : 50;

  // Reward distribution (20% fee, 80% winners, 19% jurors, 1% protocol)
  const totalPool = totalStake + bondAtRisk;
  const protocolFee = totalPool * 0.20;
  const winnersPool = protocolFee * 0.80;
  const jurorsPool = protocolFee * 0.19;
  const protocolPool = protocolFee * 0.01;

  const handleDefend = async () => {
    if (!isConnected || !client) {
      setError("Please connect your wallet");
      return;
    }

    const stakeLamports = Math.floor(parseFloat(defenderAmount || "0") * 1e9);
    if (stakeLamports < 0.01 * 1e9) {
      setError("Minimum is 0.01 SOL");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await client.addBondDirect(subject.subjectId, new BN(stakeLamports));
      onVoteSuccess?.();
    } catch (err) {
      console.error("Add bond failed:", err);
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChallenge = async () => {
    if (!isConnected || !client) {
      setError("Please connect your wallet");
      return;
    }

    const stakeLamports = Math.floor(parseFloat(challengerAmount || "0") * 1e9);
    if (stakeLamports < 0.01 * 1e9) {
      setError("Minimum is 0.01 SOL");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await client.joinChallengers({
        subjectId: subject.subjectId,
        stake: new BN(stakeLamports),
        detailsCid: "",
      });
      onVoteSuccess?.();
    } catch (err) {
      console.error("Join challengers failed:", err);
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#0a0a0c] border border-white/10 rounded-lg overflow-hidden">
      {/* Two Column Layout: Defender | Challenger */}
      <div className="grid grid-cols-2 divide-x divide-white/10">
        {/* DEFENDER Section */}
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 bg-sky-500 rounded" />
            <span className="text-sm font-semibold text-white/90 uppercase tracking-wider">Defender</span>
          </div>
          <p className="text-[10px] text-white/40 font-mono truncate">{subject.subjectId.toBase58()}</p>

          {/* Subject Info */}
          <div className="p-3 bg-black/50 border border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-sky-400 font-medium">Untitled Subject</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-white/50">Match</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded">Disputed</span>
                <span className="text-[10px] text-white/40">{votingPeriodHours}h</span>
              </div>
            </div>
            <div className="space-y-1 text-xs">
              <div><span className="text-white/40">Total Bond: </span><span className="text-sky-400">{totalBond.toFixed(6)}</span></div>
              <div><span className="text-white/40">At Risk: </span><span className="text-red-400">{bondAtRisk.toFixed(6)}</span></div>
              <div><span className="text-white/40">Safe: </span><span className="text-green-400">{safeBond.toFixed(6)}</span></div>
              <div><span className="text-white/40">Defenders: </span><span className="text-sky-400">{subject.defenderCount}</span></div>
            </div>
          </div>

          {/* Join Defenders */}
          {isActive && (
            <div className="space-y-2">
              <div className="flex items-center bg-black/50 border border-white/10 rounded">
                <input
                  type="number"
                  step="0.01"
                  value={defenderAmount}
                  onChange={(e) => setDefenderAmount(e.target.value)}
                  className="flex-1 px-3 py-2.5 bg-transparent text-white text-sm focus:outline-none"
                />
                <span className="px-3 text-white/40 text-sm">SOL</span>
              </div>
              <button
                onClick={handleDefend}
                disabled={isLoading || !isConnected}
                className="w-full py-3 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-400 font-semibold text-sm uppercase tracking-wider transition-colors disabled:opacity-50"
              >
                {isLoading ? "..." : "Add Bond"}
              </button>
            </div>
          )}
        </div>

        {/* CHALLENGER Section */}
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 bg-red-500 rounded" />
            <span className="text-sm font-semibold text-white/90 uppercase tracking-wider">Challenger</span>
          </div>
          <p className="text-[10px] text-white/40 font-mono truncate">{dispute.subjectId.toBase58()}</p>

          {/* Dispute Info */}
          <div className="p-3 bg-black/50 border border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-red-400 font-medium">Untitled Dispute</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] px-1.5 py-0.5 bg-white/10 text-white/60 rounded">{getDisputeTypeName(dispute.disputeType)}</span>
                <span className="text-[10px] text-white/40">{(100 - defenderPercent).toFixed(1)}%</span>
              </div>
            </div>
            <div className="space-y-1 text-xs">
              <div><span className="text-white/40">Stake: </span><span className="text-red-400">{totalStake.toFixed(6)}</span></div>
              <div><span className="text-white/40">Challengers: </span><span className="text-red-400">{dispute.challengerCount}</span></div>
            </div>
          </div>

          {/* Join Challengers */}
          {isActive && (
            <div className="space-y-2">
              <div className="flex items-center bg-black/50 border border-white/10 rounded">
                <input
                  type="number"
                  step="0.01"
                  value={challengerAmount}
                  onChange={(e) => setChallengerAmount(e.target.value)}
                  className="flex-1 px-3 py-2.5 bg-transparent text-white text-sm focus:outline-none"
                />
                <span className="px-3 text-white/40 text-sm">SOL</span>
              </div>
              <button
                onClick={handleChallenge}
                disabled={isLoading || !isConnected}
                className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-semibold text-sm uppercase tracking-wider transition-colors disabled:opacity-50"
              >
                {isLoading ? "..." : "Join Challengers"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Vote Progress Section */}
      <div className="border-t border-white/10 p-4 space-y-3">
        {/* Labels */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-sky-400 font-semibold uppercase">{dispute.defenderCount} Defender{dispute.defenderCount !== 1 ? 's' : ''}</span>
          <span className="text-white/30">VS</span>
          <span className="text-red-400 font-semibold uppercase">{dispute.challengerCount} Challenger{dispute.challengerCount !== 1 ? 's' : ''}</span>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-white/5 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-sky-500 transition-all duration-500"
            style={{ width: `${defenderPercent}%` }}
          />
          <div
            className="h-full bg-red-500 transition-all duration-500"
            style={{ width: `${100 - defenderPercent}%` }}
          />
        </div>

        {/* Stats Row */}
        <div className="flex items-center justify-between text-[10px]">
          <div className="text-sky-400">
            {defenderVotes.toFixed(6)} · {dispute.voteCount > 0 ? Math.round(defenderPercent) : 0} · {defenderPercent.toFixed(1)}%
          </div>
          <div className="flex items-center gap-1 text-white/50">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <Countdown endTime={votingEndsAt} />
          </div>
          <div className="text-red-400">
            {(100 - defenderPercent).toFixed(1)}% · {dispute.voteCount > 0 ? Math.round(100 - defenderPercent) : 0} · {challengerVotes.toFixed(6)}
          </div>
        </div>

        {/* Reward Distribution */}
        <div className="pt-3 border-t border-white/5">
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">
            Reward Distribution ({totalPool.toFixed(4)} SOL)
          </p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-sm font-semibold text-amber-400">{winnersPool.toFixed(4)}</p>
              <p className="text-[10px] text-white/40">Winners (80%)</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-purple-400">{jurorsPool.toFixed(4)}</p>
              <p className="text-[10px] text-white/40">Jurors (19%)</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-white/60">{protocolPool.toFixed(4)}</p>
              <p className="text-[10px] text-white/40">Protocol (1%)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="border-t border-white/10 p-4">
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded p-2">
            {error}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ModerationPage() {
  const { connected } = useWallet();
  const { connection } = useConnection();
  const [activeTab, setActiveTab] = useState<Tab>("disputes");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = useCallback(() => setIsSidebarOpen((prev) => !prev), []);

  // Fetch active disputes from Tribunalcraft
  // Only fetch on mount and manual refresh - no polling to avoid excessive RPC calls
  const {
    data: activeDisputes,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["tribunalcraft-active-disputes"],
    queryFn: async () => {
      const client = new TribunalCraftClient({ connection });

      // Fetch all disputes directly instead of fetching subjects then disputes
      const allDisputes = await client.fetchAllDisputes();

      // Filter for pending disputes and fetch their subjects
      const pendingDisputes = allDisputes.filter(({ account }) => isDisputePending(account.status));

      const disputesWithSubjects = await Promise.all(
        pendingDisputes.map(async ({ account: dispute }) => {
          const subject = await client.fetchSubjectById(dispute.subjectId);
          if (subject) {
            return { subject, dispute };
          }
          return null;
        })
      );

      return disputesWithSubjects.filter((d): d is NonNullable<typeof d> => d !== null);
    },
    staleTime: 60_000, // Cache for 1 minute
    refetchOnWindowFocus: false, // Don't refetch on window focus
    // No refetchInterval - manual refresh only
  });

  if (!connected) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-purple-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Connect Wallet</h1>
          <p className="text-white/50 text-sm">
            Connect your wallet to access moderation
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <SidebarPanel isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Menu Button */}
      <button
        onClick={toggleSidebar}
        className={`fixed top-4 z-50 p-3 bg-white/5 backdrop-blur-md rounded-full border border-white/10 hover:border-white/20 transition-all duration-300 ${
          isSidebarOpen ? "left-[304px]" : "left-4"
        }`}
      >
        <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <main className="max-w-4xl mx-auto px-6 py-20">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Moderation</h1>
              <p className="text-sm text-white/40">
                Powered by{" "}
                <a
                  href="https://tribunalcraft.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:text-purple-300"
                >
                  Tribunalcraft
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="p-4 bg-white/[0.02] border border-white/10 rounded-xl">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-white/40 uppercase tracking-wider">Active Disputes</p>
              <button
                onClick={() => refetch()}
                disabled={isLoading}
                className="p-1 hover:bg-white/10 rounded transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <svg className={`w-3.5 h-3.5 text-white/40 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
            <p className="text-2xl font-bold text-white mt-1">{activeDisputes?.length ?? 0}</p>
          </div>
          <div className="p-4 bg-white/[0.02] border border-white/10 rounded-xl">
            <p className="text-[10px] text-white/40 uppercase tracking-wider">Protocol</p>
            <p className="text-lg font-semibold text-purple-400 mt-1">Tribunalcraft</p>
          </div>
          <div className="p-4 bg-white/[0.02] border border-white/10 rounded-xl">
            <p className="text-[10px] text-white/40 uppercase tracking-wider">Network</p>
            <p className="text-lg font-semibold text-white mt-1">Devnet</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 bg-white/[0.02] rounded-lg border border-white/5 w-fit">
          <button
            onClick={() => setActiveTab("disputes")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "disputes"
                ? "bg-white/10 text-white"
                : "text-white/50 hover:text-white"
            }`}
          >
            Active Disputes
          </button>
          <button
            onClick={() => setActiveTab("juror")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "juror"
                ? "bg-white/10 text-white"
                : "text-white/50 hover:text-white"
            }`}
          >
            Become a Juror
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "disputes" && (
          <div className="space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
              </div>
            ) : !activeDisputes || activeDisputes.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-green-500/10 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-white/70">No active disputes</h3>
                <p className="text-sm text-white/40 mt-1">All content is in good standing</p>
              </div>
            ) : (
              activeDisputes.map(({ subject, dispute }) => (
                <DisputeCard
                  key={subject.subjectId.toBase58()}
                  subject={subject}
                  dispute={dispute}
                  onVoteSuccess={() => refetch()}
                />
              ))
            )}
          </div>
        )}

        {activeTab === "juror" && (
          <div className="max-w-lg">
            <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Become a Juror</h3>
                  <p className="text-sm text-white/50">Help resolve disputes and earn rewards</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="p-4 bg-black/30 border border-white/5 rounded-lg">
                  <h4 className="text-sm font-medium text-white/70 mb-3">How It Works</h4>
                  <ul className="text-sm text-white/50 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400 font-medium">1.</span>
                      Stake SOL to register as a juror
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400 font-medium">2.</span>
                      Vote on active disputes within the voting period
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400 font-medium">3.</span>
                      Earn rewards when your vote aligns with the majority
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400 font-medium">4.</span>
                      Build reputation through accurate voting
                    </li>
                  </ul>
                </div>

                <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                  <p className="text-sm text-purple-300">
                    Register as a juror on the{" "}
                    <a
                      href="https://tribunalcraft.io"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium underline hover:text-purple-200"
                    >
                      Tribunalcraft App
                    </a>
                  </p>
                </div>
              </div>

              <a
                href="https://tribunalcraft.io"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-3 bg-purple-500/20 hover:bg-purple-500/30 rounded-lg font-medium transition-colors border border-purple-500/30 text-purple-400 text-center text-sm"
              >
                Open Tribunalcraft App
              </a>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
