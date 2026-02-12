import { CACHE_CONFIG } from '@/config/cacheConstants'
import type { Token } from '@/types/index'
import type { MapViewport } from '@/lib/slices/nftMapSlice'
import { expandBounds } from './h3Utils'

interface CleanupResult {
  tokensToKeep: string[]
  tokensToEvict: string[]
  stats: {
    initialCount: number
    keptCount: number
    evictedCount: number
    memoryFreedMB: number
  }
}

/**
 * Check if a point is within viewport bounds
 */
function isInViewport(
  lat: number,
  lng: number,
  bounds: [number, number, number, number]
): boolean {
  const [west, south, east, north] = bounds
  return lng >= west && lng <= east && lat >= south && lat <= north
}

/**
 * Calculate priority score for token eviction (Hybrid Adaptive Algorithm v2.0)
 * Higher score = higher priority = keep longer
 *
 * Algorithm balances:
 * - Established tokens (generation, refCount) - preserve history
 * - New tokens (freshness, exploration bonus) - discover hidden gems
 * - User engagement (message, recency) - prioritize meaningful content
 */
export function calculateTokenPriority(
  token: Token,
  accessTimestamp: number,
  now: number
): number {
  const { PRIORITY_WEIGHTS, GENERATION_CAP, REF_COUNT_CAP, EXPLORATION_BONUS, EXPLORATION_BONUS_DAYS, FRESHNESS_HALF_LIFE_DAYS } = CACHE_CONFIG

  const generation = parseInt(token.generation) || 0
  const refCount = parseInt(token.refCount) || 0
  const hasMessage = token.message && token.message.length > 0
  const createdAt = parseInt(token.createdAt) || now

  // Time-based metrics
  const accessAgeMs = now - accessTimestamp
  const accessAgeDays = accessAgeMs / (1000 * 60 * 60 * 24)
  const tokenAgeMs = now - createdAt
  const tokenAgeDays = tokenAgeMs / (1000 * 60 * 60 * 24)

  // Apply caps to prevent over-privileging established tokens
  const cappedGeneration = Math.min(generation, GENERATION_CAP)
  const cappedRefCount = Math.min(refCount, REF_COUNT_CAP)

  // Core scores
  const generationScore = cappedGeneration * PRIORITY_WEIGHTS.GENERATION
  const refCountScore = cappedRefCount * PRIORITY_WEIGHTS.REF_COUNT
  const messageScore = hasMessage ? PRIORITY_WEIGHTS.HAS_MESSAGE : 0
  const recencyScore = PRIORITY_WEIGHTS.RECENCY * Math.exp(-accessAgeDays)

  // NEW: Freshness score (exponential decay with 30-day half-life)
  const freshnessScore = PRIORITY_WEIGHTS.FRESHNESS *
    Math.exp(-tokenAgeDays / FRESHNESS_HALF_LIFE_DAYS)

  // NEW: Exploration bonus for newly minted tokens (7-day window)
  const explorationBonus = tokenAgeDays < EXPLORATION_BONUS_DAYS
    ? EXPLORATION_BONUS
    : 0

  const totalScore =
    generationScore +
    refCountScore +
    messageScore +
    recencyScore +
    freshnessScore +
    explorationBonus

  // Development logging for new tokens with bonus
  if (process.env.NODE_ENV === 'development' && explorationBonus > 0) {
    console.log(
      `[Cache] New token bonus: ${token.id} ` +
      `(${tokenAgeDays.toFixed(1)}d old, score: ${totalScore.toFixed(2)}, ` +
      `G=${generation}, R=${refCount}, M=${hasMessage ? 'Y' : 'N'})`
    )
  }

  return totalScore
}

/**
 * Clean up tokens outside Cache Zone
 *
 * Algorithm:
 * 1. Keep all tokens in Cache Zone (Viewport × 2.5)
 * 2. Keep recently accessed tokens (< 60s, even outside Cache Zone)
 * 3. Force cleanup if exceeding 4000 tokens (keep top 3000 by priority)
 */
export function cleanupTokenCache(
  tokens: Record<string, Token>,
  tokenAccessTimestamps: Record<string, number>,
  viewport: MapViewport | null,
  _currentH3Cells: { r6: string[], r8: string[], r10: string[], r12: string[] }  // Unused in Phase 1, will be used in Phase 2
): CleanupResult {
  const now = Date.now()

  // Early return if no viewport
  if (!viewport) {
    return {
      tokensToKeep: Object.keys(tokens),
      tokensToEvict: [],
      stats: {
        initialCount: Object.keys(tokens).length,
        keptCount: Object.keys(tokens).length,
        evictedCount: 0,
        memoryFreedMB: 0,
      }
    }
  }

  // Calculate Cache Zone bounds (Viewport × 2.5)
  const cacheZoneBounds = expandBounds(
    viewport.bounds,
    CACHE_CONFIG.VIEWPORT_BUFFER_MULTIPLIER
  )

  // Categorize tokens
  const tokenEntries = Object.entries(tokens)
  const categorizedTokens: {
    id: string
    token: Token
    inCacheZone: boolean
    age: number
    priority: number
  }[] = tokenEntries.map(([id, token]) => {
    const lat = parseFloat(token.latitude)
    const lng = parseFloat(token.longitude)
    const inCacheZone = isInViewport(lat, lng, cacheZoneBounds)
    const timestamp = tokenAccessTimestamps[id] || now
    const age = now - timestamp
    const priority = calculateTokenPriority(token, timestamp, now)

    return { id, token, inCacheZone, age, priority }
  })

  // Step 1: Keep all tokens in Cache Zone
  let tokensToKeep = categorizedTokens.filter(t => t.inCacheZone)

  // Step 2: Keep recently accessed tokens (even outside Cache Zone)
  const recentTokensOutsideCacheZone = categorizedTokens.filter(
    t => !t.inCacheZone && t.age < CACHE_CONFIG.MIN_KEEP_TIME_MS
  )
  tokensToKeep.push(...recentTokensOutsideCacheZone)

  // Step 3: Force cleanup if exceeding threshold
  if (tokensToKeep.length > CACHE_CONFIG.FORCE_CLEANUP_THRESHOLD) {
    console.warn(
      `[cacheManager] Force cleanup triggered: ${tokensToKeep.length} > ${CACHE_CONFIG.FORCE_CLEANUP_THRESHOLD}`
    )
    // Sort by priority and keep only top MAX_CACHED_TOKENS
    tokensToKeep.sort((a, b) => b.priority - a.priority)
    tokensToKeep = tokensToKeep.slice(0, CACHE_CONFIG.MAX_CACHED_TOKENS)
  }

  // Identify tokens to evict
  const keptIds = new Set(tokensToKeep.map(t => t.id))
  const tokensToEvict = tokenEntries
    .filter(([id]) => !keptIds.has(id))
    .map(([id]) => id)

  const memoryFreedMB = (tokensToEvict.length * 1.8) / 1024

  return {
    tokensToKeep: tokensToKeep.map(t => t.id),
    tokensToEvict,
    stats: {
      initialCount: tokenEntries.length,
      keptCount: tokensToKeep.length,
      evictedCount: tokensToEvict.length,
      memoryFreedMB: parseFloat(memoryFreedMB.toFixed(2)),
    }
  }
}

/**
 * Estimate current memory usage
 */
export function estimateMemoryUsage(tokenCount: number): number {
  return parseFloat((tokenCount * 1.8 / 1024).toFixed(2))
}

/**
 * Check if memory is approaching critical threshold
 */
export function isMemoryCritical(tokenCount: number): boolean {
  const memoryMB = estimateMemoryUsage(tokenCount)
  return memoryMB >= CACHE_CONFIG.MEMORY_CRITICAL_THRESHOLD_MB
}

/**
 * Check if memory is approaching warning threshold
 */
export function isMemoryWarning(tokenCount: number): boolean {
  const memoryMB = estimateMemoryUsage(tokenCount)
  return memoryMB >= CACHE_CONFIG.MEMORY_WARNING_THRESHOLD_MB
}
