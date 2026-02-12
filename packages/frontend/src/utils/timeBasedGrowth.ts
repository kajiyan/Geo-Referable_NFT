/**
 * Time-based logarithmic growth calculation utility.
 * Shared by smoke height (3D) and marquee width (2D) calculations.
 *
 * Growth formula: value = min + (max - min) * (1 - e^(-t/τ))
 * - 50% growth at ~1.6 days
 * - 95% growth at ~7 days
 */

/** Minimum valid timestamp (2020-01-01 00:00:00 UTC) */
export const MIN_VALID_TIMESTAMP = 1577836800

/**
 * Time constant in seconds.
 * τ = 604800 / 3 ≈ 201600 (~2.3 days)
 * This gives: 50% growth at ~1.6 days, 95% at ~7 days
 */
export const TIME_CONSTANT = 201600

/**
 * Validates timestamp is a reasonable Unix timestamp (after 2020)
 */
export function isValidTimestamp(ts: number): boolean {
  return Number.isFinite(ts) && ts >= MIN_VALID_TIMESTAMP
}

export interface GrowthConfig {
  minValue: number
  maxValue: number
  timeConstant?: number
  label: string // for warning messages
}

/**
 * Calculate time-based logarithmic growth value.
 *
 * @param createdAt - Unix timestamp (seconds) when entity was created
 * @param firstReferenceAt - Unix timestamp (seconds) of first reference, or null
 * @param config - Growth configuration (min, max, label)
 * @param currentTime - Current Unix timestamp (seconds), defaults to now
 * @returns Calculated value in configured range
 *
 * @example
 * // Calculate smoke height (50-500m range)
 * calculateTimeBasedGrowth(createdAt, null, { minValue: 50, maxValue: 500, label: 'smoke' })
 *
 * @example
 * // Calculate marquee width (100-300px range)
 * calculateTimeBasedGrowth(createdAt, firstRefAt, { minValue: 100, maxValue: 300, label: 'marquee' })
 */
export function calculateTimeBasedGrowth(
  createdAt: number,
  firstReferenceAt: number | null,
  config: GrowthConfig,
  currentTime: number = Math.floor(Date.now() / 1000)
): number {
  const { minValue, maxValue, timeConstant = TIME_CONSTANT, label } = config

  // Validate createdAt - invalid timestamps return minimum value
  if (!isValidTimestamp(createdAt)) {
    console.warn(`[${label}] Invalid createdAt, returning minValue`)
    return minValue
  }

  // Validate currentTime - invalid timestamps use current time
  let validCurrentTime = currentTime
  if (!isValidTimestamp(currentTime)) {
    validCurrentTime = Math.floor(Date.now() / 1000)
  }

  // Determine end time for growth calculation
  let endTime = validCurrentTime
  if (firstReferenceAt !== null) {
    // Only use firstReferenceAt if it's valid and >= createdAt
    if (isValidTimestamp(firstReferenceAt) && firstReferenceAt >= createdAt) {
      endTime = firstReferenceAt
    }
    // else: invalid firstReferenceAt, continue growing using currentTime
  }

  const elapsedSeconds = Math.max(0, endTime - createdAt)

  // Logarithmic growth curve: rapid initial rise, asymptotic approach to max
  const growthFactor = 1 - Math.exp(-elapsedSeconds / timeConstant)
  return minValue + (maxValue - minValue) * growthFactor
}

/**
 * Full development period in days.
 * At 7 days, growth reaches ~95% of maximum.
 */
export const FULL_DEVELOPMENT_DAYS = 7
