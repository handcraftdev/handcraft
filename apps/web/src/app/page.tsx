"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-white/[0.02] rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-white/[0.015] rounded-full blur-[100px]" />
      </div>

      {/* Content */}
      <main className="relative">
        {/* Hero Section */}
        <section className="min-h-screen flex flex-col items-center justify-center px-6 py-20">
          <div className={`text-center max-w-4xl mx-auto transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm mb-8">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-white/60 text-sm tracking-wide">Built on Solana</span>
            </div>

            {/* Hero text */}
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-8 tracking-tight">
              <span className="text-white">Own Your</span>
              <br />
              <span className="bg-gradient-to-r from-white via-white/80 to-white/60 bg-clip-text text-transparent">
                Content
              </span>
            </h1>

            <p className="text-lg md:text-xl text-white/40 max-w-2xl mx-auto mb-12 leading-relaxed">
              The decentralized content platform where creators truly own their work.
              Mint, sell, and collect digital content on-chain.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/content">
                <button className="group relative px-8 py-4 overflow-hidden rounded-xl">
                  <div className="absolute inset-0 bg-white transition-opacity duration-300 group-hover:opacity-90" />
                  <span className="relative text-black font-semibold tracking-wide flex items-center gap-2">
                    Explore Content
                    <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </span>
                </button>
              </Link>
              <Link href="/studio">
                <button className="group px-8 py-4 rounded-xl border border-white/20 hover:border-white/40 backdrop-blur-sm transition-all duration-300">
                  <span className="text-white/80 group-hover:text-white font-medium tracking-wide">
                    Start Creating
                  </span>
                </button>
              </Link>
            </div>
          </div>

          {/* Scroll indicator */}
          <div className={`absolute bottom-12 left-1/2 -translate-x-1/2 transition-all duration-1000 delay-500 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
            <div className="flex flex-col items-center gap-2 text-white/20">
              <span className="text-[10px] uppercase tracking-[0.3em]">Scroll</span>
              <div className="w-px h-8 bg-gradient-to-b from-white/20 to-transparent" />
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="px-6 py-24">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">Why Handcraft?</h2>
              <p className="text-white/40 max-w-xl mx-auto">A new paradigm for digital content ownership</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Feature 1 */}
              <div className="group relative p-8 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all duration-500">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-6">
                    <svg className="w-6 h-6 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-white/90">17+ Content Types</h3>
                  <p className="text-white/40 text-sm leading-relaxed">
                    Images, videos, audio, 3D models, documents, code, and more. Your creativity has no limits.
                  </p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="group relative p-8 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all duration-500">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-6">
                    <svg className="w-6 h-6 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-white/90">Bundle Collections</h3>
                  <p className="text-white/40 text-sm leading-relaxed">
                    Group content into albums, series, or courses. Sell or rent bundles as NFTs.
                  </p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="group relative p-8 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all duration-500">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-6">
                    <svg className="w-6 h-6 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-white/90">On-Chain Ownership</h3>
                  <p className="text-white/40 text-sm leading-relaxed">
                    True ownership, transparent royalties, and instant payments. All on Solana.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Creator & Fan Sections */}
        <section className="px-6 py-24">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8">
              {/* For Creators */}
              <div className="group relative p-10 rounded-3xl border border-white/10 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent" />
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/[0.02] rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-white/[0.04] transition-colors duration-700" />

                <div className="relative">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/60 text-xs uppercase tracking-wider mb-6">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    For Creators
                  </div>

                  <h3 className="text-2xl md:text-3xl font-bold mb-4 tracking-tight">Monetize Your Work</h3>
                  <p className="text-white/40 mb-8 leading-relaxed">
                    Set your own prices, earn royalties on every sale, and build sustainable income from your creative work.
                  </p>

                  <ul className="space-y-3 mb-8">
                    {["Instant payments to your wallet", "Configurable royalties on resales", "Rent or sell bundles as NFTs", "No platform fees on primary sales"].map((item) => (
                      <li key={item} className="flex items-center gap-3 text-white/60 text-sm">
                        <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                          <svg className="w-3 h-3 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        {item}
                      </li>
                    ))}
                  </ul>

                  <Link href="/studio">
                    <button className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-white/80 hover:text-white text-sm font-medium transition-all duration-300">
                      Start Creating
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </button>
                  </Link>
                </div>
              </div>

              {/* For Fans */}
              <div className="group relative p-10 rounded-3xl border border-white/10 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent" />
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/[0.02] rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-white/[0.04] transition-colors duration-700" />

                <div className="relative">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/60 text-xs uppercase tracking-wider mb-6">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    For Collectors
                  </div>

                  <h3 className="text-2xl md:text-3xl font-bold mb-4 tracking-tight">Earn Rewards</h3>
                  <p className="text-white/40 mb-8 leading-relaxed">
                    Collect content you love and earn rewards. Early supporters get bonuses when creators succeed.
                  </p>

                  <ul className="space-y-3 mb-8">
                    {["Claim rewards from creator pools", "Rarity-based reward multipliers", "True ownership of your collection", "Resell NFTs on secondary market"].map((item) => (
                      <li key={item} className="flex items-center gap-3 text-white/60 text-sm">
                        <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                          <svg className="w-3 h-3 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        {item}
                      </li>
                    ))}
                  </ul>

                  <Link href="/content">
                    <button className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-white/80 hover:text-white text-sm font-medium transition-all duration-300">
                      Start Collecting
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Content Types */}
        <section className="px-6 py-24">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">Supported Content</h2>
            <p className="text-white/40 mb-12">Create and collect across all media formats</p>

            <div className="flex flex-wrap justify-center gap-3">
              {["Images", "Videos", "Audio", "3D Models", "Documents", "Code", "Articles", "Designs", "Data", "Apps", "Games", "Fonts", "Templates", "Presets", "Plugins"].map((type) => (
                <span
                  key={type}
                  className="px-4 py-2 rounded-full bg-white/[0.03] border border-white/5 text-white/50 text-sm hover:border-white/10 hover:text-white/70 transition-all duration-300 cursor-default"
                >
                  {type}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-6 py-24">
          <div className="max-w-4xl mx-auto">
            <div className="relative p-12 md:p-16 rounded-3xl border border-white/10 overflow-hidden text-center">
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-white/[0.02] rounded-full blur-[80px]" />

              <div className="relative">
                <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">Ready to Start?</h2>
                <p className="text-white/40 mb-10 max-w-lg mx-auto">
                  Connect your wallet and join the future of digital content ownership.
                </p>

                <Link href="/content">
                  <button className="group relative px-10 py-4 overflow-hidden rounded-xl">
                    <div className="absolute inset-0 bg-white transition-opacity duration-300 group-hover:opacity-90" />
                    <span className="relative text-black font-semibold tracking-wide flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      Explore Now
                    </span>
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="px-6 py-12 border-t border-white/5">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              </div>
              <span className="text-white/40 text-sm">Handcraft</span>
            </div>
            <p className="text-white/30 text-sm">Built on Solana · Powered by IPFS</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
