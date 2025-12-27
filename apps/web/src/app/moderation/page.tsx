"use client";

import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useConnection } from "@solana/wallet-adapter-react";
import { useRouter } from "next/navigation";
import {
  TribunalCraftClient,
  isDisputePending,
  getDisputeTypeName,
  type Dispute,
  type Subject,
} from "@tribunalcraft/sdk";
import { SidebarPanel } from "@/components/sidebar";
import { getIpfsUrl } from "@handcraft/sdk";

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

// Types for IPFS content
interface SubjectDetails {
  name?: string;
  description?: string;
}

interface ReportDetails {
  disputeType?: string;
  details?: string;
  timestamp?: number;
  contentCid?: string;
}

// Simple Dispute Card - links to content and Tribunalcraft for voting
function DisputeCard({
  subject,
  dispute,
}: {
  subject: Subject;
  dispute: Dispute;
}) {
  const router = useRouter();
  const [isLoadingReview, setIsLoadingReview] = useState(false);

  // Fetch subject details from IPFS
  const { data: subjectDetails } = useQuery<SubjectDetails>({
    queryKey: ["subject-details", subject.detailsCid],
    queryFn: async () => {
      if (!subject.detailsCid) return {};
      const res = await fetch(getIpfsUrl(subject.detailsCid));
      if (!res.ok) return {};
      return res.json();
    },
    enabled: !!subject.detailsCid,
    staleTime: Infinity,
  });

  // Fetch report details from IPFS
  const { data: reportDetails } = useQuery<ReportDetails>({
    queryKey: ["report-details", dispute.detailsCid],
    queryFn: async () => {
      if (!dispute.detailsCid) return {};
      const res = await fetch(getIpfsUrl(dispute.detailsCid));
      if (!res.ok) return {};
      return res.json();
    },
    enabled: !!dispute.detailsCid,
    staleTime: Infinity,
  });

  const votingEndsAt = dispute.votingEndsAt.toNumber() * 1000;
  const bondAtRisk = dispute.bondAtRisk.toNumber() / 1e9;
  const totalStake = dispute.totalStake.toNumber() / 1e9;
  const totalPool = totalStake + bondAtRisk;
  const jurorReward = totalPool * 0.19; // 19% to jurors

  // Handle review content click - fetch signed token then navigate
  const handleReviewContent = async () => {
    if (!reportDetails?.contentCid) return;

    setIsLoadingReview(true);
    try {
      const res = await fetch("/api/moderation/review-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentCid: reportDetails.contentCid }),
      });

      if (!res.ok) throw new Error("Failed to get review token");

      const { token } = await res.json();
      router.push(`/content/${reportDetails.contentCid}?review=${token}`);
    } catch (error) {
      console.error("Failed to get review token:", error);
      // Fallback to regular view if token generation fails
      router.push(`/content/${reportDetails.contentCid}`);
    } finally {
      setIsLoadingReview(false);
    }
  };

  return (
    <div className="bg-[#0a0a0c] border border-white/10 rounded-lg p-4 space-y-3">
      {/* Title and Status */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-white truncate">
            {subjectDetails?.name || "Disputed Content"}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded">
              {getDisputeTypeName(dispute.disputeType)}
            </span>
            <span className="text-xs text-white/40">
              <Countdown endTime={votingEndsAt} />
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-white/40">Juror Reward</p>
          <p className="text-sm font-medium text-purple-400">{jurorReward.toFixed(4)} SOL</p>
        </div>
      </div>

      {/* Report Reason */}
      {reportDetails?.details && (
        <p className="text-xs text-white/50 line-clamp-2">
          {reportDetails.details}
        </p>
      )}

      {/* Links */}
      <div className="flex items-center gap-2 pt-2 border-t border-white/5">
        {reportDetails?.contentCid && (
          <button
            onClick={handleReviewContent}
            disabled={isLoadingReview}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors disabled:opacity-50"
          >
            {isLoadingReview ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
            Review Content
          </button>
        )}
        <a
          href={`https://tribunalcraft.io/subject/${subject.subjectId.toBase58()}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Vote on Tribunalcraft
        </a>
      </div>
    </div>
  );
}

export default function ModerationPage() {
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

  return (
    <div className="min-h-screen bg-black text-white">
      <SidebarPanel isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Menu Button */}
      <button
        onClick={toggleSidebar}
        className={`fixed top-4 z-50 p-3 bg-white/5 backdrop-blur-md rounded-full border border-white/10 hover:border-white/20 transition-all duration-300 ${
          isSidebarOpen ? "left-[264px]" : "left-4"
        }`}
      >
        <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Compact header bar */}
      <div className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-medium text-white">Moderation</h1>
              <span className="text-xs text-white/30">
                via{" "}
                <a
                  href="https://tribunalcraft.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:text-purple-300"
                >
                  Tribunalcraft
                </a>
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-white/40">Disputes:</span>
              <span className="font-medium text-white">{activeDisputes?.length ?? 0}</span>
              <button
                onClick={() => refetch()}
                disabled={isLoading}
                className="p-1.5 hover:bg-white/10 rounded-md transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <svg className={`w-3.5 h-3.5 text-white/40 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>

          {/* Tabs in header */}
          <div className="flex items-center gap-1 pb-3 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab("disputes")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                activeTab === "disputes"
                  ? "bg-white text-black"
                  : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
              }`}
            >
              Active Disputes
            </button>
            <button
              onClick={() => setActiveTab("juror")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                activeTab === "juror"
                  ? "bg-white text-black"
                  : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
              }`}
            >
              Become a Juror
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-4">

        {/* Tab Content */}
        {activeTab === "disputes" && (
          <div className="space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
              </div>
            ) : !activeDisputes || activeDisputes.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-12 h-12 mx-auto rounded-lg bg-green-500/10 flex items-center justify-center mb-3 border border-green-500/20">
                  <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                />
              ))
            )}
          </div>
        )}

        {activeTab === "juror" && (
          <div className="max-w-lg">
            <div className="bg-white/[0.02] border border-white/10 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
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
