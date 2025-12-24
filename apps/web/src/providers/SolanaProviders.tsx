"use client";

import { ReactNode, useMemo, useEffect, useState } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { SupabaseAuthProvider } from "@/hooks/useSupabaseAuth";

export function SolanaProviders({ children }: { children: ReactNode }) {
  // Use state for endpoint - only set after client-side mount
  const [endpoint, setEndpoint] = useState<string | null>(null);

  useEffect(() => {
    // Set endpoint only on client side
    const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
    console.log("[SolanaProviders] Setting endpoint:", rpc.substring(0, 30) + "...");
    setEndpoint(rpc);
  }, []);

  // Modern wallets auto-register via Standard Wallet interface
  const wallets = useMemo(() => [], []);

  // Don't render until endpoint is set (client-side only)
  if (!endpoint) {
    return null;
  }

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
