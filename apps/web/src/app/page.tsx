"use client";

import Link from "next/link";
import { Header } from "@/components/header";

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Header />

      {/* Hero Section */}
      <main className="pt-16">
        <div className="max-w-6xl mx-auto px-4 py-20">
          {/* Hero */}
          <div className="text-center mb-20">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-primary-400 via-secondary-400 to-primary-400 bg-clip-text text-transparent">
              Own Your Content
            </h1>
            <p className="text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto mb-10">
              The decentralized content platform where creators truly own their work.
              Mint, sell, and collect digital content on Solana.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/explore"
                className="px-8 py-4 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl transition-colors text-lg"
              >
                Explore Content
              </Link>
              <Link
                href="/dashboard"
                className="px-8 py-4 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-xl transition-colors text-lg border border-gray-700"
              >
                Start Creating
              </Link>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-8 mb-20">
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8 hover:border-primary-500/50 transition-colors">
              <div className="w-14 h-14 bg-primary-500/20 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">17+ Content Types</h3>
              <p className="text-gray-400">
                Upload images, videos, audio, 3D models, documents, code, and more. Your creativity has no limits.
              </p>
            </div>

            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8 hover:border-secondary-500/50 transition-colors">
              <div className="w-14 h-14 bg-secondary-500/20 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">Bundle Collections</h3>
              <p className="text-gray-400">
                Group your content into albums, series, courses, or collections. Sell or rent bundles as NFTs.
              </p>
            </div>

            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8 hover:border-green-500/50 transition-colors">
              <div className="w-14 h-14 bg-green-500/20 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">On-Chain Ownership</h3>
              <p className="text-gray-400">
                All content is registered on Solana. True ownership, transparent royalties, and instant payments.
              </p>
            </div>
          </div>

          {/* Content Types Preview */}
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Supported Content Types</h2>
            <p className="text-gray-400 mb-8">Create and collect across all media formats</p>
            <div className="flex flex-wrap justify-center gap-3">
              {[
                "Images", "Videos", "Audio", "3D Models", "Documents",
                "Code", "Articles", "Designs", "Data", "Apps",
                "Games", "Fonts", "Templates", "Presets", "Plugins"
              ].map((type) => (
                <span
                  key={type}
                  className="px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-full text-sm text-gray-300"
                >
                  {type}
                </span>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="text-center py-16 bg-gradient-to-r from-primary-900/20 via-secondary-900/20 to-primary-900/20 rounded-3xl border border-gray-800">
            <h2 className="text-3xl font-bold mb-4">Ready to Start?</h2>
            <p className="text-gray-400 mb-8 max-w-xl mx-auto">
              Connect your wallet to start creating and collecting digital content on Solana.
            </p>
            <Link
              href="/explore"
              className="inline-flex items-center gap-2 px-8 py-4 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl transition-colors text-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Explore Now
            </Link>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-gray-800 py-8 mt-20">
          <div className="max-w-6xl mx-auto px-4 text-center text-gray-500 text-sm">
            <p>Built on Solana. Powered by IPFS.</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
