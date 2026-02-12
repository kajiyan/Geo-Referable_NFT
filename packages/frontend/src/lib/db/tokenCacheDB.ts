import { openDB, DBSchema, IDBPDatabase } from 'idb'
import type { Token } from '@/types/index'

/**
 * Check if we're in a browser environment with IndexedDB support
 */
const isBrowser = typeof window !== 'undefined' && typeof indexedDB !== 'undefined'

interface TokenCacheDB extends DBSchema {
  tokens: {
    key: string
    value: Token & { cachedAt: number }
    indexes: {
      'by-h3r6': string
      'by-h3r8': string
      'by-h3r10': string
      'by-h3r12': string
      'by-cached-at': number
    }
  }
  metadata: {
    key: string
    value: {
      key: string
      lastCleanup: number
      totalTokens: number
      version: string
    }
  }
}

/**
 * IndexedDB cache for cold storage of tokens
 * Provides offline capability and faster subsequent loads
 *
 * NOTE: All methods are no-ops on server-side (SSR)
 */
class TokenCacheDatabase {
  private db: IDBPDatabase<TokenCacheDB> | null = null
  private readonly DB_NAME = 'norosi-token-cache'
  private readonly DB_VERSION = 1

  /**
   * Check if IndexedDB is available (browser-only)
   */
  isAvailable(): boolean {
    return isBrowser
  }

  async init(): Promise<IDBPDatabase<TokenCacheDB> | null> {
    // Skip initialization on server-side
    if (!isBrowser) {
      return null
    }

    if (this.db) return this.db

    try {
      this.db = await openDB<TokenCacheDB>(this.DB_NAME, this.DB_VERSION, {
        upgrade(db) {
          // Token store
          const tokenStore = db.createObjectStore('tokens', { keyPath: 'id' })
          tokenStore.createIndex('by-h3r6', 'h3r6')
          tokenStore.createIndex('by-h3r8', 'h3r8')
          tokenStore.createIndex('by-h3r10', 'h3r10')
          tokenStore.createIndex('by-h3r12', 'h3r12')
          tokenStore.createIndex('by-cached-at', 'cachedAt')

          // Metadata store
          db.createObjectStore('metadata', { keyPath: 'key' })
        },
      })

      return this.db
    } catch (error) {
      console.error('[tokenCacheDB] Failed to initialize IndexedDB:', error)
      return null
    }
  }

  /**
   * Save tokens to IndexedDB
   */
  async saveTokens(tokens: Token[]): Promise<void> {
    if (!isBrowser) return

    const db = await this.init()
    if (!db) return

    const tx = db.transaction('tokens', 'readwrite')
    const now = Date.now()

    await Promise.all(
      tokens.map(token =>
        tx.store.put({ ...token, cachedAt: now })
      )
    )

    await tx.done
    console.log(`[tokenCacheDB] Saved ${tokens.length} tokens to IndexedDB`)
  }

  /**
   * Get tokens by H3 cells
   */
  async getTokensByH3Cells(
    cells: string[],
    resolution: 'r6' | 'r8' | 'r10' | 'r12'
  ): Promise<Token[]> {
    if (!isBrowser) return []

    const db = await this.init()
    if (!db) return []

    // Map resolution to index name
    const indexMap = {
      'r6': 'by-h3r6',
      'r8': 'by-h3r8',
      'r10': 'by-h3r10',
      'r12': 'by-h3r12',
    } as const

    const indexName = indexMap[resolution]
    const results: Token[] = []

    for (const cell of cells) {
      const tokens = await db.getAllFromIndex('tokens', indexName, cell)
      results.push(...tokens)
    }

    console.log(`[tokenCacheDB] Retrieved ${results.length} tokens from IndexedDB (${resolution})`)
    return results
  }

  /**
   * Get all tokens (for bulk operations)
   */
  async getAllTokens(): Promise<Token[]> {
    if (!isBrowser) return []

    const db = await this.init()
    if (!db) return []

    const tokens = await db.getAll('tokens')
    console.log(`[tokenCacheDB] Retrieved ${tokens.length} tokens from IndexedDB`)
    return tokens
  }

  /**
   * Clean up old tokens
   */
  async cleanup(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    if (!isBrowser) return 0

    const db = await this.init()
    if (!db) return 0

    try {
      const cutoff = Date.now() - maxAge
      const tx = db.transaction('tokens', 'readwrite')
      const index = tx.store.index('by-cached-at')

      let deletedCount = 0
      let cursor = await index.openCursor(IDBKeyRange.upperBound(cutoff))

      while (cursor) {
        await cursor.delete()
        deletedCount++
        cursor = await cursor.continue()
      }

      await tx.done
      console.log(`[tokenCacheDB] Cleaned up ${deletedCount} old tokens from IndexedDB`)

      // Update metadata
      await this.updateMetadata()

      return deletedCount
    } catch (error) {
      console.error('[tokenCacheDB] Error during cleanup:', error)
      return 0
    }
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    totalTokens: number
    dbSizeMB: number
    lastCleanup: number
  }> {
    if (!isBrowser) {
      return { totalTokens: 0, dbSizeMB: 0, lastCleanup: 0 }
    }

    const db = await this.init()
    if (!db) {
      return { totalTokens: 0, dbSizeMB: 0, lastCleanup: 0 }
    }

    const tokens = await db.getAll('tokens')
    const metadata = await db.get('metadata', 'stats')

    return {
      totalTokens: tokens.length,
      dbSizeMB: parseFloat((tokens.length * 1.8 / 1024).toFixed(2)),
      lastCleanup: metadata?.lastCleanup || 0,
    }
  }

  /**
   * Update metadata
   */
  private async updateMetadata(): Promise<void> {
    if (!isBrowser) return

    const db = await this.init()
    if (!db) return

    const tokens = await db.getAll('tokens')

    const metadataValue: TokenCacheDB['metadata']['value'] = {
      key: 'stats',
      lastCleanup: Date.now(),
      totalTokens: tokens.length,
      version: '1.0',
    }

    await db.put('metadata', metadataValue)
  }

  /**
   * Clear all data
   */
  async clear(): Promise<void> {
    if (!isBrowser) return

    const db = await this.init()
    if (!db) return

    const tx = db.transaction(['tokens', 'metadata'], 'readwrite')
    await tx.objectStore('tokens').clear()
    await tx.objectStore('metadata').clear()
    await tx.done
    console.log('[tokenCacheDB] Cleared all data from IndexedDB')
  }
}

export const tokenCacheDB = new TokenCacheDatabase()
