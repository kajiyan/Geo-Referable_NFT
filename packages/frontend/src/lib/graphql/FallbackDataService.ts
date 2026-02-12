/**
 * FallbackDataService
 *
 * Provides mock token data when the Subgraph is unavailable.
 * Loads pre-generated mock data from /data/mock-tokens.json and
 * provides H3-based spatial querying to match Subgraph query patterns.
 */

import { Token } from '@/types'
import { FALLBACK_CONFIG } from '@/config/fallbackConfig'

interface MockTokenData {
  metadata: {
    generatedAt: string
    totalTokens: number
    sources: string[]
    regions: {
      tokyo: {
        bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number }
        tokenCount: number
      }
      nagoya: {
        bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number }
        tokenCount: number
      }
    }
  }
  tokens: Token[]
}

type H3Resolution = 'r6' | 'r8' | 'r10' | 'r12'

export class FallbackDataService {
  private data: MockTokenData | null = null
  private loadPromise: Promise<void> | null = null
  private lastLoadTime = 0

  // H3 indices for fast spatial lookup
  private h3Index: Map<string, Token[]> = new Map()

  /**
   * Initialize the service by loading mock data
   */
  async initialize(): Promise<void> {
    // If already loading, wait for the existing load
    if (this.loadPromise) {
      await this.loadPromise
      return
    }

    // Check cache validity
    const now = Date.now()
    if (this.data && now - this.lastLoadTime < FALLBACK_CONFIG.CACHE_DURATION_MS) {
      return
    }

    // Load mock data
    this.loadPromise = this.loadMockData()
    await this.loadPromise
    this.loadPromise = null
  }

  private async loadMockData(): Promise<void> {
    try {
      console.log('[FallbackDataService] Loading mock data from', FALLBACK_CONFIG.MOCK_DATA_URL)

      const response = await fetch(FALLBACK_CONFIG.MOCK_DATA_URL)
      if (!response.ok) {
        throw new Error(`Failed to fetch mock data: ${response.status}`)
      }

      this.data = await response.json()
      this.lastLoadTime = Date.now()

      // Build H3 index for fast spatial queries
      this.buildH3Index()

      console.log('[FallbackDataService] Loaded', this.data?.tokens.length, 'mock tokens')
    } catch (error) {
      console.error('[FallbackDataService] Failed to load mock data:', error)
      throw error
    }
  }

  private buildH3Index(): void {
    if (!this.data) return

    this.h3Index.clear()

    for (const token of this.data.tokens) {
      // Index by all H3 resolutions
      const cells = [token.h3r6, token.h3r8, token.h3r10, token.h3r12]

      for (const cell of cells) {
        if (!cell) continue

        const existing = this.h3Index.get(cell)
        if (existing) {
          existing.push(token)
        } else {
          this.h3Index.set(cell, [token])
        }
      }
    }

    console.log('[FallbackDataService] Built H3 index with', this.h3Index.size, 'cells')
  }

  /**
   * Query tokens by H3 cells - matches the zoom-adaptive query pattern
   */
  async queryTokens(variables: Record<string, unknown>): Promise<{
    tokensByR6?: Token[]
    tokensByR8?: Token[]
    tokensByR10?: Token[]
    tokensByR12?: Token[]
  }> {
    await this.initialize()

    if (!this.data) {
      console.warn('[FallbackDataService] No data available')
      return {}
    }

    const result: Record<string, Token[]> = {}

    // Extract H3 cells from variables and query
    const resolutions: H3Resolution[] = ['r6', 'r8', 'r10', 'r12']

    for (const resolution of resolutions) {
      const cellsKey = `h3${resolution}Cells`
      const cells = variables[cellsKey] as string[] | undefined

      if (cells && Array.isArray(cells) && cells.length > 0) {
        const tokens = this.getTokensByH3Cells(cells, resolution)
        const aliasKey = `tokensByR${resolution.slice(1)}`
        result[aliasKey] = tokens

        console.log(`[FallbackDataService] ${aliasKey}: ${tokens.length} tokens for ${cells.length} cells`)
      }
    }

    return result
  }

  /**
   * Get tokens by H3 cells for a specific resolution
   */
  private getTokensByH3Cells(cells: string[], _resolution: H3Resolution): Token[] {
    const tokenSet = new Map<string, Token>()

    for (const cell of cells) {
      const tokens = this.h3Index.get(cell)
      if (tokens) {
        for (const token of tokens) {
          // Deduplicate by token ID
          if (!tokenSet.has(token.id)) {
            tokenSet.set(token.id, token)
          }
        }
      }
    }

    return Array.from(tokenSet.values())
  }

  /**
   * Get all tokens (for debugging or full load)
   */
  async getAllTokens(): Promise<Token[]> {
    await this.initialize()
    return this.data?.tokens || []
  }

  /**
   * Get metadata about the mock data
   */
  async getMetadata(): Promise<MockTokenData['metadata'] | null> {
    await this.initialize()
    return this.data?.metadata || null
  }

  /**
   * Check if mock data is loaded
   */
  isLoaded(): boolean {
    return this.data !== null
  }

  /**
   * Get the number of loaded tokens
   */
  getTokenCount(): number {
    return this.data?.tokens.length || 0
  }
}

// Singleton instance
export const fallbackDataService = new FallbackDataService()
