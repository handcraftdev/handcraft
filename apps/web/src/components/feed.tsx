"use client";

import { useState } from "react";

type FeedTab = "foryou" | "following" | "trending";

// Mock data for demo
const mockPosts = [
  {
    id: "1",
    type: "video",
    title: "Building on Solana - Quick Tutorial",
    creator: { name: "DevDAO", avatar: "🧑‍💻", handle: "@devdao" },
    thumbnail: "https://picsum.photos/seed/1/400/225",
    duration: "2:34",
    views: "12.5K",
    likes: 892,
    timeAgo: "2h ago",
  },
  {
    id: "2",
    type: "audio",
    title: "Web3 Weekly Podcast - Episode 42",
    creator: { name: "Crypto Cast", avatar: "🎙️", handle: "@cryptocast" },
    thumbnail: "https://picsum.photos/seed/2/400/225",
    duration: "45:12",
    views: "8.2K",
    likes: 543,
    timeAgo: "5h ago",
  },
  {
    id: "3",
    type: "post",
    title: "What's your favorite Solana project right now? 🚀",
    creator: { name: "Solana Maxi", avatar: "☀️", handle: "@solmaxi" },
    content: "I've been exploring some amazing projects lately. Drop your favorites below!",
    views: "3.1K",
    likes: 234,
    comments: 89,
    timeAgo: "8h ago",
  },
  {
    id: "4",
    type: "video",
    title: "NFT Art Showcase - Digital Renaissance",
    creator: { name: "ArtBlock", avatar: "🎨", handle: "@artblock" },
    thumbnail: "https://picsum.photos/seed/4/400/225",
    duration: "5:17",
    views: "45.3K",
    likes: 2341,
    timeAgo: "1d ago",
  },
];

export function Feed() {
  const [activeTab, setActiveTab] = useState<FeedTab>("foryou");

  return (
    <div className="pt-16 pb-20">
      {/* Tab Navigation */}
      <div className="sticky top-16 z-40 bg-black/90 backdrop-blur-md border-b border-gray-800">
        <div className="flex gap-1 px-4 py-2">
          {(["foryou", "following", "trending"] as FeedTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "bg-white text-black"
                  : "text-gray-400 hover:bg-gray-900 hover:text-white"
              }`}
            >
              {tab === "foryou" ? "For You" : tab === "following" ? "Following" : "Trending"}
            </button>
          ))}
        </div>
      </div>

      {/* Feed Content */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {mockPosts.map((post) => (
          <FeedCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  );
}

function FeedCard({ post }: { post: (typeof mockPosts)[0] }) {
  return (
    <article className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800 hover:border-gray-700 transition-colors">
      {/* Creator Info */}
      <div className="flex items-center gap-3 p-4">
        <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-xl">
          {post.creator.avatar}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{post.creator.name}</span>
            <span className="text-sm text-gray-500">{post.creator.handle}</span>
          </div>
          <span className="text-xs text-gray-500">{post.timeAgo}</span>
        </div>
        <button className="p-2 hover:bg-gray-800 rounded-full transition-colors">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="6" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="18" r="2" />
          </svg>
        </button>
      </div>

      {/* Content */}
      {post.type === "post" ? (
        <div className="px-4 pb-4">
          <h2 className="text-lg font-semibold mb-2">{post.title}</h2>
          <p className="text-gray-300">{post.content}</p>
        </div>
      ) : (
        <div className="relative aspect-video bg-gray-800">
          <img
            src={post.thumbnail}
            alt={post.title}
            className="w-full h-full object-cover"
          />
          {post.duration && (
            <span className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-xs font-medium">
              {post.duration}
            </span>
          )}
          {post.type === "audio" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 bg-primary-500/80 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Title (for media) */}
      {post.type !== "post" && (
        <div className="px-4 py-3">
          <h2 className="font-medium line-clamp-2">{post.title}</h2>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 px-4 py-3 border-t border-gray-800">
        <button className="flex items-center gap-2 text-gray-400 hover:text-primary-500 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <span className="text-sm">{post.likes}</span>
        </button>
        <button className="flex items-center gap-2 text-gray-400 hover:text-primary-500 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="text-sm">{"comments" in post ? post.comments : "Comment"}</span>
        </button>
        <button className="flex items-center gap-2 text-gray-400 hover:text-primary-500 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          <span className="text-sm">Share</span>
        </button>
        <button className="ml-auto flex items-center gap-2 text-gray-400 hover:text-green-500 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm">Tip</span>
        </button>
      </div>
    </article>
  );
}
