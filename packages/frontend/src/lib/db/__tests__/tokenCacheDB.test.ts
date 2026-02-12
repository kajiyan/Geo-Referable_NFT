import { tokenCacheDB } from '../tokenCacheDB'
import type { Token } from '@/types/index'

// Mock tokens for testing
const createMockToken = (id: string, h3r6: string, h3r8: string): Token => ({
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
  h3r10: 'h3r10-1',
  h3r12: 'h3r12-1',
  message: 'Test token',
  refCount: '0',
  totalDistance: '0',
  referringTo: [],
  referredBy: [],
  createdAt: Date.now().toString(),
  blockNumber: '1',
  transactionHash: '0x1',
})

describe('TokenCacheDatabase', () => {
  beforeEach(async () => {
    // Clear database before each test
    await tokenCacheDB.init()
    await tokenCacheDB.clear()
  })

  afterEach(async () => {
    // Clean up after tests
    await tokenCacheDB.clear()
  })

  describe('saveTokens', () => {
    it('should save tokens to IndexedDB', async () => {
      const tokens = [
        createMockToken('1', 'h3r6-A', 'h3r8-A'),
        createMockToken('2', 'h3r6-B', 'h3r8-B'),
      ]

      await tokenCacheDB.saveTokens(tokens)

      const allTokens = await tokenCacheDB.getAllTokens()
      expect(allTokens).toHaveLength(2)
      expect(allTokens.find(t => t.id === '1')).toBeDefined()
      expect(allTokens.find(t => t.id === '2')).toBeDefined()
    })

    it('should update existing tokens', async () => {
      const token = createMockToken('1', 'h3r6-A', 'h3r8-A')

      // Save first time
      await tokenCacheDB.saveTokens([token])

      // Update and save again
      const updatedToken = { ...token, message: 'Updated message' }
      await tokenCacheDB.saveTokens([updatedToken])

      const allTokens = await tokenCacheDB.getAllTokens()
      expect(allTokens).toHaveLength(1)
      expect(allTokens[0].message).toBe('Updated message')
    })
  })

  describe('getTokensByH3Cells', () => {
    beforeEach(async () => {
      const tokens = [
        createMockToken('1', 'h3r6-A', 'h3r8-A1'),
        createMockToken('2', 'h3r6-A', 'h3r8-A2'),
        createMockToken('3', 'h3r6-B', 'h3r8-B1'),
      ]
      await tokenCacheDB.saveTokens(tokens)
    })

    it('should retrieve tokens by H3r6 cells', async () => {
      const tokens = await tokenCacheDB.getTokensByH3Cells(['h3r6-A'], 'r6')
      expect(tokens).toHaveLength(2)
      expect(tokens.every(t => t.h3r6 === 'h3r6-A')).toBe(true)
    })

    it('should retrieve tokens by H3r8 cells', async () => {
      const tokens = await tokenCacheDB.getTokensByH3Cells(['h3r8-A1'], 'r8')
      expect(tokens).toHaveLength(1)
      expect(tokens[0].id).toBe('1')
    })

    it('should return empty array for non-existent cells', async () => {
      const tokens = await tokenCacheDB.getTokensByH3Cells(['h3r6-NONEXISTENT'], 'r6')
      expect(tokens).toHaveLength(0)
    })

    it('should retrieve tokens from multiple cells', async () => {
      const tokens = await tokenCacheDB.getTokensByH3Cells(['h3r8-A1', 'h3r8-B1'], 'r8')
      expect(tokens).toHaveLength(2)
    })
  })

  describe('getAllTokens', () => {
    it('should return all tokens', async () => {
      const tokens = [
        createMockToken('1', 'h3r6-A', 'h3r8-A'),
        createMockToken('2', 'h3r6-B', 'h3r8-B'),
        createMockToken('3', 'h3r6-C', 'h3r8-C'),
      ]
      await tokenCacheDB.saveTokens(tokens)

      const allTokens = await tokenCacheDB.getAllTokens()
      expect(allTokens).toHaveLength(3)
    })

    it('should return empty array when no tokens', async () => {
      const tokens = await tokenCacheDB.getAllTokens()
      expect(tokens).toHaveLength(0)
    })
  })

  describe('cleanup', () => {
    it('should remove tokens older than maxAge', async () => {
      const oldToken = createMockToken('old', 'h3r6-A', 'h3r8-A')
      const newToken = createMockToken('new', 'h3r6-B', 'h3r8-B')

      // Save old token with old timestamp
      const oldTimestamp = Date.now() - 8 * 24 * 60 * 60 * 1000 // 8 days ago
      await tokenCacheDB.saveTokens([{ ...oldToken, cachedAt: oldTimestamp } as Token])

      // Save new token with current timestamp
      await tokenCacheDB.saveTokens([newToken])

      // Cleanup tokens older than 7 days
      const deletedCount = await tokenCacheDB.cleanup(7 * 24 * 60 * 60 * 1000)

      expect(deletedCount).toBe(1)

      const remainingTokens = await tokenCacheDB.getAllTokens()
      expect(remainingTokens).toHaveLength(1)
      expect(remainingTokens[0].id).toBe('new')
    })

    it('should not remove tokens within maxAge', async () => {
      const tokens = [
        createMockToken('1', 'h3r6-A', 'h3r8-A'),
        createMockToken('2', 'h3r6-B', 'h3r8-B'),
      ]
      await tokenCacheDB.saveTokens(tokens)

      const deletedCount = await tokenCacheDB.cleanup(7 * 24 * 60 * 60 * 1000)

      expect(deletedCount).toBe(0)

      const remainingTokens = await tokenCacheDB.getAllTokens()
      expect(remainingTokens).toHaveLength(2)
    })
  })

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      const tokens = [
        createMockToken('1', 'h3r6-A', 'h3r8-A'),
        createMockToken('2', 'h3r6-B', 'h3r8-B'),
      ]
      await tokenCacheDB.saveTokens(tokens)

      const stats = await tokenCacheDB.getStats()

      expect(stats.totalTokens).toBe(2)
      expect(stats.dbSizeMB).toBeCloseTo(0.0035, 2) // ~1.8 KB * 2 / 1024
      expect(stats.lastCleanup).toBe(0) // No cleanup performed yet
    })

    it('should update lastCleanup after cleanup', async () => {
      await tokenCacheDB.saveTokens([createMockToken('1', 'h3r6-A', 'h3r8-A')])

      await tokenCacheDB.cleanup()

      const stats = await tokenCacheDB.getStats()
      expect(stats.lastCleanup).toBeGreaterThan(0)
    })
  })

  describe('clear', () => {
    it('should clear all data', async () => {
      const tokens = [
        createMockToken('1', 'h3r6-A', 'h3r8-A'),
        createMockToken('2', 'h3r6-B', 'h3r8-B'),
      ]
      await tokenCacheDB.saveTokens(tokens)

      await tokenCacheDB.clear()

      const allTokens = await tokenCacheDB.getAllTokens()
      expect(allTokens).toHaveLength(0)

      const stats = await tokenCacheDB.getStats()
      expect(stats.totalTokens).toBe(0)
    })
  })

  describe('error handling', () => {
    it('should handle save errors gracefully', async () => {
      // Create a token with invalid data (missing required field)
      const invalidToken = { id: '1' } as Token

      // Should not throw, but log error
      const consoleSpy = jest.spyOn(console, 'log')
      await tokenCacheDB.saveTokens([invalidToken])

      // Verify the save attempt was made
      expect(consoleSpy).toHaveBeenCalled()
    })
  })
})
