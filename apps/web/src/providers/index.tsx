"use client";

import { ReactNode } from "react";
import dynamic from "next/dynamic";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TamaguiProvider } from "tamagui";
import { config } from "@handcraft/ui/tamagui.config";

import "@solana/wallet-adapter-react-ui/styles.css";

// Dynamically import Solana providers with ssr: false to avoid PublicKey._bn issues
const SolanaProviders = dynamic(
  () => import("./SolanaProviders").then((mod) => mod.SolanaProviders),
  { ssr: false }
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TamaguiProvider config={config} defaultTheme="dark">
        <SolanaProviders>
          {children}
        </SolanaProviders>
      </TamaguiProvider>
    </QueryClientProvider>
  );
}
