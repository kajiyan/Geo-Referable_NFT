import { renderHook } from '@testing-library/react'
import { useQuery } from '@apollo/client/react'
import useTreeTokens from '../useTreeTokens'
import { GET_TREE_TOKENS } from '@/lib/graphql/queries'

// Mock Apollo Client useQuery hook
jest.mock('@apollo/client/react', () => ({
  useQuery: jest.fn(),
}))

const mockUseQuery = useQuery as jest.MockedFunction<typeof useQuery>

const mockTokens = [
  {
    id: '1',
    tokenId: '1',
    owner: {
      id: 'user-1',
      address: '0x1234567890123456789012345678901234567890'
    },
    latitude: '35.6762',
    longitude: '139.6503',
    elevation: '40',
    quadrant: 0,
    isBelowSeaLevel: false,
    weather: 1,
    tree: '1',
    generation: '1',
    h3r7: '871fb46d2ffffff',
    h3r9: '891fb46d2bfffff',
    h3r12: '8c1fb46d2b001ff',
    text: 'Token 1 text',
    textByteLength: '20',
    textCharLength: '20',
    referringTo: [],
    referredBy: [],
    initialBaseTokenId: '0',
    createdAt: '1640995200',
    createdAtBlock: '14000000',
    createdAtTx: '0x1',
    updatedAt: '1640995200'
  }
]


describe('useTreeTokens', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return loading state initially', () => {
    mockUseQuery.mockReturnValue({
      data: null,
      loading: true,
      error: undefined,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof useQuery>)

    const { result } = renderHook(() => useTreeTokens('1'))

    expect(result.current.loading).toBe(true)
    expect(result.current.tokens).toEqual([])
    expect(result.current.generationData.generations).toEqual([])
  })

  it('should fetch and process tree tokens successfully', async () => {
    mockUseQuery.mockReturnValue({
      data: { treeTokens: mockTokens },
      loading: false,
      error: undefined,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof useQuery>)

    const { result } = renderHook(() => useTreeTokens('1'))

    expect(result.current.loading).toBe(false)
    expect(result.current.tokens).toHaveLength(1)
    expect(result.current.tokens[0].tokenId).toBe('1')
    expect(result.current.generationData.generations).toHaveLength(1)
    expect(result.current.generationData.totalTokens).toBe(1)
    expect(result.current.isEmpty).toBe(false)
  })

  it('should handle GraphQL errors', async () => {
    const testError = new Error('GraphQL error')
    mockUseQuery.mockReturnValue({
      data: null,
      loading: false,
      error: testError,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof useQuery>)

    const { result } = renderHook(() => useTreeTokens('1'))

    expect(result.current.error).toBe(testError)
    expect(result.current.tokens).toEqual([])
    expect(result.current.isEmpty).toBe(false) // false because there's an error
  })

  it('should handle invalid tree numbers', () => {
    mockUseQuery.mockReturnValue({
      data: null,
      loading: false,
      error: undefined,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof useQuery>)

    const { result } = renderHook(() => useTreeTokens('invalid'))

    expect(mockUseQuery).toHaveBeenCalledWith(
      GET_TREE_TOKENS,
      expect.objectContaining({
        skip: true
      })
    )
    expect(result.current.loading).toBe(false)
    expect(result.current.tokens).toEqual([])
    expect(result.current.isEmpty).toBe(true)
  })

  it('should handle tree parameter "0" correctly', () => {
    mockUseQuery.mockReturnValue({
      data: { treeTokens: mockTokens },
      loading: false,
      error: undefined,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof useQuery>)

    const { result } = renderHook(() => useTreeTokens('0'))

    expect(mockUseQuery).toHaveBeenCalledWith(
      GET_TREE_TOKENS,
      expect.objectContaining({
        variables: { tree: 0 },
        skip: false
      })
    )
    expect(result.current.loading).toBe(false)
    expect(result.current.tokens).toEqual([mockTokens[0]])
    expect(result.current.isEmpty).toBe(false)
  })

  it('should handle null tree parameter', () => {
    mockUseQuery.mockReturnValue({
      data: null,
      loading: false,
      error: undefined,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof useQuery>)

    const { result } = renderHook(() => useTreeTokens(null))

    expect(mockUseQuery).toHaveBeenCalledWith(
      GET_TREE_TOKENS,
      expect.objectContaining({
        skip: true
      })
    )
    expect(result.current.loading).toBe(false)
    expect(result.current.tokens).toEqual([])
    expect(result.current.isEmpty).toBe(true)
  })

  it('should return empty state when no tokens found', async () => {
    mockUseQuery.mockReturnValue({
      data: { treeTokens: [] },
      loading: false,
      error: undefined,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof useQuery>)

    const { result } = renderHook(() => useTreeTokens('999'))

    expect(result.current.isEmpty).toBe(true)
    expect(result.current.tokens).toEqual([])
    expect(result.current.generationData.generations).toEqual([])
  })

  it('should use correct query options', () => {
    mockUseQuery.mockReturnValue({
      data: null,
      loading: false,
      error: undefined,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof useQuery>)

    renderHook(() => useTreeTokens('1'))

    expect(mockUseQuery).toHaveBeenCalledWith(
      GET_TREE_TOKENS,
      expect.objectContaining({
        variables: { tree: 1 },
        skip: false,
        notifyOnNetworkStatusChange: true,
        errorPolicy: 'all',
        fetchPolicy: 'cache-and-network'
      })
    )
  })

  it('should call refetch with correct parameters', async () => {
    const mockRefetch = jest.fn().mockResolvedValue({})
    mockUseQuery.mockReturnValue({
      data: { treeTokens: mockTokens },
      loading: false,
      error: undefined,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useQuery>)

    const { result } = renderHook(() => useTreeTokens('1'))

    await result.current.refetch()

    expect(mockRefetch).toHaveBeenCalledWith({ tree: 1 })
  })

  it('should refetch with tree=0 correctly', async () => {
    const mockRefetch = jest.fn().mockResolvedValue({})
    mockUseQuery.mockReturnValue({
      data: { treeTokens: mockTokens },
      loading: false,
      error: undefined,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useQuery>)

    const { result } = renderHook(() => useTreeTokens('0'))

    await result.current.refetch()

    expect(mockRefetch).toHaveBeenCalledWith({ tree: 0 })
  })

  it('should not refetch when no tree number', async () => {
    const mockRefetch = jest.fn()
    mockUseQuery.mockReturnValue({
      data: null,
      loading: false,
      error: undefined,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useQuery>)

    const { result } = renderHook(() => useTreeTokens(null))

    await result.current.refetch()

    expect(mockRefetch).not.toHaveBeenCalled()
  })
})