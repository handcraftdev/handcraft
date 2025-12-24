"use client";

import { ReactNode, useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TamaguiProvider } from "tamagui";
import { config } from "@handcraft/ui/tamagui.config";
import { SupabaseAuthProvider } from "@/hooks/useSupabaseAuth";

import "@solana/wallet-adapter-react-ui/styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

export function Providers({ children }: { children: ReactNode }) {
  // Use custom RPC URL if provided, otherwise fallback to public devnet
  const endpoint = useMemo(() => {
    const customRpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
    if (customRpc) {
      return customRpc;
    }
    // Fallback to public devnet (rate limited)
    return clusterApiUrl("devnet");
  }, []);

  // Empty array = auto-detect all Wallet Standard wallets (Phantom, Solflare, Jupiter, Backpack, etc.)
  const wallets = useMemo(() => [], []);

  // Temporarily disable wallet providers for debugging
  return (
    <QueryClientProvider client={queryClient}>
      <TamaguiProvider config={config} defaultTheme="dark">
        {children}
      </TamaguiProvider>
    </QueryClientProvider>
  );

  // Original with wallet providers:
  // return (
  //   <QueryClientProvider client={queryClient}>
  //     <TamaguiProvider config={config} defaultTheme="dark">
  //       <ConnectionProvider endpoint={endpoint}>
  //         <WalletProvider wallets={wallets} autoConnect={false}>
  //           <WalletModalProvider>
  //             <SupabaseAuthProvider>
  //               {children}
  //             </SupabaseAuthProvider>
  //           </WalletModalProvider>
  //         </WalletProvider>
  //       </ConnectionProvider>
  //     </TamaguiProvider>
  //   </QueryClientProvider>
  // );
}
