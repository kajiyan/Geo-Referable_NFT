/**
 * Smoke height calculation based on mint time and reference timestamp.
 *
 * - Full development: 7 days (if no references)
 * - Growth stops at first reference timestamp
 *
 * Uses logarithmic growth: h = 50 + 450 * (1 - e^(-t/τ))
 */

import {
  calculateTimeBasedGrowth,
  GrowthConfig,
  FULL_DEVELOPMENT_DAYS,
} from './timeBasedGrowth'

/** Minimum height for newly minted NFTs (meters) */
const MIN_HEIGHT = 50

/** Maximum height for fully developed smoke (meters) */
const MAX_HEIGHT = 500

const SMOKE_CONFIG: GrowthConfig = {
  minValue: MIN_HEIGHT,
  maxValue: MAX_HEIGHT,
  label: 'calculateSmokeHeight',
}

/**
 * Calculate smoke height based on mint time and first reference time.
 *
 * @param createdAt - Unix timestamp (seconds) when NFT was minted
 * @param firstReferenceAt - Unix timestamp (seconds) of first reference, or null if none
 * @param currentTime - Current Unix timestamp (seconds), defaults to now
 * @returns Height in meters (50-500m range)
 *
 * @example
 * // NFT minted 3 days ago with no references
 * calculateSmokeHeight(createdAt, null) // ~380m
 *
 * @example
 * // NFT minted 7 days ago but referenced after 80 hours
 * calculateSmokeHeight(createdAt, firstRefAt) // Height at 80 hours (~210m)
 */
export function calculateSmokeHeight(
  createdAt: number,
  firstReferenceAt: number | null,
  currentTime?: number
): number {
  return calculateTimeBasedGrowth(
    createdAt,
    firstReferenceAt,
    SMOKE_CONFIG,
    currentTime
  )
}

/**
 * Configuration constants for smoke height calculation.
 * Exported for testing and debugging purposes.
 */
export const SMOKE_HEIGHT_CONFIG = {
  MIN_HEIGHT,
  MAX_HEIGHT,
  FULL_DEVELOPMENT_DAYS,
} as const
