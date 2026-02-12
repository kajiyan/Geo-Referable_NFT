import { useQuery } from '@apollo/client/react'
import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { Token } from '@/types/index'
import { GET_TREE_TOKENS } from '@/lib/graphql/queries'
import { processGenerationData, GenerationProcessorResult } from '@/utils/generationProcessor'

function validateTokenData(tokens: Token[]): Token[] {
  if (!Array.isArray(tokens)) {
    console.warn('Invalid tokens data: expected array, got', typeof tokens)
    return []
  }
  
  return tokens.filter(token => {
    if (!token || typeof token !== 'object') {
      console.warn('Invalid token object:', token)
      return false
    }
    
    if (!token.id || !token.tokenId) {
      console.warn('Token missing required fields (id, tokenId):', token)
      return false
    }
    
    return true
  }).map(token => ({
    ...token,
    referringTo: Array.isArray(token.referringTo) ? token.referringTo : [],
    referredBy: Array.isArray(token.referredBy) ? token.referredBy : []
  }))
}

export interface UseTreeTokensResult {
  tokens: Token[]
  generationData: GenerationProcessorResult
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
  isEmpty: boolean
}

interface GetTreeTokensData {
  treeTokens: Token[]
}

export function useTreeTokens(
  tree: string | null
): UseTreeTokensResult {
  const [processingError, setProcessingError] = useState<Error | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  
  const treeNumber = useMemo(() => {
    if (!tree || typeof tree !== 'string' || tree.trim() === '') {
      return null
    }
    
    const trimmed = tree.trim()
    const parsed = parseInt(trimmed, 10)
    
    if (isNaN(parsed) || parsed < 0 || parsed > Number.MAX_SAFE_INTEGER) {
      console.warn('Invalid tree number:', tree)
      return null
    }
    
    if (trimmed !== parsed.toString()) {
      console.warn('Tree parameter contains non-numeric characters:', tree)
    }
    
    return parsed
  }, [tree])

  const { data, loading, error: queryError, refetch: refetchQuery } = useQuery<GetTreeTokensData>(
    GET_TREE_TOKENS,
    {
      variables: {
        treeId: treeNumber
      },
      skip: treeNumber === null,
      notifyOnNetworkStatusChange: true,
      errorPolicy: 'all',
      fetchPolicy: 'cache-and-network'
    }
  )

  const tokens = useMemo(() => {
    try {
      const rawTokens = data?.treeTokens || []
      return validateTokenData(rawTokens)
    } catch (error) {
      console.error('Error validating token data:', error)
      return []
    }
  }, [data?.treeTokens])
  
  const generationResult = useMemo(() => {
    if (!tokens.length) {
      return {
        generations: [],
        totalTokens: 0,
        generationRange: {
          min: 0,
          max: 0
        },
        stats: {
          averageTokensPerGeneration: 0,
          generationsWithTokens: 0
        }
      }
    }

    try {
      setProcessingError(null)
      return processGenerationData(tokens)
    } catch (error) {
      console.error('Error processing generation data:', error)
      setProcessingError(error instanceof Error ? error : new Error('Generation processing failed'))
      return {
        generations: [],
        totalTokens: 0,
        generationRange: {
          min: 0,
          max: 0
        },
        stats: {
          averageTokensPerGeneration: 0,
          generationsWithTokens: 0
        }
      }
    }
  }, [tokens])

  const refetch = useCallback(async () => {
    if (treeNumber === null) {
      console.warn('Cannot refetch: no valid tree number')
      return
    }

    abortControllerRef.current?.abort()
    abortControllerRef.current = new AbortController()
    
    try {
      await refetchQuery({
        treeId: treeNumber
      })
    } catch (error: unknown) {
      if ((error as Error)?.name !== 'AbortError') {
        console.error('Error refetching tree tokens for tree', treeNumber, ':', error)
        setProcessingError(
          error instanceof Error ? error : new Error(`Failed to refetch tree ${treeNumber}`)
        )
      }
    }
  }, [refetchQuery, treeNumber])

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  const error = queryError || processingError
  const isEmpty = !loading && tokens.length === 0 && !error

  return {
    tokens,
    generationData: generationResult,
    loading,
    error,
    refetch,
    isEmpty
  }
}

export default useTreeTokens