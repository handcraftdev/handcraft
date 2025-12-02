'use client';
import { WorldButton } from '@/components/ui/WorldButton';
import { LiveFeedback } from '@worldcoin/mini-apps-ui-kit-react';
import { MiniKit, VerificationLevel } from '@worldcoin/minikit-js';
import { useMiniKit } from '@worldcoin/minikit-js/minikit-provider';
import { useState } from 'react';
import { useSession } from 'next-auth/react';

// Action ID from the developer portal
const VERIFY_ACTION_ID = process.env.NEXT_PUBLIC_VERIFY_ACTION_ID || 'test-action';

/**
 * This component implements World ID verification in Mini Apps
 * Following best practices:
 * 1. Server-side verification of proofs
 * 2. Record verification results in database
 * 3. Appropriate error handling and user feedback
 * 
 * Read More: https://docs.world.org/mini-apps/commands/verify
 */
export const Verify = () => {
  // State for tracking verification status
  const [buttonState, setButtonState] = useState<
    'pending' | 'success' | 'failed' | undefined
  >(undefined);

  // Track which verification type is being used
  const [verificationInProgress, setVerificationInProgress] = useState<VerificationLevel | null>(null);
  
  // Get MiniKit installation status
  const { isInstalled } = useMiniKit();
  
  // Get user session status
  useSession();
  
  // Error message state for displaying verification failures
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /**
   * Handles the verification process
   * 
   * @param verificationLevel Device or Orb verification
   * @param signal Optional additional data to include in verification
   */
  const handleVerification = async (
    verificationLevel: VerificationLevel, 
    signal?: string
  ) => {
    if (!isInstalled || buttonState === 'pending') {
      return;
    }
    
    try {
      // Reset states
      setButtonState('pending');
      setVerificationInProgress(verificationLevel);
      setErrorMessage(null);
      
      // 1. Request verification from user via MiniKit
      const result = await MiniKit.commandsAsync.verify({
        action: VERIFY_ACTION_ID,
        verification_level: verificationLevel,
        signal: signal, // Optional parameter for additional context
      });
      
      // 2. Send proof to backend for verification
      const response = await fetch('/api/verify-proof', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payload: result.finalPayload,
          action: VERIFY_ACTION_ID,
          signal: signal,
          // Pass the requested verification level explicitly
          requestedVerificationLevel: verificationLevel, 
        }),
      });

      // 3. Handle verification result
      if (!response.ok) {
        throw new Error(`Verification API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.verifyRes.success) {
        // Verification succeeded - the API has already recorded it in the database
        setButtonState('success');
        
        // Note: The verification is stored server-side in the API route
        // We don't need to record it here, as that would create duplicate records
      } else {
        // Verification failed
        setButtonState('failed');
        setErrorMessage(data.verifyRes.error || 'Verification failed');
        
        // Reset button state after delay
        setTimeout(() => {
          setButtonState(undefined);
          setVerificationInProgress(null);
          setErrorMessage(null);
        }, 3000);
      }
    } catch (error) {
      // Handle any errors during the process
      console.error('Verification error:', error);
      setButtonState('failed');
      setErrorMessage(
        error instanceof Error 
          ? error.message 
          : 'An error occurred during verification'
      );
      
      // Reset button state after delay
      setTimeout(() => {
        setButtonState(undefined);
        setVerificationInProgress(null);
        setErrorMessage(null);
      }, 3000);
    }
  };

  return (
    <div className="card w-full">
      <div className="card-header bg-success-50 dark:bg-success-900">
        <h2 className="text-lg font-semibold text-success-800 dark:text-success-200">
          World ID Verification
        </h2>
      </div>
      
      <div className="card-body space-y-4">
        <p className="text-neutral-700 dark:text-neutral-300 text-sm">
          Verify your unique humanity using World ID. Choose your verification method:
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Device verification option */}
          <div className="p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg">
            <h3 className="font-medium mb-2 text-neutral-800 dark:text-neutral-200">Device Verification</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
              Verify using your device&apos;s biometrics, such as Face ID or fingerprint.
            </p>
            
            <LiveFeedback
              label={{
                failed: errorMessage || 'Verification failed',
                pending: 'Verifying with device...',
                success: 'Device verification successful!',
              }}
              state={
                verificationInProgress === VerificationLevel.Device
                  ? buttonState
                  : undefined
              }
              className="w-full"
            >
              <WorldButton
                onClick={() => handleVerification(VerificationLevel.Device)}
                disabled={buttonState === 'pending' || !isInstalled}
                size="lg"
                variant="tertiary"
                fullWidth
              >
                Verify with Device
              </WorldButton>
            </LiveFeedback>
          </div>
          
          {/* Orb verification option */}
          <div className="p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-primary-50 dark:bg-primary-950">
            <h3 className="font-medium mb-2 text-neutral-800 dark:text-neutral-200">Orb Verification</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
              Stronger verification using your previous World ID Orb verification.
            </p>
            
            <LiveFeedback
              label={{
                failed: errorMessage || 'Verification failed',
                pending: 'Verifying with Orb...',
                success: 'Orb verification successful!',
              }}
              state={
                verificationInProgress === VerificationLevel.Orb
                  ? buttonState
                  : undefined
              }
              className="w-full"
            >
              <WorldButton
                onClick={() => handleVerification(VerificationLevel.Orb)}
                disabled={buttonState === 'pending' || !isInstalled}
                size="lg"
                variant="primary"
                fullWidth
              >
                Verify with Orb
              </WorldButton>
            </LiveFeedback>
          </div>
        </div>
        
        {!isInstalled && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
            Open in World App to verify your identity
          </p>
        )}
      </div>
    </div>
  );
};
