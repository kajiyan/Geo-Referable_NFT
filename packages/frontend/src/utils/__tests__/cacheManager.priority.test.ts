import { calculateTokenPriority } from '../cacheManager'
import type { Token } from '@/types/index'

describe('Cache Priority Algorithm v2.0 (Hybrid Adaptive)', () => {
  const now = Date.now()
  const MS_PER_DAY = 1000 * 60 * 60 * 24

  // Helper to create test tokens
  const createToken = (overrides: Partial<Token>): Token => ({
    id: '1',
    tokenId: '1',
    owner: { id: 'owner-1', address: '0x1' },
    latitude: '35.0',
    longitude: '139.0',
    elevation: '0',
    quadrant: 0,
    colorIndex: "0",
    treeId: '0',
    generation: '0',
    tree: {
      id: '0x00',
      treeId: '0',
      maxGeneration: '10'
    },
    treeIndex: '0',
    h3r6: 'h3r6-1',
    h3r8: 'h3r8-1',
    h3r10: 'h3r10-1',
    h3r12: 'h3r12-1',
    message: '',
    refCount: '0',
    totalDistance: '0',
    referringTo: [],
    referredBy: [],
    createdAt: now.toString(),
    blockNumber: '1',
    transactionHash: '0x1',
    ...overrides,
  })

  describe('Scenario 1: Popular established token (Shibuya Station)', () => {
    it('should score high for deep generation and high refCount', () => {
      const shibuyaToken = createToken({
        generation: '5',
        refCount: '8',
        message: '渋谷スクランブル交差点で撮影',
        createdAt: (now - 30 * MS_PER_DAY).toString(), // 30 days ago
      })

      const score = calculateTokenPriority(shibuyaToken, now - 30000, now)

      // Expected: G=5×0.25 + R=8×0.20 + M=0.15 + Recency≈0.15 + Freshness≈0.09 = ~3.24
      expect(score).toBeGreaterThan(3.0)
      expect(score).toBeLessThan(3.5)
    })
  })

  describe('Scenario 2: Brand new token (today)', () => {
    it('should receive exploration bonus for tokens < 7 days old', () => {
      const newCafeToken = createToken({
        generation: '0',
        refCount: '0',
        message: '新しいカフェを発見！',
        createdAt: now.toString(), // Just minted
      })

      const score = calculateTokenPriority(newCafeToken, now, now)

      // Expected: G=0 + R=0 + M=0.15 + Recency=0.15 + Freshness=0.25 + Bonus=0.4 = 0.95
      expect(score).toBeGreaterThan(0.9)
      expect(score).toBeLessThan(1.0)
    })

    it('should NOT receive exploration bonus after 7 days', () => {
      const weekOldToken = createToken({
        generation: '0',
        refCount: '0',
        message: '',
        createdAt: (now - 8 * MS_PER_DAY).toString(), // 8 days ago
      })

      const score = calculateTokenPriority(weekOldToken, now - 1000, now)

      // No exploration bonus, lower freshness
      expect(score).toBeLessThan(0.4)
    })
  })

  describe('Scenario 3: Growing token (4 days old, 1 reference)', () => {
    it('should score well with bonus + early growth', () => {
      const growingToken = createToken({
        generation: '1',
        refCount: '1',
        message: '人気のラーメン屋',
        createdAt: (now - 4 * MS_PER_DAY).toString(), // 4 days ago
      })

      const score = calculateTokenPriority(growingToken, now - 1000, now)

      // Expected: G=1×0.25 + R=1×0.20 + M=0.15 + Recency≈0.15 + Freshness≈0.22 + Bonus=0.4 = ~1.37
      expect(score).toBeGreaterThan(1.2)
      expect(score).toBeLessThan(1.5)
    })
  })

  describe('Scenario 4: Very old token without activity', () => {
    it('should score low due to age and lack of engagement', () => {
      const oldToken = createToken({
        generation: '0',
        refCount: '0',
        message: '',
        createdAt: (now - 90 * MS_PER_DAY).toString(), // 90 days ago
      })

      const score = calculateTokenPriority(oldToken, now - 7 * MS_PER_DAY, now)

      // Expected: Very low score (no bonus, low freshness, low recency)
      expect(score).toBeLessThan(0.2)
    })
  })

  describe('Scenario 5: Generation cap (prevent over-privileging)', () => {
    it('should cap generation at 8 instead of 10', () => {
      const highGenToken = createToken({
        generation: '15', // Very deep chain
        refCount: '0',
        message: '',
        createdAt: (now - 30 * MS_PER_DAY).toString(),
      })

      const score = calculateTokenPriority(highGenToken, now - 1000, now)

      // Expected: Capped at G=8×0.25=2.0, not 15×0.25=3.75
      const generationComponent = 8 * 0.25 // 2.0
      expect(score).toBeGreaterThan(generationComponent)
      expect(score).toBeLessThan(generationComponent + 0.5) // Plus other small components
    })
  })

  describe('Scenario 6: RefCount cap (prevent over-privileging)', () => {
    it('should cap refCount at 8 instead of 10', () => {
      const popularToken = createToken({
        generation: '0',
        refCount: '20', // Very popular
        message: '',
        createdAt: (now - 30 * MS_PER_DAY).toString(),
      })

      const score = calculateTokenPriority(popularToken, now - 1000, now)

      // Expected: Capped at R=8×0.20=1.6, not 20×0.20=4.0
      const refCountComponent = 8 * 0.20 // 1.6
      expect(score).toBeGreaterThan(refCountComponent)
      expect(score).toBeLessThan(refCountComponent + 0.5)
    })
  })

  describe('Discovery Balance: New vs Established', () => {
    it('should reduce score gap from 47x to ~5x', () => {
      // Old algorithm: Shibuya=4.7, New=0.1 (47x difference)
      // New algorithm: Shibuya≈3.24, New≈0.63 (5.1x difference)

      const establishedToken = createToken({
        generation: '5',
        refCount: '8',
        message: '渋谷駅',
        createdAt: (now - 30 * MS_PER_DAY).toString(),
      })

      const newToken = createToken({
        generation: '0',
        refCount: '0',
        message: '新カフェ',
        createdAt: (now - 2 * MS_PER_DAY).toString(), // 2 days old (still has bonus)
      })

      const establishedScore = calculateTokenPriority(establishedToken, now - 30000, now)
      const newScore = calculateTokenPriority(newToken, now, now)

      const ratio = establishedScore / newScore

      // New tokens are much more discoverable!
      expect(ratio).toBeLessThan(6) // Was ~47x, now <6x
      expect(ratio).toBeGreaterThan(3) // Still preserve some advantage for established tokens
    })
  })
})
