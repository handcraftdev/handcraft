"use client";

import { useEffect } from "react";
import {
  registerMwa,
  createDefaultAuthorizationCache,
  createDefaultChainSelector,
  createDefaultWalletNotFoundHandler,
} from "@solana-mobile/wallet-standard-mobile";

/**
 * MobileWalletAdapterProvider
 *
 * Registers the Solana Mobile Wallet Adapter (MWA) with the Wallet Standard.
 * This enables deep linking to mobile wallet apps (Phantom, Solflare, etc.)
 * when users interact with the dApp from a mobile browser.
 *
 * Must be rendered client-side only to avoid SSR issues.
 */
export function MobileWalletAdapterProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Only register on client-side (browser environment)
    if (typeof window === "undefined") return;

    const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet";
    const chains =
      network === "mainnet"
        ? (["solana:mainnet"] as const)
        : (["solana:devnet"] as const);

    const appName = process.env.NEXT_PUBLIC_APP_NAME || "Handcraft";
    const appUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL || "";

    try {
      registerMwa({
        appIdentity: {
          name: appName,
          uri: appUrl,
          icon: "/icon.png", // Relative to domain root
        },
        authorizationCache: createDefaultAuthorizationCache(),
        chains,
        chainSelector: createDefaultChainSelector(),
        onWalletNotFound: createDefaultWalletNotFoundHandler(),
      });
      console.log("[MobileWalletAdapter] Registered MWA for chains:", chains);
    } catch (error) {
      // MWA may already be registered or not supported in this environment
      console.log("[MobileWalletAdapter] MWA registration skipped:", error);
    }
  }, []);

  return <>{children}</>;
}
