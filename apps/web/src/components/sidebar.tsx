"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { icon: "🏠", label: "Home", href: "/" },
  { icon: "🔥", label: "Trending", href: "/trending" },
  { icon: "👥", label: "Communities", href: "/communities" },
  { icon: "🎵", label: "Audio", href: "/audio" },
  { icon: "📺", label: "Videos", href: "/videos" },
];

const libraryItems = [
  { icon: "⏱️", label: "Watch Later", href: "/library/watch-later" },
  { icon: "❤️", label: "Liked", href: "/library/liked" },
  { icon: "📁", label: "Playlists", href: "/library/playlists" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-16 bottom-0 w-64 bg-black border-r border-gray-800 overflow-y-auto hidden md:block">
      <nav className="p-4">
        {/* Main Navigation */}
        <div className="space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                pathname === item.href
                  ? "bg-gray-800 text-white"
                  : "text-gray-400 hover:bg-gray-900 hover:text-white"
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </div>

        {/* Divider */}
        <div className="my-4 border-t border-gray-800" />

        {/* Library */}
        <div className="space-y-1">
          <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Library
          </h3>
          {libraryItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                pathname === item.href
                  ? "bg-gray-800 text-white"
                  : "text-gray-400 hover:bg-gray-900 hover:text-white"
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </div>

        {/* Divider */}
        <div className="my-4 border-t border-gray-800" />

        {/* Communities */}
        <div className="space-y-1">
          <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Your Communities
          </h3>
          <p className="px-3 text-sm text-gray-500">
            Connect wallet to see your communities
          </p>
        </div>
      </nav>
    </aside>
  );
}
