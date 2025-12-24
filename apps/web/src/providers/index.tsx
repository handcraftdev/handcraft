"use client";

import { ReactNode, useState, useEffect, useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";

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
  const [endpoint, setEndpoint] = useState<string | null>(null);

  useEffect(() => {
    const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
    console.log("[Providers] Setting endpoint:", rpc);
    setEndpoint(rpc);
  }, []);

  const wallets = useMemo(() => [], []);

  if (!endpoint) {
    console.log("[Providers] Waiting for endpoint...");
    return null;
  }

  console.log("[Providers] Rendering with endpoint:", endpoint);

  return (
    <QueryClientProvider client={queryClient}>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect={false}>
          <WalletModalProvider>
            {children}
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </QueryClientProvider>
  );
}
