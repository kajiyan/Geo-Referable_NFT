/**
 * Marquee width calculation based on mint time and reference timestamp.
 *
 * - Full development: 7 days (if no references)
 * - Growth stops at first reference timestamp
 *
 * Uses logarithmic growth: w = 100 + 200 * (1 - e^(-t/τ))
 */

import {
  calculateTimeBasedGrowth,
  GrowthConfig,
  FULL_DEVELOPMENT_DAYS,
} from './timeBasedGrowth'

/** Minimum width for newly minted NFTs (pixels) */
const MIN_WIDTH = 100

/** Maximum width for fully developed marquee (pixels) */
const MAX_WIDTH = 300

const MARQUEE_CONFIG: GrowthConfig = {
  minValue: MIN_WIDTH,
  maxValue: MAX_WIDTH,
  label: 'calculateMarqueeWidth',
}

/**
 * Calculate marquee width based on mint time and first reference time.
 *
 * @param createdAt - Unix timestamp (seconds) when NFT was minted
 * @param firstReferenceAt - Unix timestamp (seconds) of first reference, or null if none
 * @param currentTime - Current Unix timestamp (seconds), defaults to now
 * @returns Width in pixels (100-300px range)
 *
 * @example
 * // NFT minted 3 days ago with no references
 * calculateMarqueeWidth(createdAt, null) // ~230px
 *
 * @example
 * // NFT minted 7 days ago but referenced after 2 days
 * calculateMarqueeWidth(createdAt, firstRefAt) // Width at 2 days (~200px)
 */
export function calculateMarqueeWidth(
  createdAt: number,
  firstReferenceAt: number | null,
  currentTime?: number
): number {
  return calculateTimeBasedGrowth(
    createdAt,
    firstReferenceAt,
    MARQUEE_CONFIG,
    currentTime
  )
}

/**
 * Configuration constants for marquee width calculation.
 * Exported for testing and debugging purposes.
 */
export const MARQUEE_WIDTH_CONFIG = {
  MIN_WIDTH,
  MAX_WIDTH,
  FULL_DEVELOPMENT_DAYS,
} as const
