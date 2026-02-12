import { renderHook, waitFor } from '@testing-library/react'
import { useAccount } from 'wagmi'
import { useQuery } from '@apollo/client/react'
import { useMyCollection } from '../useMyCollection'
import { GET_MY_COLLECTION } from '@/lib/graphql/queries'
import type { Token } from '@/types'

// Mock wagmi useAccount hook
jest.mock('wagmi', () => ({
  useAccount: jest.fn(),
}))

// Mock Apollo Client useQuery hook
jest.mock('@apollo/client/react', () => ({
  useQuery: jest.fn(),
}))

const mockUseAccount = useAccount as jest.MockedFunction<typeof useAccount>
const mockUseQuery = useQuery as jest.MockedFunction<typeof useQuery>

// Sample token data
const sampleTokens = [
  {
    id: '1',
    tokenId: '1',
    owner: { id: '0xuser1', address: '0xuser1' },
    latitude: '35.6584',
    longitude: '139.7454',
    elevation: '10',
    weather: 0,
    tree: 'A',
    generation: '1',
    h3r7: '8c2a100c9b07777',
    h3r9: '8c2a100c9b09999',
    h3r12: '8c2a100c9b0cccc',
    text: 'Test NFT 1',
    createdAt: '1640000000',
    createdAtBlock: '100',
    createdAtTx: '0xabc',
    referringTo: [],
    referredBy: []
  },
  {
    id: '2',
    tokenId: '2',
    owner: { id: '0xuser1', address: '0xuser1' },
    latitude: '35.6585',
    longitude: '139.7455',
    elevation: '11',
    weather: 1,
    tree: 'B',
    generation: '1',
    h3r7: '8c2a100c9b07777',
    h3r9: '8c2a100c9b09999',
    h3r12: '8c2a100c9b0cccc',
    text: 'Test NFT 2',
    createdAt: '1640000001',
    createdAtBlock: '101',
    createdAtTx: '0xdef',
    referringTo: [],
    referredBy: []
  }
]

describe('useMyCollection', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Default mock implementations
    mockUseAccount.mockReturnValue({
      address: '0x1234567890abcdef1234567890abcdef12345678',
      isConnected: true,
    } as unknown as ReturnType<typeof useAccount>)

    mockUseQuery.mockReturnValue({
      data: {
        tokens: sampleTokens,
        totalTokensCount: [{ id: '1' }, { id: '2' }]
      },
      loading: false,
      error: undefined,
      refetch: jest.fn().mockResolvedValue({}),
      fetchMore: jest.fn().mockResolvedValue({ data: { tokens: [] } })
    } as unknown as ReturnType<typeof useQuery>)
  })

  it('should return correct initial state when connected', () => {
    const { result } = renderHook(() => useMyCollection())

    // Tokens should be sorted by createdAt DESC (newest first)
    const expectedSortedTokens = [...sampleTokens].sort((a, b) =>
      parseInt(b.createdAt) - parseInt(a.createdAt)
    )
    expect(result.current.tokens).toEqual(expectedSortedTokens)
    expect(result.current.totalCount).toBe(2)
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe(null)
    expect(result.current.isConnected).toBe(true)
    expect(result.current.address).toBe('0x1234567890abcdef1234567890abcdef12345678')
    expect(result.current.hasMore).toBe(false) // length < totalCount
    expect(result.current.isLoadingMore).toBe(false)
  })

  it('should return empty state when not connected', () => {
    mockUseAccount.mockReturnValue({
      address: undefined,
      isConnected: false,
    } as unknown as ReturnType<typeof useAccount>)

    // When skip: true, useQuery returns data: undefined
    mockUseQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: undefined,
      refetch: jest.fn().mockResolvedValue({}),
      fetchMore: jest.fn().mockResolvedValue({ data: { tokens: [] } })
    } as unknown as ReturnType<typeof useQuery>)

    const { result } = renderHook(() => useMyCollection())

    expect(result.current.tokens).toEqual([])
    expect(result.current.totalCount).toBe(0)
    expect(result.current.isConnected).toBe(false)
    expect(result.current.address).toBe(undefined)
  })

  it('should skip query when not connected or no address', () => {
    mockUseAccount.mockReturnValue({
      address: undefined,
      isConnected: false,
    } as unknown as ReturnType<typeof useAccount>)

    renderHook(() => useMyCollection())

    expect(mockUseQuery).toHaveBeenCalledWith(
      GET_MY_COLLECTION,
      expect.objectContaining({
        skip: true
      })
    )
  })

  it('should use normalized address in query variables', () => {
    mockUseAccount.mockReturnValue({
      address: '0xABCD1234567890abcdef1234567890abcdef1234',
      isConnected: true,
    } as unknown as ReturnType<typeof useAccount>)

    renderHook(() => useMyCollection())

    expect(mockUseQuery).toHaveBeenCalledWith(
      GET_MY_COLLECTION,
      expect.objectContaining({
        variables: expect.objectContaining({
          ownerAddress: '0xabcd1234567890abcdef1234567890abcdef1234' // lowercased
        })
      })
    )
  })

  it('should calculate hasMore correctly based on tokens and totalCount', () => {
    // Mock scenario where we have more tokens available
    mockUseQuery.mockReturnValue({
      data: {
        tokens: sampleTokens,
        totalTokensCount: Array.from({ length: 25 }, (_, i) => ({ id: i.toString() }))
      },
      loading: false,
      error: undefined,
      refetch: jest.fn(),
      fetchMore: jest.fn()
    } as unknown as ReturnType<typeof useQuery>)

    const { result } = renderHook(() => useMyCollection())

    expect(result.current.hasMore).toBe(true) // 2 < 25
    expect(result.current.totalCount).toBe(25)
  })

  it('should handle loading state', () => {
    mockUseQuery.mockReturnValue({
      data: null,
      loading: true,
      error: undefined,
      refetch: jest.fn(),
      fetchMore: jest.fn()
    } as unknown as ReturnType<typeof useQuery>)

    const { result } = renderHook(() => useMyCollection())

    expect(result.current.loading).toBe(true)
    expect(result.current.tokens).toEqual([])
  })

  it('should handle error state', () => {
    const testError = new Error('GraphQL Error')
    mockUseQuery.mockReturnValue({
      data: null,
      loading: false,
      error: testError,
      refetch: jest.fn(),
      fetchMore: jest.fn()
    } as unknown as ReturnType<typeof useQuery>)

    const { result } = renderHook(() => useMyCollection())

    expect(result.current.error).toBe(testError)
    expect(result.current.tokens).toEqual([])
  })

  describe('loadMore functionality', () => {
    it('should call fetchMore with correct parameters', async () => {
      const mockFetchMore = jest.fn().mockResolvedValue({
        data: { tokens: [sampleTokens[1]] }
      })
      
      mockUseQuery.mockReturnValue({
        data: {
          tokens: [sampleTokens[0]], // Start with one token
          totalTokensCount: Array.from({ length: 5 }, (_, i) => ({ id: i.toString() }))
        },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
        fetchMore: mockFetchMore
      } as unknown as ReturnType<typeof useQuery>)

      const { result } = renderHook(() => useMyCollection())

      expect(result.current.hasMore).toBe(true)

      await result.current.loadMore()

      expect(mockFetchMore).toHaveBeenCalledWith({
        variables: {
          skip: 1 // tokens.length
        },
        updateQuery: expect.any(Function)
      })
    })

    it('should not loadMore when no more items available', async () => {
      const mockFetchMore = jest.fn()
      
      mockUseQuery.mockReturnValue({
        data: {
          tokens: sampleTokens,
          totalTokensCount: sampleTokens.map((_, i) => ({ id: i.toString() }))
        },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
        fetchMore: mockFetchMore
      } as unknown as ReturnType<typeof useQuery>)

      const { result } = renderHook(() => useMyCollection())

      expect(result.current.hasMore).toBe(false)

      await result.current.loadMore()

      expect(mockFetchMore).not.toHaveBeenCalled()
    })

    it('should not loadMore when already loading', async () => {
      const mockFetchMore = jest.fn()
      
      mockUseQuery.mockReturnValue({
        data: {
          tokens: [sampleTokens[0]],
          totalTokensCount: Array.from({ length: 5 }, (_, i) => ({ id: i.toString() }))
        },
        loading: true, // Currently loading
        error: undefined,
        refetch: jest.fn(),
        fetchMore: mockFetchMore
      } as unknown as ReturnType<typeof useQuery>)

      const { result } = renderHook(() => useMyCollection())

      await result.current.loadMore()

      expect(mockFetchMore).not.toHaveBeenCalled()
    })

    it('should not loadMore when already loading more', async () => {
      const mockFetchMore = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
      
      mockUseQuery.mockReturnValue({
        data: {
          tokens: [sampleTokens[0]],
          totalTokensCount: Array.from({ length: 5 }, (_, i) => ({ id: i.toString() }))
        },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
        fetchMore: mockFetchMore
      } as unknown as ReturnType<typeof useQuery>)

      const { result } = renderHook(() => useMyCollection())

      // Start first loadMore
      const promise1 = result.current.loadMore()
      
      // Try second loadMore while first is pending
      const promise2 = result.current.loadMore()

      await Promise.all([promise1, promise2])

      // Should only call fetchMore once
      expect(mockFetchMore).toHaveBeenCalledTimes(1)
    })

    it('should set isLoadingMore state during fetchMore', async () => {
      let resolveFetchMore: (value: { data: { tokens: Token[] } }) => void
      const fetchMorePromise = new Promise(resolve => {
        resolveFetchMore = resolve
      })
      
      const mockFetchMore = jest.fn().mockReturnValue(fetchMorePromise)
      
      mockUseQuery.mockReturnValue({
        data: {
          tokens: [sampleTokens[0]],
          totalTokensCount: Array.from({ length: 5 }, (_, i) => ({ id: i.toString() }))
        },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
        fetchMore: mockFetchMore
      } as unknown as ReturnType<typeof useQuery>)

      const { result } = renderHook(() => useMyCollection())

      expect(result.current.isLoadingMore).toBe(false)

      const loadMorePromise = result.current.loadMore()

      await waitFor(() => {
        expect(result.current.isLoadingMore).toBe(true)
      })

      resolveFetchMore!({ data: { tokens: [] } })
      await loadMorePromise

      await waitFor(() => {
        expect(result.current.isLoadingMore).toBe(false)
      })
    })

    it('should handle fetchMore errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      const mockFetchMore = jest.fn().mockRejectedValue(new Error('Network error'))
      
      mockUseQuery.mockReturnValue({
        data: {
          tokens: [sampleTokens[0]],
          totalTokensCount: Array.from({ length: 5 }, (_, i) => ({ id: i.toString() }))
        },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
        fetchMore: mockFetchMore
      } as unknown as ReturnType<typeof useQuery>)

      const { result } = renderHook(() => useMyCollection())

      await result.current.loadMore()

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading more tokens:', expect.any(Error))
      expect(result.current.isLoadingMore).toBe(false)

      consoleErrorSpy.mockRestore()
    })

    it('should use updateQuery to merge new tokens', async () => {
      const mockFetchMore = jest.fn().mockImplementation(({ updateQuery }) => {
        const prev = { tokens: [sampleTokens[0]] }
        const fetchMoreResult = { tokens: [sampleTokens[1]] }
        
        const result = updateQuery(prev, { fetchMoreResult })
        expect(result.tokens).toEqual([sampleTokens[0], sampleTokens[1]])
        
        return Promise.resolve({ data: fetchMoreResult })
      })
      
      mockUseQuery.mockReturnValue({
        data: {
          tokens: [sampleTokens[0]],
          totalTokensCount: Array.from({ length: 5 }, (_, i) => ({ id: i.toString() }))
        },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
        fetchMore: mockFetchMore
      } as unknown as ReturnType<typeof useQuery>)

      const { result } = renderHook(() => useMyCollection())

      await result.current.loadMore()

      expect(mockFetchMore).toHaveBeenCalled()
    })
  })

  describe('refetch functionality', () => {
    it('should call refetch with correct parameters', async () => {
      const mockRefetch = jest.fn().mockResolvedValue({})
      
      mockUseQuery.mockReturnValue({
        data: { tokens: sampleTokens, totalTokensCount: [] },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
        fetchMore: jest.fn()
      } as unknown as ReturnType<typeof useQuery>)

      const { result } = renderHook(() => useMyCollection())

      await result.current.refetch()

      expect(mockRefetch).toHaveBeenCalledWith({
        ownerAddress: '0x1234567890abcdef1234567890abcdef12345678',
        first: 20,
        skip: 0
      })
    })

    it('should not refetch when no address', async () => {
      const mockRefetch = jest.fn()

      mockUseAccount.mockReturnValue({
        address: undefined,
        isConnected: true,
      } as unknown as ReturnType<typeof useAccount>)

      mockUseQuery.mockReturnValue({
        data: null,
        loading: false,
        error: undefined,
        refetch: mockRefetch,
        fetchMore: jest.fn()
      } as unknown as ReturnType<typeof useQuery>)

      const { result } = renderHook(() => useMyCollection())

      await result.current.refetch()

      expect(mockRefetch).not.toHaveBeenCalled()
    })

    it('should handle refetch errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      const mockRefetch = jest.fn().mockRejectedValue(new Error('Refetch error'))
      
      mockUseQuery.mockReturnValue({
        data: { tokens: sampleTokens, totalTokensCount: [] },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
        fetchMore: jest.fn()
      } as unknown as ReturnType<typeof useQuery>)

      const { result } = renderHook(() => useMyCollection())

      await result.current.refetch()

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error refetching tokens:', expect.any(Error))

      consoleErrorSpy.mockRestore()
    })
  })

  describe('abort controller functionality', () => {
    it('should abort requests on unmount', () => {
      const mockAbort = jest.fn()
      const originalAbortController = window.AbortController
      
      window.AbortController = jest.fn().mockImplementation(() => ({
        abort: mockAbort,
        signal: {}
      }))

      const { unmount } = renderHook(() => useMyCollection())

      unmount()

      expect(mockAbort).toHaveBeenCalled()

      window.AbortController = originalAbortController
    })

    it('should abort previous requests when starting new loadMore', async () => {
      const mockAbort = jest.fn()
      const abortControllerInstances: { abort: jest.Mock, signal: object }[] = []
      
      const originalAbortController = window.AbortController
      window.AbortController = jest.fn().mockImplementation(() => {
        const instance = { abort: mockAbort, signal: {} }
        abortControllerInstances.push(instance)
        return instance
      })

      const mockFetchMore = jest.fn().mockResolvedValue({ data: { tokens: [] } })
      
      mockUseQuery.mockReturnValue({
        data: {
          tokens: [sampleTokens[0]],
          totalTokensCount: Array.from({ length: 5 }, (_, i) => ({ id: i.toString() }))
        },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
        fetchMore: mockFetchMore
      } as unknown as ReturnType<typeof useQuery>)

      const { result } = renderHook(() => useMyCollection())

      await result.current.loadMore()
      await result.current.loadMore() // Second call should abort first

      // Should create multiple controllers and abort the previous ones
      expect(abortControllerInstances.length).toBeGreaterThan(1)
      expect(mockAbort).toHaveBeenCalled()

      window.AbortController = originalAbortController
    })
  })

  describe('query options', () => {
    it('should use correct query options', () => {
      renderHook(() => useMyCollection())

      expect(mockUseQuery).toHaveBeenCalledWith(
        GET_MY_COLLECTION,
        expect.objectContaining({
          variables: {
            ownerAddress: '0x1234567890abcdef1234567890abcdef12345678',
            first: 20,
            skip: 0
          },
          skip: false,
          notifyOnNetworkStatusChange: true,
          errorPolicy: 'all',
          fetchPolicy: 'cache-and-network'
        })
      )
    })
  })
})