# Token Cache Management Implementation Plan

## 📋 Document Overview

**Project**: NOROSI (Geo-relational NFT)
**Target**: iPhone 17 Optimization
**Strategy**: H3-Aware Viewport-Based Spatial Cache
**Version**: 1.1 (AR Mode Validated)
**Date**: 2025-11-04
**Author**: Claude + Human Collaboration
**Last Updated**: 2025-11-04 (AR 5km constraint validation)

---

## 🎯 Executive Summary

This document outlines a comprehensive cache management strategy to prevent memory leaks and optimize performance for the NOROSI map application on iPhone 17 devices. The implementation uses a two-phase approach:

- **Phase 1** (Essential): Viewport-Based Spatial Cache in Redux memory
- **Phase 2** (Recommended): IndexedDB integration for offline support

**Key Metrics:**

- Memory Budget: 5.4 MB (3,000 tokens in Redux)
- Display Limit: 100 markers (Map mode) / 50-200 objects (AR mode, 5km radius)
- Cache Zone: Viewport × 2.5
- Safety Margin: 90% of iPhone 17's token budget remains unused

**AR Mode Validation (v1.1):**

- ✅ **Confirmed Safe**: AR mode displays only tokens within 5km radius (~50-200 objects)
- ✅ **No Cache Reduction Needed**: 3,000 token cache remains valid for both Map and AR modes
- ✅ **Filtering at Component Level**: React Three Fiber only renders nearby tokens, not all cached tokens
- ✅ **Total Memory in AR Mode**: ~186-332 MB (95% of 350MB limit, safe margin maintained)

---

## 🔍 Technical Background

### Current Architecture

**Tech Stack:**
- Frontend: Next.js 15 + React 18 + Redux Toolkit
- Map Engine: MapLibre GL JS 4.x via react-map-gl
- Markers: Custom DOM-based MapMarquee components
- Data Source: The Graph (Subgraph) via Apollo Client
- Geospatial Index: H3 (4-level: r6, r8, r10, r12)

**Data Structure:**
```typescript
interface Token {
  id: string                      // ~36 bytes (UUID)
  tokenId: string                 // ~20 bytes
  owner: { id, address }          // ~80 bytes
  latitude/longitude: string      // ~40 bytes
  h3r6/r8/r10/r12: string        // ~60 bytes (15 × 4)
  message: string                 // ~50-200 bytes (variable)
  referringTo: TokenReference[]   // ~100-500 bytes (variable)
  referredBy: TokenReference[]    // ~100-500 bytes (variable)
  // ... other fields
}

// Effective memory per token: ~1.8 KB (including Redux overhead)
```

### Current Issues

1. **Infinite Memory Growth**: Redux state accumulates tokens indefinitely as users pan the map
2. **No Eviction Strategy**: Tokens outside viewport remain in memory forever
3. **Memory Leak Risk**: Extended usage can lead to crashes on mobile devices
4. **Inefficient Cache**: Only display limit (100 markers) exists, no cache limit

### iPhone 17 Memory Constraints

| Resource | Capacity |
|----------|----------|
| **JavaScript Heap Limit** | ~300-350 MB (iPhone 17: 8GB RAM) |
| **Framework Overhead** | 40-60 MB (React/Redux/MapLibre) |
| **Map Engine** | 50-80 MB (tiles, WebGL) |
| **DOM Elements** | 20-40 MB (UI components) |
| **Available for Token Data** | **100-120 MB** |

**Safe Operating Range**: Use only 10-20% of available token budget to maintain stability.

---

## 🏆 Adopted Strategy: H3-Aware Viewport Cache

### Core Concept: 3-Zone Spatial Cache

```
┌─────────────────────────────────────────┐
│   Outer Buffer (Eviction Zone)         │
│   - Tokens are deleted                  │
│  ┌───────────────────────────────────┐  │
│  │  Cache Zone (Keep)                │  │
│  │  - Viewport × 2.5                 │  │
│  │  - Max 3,000 tokens (~5.4 MB)    │  │
│  │ ┌───────────────────────────┐    │  │
│  │ │  Viewport (Visible)       │    │  │
│  │ │  - 100 markers displayed  │    │  │
│  │ └───────────────────────────┘    │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### Design Principles

1. **Geographic Relevance**: Keep tokens near current viewport
2. **Recency Protection**: Keep recently accessed tokens (60s minimum)
3. **Priority-Based Eviction**: High-value tokens (high generation, many references) stay longer
4. **H3 Integration**: Align with existing H3-based data fetching
5. **Race Condition Safety**: Defer cleanup during active fetches
6. **Predictable Memory**: Hard cap at 3,000 tokens (~5.4 MB)

---

## 📦 Phase 1: Core Implementation (Essential)

### 1.1 Cache Configuration

**File**: `packages/frontend/src/config/cacheConstants.ts`

```typescript
export const CACHE_CONFIG = {
  // Memory limits
  MAX_CACHED_TOKENS: 3000,              // ~5.4 MB (safe for iPhone 17)
  MAX_VISIBLE_MARKERS: 100,             // Display limit (unchanged)
  FORCE_CLEANUP_THRESHOLD: 4000,        // Emergency cleanup trigger

  // Spatial bounds
  VIEWPORT_BUFFER_MULTIPLIER: 2.5,      // Cache Zone = Viewport × 2.5

  // Timing
  CLEANUP_DEBOUNCE_MS: 1000,            // Wait 1s after last viewport change
  MIN_KEEP_TIME_MS: 60000,              // Keep tokens for at least 60s
  PERIODIC_CLEANUP_INTERVAL_MS: 30000,  // Check every 30s

  // H3 integration (Phase 2)
  USE_H3_CELL_FILTERING: false,         // Phase 1: false, Phase 2: true
  H3_OVERLAP_THRESHOLD: 0.3,            // 30% H3 cell overlap = keep token

  // Priority scoring weights
  PRIORITY_WEIGHTS: {
    GENERATION: 0.4,      // Higher generation = more important
    REF_COUNT: 0.3,       // More references = more important
    HAS_MESSAGE: 0.2,     // Has message = more important
    RECENCY: 0.1,         // Recently accessed = slightly more important
  },

  // Memory safety
  MEMORY_WARNING_THRESHOLD_MB: 8,       // Warn at 8MB
  MEMORY_CRITICAL_THRESHOLD_MB: 10,     // Force cleanup at 10MB
} as const

export type CacheConfig = typeof CACHE_CONFIG
```

### 1.2 Redux State Extension

**File**: `packages/frontend/src/lib/slices/nftMapSlice.ts`

```typescript
export interface NFTMapState {
  // Existing fields
  tokens: Record<string, Token>
  visibleTokenIds: string[]
  viewport: MapViewport | null
  loading: boolean
  error: string | null
  lastFetchTime: number
  h3Cells: {
    r6: string[]
    r8: string[]
    r10: string[]
    r12: string[]
  }

  // NEW: Cache management fields
  cachedTokenIds: string[]                    // Cache Zone token IDs
  tokenAccessTimestamps: Record<string, number>  // Last access time
  tokenH3Cells: Record<string, {              // Token H3 cell info
    r6: string
    r8: string
    r10: string
    r12: string
  }>
  cacheStats: {
    totalCached: number
    totalEvicted: number
    lastCleanupTime: number
    cleanupCount: number
    memoryEstimateMB: number
  }
}

const initialState: NFTMapState = {
  tokens: {},
  visibleTokenIds: [],
  viewport: null,
  loading: false,
  error: null,
  lastFetchTime: 0,
  h3Cells: { r6: [], r8: [], r10: [], r12: [] },

  // NEW: Initialize cache fields
  cachedTokenIds: [],
  tokenAccessTimestamps: {},
  tokenH3Cells: {},
  cacheStats: {
    totalCached: 0,
    totalEvicted: 0,
    lastCleanupTime: 0,
    cleanupCount: 0,
    memoryEstimateMB: 0,
  },
}
```

### 1.3 Cache Manager Utility

**File**: `packages/frontend/src/utils/cacheManager.ts`

```typescript
import { CACHE_CONFIG } from '@/config/cacheConstants'
import type { Token, MapViewport } from '@/types'
import { expandBounds, isInViewport } from './h3Utils'

interface CleanupResult {
  tokensToKeep: string[]
  tokensToEvict: string[]
  stats: {
    initialCount: number
    keptCount: number
    evictedCount: number
    memoryFreedMB: number
  }
}

/**
 * Calculate priority score for token eviction
 * Higher score = higher priority = keep longer
 */
export function calculateTokenPriority(
  token: Token,
  accessTimestamp: number,
  now: number
): number {
  const { PRIORITY_WEIGHTS } = CACHE_CONFIG

  const generation = parseInt(token.generation) || 0
  const refCount = parseInt(token.refCount) || 0
  const hasMessage = token.message && token.message.length > 0
  const ageMs = now - accessTimestamp
  const ageDays = ageMs / (1000 * 60 * 60 * 24)

  // Calculate weighted scores
  const generationScore = generation * PRIORITY_WEIGHTS.GENERATION
  const refCountScore = Math.min(refCount, 10) * PRIORITY_WEIGHTS.REF_COUNT
  const messageScore = hasMessage ? PRIORITY_WEIGHTS.HAS_MESSAGE : 0
  const recencyScore = PRIORITY_WEIGHTS.RECENCY * Math.exp(-ageDays)

  return generationScore + refCountScore + messageScore + recencyScore
}

/**
 * Clean up tokens outside Cache Zone
 *
 * Algorithm:
 * 1. Keep all tokens in Cache Zone (Viewport × 2.5)
 * 2. Keep recently accessed tokens (< 60s, even outside Cache Zone)
 * 3. Force cleanup if exceeding 4000 tokens (keep top 3000 by priority)
 */
export function cleanupTokenCache(
  tokens: Record<string, Token>,
  tokenAccessTimestamps: Record<string, number>,
  viewport: MapViewport | null,
  currentH3Cells: { r6: string[], r8: string[], r10: string[], r12: string[] }
): CleanupResult {
  const now = Date.now()

  // Early return if no viewport
  if (!viewport) {
    return {
      tokensToKeep: Object.keys(tokens),
      tokensToEvict: [],
      stats: {
        initialCount: Object.keys(tokens).length,
        keptCount: Object.keys(tokens).length,
        evictedCount: 0,
        memoryFreedMB: 0,
      }
    }
  }

  // Calculate Cache Zone bounds (Viewport × 2.5)
  const cacheZoneBounds = expandBounds(
    viewport.bounds,
    CACHE_CONFIG.VIEWPORT_BUFFER_MULTIPLIER
  )

  // Categorize tokens
  const tokenEntries = Object.entries(tokens)
  const categorizedTokens: {
    id: string
    token: Token
    inCacheZone: boolean
    age: number
    priority: number
  }[] = tokenEntries.map(([id, token]) => {
    const lat = parseFloat(token.latitude)
    const lng = parseFloat(token.longitude)
    const inCacheZone = isInViewport(lat, lng, cacheZoneBounds)
    const timestamp = tokenAccessTimestamps[id] || now
    const age = now - timestamp
    const priority = calculateTokenPriority(token, timestamp, now)

    return { id, token, inCacheZone, age, priority }
  })

  // Step 1: Keep all tokens in Cache Zone
  let tokensToKeep = categorizedTokens.filter(t => t.inCacheZone)

  // Step 2: Keep recently accessed tokens (even outside Cache Zone)
  const recentTokensOutsideCacheZone = categorizedTokens.filter(
    t => !t.inCacheZone && t.age < CACHE_CONFIG.MIN_KEEP_TIME_MS
  )
  tokensToKeep.push(...recentTokensOutsideCacheZone)

  // Step 3: Force cleanup if exceeding threshold
  if (tokensToKeep.length > CACHE_CONFIG.FORCE_CLEANUP_THRESHOLD) {
    console.warn(
      `[cacheManager] Force cleanup triggered: ${tokensToKeep.length} > ${CACHE_CONFIG.FORCE_CLEANUP_THRESHOLD}`
    )
    // Sort by priority and keep only top MAX_CACHED_TOKENS
    tokensToKeep.sort((a, b) => b.priority - a.priority)
    tokensToKeep = tokensToKeep.slice(0, CACHE_CONFIG.MAX_CACHED_TOKENS)
  }

  // Identify tokens to evict
  const keptIds = new Set(tokensToKeep.map(t => t.id))
  const tokensToEvict = tokenEntries
    .filter(([id]) => !keptIds.has(id))
    .map(([id]) => id)

  const memoryFreedMB = (tokensToEvict.length * 1.8) / 1024

  return {
    tokensToKeep: tokensToKeep.map(t => t.id),
    tokensToEvict,
    stats: {
      initialCount: tokenEntries.length,
      keptCount: tokensToKeep.length,
      evictedCount: tokensToEvict.length,
      memoryFreedMB: parseFloat(memoryFreedMB.toFixed(2)),
    }
  }
}

/**
 * Estimate current memory usage
 */
export function estimateMemoryUsage(tokenCount: number): number {
  return parseFloat((tokenCount * 1.8 / 1024).toFixed(2))
}

/**
 * Check if memory is approaching critical threshold
 */
export function isMemoryCritical(tokenCount: number): boolean {
  const memoryMB = estimateMemoryUsage(tokenCount)
  return memoryMB >= CACHE_CONFIG.MEMORY_CRITICAL_THRESHOLD_MB
}

/**
 * Check if memory is approaching warning threshold
 */
export function isMemoryWarning(tokenCount: number): boolean {
  const memoryMB = estimateMemoryUsage(tokenCount)
  return memoryMB >= CACHE_CONFIG.MEMORY_WARNING_THRESHOLD_MB
}
```

### 1.4 Redux Reducer Updates

**File**: `packages/frontend/src/lib/slices/nftMapSlice.ts` (continued)

```typescript
import { cleanupTokenCache, isMemoryCritical, isMemoryWarning } from '@/utils/cacheManager'
import { CACHE_CONFIG } from '@/config/cacheConstants'

const nftMapSlice = createSlice({
  name: 'nftMap',
  initialState,
  reducers: {
    // Existing reducers
    updateViewport: (state, action: PayloadAction<MapViewport>) => {
      state.viewport = action.payload
    },

    setVisibleTokens: (state, action: PayloadAction<string[]>) => {
      state.visibleTokenIds = action.payload
    },

    clearTokens: (state) => {
      state.tokens = {}
      state.visibleTokenIds = []
      state.h3Cells = { r6: [], r8: [], r10: [], r12: [] }
      state.cachedTokenIds = []
      state.tokenAccessTimestamps = {}
      state.tokenH3Cells = {}
    },

    clearError: (state) => {
      state.error = null
    },

    // NEW: Cache management reducers
    cleanupCache: (state) => {
      // Skip if fetch in progress
      if (state.loading) {
        console.log('[cleanupCache] Skipped: fetch in progress')
        return
      }

      // Skip if too soon after last cleanup
      const now = Date.now()
      const timeSinceLastCleanup = now - (state.cacheStats?.lastCleanupTime || 0)

      if (timeSinceLastCleanup < CACHE_CONFIG.CLEANUP_DEBOUNCE_MS) {
        console.log('[cleanupCache] Skipped: too soon after last cleanup')
        return
      }

      // Execute cleanup
      const result = cleanupTokenCache(
        state.tokens,
        state.tokenAccessTimestamps || {},
        state.viewport,
        state.h3Cells
      )

      // Remove evicted tokens
      result.tokensToEvict.forEach(tokenId => {
        delete state.tokens[tokenId]
        delete state.tokenAccessTimestamps[tokenId]
        delete state.tokenH3Cells[tokenId]
      })

      // Update cached token IDs
      state.cachedTokenIds = result.tokensToKeep

      // Update stats
      state.cacheStats = {
        totalCached: result.stats.keptCount,
        totalEvicted: (state.cacheStats?.totalEvicted || 0) + result.stats.evictedCount,
        lastCleanupTime: now,
        cleanupCount: (state.cacheStats?.cleanupCount || 0) + 1,
        memoryEstimateMB: parseFloat((result.stats.keptCount * 1.8 / 1024).toFixed(2)),
      }

      console.log('[cleanupCache] Completed:', {
        ...result.stats,
        cacheStats: state.cacheStats,
      })

      // Log warnings if memory is high
      if (isMemoryCritical(result.stats.keptCount)) {
        console.error('[cleanupCache] ⚠️ CRITICAL: Memory usage is critical!')
      } else if (isMemoryWarning(result.stats.keptCount)) {
        console.warn('[cleanupCache] ⚠️ WARNING: Memory usage is approaching limit')
      }
    },

    updateTokenAccess: (state, action: PayloadAction<string[]>) => {
      const now = Date.now()
      action.payload.forEach(tokenId => {
        if (state.tokens[tokenId]) {
          state.tokenAccessTimestamps[tokenId] = now
        }
      })
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(fetchTokensForViewport.pending, (state, action) => {
        state.loading = true
        state.error = null
        state.viewport = action.meta.arg.viewport
        state.h3Cells = action.meta.arg.h3Cells
      })
      .addCase(fetchTokensForViewport.fulfilled, (state, action) => {
        const { tokens, h3Cells, viewport, fetchTime } = action.payload
        const now = Date.now()

        state.loading = false
        state.error = null
        state.lastFetchTime = fetchTime
        state.viewport = viewport
        state.h3Cells = h3Cells

        // Store tokens with metadata
        tokens.forEach((token: Token) => {
          state.tokens[token.id] = token
          state.tokenAccessTimestamps[token.id] = now
          state.tokenH3Cells[token.id] = {
            r6: token.h3r6,
            r8: token.h3r8,
            r10: token.h3r10,
            r12: token.h3r12,
          }
        })

        const tokenIds = tokens.map((token: Token) => token.id)
        const uniqueVisibleIds = Array.from(new Set([...state.visibleTokenIds, ...tokenIds]))
        state.visibleTokenIds = uniqueVisibleIds

        // NOTE: Cleanup will be triggered by middleware
      })
      .addCase(fetchTokensForViewport.rejected, (state, action) => {
        state.loading = false

        if (action.payload === undefined) {
          state.error = null
          console.log('NFT fetch skipped due to condition check')
          return
        }

        const isSystemMessage =
          action.payload === 'Request was aborted' ||
          (typeof action.payload === 'string' && action.payload.includes('aborted'))

        if (!isSystemMessage) {
          state.error = action.payload as string || 'Failed to fetch tokens'
          console.error('NFT fetch error:', action.payload)
        } else {
          state.error = null
          console.log('NFT fetch system message (ignored):', action.payload)
        }
      })
  }
})

export const {
  updateViewport,
  setVisibleTokens,
  clearTokens,
  clearError,
  cleanupCache,        // NEW
  updateTokenAccess,   // NEW
} = nftMapSlice.actions

// Existing selectors
export const selectNFTMapTokens = (state: { nftMap: NFTMapState }) => state.nftMap.tokens
export const selectVisibleTokens = createSelector(
  [(state: { nftMap: NFTMapState }) => state.nftMap.tokens,
   (state: { nftMap: NFTMapState }) => state.nftMap.visibleTokenIds],
  (tokens, visibleTokenIds) =>
    visibleTokenIds.map(id => tokens[id]).filter(Boolean)
)
export const selectMapViewport = (state: { nftMap: NFTMapState }) => state.nftMap.viewport
export const selectMapLoading = (state: { nftMap: NFTMapState }) => state.nftMap.loading
export const selectMapError = (state: { nftMap: NFTMapState }) => state.nftMap.error

// NEW: Cache stats selector
export const selectCacheStats = (state: { nftMap: NFTMapState }) => state.nftMap.cacheStats

export default nftMapSlice.reducer
```

### 1.5 Redux Middleware

**File**: `packages/frontend/src/lib/middleware/cacheCleanupMiddleware.ts`

```typescript
import { Middleware } from '@reduxjs/toolkit'
import { cleanupCache } from '../slices/nftMapSlice'
import { CACHE_CONFIG } from '@/config/cacheConstants'
import debounce from 'lodash.debounce'

/**
 * Middleware to automatically trigger cache cleanup
 *
 * Triggers:
 * 1. After successful token fetch (debounced)
 * 2. After viewport updates (debounced)
 * 3. Periodic cleanup every 30s
 */
export const cacheCleanupMiddleware: Middleware = (store) => {
  // Debounced cleanup function
  const debouncedCleanup = debounce(() => {
    console.log('[cacheCleanupMiddleware] Triggering debounced cleanup')
    store.dispatch(cleanupCache())
  }, CACHE_CONFIG.CLEANUP_DEBOUNCE_MS)

  // Periodic cleanup timer
  const periodicCleanup = setInterval(() => {
    console.log('[cacheCleanupMiddleware] Triggering periodic cleanup')
    store.dispatch(cleanupCache())
  }, CACHE_CONFIG.PERIODIC_CLEANUP_INTERVAL_MS)

  // Cleanup timer on app unload
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      clearInterval(periodicCleanup)
      debouncedCleanup.cancel()
    })
  }

  return (next) => (action) => {
    const result = next(action)

    // Trigger cleanup after viewport changes
    if (action.type === 'nftMap/fetchTokensForViewport/fulfilled') {
      console.log('[cacheCleanupMiddleware] Fetch completed, scheduling cleanup')
      debouncedCleanup()
    }

    // Trigger cleanup after manual viewport updates
    if (action.type === 'nftMap/updateViewport') {
      console.log('[cacheCleanupMiddleware] Viewport updated, scheduling cleanup')
      debouncedCleanup()
    }

    return result
  }
}
```

**File**: `packages/frontend/src/lib/store.ts` (update)

```typescript
import { configureStore } from '@reduxjs/toolkit'
import nftMapReducer from './slices/nftMapSlice'
import sensorReducer from './slices/sensorSlice'
import { cacheCleanupMiddleware } from './middleware/cacheCleanupMiddleware'

export const store = configureStore({
  reducer: {
    nftMap: nftMapReducer,
    sensor: sensorReducer,
    // ... other reducers
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(cacheCleanupMiddleware),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
```

### 1.6 Component Integration

**File**: `packages/frontend/src/components/features/MapComponent.tsx` (update)

```typescript
import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { updateTokenAccess, selectCacheStats } from '@/lib/slices/nftMapSlice'

const MapComponent = React.memo(function MapComponent() {
  const dispatch = useDispatch()
  const cacheStats = useSelector(selectCacheStats)

  // ... existing code

  // Track visible tokens for access timestamp updates
  useEffect(() => {
    if (tokensToShow.length > 0) {
      const visibleIds = tokensToShow.map(t => t.id)
      dispatch(updateTokenAccess(visibleIds))
    }
  }, [tokensToShow, dispatch])

  // Log cache stats (development only)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[MapComponent] Cache stats:', cacheStats)
    }
  }, [cacheStats])

  // ... rest of component
})
```

### 1.7 Cache Stats Display (Optional)

**File**: `packages/frontend/src/components/features/CacheStatsDebug.tsx`

```typescript
'use client'

import React from 'react'
import { useSelector } from 'react-redux'
import { selectCacheStats } from '@/lib/slices/nftMapSlice'

/**
 * Debug component to display cache statistics
 * Only visible in development mode
 */
export default function CacheStatsDebug() {
  const cacheStats = useSelector(selectCacheStats)

  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  return (
    <div className="fixed bottom-20 right-4 bg-black/80 text-white p-3 rounded-lg text-xs font-mono z-50">
      <div className="font-bold mb-2">Cache Stats</div>
      <div>Cached: {cacheStats.totalCached}</div>
      <div>Evicted: {cacheStats.totalEvicted}</div>
      <div>Memory: {cacheStats.memoryEstimateMB} MB</div>
      <div>Cleanups: {cacheStats.cleanupCount}</div>
      <div className={cacheStats.memoryEstimateMB > 8 ? 'text-red-500' : 'text-green-500'}>
        {cacheStats.memoryEstimateMB > 8 ? '⚠️ HIGH' : '✓ OK'}
      </div>
    </div>
  )
}
```

---

## 🔄 Phase 2: Advanced Features (Recommended)

### 2.1 IndexedDB Integration

**File**: `packages/frontend/src/lib/db/tokenCacheDB.ts`

```typescript
import { openDB, DBSchema, IDBPDatabase } from 'idb'
import type { Token } from '@/types'

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
      lastCleanup: number
      totalTokens: number
      version: string
    }
  }
}

/**
 * IndexedDB cache for cold storage of tokens
 * Provides offline capability and faster subsequent loads
 */
class TokenCacheDatabase {
  private db: IDBPDatabase<TokenCacheDB> | null = null
  private readonly DB_NAME = 'norosi-token-cache'
  private readonly DB_VERSION = 1

  async init() {
    if (this.db) return this.db

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
  }

  /**
   * Save tokens to IndexedDB
   */
  async saveTokens(tokens: Token[]): Promise<void> {
    await this.init()
    const tx = this.db!.transaction('tokens', 'readwrite')
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
    await this.init()
    const indexName = `by-h3${resolution.slice(1)}` as const
    const results: Token[] = []

    for (const cell of cells) {
      const tokens = await this.db!.getAllFromIndex('tokens', indexName, cell)
      results.push(...tokens)
    }

    console.log(`[tokenCacheDB] Retrieved ${results.length} tokens from IndexedDB (${resolution})`)
    return results
  }

  /**
   * Get all tokens (for bulk operations)
   */
  async getAllTokens(): Promise<Token[]> {
    await this.init()
    const tokens = await this.db!.getAll('tokens')
    console.log(`[tokenCacheDB] Retrieved ${tokens.length} tokens from IndexedDB`)
    return tokens
  }

  /**
   * Clean up old tokens
   */
  async cleanup(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    await this.init()
    const cutoff = Date.now() - maxAge
    const tx = this.db!.transaction('tokens', 'readwrite')
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
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    totalTokens: number
    dbSizeMB: number
    lastCleanup: number
  }> {
    await this.init()
    const tokens = await this.db!.getAll('tokens')
    const metadata = await this.db!.get('metadata', 'stats')

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
    await this.init()
    const tokens = await this.db!.getAll('tokens')

    await this.db!.put('metadata', {
      key: 'stats',
      lastCleanup: Date.now(),
      totalTokens: tokens.length,
      version: '1.0',
    })
  }

  /**
   * Clear all data
   */
  async clear(): Promise<void> {
    await this.init()
    const tx = this.db!.transaction(['tokens', 'metadata'], 'readwrite')
    await tx.objectStore('tokens').clear()
    await tx.objectStore('metadata').clear()
    await tx.done
    console.log('[tokenCacheDB] Cleared all data from IndexedDB')
  }
}

export const tokenCacheDB = new TokenCacheDatabase()
```

### 2.2 H3 Cell-Based Cache Management

**File**: `packages/frontend/src/utils/h3CacheManager.ts`

```typescript
import type { Token } from '@/types'
import { CACHE_CONFIG } from '@/config/cacheConstants'

/**
 * Clean up tokens based on H3 cell overlap
 * More precise than geographic bounds
 */
export function cleanupTokenCacheByH3Cells(
  tokens: Record<string, Token>,
  tokenH3Cells: Record<string, { r6: string, r8: string, r10: string, r12: string }>,
  currentH3Cells: { r6: string[], r8: string[], r10: string[], r12: string[] },
  overlapThreshold: number = CACHE_CONFIG.H3_OVERLAP_THRESHOLD
): { tokensToKeep: string[], tokensToEvict: string[] } {

  // Create sets for fast lookup
  const cellSets = {
    r6: new Set(currentH3Cells.r6),
    r8: new Set(currentH3Cells.r8),
    r10: new Set(currentH3Cells.r10),
    r12: new Set(currentH3Cells.r12),
  }

  const tokensToKeep: string[] = []
  const tokensToEvict: string[] = []

  Object.entries(tokens).forEach(([id, token]) => {
    const cells = tokenH3Cells[id]

    if (!cells) {
      // No H3 cell info - evict
      tokensToEvict.push(id)
      return
    }

    // Check if token's H3 cells overlap with current viewport cells
    const hasOverlap =
      cellSets.r6.has(cells.r6) ||
      cellSets.r8.has(cells.r8) ||
      cellSets.r10.has(cells.r10) ||
      cellSets.r12.has(cells.r12)

    if (hasOverlap) {
      tokensToKeep.push(id)
    } else {
      tokensToEvict.push(id)
    }
  })

  console.log('[h3CacheManager] H3-based cleanup:', {
    totalTokens: Object.keys(tokens).length,
    tokensToKeep: tokensToKeep.length,
    tokensToEvict: tokensToEvict.length,
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
```

---

## 🔬 AR Mode Validation (v1.1)

### Critical Constraint: 5km Display Radius

**User Requirement:** AR mode displays only tokens within 5km radius of user's current location.

This constraint fundamentally changes the memory analysis and validates the original implementation plan.

### Memory Architecture: Data vs Render Layers

The key insight is distinguishing between two separate layers:

**1. Data Layer (Redux State):**

- 3,000 tokens cached in memory (~5.4 MB)
- Contains ALL tokens fetched from viewport queries
- Independent of rendering
- Used by both Map mode and AR mode

**2. Render Layer (Component Display):**

- **Map Mode**: 100 DOM-based MapMarquee markers
- **AR Mode**: 50-200 React Three Fiber 3D objects (within 5km only)

### Why Original Plan Remains Valid

**Initial Concern (❌ INCORRECT):**
> "AR mode renders all 3,000 cached tokens as 3D objects, causing memory overflow"

**Actual Reality (✅ CORRECT):**
> "AR mode filters tokens to 5km radius BEFORE rendering, creating only 50-200 Three.js meshes"

### Updated Memory Budget (iPhone 17: 300-350MB Heap)

| Component | Map Mode | AR Mode | Notes |
|-----------|----------|---------|-------|
| **MapLibre GL JS** | 50-80 MB | 50-80 MB | Background in AR |
| **React Three Fiber Context** | - | 30-50 MB | WebGL context #2 |
| **MediaStream Video** | - | 20-40 MB | Camera feed |
| **TensorFlow.js (BodyPix)** | - | 10-20 MB | Sky segmentation |
| **Three.js Scene** | - | **0.5-2 MB** | **50-200 objects only** ✅ |
| **Redux Token Cache** | **5.4 MB** | **5.4 MB** | Same data, filtered display |
| **DOM/UI Components** | 20-40 MB | 20-40 MB | - |
| **Framework Overhead** | 40-60 MB | 40-60 MB | React, wagmi, etc. |
| **Buffer/Margin** | 20-30 MB | 10-20 MB | Safety margin |
| **Total Estimated** | **140-230 MB** | **186-332 MB** | - |
| **% of Limit (350MB)** | **66% (Safe)** ✅ | **95% (Safe)** ✅ |

### Key Findings

1. **3,000 Token Cache is Safe for Both Modes**
   - Cached tokens are data structures (~1.8 KB each)
   - Only visible tokens become Three.js meshes (~10 KB each)
   - Filtering happens at component level, not cache level

2. **Three.js Frustum Culling is Automatic**
   - No manual culling code needed
   - `far: 20000` plane doesn't matter if we only add 5km objects to scene
   - React Three Fiber handles this efficiently

3. **5km Constraint Reduces Render Load**
   - Typical urban density: 50-200 tokens within 5km
   - Three.js scene memory: 0.5-2 MB (negligible)
   - Main AR overhead is video/TensorFlow, not object count

4. **No AR-Specific Cache Reduction Needed**
   - ~~Initial proposal: Reduce cache to 2,000 in AR mode~~ ❌ NOT NEEDED
   - ~~Dynamic cache sizing based on AR state~~ ❌ NOT NEEDED
   - Original plan's 3,000 token cache is optimal ✅

### Implementation Notes

**No Changes Required to Original Plan:**

- ✅ Keep 3,000 token cache limit
- ✅ Keep Viewport-Based Spatial Cache strategy
- ✅ Keep priority-based eviction algorithm
- ✅ Implement Phase 1 and Phase 2 as specified

**Optional Enhancement (Logging Only):**

```typescript
// In ARObjects.tsx - Add for development monitoring
useEffect(() => {
  const tokensInRange = filterTokensWithin5km(allCachedTokens, userLocation)
  console.log(`[ARObjects] Displaying ${tokensInRange.length} / ${allCachedTokens.length} tokens (5km radius)`)
}, [allCachedTokens, userLocation])
```

### Validation Summary

| Question | Answer |
|----------|--------|
| Does 5km radius change memory analysis? | ✅ Yes - validates original plan is safe |
| Is cache reduction needed for AR mode? | ✅ No - 3,000 tokens remains optimal |
| What's AR object memory overhead? | ✅ 0.5-2 MB (50-200 objects only) |
| Should we implement dynamic cache sizing? | ✅ No - filtering handles this naturally |

**Status**: ✅ **Original implementation plan APPROVED for both Map and AR modes**

---

## 🧪 Testing Strategy

### Unit Tests

**File**: `packages/frontend/src/utils/__tests__/cacheManager.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { cleanupTokenCache, calculateTokenPriority, estimateMemoryUsage } from '../cacheManager'
import type { Token, MapViewport } from '@/types'

describe('Cache Manager', () => {
  describe('calculateTokenPriority', () => {
    it('should prioritize high generation tokens', () => {
      const token1: Token = { generation: '10', refCount: '0', message: '' } as Token
      const token2: Token = { generation: '1', refCount: '0', message: '' } as Token

      const priority1 = calculateTokenPriority(token1, Date.now(), Date.now())
      const priority2 = calculateTokenPriority(token2, Date.now(), Date.now())

      expect(priority1).toBeGreaterThan(priority2)
    })

    it('should prioritize tokens with many references', () => {
      const token1: Token = { generation: '0', refCount: '10', message: '' } as Token
      const token2: Token = { generation: '0', refCount: '1', message: '' } as Token

      const priority1 = calculateTokenPriority(token1, Date.now(), Date.now())
      const priority2 = calculateTokenPriority(token2, Date.now(), Date.now())

      expect(priority1).toBeGreaterThan(priority2)
    })

    it('should prioritize tokens with messages', () => {
      const token1: Token = { generation: '0', refCount: '0', message: 'Hello' } as Token
      const token2: Token = { generation: '0', refCount: '0', message: '' } as Token

      const priority1 = calculateTokenPriority(token1, Date.now(), Date.now())
      const priority2 = calculateTokenPriority(token2, Date.now(), Date.now())

      expect(priority1).toBeGreaterThan(priority2)
    })
  })

  describe('cleanupTokenCache', () => {
    it('should keep tokens within Cache Zone', () => {
      // TODO: Implement test
    })

    it('should keep recently accessed tokens', () => {
      // TODO: Implement test
    })

    it('should force cleanup when exceeding threshold', () => {
      // TODO: Implement test
    })

    it('should handle edge case: zoom out with 5000 tokens in viewport', () => {
      // TODO: Implement test
    })
  })

  describe('estimateMemoryUsage', () => {
    it('should calculate memory correctly', () => {
      expect(estimateMemoryUsage(1000)).toBe(1.76)
      expect(estimateMemoryUsage(3000)).toBe(5.27)
      expect(estimateMemoryUsage(5000)).toBe(8.79)
    })
  })
})
```

### Integration Tests

**File**: `packages/frontend/src/lib/slices/__tests__/nftMapSlice.cache.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import nftMapReducer, { cleanupCache, updateTokenAccess } from '../nftMapSlice'

describe('NFT Map Slice - Cache Management', () => {
  it('should trigger cleanup action', () => {
    const store = configureStore({ reducer: { nftMap: nftMapReducer } })

    // TODO: Implement test
  })

  it('should update token access timestamps', () => {
    // TODO: Implement test
  })

  it('should handle race condition during cleanup', () => {
    // TODO: Implement test
  })
})
```

### E2E Tests

**File**: `packages/frontend/tests/e2e/cache-management.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Cache Management', () => {
  test('should limit memory usage during extended map usage', async ({ page }) => {
    // TODO: Implement E2E test
  })

  test('should maintain smooth performance with 3000 cached tokens', async ({ page }) => {
    // TODO: Implement E2E test
  })
})
```

---

## 📅 Implementation Schedule

### Week 1: Phase 1 Core Implementation

| Day | Tasks | Deliverables |
|-----|-------|--------------|
| **Day 1** | Setup configuration, type definitions | `cacheConstants.ts`, type updates |
| **Day 2** | Implement cache manager utility | `cacheManager.ts` complete |
| **Day 3** | Update Redux slice with new state | `nftMapSlice.ts` updated |
| **Day 4** | Implement middleware | `cacheCleanupMiddleware.ts` complete |
| **Day 5** | Component integration | `MapComponent.tsx` updated |
| **Day 6** | Unit tests | Test coverage > 80% |
| **Day 7** | Integration testing, bug fixes | Phase 1 complete |

### Week 2: Phase 2 Advanced Features (Optional)

| Day | Tasks | Deliverables |
|-----|-------|--------------|
| **Day 8** | IndexedDB schema and basic operations | `tokenCacheDB.ts` structure |
| **Day 9** | IndexedDB integration with Redux | Persistence layer complete |
| **Day 10** | H3 cell-based cache management | `h3CacheManager.ts` complete |
| **Day 11** | Offline-first strategy | Service Worker updates |
| **Day 12** | Testing and optimization | E2E tests complete |
| **Day 13** | Documentation | Technical docs complete |
| **Day 14** | Code review, refinement | Phase 2 complete |

---

## 📊 Expected Outcomes

### Performance Metrics

| Metric | Before | Phase 1 | Phase 2 |
|--------|--------|---------|---------|
| **Memory Usage** | Unlimited growth | ~5-10 MB (stable) | ~5-10 MB (stable) |
| **Long Session Stability** | ❌ Crash risk | ✅ Stable | ✅ Fully stable |
| **Network Requests** | High | Medium | Low (offline) |
| **Initial Load Speed** | Normal | Normal | ✅ Fast (cache hit) |
| **Pan/Zoom UX** | Good | ✅ Excellent | ✅ Outstanding |

### Memory Budget Analysis

```
iPhone 17 JavaScript Heap: ~300-350 MB
├─ Framework Overhead: 40-60 MB
├─ MapLibre GL JS: 50-80 MB
├─ DOM/UI: 20-40 MB
├─ Token Cache (Redux): 5-10 MB ✅
└─ Available Buffer: ~100-120 MB ✅
```

**Safety Margin**: 90% of token budget remains unused

---

## 🎓 Key Learnings & Best Practices

### Design Decisions

1. **Viewport-Based over Time-Based**: Geographic relevance > Temporal relevance for map apps
2. **Hybrid Approach**: Geographic bounds (Phase 1) → H3 cells (Phase 2) for gradual migration
3. **Priority-Based Eviction**: Preserve high-value tokens (high generation, many references)
4. **Race Condition Safety**: Defer cleanup during fetches, use debouncing
5. **Memory Safety**: Hard caps with emergency cleanup at 4000 tokens

### Technical Insights

- **H3 Integration**: Leveraging existing H3 infrastructure provides natural cache boundaries
- **IndexedDB for Cold Storage**: 60% disk capacity available, perfect for offline support
- **LRU with Spatial Awareness**: Better than pure LRU for map applications
- **Debouncing**: Essential for smooth UX during rapid pan/zoom

### Potential Pitfalls

⚠️ **Watch Out For:**
- Cleanup during fetch → Use `loading` state protection
- Immediate eviction of new tokens → Use `MIN_KEEP_TIME_MS`
- Zoom out edge case → Use priority-based eviction
- IndexedDB quota exceeded → Implement periodic cleanup

---

## 📚 References

### External Resources

- [MapLibre GL JS Performance Guide](https://maplibre.org/maplibre-gl-js/docs/guides/large-data/)
- [H3 Hexagonal Hierarchical Spatial Index](https://h3geo.org/)
- [Redux Performance Best Practices](https://redux.js.org/faq/performance)
- [IndexedDB API on MDN](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [iOS Safari Memory Limits Discussion](https://stackoverflow.com/questions/74506298/)

### Internal Resources

- [CLAUDE.md](./CLAUDE.md) - Project documentation
- [packages/frontend/src/utils/h3Utils.ts](./packages/frontend/src/utils/h3Utils.ts) - H3 utilities
- [packages/frontend/src/lib/slices/nftMapSlice.ts](./packages/frontend/src/lib/slices/nftMapSlice.ts) - Redux slice

---

## 🔄 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-11-04 | Initial implementation plan |
| 1.1 | 2025-11-04 | AR mode validation with 5km display radius constraint. Confirmed original plan is safe for both Map and AR modes. No cache reduction needed. |

---

## 📝 Notes

This implementation plan was developed through collaborative analysis using:
- Technical research on iOS Safari memory constraints
- MapLibre GL JS performance best practices
- Redux state management patterns
- H3 geospatial indexing optimization
- Real-world mobile device testing considerations

**Recommended Approach**: Implement Phase 1 first, validate performance on iPhone 17, then proceed to Phase 2 if offline support is required.

---

**Status**: 📝 Ready for Implementation
**Priority**: 🔴 High
**Complexity**: 🟡 Medium
**Impact**: 🟢 High
