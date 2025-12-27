"use client";

import dynamic from "next/dynamic";

// Loading fallback
function LibraryLoading() {
  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-5xl mx-auto px-6 py-20">
        <div className="mb-8">
          <div className="h-9 w-32 bg-white/5 rounded-lg animate-pulse mb-2" />
          <div className="h-5 w-48 bg-white/5 rounded animate-pulse" />
        </div>
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <div className="h-10 w-64 bg-white/5 rounded-lg animate-pulse" />
          <div className="h-10 w-24 bg-white/5 rounded-lg animate-pulse" />
          <div className="h-10 w-32 bg-white/5 rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="aspect-square bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

// Dynamically import LibraryClient to avoid SDK loading during SSR
const LibraryClient = dynamic(() => import("./LibraryClient"), {
  ssr: false,
  loading: () => <LibraryLoading />,
});

export default function LibraryPage() {
  return <LibraryClient />;
}
