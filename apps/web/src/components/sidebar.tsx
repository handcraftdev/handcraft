"use client";

import { useState, useRef, useEffect, createContext, useContext } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { EcosystemMembershipCard } from "@/components/membership";
import { UploadModal } from "./upload";
import { useSession } from "@/hooks/useSession";
import { useQuery } from "@tanstack/react-query";
import { createContentRegistryClient } from "@handcraft/sdk";

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
  overlayVisible = true,
}: {
  isOpen: boolean;
  onClose: () => void;
  overlayVisible?: boolean;
}) {
  const pathname = usePathname();
  const { publicKey, disconnect } = useWallet();
  const { connection } = useConnection();
  const { clearSession } = useSession();

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  // Fetch user profile separately (lightweight query for sidebar - uses shared cache with useContentRegistry)
  const { data: userProfile } = useQuery({
    queryKey: ["userProfile", publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey) return null;
      const client = createContentRegistryClient(connection);
      return client.fetchUserProfile(publicKey);
    },
    enabled: !!publicKey,
    staleTime: 300000, // Cache for 5 minutes (matches useContentRegistry)
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close sidebar when clicking outside (but not on toggle buttons)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      // Don't close if clicking on a button (toggle buttons are outside sidebar)
      if (target.closest('button')) return;

      if (isOpen && sidebarRef.current && !sidebarRef.current.contains(target)) {
        onClose();
      }
    }
    if (isOpen) {
      // Add small delay to prevent immediate close on open
      const timeoutId = setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside);
      }, 100);
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen, onClose]);

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
    { icon: "home", label: "Home", href: "/" },
    { icon: "content", label: "Content", href: "/content" },
    { icon: "library", label: "Library", href: "/library" },
    { icon: "search", label: "Search", href: "/search" },
    { icon: "studio", label: "Studio", href: "/studio" },
  ];

  const accountItems = [
    { icon: "profile", label: "Profile", href: publicKey ? `/profile/${publicKey.toBase58()}` : "#" },
    { icon: "rewards", label: "Rewards", href: "/rewards" },
  ];

  const renderIcon = (icon: string, isActive: boolean) => {
    const baseClass = `w-[18px] h-[18px] transition-colors duration-200 ${isActive ? "text-white" : "text-white/40 group-hover:text-white/70"}`;

    switch (icon) {
      case "home":
        return (
          <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
          </svg>
        );
      case "content":
        return (
          <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
        );
      case "library":
        return (
          <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6M12.75 3h-1.5M20.25 9.75v9.75a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V9.75" />
          </svg>
        );
      case "search":
        return (
          <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        );
      case "studio":
        return (
          <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
        );
      case "profile":
        return (
          <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        );
      case "rewards":
        return (
          <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <>
      {/* Slide-in Panel */}
      <aside
        ref={sidebarRef}
        className={`fixed top-0 left-0 h-full w-72 z-50 transform transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] flex flex-col ${isOpen ? "translate-x-0" : "-translate-x-full"} ${overlayVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        {/* Glass background with subtle grain texture */}
        <div className="absolute inset-0 bg-black/98 backdrop-blur-2xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent" />
        <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />

        {/* Content wrapper */}
        <div className="relative flex flex-col h-full">
          {/* Header - Refined brand mark */}
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-center justify-between">
              <Link href="/" className="group flex items-center gap-3" onClick={onClose}>
                <div className="relative w-9 h-9 rounded-xl bg-white/[0.08] flex items-center justify-center border border-white/[0.06] group-hover:bg-white/[0.12] group-hover:border-white/10 transition-all duration-300">
                  <svg className="w-4 h-4 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                </div>
                <div className="flex flex-col">
                  <span className="text-[15px] font-semibold text-white/90 tracking-tight">Handcraft</span>
                  <span className="text-[10px] text-white/30 tracking-[0.08em] uppercase">Creator Platform</span>
                </div>
              </Link>

              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.04] rounded-lg transition-all duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Upload Button - Clean, prominent */}
          {publicKey && (
            <div className="px-5 pb-5">
              <button
                onClick={() => setIsUploadOpen(true)}
                className="group w-full relative overflow-hidden"
              >
                <div className="relative flex items-center justify-center gap-2.5 px-4 py-3 bg-white hover:bg-white/95 rounded-xl transition-all duration-200">
                  <svg className="w-4 h-4 text-black/80" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  <span className="text-[13px] font-semibold text-black tracking-wide">Upload Content</span>
                </div>
              </button>
            </div>
          )}

          {/* Divider */}
          <div className="mx-5 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

          {/* Navigation */}
          <nav className="flex-shrink-0 px-4 py-4">
            <div className="space-y-0.5">
              {navItems.map((item, index) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className="group relative block"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <div className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                      isActive
                        ? "bg-white/[0.08]"
                        : "hover:bg-white/[0.04]"
                    }`}>
                      {/* Active indicator */}
                      <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full transition-all duration-300 ${
                        isActive ? "bg-white/80" : "bg-transparent"
                      }`} />

                      {renderIcon(item.icon, isActive)}

                      <span className={`text-[13px] font-medium tracking-wide transition-colors duration-200 ${
                        isActive ? "text-white" : "text-white/50 group-hover:text-white/80"
                      }`}>
                        {item.label}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Account section */}
            {publicKey && (
              <>
                <div className="my-4 mx-2">
                  <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
                </div>

                <p className="px-3 mb-2 text-[10px] text-white/25 uppercase tracking-[0.12em] font-medium">Account</p>

                <div className="space-y-0.5">
                  {accountItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        className="group relative block"
                      >
                        <div className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                          isActive
                            ? "bg-white/[0.08]"
                            : "hover:bg-white/[0.04]"
                        }`}>
                          <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full transition-all duration-300 ${
                            isActive ? "bg-white/80" : "bg-transparent"
                          }`} />

                          {renderIcon(item.icon, isActive)}

                          <span className={`text-[13px] font-medium tracking-wide transition-colors duration-200 ${
                            isActive ? "text-white" : "text-white/50 group-hover:text-white/80"
                          }`}>
                            {item.label}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </>
            )}
          </nav>

          {/* Membership - Scrollable section */}
          <div className="flex-1 overflow-y-auto px-4 min-h-0" style={{ scrollbarWidth: "none" }}>
            <style jsx>{`div::-webkit-scrollbar { display: none; }`}</style>
            <div className="py-2">
              <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent mb-4" />
              <p className="px-2 mb-3 text-[10px] text-white/25 uppercase tracking-[0.12em] font-medium">Membership</p>
              <EcosystemMembershipCard compact />
            </div>
          </div>

          {/* User Section - Refined */}
          <div className="mt-auto border-t border-white/[0.04] p-4" ref={userMenuRef}>
            {publicKey ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="w-full flex items-center gap-3 p-2.5 hover:bg-white/[0.04] rounded-xl transition-all duration-200"
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 bg-gradient-to-br from-white/20 to-white/5 rounded-xl flex items-center justify-center text-sm text-white/90 font-semibold border border-white/[0.08]">
                      {userProfile?.username?.charAt(0)?.toUpperCase() || publicKey.toBase58().charAt(0).toUpperCase()}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-black" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-[13px] font-medium text-white/90 truncate">
                      {userProfile?.username || shortAddress}
                    </p>
                    <p className="text-[11px] text-white/35 flex items-center gap-1.5">
                      {balance !== null ? `${balance.toFixed(3)} SOL` : "Loading..."}
                    </p>
                  </div>

                  {/* Chevron */}
                  <svg
                    className={`w-4 h-4 text-white/20 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                  </svg>
                </button>

                {/* User Menu Popup */}
                {isUserMenuOpen && (
                  <div className="absolute bottom-full left-0 right-0 mb-2 bg-black/95 backdrop-blur-xl rounded-xl border border-white/[0.08] shadow-2xl shadow-black/50 overflow-hidden">
                    {/* Balance display */}
                    <div className="p-4 border-b border-white/[0.04]">
                      <p className="text-xl font-semibold text-white tracking-tight">{balance !== null ? balance.toFixed(4) : "-"}</p>
                      <p className="text-[10px] uppercase tracking-[0.1em] text-white/30 mt-0.5">SOL Balance</p>
                    </div>

                    {/* Network */}
                    <div className="px-4 py-3 flex items-center justify-between border-b border-white/[0.04]">
                      <span className="text-[11px] text-white/40">Network</span>
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium bg-amber-500/10 text-amber-400/90 border border-amber-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        Devnet
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="p-2">
                      <button
                        onClick={() => { navigator.clipboard.writeText(publicKey.toBase58()); setIsUserMenuOpen(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-[13px] text-white/50 hover:text-white/80 hover:bg-white/[0.04] rounded-lg transition-all duration-200"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                        </svg>
                        Copy Address
                      </button>
                      <button
                        onClick={() => { clearSession(); disconnect(); setIsUserMenuOpen(false); onClose(); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-[13px] text-red-400/70 hover:text-red-400 hover:bg-red-500/[0.04] rounded-lg transition-all duration-200"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                        </svg>
                        Disconnect
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : mounted ? (
              <WalletMultiButton className="!w-full !bg-white hover:!bg-white/90 !text-black !rounded-xl !py-3 !text-[13px] !font-semibold !justify-center !border-0 !transition-colors" />
            ) : (
              <div className="h-11 bg-white/[0.04] rounded-xl animate-pulse" />
            )}
          </div>
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
