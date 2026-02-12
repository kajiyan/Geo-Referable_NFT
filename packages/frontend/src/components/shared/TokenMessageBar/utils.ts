/**
 * TokenMessageBar utility functions
 */

import { WEATHER_TOKEN_COLORS } from '@/lib/weatherTokens';

const COLOR_VALUES = Object.values(WEATHER_TOKEN_COLORS);

/** Default color index when colorIndex is undefined */
const DEFAULT_COLOR_INDEX = 13;

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
