import { MiniKit } from '@worldcoin/minikit-js';
import { signIn } from 'next-auth/react';
import { getNewNonces } from './server-helpers';

/**
 * Authenticates a user via their wallet using a nonce-based challenge-response mechanism.
 *
 * This function generates a unique `nonce` and requests the user to sign it with their wallet,
 * producing a `signedNonce`. The `signedNonce` ensures the response we receive from wallet auth
 * is authentic and matches our session creation.
 *
 * @returns {Promise<SignInResponse>} The result of the sign-in attempt.
 * @throws {Error} If wallet authentication fails at any step.
 */
export const walletAuth = async () => {
  try {
    // Get secure nonce from server
    const { nonce, signedNonce } = await getNewNonces();

    // Request wallet authentication with best practices
    const result = await MiniKit.commandsAsync.walletAuth({
      nonce,
      // Set reasonable expiration time (7 days)
      expirationTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      // Allow for some clock skew
      notBefore: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes in the past
      // Clear statement with unique identifier
      statement: `Sign in to ${process.env.NEXT_PUBLIC_APP_NAME || 'Mini App'} (${crypto.randomUUID().slice(0, 8)})`,
      // Optional request ID for tracking
      requestId: crypto.randomUUID(),
    });

    // Handle null response case
    if (!result) {
      throw new Error('No response from wallet auth');
    }

    // Process authentication result
    if (result.finalPayload.status !== 'success') {
      // Handle error with proper type checking
      const payload = result.finalPayload as unknown as { error_code?: string; code?: string; detail?: string };
      const errorCode = payload.error_code || payload.code || 'unknown';
      const errorMessage = payload.detail || 'Unknown error';

      // Throw detailed error for proper handling
      throw new Error(`Authentication failed: ${errorCode} - ${errorMessage}`);
    }

    // Proceed with NextAuth sign in
    return await signIn('credentials', {
      redirectTo: '/home',
      nonce,
      signedNonce,
      finalPayloadJson: JSON.stringify(result.finalPayload),
    });
  } catch (error) {
    // Rethrow with additional context
    console.error('Wallet authentication error:', error);
    throw error;
  }
};
