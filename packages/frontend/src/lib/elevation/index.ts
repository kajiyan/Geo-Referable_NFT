interface CacheEntry {
  elevation: number
  at: number
  accessCount: number
  lastAccess: number
}

class ElevationCache {
  private cache = new Map<string, CacheEntry>()
  private readonly MAX_SIZE = 1000
  private readonly TTL_MS = 5 * 60 * 1000 // 5 minutes
  private cleanupInterval: NodeJS.Timeout | null = null
  
  constructor() {
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 10 * 60 * 1000) // Clean every 10 minutes
  }
  
  get(key: string): number | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    
    const now = Date.now()
    if (now - entry.at > this.TTL_MS) {
      this.cache.delete(key)
      return null
    }
    
    // Update access tracking for LRU
    entry.accessCount++
    entry.lastAccess = now
    
    return entry.elevation
  }
  
  set(key: string, elevation: number): void {
    const now = Date.now()
    
    // Enforce size limit with LRU eviction
    if (this.cache.size >= this.MAX_SIZE && !this.cache.has(key)) {
      this.evictLRU()
    }
    
    this.cache.set(key, {
      elevation,
      at: now,
      accessCount: 1,
      lastAccess: now
    })
  }
  
  private cleanup(): void {
    const now = Date.now()
    const toDelete: string[] = []
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.at > this.TTL_MS) {
        toDelete.push(key)
      }
    }
    
    toDelete.forEach(key => this.cache.delete(key))
    
    if (toDelete.length > 0) {
      console.log(`[ElevationCache] Cleaned up ${toDelete.length} expired entries. Cache size: ${this.cache.size}`)
    }
  }
  
  private evictLRU(): void {
    let oldestKey = ''
    let oldestTime = Date.now()
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess
        oldestKey = key
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey)
      console.log(`[ElevationCache] Evicted LRU entry: ${oldestKey}`)
    }
  }
  
  // For testing purposes
  clear(): void {
    this.cache.clear()
  }

  // Get cache stats
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.MAX_SIZE,
      ttlMs: this.TTL_MS
    }
  }
  
  // Cleanup on shutdown
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.cache.clear()
  }
}

// Singleton instance
export const elevationCache = new ElevationCache()

export function keyFor(lat: number, lon: number) {
  const rLat = Math.round(lat * 50) / 50
  const rLon = Math.round(lon * 50) / 50
  return `${rLat},${rLon}`
}

export async function fetchOpenMeteoElevation(
  lat: number,
  lon: number,
  signal?: AbortSignal
): Promise<number> {
  const k = keyFor(lat, lon)
  const cached = elevationCache.get(k)
  if (cached !== null) return cached

  const url = new URL('https://api.open-meteo.com/v1/elevation')
  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('longitude', String(lon))

  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Open-Meteo Elevation API error: ${res.status}`)

  const data = await res.json()
  const elevationArray = data?.elevation
  if (!Array.isArray(elevationArray) || typeof elevationArray[0] !== 'number') {
    throw new Error('Open-Meteo elevation data missing or invalid')
  }

  const elevation = Math.round(elevationArray[0])
  elevationCache.set(k, elevation)
  return elevation
}

/**
 * GSI Elevation API response type
 * @see https://maps.gsi.go.jp/development/elevation.html
 */
interface GSIElevationResponse {
  /** Elevation value as string (e.g., "25.3") or "-----" for unavailable */
  elevation: string
  /** Data source (e.g., "5m（レーザ）", "10m（レーザ）") or "-----" for unavailable */
  hsrc: string
}

/**
 * Type guard for valid GSI elevation response
 */
function isValidGSIResponse(data: unknown): data is GSIElevationResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'elevation' in data &&
    typeof (data as GSIElevationResponse).elevation === 'string'
  )
}

/**
 * Check if GSI elevation value is available (not "-----" or empty)
 */
function isElevationAvailable(elevation: string): boolean {
  return elevation !== '-----' && elevation !== ''
}

/**
 * Fetch elevation from GSI (国土地理院) API.
 * This is the primary source for Japan locations, providing high accuracy data.
 *
 * API Documentation: https://maps.gsi.go.jp/development/elevation.html
 *
 * Response format:
 * - Success: { "elevation": "25.3", "hsrc": "5m（レーザ）" }
 * - Error: { "elevation": "-----", "hsrc": "-----" }
 *
 * Note: GSI returns elevation as a string, not a number.
 */
export async function fetchGSIElevation(
  lat: number,
  lon: number,
  signal?: AbortSignal
): Promise<number> {
  const k = keyFor(lat, lon)
  const cached = elevationCache.get(k)
  if (cached !== null) return cached

  const url = new URL('https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php')
  url.searchParams.set('lon', String(lon))
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('outtype', 'JSON')

  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`GSI Elevation API error: ${res.status}`)

  const data: unknown = await res.json()

  // Validate response structure
  if (!isValidGSIResponse(data)) {
    throw new Error('Invalid GSI API response format')
  }

  // Check if elevation data is available
  if (!isElevationAvailable(data.elevation)) {
    throw new Error('GSI elevation data not available for this location')
  }

  // Parse and validate elevation value
  const elevation = parseFloat(data.elevation)
  if (!Number.isFinite(elevation)) {
    throw new Error(`GSI returned invalid elevation value: ${data.elevation}`)
  }

  const roundedElevation = Math.round(elevation)
  elevationCache.set(k, roundedElevation)

  console.log(`[GSI Elevation] lat=${lat}, lon=${lon}, elevation=${roundedElevation}m, source=${data.hsrc}`)

  return roundedElevation
}

/**
 * Fetch elevation with GSI → Open-Meteo fallback strategy.
 * This is the preferred method for getting elevation data.
 *
 * Priority:
 * 1. GSI API (高精度、日本国内推奨)
 * 2. Open-Meteo API (グローバルカバレッジ)
 */
export async function fetchElevationWithFallback(
  lat: number,
  lon: number,
  signal?: AbortSignal
): Promise<{ elevation: number; source: 'gsi' | 'open-meteo' }> {
  // Try GSI first
  try {
    const elevation = await fetchGSIElevation(lat, lon, signal)
    return { elevation, source: 'gsi' }
  } catch (gsiError) {
    console.warn('[Elevation] GSI API failed, falling back to Open-Meteo:', (gsiError as Error).message)
  }

  // Fallback to Open-Meteo
  try {
    const elevation = await fetchOpenMeteoElevation(lat, lon, signal)
    return { elevation, source: 'open-meteo' }
  } catch (openMeteoError) {
    console.error('[Elevation] Open-Meteo API also failed:', (openMeteoError as Error).message)
    throw openMeteoError
  }
}

/** Default camera height when GSI fails (human eye level in meters) */
const DEFAULT_CAMERA_HEIGHT = 1.6

/**
 * Fetch elevation from GSI only, with fixed fallback.
 * No Open-Meteo fallback - returns default height on failure.
 * Used for AR camera positioning.
 *
 * @param lat - Latitude in degrees
 * @param lon - Longitude in degrees
 * @param signal - Optional AbortSignal for cancellation
 * @returns Elevation and source ('gsi' or 'default')
 */
export async function fetchGSIElevationOnly(
  lat: number,
  lon: number,
  signal?: AbortSignal
): Promise<{ elevation: number; source: 'gsi' | 'default' }> {
  try {
    const elevation = await fetchGSIElevation(lat, lon, signal)
    return { elevation, source: 'gsi' }
  } catch (error) {
    console.warn('[Elevation] GSI failed, using default camera height:', (error as Error).message)
    return { elevation: DEFAULT_CAMERA_HEIGHT, source: 'default' }
  }
}