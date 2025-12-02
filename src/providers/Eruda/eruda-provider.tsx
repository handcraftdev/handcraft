'use client';

import eruda from 'eruda';
import { ReactNode, useEffect, useState } from 'react';

/**
 * Eruda component provides an in-app debugging console for mobile web apps
 * It's especially useful for debugging within mini apps where standard
 * developer tools aren't accessible.
 */
export const Eruda = (props: { children: ReactNode }) => {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Only initialize once and only in browser environment
    if (typeof window !== 'undefined' && !isInitialized) {
      try {
        // Initialize with optimal settings for mini app development
        eruda.init({
          tool: ['console', 'elements', 'network', 'resources', 'info'],
          useShadowDom: true,
          autoScale: true,
          defaults: {
            displaySize: 40,
            transparency: 0.9,
            theme: 'Dark'
          }
        });
        
        // Add a custom welcome message to help developers
        eruda.get('console').log(
          '%cWelcome to Mini App Development!',
          'color: #4ade80; font-size: 14px; font-weight: bold;'
        );
        eruda.get('console').log(
          'Eruda debugger is active. You can use this console to debug your app.'
        );
        
        setIsInitialized(true);
      } catch (_error) {
        // Eruda initialization failed - continue without debugger
      }
    }
    
    // Cleanup function to destroy Eruda when component unmounts
    return () => {
      if (isInitialized && typeof window !== 'undefined') {
        try {
          eruda.destroy();
        } catch (_error) {
          // Failed to destroy Eruda - will be cleaned up on page unload anyway
        }
      }
    };
  }, [isInitialized]);

  return <>{props.children}</>;
};
