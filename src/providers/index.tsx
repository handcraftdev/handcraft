'use client';
import { MiniKitProvider } from '@worldcoin/minikit-js/minikit-provider';
import { PermissionsProvider } from '@/contexts/PermissionsContext';
import { registerGlobalEventHandlers } from '@/utils/eventHandlers';
import { Session } from 'next-auth';
import { SessionProvider } from 'next-auth/react';
import dynamic from 'next/dynamic';
import { ReactNode, useEffect } from 'react';
import { MiniKitInitializer } from '@/components/MiniKitInitializer';

// Dynamically import Eruda to prevent SSR issues
const ErudaProvider = dynamic(
  () => import('@/providers/Eruda').then((c) => c.ErudaProvider),
  { ssr: false },
);

// Event Handlers Initializer component
function EventHandlersInitializer() {
  useEffect(() => {
    // Register global event handlers when the component mounts
    registerGlobalEventHandlers();
  }, []);

  return null;
}


// Define props for ClientProviders
interface ClientProvidersProps {
  children: ReactNode;
  session: Session | null;
}

/**
 * ClientProvider wraps the app with essential context providers.
 *
 * Providers are arranged in the following order:
 * 1. ErudaProvider - For debugging, conditionally loaded in development
 * 2. MiniKitProvider - Core provider for World App mini-app functionality
 * 3. EventHandlersInitializer - Sets up global event handlers for MiniKit
 * 4. PermissionsProvider - Manages app permissions
 * 5. SessionProvider - Manages authentication state throughout the app
 */
export default function ClientProviders({
  children,
  session,
}: ClientProvidersProps) {
  // Get app configuration from environment variables
  const rawAppId = process.env.NEXT_PUBLIC_APP_ID;
  
  // Ensure app_id follows the expected format (must start with 'app_')
  // Note: This variable is not currently used since we initialize MiniKit separately
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let _appId: `app_${string}` | undefined;
  
  if (rawAppId) {
    // Format app_id correctly to prevent "App ID not provided during install" warning
    _appId = rawAppId.startsWith('app_')
      ? (rawAppId as `app_${string}`)
      : `app_${rawAppId}`;
  } else {
    // App ID is not configured - functionality may be limited
  }
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _appName = process.env.NEXT_PUBLIC_APP_NAME || 'Handcraft Mini App';
  
  return (
    <ErudaProvider>
      <MiniKitProvider>
        <MiniKitInitializer />

        {/* Initialize global event handlers */}
        <EventHandlersInitializer />

        <SessionProvider session={session}>
          <PermissionsProvider>
            {children}
          </PermissionsProvider>
        </SessionProvider>
      </MiniKitProvider>
    </ErudaProvider>
  );
}
