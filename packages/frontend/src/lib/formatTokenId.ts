/**
 * Token ID formatting utility
 * Shared between CollectionItem and HistoryItem
 */

/** Default padding length for token ID display */
const TOKEN_ID_PAD_LENGTH = 3;

/**
 * Format token ID with zero-padding
 * @param value - Token ID (string or number)
 * @returns Formatted string (e.g., "001", "042", "999")
 */
export function formatTokenId(value: string | number): string {
  const num = typeof value === 'string' ? parseInt(value, 10) : value;
  return num.toString().padStart(TOKEN_ID_PAD_LENGTH, '0');
}
