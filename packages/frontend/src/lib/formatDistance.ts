/**
 * Distance formatting utilities (Fumi.sol compliant)
 * Uses X.Xkm format with 0.1km precision
 *
 * @see packages/contracts/contracts/Fumi.sol line 748
 * Format: _toString(params.totalDistance / 1000), ".", _toString((params.totalDistance / 100) % 10), "km"
 */

/**
 * Format distance from meters to km string
 * @param meters - Distance in meters (string from subgraph or number)
 * @returns Formatted distance string like "1.2km"
 * @example
 * formatDistanceFromMeters("1234") // "1.2km"
 * formatDistanceFromMeters("500")  // "0.5km"
 * formatDistanceFromMeters("0")    // "0.0km"
 */
export function formatDistanceFromMeters(meters: string | number): string {
  const m = typeof meters === 'string' ? parseFloat(meters) : meters;
  if (isNaN(m) || m <= 0) return '0.0km';
  const km = Math.floor(m / 100) / 10;
  return `${km.toFixed(1)}km`;
}

/**
 * Convert meters to kilometers (number only, no formatting)
 * @param meters - Distance in meters as string
 * @returns Kilometers with 0.1km precision
 * @example
 * metersToKm("1234") // 1.2
 * metersToKm("500")  // 0.5
 */
export function metersToKm(meters: string): number {
  const m = parseInt(meters, 10);
  if (isNaN(m) || m <= 0) return 0;
  return Math.floor(m / 100) / 10;
}

/**
 * Format pre-converted km value to string
 * @param km - Distance in kilometers
 * @returns Formatted distance string like "1.2km"
 */
export function formatKm(km: number): string {
  return `${km.toFixed(1)}km`;
}
