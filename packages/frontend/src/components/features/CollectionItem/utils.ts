/**
 * CollectionItem utility functions
 * Implements wave rendering rules from Fumi.sol (complete implementation)
 */

import { WEATHER_TOKEN_COLORS } from '@/lib/weatherTokens';
import type { Token } from '@/types';
import type { GradientColorGroup } from '../Norosi2D/types';

// Re-export shared wave utility for backward compatibility
export { getWaveCountFromRefs } from '@/lib/waveUtils';

const COLOR_VALUES = Object.values(WEATHER_TOKEN_COLORS);

/** Default color index when token.colorIndex is undefined */
const DEFAULT_COLOR_INDEX = 13;

/**
 * Extract parent token data from token.referringTo
 * Returns null if no parent exists or parent data is incomplete
 */
export function getParentData(token: Token): {
  colorIndex: number;
  refCount: number;
} | null {
  const parentRef = token.referringTo?.[0]?.toToken;
  if (!parentRef || !('colorIndex' in parentRef)) {
    return null;
  }
  const parent = parentRef as Token;
  return {
    colorIndex: parseInt(parent.colorIndex, 10),
    refCount: parseInt(parent.refCount || '0', 10),
  };
}

/**
 * Safely parse color index with fallback
 * Uses DEFAULT_COLOR_INDEX (13) when undefined
 */
export function parseColorIndex(colorIndex: string | undefined): number {
  if (colorIndex === undefined || colorIndex === '') {
    return DEFAULT_COLOR_INDEX;
  }
  const parsed = parseInt(colorIndex, 10);
  return isNaN(parsed) ? DEFAULT_COLOR_INDEX : parsed;
}

/**
 * Get color from index with bounds checking
 * Uses modulo 14 to wrap around color palette
 */
export function getColorFromIndex(colorIndex: number): string {
  const safeIndex = Math.abs(colorIndex) % 14;
  return COLOR_VALUES[safeIndex];
}

/**
 * Create gradient colors following Fumi.sol gradient spec
 *
 * Gradient stops (from Fumi.sol:703-708):
 * - offset 0%: colorIndex (opacity = 1 if hasParent, else 0)
 * - offset 70%: colorIndex (always opaque)
 * - offset 100%: referenceColorIndex (parent's color or same as token)
 *
 * @param colorIndex - Token's own color index
 * @param referenceColorIndex - Parent token's color index (or undefined for root tokens)
 * @param hasParent - Whether token has a parent (totalDistance > 0)
 */
export function createGradientColors(
  colorIndex: number,
  referenceColorIndex: number | undefined,
  hasParent: boolean
): GradientColorGroup {
  const topColor = getColorFromIndex(colorIndex);

  // Fumi.sol: top opacity = 1 if totalDistance > 0, else 0
  const topColorWithOpacity = hasParent ? topColor : `${topColor}00`;

  // Reference color: parent's color or same as token (monochrome)
  const bottomColor = referenceColorIndex !== undefined
    ? getColorFromIndex(referenceColorIndex)
    : topColor;

  // Return [offset 0, offset 0.7, offset 1.0]
  return [topColorWithOpacity, topColor, bottomColor];
}
