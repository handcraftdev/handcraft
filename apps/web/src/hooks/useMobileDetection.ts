"use client";

import { useState, useEffect } from "react";

interface MobileDetectionResult {
  isMobile: boolean;
  isAndroid: boolean;
  isIOS: boolean;
  isMobileWalletBrowser: boolean;
}

/**
 * Hook to detect mobile platform and wallet browser environment.
 *
 * Useful for:
 * - Showing mobile-specific wallet connection messaging
 * - Detecting if user is already in a wallet's in-app browser
 * - Providing platform-specific instructions
 */
export function useMobileDetection(): MobileDetectionResult {
  const [result, setResult] = useState<MobileDetectionResult>({
    isMobile: false,
    isAndroid: false,
    isIOS: false,
    isMobileWalletBrowser: false,
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return;
    }

    const userAgent = navigator.userAgent || navigator.vendor || "";

    const isAndroid = /android/i.test(userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isMobile = isAndroid || isIOS || /mobile/i.test(userAgent);

    // Detect if we're inside a wallet's in-app browser
    // Phantom, Solflare, and other wallets inject identifiers
    const isPhantomBrowser = /Phantom/i.test(userAgent);
    const isSolflareBrowser = /Solflare/i.test(userAgent);
    const isMobileWalletBrowser = isPhantomBrowser || isSolflareBrowser;

    setResult({
      isMobile,
      isAndroid,
      isIOS,
      isMobileWalletBrowser,
    });
  }, []);

  return result;
}

/**
 * Get URLs for wallet app stores based on platform.
 */
export function getWalletInstallUrls(isIOS: boolean, isAndroid: boolean) {
  return {
    phantom: {
      ios: "https://apps.apple.com/app/phantom-solana-wallet/id1598432977",
      android: "https://play.google.com/store/apps/details?id=app.phantom",
      url: isIOS
        ? "https://apps.apple.com/app/phantom-solana-wallet/id1598432977"
        : isAndroid
          ? "https://play.google.com/store/apps/details?id=app.phantom"
          : "https://phantom.app/download",
    },
    solflare: {
      ios: "https://apps.apple.com/app/solflare-solana-wallet/id1580902717",
      android: "https://play.google.com/store/apps/details?id=com.solflare.mobile",
      url: isIOS
        ? "https://apps.apple.com/app/solflare-solana-wallet/id1580902717"
        : isAndroid
          ? "https://play.google.com/store/apps/details?id=com.solflare.mobile"
          : "https://solflare.com/download",
    },
  };
}
