"use client";

import dynamic from "next/dynamic";

// Loading fallback
function RewardsLoading() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-6 py-20">
        <div className="mb-8">
          <div className="h-9 w-32 bg-white/5 rounded-lg animate-pulse mb-2" />
          <div className="h-5 w-64 bg-white/5 rounded animate-pulse" />
        </div>
        <div className="flex gap-2 mb-8">
          <div className="h-10 w-28 bg-white/5 rounded-lg animate-pulse" />
          <div className="h-10 w-28 bg-white/5 rounded-lg animate-pulse" />
        </div>
        <div className="space-y-6">
          <div className="h-40 bg-white/5 rounded-2xl animate-pulse" />
          <div className="h-64 bg-white/5 rounded-2xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}

// Dynamically import RewardsClient to avoid SDK loading during SSR
const RewardsClient = dynamic(() => import("./RewardsClient"), {
  ssr: false,
  loading: () => <RewardsLoading />,
});

export default function RewardsPage() {
  return <RewardsClient />;
}
