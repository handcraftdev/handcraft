"use client";

import dynamic from "next/dynamic";

// Loading fallback
function StudioLoading() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-6 py-20">
        <div className="h-10 w-32 bg-white/5 rounded-lg animate-pulse mb-4" />
        <div className="h-4 w-64 bg-white/5 rounded animate-pulse mb-8" />
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="h-24 bg-white/[0.02] border border-white/5 rounded-2xl animate-pulse" />
          <div className="h-24 bg-white/[0.02] border border-white/5 rounded-2xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}

// Dynamically import StudioClient to avoid SDK loading during SSR
const StudioClient = dynamic(() => import("./StudioClient"), {
  ssr: false,
  loading: () => <StudioLoading />,
});

export default function StudioPage() {
  return <StudioClient />;
}
