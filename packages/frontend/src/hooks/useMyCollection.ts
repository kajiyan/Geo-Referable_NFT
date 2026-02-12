import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAccount } from 'wagmi'
import { useQuery } from '@apollo/client/react'
import { GET_MY_COLLECTION_PAGE } from '@/lib/graphql/queries'
import { Token } from '@/types'

export interface UseMyCollectionResult {
  tokens: Token[] | null
  totalCount: number
  loading: boolean
  error: Error | null
  isConnected: boolean
  address: string | undefined
  targetAddress: string | undefined
  isOwnCollection: boolean
  refetch: () => Promise<void>
  hasMore: boolean
  loadMore: () => Promise<void>
  isLoadingMore: boolean
}

interface GetMyCollectionPageData {
  tokens: Token[]
  user: { id: string; balance: string } | null
}

const ITEMS_PER_PAGE = 20

/**
 * トークンを新しい順（createdAt DESC）でソートするヘルパー関数
 * Apollo Cacheのマージポリシーでソートされるが、防御的にクライアント側でも適用
 */
function sortTokensByNewest(tokens: Token[]): Token[] {
  const ZERO = BigInt(0);
  return [...tokens].sort((a, b) => {
    // createdAt DESC (新しい順)
    const timeDiff = BigInt(b.createdAt) - BigInt(a.createdAt);
    if (timeDiff !== ZERO) {
      return timeDiff > ZERO ? 1 : -1;
    }
    // 同一ブロックの場合はtokenIdでタイブレーク（降順）
    const idDiff = BigInt(b.tokenId) - BigInt(a.tokenId);
    return idDiff > ZERO ? 1 : idDiff < ZERO ? -1 : 0;
  });
}

export function useMyCollection(walletAddress?: string): UseMyCollectionResult {
  const { address: connectedAddress, isConnected } = useAccount()
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  // hasMore を判定するため、最後の取得件数を追跡（ownerBalance 未取得時のフォールバック）
  const [lastFetchCount, setLastFetchCount] = useState<number | null>(null)

  // walletAddress が指定されていればそれを使用、なければ接続中アドレス
  const targetAddress = useMemo(() =>
    (walletAddress || connectedAddress)?.toLowerCase(),
    [walletAddress, connectedAddress]
  )

  // 自分のコレクションかどうか判定
  const isOwnCollection = useMemo(() =>
    !walletAddress || walletAddress.toLowerCase() === connectedAddress?.toLowerCase(),
    [walletAddress, connectedAddress]
  )

  // tokens + User.balance を1クエリで取得
  // User.balance は Token エンティティを作らないため、Apollo Cache 汚染の懸念なし
  const { data, loading, error, refetch: refetchQuery, fetchMore } = useQuery<GetMyCollectionPageData>(
    GET_MY_COLLECTION_PAGE,
    {
      variables: {
        ownerAddress: targetAddress,
        userId: targetAddress,
        first: ITEMS_PER_PAGE,
        skip: 0
      },
      skip: !targetAddress,
      notifyOnNetworkStatusChange: true,
      errorPolicy: 'all',
      fetchPolicy: 'cache-and-network',
    }
  )

  // 防御的ソート: Apollo Cacheが正しくソートしていても念のため適用
  const tokens = useMemo(() => {
    if (!data?.tokens?.length) return [];
    // Apollo Clientの部分キャッシュから完全なTokenオブジェクトをフィルタリング
    const validTokens = data.tokens.filter((t): t is Token =>
      t !== undefined && t !== null && typeof t.tokenId === 'string'
    );
    return sortTokensByNewest(validTokens);
  }, [data?.tokens])

  // User.balance から正確な所有数を一度だけ変換（null = User未存在）
  const ownerBalance = useMemo(() =>
    data?.user != null ? Number(data.user.balance) : null,
    [data?.user]
  )

  const totalCount = ownerBalance ?? tokens.length

  // hasMore: 正確なownerBalanceがあればそれで判定、なければヒューリスティック
  const hasMore = useMemo(() => {
    if (!tokens.length) return false
    if (ownerBalance !== null) return tokens.length < ownerBalance
    if (lastFetchCount !== null) {
      return lastFetchCount >= ITEMS_PER_PAGE
    }
    return tokens.length >= ITEMS_PER_PAGE
  }, [tokens.length, ownerBalance, lastFetchCount])

  const loadMore = useCallback(async () => {
    if (!hasMore || loading || isLoadingMore || !tokens.length || !targetAddress) return

    setIsLoadingMore(true)

    try {
      await fetchMore({
        variables: {
          ownerAddress: targetAddress,
          userId: targetAddress,
          skip: tokens.length,
          first: ITEMS_PER_PAGE
        },
        updateQuery: (prev, { fetchMoreResult }) => {
          if (!fetchMoreResult?.tokens?.length) {
            setLastFetchCount(0)
            return prev
          }
          setLastFetchCount(fetchMoreResult.tokens.length)
          return {
            ...prev,
            tokens: [...prev.tokens, ...fetchMoreResult.tokens],
          }
        }
      })
    } finally {
      setIsLoadingMore(false)
    }
  }, [fetchMore, tokens.length, hasMore, loading, isLoadingMore, targetAddress])

  const refetch = useCallback(async () => {
    if (!targetAddress) return

    setLastFetchCount(null)

    const result = await refetchQuery({
      ownerAddress: targetAddress,
      userId: targetAddress,
      first: ITEMS_PER_PAGE,
      skip: 0
    })
    if (result.data?.tokens) {
      setLastFetchCount(result.data.tokens.length)
    }
  }, [refetchQuery, targetAddress])

  // アドレス変更時にリセット
  useEffect(() => {
    setLastFetchCount(null)
  }, [targetAddress])

  return {
    tokens,
    totalCount,
    loading,
    error: error || null,
    isConnected,
    address: connectedAddress,
    targetAddress,
    isOwnCollection,
    refetch,
    hasMore,
    loadMore,
    isLoadingMore
  }
}
