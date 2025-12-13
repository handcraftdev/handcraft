"use client";

import { useState, useRef, useEffect, createContext, useContext } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { EcosystemMembershipCard } from "@/components/membership";
import { UploadModal } from "./upload";
import { useContentRegistry } from "@/hooks/useContentRegistry";
import { useSession } from "@/hooks/useSession";

// Sidebar context for sharing state
interface SidebarContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}
const SidebarContext = createContext<SidebarContextType>({ isOpen: false, setIsOpen: () => {} });
export const useSidebarContext = () => useContext(SidebarContext);

// Slide-in sidebar component
function SlideInSidebar({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { publicKey, disconnect } = useWallet();
  const { connection } = useConnection();
  const { content, userProfile } = useContentRegistry();
  const { clearSession } = useSession();

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch SOL balance
  useEffect(() => {
    if (publicKey) {
      connection.getBalance(publicKey).then((bal) => {
        setBalance(bal / LAMPORTS_PER_SOL);
      }).catch(() => setBalance(null));
    } else {
      setBalance(null);
    }
  }, [publicKey, connection]);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const shortAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : "";

  const navItems = [
    { icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>, label: "Home", href: "/" },
    { icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>, label: "Content", href: "/content" },
    { icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>, label: "Bundles", href: "/bundles" },
    { icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>, label: "Search", href: "/search" },
    { icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>, label: "Studio", href: "/dashboard" },
  ];

  return (
    <>
      {/* Slide-in Panel */}
      <aside className={`fixed top-0 left-0 h-full w-72 bg-black/95 backdrop-blur-xl border-r border-white/10 z-50 transform transition-transform duration-300 flex flex-col ${isOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3" onClick={onClose}>
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-primary-400 to-secondary-400 bg-clip-text text-transparent">
              Handcraft
            </span>
          </Link>
          <button onClick={onClose} className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          <p className="text-white/40 text-xs uppercase tracking-widest mb-3">Navigate</p>
          <div className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  pathname === item.href
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}
            {publicKey && (
              <>
                <Link
                  href={`/profile/${publicKey.toBase58()}`}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    pathname === `/profile/${publicKey.toBase58()}`
                      ? "bg-white/10 text-white"
                      : "text-white/60 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>Profile</span>
                </Link>
                <Link
                  href="/rewards"
                  onClick={onClose}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    pathname === "/rewards"
                      ? "bg-white/10 text-white"
                      : "text-white/60 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Rewards</span>
                </Link>
              </>
            )}
          </div>

          {/* Upload Button */}
          {publicKey && (
            <>
              <div className="my-4 border-t border-white/10" />
              <button
                onClick={() => setIsUploadOpen(true)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Upload Content
              </button>
            </>
          )}

          {/* Membership */}
          <div className="my-4 border-t border-white/10" />
          <EcosystemMembershipCard compact />
        </nav>

        {/* User Section */}
        <div className="border-t border-white/10 p-4" ref={userMenuRef}>
          {publicKey ? (
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="w-full flex items-center gap-3 p-3 hover:bg-white/10 rounded-lg transition-colors"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center text-sm text-white font-bold">
                  {userProfile?.username?.charAt(0)?.toUpperCase() || publicKey.toBase58().charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {userProfile?.username || shortAddress}
                  </p>
                  <p className="text-xs text-white/50">
                    {balance !== null ? `${balance.toFixed(2)} SOL` : "..."}
                  </p>
                </div>
                <svg className={`w-4 h-4 text-white/50 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>

              {isUserMenuOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-gray-900 rounded-xl border border-white/10 shadow-xl overflow-hidden">
                  <div className="grid grid-cols-2 divide-x divide-white/10 border-b border-white/10">
                    <div className="p-3 text-center">
                      <p className="text-sm font-semibold text-white">{content.length}</p>
                      <p className="text-xs text-white/50">Content</p>
                    </div>
                    <div className="p-3 text-center">
                      <p className="text-sm font-semibold text-white">{balance !== null ? balance.toFixed(2) : "-"}</p>
                      <p className="text-xs text-white/50">SOL</p>
                    </div>
                  </div>
                  <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between">
                    <span className="text-xs text-white/50">Network</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">Devnet</span>
                  </div>
                  <div className="p-2">
                    <button
                      onClick={() => { navigator.clipboard.writeText(publicKey.toBase58()); setIsUserMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-white/70 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy Address
                    </button>
                    <div className="border-t border-white/10 my-1" />
                    <button
                      onClick={() => { clearSession(); disconnect(); setIsUserMenuOpen(false); onClose(); }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Disconnect
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : mounted ? (
            <WalletMultiButton className="!w-full !bg-primary-600 hover:!bg-primary-700 !rounded-lg !py-3 !text-sm !font-medium !justify-center" />
          ) : (
            <div className="h-12 bg-primary-600/50 rounded-lg animate-pulse" />
          )}
        </div>
      </aside>

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={(result) => console.log("Upload successful:", result)}
      />
    </>
  );
}

// Menu button to open sidebar
export function MenuButton({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={`p-3 bg-black/60 backdrop-blur-md rounded-full border border-white/10 hover:border-white/30 transition-all group ${className}`}
      title="Menu"
    >
      <svg className="w-5 h-5 text-white/70 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  );
}

// Legacy Sidebar export for backwards compatibility (empty - pages should use SlideInSidebar)
function LegacySidebar() {
  return null;
}

export const Sidebar = dynamic(() => Promise.resolve(LegacySidebar), { ssr: false });

// New slide-in sidebar export
export const SidebarPanel = dynamic(() => Promise.resolve(SlideInSidebar), { ssr: false });
