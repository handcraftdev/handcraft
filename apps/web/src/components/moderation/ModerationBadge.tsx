"use client";

import { ModerationPool } from "@handcraft/sdk";

interface ModerationBadgeProps {
  pool: ModerationPool | null;
  showDetails?: boolean;
  size?: "sm" | "md";
}

export function ModerationBadge({ pool, showDetails = false, size = "sm" }: ModerationBadgeProps) {
  if (!pool || !pool.isFlagged) return null;

  const sizeClasses = size === "sm"
    ? "px-2 py-1 text-[10px]"
    : "px-3 py-1.5 text-xs";

  return (
    <div
      className={`inline-flex items-center gap-1 bg-red-500/20 text-red-400 rounded-full border border-red-500/30 ${sizeClasses}`}
      title={showDetails ? `${pool.upheldReports.toString()} upheld reports` : "This content has been flagged"}
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <span className="font-medium">Flagged</span>
      {showDetails && Number(pool.upheldReports) > 0 && (
        <span className="opacity-70">({pool.upheldReports.toString()})</span>
      )}
    </div>
  );
}

// Smaller inline version for lists
export function ModerationIndicator({ isFlagged }: { isFlagged: boolean }) {
  if (!isFlagged) return null;

  return (
    <div
      className="w-2 h-2 rounded-full bg-red-500 animate-pulse"
      title="Flagged content"
    />
  );
}
