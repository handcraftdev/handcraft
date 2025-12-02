import { useState, useEffect } from 'react';
import { Choice, VerificationState } from '../types';
import { requestVerification, verifyProof } from '../services/verification';

// Hook to manage verification state and process
export const useVerification = (onVerificationSuccess: (choice: Choice) => void) => {
  // Verification states
  const [verifying, setVerifying] = useState(false);
  const [verificationChoice, setVerificationChoice] = useState<Choice | null>(null);
  const [verificationState, setVerificationState] = useState<VerificationState>(undefined);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Add a listener to detect clicks outside World ID verification dialog
  useEffect(() => {
    // Only run while verification is active
    if (!verifying) return;

    // This listener helps detect when a user clicks outside the World ID verification dialog
    const handleClickOutside = () => {
      // Give enough time for proper cancellation to be detected first (300ms)
      // This prevents race conditions with the normal cancellation flow
      setTimeout(() => {
        // Only trigger if we're still in pending state (verification hasn't completed or been cancelled properly)
        if (verificationState === 'pending' && verifying) {
          // Click outside verification detected - resetting verification state
          handleCancellation();
        }
      }, 300);
    };

    // Set a short timeout before adding the listener (gives time for World ID dialog to open)
    const listenerTimeout = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 2000);

    // Cleanup listener when verification state changes
    return () => {
      document.removeEventListener('click', handleClickOutside);
      clearTimeout(listenerTimeout);
    };
  }, [verifying, verificationState]);

  // Helper function to handle cancellation consistently
  const handleCancellation = () => {
    // Update verification state to failed
    setVerificationState('failed');
    setVerificationError('Verification was cancelled. You can try again.');

    // Reset verification UI after a short delay
    setTimeout(() => {
      setVerifying(false);
      setVerificationState(undefined);
      setVerificationError(null);
      setVerificationChoice(null);
    }, 2000);
  };

  // Helper function to handle verification failures consistently
  const handleVerificationFailure = (errorMessage: string) => {
    // Update verification state to failed
    setVerificationState('failed');
    setVerificationError(errorMessage);

    // Reset verification UI after a longer delay to allow reading the error
    setTimeout(() => {
      setVerifying(false);
      setVerificationState(undefined);
      setVerificationError(null);
      setVerificationChoice(null);
    }, 4000);
  };

  // Initialize verification process
  const startVerification = async (choice: Choice, isInstalled: boolean) => {
    // Check if already verifying or World ID not installed
    if (!isInstalled || verificationState === 'pending') {
      return;
    }

    // Starting verification for move
    
    // Set initial states
    setVerifying(true);
    setVerificationChoice(choice);
    setVerificationState('pending');
    setVerificationError(null);

    try {
      // Request verification from World ID
      const result = await requestVerification(choice);

      // Handle cancellation from requestVerification
      if (result.cancelled) {
        // User cancelled verification during request phase
        handleCancellation();
        return;
      }

      const { finalPayload, actionId, signal } = result;

      // Continue only if we have a valid payload from successful verification request
      if (!finalPayload) {
        // Missing verification payload
        handleVerificationFailure('Verification failed. Please try again.');
        return;
      }

      // Call the simplified verification function
      const data = await verifyProof(finalPayload, actionId, signal);

      // Simplified handling of verification result
      if (!data || !data.verifyRes) {
        // Should never happen with our new implementation, but just in case
        handleVerificationFailure('Verification system error');
        return;
      }

      // Handle cancellation
      if (data.verifyRes.cancelled) {
        handleCancellation();
        return;
      }

      // Handle server errors
      if (data.verifyRes.serverError) {
        handleVerificationFailure('Verification failed. Please try again.');
        return;
      }

      // Handle system errors
      if (data.verifyRes.systemError) {
        handleVerificationFailure('Verification failed. Please try again.');
        return;
      }

      // Handle success case
      if (data.verifyRes.success) {
        // Verification successful, proceeding with game move
        setVerificationState('success');

        // Short delay before proceeding with the game
        setTimeout(() => {
          setVerifying(false);
          setVerificationState(undefined);
          setVerificationChoice(null);
          onVerificationSuccess(choice);
        }, 800);
        return;
      }

      // Handle general failure case with user-friendly message
      const errorMessage = data.verifyRes.error || 'Verification failed';
      handleVerificationFailure(`${errorMessage}. Please try again.`);
      return;
    } catch (error) {
      // Handle any errors during the process
      // Verification error

      // Convert technical errors to user-friendly messages
      let userFriendlyError = 'An error occurred during verification. Please try again.';

      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();
        // Detailed error message

        if (errorMsg.includes('cancel') || errorMsg.includes('denied') ||
            errorMsg.includes('rejected') || errorMsg.includes('closed')) {
          handleCancellation();
          return;
        } else if (errorMsg.includes('network') || errorMsg.includes('connection') ||
                   errorMsg.includes('offline')) {
          userFriendlyError = 'Network issue during verification. Please check your connection and try again.';
        } else if (errorMsg.includes('timeout')) {
          userFriendlyError = 'Verification took too long. Please try again.';
        } else if (errorMsg.includes('required') || errorMsg.includes('attribute')) {
          // Handle validation errors
          userFriendlyError = 'There was a problem with the verification request. Please try again or restart the app.';
        }
      }

      handleVerificationFailure(userFriendlyError);
    }
  };

  return {
    verifying,
    verificationChoice,
    verificationState,
    verificationError,
    startVerification
  };
};