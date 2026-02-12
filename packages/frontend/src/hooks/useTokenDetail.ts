import { useQuery } from '@apollo/client/react'
import { useMemo } from 'react'
import { Token } from '@/types/index'
import { GET_TOKEN_BY_TOKEN_ID, GET_TOKEN_ACTIVITY } from '@/lib/graphql/queries'

/**
 * Mint event type from subgraph
 */
export interface MintEvent {
  id: string
  tokenId: string
  to: {
    id: string
    address: string
  }
  from: string
  treeId: string
  generation: string
  h3r6: string
  h3r8: string
  h3r10: string
  h3r12: string
  timestamp: string
  blockNumber: string
  transactionHash: string
}

/**
 * Transfer event type from subgraph
 */
export interface TransferEvent {
  id: string
  tokenId: string
  from: {
    id: string
    address: string
  }
  to: {
    id: string
    address: string
  }
  timestamp: string
  blockNumber: string
  transactionHash: string
}

/**
 * Token activity combining mint and transfer events
 */
export interface TokenActivity {
  mintEvent: MintEvent | null
  transferEvents: TransferEvent[]
}

export interface UseTokenDetailResult {
  /** Token data (null if not found or loading) */
  token: Token | null
  /** Token activity (mint and transfer events) */
  activity: TokenActivity
  /** Loading state for token data */
  loading: boolean
  /** Loading state for activity data */
  activityLoading: boolean
  /** Error from token query */
  error: Error | null
  /** Error from activity query */
  activityError: Error | null
  /** Refetch token data */
  refetch: () => Promise<void>
  /** Refetch activity data */
  refetchActivity: () => Promise<void>
  /** True if token was not found after loading */
  notFound: boolean
}

interface GetTokenByTokenIdData {
  tokens: Token[]
}

interface GetTokenActivityData {
  mintEvents: MintEvent[]
  transferEvents: TransferEvent[]
}

/**
 * Validate token data from GraphQL response
 */
function validateToken(token: Token | undefined | null): Token | null {
  if (!token || typeof token !== 'object') {
    return null
  }

  if (!token.id || !token.tokenId) {
    console.warn('Token missing required fields (id, tokenId):', token)
    return null
  }

  return {
    ...token,
    referringTo: Array.isArray(token.referringTo) ? token.referringTo : [],
    referredBy: Array.isArray(token.referredBy) ? token.referredBy : []
  }
}

/**
 * Hook to fetch token detail by tokenId
 * @param tokenId - The numeric tokenId (as string from URL param)
 */
export function useTokenDetail(tokenId: string | null): UseTokenDetailResult {
  // Parse tokenId to BigInt string for GraphQL
  const parsedTokenId = useMemo(() => {
    if (!tokenId || typeof tokenId !== 'string' || tokenId.trim() === '') {
      return null
    }

    const trimmed = tokenId.trim()
    // Validate it's a valid numeric string (BigInt compatible)
    if (!/^\d+$/.test(trimmed)) {
      console.warn('Invalid tokenId format:', tokenId)
      return null
    }

    return trimmed
  }, [tokenId])

  // Query token data
  const {
    data: tokenData,
    loading: tokenLoading,
    error: tokenError,
    refetch: refetchToken
  } = useQuery<GetTokenByTokenIdData>(GET_TOKEN_BY_TOKEN_ID, {
    variables: {
      tokenId: parsedTokenId
    },
    skip: parsedTokenId === null,
    notifyOnNetworkStatusChange: true,
    errorPolicy: 'all',
    fetchPolicy: 'cache-and-network'
  })

  // Query activity data
  const {
    data: activityData,
    loading: activityLoading,
    error: activityError,
    refetch: refetchActivityQuery
  } = useQuery<GetTokenActivityData>(GET_TOKEN_ACTIVITY, {
    variables: {
      tokenId: parsedTokenId,
      first: 20
    },
    skip: parsedTokenId === null,
    notifyOnNetworkStatusChange: true,
    errorPolicy: 'all',
    fetchPolicy: 'cache-and-network'
  })

  // Process token data
  const token = useMemo(() => {
    const rawToken = tokenData?.tokens?.[0]
    return validateToken(rawToken)
  }, [tokenData?.tokens])

  // Process activity data
  const activity = useMemo<TokenActivity>(() => {
    return {
      mintEvent: activityData?.mintEvents?.[0] ?? null,
      transferEvents: activityData?.transferEvents ?? []
    }
  }, [activityData])

  // Refetch handlers
  const refetch = async () => {
    if (parsedTokenId === null) {
      console.warn('Cannot refetch: no valid tokenId')
      return
    }
    await refetchToken({ tokenId: parsedTokenId })
  }

  const refetchActivity = async () => {
    if (parsedTokenId === null) {
      console.warn('Cannot refetch activity: no valid tokenId')
      return
    }
    await refetchActivityQuery({ tokenId: parsedTokenId, first: 20 })
  }

  // Determine notFound state
  const notFound = !tokenLoading && !token && parsedTokenId !== null && !tokenError

  return {
    token,
    activity,
    loading: tokenLoading,
    activityLoading,
    error: tokenError ?? null,
    activityError: activityError ?? null,
    refetch,
    refetchActivity,
    notFound
  }
}

export default useTokenDetail
