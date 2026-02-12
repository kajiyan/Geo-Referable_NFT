import { cleanupTokenCacheByH3Cells, calculateH3Overlap } from '../h3CacheManager'
import type { Token } from '@/types/index'

// Helper to create test tokens
const createToken = (id: string, h3r6: string, h3r8: string, h3r10: string, h3r12: string): Token => ({
  id,
  tokenId: id,
  owner: { id: `owner-${id}`, address: `0x${id}` },
  latitude: '35678900',
  longitude: '139766100',
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
  h3r6,
  h3r8,
  h3r10,
  h3r12,
  message: '',
  refCount: '0',
  totalDistance: '0',
  referringTo: [],
  referredBy: [],
  createdAt: Date.now().toString(),
  blockNumber: '1',
  transactionHash: '0x1',
})

describe('H3 Cache Manager', () => {
  describe('cleanupTokenCacheByH3Cells', () => {
    it('should keep tokens with matching H3r6 cells', () => {
      const tokens = {
        '1': createToken('1', 'h3r6-A', 'h3r8-X', 'h3r10-X', 'h3r12-X'),
        '2': createToken('2', 'h3r6-B', 'h3r8-Y', 'h3r10-Y', 'h3r12-Y'),
        '3': createToken('3', 'h3r6-C', 'h3r8-Z', 'h3r10-Z', 'h3r12-Z'),
      }

      const tokenH3Cells = {
        '1': { r6: 'h3r6-A', r8: 'h3r8-X', r10: 'h3r10-X', r12: 'h3r12-X' },
        '2': { r6: 'h3r6-B', r8: 'h3r8-Y', r10: 'h3r10-Y', r12: 'h3r12-Y' },
        '3': { r6: 'h3r6-C', r8: 'h3r8-Z', r10: 'h3r10-Z', r12: 'h3r12-Z' },
      }

      const currentH3Cells = {
        r6: ['h3r6-A', 'h3r6-B'],
        r8: [],
        r10: [],
        r12: [],
      }

      const result = cleanupTokenCacheByH3Cells(tokens, tokenH3Cells, currentH3Cells, {})

      expect(result.tokensToKeep).toHaveLength(2)
      expect(result.tokensToKeep).toContain('1')
      expect(result.tokensToKeep).toContain('2')
      expect(result.tokensToEvict).toHaveLength(1)
      expect(result.tokensToEvict).toContain('3')
    })

    it('should keep tokens with matching H3r8 cells', () => {
      const tokens = {
        '1': createToken('1', 'h3r6-X', 'h3r8-A', 'h3r10-X', 'h3r12-X'),
        '2': createToken('2', 'h3r6-Y', 'h3r8-B', 'h3r10-Y', 'h3r12-Y'),
        '3': createToken('3', 'h3r6-Z', 'h3r8-C', 'h3r10-Z', 'h3r12-Z'),
      }

      const tokenH3Cells = {
        '1': { r6: 'h3r6-X', r8: 'h3r8-A', r10: 'h3r10-X', r12: 'h3r12-X' },
        '2': { r6: 'h3r6-Y', r8: 'h3r8-B', r10: 'h3r10-Y', r12: 'h3r12-Y' },
        '3': { r6: 'h3r6-Z', r8: 'h3r8-C', r10: 'h3r10-Z', r12: 'h3r12-Z' },
      }

      const currentH3Cells = {
        r6: [],
        r8: ['h3r8-A'],
        r10: [],
        r12: [],
      }

      const result = cleanupTokenCacheByH3Cells(tokens, tokenH3Cells, currentH3Cells, {})

      expect(result.tokensToKeep).toHaveLength(1)
      expect(result.tokensToKeep).toContain('1')
      expect(result.tokensToEvict).toHaveLength(2)
    })

    it('should keep tokens with matching any H3 resolution', () => {
      const tokens = {
        '1': createToken('1', 'h3r6-A', 'h3r8-X', 'h3r10-X', 'h3r12-X'),
        '2': createToken('2', 'h3r6-Y', 'h3r8-B', 'h3r10-Y', 'h3r12-Y'),
        '3': createToken('3', 'h3r6-Z', 'h3r8-Z', 'h3r10-C', 'h3r12-Z'),
      }

      const tokenH3Cells = {
        '1': { r6: 'h3r6-A', r8: 'h3r8-X', r10: 'h3r10-X', r12: 'h3r12-X' },
        '2': { r6: 'h3r6-Y', r8: 'h3r8-B', r10: 'h3r10-Y', r12: 'h3r12-Y' },
        '3': { r6: 'h3r6-Z', r8: 'h3r8-Z', r10: 'h3r10-C', r12: 'h3r12-Z' },
      }

      const currentH3Cells = {
        r6: ['h3r6-A'], // Matches token 1
        r8: ['h3r8-B'], // Matches token 2
        r10: ['h3r10-C'], // Matches token 3
        r12: [],
      }

      const result = cleanupTokenCacheByH3Cells(tokens, tokenH3Cells, currentH3Cells, {})

      expect(result.tokensToKeep).toHaveLength(3)
      expect(result.tokensToEvict).toHaveLength(0)
    })

    it('should evict tokens without H3 cell info', () => {
      const tokens = {
        '1': createToken('1', 'h3r6-A', 'h3r8-A', 'h3r10-A', 'h3r12-A'),
        '2': createToken('2', 'h3r6-B', 'h3r8-B', 'h3r10-B', 'h3r12-B'),
      }

      const tokenH3Cells = {
        '1': { r6: 'h3r6-A', r8: 'h3r8-A', r10: 'h3r10-A', r12: 'h3r12-A' },
        // Token 2 has no H3 cell info
      }

      const currentH3Cells = {
        r6: ['h3r6-A'],
        r8: [],
        r10: [],
        r12: [],
      }

      const result = cleanupTokenCacheByH3Cells(tokens, tokenH3Cells, currentH3Cells, {})

      expect(result.tokensToKeep).toHaveLength(1)
      expect(result.tokensToKeep).toContain('1')
      expect(result.tokensToEvict).toHaveLength(1)
      expect(result.tokensToEvict).toContain('2')
    })

    it('should handle empty current H3 cells', () => {
      const tokens = {
        '1': createToken('1', 'h3r6-A', 'h3r8-A', 'h3r10-A', 'h3r12-A'),
      }

      const tokenH3Cells = {
        '1': { r6: 'h3r6-A', r8: 'h3r8-A', r10: 'h3r10-A', r12: 'h3r12-A' },
      }

      const currentH3Cells = {
        r6: [],
        r8: [],
        r10: [],
        r12: [],
      }

      const result = cleanupTokenCacheByH3Cells(tokens, tokenH3Cells, currentH3Cells, {})

      expect(result.tokensToKeep).toHaveLength(0)
      expect(result.tokensToEvict).toHaveLength(1)
    })

    it('should keep recently accessed tokens regardless of H3 overlap', () => {
      const tokens = {
        '1': createToken('1', 'h3r6-A', 'h3r8-A', 'h3r10-A', 'h3r12-A'),
        '2': createToken('2', 'h3r6-B', 'h3r8-B', 'h3r10-B', 'h3r12-B'),
      }

      const tokenH3Cells = {
        '1': { r6: 'h3r6-A', r8: 'h3r8-A', r10: 'h3r10-A', r12: 'h3r12-A' },
        '2': { r6: 'h3r6-B', r8: 'h3r8-B', r10: 'h3r10-B', r12: 'h3r12-B' },
      }

      // No H3 cells overlap
      const currentH3Cells = {
        r6: ['h3r6-X'],
        r8: [],
        r10: [],
        r12: [],
      }

      // Token 1 was accessed recently (within MIN_KEEP_TIME_MS)
      const now = Date.now()
      const tokenAccessTimestamps = {
        '1': now - 10000, // 10 seconds ago (recent)
        '2': now - 120000, // 2 minutes ago (old)
      }

      const result = cleanupTokenCacheByH3Cells(tokens, tokenH3Cells, currentH3Cells, tokenAccessTimestamps)

      // Token 1 should be kept due to recency
      // Token 2 should be evicted (no H3 overlap and not recently accessed)
      expect(result.tokensToKeep).toHaveLength(1)
      expect(result.tokensToKeep).toContain('1')
      expect(result.tokensToEvict).toHaveLength(1)
      expect(result.tokensToEvict).toContain('2')
    })
  })

  describe('calculateH3Overlap', () => {
    it('should return 1.0 for identical H3 cells', () => {
      const cells1 = {
        r6: ['h3r6-A', 'h3r6-B'],
        r8: ['h3r8-A', 'h3r8-B'],
        r10: ['h3r10-A', 'h3r10-B'],
        r12: ['h3r12-A', 'h3r12-B'],
      }

      const cells2 = {
        r6: ['h3r6-A', 'h3r6-B'],
        r8: ['h3r8-A', 'h3r8-B'],
        r10: ['h3r10-A', 'h3r10-B'],
        r12: ['h3r12-A', 'h3r12-B'],
      }

      const overlap = calculateH3Overlap(cells1, cells2)
      expect(overlap).toBe(1.0)
    })

    it('should return 0.0 for completely different H3 cells', () => {
      const cells1 = {
        r6: ['h3r6-A'],
        r8: ['h3r8-A'],
        r10: ['h3r10-A'],
        r12: ['h3r12-A'],
      }

      const cells2 = {
        r6: ['h3r6-B'],
        r8: ['h3r8-B'],
        r10: ['h3r10-B'],
        r12: ['h3r12-B'],
      }

      const overlap = calculateH3Overlap(cells1, cells2)
      expect(overlap).toBe(0.0)
    })

    it('should return 0.5 for 50% overlap', () => {
      const cells1 = {
        r6: ['h3r6-A', 'h3r6-B'],
        r8: ['h3r8-A', 'h3r8-B'],
        r10: ['h3r10-A', 'h3r10-B'],
        r12: ['h3r12-A', 'h3r12-B'],
      }

      const cells2 = {
        r6: ['h3r6-A', 'h3r6-C'], // 50% overlap
        r8: ['h3r8-A', 'h3r8-C'], // 50% overlap
        r10: ['h3r10-A', 'h3r10-C'], // 50% overlap
        r12: ['h3r12-A', 'h3r12-C'], // 50% overlap
      }

      const overlap = calculateH3Overlap(cells1, cells2)
      expect(overlap).toBe(0.5)
    })

    it('should handle empty arrays', () => {
      const cells1 = {
        r6: [],
        r8: [],
        r10: [],
        r12: [],
      }

      const cells2 = {
        r6: ['h3r6-A'],
        r8: ['h3r8-A'],
        r10: ['h3r10-A'],
        r12: ['h3r12-A'],
      }

      const overlap = calculateH3Overlap(cells1, cells2)
      expect(overlap).toBe(0.0)
    })

    it('should average overlap across all resolutions', () => {
      const cells1 = {
        r6: ['h3r6-A'], // No overlap
        r8: ['h3r8-A'], // Full overlap
        r10: ['h3r10-A', 'h3r10-B'], // 50% overlap
        r12: ['h3r12-A', 'h3r12-B', 'h3r12-C'], // 33% overlap
      }

      const cells2 = {
        r6: ['h3r6-B'],
        r8: ['h3r8-A'],
        r10: ['h3r10-A', 'h3r10-C'],
        r12: ['h3r12-A', 'h3r12-D', 'h3r12-E'],
      }

      const overlap = calculateH3Overlap(cells1, cells2)

      // r6: 0/2 = 0.0
      // r8: 1/1 = 1.0
      // r10: 1/3 = 0.33
      // r12: 1/5 = 0.2
      // Average: (0.0 + 1.0 + 0.33 + 0.2) / 4 = 0.38
      expect(overlap).toBeCloseTo(0.38, 2)
    })
  })
})
