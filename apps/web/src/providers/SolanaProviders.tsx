"use client";

import { ReactNode, useMemo, useEffect, useState } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";
import { SupabaseAuthProvider } from "@/hooks/useSupabaseAuth";

console.log("[SolanaProviders] Module loaded successfully");

export function SolanaProviders({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  console.log("[SolanaProviders] Render, mounted:", mounted);

  useEffect(() => {
    console.log("[SolanaProviders] useEffect - mounting");
    setMounted(true);
  }, []);

  // Use custom RPC URL if provided, otherwise fallback to public devnet
  const endpoint = useMemo(() => {
    console.log("[SolanaProviders] Creating endpoint");
    const customRpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
    if (customRpc) {
      console.log("[SolanaProviders] Using custom RPC");
      return customRpc;
    }
    console.log("[SolanaProviders] Using public devnet");
    return clusterApiUrl("devnet");
  }, []);

  // Empty array = auto-detect all Wallet Standard wallets
  const wallets = useMemo(() => {
    console.log("[SolanaProviders] Creating wallets array");
    return [];
  }, []);

  // Don't render providers until mounted to avoid hydration issues
  if (!mounted) {
    console.log("[SolanaProviders] Not mounted yet, returning children only");
    return <>{children}</>;
  }

  console.log("[SolanaProviders] Rendering full provider tree");

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>
          <SupabaseAuthProvider>
            {children}
          </SupabaseAuthProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
