// Common types
export interface User {
  address: string
  isConnected: boolean
}

export interface NFT {
  tokenId: string
  owner: string
  tokenURI: string
  metadata?: NFTMetadata
}

export interface NFTMetadata {
  name: string
  description: string
  image: string
  attributes?: Attribute[]
}

export interface Attribute {
  trait_type: string
  value: string | number
}

// API Response types
export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

// Contract types
export interface ContractConfig {
  address: `0x${string}`
  abi: unknown[]
}

// GraphQL/Subgraph types (V3.1)

/**
 * Tree entity from Subgraph
 * Contains tree-level metadata including max generation for skeleton height calculation
 */
export interface TokenTree {
  id: string
  treeId: string
  maxGeneration: string // BigInt as string
  totalTokens: string // BigInt as string
}

export interface Token {
  id: string
  tokenId: string
  owner: {
    id: string
    address: string
  }
  latitude: string
  longitude: string
  elevation: string
  quadrant: number
  colorIndex: string // GraphQL BigInt is serialized as string
  treeId: string
  generation: string
  tree: TokenTree
  treeIndex: string
  h3r6: string
  h3r8: string
  h3r10: string
  h3r12: string
  message: string
  refCount: string
  totalDistance: string
  referringTo?: TokenReference[]
  referredBy?: TokenReference[]
  createdAt: string
  blockNumber: string
  transactionHash: string
}

export interface TokenReference {
  id: string
  fromToken: Token | {
    id: string
    tokenId: string
  }
  toToken: Token | {
    id: string
    tokenId: string
  }
  distance: string
  /** True if this is the initial/primary reference in the chain */
  isInitialReference?: boolean
  /** Unix timestamp when reference was created (from blockchain) */
  createdAt?: string
}

export interface GlobalStats {
  id: string
  totalTokens: string
  totalUsers: string
  totalTrees: string
  maxGeneration: string
  totalTransfers: string
  totalMints: string
  lastUpdated: string
}

// Token Graph Traversal types
export enum TraversalErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TOKEN_NOT_FOUND = 'TOKEN_NOT_FOUND', 
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SUBGRAPH_ERROR = 'SUBGRAPH_ERROR',
  ABORTED = 'ABORTED',
  TIMEOUT = 'TIMEOUT',
  MEMORY_LIMIT_EXCEEDED = 'MEMORY_LIMIT_EXCEEDED'
}

export class TraversalError extends Error {
  constructor(
    message: string,
    public readonly type: TraversalErrorType,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'TraversalError'
  }
}

export interface PerformanceMetrics {
  avgQueryTime: number
  cacheHitRate: number  
  networkRequestCount: number
  memoryUsage: number
  totalQueries: number
  failedQueries: number
  startTime: number
  endTime?: number
}

export interface TraversalOptions {
  maxDepth?: number
  maxTokens?: number
  batchSize?: number
  signal?: AbortSignal
  timeout?: number
  maxAge?: number
  onProgress?: (current: number, total: number, depth: number) => void
  onMetricsUpdate?: (metrics: PerformanceMetrics) => void
}

export interface TraversalState {
  visited: Set<string>
  queue: Array<{ tokenId: string; depth: number; timestamp: number }>
  tokens: Map<string, Token>
  currentDepth: number
  totalProcessed: number
  metrics: PerformanceMetrics
  isAborted: boolean
}

export interface TraversalResult {
  tokens: Map<string, Token>
  totalFound: number
  maxDepthReached: number
  isComplete: boolean
  metrics: PerformanceMetrics
  error?: TraversalError
}

// Re-export map-related types for convenience
export type { ProcessedToken } from './mapTypes'

// Re-export API types (EIP-712, signature response, etc.)
export * from './api'