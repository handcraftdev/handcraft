"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { useConnection } from "@solana/wallet-adapter-react";
import { TribunalCraftClient, isDisputePending, getDisputeTypeName } from "@tribunalcraft/sdk";
import { SidebarPanel } from "@/components/sidebar";
import { VotingPanel } from "@/components/moderation";

type Tab = "disputes" | "juror";

export default function ModerationPage() {
  const { connected } = useWallet();
  const { connection } = useConnection();
  const [activeTab, setActiveTab] = useState<Tab>("disputes");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = useCallback(() => setIsSidebarOpen((prev) => !prev), []);

  // Fetch active disputes from Tribunalcraft
  // Note: In production, you'd filter these to only show Handcraft-related disputes
  const {
    data: activeDisputes,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["tribunalcraft-active-disputes"],
    queryFn: async () => {
      const client = new TribunalCraftClient({ connection });
      // Fetch all subjects and filter for those with active disputes
      // In production, you'd want to use an indexer to filter by Handcraft subjects
      const subjectAccounts = await client.fetchAllSubjects();

      const disputesWithSubjects = await Promise.all(
        subjectAccounts.map(async ({ publicKey, account: subject }) => {
          const dispute = await client.fetchDisputeBySubjectId(subject.subjectId);
          if (dispute && isDisputePending(dispute.status)) {
            return { subject, dispute, publicKey };
          }
          return null;
        })
      );

      return disputesWithSubjects.filter((d): d is NonNullable<typeof d> => d !== null);
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  if (!connected) {
    return (
      <div className="min-h-screen bg-[#030305] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Connect Wallet</h1>
          <p className="text-white/50">
            Please connect your wallet to access the moderation dashboard
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
        <svg
          className="w-5 h-5 text-white/70"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      <main className="max-w-5xl mx-auto px-6 py-20">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 tracking-tight">Moderation</h1>
          <p className="text-white/40">
            Powered by{" "}
            <a
              href="https://tribunalcraft.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300"
            >
              Tribunalcraft
            </a>{" "}
            - Decentralized dispute resolution
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4">
            <h3 className="text-sm font-medium text-white/50">Active Disputes</h3>
            <p className="text-2xl font-bold text-white mt-1">
              {activeDisputes?.length ?? 0}
            </p>
          </div>
          <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4">
            <h3 className="text-sm font-medium text-white/50">Protocol</h3>
            <p className="text-2xl font-bold text-purple-400 mt-1">Tribunalcraft</p>
          </div>
          <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4">
            <h3 className="text-sm font-medium text-white/50">Network</h3>
            <p className="text-2xl font-bold text-white mt-1">Devnet</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-white/10 pb-4">
          <button
            onClick={() => setActiveTab("disputes")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "disputes"
                ? "bg-white/10 text-white"
                : "text-white/50 hover:text-white"
            }`}
          >
            Active Disputes
          </button>
          <button
            onClick={() => setActiveTab("juror")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
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
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
              </div>
            ) : !activeDisputes || activeDisputes.length === 0 ? (
              <div className="text-center py-12">
                <svg
                  className="w-16 h-16 mx-auto text-white/10 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <h3 className="text-lg font-medium text-white/70">No active disputes</h3>
                <p className="text-sm text-white/40 mt-1">
                  All content is in good standing
                </p>
              </div>
            ) : (
              activeDisputes.map(({ subject, dispute }) => (
                <VotingPanel
                  key={subject.subjectId.toBase58()}
                  contentCid={subject.detailsCid}
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
                <div className="w-14 h-14 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <svg
                    className="w-7 h-7 text-purple-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Become a Juror</h3>
                  <p className="text-sm text-white/50">
                    Help resolve disputes and earn rewards
                  </p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div className="p-4 bg-white/[0.02] border border-white/10 rounded-xl">
                  <h4 className="text-sm font-medium text-white/70 mb-3">
                    How Tribunalcraft Works
                  </h4>
                  <ul className="text-sm text-white/50 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400">1.</span>
                      Stake SOL to register as a juror
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400">2.</span>
                      Vote on active disputes within the voting period
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400">3.</span>
                      Earn rewards when your vote aligns with the majority
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400">4.</span>
                      Build reputation through accurate voting
                    </li>
                  </ul>
                </div>

                <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                  <p className="text-sm text-purple-300">
                    To register as a juror and participate in voting, visit the{" "}
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
                className="block w-full py-3 bg-purple-500/20 hover:bg-purple-500/30 rounded-xl font-medium transition-colors border border-purple-500/30 text-purple-400 text-center"
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
