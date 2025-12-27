"use client";

import { useSubjectStatus, type ModerationStatus } from "@/hooks/useSubjectStatus";

interface ModerationBadgeProps {
  contentCid: string;
  showDetails?: boolean;
  size?: "sm" | "md";
}

const statusConfig: Record<ModerationStatus, { label: string; color: string; icon: string } | null> = {
  none: null, // No badge for unregistered content
  clean: {
    label: "Valid",
    color: "green",
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  dormant: {
    label: "Archived",
    color: "yellow",
    icon: "M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4",
  },
  disputed: {
    label: "In Review",
    color: "orange",
    icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  flagged: {
    label: "Dismissed",
    color: "red",
    icon: "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636",
  },
  restoring: {
    label: "On Appeal",
    color: "blue",
    icon: "M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6",
  },
};

const colorClasses = {
  yellow: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  orange: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  red: "bg-red-500/20 text-red-400 border-red-500/30",
  green: "bg-green-500/20 text-green-400 border-green-500/30",
  blue: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

export function ModerationBadge({ contentCid, showDetails = false, size = "sm" }: ModerationBadgeProps) {
  const { data, isLoading } = useSubjectStatus(contentCid);

  if (isLoading || !data) return null;

  const config = statusConfig[data.status];
  if (!config) return null;

  const sizeClasses = size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-xs";

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full border ${colorClasses[config.color as keyof typeof colorClasses]} ${sizeClasses}`}
      title={
        showDetails && data.dispute
          ? `${data.challengerCount} challengers, ${data.voteCount} votes`
          : config.label
      }
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={config.icon} />
      </svg>
      <span className="font-medium">{config.label}</span>
      {showDetails && data.isVotingActive && data.votingEndsAt && (
        <span className="opacity-70">
          (ends {data.votingEndsAt.toLocaleDateString()})
        </span>
      )}
    </div>
  );
}

// Smaller inline version for lists
export function ModerationIndicator({ contentCid }: { contentCid: string }) {
  const { data } = useSubjectStatus(contentCid);

  if (!data) return null;

  const indicatorColors: Partial<Record<ModerationStatus, string>> = {
    disputed: "bg-orange-500",
    flagged: "bg-red-500",
    restoring: "bg-blue-500",
  };

  const color = indicatorColors[data.status];
  if (!color) return null;

  return (
    <div
      className={`w-2 h-2 rounded-full ${color} animate-pulse`}
      title={statusConfig[data.status]?.label ?? ""}
    />
  );
}

// Simple status badge without fetching (for when you already have status)
export function ModerationStatusBadge({
  status,
  size = "sm",
}: {
  status: ModerationStatus;
  size?: "sm" | "md";
}) {
  const config = statusConfig[status];
  if (!config) return null;

  const sizeClasses = size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-xs";

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full border ${colorClasses[config.color as keyof typeof colorClasses]} ${sizeClasses}`}
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={config.icon} />
      </svg>
      <span className="font-medium">{config.label}</span>
    </div>
  );
}
