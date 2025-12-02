'use client';

import dynamic from 'next/dynamic';
import { ReactNode } from 'react';

/**
 * Dynamically load Eruda to avoid SSR issues
 * Only loads when needed, reducing bundle size in production
 */
const Eruda = dynamic(() => import('./eruda-provider').then((c) => c.Eruda), {
  ssr: false,
});

/**
 * ErudaProvider conditionally adds the Eruda debugging console to the app
 * 
 * Eruda is a mobile web debugging tool that helps inspect console outputs,
 * network requests, and other debugging information within the mini app.
 * 
 * It will only be enabled in non-production environments by checking:
 * 1. NODE_ENV is not 'production'
 * 2. NEXT_PUBLIC_APP_ENV is not 'production'
 * 3. NEXT_PUBLIC_ENABLE_ERUDA is 'true' (if specified)
 */
export const ErudaProvider = (props: { children: ReactNode }) => {
  // Determine if we should enable Eruda based on environment variables
  const isProduction = 
    process.env.NODE_ENV === 'production' || 
    process.env.NEXT_PUBLIC_APP_ENV === 'production';
    
  // Allow explicit override with ENABLE_ERUDA env var
  const isErudaEnabled = 
    process.env.NEXT_PUBLIC_ENABLE_ERUDA === 'true';
    
  // Don't load Eruda in production unless explicitly enabled
  if (isProduction && !isErudaEnabled) {
    return <>{props.children}</>;
  }

  // Include Eruda in development or when explicitly enabled
  return <Eruda>{props.children}</Eruda>;
};
