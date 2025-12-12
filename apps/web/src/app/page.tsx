"use client";

import { useState } from "react";
import { Feed, BundleFeed } from "@/components/feed";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";

type MainTab = "content" | "bundles";

export default function Home() {
  const [mainTab, setMainTab] = useState<MainTab>("content");

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <div className="flex pt-16">
        <Sidebar />
        <main className="flex-1 ml-0 md:ml-64">
          {/* Main Tab Navigation */}
          <div className="sticky top-16 z-40 bg-black border-b border-gray-800">
            <div className="max-w-2xl mx-auto px-4">
              <div className="flex">
                <button
                  onClick={() => setMainTab("content")}
                  className={`flex-1 py-4 text-center font-medium transition-colors relative ${
                    mainTab === "content"
                      ? "text-white"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Content
                  </div>
                  {mainTab === "content" && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary-500 rounded-t" />
                  )}
                </button>
                <button
                  onClick={() => setMainTab("bundles")}
                  className={`flex-1 py-4 text-center font-medium transition-colors relative ${
                    mainTab === "bundles"
                      ? "text-white"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    Bundles
                  </div>
                  {mainTab === "bundles" && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-secondary-500 rounded-t" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Feed Content */}
          {mainTab === "content" ? <Feed /> : <BundleFeed />}
        </main>
      </div>
    </div>
  );
}
