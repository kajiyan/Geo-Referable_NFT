/**
 * Token ID conversion utilities for The Graph compatibility.
 *
 * The Graph stores Token.id as Bytes (little-endian representation of tokenId).
 * This module provides conversion functions to ensure locally created tokens
 * have the same ID format as Subgraph entities, preventing duplicate rendering.
 */

/**
 * Convert BigInt tokenId to The Graph's Bytes hex format.
 *
 * The Graph's `Bytes.fromBigInt()` uses little-endian byte order internally.
 * This function replicates that conversion to ensure ID consistency between
 * locally created tokens and Subgraph-fetched tokens.
 *
 * @param tokenId - BigInt token ID from calculateTokenId()
 * @returns Hex string in The Graph's Bytes format (e.g., "0x17e714efaa33e204")
 *
 * @example
 * // Tokyo coordinates: lat 35.6789°, lon 139.6917°
 * const tokenId = calculateTokenId(35.6789, 139.6917)
 * const hexId = tokenIdToGraphBytesHex(tokenId)
 * // hexId === "0x17e714efaa33e204"
 */
export function tokenIdToGraphBytesHex(tokenId: bigint): string {
  // Step 1: Convert BigInt to hex string (big-endian)
  let hex = tokenId.toString(16)

  // Step 2: Pad to even length (hex requires pairs)
  if (hex.length % 2 !== 0) {
    hex = '0' + hex
  }

  // Step 3: Pad to 8 bytes (16 characters) - standard size for uint64 tokenId
  while (hex.length < 16) {
    hex = '0' + hex
  }

  // Step 4: Reverse byte order (convert to little-endian)
  // This matches The Graph's Bytes.fromBigInt() behavior
  const bytes: string[] = []
  for (let i = hex.length - 2; i >= 0; i -= 2) {
    bytes.push(hex.slice(i, i + 2))
  }

  return '0x' + bytes.join('')
}
