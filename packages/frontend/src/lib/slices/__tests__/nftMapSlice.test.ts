import { configureStore } from '@reduxjs/toolkit'
import nftMapReducer, {
  fetchTokensForViewport,
  clearTokens,
  clearError,
  updateViewport,
  setVisibleTokens,
  setSelectedToken,
  updateTokenAccess,
  cleanupCache,
  selectVisibleTokens,
  selectMapLoading,
  selectMapError,
  selectMapViewport,
  selectNFTMapTokens,
  selectSelectedTokenId,
  selectCacheStats,
  type NFTMapState
} from '../nftMapSlice'

// Mock Apollo Client
jest.mock('@/lib/graphql/client', () => ({
  apolloClient: {
    query: jest.fn()
  }
}))

// Mock GraphQL queries
jest.mock('@/lib/graphql/queries', () => ({
  SEARCH_TOKENS_BY_H3: 'mock-query'
}))

// Import the apollo client correctly
let mockApolloClient: { query: jest.Mock }

// Helper to create initial state for tests
const createInitialState = (overrides: Partial<NFTMapState> = {}): NFTMapState => ({
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
  cachedTokenIds: [],
  tokenAccessTimestamps: {},
  tokenH3Cells: {},
  cacheStats: {
    totalCached: 0,
    totalEvicted: 0,
    lastCleanupTime: 0,
    cleanupCount: 0,
    memoryEstimateMB: 0
  },
  selectedTokenId: null,
  selectedTreeId: null,
  selectedTreeTokenIds: [],
  treeTokensLoading: false,
  ...overrides
})

describe('nftMapSlice', () => {
  let store: ReturnType<typeof configureStore<{ nftMap: NFTMapState }>>

  beforeEach(async () => {
    // Mock the dynamic import
    jest.doMock('@/lib/graphql/client', () => ({
      apolloClient: {
        query: jest.fn()
      }
    }))

    const clientModule = await import('@/lib/graphql/client')
    mockApolloClient = clientModule.apolloClient as unknown as { query: jest.Mock }

    store = configureStore({
      reducer: {
        nftMap: nftMapReducer
      }
    })
    jest.clearAllMocks()
  })

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = store.getState().nftMap

      expect(state).toEqual(createInitialState())
    })
  })

  describe('reducers', () => {
    describe('clearTokens', () => {
      it('should clear all tokens and reset cache', () => {
        // First add some data using the proper actions
        store.dispatch(setVisibleTokens(['1', '2']))

        store.dispatch(clearTokens())

        const state = store.getState().nftMap
        expect(state.tokens).toEqual({})
        expect(state.visibleTokenIds).toEqual([])
        expect(state.h3Cells).toEqual({ r6: [], r8: [], r10: [], r12: [] })
        expect(state.cachedTokenIds).toEqual([])
        expect(state.tokenAccessTimestamps).toEqual({})
        expect(state.tokenH3Cells).toEqual({})
      })
    })

    describe('clearError', () => {
      it('should clear error state', () => {
        // Set up store with initial error
        store = configureStore({
          reducer: { nftMap: nftMapReducer },
          preloadedState: {
            nftMap: createInitialState({ error: 'Test error' })
          }
        })

        store.dispatch(clearError())

        const state = store.getState().nftMap
        expect(state.error).toBeNull()
      })
    })

    describe('updateViewport', () => {
      it('should update viewport state', () => {
        const viewport = {
          bounds: [139.7, 35.6, 139.8, 35.7] as [number, number, number, number],
          zoom: 12,
          center: [139.75, 35.65] as [number, number]
        }

        store.dispatch(updateViewport(viewport))

        const state = store.getState().nftMap
        expect(state.viewport).toEqual(viewport)
      })
    })

    describe('setVisibleTokens', () => {
      it('should update visible token IDs', () => {
        const tokenIds = ['1', '2', '3']

        store.dispatch(setVisibleTokens(tokenIds))

        const state = store.getState().nftMap
        expect(state.visibleTokenIds).toEqual(tokenIds)
      })
    })

    describe('setSelectedToken', () => {
      it('should set selected token ID', () => {
        store.dispatch(setSelectedToken('123'))

        const state = store.getState().nftMap
        expect(state.selectedTokenId).toBe('123')
      })

      it('should clear selected token when null', () => {
        store.dispatch(setSelectedToken('123'))
        store.dispatch(setSelectedToken(null))

        const state = store.getState().nftMap
        expect(state.selectedTokenId).toBeNull()
      })
    })

    describe('updateTokenAccess', () => {
      it('should update token access timestamp', () => {
        const beforeTime = Date.now()
        store.dispatch(updateTokenAccess(['token-1']))
        const afterTime = Date.now()

        const state = store.getState().nftMap
        expect(state.tokenAccessTimestamps['token-1']).toBeGreaterThanOrEqual(beforeTime)
        expect(state.tokenAccessTimestamps['token-1']).toBeLessThanOrEqual(afterTime)
      })
    })

    describe('cleanupCache', () => {
      it('should update cleanup stats', () => {
        store.dispatch(cleanupCache())

        const state = store.getState().nftMap
        expect(state.cacheStats.totalEvicted).toBe(5)
        expect(state.cacheStats.cleanupCount).toBe(1)
        expect(state.cacheStats.lastCleanupTime).toBeGreaterThan(0)
      })
    })
  })

  describe('fetchTokensForViewport async thunk', () => {
    const mockViewport = {
      bounds: [139.7, 35.6, 139.8, 35.7] as [number, number, number, number],
      zoom: 12,
      center: [139.75, 35.65] as [number, number]
    }

    const mockTokens = [
      {
        id: '1',
        tokenId: '1',
        latitude: '35.65',
        longitude: '139.75',
        generation: '1',
        treeId: '1',
        colorIndex: '5',
        elevation: '10',
        message: 'Test token',
        quadrant: 0,
        treeIndex: '0',
        h3r6: 'h3r6-1',
        h3r8: 'h3r8-1',
        h3r10: 'h3r10-1',
        h3r12: 'h3r12-1',
        refCount: '0',
        totalDistance: '0',
        referringTo: [],
        referredBy: [],
        createdAt: '1640995200000',
        blockNumber: '12345',
        transactionHash: '0x123',
        owner: { id: '0x123', address: '0x123' }
      }
    ]

    beforeEach(() => {
      mockApolloClient.query.mockResolvedValue({
        data: {
          tokensByR6: mockTokens.slice(0, 1),
          tokensByR8: [],
          tokensByR10: [],
          tokensByR12: []
        }
      })
    })

    describe('pending state', () => {
      it('should set loading to true and clear error', async () => {
        const promise = store.dispatch(fetchTokensForViewport({
          h3Cells: { r6: ['cell1'], r8: ['cell2'], r10: ['cell3'], r12: ['cell4'] },
          viewport: mockViewport
        }))

        // Check pending state
        let state = store.getState().nftMap
        expect(state.loading).toBe(true)
        expect(state.error).toBeNull()

        await promise
      })
    })

    describe('fulfilled state', () => {
      it('should update tokens on successful fetch', async () => {
        await store.dispatch(fetchTokensForViewport({
          h3Cells: { r6: ['cell1'], r8: ['cell2'], r10: ['cell3'], r12: ['cell4'] },
          viewport: mockViewport
        }))

        const state = store.getState().nftMap
        expect(state.loading).toBe(false)
        expect(state.error).toBeNull()
        expect(Object.keys(state.tokens)).toHaveLength(1)
        expect(state.tokens['1']).toBeDefined()
        expect(state.tokens['1'].id).toBe('1')
        expect(state.viewport).toEqual(mockViewport)
        expect(state.h3Cells).toEqual({ r6: ['cell1'], r8: ['cell2'], r10: ['cell3'], r12: ['cell4'] })
      })

      it('should handle empty response', async () => {
        mockApolloClient.query.mockResolvedValue({
          data: {
            tokensByR6: [],
            tokensByR8: [],
            tokensByR10: [],
            tokensByR12: []
          }
        })

        await store.dispatch(fetchTokensForViewport({
          h3Cells: { r6: ['cell1'], r8: ['cell2'], r10: ['cell3'], r12: ['cell4'] },
          viewport: mockViewport
        }))

        const state = store.getState().nftMap
        expect(state.loading).toBe(false)
        expect(state.error).toBeNull()
        expect(Object.keys(state.tokens)).toHaveLength(0)
      })
    })

    describe('rejected state', () => {
      it('should handle network errors', async () => {
        const errorMessage = 'Network error'
        mockApolloClient.query.mockRejectedValue(new Error(errorMessage))

        await store.dispatch(fetchTokensForViewport({
          h3Cells: { r6: ['cell1'], r8: ['cell2'], r10: ['cell3'], r12: ['cell4'] },
          viewport: mockViewport
        }))

        const state = store.getState().nftMap
        expect(state.loading).toBe(false)
        expect(state.error).toBe(errorMessage)
      })

      it('should handle condition-based rejections with undefined payload', async () => {
        // Set up store with loading state to trigger condition rejection
        store = configureStore({
          reducer: { nftMap: nftMapReducer },
          preloadedState: {
            nftMap: createInitialState({ loading: true })
          }
        })

        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

        await store.dispatch(fetchTokensForViewport({
          h3Cells: { r6: ['cell1'], r8: ['cell2'], r10: ['cell3'], r12: ['cell4'] },
          viewport: mockViewport
        }))

        const state = store.getState().nftMap
        expect(state.loading).toBe(false) // Should be set to false in rejected handler
        expect(state.error).toBeNull() // Should not set error for condition-based rejections
        expect(consoleLogSpy).toHaveBeenCalledWith('NFT fetch skipped due to condition check')
        expect(consoleErrorSpy).not.toHaveBeenCalled() // Should not log error for undefined payload

        consoleLogSpy.mockRestore()
        consoleErrorSpy.mockRestore()
      })
    })
  })

  describe('selectors', () => {
    beforeEach(() => {
      // Set up store with some test data
      store = configureStore({
        reducer: { nftMap: nftMapReducer },
        preloadedState: {
          nftMap: createInitialState({
            tokens: {
              '1': {
                id: '1',
                tokenId: '1',
                latitude: '35.65',
                longitude: '139.75',
                elevation: '10',
                quadrant: 0,
                colorIndex: '5',
                treeId: '1',
                generation: '1',
                tree: {
                  id: '0x01',
                  treeId: '1',
                  maxGeneration: '5'
                },
                treeIndex: '0',
                h3r6: 'h3-1',
                h3r8: 'h3-2',
                h3r10: 'h3-3',
                h3r12: 'h3-4',
                message: 'test',
                refCount: '0',
                totalDistance: '0',
                createdAt: '123456789',
                blockNumber: '1',
                transactionHash: '0x123',
                owner: { id: '0x123', address: '0x123' }
              }
            },
            visibleTokenIds: ['1'],
            loading: true,
            error: 'Test error',
            viewport: {
              bounds: [139.7, 35.6, 139.8, 35.7] as [number, number, number, number],
              zoom: 10,
              center: [0.5, 0.5] as [number, number]
            },
            lastFetchTime: 123456789,
            h3Cells: { r6: ['cell1'], r8: [], r10: [], r12: [] },
            selectedTokenId: '1',
            cacheStats: {
              totalCached: 5,
              totalEvicted: 2,
              lastCleanupTime: 123456789,
              cleanupCount: 1,
              memoryEstimateMB: 0.5
            }
          })
        }
      })
    })

    it('selectVisibleTokens should return visible tokens array', () => {
      const tokens = selectVisibleTokens(store.getState())
      expect(tokens).toHaveLength(1)
      expect(tokens[0].id).toBe('1')
    })

    it('selectNFTMapTokens should return tokens object', () => {
      const tokens = selectNFTMapTokens(store.getState())
      expect(tokens['1']).toBeDefined()
      expect(tokens['1'].id).toBe('1')
    })

    it('selectMapLoading should return loading state', () => {
      const loading = selectMapLoading(store.getState())
      expect(loading).toBe(true)
    })

    it('selectMapError should return error state', () => {
      const error = selectMapError(store.getState())
      expect(error).toBe('Test error')
    })

    it('selectMapViewport should return viewport', () => {
      const viewport = selectMapViewport(store.getState())
      expect(viewport).toEqual({
        bounds: [139.7, 35.6, 139.8, 35.7],
        zoom: 10,
        center: [0.5, 0.5]
      })
    })

    it('selectSelectedTokenId should return selected token ID', () => {
      const selectedId = selectSelectedTokenId(store.getState())
      expect(selectedId).toBe('1')
    })

    it('selectCacheStats should return cache stats', () => {
      const stats = selectCacheStats(store.getState())
      expect(stats).toEqual({
        totalCached: 5,
        totalEvicted: 2,
        lastCleanupTime: 123456789,
        cleanupCount: 1,
        memoryEstimateMB: 0.5
      })
    })
  })
})
