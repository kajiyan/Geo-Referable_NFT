/**
 * Subgraph Types for GeoRelationalNFT (NOROSI)
 *
 * These types represent the indexed blockchain data from The Graph.
 * They correspond to the GraphQL schema in packages/subgraph/schema.graphql
 *
 * Version: 3.2.1
 * Last updated: 2025-11-02
 */

import type { Address, Hex } from 'viem';

// ============================================================================
// Entity Types (matching GraphQL schema V3.2.1)
// ============================================================================

/**
 * Token entity from subgraph
 */
export interface Token {
  id: Hex; // tokenId as hex string
  tokenId: bigint;
  owner: User;

  // Geographic data
  latitude: string; // BigDecimal as string
  longitude: string; // BigDecimal as string
  elevation: string; // BigDecimal as string
  quadrant: number;

  // H3 geospatial index (4-level structure)
  h3r6: string;  // H3 resolution 6 (~3.2km hexagons)
  h3r8: string;  // H3 resolution 8 (~0.5km hexagons)
  h3r10: string; // H3 resolution 10 (~0.07km hexagons)
  h3r12: string; // H3 resolution 12 (~0.01km hexagons)

  // H3 Cell entities (for efficient queries)
  h3CellR6: H3Cell;
  h3CellR8: H3Cell;
  h3CellR10: H3Cell;
  h3CellR12: H3Cell;

  // Token attributes
  colorIndex: number; // 0-13 (renamed from weather)
  treeId: bigint; // Tree ID for filtering
  tree: Tree; // Tree entity reference
  generation: bigint;
  treeIndex: bigint; // 0-999, max 1000 tokens per tree (now required)

  // Text content
  message: string; // Renamed from text

  // Reference count
  refCount: bigint; // Number of references this token has

  // Distance tracking (V3.2.1)
  totalDistance: bigint; // Sum of all reference distances (calculated in Subgraph)

  // Reference relationships (ERC-5521)
  referringTo: TokenReference[]; // Tokens this token references
  referredBy: TokenReference[]; // Tokens that reference this token

  // Metadata
  createdAt: bigint;
  blockNumber: bigint; // Renamed from createdAtBlock
  transactionHash: Hex; // Renamed from createdAtTx

  // Related events
  mintEvent: MintEvent | null;
  transferEvents: Transfer[];
  referenceUpdates: ReferenceUpdate[];
  refCountUpdates: RefCountUpdate[];
}

/**
 * TokenReference entity from subgraph (V3.2)
 * Optimized storage for ERC-5521 relationships
 */
export interface TokenReference {
  id: Hex; // fromToken.id + "-" + toToken.id
  fromToken: Token; // The token that is referring
  toToken: Token; // The token being referred to
  fromTokenId: bigint;
  toTokenId: bigint;

  // Distance metadata
  distance: bigint; // Distance between tokens in meters

  // NEW in V3.2: Tree structure tracking
  isInitialReference: boolean; // True if this is the first reference (tree root)

  // Coordinates (for client-side filtering without loading full Token)
  fromLatitude: string;
  fromLongitude: string;
  toLatitude: string;
  toLongitude: string;

  // Timestamp
  createdAt: bigint;
  blockNumber: bigint;
  transactionHash: Hex;
}

/**
 * Tree entity from subgraph (V3.1)
 * Cached tree statistics for O(1) queries
 */
export interface Tree {
  id: Hex; // Tree ID as hex string
  treeId: bigint; // Tree ID as BigInt

  // Tree statistics
  totalTokens: bigint; // Total tokens in this tree
  maxGeneration: bigint; // Highest generation number
  totalDistanceToMaxGen: bigint; // Cumulative distance to max generation (meters)

  // Timestamps
  firstTokenAt: bigint; // Timestamp of first token in tree
  lastTokenAt: bigint; // Timestamp of most recent token in tree

  // Relationships
  tokens: Token[]; // @derivedFrom(field: "tree")
  distanceRecords: DistanceRecord[]; // @derivedFrom(field: "tree")
}

/**
 * H3Cell entity from subgraph (V3.1)
 * Enables efficient viewport-based queries
 */
export interface H3Cell {
  id: Hex; // H3 index as hex string
  h3Index: string; // H3 index string
  resolution: number; // H3 resolution (6, 8, 10, or 12)

  // Token count in this cell
  tokenCount: bigint;

  // Relationships (varies by resolution)
  tokensR6?: Token[]; // @derivedFrom(field: "h3CellR6")
  tokensR8?: Token[]; // @derivedFrom(field: "h3CellR8")
  tokensR10?: Token[]; // @derivedFrom(field: "h3CellR10")
  tokensR12?: Token[]; // @derivedFrom(field: "h3CellR12")

  // Metadata
  firstTokenAt: bigint; // Timestamp of first token in cell
  lastTokenAt: bigint; // Timestamp of most recent token in cell
}

/**
 * DistanceRecord entity from subgraph (V3.2)
 * Immutable per-generation distance records
 */
export interface DistanceRecord {
  id: Hex; // tree ID + "-" + generation
  tree: Tree;
  treeId?: bigint; // Optional for backward compatibility
  generation: bigint;

  // Distance data
  distance: bigint; // Distance for this generation in meters
  cumulativeDistance: bigint; // Sum of all distances up to this generation

  // Previous generation reference (for verification)
  previousGeneration: bigint; // Previous generation number
  previousDistance: bigint; // Previous generation's distance

  // NEW in V3.2: Token that created this record
  recordedByToken: Hex | null; // Token ID that created this record (nullable)

  // Timestamp
  timestamp: bigint;
  blockNumber: bigint;
  transactionHash: Hex;
}

/**
 * RefCountUpdate entity from subgraph (V3.1)
 * Tracks reference count updates
 */
export interface RefCountUpdate {
  id: Hex; // Transaction hash + log index
  token: Token;
  tokenId: bigint;
  newRefCount: bigint;

  // Transaction details
  timestamp: bigint;
  blockNumber: bigint;
  transactionHash: Hex;
  logIndex: bigint;
}

/**
 * User entity from subgraph
 */
export interface User {
  id: Hex; // User address
  address: Address;
  balance: bigint;
  tokens: Token[];
  mintedTokens: MintEvent[];
  transfers: Transfer[];
  receivedTransfers: Transfer[];
  createdAt: bigint;
  updatedAt: bigint;
}

/**
 * MintEvent entity from subgraph
 */
export interface MintEvent {
  id: Hex; // Transaction hash + log index
  tokenId: bigint;
  token: Token;
  to: User;
  from: Hex | null; // Base token owner for mintWithChain
  tree: bigint;
  generation: bigint;

  // H3 geospatial index
  h3r6: string;
  h3r8: string;
  h3r10: string;
  h3r12: string;

  // Transaction details
  timestamp: bigint;
  blockNumber: bigint;
  transactionHash: Hex;
  logIndex: bigint;
}

/**
 * Transfer entity from subgraph
 */
export interface Transfer {
  id: Hex; // Transaction hash + log index
  tokenId: bigint;
  token: Token;
  from: User;
  to: User;

  // Transaction details
  timestamp: bigint;
  blockNumber: bigint;
  transactionHash: Hex;
  logIndex: bigint;
}

/**
 * ReferenceUpdate entity from subgraph
 */
export interface ReferenceUpdate {
  id: Hex; // Transaction hash + log index
  tokenId: bigint;
  token: Token;
  sender: Hex;

  // Reference data
  // Note: Multi-dimensional arrays stored as comma-separated strings
  // Example: ["1,2,3", "4,5"]
  referringContracts: Hex[];
  referringTokenIds: string[]; // Comma-separated token IDs
  referredContracts: Hex[];
  referredTokenIds: string[]; // Comma-separated token IDs

  // Transaction details
  timestamp: bigint;
  blockNumber: bigint;
  transactionHash: Hex;
  logIndex: bigint;
}

/**
 * MetadataUpdate entity from subgraph
 */
export interface MetadataUpdate {
  id: Hex; // Transaction hash + log index
  tokenId: bigint;
  token: Token;

  // Transaction details
  timestamp: bigint;
  blockNumber: bigint;
  transactionHash: Hex;
  logIndex: bigint;
}

/**
 * GlobalStats entity from subgraph
 */
export interface GlobalStats {
  id: Hex; // "global"
  totalTokens: bigint;
  totalUsers: bigint;
  totalTrees: bigint;
  maxGeneration: bigint;
  totalTransfers: bigint;
  totalMints: bigint;
  lastUpdated: bigint;
}

// ============================================================================
// Query Input Types
// ============================================================================

/**
 * Ordering direction for queries
 */
export type OrderDirection = 'asc' | 'desc';

/**
 * Common where clause for filtering
 */
export interface WhereClause {
  id?: string;
  id_gt?: string;
  id_lt?: string;
  id_in?: string[];
}

/**
 * Token query filters (V3.1)
 */
export interface TokenWhereInput extends WhereClause {
  tokenId?: bigint;
  tokenId_gt?: bigint;
  tokenId_lt?: bigint;
  owner?: string;
  generation?: bigint;
  generation_gt?: bigint;
  generation_lt?: bigint;
  treeId?: bigint; // Renamed from tree
  h3r6?: string;
  h3r8?: string;
  h3r10?: string;
  h3r12?: string;
  colorIndex?: number;
  refCount?: bigint;
  refCount_gt?: bigint;
  refCount_lt?: bigint;
}

/**
 * TokenReference query filters (V3.1)
 */
export interface TokenReferenceWhereInput extends WhereClause {
  fromToken?: string;
  toToken?: string;
  fromTokenId?: bigint;
  toTokenId?: bigint;
  distance_gt?: bigint;
  distance_lt?: bigint;
}

/**
 * Tree query filters (V3.1)
 */
export interface TreeWhereInput extends WhereClause {
  treeId?: bigint;
  totalTokens_gt?: bigint;
  totalTokens_lt?: bigint;
  maxGeneration_gt?: bigint;
  maxGeneration_lt?: bigint;
}

/**
 * H3Cell query filters (V3.1)
 */
export interface H3CellWhereInput extends WhereClause {
  h3Index?: string;
  h3Index_in?: string[];
  resolution?: number;
  tokenCount_gt?: bigint;
  tokenCount_lt?: bigint;
}

/**
 * DistanceRecord query filters (V3.1)
 */
export interface DistanceRecordWhereInput extends WhereClause {
  treeId?: bigint;
  generation?: bigint;
  generation_gt?: bigint;
  generation_lt?: bigint;
  distance_gt?: bigint;
  distance_lt?: bigint;
}

/**
 * User query filters
 */
export interface UserWhereInput extends WhereClause {
  address?: Address;
  balance_gt?: bigint;
}

/**
 * MintEvent query filters
 */
export interface MintEventWhereInput extends WhereClause {
  tokenId?: bigint;
  to?: string;
  tree?: bigint;
  generation?: bigint;
  timestamp_gt?: bigint;
  timestamp_lt?: bigint;
}

/**
 * Transfer query filters
 */
export interface TransferWhereInput extends WhereClause {
  tokenId?: bigint;
  from?: string;
  to?: string;
  timestamp_gt?: bigint;
  timestamp_lt?: bigint;
}

/**
 * Query options for pagination and ordering
 */
export interface QueryOptions {
  first?: number;
  skip?: number;
  orderBy?: string;
  orderDirection?: OrderDirection;
}

// ============================================================================
// Query Response Types
// ============================================================================

/**
 * Paginated query response
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  hasMore: boolean;
}

/**
 * Token query response
 */
export interface TokensResponse {
  tokens: Token[];
}

/**
 * TokenReference query response (V3.1)
 */
export interface TokenReferencesResponse {
  tokenReferences: TokenReference[];
}

/**
 * Tree query response (V3.1)
 */
export interface TreesResponse {
  trees: Tree[];
}

/**
 * H3Cell query response (V3.1)
 */
export interface H3CellsResponse {
  h3Cells: H3Cell[];
}

/**
 * DistanceRecord query response (V3.1)
 */
export interface DistanceRecordsResponse {
  distanceRecords: DistanceRecord[];
}

/**
 * User query response
 */
export interface UsersResponse {
  users: User[];
}

/**
 * MintEvent query response
 */
export interface MintEventsResponse {
  mintEvents: MintEvent[];
}

/**
 * Transfer query response
 */
export interface TransfersResponse {
  transfers: Transfer[];
}

/**
 * GlobalStats query response
 */
export interface GlobalStatsResponse {
  globalStats: GlobalStats | null;
}

// ============================================================================
// Utility Types for Subgraph Data
// ============================================================================

/**
 * H3 resolution levels with their corresponding data
 */
export interface H3Resolutions {
  r6: string;  // ~3.2 km (city-level)
  r8: string;  // ~0.5 km (district-level)
  r10: string; // ~0.07 km (street-level)
  r12: string; // ~0.01 km (building-level)
}

/**
 * Geographic bounds for filtering
 */
export interface GeoBounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

/**
 * Time range for filtering events
 */
export interface TimeRange {
  from: bigint;
  to: bigint;
}

/**
 * Parsed reference update data
 * Converts comma-separated strings back to arrays
 */
export interface ParsedReferenceUpdate extends Omit<ReferenceUpdate, 'referringTokenIds' | 'referredTokenIds'> {
  referringTokenIds: bigint[][]; // Parsed from comma-separated strings
  referredTokenIds: bigint[][]; // Parsed from comma-separated strings
}

// ============================================================================
// Helper Function Types
// ============================================================================

/**
 * Parse comma-separated token IDs
 */
export type ParseTokenIds = (tokenIdsString: string) => bigint[];

/**
 * Format BigDecimal string to number
 */
export type FormatBigDecimal = (value: string) => number;

/**
 * Convert timestamp to Date
 */
export type TimestampToDate = (timestamp: bigint) => Date;

// ============================================================================
// GraphQL Query Builder Types
// ============================================================================

/**
 * GraphQL query builder for tokens
 */
export interface TokenQueryBuilder {
  where?: TokenWhereInput;
  options?: QueryOptions;
}

/**
 * GraphQL query builder for token references (V3.1)
 */
export interface TokenReferenceQueryBuilder {
  where?: TokenReferenceWhereInput;
  options?: QueryOptions;
}

/**
 * GraphQL query builder for trees (V3.1)
 */
export interface TreeQueryBuilder {
  where?: TreeWhereInput;
  options?: QueryOptions;
}

/**
 * GraphQL query builder for H3 cells (V3.1)
 */
export interface H3CellQueryBuilder {
  where?: H3CellWhereInput;
  options?: QueryOptions;
}

/**
 * GraphQL query builder for distance records (V3.1)
 */
export interface DistanceRecordQueryBuilder {
  where?: DistanceRecordWhereInput;
  options?: QueryOptions;
}

/**
 * GraphQL query builder for users
 */
export interface UserQueryBuilder {
  where?: UserWhereInput;
  options?: QueryOptions;
}

/**
 * GraphQL query builder for mint events
 */
export interface MintEventQueryBuilder {
  where?: MintEventWhereInput;
  options?: QueryOptions;
}

/**
 * GraphQL query builder for transfers
 */
export interface TransferQueryBuilder {
  where?: TransferWhereInput;
  options?: QueryOptions;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Subgraph query limits
 */
export const SUBGRAPH_LIMITS = {
  /** Maximum items per query (The Graph limit) */
  MAX_QUERY_SIZE: 1000,

  /** Default page size */
  DEFAULT_PAGE_SIZE: 100,

  /** Maximum skip value (The Graph limit) */
  MAX_SKIP: 5000,
} as const;

/**
 * H3 resolution details
 */
export const H3_RESOLUTIONS = {
  r6: {
    level: 6,
    avgHexagonEdge: '3.23 km',
    avgHexagonArea: '36.13 km²',
    description: 'City-level discovery',
  },
  r8: {
    level: 8,
    avgHexagonEdge: '461 m',
    avgHexagonArea: '0.74 km²',
    description: 'District-level discovery',
  },
  r10: {
    level: 10,
    avgHexagonEdge: '65.9 m',
    avgHexagonArea: '0.015 km²',
    description: 'Street-level discovery',
  },
  r12: {
    level: 12,
    avgHexagonEdge: '9.4 m',
    avgHexagonArea: '0.0003 km²',
    description: 'Building-level discovery',
  },
} as const;
