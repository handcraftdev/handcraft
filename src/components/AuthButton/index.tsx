'use client';
import { walletAuth } from '@/auth/wallet';
import { WorldButton } from '@/components/ui/WorldButton';
import { Button } from '@/components/ui/Button';
import { LiveFeedback } from '@worldcoin/mini-apps-ui-kit-react';
import { useMiniKit } from '@worldcoin/minikit-js/minikit-provider';
import { useCallback, useEffect, useState } from 'react';

/**
 * This component handles user authentication using World App wallet
 * It provides feedback states and handles both manual and automatic authentication
 * Read More: https://docs.world.org/mini-apps/commands/wallet-auth
 */
export const AuthButton = () => {
  // Enhanced state management with additional states
  const [authState, setAuthState] = useState<
    'idle' | 'pending' | 'success' | 'failed'
  >('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Get MiniKit installation status
  const { isInstalled } = useMiniKit();

  // Reset error after a timeout
  useEffect(() => {
    if (authState === 'failed' && errorMessage) {
      const timer = setTimeout(() => {
        setAuthState('idle');
        setErrorMessage(null);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [authState, errorMessage]);

  // Handle manual authentication via button click
  const handleAuth = useCallback(async () => {
    // Prevent re-authentication if already in progress or not installed
    if (!isInstalled || authState === 'pending') {
      return;
    }
    
    // Update state to show loading UI
    setAuthState('pending');
    setErrorMessage(null);
    
    try {
      // Attempt authentication
      await walletAuth();
      setAuthState('success');
    } catch (error) {
      // Handle authentication failure with proper error messaging
      console.error('Wallet authentication error:', error);
      setAuthState('failed');
      setErrorMessage(
        error instanceof Error 
          ? error.message 
          : 'Authentication failed. Please try again.'
      );
    }
  }, [isInstalled, authState]);

  // Auto-authenticate when component mounts if MiniKit is installed
  useEffect(() => {
    const autoAuthenticate = async () => {
      // Only auto-authenticate if MiniKit is installed and we're in idle state
      if (isInstalled && authState === 'idle') {
        setAuthState('pending');
        
        try {
          await walletAuth();
          setAuthState('success');
        } catch (error) {
          // Only log errors from auto-authentication, don't show to user
          console.error('Auto wallet authentication error:', error);
          setAuthState('idle');
        }
      }
    };

    autoAuthenticate();
  }, [isInstalled, authState]);

  return (
    <div className="card w-full max-w-md mx-auto">
      <div className="card-header bg-primary-50 dark:bg-primary-900 flex items-center justify-center">
        <h2 className="text-xl font-semibold text-primary-800 dark:text-primary-200">World App Authentication</h2>
      </div>
      
      <div className="card-body flex flex-col items-center gap-4">
        <div className="w-full">
          <LiveFeedback
            label={{
              failed: errorMessage || 'Authentication failed',
              pending: 'Connecting to wallet...',
              success: 'Wallet connected!',
            }}
            state={authState !== 'idle' ? authState : undefined}
            className="w-full"
          >
            {isInstalled ? (
              <WorldButton
                onClick={handleAuth}
                disabled={authState === 'pending'}
                size="lg"
                variant="primary"
                fullWidth
                className="bg-primary-500 hover:bg-primary-600"
              >
                {authState === 'pending' ? 'Connecting...' : 'Login with Wallet'}
              </WorldButton>
            ) : (
              <Button
                onClick={handleAuth}
                variant="default"
                size="lg"
                fullWidth
                className="bg-gradient-to-r from-primary-600 to-secondary-600 hover:from-primary-700 hover:to-secondary-700"
              >
                Open in World App
              </Button>
            )}
          </LiveFeedback>
        </div>
        
        {!isInstalled && (
          <div className="text-center">
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2">
              This application requires World App to function properly. Please open in World App to continue.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
