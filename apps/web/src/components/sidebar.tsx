"use client";

import { useState, useRef, useEffect, useMemo, createContext, useContext } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { EcosystemMembershipCard } from "@/components/membership";
import { UploadModal } from "./upload";
import { ClaimRewardsModal } from "./claim";
import { useContentRegistry } from "@/hooks/useContentRegistry";
import { useSession } from "@/hooks/useSession";

// Sidebar context for sharing collapsed state
const SidebarContext = createContext<{ isCollapsed: boolean }>({ isCollapsed: false });
export const useSidebar = () => useContext(SidebarContext);

const navItems = [
  {
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    label: "Home",
    href: "/",
  },
  {
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    label: "Explore",
    href: "/explore",
  },
  {
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    label: "Search",
    href: "/search",
  },
  {
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    label: "Dashboard",
    href: "/dashboard",
  },
];

function SidebarContent() {
  const pathname = usePathname();
  const { publicKey, disconnect } = useWallet();
  const { connection } = useConnection();
  const { content, usePendingRewards, bundlePendingRewardsQuery } = useContentRegistry();
  const { clearSession } = useSession();

  // Initialize collapsed state synchronously from localStorage
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebar-collapsed") === "true";
    }
    return false;
  });
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isClaimOpen, setIsClaimOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Get pending rewards
  const { data: pendingRewards } = usePendingRewards();
  const { data: bundlePendingRewards } = bundlePendingRewardsQuery;
  const totalPending = useMemo(() => {
    const contentTotal = pendingRewards?.reduce((acc, r) => acc + r.pending, BigInt(0)) || BigInt(0);
    const bundleTotal = bundlePendingRewards?.reduce((acc, r) => acc + r.pending, BigInt(0)) || BigInt(0);
    return contentTotal + bundleTotal;
  }, [pendingRewards, bundlePendingRewards]);
  const hasPendingRewards = totalPending > BigInt(0);

  // Set mounted state
  useEffect(() => {
    setMounted(true);
  }, []);

  // Save collapsed state
  const toggleCollapsed = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem("sidebar-collapsed", String(newState));
  };

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

  const collapsed = isCollapsed;

  return (
    <SidebarContext.Provider value={{ isCollapsed: collapsed }}>
      <aside className={`fixed left-0 top-0 bottom-0 bg-black border-r border-gray-800 flex flex-col hidden md:flex z-40 transition-all duration-300 ${collapsed ? "w-16" : "w-64"}`}>
        {/* Logo - Top */}
        <div className={`border-b border-gray-800 ${collapsed ? "p-3" : "p-4"}`}>
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
            </div>
            {!collapsed && (
              <span className="text-xl font-bold bg-gradient-to-r from-primary-400 to-secondary-400 bg-clip-text text-transparent">
                Handcraft
              </span>
            )}
          </Link>
        </div>

        {/* Navigation - Scrollable Middle */}
        <nav className={`flex-1 overflow-y-auto ${collapsed ? "p-2" : "p-4"}`}>
          {/* Main Navigation */}
          <div className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 rounded-lg transition-colors ${
                  collapsed ? "px-2.5 py-2.5 justify-center" : "px-3 py-2.5"
                } ${
                  pathname === item.href
                    ? "bg-gray-800 text-white"
                    : "text-gray-400 hover:bg-gray-900 hover:text-white"
                }`}
              >
                {item.icon}
                {!collapsed && <span className="font-medium">{item.label}</span>}
              </Link>
            ))}
          </div>

          {/* Upload Button */}
          {publicKey && (
            <>
              <div className={`my-4 border-t border-gray-800 ${collapsed ? "mx-1" : ""}`} />
              <button
                onClick={() => setIsUploadOpen(true)}
                title={collapsed ? "Upload Content" : undefined}
                className={`w-full flex items-center gap-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium ${
                  collapsed ? "px-2.5 py-2.5 justify-center" : "px-3 py-2.5"
                }`}
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {!collapsed && "Upload Content"}
              </button>
            </>
          )}

          {/* Claim Rewards */}
          {publicKey && hasPendingRewards && (
            <button
              onClick={() => setIsClaimOpen(true)}
              title={collapsed ? `Claim ${(Number(totalPending) / LAMPORTS_PER_SOL).toFixed(4)} SOL` : undefined}
              className={`w-full flex items-center gap-3 mt-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-lg transition-colors font-medium border border-green-600/30 ${
                collapsed ? "px-2.5 py-2.5 justify-center" : "px-3 py-2.5"
              }`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {!collapsed && <span>Claim {(Number(totalPending) / LAMPORTS_PER_SOL).toFixed(4)} SOL</span>}
            </button>
          )}

          {/* Divider & Membership (hide when collapsed) */}
          {!collapsed && (
            <>
              <div className="my-4 border-t border-gray-800" />
              <EcosystemMembershipCard compact />
            </>
          )}
        </nav>

        {/* Collapse Toggle */}
        <button
          onClick={toggleCollapsed}
          className={`mx-auto mb-2 p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors ${collapsed ? "" : "mr-4 ml-auto"}`}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg className={`w-5 h-5 transition-transform ${collapsed ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>

        {/* User Banner - Fixed Bottom */}
        <div className={`border-t border-gray-800 ${collapsed ? "p-2" : "p-4"}`} ref={userMenuRef}>
          {publicKey ? (
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                title={collapsed ? shortAddress : undefined}
                className={`w-full flex items-center gap-3 hover:bg-gray-900 rounded-lg transition-colors ${
                  collapsed ? "p-1.5 justify-center" : "p-2"
                }`}
              >
                <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center text-sm text-white font-bold flex-shrink-0">
                  {publicKey.toBase58().charAt(0).toUpperCase()}
                </div>
                {!collapsed && (
                  <>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium text-white truncate">{shortAddress}</p>
                      <p className="text-xs text-gray-500">
                        {balance !== null ? `${balance.toFixed(2)} SOL` : "..."}
                      </p>
                    </div>
                    <svg className={`w-4 h-4 text-gray-500 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </>
                )}
              </button>

              {/* User Menu Popup */}
              {isUserMenuOpen && (
                <div className={`absolute bottom-full mb-2 bg-gray-900 rounded-xl border border-gray-800 shadow-xl overflow-hidden ${collapsed ? "left-full ml-2 w-56" : "left-0 right-0"}`}>
                  {/* Stats */}
                  <div className="grid grid-cols-3 divide-x divide-gray-800 border-b border-gray-800">
                    <div className="p-3 text-center">
                      <p className="text-sm font-semibold text-white">{content.length}</p>
                      <p className="text-xs text-gray-500">Content</p>
                    </div>
                    <div className="p-3 text-center">
                      <p className="text-sm font-semibold text-white">
                        {balance !== null ? balance.toFixed(2) : "-"}
                      </p>
                      <p className="text-xs text-gray-500">SOL</p>
                    </div>
                    <div className="p-3 text-center">
                      <p className={`text-sm font-semibold ${hasPendingRewards ? "text-green-400" : "text-white"}`}>
                        {(Number(totalPending) / LAMPORTS_PER_SOL).toFixed(3)}
                      </p>
                      <p className="text-xs text-gray-500">Rewards</p>
                    </div>
                  </div>

                  {/* Network */}
                  <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between">
                    <span className="text-xs text-gray-500">Network</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">
                      Devnet
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="p-2">
                    <Link
                      href={`/profile/${publicKey.toBase58()}`}
                      onClick={() => setIsUserMenuOpen(false)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      View Profile
                    </Link>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(publicKey.toBase58());
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy Address
                    </button>
                    <div className="border-t border-gray-800 my-1" />
                    <button
                      onClick={() => {
                        clearSession();
                        disconnect();
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
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
            collapsed ? (
              <button
                onClick={() => document.querySelector<HTMLButtonElement>('.wallet-adapter-button')?.click()}
                title="Connect Wallet"
                className="w-full p-2 bg-primary-600 hover:bg-primary-700 rounded-lg flex items-center justify-center"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </button>
            ) : (
              <WalletMultiButton className="!w-full !bg-primary-600 hover:!bg-primary-700 !rounded-lg !py-3 !text-sm !font-medium !justify-center" />
            )
          ) : (
            <div className={`bg-primary-600 rounded-lg animate-pulse ${collapsed ? "w-10 h-10 mx-auto" : "h-12"}`} />
          )}
        </div>
      </aside>

      {/* Spacer for main content - dynamically adjusts */}
      <div className={`hidden md:block flex-shrink-0 transition-all duration-300 ${collapsed ? "w-16" : "w-64"}`} />

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={(result) => console.log("Upload successful:", result)}
      />

      {/* Claim Rewards Modal */}
      <ClaimRewardsModal
        isOpen={isClaimOpen}
        onClose={() => setIsClaimOpen(false)}
      />
    </SidebarContext.Provider>
  );
}

// Export with SSR disabled to prevent hydration mismatch with localStorage
export const Sidebar = dynamic(() => Promise.resolve(SidebarContent), {
  ssr: false,
});
