"use client";

console.log("[Module Load] providers/index.tsx");

import { ReactNode, useState, useEffect, useMemo, useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork, Adapter } from "@solana/wallet-adapter-base";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { WalletConnectWalletAdapter } from "@walletconnect/solana-adapter";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  CoinbaseWalletAdapter,
  TrustWalletAdapter,
  LedgerWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { SupabaseAuthProvider } from "@/hooks/useSupabaseAuth";
import { MobileWalletAdapterProvider } from "@/components/MobileWalletAdapter";

import "@solana/wallet-adapter-react-ui/styles.css";

export function Providers({ children }: { children: ReactNode }) {
  const [endpoint, setEndpoint] = useState<string | null>(null);

  // Create QueryClient lazily - only once, after mount
  const queryClientRef = useRef<QueryClient | null>(null);
  if (!queryClientRef.current) {
    queryClientRef.current = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000,
          refetchOnWindowFocus: false,
        },
      },
    });
  }

  useEffect(() => {
    const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
    console.log("[Providers] Setting endpoint:", rpc);
    setEndpoint(rpc);
  }, []);

  // Configure wallet adapters
  // - Explicit adapters for major wallets
  // - WalletConnect: Enables QR code scanning for desktop-to-mobile connections
  // - Wallet Standard auto-discovery also enabled for other wallets
  const wallets = useMemo(() => {
    const network =
      process.env.NEXT_PUBLIC_SOLANA_NETWORK === "mainnet"
        ? WalletAdapterNetwork.Mainnet
        : WalletAdapterNetwork.Devnet;

    const adapters: Adapter[] = [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network }),
      new CoinbaseWalletAdapter(),
      new TrustWalletAdapter(),
      new LedgerWalletAdapter(),
    ];

    // Add WalletConnect if project ID is configured
    const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
    if (projectId) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://handcraft.io";
      const appName = process.env.NEXT_PUBLIC_APP_NAME || "Handcraft";

      adapters.push(
        new WalletConnectWalletAdapter({
          network,
          options: {
            projectId,
            metadata: {
              name: appName,
              description: "Decentralized content platform - Videos, Audio, Communities",
              url: appUrl,
              icons: [`${appUrl}/icon.png`],
            },
          },
        })
      );
    } else {
      console.log("[Providers] WalletConnect not configured (no project ID)");
    }

    return adapters;
  }, []);

  if (!endpoint) {
    console.log("[Providers] Waiting for endpoint...");
    return null;
  }

  console.log("[Providers] Rendering with endpoint:", endpoint);

  return (
    <QueryClientProvider client={queryClientRef.current}>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
            <MobileWalletAdapterProvider>
              <SupabaseAuthProvider>
                {children}
              </SupabaseAuthProvider>
            </MobileWalletAdapterProvider>
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </QueryClientProvider>
  );
}
