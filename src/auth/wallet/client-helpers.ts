import crypto from 'crypto';

/**
 * Generates an HMAC-SHA256 hash of the provided nonce using a secret key from the environment.
 * 
 * This implementation follows security best practices:
 * 1. Uses SHA-256 for strong cryptographic security
 * 2. Validates input to prevent empty or invalid nonces
 * 3. Handles missing secret key gracefully with error reporting
 * 
 * @param {Object} params - The parameters object.
 * @param {string} params.nonce - The nonce to be hashed.
 * @returns {string} The resulting HMAC hash in hexadecimal format.
 * @throws {Error} If HMAC_SECRET_KEY is not set or if nonce is invalid.
 */
export const hashNonce = ({ nonce }: { nonce: string }): string => {
  // Input validation
  if (!nonce || typeof nonce !== 'string' || nonce.trim() === '') {
    throw new Error('Invalid nonce provided for HMAC generation');
  }
  
  // Secret key validation
  const secretKey = process.env.HMAC_SECRET_KEY;
  if (!secretKey) {
    throw new Error('HMAC_SECRET_KEY is not set in environment variables');
  }
  
  // Generate HMAC using SHA-256
  try {
    const hmac = crypto.createHmac('sha256', secretKey);
    hmac.update(nonce);
    return hmac.digest('hex');
  } catch (error) {
    console.error('Error generating HMAC:', error);
    throw new Error('Failed to generate HMAC signature');
  }
};
