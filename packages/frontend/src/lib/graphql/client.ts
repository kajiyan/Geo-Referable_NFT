import { ApolloClient, InMemoryCache, createHttpLink, Reference } from '@apollo/client'
import { GraphQLError } from 'graphql'

// Custom Apollo Error type since ApolloError may not be directly exportable
interface ApolloLikeError {
  networkError?: Error | null
  graphQLErrors?: GraphQLError[]
}

// Amoy testnet endpoint (Polygon zkEVM - recommended for testing)
const AMOY_SUBGRAPH_URL = process.env.NEXT_PUBLIC_AMOY_SUBGRAPH_URL || ''

// Polygon mainnet endpoint (production)
const POLYGON_SUBGRAPH_URL = process.env.NEXT_PUBLIC_POLYGON_SUBGRAPH_URL || ''

// Sepolia testnet endpoint (legacy - deprecated)
const SEPOLIA_SUBGRAPH_URL = process.env.NEXT_PUBLIC_SEPOLIA_SUBGRAPH_URL || ''

/**
 * Get Subgraph URL based on environment
 */
export function getSubgraphUrl(): string {
  const network = process.env.NEXT_PUBLIC_NETWORK || 'amoy'

  switch (network) {
    case 'polygon':
      if (!POLYGON_SUBGRAPH_URL) {
        console.warn('Polygon mainnet subgraph URL not configured, falling back to Amoy testnet')
        if (!AMOY_SUBGRAPH_URL) {
          throw new Error('Amoy testnet subgraph URL is not configured. Set NEXT_PUBLIC_AMOY_SUBGRAPH_URL')
        }
        return AMOY_SUBGRAPH_URL
      }
      return POLYGON_SUBGRAPH_URL
    case 'sepolia':
      // Legacy support for Sepolia
      console.warn('Sepolia network is deprecated. Please migrate to Amoy testnet.')
      if (!SEPOLIA_SUBGRAPH_URL) {
        throw new Error('Sepolia subgraph URL is not configured. Set NEXT_PUBLIC_SEPOLIA_SUBGRAPH_URL or migrate to Amoy')
      }
      return SEPOLIA_SUBGRAPH_URL
    case 'amoy':
    default:
      if (!AMOY_SUBGRAPH_URL) {
        throw new Error('Amoy testnet subgraph URL is not configured. Set NEXT_PUBLIC_AMOY_SUBGRAPH_URL')
      }
      return AMOY_SUBGRAPH_URL
  }
}

/**
 * HTTPリンクを作成
 */
const httpLink = createHttpLink({
  uri: getSubgraphUrl(),
})

/**
 * Apollo Clientインスタンス
 */
export const apolloClient = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          tokens: {
            keyArgs: ['where'],
            merge(existing = [], incoming, { readField }) {
              // 効率的な重複除去のためMapを使用
              const tokenMap = new Map<string, Reference>();

              // 既存トークンをMapに追加
              for (const token of existing) {
                const id = readField('id', token) as string;
                if (id) tokenMap.set(id, token);
              }

              // 新規トークンを追加/更新
              for (const token of incoming) {
                const id = readField('id', token) as string;
                if (id) tokenMap.set(id, token);
              }

              // 配列に変換し、createdAt DESC でソート（新しい順）
              const merged = Array.from(tokenMap.values());

              const ZERO = BigInt(0);
              merged.sort((a, b) => {
                const createdAtA = readField('createdAt', a) as string || '0';
                const createdAtB = readField('createdAt', b) as string || '0';

                // BigInt比較で精度を保証
                const timeDiff = BigInt(createdAtB) - BigInt(createdAtA);
                if (timeDiff > ZERO) return 1;
                if (timeDiff < ZERO) return -1;

                // 同一タイムスタンプの場合はtokenIdで安定ソート（降順）
                const tokenIdA = readField('tokenId', a) as string || '0';
                const tokenIdB = readField('tokenId', b) as string || '0';
                const idDiff = BigInt(tokenIdB) - BigInt(tokenIdA);
                return idDiff > ZERO ? 1 : idDiff < ZERO ? -1 : 0;
              });

              return merged;
            }
          }
        }
      },
      Token: {
        keyFields: ['id'],
        merge: true,  // 部分的なエンティティのマージを許可（Missing field警告を回避）
        fields: {
          referringTo: {
            merge(existing = [], incoming, { readField }) {
              const existingIds = new Set(existing.map((t: Reference) => readField('id', t)))
              const newTokens = incoming.filter((t: Reference) => !existingIds.has(readField('id', t)))
              return [...existing, ...newTokens]
            }
          },
          referredBy: {
            merge(existing = [], incoming, { readField }) {
              const existingIds = new Set(existing.map((t: Reference) => readField('id', t)))
              const newTokens = incoming.filter((t: Reference) => !existingIds.has(readField('id', t)))
              return [...existing, ...newTokens]
            }
          }
        }
      },
      User: {
        keyFields: ['id'],
      },
      MintEvent: {
        keyFields: ['id'],
      },
      Transfer: {
        keyFields: ['id'],
      },
      GlobalStats: {
        keyFields: ['id'],
      },
    },
  }),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
    },
    query: {
      // Use cache-first to reduce Subgraph load
      // Zoom-adaptive queries ensure fresh data when viewport changes significantly
      fetchPolicy: 'cache-first',
      errorPolicy: 'all',
    },
  },
})

/**
 * Subgraphのエラーハンドリング
 */
export function handleSubgraphError(error: ApolloLikeError | Error | unknown): string {
  if (!error) {
    return 'An unexpected error occurred while querying the subgraph.'
  }
  
  // Type guard for objects
  if (typeof error !== 'object' || error === null) {
    return 'An unexpected error occurred while querying the subgraph.'
  }
  
  // Check for Apollo-like error structure
  if ('networkError' in error && (error as ApolloLikeError).networkError) {
    return 'Network error: Unable to reach the subgraph. Please check your connection.'
  }
  
  if ('graphQLErrors' in error && (error as ApolloLikeError).graphQLErrors && (error as ApolloLikeError).graphQLErrors!.length > 0) {
    return `GraphQL error: ${(error as ApolloLikeError).graphQLErrors!.map((e: GraphQLError) => e.message).join(', ')}`
  }
  
  return 'An unexpected error occurred while querying the subgraph.'
}