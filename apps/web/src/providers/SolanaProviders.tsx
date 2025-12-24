"use client";

import { ReactNode, useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";
import { SupabaseAuthProvider } from "@/hooks/useSupabaseAuth";

export function SolanaProviders({ children }: { children: ReactNode }) {
  // Use custom RPC URL if provided, otherwise fallback to public devnet
  const endpoint = useMemo(() => {
    const customRpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
    if (customRpc) {
      return customRpc;
    }
    // Fallback to public devnet (rate limited)
    return clusterApiUrl("devnet");
  }, []);

  // Empty array = auto-detect all Wallet Standard wallets
  const wallets = useMemo(() => [], []);

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
