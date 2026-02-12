/**
 * Color utilities for converting colorIndex to gradient colors
 *
 * The colorIndex (0-13) from the smart contract maps to predefined base colors.
 * Gradient colors (top/bottom) are derived from the base color.
 */

import { WEATHER_TOKEN_COLORS } from '@/lib/weatherTokens'

export interface GradientColors {
  topColor: string
  bottomColor: string
}

/**
 * Base colors mapped to colorIndex (0-13)
 * Single source of truth: weatherTokens.ts
 */
const BASE_COLORS: readonly string[] = Object.values(WEATHER_TOKEN_COLORS)

/**
 * Convert a colorIndex (0-13) to gradient colors for Norosi
 *
 * Both topColor and bottomColor use the same base color (no gradient).
 *
 * @param colorIndex - The color index from the token (0-13, wraps for larger values)
 *                     Accepts number or string (GraphQL BigInt returns as string)
 * @returns Gradient colors for top and bottom of the smoke effect
 */
export function colorIndexToGradient(colorIndex: number | string): GradientColors {
  // Parse string values (GraphQL BigInt is returned as string)
  let numericIndex: number
  if (typeof colorIndex === 'string') {
    numericIndex = parseInt(colorIndex, 10)
  } else if (typeof colorIndex === 'number') {
    numericIndex = colorIndex
  } else {
    return { topColor: BASE_COLORS[0], bottomColor: BASE_COLORS[0] }
  }

  // Handle NaN or Infinity
  if (!Number.isFinite(numericIndex)) {
    return { topColor: BASE_COLORS[0], bottomColor: BASE_COLORS[0] }
  }

  // Clamp to valid range and wrap around palette
  const normalizedIndex = Math.abs(Math.floor(numericIndex)) % BASE_COLORS.length
  const baseColor = BASE_COLORS[normalizedIndex]

  return {
    topColor: baseColor,
    bottomColor: baseColor,
  }
}
