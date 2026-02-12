interface RateLimitEntry {
  count: number
  resetTime: number
  lastRequest: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfter?: number
}

class MemoryRateLimitStore {
  private store = new Map<string, RateLimitEntry>()
  private readonly MAX_STORE_SIZE = 10000
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // Start cleanup interval to prevent memory leaks
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries()
    }, 5 * 60 * 1000) // Cleanup every 5 minutes
  }

  checkRateLimit(
    clientId: string,
    limit: number = 5,
    windowMs: number = 60000
  ): RateLimitResult {
    const now = Date.now()
    
    // Cleanup expired entries to prevent memory bloat
    if (this.store.size > this.MAX_STORE_SIZE) {
      this.cleanupExpiredEntries()
    }
    
    const entry = this.store.get(clientId)
    
    // No entry exists or window has expired
    if (!entry || now > entry.resetTime) {
      this.store.set(clientId, {
        count: 1,
        resetTime: now + windowMs,
        lastRequest: now
      })
      
      return { 
        allowed: true, 
        remaining: limit - 1 
      }
    }
    
    // Limit exceeded
    if (entry.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfter: Math.ceil((entry.resetTime - now) / 1000)
      }
    }
    
    // Increment counter
    entry.count++
    entry.lastRequest = now
    this.store.set(clientId, entry)
    
    return { 
      allowed: true, 
      remaining: limit - entry.count 
    }
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now()
    const toDelete: string[] = []
    
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        toDelete.push(key)
      }
    }
    
    toDelete.forEach(key => this.store.delete(key))
    
    if (toDelete.length > 0) {
      console.log(`[RateLimit] Cleaned up ${toDelete.length} expired entries. Store size: ${this.store.size}`)
    }
  }

  // For testing purposes
  clear(): void {
    this.store.clear()
  }

  // Cleanup on shutdown
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.store.clear()
  }
}

// Singleton instance
const rateLimitStore = new MemoryRateLimitStore()

export function checkRateLimit(
  clientId: string,
  limit: number = 5,
  windowMs: number = 60000
): RateLimitResult {
  return rateLimitStore.checkRateLimit(clientId, limit, windowMs)
}

export function getClientId(request: Request): string {
  // Try to get IP address from various headers
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const connectingIp = request.headers.get('x-connecting-ip')
  
  let clientIp = forwardedFor?.split(',')[0]?.trim() || 
                 realIp || 
                 connectingIp || 
                 'unknown'

  // Fallback for development
  if (clientIp === 'unknown' && process.env.NODE_ENV === 'development') {
    clientIp = '127.0.0.1'
  }

  return clientIp
}

// For testing
export function clearRateLimit(): void {
  rateLimitStore.clear()
}

export function destroyRateLimit(): void {
  rateLimitStore.destroy()
}

export type { RateLimitResult }