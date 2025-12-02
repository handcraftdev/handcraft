'use server';
import crypto from 'crypto';
import { hashNonce } from './client-helpers';

/**
 * Generates a cryptographically secure random nonce and its corresponding HMAC signature.
 * 
 * Following best practices for secure authentication:
 * 1. Uses cryptographically strong random values
 * 2. Includes timestamp to prevent replay attacks
 * 3. Applies proper HMAC signing on the server side
 * 
 * @async
 * @returns {Promise<{ nonce: string, signedNonce: string }>} An object containing the nonce and its signed (hashed) value.
 */
export const getNewNonces = async () => {
  // Generate a more secure nonce with higher entropy
  // Combining random bytes with timestamp ensures uniqueness
  const randomBytes = crypto.randomBytes(24).toString('hex');
  const timestamp = Date.now().toString(36);
  const nonce = `${timestamp}-${randomBytes}`;
  
  // Create HMAC signature of the nonce
  const signedNonce = hashNonce({ nonce });
  
  // Validate HMAC secret is properly configured
  if (!process.env.HMAC_SECRET_KEY || process.env.HMAC_SECRET_KEY.length < 32) {
    console.warn('WARNING: HMAC_SECRET_KEY is missing or insufficient length. Authentication security is compromised.');
  }
  
  return {
    nonce,
    signedNonce,
  };
};
