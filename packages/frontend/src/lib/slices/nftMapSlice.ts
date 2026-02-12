import { createSlice, createAsyncThunk, PayloadAction, createSelector } from '@reduxjs/toolkit'
import { Token } from '@/types/index'
import type { ProcessedToken } from '@/types/mapTypes'
import { processTokenData } from '@/utils/mapDataTransform'
import { cleanupTokenCache, isMemoryCritical, isMemoryWarning } from '@/utils/cacheManager'
import { cleanupTokenCacheByH3Cells } from '@/utils/h3CacheManager'
import { tokenCacheDB } from '@/lib/db/tokenCacheDB'
import { CACHE_CONFIG } from '@/config/cacheConstants'

export interface MapViewport {
  bounds: [number, number, number, number] // [west, south, east, north]
  zoom: number
  center: [number, number] // [lng, lat]
}

export interface NFTMapState {
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

  // Cache management fields
  cachedTokenIds: string[]
  tokenAccessTimestamps: Record<string, number>
  tokenH3Cells: Record<string, {
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

  // UI state for selected token (NFT detail panel)
  selectedTokenId: string | null

  // Tree highlight state
  selectedTreeId: string | null
  selectedTreeTokenIds: string[]
  treeTokensLoading: boolean
}

const initialState: NFTMapState = {
  tokens: {},
  visibleTokenIds: [],
  viewport: null,
  loading: false,
  error: null,
  lastFetchTime: 0,
  h3Cells: {
    r6: [],
    r8: [],
    r10: [],
    r12: []
  },

  // Cache management initial state
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

  // UI state for selected token (NFT detail panel)
  selectedTokenId: null,

  // Tree highlight state
  selectedTreeId: null,
  selectedTreeTokenIds: [],
  treeTokensLoading: false,
}

interface FetchTokensParams {
  h3Cells: {
    r6: string[]
    r8: string[]
    r10: string[]
    r12: string[]
  }
  viewport: MapViewport
}

/**
 * Load tokens from IndexedDB for offline-first loading
 * This is called before fetching from network to provide instant feedback
 */
export const loadTokensFromIndexedDB = createAsyncThunk(
  'nftMap/loadTokensFromIndexedDB',
  async (
    { h3Cells }: { h3Cells: { r6: string[], r8: string[], r10: string[], r12: string[] } },
    { rejectWithValue }
  ) => {
    try {
      // Try to load from IndexedDB using H3 cells
      const tokens = await tokenCacheDB.getTokensByH3Cells(
        [...h3Cells.r6, ...h3Cells.r8, ...h3Cells.r10, ...h3Cells.r12],
        'r8' // Use r8 as default resolution for balance
      )

      console.log(`[loadTokensFromIndexedDB] Loaded ${tokens.length} tokens from IndexedDB`)

      return { tokens }
    } catch (error) {
      console.error('Error loading tokens from IndexedDB:', error)
      return rejectWithValue((error as Error).message || 'Failed to load from IndexedDB')
    }
  }
)

/**
 * Clean up old tokens from IndexedDB
 */
export const cleanupIndexedDB = createAsyncThunk(
  'nftMap/cleanupIndexedDB',
  async (_, { rejectWithValue }) => {
    try {
      const deletedCount = await tokenCacheDB.cleanup() // Default: 7 days
      console.log(`[cleanupIndexedDB] Cleaned up ${deletedCount} old tokens`)

      return { deletedCount }
    } catch (error) {
      console.error('Error cleaning up IndexedDB:', error)
      return rejectWithValue((error as Error).message || 'Failed to cleanup IndexedDB')
    }
  }
)

export const fetchTokensForViewport = createAsyncThunk(
  'nftMap/fetchTokensForViewport',
  async (
    { h3Cells, viewport }: FetchTokensParams,
    { signal, rejectWithValue }
  ) => {
    try {
      const currentTime = Date.now()

      // Validate H3 cells are not empty before querying
      const hasValidCells = h3Cells.r6.length > 0 || h3Cells.r8.length > 0 || h3Cells.r10.length > 0 || h3Cells.r12.length > 0;
      if (!hasValidCells) {
        console.warn('No H3 cells generated for viewport - skipping fetch');
        return { tokens: [], h3Cells, viewport, fetchTime: currentTime };
      }

      const { queryWithFallback, isUsingFallback } = await import('@/lib/graphql/queryWithFallback')
      const { getH3QueryForZoom } = await import('@/lib/graphql/queries')

      // Get zoom-adaptive query configuration
      const queryConfig = getH3QueryForZoom(viewport.zoom)
      const variables = queryConfig.getVariables(h3Cells)

      // Calculate total cells being sent
      const totalCells = h3Cells.r6.length + h3Cells.r8.length + h3Cells.r10.length + h3Cells.r12.length

      // Enhanced logging: show zoom-adaptive query selection
      console.log('[nftMapSlice] 🔍 Zoom-adaptive query:', {
        zoom: viewport.zoom,
        queryType: viewport.zoom < 10 ? 'LOW_ZOOM' : viewport.zoom < 14 ? 'MEDIUM_ZOOM' : 'HIGH_ZOOM',
        resolutions: queryConfig.resolutionAliases,
        cellCounts: {
          r6: h3Cells.r6.length,
          r8: h3Cells.r8.length,
          r10: h3Cells.r10.length,
          r12: h3Cells.r12.length,
          total: totalCells
        },
        usingFallback: isUsingFallback()
      })

      const { data: resultData, fromFallback } = await queryWithFallback({
        query: queryConfig.query,
        variables,
        fetchPolicy: 'network-only', // Always fetch fresh data for viewport queries
        context: { signal }
      })

      // Log if using fallback data
      if (fromFallback) {
        console.log('[nftMapSlice] 📦 Using fallback data (Subgraph unavailable)')
      }

      const result = { data: resultData }

      // Debug logging
      console.log('GraphQL query result:', {
        hasData: !!result.data,
        dataKeys: result.data ? Object.keys(result.data) : [],
        fromFallback
      })

      // Handle undefined or null data (e.g., when Subgraph is not deployed or has no tokens)
      if (!result.data) {
        console.warn('GraphQL query returned no data - Subgraph may not be deployed or has no indexed tokens yet')
        return {
          tokens: [],
          h3Cells,
          viewport,
          fetchTime: currentTime
        }
      }

      // Collect tokens from all returned resolution aliases
      const data = result.data as Record<string, Token[] | undefined>
      const allTokens: Token[] = []

      for (const alias of queryConfig.resolutionAliases) {
        const tokens = data[alias]
        if (tokens && Array.isArray(tokens)) {
          allTokens.push(...tokens)
        }
      }

      // Log token counts per resolution
      const tokenCounts: Record<string, number> = {}
      for (const alias of queryConfig.resolutionAliases) {
        tokenCounts[alias] = data[alias]?.length || 0
      }

      console.log('Token fetch result:', {
        ...tokenCounts,
        totalTokens: allTokens.length
      })

      const uniqueTokens = allTokens.reduce((acc, token) => {
        if (!acc[token.id]) {
          acc[token.id] = token
        }
        return acc
      }, {} as Record<string, Token>)

      return {
        tokens: Object.values(uniqueTokens),
        h3Cells,
        viewport,
        fetchTime: currentTime
      }
    } catch (error) {
      if (signal?.aborted) {
        return rejectWithValue('Request was aborted')
      }
      console.error('Error fetching tokens for viewport:', error)
      return rejectWithValue((error as Error).message || 'Failed to fetch tokens')
    }
  },
  {
    condition: ({ h3Cells }, { getState }) => {
      try {
        const { nftMap } = getState() as { nftMap: NFTMapState }
        const currentTime = Date.now()

        console.log('[nftMapSlice] Condition check started', {
          loading: nftMap.loading,
          lastFetchTime: nftMap.lastFetchTime,
          currentH3Cells: {
            r6: nftMap.h3Cells.r6.length,
            r8: nftMap.h3Cells.r8.length,
            r10: nftMap.h3Cells.r10.length,
            r12: nftMap.h3Cells.r12.length,
          },
          newH3Cells: {
            r6: h3Cells.r6.length,
            r8: h3Cells.r8.length,
            r10: h3Cells.r10.length,
            r12: h3Cells.r12.length,
          }
        })

        // STEP 1: Check if H3 cells have changed (different geographic area)
        // IMPORTANT: Create copies before sorting to avoid mutating Redux state
        const hasNewCells =
          JSON.stringify([...h3Cells.r6].sort()) !== JSON.stringify([...nftMap.h3Cells.r6].sort()) ||
          JSON.stringify([...h3Cells.r8].sort()) !== JSON.stringify([...nftMap.h3Cells.r8].sort()) ||
          JSON.stringify([...h3Cells.r10].sort()) !== JSON.stringify([...nftMap.h3Cells.r10].sort()) ||
          JSON.stringify([...h3Cells.r12].sort()) !== JSON.stringify([...nftMap.h3Cells.r12].sort())

        console.log('[nftMapSlice] H3 cells comparison:', {
          hasNewCells,
          r6Match: JSON.stringify([...h3Cells.r6].sort()) === JSON.stringify([...nftMap.h3Cells.r6].sort()),
          r8Match: JSON.stringify([...h3Cells.r8].sort()) === JSON.stringify([...nftMap.h3Cells.r8].sort()),
          r10Match: JSON.stringify([...h3Cells.r10].sort()) === JSON.stringify([...nftMap.h3Cells.r10].sort()),
          r12Match: JSON.stringify([...h3Cells.r12].sort()) === JSON.stringify([...nftMap.h3Cells.r12].sort()),
        })

        // If H3 cells haven't changed, skip (same area)
        if (!hasNewCells) {
          console.log('[nftMapSlice] ❌ NFT fetch skipped: no new H3 cells (same area)')
          return false
        }

        // STEP 2: For different area, allow fetch even if loading
        // This will abort the previous fetch via createAsyncThunk's built-in abort
        if (nftMap.loading) {
          console.log('[nftMapSlice] ✅ NFT fetch proceeding: new area detected, will abort previous fetch')
          return true
        }

        // STEP 3: Time-based debounce (only for non-loading state)
        const DEBOUNCE_THRESHOLD = 500
        const timeSinceLastFetch = currentTime - nftMap.lastFetchTime
        if (timeSinceLastFetch < DEBOUNCE_THRESHOLD) {
          console.log(`[nftMapSlice] ❌ NFT fetch debounced: ${timeSinceLastFetch}ms < ${DEBOUNCE_THRESHOLD}ms`)
          return false
        }

        console.log('[nftMapSlice] ✅ NFT fetch proceeding: conditions met')
        return true
      } catch (error) {
        console.error('[nftMapSlice] ❌ Error in condition check:', error)
        return false
      }
    },
    // Explicitly disable condition-based rejections to prevent undefined payload issues
    dispatchConditionRejection: false
  }
)

/**
 * Fetch all tokens in a tree for visual highlighting on map.
 * Merges tree tokens into Redux state so connection lines can be calculated.
 */
export const fetchTreeTokensForSelection = createAsyncThunk(
  'nftMap/fetchTreeTokensForSelection',
  async ({ treeId }: { treeId: string }, { signal }) => {
    const { queryWithFallback } = await import('@/lib/graphql/queryWithFallback')
    const { GET_TREE_TOKENS } = await import('@/lib/graphql/queries')

    const { data } = await queryWithFallback({
      query: GET_TREE_TOKENS,
      variables: { treeId: parseInt(treeId) },
      fetchPolicy: 'cache-first',
      context: { signal },
    })

    const tokens = (data.treeTokens ?? []) as Token[]
    return { tokens, treeId }
  }
)

const nftMapSlice = createSlice({
  name: 'nftMap',
  initialState,
  reducers: {
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

    // Cache management reducers
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

      // Choose cleanup strategy based on configuration
      let tokensToKeep: string[]
      let tokensToEvict: string[]
      let stats: {
        initialCount: number
        keptCount: number
        evictedCount: number
        memoryFreedMB: number
      }

      if (CACHE_CONFIG.USE_H3_CELL_FILTERING) {
        // Phase 2: H3 cell-based cleanup (more precise)
        const h3Result = cleanupTokenCacheByH3Cells(
          state.tokens,
          state.tokenH3Cells || {},
          state.h3Cells,
          state.tokenAccessTimestamps || {}
        )
        tokensToKeep = h3Result.tokensToKeep
        tokensToEvict = h3Result.tokensToEvict

        stats = {
          initialCount: Object.keys(state.tokens).length,
          keptCount: tokensToKeep.length,
          evictedCount: tokensToEvict.length,
          memoryFreedMB: parseFloat((tokensToEvict.length * 1.8 / 1024).toFixed(2)),
        }
      } else {
        // Phase 1: Geographic bounds-based cleanup
        const result = cleanupTokenCache(
          state.tokens,
          state.tokenAccessTimestamps || {},
          state.viewport,
          state.h3Cells
        )
        tokensToKeep = result.tokensToKeep
        tokensToEvict = result.tokensToEvict
        stats = result.stats
      }

      // Remove evicted tokens
      tokensToEvict.forEach(tokenId => {
        delete state.tokens[tokenId]
        delete state.tokenAccessTimestamps[tokenId]
        delete state.tokenH3Cells[tokenId]
      })

      // Update cached token IDs
      state.cachedTokenIds = tokensToKeep

      // Update stats
      state.cacheStats = {
        totalCached: stats.keptCount,
        totalEvicted: (state.cacheStats?.totalEvicted || 0) + stats.evictedCount,
        lastCleanupTime: now,
        cleanupCount: (state.cacheStats?.cleanupCount || 0) + 1,
        memoryEstimateMB: parseFloat((stats.keptCount * 1.8 / 1024).toFixed(2)),
      }

      console.log('[cleanupCache] Completed:', {
        ...stats,
        method: CACHE_CONFIG.USE_H3_CELL_FILTERING ? 'H3-based' : 'Geographic bounds',
        cacheStats: state.cacheStats,
      })

      // Log warnings if memory is high
      if (isMemoryCritical(stats.keptCount)) {
        console.error('[cleanupCache] ⚠️ CRITICAL: Memory usage is critical!')
      } else if (isMemoryWarning(stats.keptCount)) {
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

    /**
     * Insert a newly minted token into the store immediately.
     * This provides instant feedback after minting without waiting for subgraph sync.
     */
    insertMintedToken: (state, action: PayloadAction<Token>) => {
      const token = action.payload
      const now = Date.now()

      // Add token to the store
      state.tokens[token.id] = token

      // Update access tracking
      state.tokenAccessTimestamps[token.id] = now
      state.tokenH3Cells[token.id] = {
        r6: token.h3r6,
        r8: token.h3r8,
        r10: token.h3r10,
        r12: token.h3r12,
      }

      // Add to visible tokens if not already present
      if (!state.visibleTokenIds.includes(token.id)) {
        state.visibleTokenIds.push(token.id)
      }

      // Update cached token IDs
      if (!state.cachedTokenIds.includes(token.id)) {
        state.cachedTokenIds.push(token.id)
      }

      console.log('[nftMapSlice] Inserted minted token:', {
        tokenId: token.id,
        coordinates: { lat: token.latitude, lon: token.longitude },
      })

      // NOTE: Token persistence to IndexedDB is handled by tokenPersistMiddleware
    },

    /**
     * Set the selected token for the NFT detail panel.
     * Pass null to close the panel.
     */
    setSelectedToken: (state, action: PayloadAction<string | null>) => {
      state.selectedTokenId = action.payload
    },

    clearTreeSelection: (state) => {
      state.selectedTreeId = null
      state.selectedTreeTokenIds = []
      state.treeTokensLoading = false
    },

    /**
     * Insert a temporary (non-minted) token into the store.
     * Used for local-only posts when wallet is not connected.
     * NOTE: Does NOT save to IndexedDB - temporary tokens disappear on reload.
     */
    insertTemporaryToken: (state, action: PayloadAction<Token>) => {
      const token = action.payload
      const now = Date.now()

      // Add token to the store
      state.tokens[token.id] = token

      // Update access tracking
      state.tokenAccessTimestamps[token.id] = now
      state.tokenH3Cells[token.id] = {
        r6: token.h3r6,
        r8: token.h3r8,
        r10: token.h3r10,
        r12: token.h3r12,
      }

      // Add to visible tokens if not already present
      if (!state.visibleTokenIds.includes(token.id)) {
        state.visibleTokenIds.push(token.id)
      }

      // NOTE: Do NOT save to IndexedDB - temporary tokens disappear on reload
      // This is intentional: non-connected users get a preview experience
      // but their posts are not persisted

      console.log('[nftMapSlice] Inserted temporary token:', {
        tokenId: token.id,
        coordinates: { lat: token.latitude, lon: token.longitude },
        note: 'Will disappear on page reload',
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

        // NOTE: Token persistence to IndexedDB is handled by tokenPersistMiddleware
        // NOTE: Cleanup will be triggered by cacheCleanupMiddleware
      })
      .addCase(fetchTokensForViewport.rejected, (state, action) => {
        state.loading = false

        // Handle condition-based rejections (payload is undefined)
        if (action.payload === undefined) {
          // This is a condition-based rejection (loading, debounced, or no new cells)
          state.error = null
          console.log('NFT fetch skipped due to condition check')
          return
        }

        // Handle explicit rejections with payload
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
      // IndexedDB loading (offline-first)
      .addCase(loadTokensFromIndexedDB.pending, () => {
        console.log('[loadTokensFromIndexedDB] Loading tokens from IndexedDB...')
      })
      .addCase(loadTokensFromIndexedDB.fulfilled, (state, action) => {
        const { tokens } = action.payload
        const now = Date.now()

        // Load tokens from IndexedDB into Redux state
        tokens.forEach((token: Token) => {
          // Only add if not already present (don't overwrite fresher data)
          if (!state.tokens[token.id]) {
            state.tokens[token.id] = token
            state.tokenAccessTimestamps[token.id] = now
            state.tokenH3Cells[token.id] = {
              r6: token.h3r6,
              r8: token.h3r8,
              r10: token.h3r10,
              r12: token.h3r12,
            }
          }
        })

        const tokenIds = tokens.map((token: Token) => token.id)
        const uniqueVisibleIds = Array.from(new Set([...state.visibleTokenIds, ...tokenIds]))
        state.visibleTokenIds = uniqueVisibleIds

        console.log(`[loadTokensFromIndexedDB] Loaded ${tokens.length} tokens from IndexedDB`)
      })
      .addCase(loadTokensFromIndexedDB.rejected, (_state, action) => {
        console.warn('[loadTokensFromIndexedDB] Failed to load from IndexedDB:', action.payload)
        // Don't set error state - this is a background operation
      })
      // IndexedDB cleanup
      .addCase(cleanupIndexedDB.fulfilled, (_state, action) => {
        const { deletedCount } = action.payload
        console.log(`[cleanupIndexedDB] Cleaned up ${deletedCount} old tokens from IndexedDB`)
      })
      .addCase(cleanupIndexedDB.rejected, (_state, action) => {
        console.error('[cleanupIndexedDB] Failed to cleanup IndexedDB:', action.payload)
      })
      // Tree token fetch for highlight
      .addCase(fetchTreeTokensForSelection.pending, (state) => {
        state.treeTokensLoading = true
      })
      .addCase(fetchTreeTokensForSelection.fulfilled, (state, action) => {
        const { tokens, treeId } = action.payload
        const now = Date.now()

        state.selectedTreeId = treeId
        state.selectedTreeTokenIds = tokens.map(t => t.id)
        state.treeTokensLoading = false

        // Merge tree tokens into store (don't overwrite existing fresher data)
        tokens.forEach((token: Token) => {
          if (!state.tokens[token.id]) {
            state.tokens[token.id] = token
            state.tokenAccessTimestamps[token.id] = now
            state.tokenH3Cells[token.id] = {
              r6: token.h3r6,
              r8: token.h3r8,
              r10: token.h3r10,
              r12: token.h3r12,
            }
          }
        })

        // Add tree token IDs to visibleTokenIds for connection line calculation
        const tokenIds = tokens.map(t => t.id)
        state.visibleTokenIds = Array.from(new Set([...state.visibleTokenIds, ...tokenIds]))
      })
      .addCase(fetchTreeTokensForSelection.rejected, (state, action) => {
        state.treeTokensLoading = false
        console.warn('[fetchTreeTokensForSelection] Failed:', action.error.message)
      })
  }
})

export const {
  updateViewport,
  setVisibleTokens,
  clearTokens,
  clearError,
  cleanupCache,
  updateTokenAccess,
  insertMintedToken,
  insertTemporaryToken,
  setSelectedToken,
  clearTreeSelection,
} = nftMapSlice.actions

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

// Selected token selector for NFT detail panel
export const selectSelectedTokenId = (state: { nftMap: NFTMapState }) => state.nftMap.selectedTokenId

/**
 * Selector for raw selected token
 * Note: selectedTokenId is the GraphQL entity ID (token.id), set by handleTokenClick
 */
export const selectSelectedToken = createSelector(
  [selectNFTMapTokens, selectSelectedTokenId],
  (tokens, selectedTokenId) => {
    if (!selectedTokenId) return null
    return Object.values(tokens).find(t => t.id === selectedTokenId) ?? null
  }
)

/**
 * Selector for processed selected token (with numeric fields)
 * Used by NFTDetailPanel for display
 *
 * Memoized: only recomputes when selectedTokenId or tokens change
 *
 * Note: selectedTokenId is the GraphQL entity ID (token.id), set by handleTokenClick
 * in MapComponent when a marker is clicked.
 */
export const selectProcessedSelectedToken = createSelector(
  [selectNFTMapTokens, selectSelectedTokenId],
  (tokens, selectedTokenId): ProcessedToken | null => {
    if (!selectedTokenId) return null
    // selectedTokenId is token.id (GraphQL entity ID), search by id field
    const token = Object.values(tokens).find(t => t.id === selectedTokenId)
    if (!token) return null
    const processed = processTokenData([token])
    return processed[0] ?? null
  }
)

// Tree highlight selectors
export const selectSelectedTreeId = (state: { nftMap: NFTMapState }) => state.nftMap.selectedTreeId
export const selectSelectedTreeTokenIds = (state: { nftMap: NFTMapState }) => state.nftMap.selectedTreeTokenIds
export const selectTreeTokensLoading = (state: { nftMap: NFTMapState }) => state.nftMap.treeTokensLoading

export default nftMapSlice.reducer