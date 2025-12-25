/**
 * NFT Naming Convention Utilities
 *
 * Collection Name: "HC: {username}: {collectionname}" (max 32 chars)
 * - Collection name is optional, append only if available
 *
 * NFT Name: "{title} ({Rarity} #{edition})" (max 32 chars)
 * - Rarity: C (Common), U (Uncommon), R (Rare), E (Epic), L (Legendary)
 * - Edition: 6-digit number (e.g., #000001)
 */

const MAX_NAME_LENGTH = 32;

/**
 * Sanitize string for on-chain use (ASCII only, no special characters)
 * Replaces non-ASCII characters with closest ASCII equivalents or removes them
 */
export function sanitizeForOnChain(str: string): string {
  return str
    // Normalize Unicode (decompose accented characters)
    .normalize('NFD')
    // Remove diacritical marks (accents)
    .replace(/[\u0300-\u036f]/g, '')
    // Replace common Unicode characters with ASCII equivalents
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/…/g, '..')
    .replace(/[^\x20-\x7E]/g, '') // Remove any remaining non-ASCII printable characters
    .trim();
}

export type RarityLevel = 'C' | 'U' | 'R' | 'E' | 'L';

export const RARITY_LABELS: Record<RarityLevel, string> = {
  C: 'Common',
  U: 'Uncommon',
  R: 'Rare',
  E: 'Epic',
  L: 'Legendary',
};

/**
 * Format collection name: "HC: {username}: {collectionname}"
 * Truncates to fit within 32 characters
 * Sanitizes input for on-chain compatibility (ASCII only)
 */
export function formatCollectionName(username: string, collectionName?: string | null): string {
  const prefix = 'HC: ';
  const effectiveUsername = sanitizeForOnChain(username) || 'Unknown';
  const sanitizedCollectionName = collectionName ? sanitizeForOnChain(collectionName) : null;

  if (!sanitizedCollectionName?.trim()) {
    // No collection name: "HC: {username}"
    const result = `${prefix}${effectiveUsername}`;
    if (result.length <= MAX_NAME_LENGTH) {
      return result;
    }
    // Truncate username if needed
    const maxUsernameLen = MAX_NAME_LENGTH - prefix.length;
    return `${prefix}${effectiveUsername.slice(0, maxUsernameLen)}`;
  }

  // With collection name: "HC: {username}: {collectionname}"
  const separator = ': ';
  const trimmedCollection = sanitizedCollectionName.trim();
  const fullName = `${prefix}${effectiveUsername}${separator}${trimmedCollection}`;

  if (fullName.length <= MAX_NAME_LENGTH) {
    return fullName;
  }

  // Need to truncate - prioritize collection name over username
  // Minimum: "HC: " (4) + "..." (3) + ": " (2) + at least 3 chars of collection = 12
  const overhead = prefix.length + separator.length; // 4 + 2 = 6

  // Available space for username + collection name
  const availableSpace = MAX_NAME_LENGTH - overhead;

  // Give username up to 10 chars, rest to collection name
  const maxUsernameLen = Math.min(effectiveUsername.length, 10);
  const truncatedUsername = effectiveUsername.length > maxUsernameLen
    ? effectiveUsername.slice(0, maxUsernameLen - 2) + '..'
    : effectiveUsername;

  const remainingSpace = MAX_NAME_LENGTH - prefix.length - truncatedUsername.length - separator.length;
  const truncatedCollection = trimmedCollection.length > remainingSpace
    ? trimmedCollection.slice(0, remainingSpace - 2) + '..'
    : trimmedCollection;

  return `${prefix}${truncatedUsername}${separator}${truncatedCollection}`;
}

/**
 * Format NFT name: "{title} ({Rarity} #{edition})"
 * Truncates title to fit within 32 characters
 * Sanitizes input for on-chain compatibility (ASCII only)
 */
export function formatNftName(title: string, rarity: RarityLevel, edition: number): string {
  const sanitizedTitle = sanitizeForOnChain(title) || 'Untitled';

  // Format edition as 6-digit number
  const editionStr = edition.toString().padStart(6, '0');

  // Suffix: " (C #000001)" = 12 characters
  const suffix = ` (${rarity} #${editionStr})`;

  const availableTitleSpace = MAX_NAME_LENGTH - suffix.length; // 32 - 12 = 20

  if (sanitizedTitle.length <= availableTitleSpace) {
    return `${sanitizedTitle}${suffix}`;
  }

  // Truncate title (use ASCII ".." instead of Unicode ellipsis for on-chain compatibility)
  const truncatedTitle = sanitizedTitle.slice(0, availableTitleSpace - 2) + '..';
  return `${truncatedTitle}${suffix}`;
}

/**
 * Format NFT name without edition (for preview/draft stage)
 * Sanitizes input for on-chain compatibility (ASCII only)
 */
export function formatNftNamePreview(title: string, rarity: RarityLevel): string {
  const sanitizedTitle = sanitizeForOnChain(title) || 'Untitled';

  // Preview suffix: " (C #------)" = 12 characters
  const suffix = ` (${rarity} #------)`;

  const availableTitleSpace = MAX_NAME_LENGTH - suffix.length;

  if (sanitizedTitle.length <= availableTitleSpace) {
    return `${sanitizedTitle}${suffix}`;
  }

  const truncatedTitle = sanitizedTitle.slice(0, availableTitleSpace - 2) + '..';
  return `${truncatedTitle}${suffix}`;
}

/**
 * Get character count info for UI display
 */
export function getCollectionNameInfo(username: string, collectionName?: string | null): {
  formatted: string;
  length: number;
  isValid: boolean;
  inputLength: number;
  maxInputLength: number;
} {
  const formatted = formatCollectionName(username, collectionName);
  const inputLength = collectionName?.trim().length || 0;

  // Calculate max input length based on username
  // Format: "HC: {username}: {collectionname}" (32 max)
  // Overhead: "HC: " (4) + ": " (2) = 6
  // Username gets max 10 chars (truncated if longer), fallback to "Unknown" (7 chars)
  const effectiveUsername = username || 'Unknown';
  const effectiveUsernameLen = Math.min(effectiveUsername.length, 10);
  const overhead = 4 + effectiveUsernameLen + 2; // "HC: " + username + ": "
  const maxInputLength = MAX_NAME_LENGTH - overhead;

  return {
    formatted,
    length: formatted.length,
    isValid: formatted.length <= MAX_NAME_LENGTH,
    inputLength,
    maxInputLength,
  };
}

export function getNftNameInfo(title: string, rarity: RarityLevel): {
  formatted: string;
  length: number;
  isValid: boolean;
} {
  const formatted = formatNftNamePreview(title, rarity);
  return {
    formatted,
    length: formatted.length,
    isValid: formatted.length <= MAX_NAME_LENGTH,
  };
}
