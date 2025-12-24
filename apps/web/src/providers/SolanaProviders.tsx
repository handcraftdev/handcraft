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

// Log env vars on module load (safe - only NEXT_PUBLIC_ vars are exposed)
console.log("[ENV] NEXT_PUBLIC_SOLANA_RPC_URL:", process.env.NEXT_PUBLIC_SOLANA_RPC_URL ? "SET (" + process.env.NEXT_PUBLIC_SOLANA_RPC_URL.substring(0, 30) + "...)" : "NOT SET");
console.log("[ENV] NEXT_PUBLIC_SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL ? "SET (" + process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 30) + "...)" : "NOT SET");
console.log("[ENV] NEXT_PUBLIC_SUPABASE_ANON_KEY:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "SET (length: " + process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length + ")" : "NOT SET");
console.log("[ENV] NEXT_PUBLIC_APP_URL:", process.env.NEXT_PUBLIC_APP_URL || "NOT SET");

// Wrapper components with logging
function LoggedConnectionProvider({ endpoint, children }: { endpoint: string; children: ReactNode }) {
  console.log("[SolanaProviders] ConnectionProvider rendering with endpoint:", endpoint.substring(0, 30) + "...");
  return <ConnectionProvider endpoint={endpoint}>{children}</ConnectionProvider>;
}

function LoggedWalletProvider({ children }: { children: ReactNode }) {
  console.log("[SolanaProviders] WalletProvider rendering");
  return <WalletProvider wallets={[]} autoConnect={false}>{children}</WalletProvider>;
}

function LoggedWalletModalProvider({ children }: { children: ReactNode }) {
  console.log("[SolanaProviders] WalletModalProvider rendering");
  return <WalletModalProvider>{children}</WalletModalProvider>;
}

function LoggedSupabaseAuthProvider({ children }: { children: ReactNode }) {
  console.log("[SolanaProviders] SupabaseAuthProvider rendering");
  return <SupabaseAuthProvider>{children}</SupabaseAuthProvider>;
}

function ChildrenWrapper({ children }: { children: ReactNode }) {
  console.log("[SolanaProviders] Children rendering");
  return <>{children}</>;
}

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

  // Don't render ANYTHING until mounted - children contain components that use wallet context
  // Rendering children without providers causes "WalletContext not found" errors
  if (!mounted) {
    console.log("[SolanaProviders] Not mounted yet, returning null");
    return null;
  }

  console.log("[SolanaProviders] Rendering full provider tree");

  return (
    <LoggedConnectionProvider endpoint={endpoint}>
      <LoggedWalletProvider>
        <LoggedWalletModalProvider>
          <LoggedSupabaseAuthProvider>
            <ChildrenWrapper>
              {children}
            </ChildrenWrapper>
          </LoggedSupabaseAuthProvider>
        </LoggedWalletModalProvider>
      </LoggedWalletProvider>
    </LoggedConnectionProvider>
  );
}
