'use client';

import { MiniKit } from '@worldcoin/minikit-js';
import { useMiniKit } from '@worldcoin/minikit-js/minikit-provider';
import { useEffect } from 'react';

/**
 * MiniKitInitializer
 *
 * This component ensures proper initialization of MiniKit with the app_id
 * It fixes the "App ID not provided during install" warning and monitors connection status
 */
export function MiniKitInitializer() {
  // Get MiniKit status
  // This property is not currently used but kept for future implementation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { isInstalled } = useMiniKit();

  // Use any to handle potentially missing properties in the current version
  const miniKitState = useMiniKit() as any;
  const connected = miniKitState.connected;
  const installing = miniKitState.installing;
  const miniKit = miniKitState.miniKit;

  // Initialize MiniKit with explicit app_id
  useEffect(() => {
    // Only run in browser environment
    if (typeof window === 'undefined') return;

    // Get app configuration from environment variables
    const rawAppId = process.env.NEXT_PUBLIC_APP_ID;

    if (rawAppId) {
      // Format app_id correctly to ensure proper format
      const appId = rawAppId.startsWith('app_')
        ? rawAppId
        : `app_${rawAppId}`;

      // Explicitly install MiniKit with app_id parameter
      // This prevents the "App ID not provided during install" warning
      // The MiniKit.install method takes either a string or an object depending on version
      MiniKit.install(appId);

      // MiniKit installed with app_id
    } else {
      // Warning: NEXT_PUBLIC_APP_ID is not configured
    }
  }, []);

  // Monitor connection status
  useEffect(() => {
    if (connected) {
      // MiniKit connection established

      // Get app details when connected
      if (miniKit) {
        miniKit.getAppDetails().then((_details: unknown) => {
          // MiniKit app details retrieved
        }).catch((_err: unknown) => {
          // Failed to get app details
        });
      }
    } else if (installing) {
      // MiniKit installation in progress
    } else {
      // MiniKit connection status: disconnected
    }
  }, [connected, installing, miniKit]);

  // This component doesn't render anything
  return null;
}