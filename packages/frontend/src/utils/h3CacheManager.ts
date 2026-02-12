import type { Token } from '@/types/index'
import { CACHE_CONFIG } from '@/config/cacheConstants'

/**
 * Clean up tokens based on H3 cell overlap
 * More precise than geographic bounds
 *
 * Tokens are kept if:
 * 1. They were accessed recently (within MIN_KEEP_TIME_MS) - protects during flyTo animation
 * 2. Their H3 cells overlap with current viewport cells
 */
export function cleanupTokenCacheByH3Cells(
  tokens: Record<string, Token>,
  tokenH3Cells: Record<string, { r6: string, r8: string, r10: string, r12: string }>,
  currentH3Cells: { r6: string[], r8: string[], r10: string[], r12: string[] },
  tokenAccessTimestamps: Record<string, number>,
  _overlapThreshold: number = CACHE_CONFIG.H3_OVERLAP_THRESHOLD
): { tokensToKeep: string[], tokensToEvict: string[] } {
  const now = Date.now()

  // Create sets for fast lookup
  const cellSets = {
    r6: new Set(currentH3Cells.r6),
    r8: new Set(currentH3Cells.r8),
    r10: new Set(currentH3Cells.r10),
    r12: new Set(currentH3Cells.r12),
  }

  const tokensToKeep: string[] = []
  const tokensToEvict: string[] = []

  // Tracking for enhanced logging
  let keptByRecency = 0
  let keptByH3Overlap = 0

  Object.entries(tokens).forEach(([id, _token]) => {
    const cells = tokenH3Cells[id]

    if (!cells) {
      // No H3 cell info - evict
      tokensToEvict.push(id)
      return
    }

    // Check if token was accessed recently (within MIN_KEEP_TIME_MS)
    // This protects newly fetched tokens during flyTo animation
    const lastAccess = tokenAccessTimestamps[id] || 0
    const timeSinceAccess = now - lastAccess
    if (timeSinceAccess < CACHE_CONFIG.MIN_KEEP_TIME_MS) {
      tokensToKeep.push(id)
      keptByRecency++
      return // Skip H3 overlap check for recently accessed tokens
    }

    // Check if token's H3 cells overlap with current viewport cells
    const hasOverlap =
      cellSets.r6.has(cells.r6) ||
      cellSets.r8.has(cells.r8) ||
      cellSets.r10.has(cells.r10) ||
      cellSets.r12.has(cells.r12)

    if (hasOverlap) {
      tokensToKeep.push(id)
      keptByH3Overlap++
    } else {
      tokensToEvict.push(id)
    }
  })

  // Enhanced logging with breakdown
  console.log('[h3CacheManager] H3-based cleanup:', {
    totalTokens: Object.keys(tokens).length,
    tokensToKeep: tokensToKeep.length,
    tokensToEvict: tokensToEvict.length,
    keptByRecency,
    keptByH3Overlap,
  })

  return { tokensToKeep, tokensToEvict }
}

/**
 * Calculate H3 cell overlap ratio
 */
export function calculateH3Overlap(
  cells1: { r6: string[], r8: string[], r10: string[], r12: string[] },
  cells2: { r6: string[], r8: string[], r10: string[], r12: string[] }
): number {
  const calculateSetOverlap = (arr1: string[], arr2: string[]): number => {
    const set1 = new Set(arr1)
    const set2 = new Set(arr2)
    const intersection = new Set([...set1].filter(x => set2.has(x)))
    const union = new Set([...set1, ...set2])

    return union.size > 0 ? intersection.size / union.size : 0
  }

  const overlapR6 = calculateSetOverlap(cells1.r6, cells2.r6)
  const overlapR8 = calculateSetOverlap(cells1.r8, cells2.r8)
  const overlapR10 = calculateSetOverlap(cells1.r10, cells2.r10)
  const overlapR12 = calculateSetOverlap(cells1.r12, cells2.r12)

  // Average overlap across all resolutions
  return (overlapR6 + overlapR8 + overlapR10 + overlapR12) / 4
}
