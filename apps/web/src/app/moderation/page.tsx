"use client";

import { useState, useCallback } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useModeration, MIN_MODERATOR_STAKE, ContentReport } from "@/hooks/useModeration";
import { VotingPanel } from "@/components/moderation";
import { SidebarPanel } from "@/components/sidebar";

type Tab = "reports" | "moderator" | "stats";
type PendingReport = { publicKey: PublicKey; account: ContentReport };

export default function ModerationPage() {
  const { publicKey, connected } = useWallet();
  const {
    isModerator,
    moderatorAccount,
    moderatorRegistry,
    pendingReports,
    isLoadingReports,
    isLoadingModerator,
    registerModerator,
    unregisterModerator,
  } = useModeration();

  const [activeTab, setActiveTab] = useState<Tab>("reports");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [stakeAmount, setStakeAmount] = useState(MIN_MODERATOR_STAKE / 1e9); // Default 0.1 SOL
  const [error, setError] = useState<string | null>(null);

  const toggleSidebar = useCallback(() => setIsSidebarOpen(prev => !prev), []);

  const handleRegister = async () => {
    setError(null);
    try {
      await registerModerator.mutateAsync({ stakeAmount: stakeAmount * 1e9 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register as moderator");
    }
  };

  const handleUnregister = async () => {
    setError(null);
    try {
      await unregisterModerator.mutateAsync();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unregister");
    }
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-[#030305] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Connect Wallet</h1>
          <p className="text-white/50">Please connect your wallet to access the moderation dashboard</p>
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
        className={`fixed top-4 z-50 p-3 bg-white/5 backdrop-blur-md rounded-full border border-white/10 hover:border-white/20 transition-all duration-300 ${isSidebarOpen ? 'left-[304px]' : 'left-4'}`}
      >
        <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <main className="max-w-5xl mx-auto px-6 py-20">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 tracking-tight">Moderation</h1>
          <p className="text-white/40">Community-driven content moderation</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4">
            <h3 className="text-sm font-medium text-white/50">Active Moderators</h3>
            <p className="text-2xl font-bold text-white mt-1">
              {moderatorRegistry?.activeModerators.toString() ?? "0"}
            </p>
          </div>
          <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4">
            <h3 className="text-sm font-medium text-white/50">Pending Reports</h3>
            <p className="text-2xl font-bold text-white mt-1">
              {pendingReports.length}
            </p>
          </div>
          <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4">
            <h3 className="text-sm font-medium text-white/50">Total Votes Cast</h3>
            <p className="text-2xl font-bold text-white mt-1">
              {moderatorRegistry?.totalVotesCast.toString() ?? "0"}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-white/10 pb-4">
          <button
            onClick={() => setActiveTab("reports")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "reports"
                ? "bg-white/10 text-white"
                : "text-white/50 hover:text-white"
            }`}
          >
            Active Reports
          </button>
          <button
            onClick={() => setActiveTab("moderator")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "moderator"
                ? "bg-white/10 text-white"
                : "text-white/50 hover:text-white"
            }`}
          >
            Moderator Status
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "reports" && (
          <div className="space-y-4">
            {isLoadingReports ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
              </div>
            ) : pendingReports.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 mx-auto text-white/10 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-lg font-medium text-white/70">No pending reports</h3>
                <p className="text-sm text-white/40 mt-1">All reports have been resolved</p>
              </div>
            ) : (
              pendingReports.map(({ publicKey: reportPda, account }: PendingReport) => (
                <VotingPanel
                  key={reportPda.toBase58()}
                  report={account}
                  reportPda={reportPda}
                />
              ))
            )}
          </div>
        )}

        {activeTab === "moderator" && (
          <div className="max-w-md">
            {isLoadingModerator ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
              </div>
            ) : isModerator && moderatorAccount ? (
              <div className="space-y-6">
                <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">Active Moderator</h3>
                      <p className="text-sm text-white/50">You are registered as a moderator</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <p className="text-xs text-white/40">Stake</p>
                      <p className="text-lg font-medium text-white">
                        {(Number(moderatorAccount.stake) / 1e9).toFixed(2)} SOL
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-white/40">Reputation</p>
                      <p className="text-lg font-medium text-white">
                        {(moderatorAccount.reputation / 100).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-white/40">Votes Cast</p>
                      <p className="text-lg font-medium text-white">
                        {moderatorAccount.votesCast.toString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-white/40">Correct Votes</p>
                      <p className="text-lg font-medium text-white">
                        {moderatorAccount.correctVotes.toString()}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleUnregister}
                    disabled={unregisterModerator.isPending}
                    className="w-full py-3 bg-red-500/20 hover:bg-red-500/30 rounded-xl font-medium transition-colors border border-red-500/30 text-red-400 disabled:opacity-50"
                  >
                    {unregisterModerator.isPending ? "Processing..." : "Unregister & Withdraw Stake"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-2">Become a Moderator</h3>
                <p className="text-sm text-white/50 mb-6">
                  Stake SOL to become a community moderator and help keep the platform safe.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">Stake Amount (SOL)</label>
                    <input
                      type="number"
                      min={MIN_MODERATOR_STAKE / 1e9}
                      step={0.1}
                      value={stakeAmount}
                      onChange={(e) => setStakeAmount(parseFloat(e.target.value) || 0)}
                      className="w-full px-4 py-3 bg-white/[0.02] border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                    />
                    <p className="text-xs text-white/40 mt-1">Minimum: {MIN_MODERATOR_STAKE / 1e9} SOL</p>
                  </div>

                  {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
                      {error}
                    </div>
                  )}

                  <div className="p-4 bg-white/[0.02] border border-white/10 rounded-xl">
                    <h4 className="text-sm font-medium text-white/70 mb-2">Moderator Benefits & Responsibilities</h4>
                    <ul className="text-xs text-white/50 space-y-1">
                      <li>- Vote on content reports within 7-day windows</li>
                      <li>- Build reputation through accurate voting</li>
                      <li>- Help maintain platform quality</li>
                      <li>- Malicious behavior may result in stake slashing</li>
                    </ul>
                  </div>

                  <button
                    onClick={handleRegister}
                    disabled={registerModerator.isPending || stakeAmount < MIN_MODERATOR_STAKE / 1e9}
                    className="w-full py-3 bg-purple-500/20 hover:bg-purple-500/30 rounded-xl font-medium transition-colors border border-purple-500/30 text-purple-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {registerModerator.isPending ? "Processing..." : `Register as Moderator (${stakeAmount} SOL)`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
