/**
 * Bidirectional Norosi (smoke signal) observation algorithm.
 *
 * Based on the Venn diagram model:
 *   isObservable = distance ≤ r_observer + r_smoke
 *
 * r_observer: Observer visibility range (weather + day/night)
 *   - Daytime: Koschmieder's Law (1924) — V = 3.0/β
 *   - Nighttime: Allard's Law — fire visibility differs from smoke
 *
 * r_smoke: Smoke reach (token attributes)
 *   = BASE_SMOKE_REACH × heightFactor × signalQuality × elevationBonus × activityDecay
 *
 * Academic references:
 *   - Koschmieder (1924), Middleton (1947) "Visibility in Meteorology"
 *   - Allard's Law — Biral (2012) "Introduction to atmospheric visibility estimation"
 *   - Briggs (1969, 1975) plume rise formula
 *   - Lee & Shang (2016) J. Atmos. Sci. — detectability vs identifiability
 *
 * Historical references:
 *   - 軍防令 (烽の道 p.215): 40里 ≈ 20km interval
 *   - 飛山城跡実験 1996 (烽の道 p.351): ~5km visibility in overcast
 *   - 蓬火品約 (情報と通信の文化史 p.617): rain prevents signal
 *   - 居延遺跡 (情報と通信の文化史 p.607,611): 3km intervals, 18m watchtowers
 *
 * All functions are pure (no side effects) for testability.
 */

import {
  WEATHER_VISIBILITY_CONFIG,
  DEFAULT_VISIBILITY,
  isValidWeatherColorIndex,
  type WeatherColorIndex,
} from '@/config/gpsConfig'
import { TIME_CONSTANT, isValidTimestamp } from './timeBasedGrowth'

// ─── Constants ───────────────────────────────────────────────────────────────

/** Base smoke reach in meters (overcast conditions, moderate smoke) */
const BASE_SMOKE_REACH = 5000

/** Height factor range: mint-fresh (0.3) → fully developed 7 days (1.5) */
const MIN_HEIGHT_FACTOR = 0.3
const MAX_HEIGHT_FACTOR = 1.5

/** Minimum activity decay (after ≥3 relays) */
const ACTIVITY_DECAY_MIN = 0.6
/** Decay per relay */
const ACTIVITY_DECAY_STEP = 0.15

/** Maximum elevation for bonus calculation (meters) */
const ELEVATION_CAP = 500
/** Elevation bonus scale: 500m → 1.25× */
const ELEVATION_SCALE = 0.5 / 1000

/** Smoke reach range for normalization (derived from extreme scenarios) */
const MIN_SMOKE_REACH = 450 // worst case: 5000×0.3×0.5×1.0×0.6
const MAX_SMOKE_REACH = 12188 // theoretical max: 5000×1.5×1.3×1.25×1.0

/** Marquee width range (pixels) */
const MIN_MARQUEE_WIDTH = 100
const MAX_MARQUEE_WIDTH = 360

/** Smoke 3D height range (meters) */
const MIN_SMOKE_HEIGHT = 50
const MAX_SMOKE_HEIGHT = 500

/** Night time hours (simplified: fixed 18:00-06:00) */
const NIGHT_START_HOUR = 18
const NIGHT_END_HOUR = 6

// ─── Signal quality table (mint-time weather → smoke quality) ────────────────

/**
 * Mint-time weather determines smoke signal quality.
 * Clear weather = dry materials = dense, visible smoke.
 * Rain = wet materials = weak, dispersed smoke.
 *
 * Historical basis: 蓬火品約 — "rain prevents raising beacon fires"
 */
const SIGNAL_QUALITY: Record<WeatherColorIndex, number> = {
  0: 1.3, // Clear: dry fuel, dense black smoke
  1: 1.2, // Partly cloudy
  2: 1.1, // Cloudy
  3: 1.0, // Overcast (baseline)
  4: 0.85, // Light drizzle
  5: 0.8, // Light rain
  6: 0.65, // Moderate rain
  7: 0.6, // Rain
  8: 0.5, // Heavy rain: "cannot raise beacon"
  9: 0.5, // Thunder rain
  10: 0.5, // Heavy thunder
  11: 0.7, // Snow: cold but dry
  12: 0.5, // Fog: high moisture
}

// ─── Night multiplier table (observer weather → nighttime visibility modifier) ─

/**
 * Nighttime visibility multiplier based on Allard's Law.
 * Clear night: fire stands out against dark sky → extended range.
 * Foggy/rainy night: scattering obscures fire → reduced range.
 *
 * Historical basis: Troy→Mycenae 555km night relay (Aeschylus, Oresteia)
 */
const NIGHT_MULTIPLIER: Record<WeatherColorIndex, number> = {
  0: 1.5, // Clear: fire dominates dark background
  1: 1.3, // Partly cloudy
  2: 1.1, // Cloudy
  3: 1.0, // Overcast: no day/night difference
  4: 0.9, // Light drizzle
  5: 0.85, // Light rain
  6: 0.7, // Moderate rain
  7: 0.6, // Rain
  8: 0.5, // Heavy rain
  9: 0.5, // Thunder rain
  10: 0.5, // Heavy thunder
  11: 0.4, // Snow: high scattering
  12: 0.3, // Fog: maximum scattering
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SmokeReachInput {
  createdAt: number // Unix timestamp (seconds)
  firstReferenceAt: number | null // null if unreferenced
  mintColorIndex: number // 0-12 (weather at mint time)
  elevation: number // meters above sea level
  refCount: number // number of times relayed
}

// ─── Individual factor functions ─────────────────────────────────────────────

/**
 * Height factor from elapsed time (Briggs plume rise approximation).
 * Uses logarithmic growth matching existing timeBasedGrowth.ts TIME_CONSTANT.
 *
 * Range: 0.3 (just minted) → 1.5 (7+ days, fully developed)
 * Growth stops at firstReferenceAt if set.
 */
export function calculateHeightFactor(
  createdAt: number,
  firstReferenceAt: number | null,
  now: number = Math.floor(Date.now() / 1000)
): number {
  if (!isValidTimestamp(createdAt)) return MIN_HEIGHT_FACTOR

  let endTime = now
  if (
    firstReferenceAt !== null &&
    isValidTimestamp(firstReferenceAt) &&
    firstReferenceAt >= createdAt
  ) {
    endTime = firstReferenceAt
  }

  const elapsed = Math.max(0, endTime - createdAt)
  const growth = 1 - Math.exp(-elapsed / TIME_CONSTANT)
  return MIN_HEIGHT_FACTOR + (MAX_HEIGHT_FACTOR - MIN_HEIGHT_FACTOR) * growth
}

/**
 * Signal quality from mint-time weather.
 * Returns baseline 1.0 for invalid indices.
 */
export function getSignalQuality(mintColorIndex: number): number {
  if (isValidWeatherColorIndex(mintColorIndex)) {
    return SIGNAL_QUALITY[mintColorIndex]
  }
  return 1.0
}

/**
 * Elevation bonus from geometric horizon extension.
 * Higher smoke source → visible over greater distance.
 *
 * Range: 1.0 (sea level) → 1.25 (500m+)
 * Based on: d = √(2Rh), capped for atmospheric limits.
 */
export function getElevationBonus(elevationM: number): number {
  const clamped = Math.min(Math.max(0, elevationM), ELEVATION_CAP)
  return 1.0 + clamped * ELEVATION_SCALE
}

/**
 * Activity decay from relay count.
 * Relayed tokens have diminished smoke (fuel consumed).
 *
 * Range: 1.0 (fresh) → 0.6 (3+ relays)
 */
export function getActivityDecay(refCount: number): number {
  const count = Math.max(0, Math.floor(refCount))
  return Math.max(ACTIVITY_DECAY_MIN, 1.0 - count * ACTIVITY_DECAY_STEP)
}

/**
 * Night multiplier for observer visibility (Allard's Law).
 * Returns 1.0 for invalid indices or daytime.
 */
export function getNightMultiplier(colorIndex: number): number {
  if (isValidWeatherColorIndex(colorIndex)) {
    return NIGHT_MULTIPLIER[colorIndex]
  }
  return 1.0
}

/**
 * Simple day/night determination.
 * Uses local hour: night = 18:00-06:00.
 */
export function isNightTime(now: number = Math.floor(Date.now() / 1000)): boolean {
  const hour = new Date(now * 1000).getHours()
  return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR
}

// ─── Composite functions ─────────────────────────────────────────────────────

/**
 * Calculate smoke reach (r_smoke) in meters.
 *
 * r_smoke = BASE_SMOKE_REACH × heightFactor × signalQuality × elevationBonus × activityDecay
 *
 * Range: ~450m (worst) → ~12,188m (best)
 */
export function calculateSmokeReach(
  input: SmokeReachInput,
  now: number = Math.floor(Date.now() / 1000)
): number {
  const heightFactor = calculateHeightFactor(input.createdAt, input.firstReferenceAt, now)
  const signalQuality = getSignalQuality(input.mintColorIndex)
  const elevationBonus = getElevationBonus(input.elevation)
  const activityDecay = getActivityDecay(input.refCount)

  return BASE_SMOKE_REACH * heightFactor * signalQuality * elevationBonus * activityDecay
}

/**
 * Calculate observer visibility (r_observer) in meters.
 * Daytime: uses WEATHER_VISIBILITY_CONFIG directly (Koschmieder).
 * Nighttime: applies Allard's Law multiplier.
 */
export function calculateObserverVisibility(
  colorIndex: number | null,
  now: number = Math.floor(Date.now() / 1000)
): number {
  const baseVisibility = isValidWeatherColorIndex(colorIndex)
    ? WEATHER_VISIBILITY_CONFIG[colorIndex]
    : DEFAULT_VISIBILITY

  if (isNightTime(now)) {
    const multiplier = colorIndex !== null ? getNightMultiplier(colorIndex) : 1.0
    return baseVisibility * multiplier
  }

  return baseVisibility
}

/**
 * Final observation check (Venn diagram model).
 * Observable when observer circle and smoke circle overlap.
 */
export function isObservable(
  distance: number,
  observerRange: number,
  smokeReach: number
): boolean {
  return distance <= observerRange + smokeReach
}

// ─── Conversion functions (smokeReach → visual properties) ───────────────────

/** Clamp value to [0, 1] */
function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

/** Normalize smokeReach to [0, 1] within expected range */
function normalizeSmokeReach(smokeReach: number): number {
  return clamp01((smokeReach - MIN_SMOKE_REACH) / (MAX_SMOKE_REACH - MIN_SMOKE_REACH))
}

/**
 * Convert smokeReach → 3D smoke height (50-500m).
 * Used by NFTObject/Norosi for AR rendering.
 */
export function smokeReachToHeight(smokeReach: number): number {
  const n = normalizeSmokeReach(smokeReach)
  return MIN_SMOKE_HEIGHT + (MAX_SMOKE_HEIGHT - MIN_SMOKE_HEIGHT) * n
}

/**
 * Convert smokeReach → MapMarquee width (100-360px).
 * Used by NFTMarkers for 2D map rendering.
 */
export function smokeReachToMarqueeWidth(smokeReach: number): number {
  const n = normalizeSmokeReach(smokeReach)
  return MIN_MARQUEE_WIDTH + (MAX_MARQUEE_WIDTH - MIN_MARQUEE_WIDTH) * n
}

// ─── Adapter helpers ────────────────────────────────────────────────────────

/**
 * Build SmokeReachInput from a ProcessedToken.
 * Centralizes the field mapping to avoid divergent construction across consumers.
 */
export function processedTokenToSmokeReachInput(token: {
  createdAtTimestamp: number
  firstReferenceAt: number | null
  numericColorIndex: number
  numericElevation: number
  refCount?: string
}): SmokeReachInput {
  return {
    createdAt: token.createdAtTimestamp,
    firstReferenceAt: token.firstReferenceAt,
    mintColorIndex: token.numericColorIndex,
    elevation: token.numericElevation,
    refCount: parseInt(token.refCount || '0', 10),
  }
}

// ─── Exported constants for config/testing ───────────────────────────────────

export const NOROSI_OBSERVATION_CONFIG = {
  BASE_SMOKE_REACH,
  MIN_HEIGHT_FACTOR,
  MAX_HEIGHT_FACTOR,
  ACTIVITY_DECAY_MIN,
  ACTIVITY_DECAY_STEP,
  ELEVATION_CAP,
  MIN_SMOKE_REACH,
  MAX_SMOKE_REACH,
  MIN_MARQUEE_WIDTH,
  MAX_MARQUEE_WIDTH,
  MIN_SMOKE_HEIGHT,
  MAX_SMOKE_HEIGHT,
  NIGHT_START_HOUR,
  NIGHT_END_HOUR,
} as const
