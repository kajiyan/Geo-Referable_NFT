import { cleanupTokenCache, estimateMemoryUsage, calculateTokenPriority } from '../cacheManager'
import type { Token } from '@/types/index'
import type { MapViewport } from '@/lib/slices/nftMapSlice'

describe('Cache Manager - Cleanup Logic', () => {
  const now = Date.now()
  const MS_PER_DAY = 1000 * 60 * 60 * 24

  // Helper to create test tokens
  const createToken = (id: string, lat: number, lng: number, overrides: Partial<Token> = {}): Token => ({
    id,
    tokenId: id,
    owner: { id: `owner-${id}`, address: `0x${id}` },
    latitude: lat.toString(),
    longitude: lng.toString(),
    elevation: '0',
    quadrant: 0,
    colorIndex: "0",
    treeId: '0',
    generation: '0',
    tree: {
      id: '0x00',
      treeId: '0',
      maxGeneration: '5'
    },
    treeIndex: '0',
    h3r6: `h3r6-${id}`,
    h3r8: `h3r8-${id}`,
    h3r10: `h3r10-${id}`,
    h3r12: `h3r12-${id}`,
    message: '',
    refCount: '0',
    totalDistance: '0',
    referringTo: [],
    referredBy: [],
    createdAt: now.toString(),
    blockNumber: '1',
    transactionHash: `0x${id}`,
    ...overrides,
  })

  // Helper to create viewport
  const createViewport = (center: [number, number], bounds: [number, number, number, number]): MapViewport => ({
    center,
    zoom: 10,
    bounds,
  })

  describe('cleanupTokenCache', () => {
    it('should keep tokens within Cache Zone', () => {
      // Viewport: 139.0-140.0 (lng), 35.0-36.0 (lat)
      // Cache Zone (×2.5): 138.625-140.375 (lng), 34.625-36.375 (lat)
      const viewport = createViewport(
        [35.5, 139.5],
        [139.0, 35.0, 140.0, 36.0]
      )

      const tokens: Record<string, Token> = {
        // Inside viewport
        '1': createToken('1', 35.5, 139.5),
        // Inside Cache Zone but outside viewport
        '2': createToken('2', 34.8, 138.8),
        // Outside Cache Zone
        '3': createToken('3', 34.0, 138.0),
        '4': createToken('4', 37.0, 141.0),
      }

      const tokenAccessTimestamps: Record<string, number> = {
        '1': now - 120000, // 2 minutes ago
        '2': now - 120000, // 2 minutes ago
        '3': now - 120000, // 2 minutes ago
        '4': now - 120000, // 2 minutes ago
      }

      const h3Cells = { r6: [], r8: [], r10: [], r12: [] }

      const result = cleanupTokenCache(tokens, tokenAccessTimestamps, viewport, h3Cells)

      // Tokens 1 and 2 should be kept (inside Cache Zone)
      expect(result.tokensToKeep).toContain('1')
      expect(result.tokensToKeep).toContain('2')
      expect(result.tokensToKeep).toHaveLength(2)

      // Tokens 3 and 4 should be evicted (outside Cache Zone)
      expect(result.tokensToEvict).toContain('3')
      expect(result.tokensToEvict).toContain('4')
      expect(result.tokensToEvict).toHaveLength(2)

      // Stats validation
      expect(result.stats.initialCount).toBe(4)
      expect(result.stats.keptCount).toBe(2)
      expect(result.stats.evictedCount).toBe(2)
      // Memory calculation: (2 tokens * 1.8KB) / 1024 = 0.00351, toFixed(2) = 0.00
      expect(result.stats.memoryFreedMB).toBe(0.00)
    })

    it('should keep recently accessed tokens', () => {
      // Viewport: 139.0-140.0 (lng), 35.0-36.0 (lat)
      const viewport = createViewport(
        [35.5, 139.5],
        [139.0, 35.0, 140.0, 36.0]
      )

      const tokens: Record<string, Token> = {
        // Inside Cache Zone
        '1': createToken('1', 35.5, 139.5),
        // Outside Cache Zone but recently accessed (<60s)
        '2': createToken('2', 34.0, 138.0),
        // Outside Cache Zone and not recently accessed (>60s)
        '3': createToken('3', 37.0, 141.0),
      }

      const tokenAccessTimestamps: Record<string, number> = {
        '1': now - 30000,  // 30s ago
        '2': now - 30000,  // 30s ago (should be kept despite being outside Cache Zone)
        '3': now - 120000, // 2 minutes ago (should be evicted)
      }

      const h3Cells = { r6: [], r8: [], r10: [], r12: [] }

      const result = cleanupTokenCache(tokens, tokenAccessTimestamps, viewport, h3Cells)

      // Tokens 1 and 2 should be kept
      expect(result.tokensToKeep).toContain('1') // Inside Cache Zone
      expect(result.tokensToKeep).toContain('2') // Recently accessed
      expect(result.tokensToKeep).toHaveLength(2)

      // Token 3 should be evicted
      expect(result.tokensToEvict).toContain('3')
      expect(result.tokensToEvict).toHaveLength(1)
    })

    it('should force cleanup when exceeding threshold', () => {
      // Create 4500 tokens (exceeds 4000 threshold)
      const viewport = createViewport(
        [35.5, 139.5],
        [139.0, 35.0, 140.0, 36.0]
      )

      const tokens: Record<string, Token> = {}
      const tokenAccessTimestamps: Record<string, number> = {}

      // Create tokens with varying priorities
      for (let i = 0; i < 4500; i++) {
        const id = `token-${i}`
        const isHighPriority = i < 1000 // First 1000 tokens have high priority

        tokens[id] = createToken(id, 35.5, 139.5, {
          generation: isHighPriority ? '5' : '0',
          refCount: isHighPriority ? '8' : '0',
          message: isHighPriority ? 'Important location' : '',
          createdAt: isHighPriority ? (now - 30 * MS_PER_DAY).toString() : (now - 60 * MS_PER_DAY).toString(),
        })
        tokenAccessTimestamps[id] = now - 120000 // All accessed 2 minutes ago
      }

      const h3Cells = { r6: [], r8: [], r10: [], r12: [] }

      const result = cleanupTokenCache(tokens, tokenAccessTimestamps, viewport, h3Cells)

      // Should force cleanup to 3000 tokens
      expect(result.tokensToKeep.length).toBe(3000)
      expect(result.tokensToEvict.length).toBe(1500)

      // Verify high-priority tokens are kept
      const keptHighPriorityCount = result.tokensToKeep.filter(id => {
        const tokenIndex = parseInt(id.split('-')[1])
        return tokenIndex < 1000
      }).length

      // Most high-priority tokens should be kept
      expect(keptHighPriorityCount).toBeGreaterThan(950)

      // Stats validation
      expect(result.stats.initialCount).toBe(4500)
      expect(result.stats.keptCount).toBe(3000)
      expect(result.stats.evictedCount).toBe(1500)
      expect(result.stats.memoryFreedMB).toBeCloseTo(2.64, 2) // 1500 * 1.8 / 1024
    })

    it('should handle edge case: zoom out with 5000 tokens in viewport', () => {
      // User zooms out, revealing 5000 tokens at once
      // All are in viewport, but we need to reduce to 3000
      const viewport = createViewport(
        [35.5, 139.5],
        [138.0, 34.0, 141.0, 37.0] // Very large viewport
      )

      const tokens: Record<string, Token> = {}
      const tokenAccessTimestamps: Record<string, number> = {}

      // Create 5000 tokens, all in viewport
      for (let i = 0; i < 5000; i++) {
        const id = `token-${i}`
        const lat = 34.0 + (Math.random() * 3.0) // Spread across viewport
        const lng = 138.0 + (Math.random() * 3.0)

        // Create diversity in token characteristics
        const generation = Math.floor(Math.random() * 10)
        const refCount = Math.floor(Math.random() * 15)
        const hasMessage = Math.random() > 0.5
        const tokenAge = Math.random() * 90 * MS_PER_DAY

        tokens[id] = createToken(id, lat, lng, {
          generation: generation.toString(),
          refCount: refCount.toString(),
          message: hasMessage ? 'Location note' : '',
          createdAt: (now - tokenAge).toString(),
        })
        tokenAccessTimestamps[id] = now - 30000 // All recently accessed
      }

      const h3Cells = { r6: [], r8: [], r10: [], r12: [] }

      const result = cleanupTokenCache(tokens, tokenAccessTimestamps, viewport, h3Cells)

      // All tokens are in Cache Zone AND recently accessed
      // This will trigger force cleanup at >4000 tokens
      expect(result.tokensToKeep.length).toBe(3000)
      expect(result.tokensToEvict.length).toBe(2000)

      // Verify that kept tokens have higher average priority
      const keptPriorities = result.tokensToKeep.map(id => {
        const token = tokens[id]
        const timestamp = tokenAccessTimestamps[id]
        return calculateTokenPriority(token, timestamp, now)
      })

      const evictedPriorities = result.tokensToEvict.map(id => {
        const token = tokens[id]
        const timestamp = tokenAccessTimestamps[id]
        return calculateTokenPriority(token, timestamp, now)
      })

      const avgKeptPriority = keptPriorities.reduce((a, b) => a + b, 0) / keptPriorities.length
      const avgEvictedPriority = evictedPriorities.reduce((a, b) => a + b, 0) / evictedPriorities.length

      // Kept tokens should have significantly higher average priority
      expect(avgKeptPriority).toBeGreaterThan(avgEvictedPriority)

      // Stats validation
      expect(result.stats.initialCount).toBe(5000)
      expect(result.stats.keptCount).toBe(3000)
      expect(result.stats.evictedCount).toBe(2000)
    })

    it('should return all tokens when viewport is null', () => {
      const tokens: Record<string, Token> = {
        '1': createToken('1', 35.5, 139.5),
        '2': createToken('2', 34.0, 138.0),
        '3': createToken('3', 37.0, 141.0),
      }

      const tokenAccessTimestamps: Record<string, number> = {
        '1': now,
        '2': now,
        '3': now,
      }

      const h3Cells = { r6: [], r8: [], r10: [], r12: [] }

      const result = cleanupTokenCache(tokens, tokenAccessTimestamps, null, h3Cells)

      // All tokens should be kept
      expect(result.tokensToKeep).toHaveLength(3)
      expect(result.tokensToEvict).toHaveLength(0)
      expect(result.stats.evictedCount).toBe(0)
      expect(result.stats.memoryFreedMB).toBe(0)
    })
  })

  describe('estimateMemoryUsage', () => {
    it('should calculate memory correctly', () => {
      // Formula: (tokenCount * 1.8) / 1024 MB
      expect(estimateMemoryUsage(1000)).toBe(1.76)
      expect(estimateMemoryUsage(3000)).toBe(5.27)
      expect(estimateMemoryUsage(5000)).toBe(8.79)
    })

    it('should return 0 for 0 tokens', () => {
      expect(estimateMemoryUsage(0)).toBe(0)
    })

    it('should handle fractional values correctly', () => {
      const result = estimateMemoryUsage(1500)
      expect(result).toBeCloseTo(2.64, 2)
    })
  })
})
