"use client";

import dynamic from "next/dynamic";

// Loading fallback
function SearchLoadingFallback() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="h-14 bg-white/5 rounded-2xl animate-pulse" />
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-4 p-5 rounded-xl bg-white/[0.02] border border-white/5 animate-pulse">
              <div className="w-16 h-16 bg-white/5 rounded-lg" />
              <div className="flex-1 space-y-3">
                <div className="h-4 bg-white/5 rounded w-3/4" />
                <div className="h-3 bg-white/5 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Dynamically import SearchClient to avoid SDK loading during SSR
const SearchClient = dynamic(() => import("./SearchClient"), {
  ssr: false,
  loading: () => <SearchLoadingFallback />,
});

export default function SearchPage() {
  return <SearchClient />;
}
