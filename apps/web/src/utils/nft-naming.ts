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
 */
export function formatCollectionName(username: string, collectionName?: string | null): string {
  const prefix = 'HC: ';
  const effectiveUsername = username || 'Unknown';

  if (!collectionName?.trim()) {
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
  const fullName = `${prefix}${effectiveUsername}${separator}${collectionName.trim()}`;

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
    ? effectiveUsername.slice(0, maxUsernameLen - 1) + '…'
    : effectiveUsername;

  const remainingSpace = MAX_NAME_LENGTH - prefix.length - truncatedUsername.length - separator.length;
  const truncatedCollection = collectionName.trim().length > remainingSpace
    ? collectionName.trim().slice(0, remainingSpace - 1) + '…'
    : collectionName.trim();

  return `${prefix}${truncatedUsername}${separator}${truncatedCollection}`;
}

/**
 * Format NFT name: "{title} ({Rarity} #{edition})"
 * Truncates title to fit within 32 characters
 */
export function formatNftName(title: string, rarity: RarityLevel, edition: number): string {
  if (!title) title = 'Untitled';

  // Format edition as 6-digit number
  const editionStr = edition.toString().padStart(6, '0');

  // Suffix: " (C #000001)" = 12 characters
  const suffix = ` (${rarity} #${editionStr})`;

  const availableTitleSpace = MAX_NAME_LENGTH - suffix.length; // 32 - 12 = 20

  if (title.length <= availableTitleSpace) {
    return `${title}${suffix}`;
  }

  // Truncate title
  const truncatedTitle = title.slice(0, availableTitleSpace - 1) + '…';
  return `${truncatedTitle}${suffix}`;
}

/**
 * Format NFT name without edition (for preview/draft stage)
 */
export function formatNftNamePreview(title: string, rarity: RarityLevel): string {
  if (!title) title = 'Untitled';

  // Preview suffix: " (C #------)" = 12 characters
  const suffix = ` (${rarity} #------)`;

  const availableTitleSpace = MAX_NAME_LENGTH - suffix.length;

  if (title.length <= availableTitleSpace) {
    return `${title}${suffix}`;
  }

  const truncatedTitle = title.slice(0, availableTitleSpace - 1) + '…';
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
