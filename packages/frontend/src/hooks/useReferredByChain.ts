import { useQuery } from '@apollo/client/react'
import { useMemo, useEffect, useState } from 'react'
import { Token, TokenReference } from '@/types/index'
import { GET_TOKENS_BY_TOKEN_IDS } from '@/lib/graphql/queries'

/**
 * Result of useReferredByChain hook
 */
export interface UseReferredByChainResult {
  /** Generations of tokens (generation 1 = direct referrers) */
  generations: Token[][]
  /** Loading state */
  loading: boolean
  /** Error if any */
  error: Error | null
  /** Maximum tokens in any single row (for empty slot calculation) */
  maxTokensPerRow: number
  /** Expected generation count for skeleton height calculation (loaded + pending) */
  expectedGenerationCount: number
}

interface GetTokensByTokenIdsData {
  tokens: Token[]
}

/**
 * Extract tokenIds from referredBy references
 */
function extractReferredByTokenIds(token: Token | null): string[] {
  if (!token?.referredBy || !Array.isArray(token.referredBy)) {
    return []
  }

  return token.referredBy
    .map((ref: TokenReference) => {
      const fromToken = ref.fromToken
      if (fromToken && 'tokenId' in fromToken) {
        return fromToken.tokenId
      }
      return null
    })
    .filter((id): id is string => id !== null)
}

/**
 * Hook to fetch the referredBy chain for a token
 * Recursively fetches tokens that reference the current token until chain ends
 *
 * @param token - The current token to find referrers for
 * @param maxDepth - Maximum depth to traverse (default: Infinity - fetches entire chain)
 */
export function useReferredByChain(
  token: Token | null,
  maxDepth: number = Infinity
): UseReferredByChainResult {
  // State to track all generations
  const [generations, setGenerations] = useState<Token[][]>([])
  const [currentDepth, setCurrentDepth] = useState(0)
  const [pendingTokenIds, setPendingTokenIds] = useState<string[]>([])

  // Extract first generation token IDs from the current token's referredBy
  const firstGenTokenIds = useMemo(() => {
    return extractReferredByTokenIds(token)
  }, [token])

  // Reset when token changes
  useEffect(() => {
    setGenerations([])
    setCurrentDepth(0)
    if (firstGenTokenIds.length > 0) {
      setPendingTokenIds(firstGenTokenIds)
    } else {
      setPendingTokenIds([])
    }
  }, [token?.id, firstGenTokenIds])

  // Query tokens by IDs
  const {
    data,
    loading,
    error,
  } = useQuery<GetTokensByTokenIdsData>(GET_TOKENS_BY_TOKEN_IDS, {
    variables: {
      tokenIds: pendingTokenIds,
      first: 100
    },
    skip: pendingTokenIds.length === 0,
    notifyOnNetworkStatusChange: true,
    errorPolicy: 'all',
    fetchPolicy: 'cache-first'
  })

  // Process fetched tokens and queue next generation
  useEffect(() => {
    if (loading || !data?.tokens || pendingTokenIds.length === 0) {
      return
    }

    const fetchedTokens = data.tokens

    // Add current generation
    setGenerations(prev => {
      const newGenerations = [...prev]
      // Ensure we're adding at the right depth
      if (newGenerations.length === currentDepth) {
        newGenerations.push(fetchedTokens)
      }
      return newGenerations
    })

    // Check if we should fetch next generation
    if (currentDepth + 1 < maxDepth) {
      // Collect all referredBy tokenIds from fetched tokens
      const nextGenTokenIds = new Set<string>()
      fetchedTokens.forEach(t => {
        const refIds = extractReferredByTokenIds(t)
        refIds.forEach(id => nextGenTokenIds.add(id))
      })

      if (nextGenTokenIds.size > 0) {
        setCurrentDepth(prev => prev + 1)
        setPendingTokenIds(Array.from(nextGenTokenIds))
      } else {
        setPendingTokenIds([])
      }
    } else {
      setPendingTokenIds([])
    }
  }, [data?.tokens, loading, currentDepth, maxDepth, pendingTokenIds.length])

  // Calculate max tokens per row
  const maxTokensPerRow = useMemo(() => {
    if (generations.length === 0) return 0
    return Math.max(...generations.map(gen => gen.length))
  }, [generations])

  // Calculate expected generation count for skeleton height
  // Uses tree.maxGeneration - token.generation for accurate pre-calculation
  // All tokens in referredBy chain belong to the same tree (contract guarantees this)
  const expectedGenerationCount = useMemo(() => {
    if (!token?.tree?.maxGeneration) return 0

    const tokenGen = parseInt(token.generation, 10)
    const maxGen = parseInt(token.tree.maxGeneration, 10)

    // Safety guard: ensure non-negative result
    return Math.max(0, maxGen - tokenGen)
  }, [token?.generation, token?.tree?.maxGeneration])

  return {
    generations,
    loading: loading || pendingTokenIds.length > 0,
    error: error ?? null,
    maxTokensPerRow,
    expectedGenerationCount
  }
}

export default useReferredByChain
