/**
 * Wave calculation utilities
 * Mirrors Fumi.sol _getWaveCountFromRefs logic
 */

/**
 * Calculate wave count from reference count
 * Based on Fumi.sol _getWaveCountFromRefs implementation
 *
 * @param refCount - Number of references (children) this token has
 * @returns Wave count (3-12)
 */
export function getWaveCountFromRefs(refCount: number): number {
  if (refCount < 5) return 3;
  if (refCount < 10) return 5;
  if (refCount < 20) return 7;
  if (refCount < 50) return 9;
  if (refCount < 100) return 10;
  return 12;
}
