"use client";

import dynamic from "next/dynamic";

// Loading fallback
function ProfileLoading() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-6 py-20">
        {/* Profile Header Skeleton */}
        <div className="relative rounded-3xl overflow-hidden mb-10 p-8 border border-white/10">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="w-24 h-24 bg-white/5 rounded-full animate-pulse" />
            <div className="flex-1 space-y-4">
              <div className="h-8 w-48 bg-white/5 rounded animate-pulse mx-auto sm:mx-0" />
              <div className="h-4 w-64 bg-white/5 rounded animate-pulse mx-auto sm:mx-0" />
              <div className="flex gap-8 justify-center sm:justify-start mt-6">
                <div className="space-y-2">
                  <div className="h-8 w-12 bg-white/5 rounded animate-pulse" />
                  <div className="h-3 w-16 bg-white/5 rounded animate-pulse" />
                </div>
                <div className="space-y-2">
                  <div className="h-8 w-12 bg-white/5 rounded animate-pulse" />
                  <div className="h-3 w-16 bg-white/5 rounded animate-pulse" />
                </div>
                <div className="space-y-2">
                  <div className="h-8 w-12 bg-white/5 rounded animate-pulse" />
                  <div className="h-3 w-16 bg-white/5 rounded animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Skeleton */}
        <div className="flex gap-2 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 w-24 bg-white/5 rounded-full animate-pulse" />
          ))}
        </div>

        {/* Content Grid Skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="aspect-square bg-white/[0.02] border border-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

// Dynamically import ProfileClient to avoid SDK loading during SSR
const ProfileClient = dynamic(() => import("./ProfileClient"), {
  ssr: false,
  loading: () => <ProfileLoading />,
});

export default function ProfilePage() {
  return <ProfileClient />;
}
