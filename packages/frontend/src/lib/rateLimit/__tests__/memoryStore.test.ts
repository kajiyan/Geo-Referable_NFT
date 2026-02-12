import { checkRateLimit, getClientId, clearRateLimit } from '../memoryStore'

describe('MemoryRateLimitStore', () => {
  beforeEach(() => {
    clearRateLimit()
  })

  afterEach(() => {
    clearRateLimit()
  })

  describe('checkRateLimit', () => {
    it('should allow initial requests within limit', () => {
      const clientId = 'test-client'
      
      const result1 = checkRateLimit(clientId, 5, 60000)
      expect(result1.allowed).toBe(true)
      expect(result1.remaining).toBe(4)

      const result2 = checkRateLimit(clientId, 5, 60000)
      expect(result2.allowed).toBe(true)
      expect(result2.remaining).toBe(3)
    })

    it('should block requests after limit exceeded', () => {
      const clientId = 'test-client'
      const limit = 3

      // Make requests up to limit
      for (let i = 0; i < limit; i++) {
        const result = checkRateLimit(clientId, limit, 60000)
        expect(result.allowed).toBe(true)
      }

      // Next request should be blocked
      const blockedResult = checkRateLimit(clientId, limit, 60000)
      expect(blockedResult.allowed).toBe(false)
      expect(blockedResult.remaining).toBe(0)
      expect(blockedResult.retryAfter).toBeGreaterThan(0)
    })

    it('should reset after time window expires', () => {
      const clientId = 'test-client'
      const limit = 2
      const windowMs = 100 // 100ms window

      // Exhaust limit
      checkRateLimit(clientId, limit, windowMs)
      checkRateLimit(clientId, limit, windowMs)
      
      const blockedResult = checkRateLimit(clientId, limit, windowMs)
      expect(blockedResult.allowed).toBe(false)

      // Wait for window to expire
      return new Promise(resolve => {
        setTimeout(() => {
          const allowedResult = checkRateLimit(clientId, limit, windowMs)
          expect(allowedResult.allowed).toBe(true)
          expect(allowedResult.remaining).toBe(limit - 1)
          resolve(true)
        }, windowMs + 10)
      })
    })

    it('should handle different clients independently', () => {
      const client1 = 'client-1'
      const client2 = 'client-2'
      const limit = 2

      // Exhaust limit for client1
      checkRateLimit(client1, limit, 60000)
      checkRateLimit(client1, limit, 60000)
      
      const blocked = checkRateLimit(client1, limit, 60000)
      expect(blocked.allowed).toBe(false)

      // Client2 should still be allowed
      const allowed = checkRateLimit(client2, limit, 60000)
      expect(allowed.allowed).toBe(true)
    })
  })

  describe('getClientId', () => {
    it('should extract IP from x-forwarded-for header', () => {
      const mockRequest = {
        headers: {
          get: jest.fn((header) => {
            if (header === 'x-forwarded-for') return '192.168.1.1, 10.0.0.1'
            return null
          })
        }
      } as unknown as Request

      const clientId = getClientId(mockRequest)
      expect(clientId).toBe('192.168.1.1')
    })

    it('should extract IP from x-real-ip header when x-forwarded-for not available', () => {
      const mockRequest = {
        headers: {
          get: jest.fn((header) => {
            if (header === 'x-real-ip') return '192.168.1.2'
            return null
          })
        }
      } as unknown as Request

      const clientId = getClientId(mockRequest)
      expect(clientId).toBe('192.168.1.2')
    })

    it('should fallback to localhost in development', () => {
      const originalEnv = process.env.NODE_ENV
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'development',
        writable: true,
        configurable: true
      })

      const mockRequest = {
        headers: {
          get: jest.fn(() => null)
        }
      } as unknown as Request

      const clientId = getClientId(mockRequest)
      expect(clientId).toBe('127.0.0.1')

      Object.defineProperty(process.env, 'NODE_ENV', {
        value: originalEnv,
        writable: true,
        configurable: true
      })
    })
  })
})