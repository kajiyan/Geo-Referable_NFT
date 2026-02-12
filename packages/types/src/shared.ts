/**
 * Shared Types for GeoReferableNFT (NOROSI)
 *
 * Common types used across frontend, client SDK, and other packages.
 * These types bridge contract and subgraph data for application use.
 */

import type { Address, Hash } from 'viem';
import type { H3Params, ContractCoordinate } from './contract';

// ============================================================================
// Coordinate System Types
// ============================================================================

/**
 * Geographic coordinate in degrees (human-readable)
 */
export interface GeoCoordinate {
  latitude: number;  // -90 to 90
  longitude: number; // -180 to 180
}

/**
 * Geographic coordinate with elevation
 */
export interface GeoCoordinateWithElevation extends GeoCoordinate {
  elevation: number; // meters
}

/**
 * Full geographic location data
 */
export interface GeoLocation extends GeoCoordinateWithElevation {
  h3r6: string;
  h3r8: string;
  h3r10: string;
  h3r12: string;
  quadrant: number;
  isBelowSeaLevel: boolean;
}

/**
 * Coordinate conversion helpers
 */
export interface CoordinateHelpers {
  /**
   * Convert degrees to contract format (millionths)
   * @example degreesToContract(35.6789) => 35678900n
   */
  degreesToContract(degrees: number): ContractCoordinate;

  /**
   * Convert contract format to degrees
   * @example contractToDegrees(35678900n) => 35.6789
   */
  contractToDegrees(contractValue: ContractCoordinate): number;
}

// ============================================================================
// Token Display Types
// ============================================================================

/**
 * Token metadata for display
 */
export interface TokenMetadata {
  tokenId: bigint;
  name: string;
  description: string;
  image: string; // SVG data URI
  attributes: TokenAttribute[];
}

/**
 * Token attribute for metadata
 */
export interface TokenAttribute {
  trait_type: string;
  value: string | number;
  display_type?: string;
}

/**
 * Complete token data for frontend display
 */
export interface TokenDisplay {
  // Basic info
  tokenId: bigint;
  owner: Address;

  // Location
  location: GeoLocation;

  // Visual attributes
  colorIndex: number;
  tree: bigint;
  generation: bigint;
  treeIndex: bigint | null;

  // Content
  message: string | null;

  // Relationships
  referringTo: bigint[];
  referredBy: bigint[];

  // Metadata
  metadata: TokenMetadata;
  createdAt: Date;
  updatedAt?: Date;
}

// ============================================================================
// Minting Flow Types
// ============================================================================

/**
 * User input for minting (before conversion)
 */
export interface MintInput {
  latitude: number;  // degrees
  longitude: number; // degrees
  elevation: number; // meters
  colorIndex: number; // 0-255
  message: string;
  referenceTokenIds?: bigint[]; // optional parent tokens
}

/**
 * Validated and converted mint data
 */
export interface PreparedMintData {
  latitude: ContractCoordinate;
  longitude: ContractCoordinate;
  elevation: bigint;
  colorIndex: bigint;
  message: string;
  h3: H3Params;
  refAddresses?: Address[];
  refTokenIds?: bigint[];
}

/**
 * Mint transaction result
 */
export interface MintResult {
  tokenId: bigint;
  transactionHash: Hash;
  blockNumber: bigint;
  gasUsed: bigint;
}

// ============================================================================
// Map and Discovery Types
// ============================================================================

/**
 * Map bounds for querying tokens
 */
export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/**
 * Map zoom level with corresponding H3 resolution
 */
export type MapZoomLevel = {
  zoom: number;
  h3Resolution: 'r6' | 'r8' | 'r10' | 'r12';
  description: string;
};

/**
 * Token cluster for map display
 */
export interface TokenCluster {
  h3Index: string;
  resolution: 'r6' | 'r8' | 'r10' | 'r12';
  tokenCount: number;
  tokens: bigint[];
  center: GeoCoordinate;
}

/**
 * Search filters for discovering tokens
 */
export interface TokenSearchFilters {
  bounds?: MapBounds;
  h3Indexes?: string[];
  generation?: bigint;
  tree?: bigint;
  colorIndex?: number;
  owner?: Address;
  hasMessage?: boolean;
  timeRange?: {
    from: Date;
    to: Date;
  };
}

// ============================================================================
// Reference Tree Types
// ============================================================================

/**
 * Token node in reference tree
 */
export interface TokenNode {
  tokenId: bigint;
  generation: bigint;
  treeIndex: bigint | null;
  children: TokenNode[];
  parent: bigint | null;
  location: GeoCoordinate;
}

/**
 * Complete reference tree
 */
export interface ReferenceTree {
  rootTokenId: bigint;
  tree: bigint;
  maxGeneration: bigint;
  totalTokens: number;
  nodes: Map<bigint, TokenNode>;
}

/**
 * Tree statistics
 */
export interface TreeStats {
  tree: bigint;
  totalTokens: number;
  maxGeneration: bigint;
  tokensByGeneration: Map<bigint, number>;
  createdAt: Date;
  lastMintAt: Date;
}

// ============================================================================
// Analytics and Statistics Types
// ============================================================================

/**
 * Global platform statistics
 */
export interface PlatformStats {
  totalTokens: bigint;
  totalUsers: bigint;
  totalTrees: bigint;
  maxGeneration: bigint;
  totalTransfers: bigint;
  totalMints: bigint;
  lastUpdated: Date;
}

/**
 * User statistics
 */
export interface UserStats {
  address: Address;
  totalTokens: number;
  totalMinted: number;
  totalReceived: number;
  totalSent: number;
  firstMintDate: Date;
  lastActivityDate: Date;
}

/**
 * Geographic distribution stats
 */
export interface GeoDistribution {
  h3Index: string;
  resolution: 'r6' | 'r8' | 'r10' | 'r12';
  tokenCount: number;
  uniqueOwners: number;
  avgGeneration: number;
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Coordinate validation
 */
export interface CoordinateValidation extends ValidationResult {
  coordinate?: GeoCoordinate;
}

/**
 * H3 index validation
 */
export interface H3Validation extends ValidationResult {
  h3Index?: string;
  resolution?: number;
}

// ============================================================================
// Network and Chain Types
// ============================================================================

/**
 * Supported networks
 */
export type SupportedNetwork = 'sepolia' | 'amoy' | 'mainnet' | 'localhost';

/**
 * Network configuration
 */
export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  explorerUrl: string;
  contractAddress: Address;
  subgraphUrl?: string;
}

/**
 * Multi-network configuration
 */
export type NetworkConfigs = Record<SupportedNetwork, NetworkConfig>;

// ============================================================================
// UI State Types
// ============================================================================

/**
 * Loading state
 */
export interface LoadingState {
  isLoading: boolean;
  message?: string;
}

/**
 * Error state
 */
export interface ErrorState {
  hasError: boolean;
  message?: string;
  code?: string;
  details?: unknown;
}

/**
 * Transaction state
 */
export type TransactionState =
  | { status: 'idle' }
  | { status: 'preparing' }
  | { status: 'signing' }
  | { status: 'pending'; hash: Hash }
  | { status: 'confirming'; hash: Hash }
  | { status: 'confirmed'; hash: Hash; result: MintResult }
  | { status: 'error'; error: string };

/**
 * Pagination state
 */
export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default values
 */
export const DEFAULTS = {
  /** Default page size for pagination */
  PAGE_SIZE: 20,

  /** Default color index */
  COLOR_INDEX: 0,

  /** Default elevation (sea level) */
  ELEVATION: 0,

  /** Default message max length */
  MESSAGE_MAX_LENGTH: 280,

  /** Map zoom levels with H3 resolutions */
  MAP_ZOOM_LEVELS: [
    { zoom: 1, h3Resolution: 'r6' as const, description: 'City level' },
    { zoom: 8, h3Resolution: 'r8' as const, description: 'District level' },
    { zoom: 12, h3Resolution: 'r10' as const, description: 'Street level' },
    { zoom: 16, h3Resolution: 'r12' as const, description: 'Building level' },
  ],
} as const;

/**
 * Coordinate limits
 */
export const COORDINATE_LIMITS = {
  LATITUDE: {
    MIN: -90,
    MAX: 90,
  },
  LONGITUDE: {
    MIN: -180,
    MAX: 180,
  },
  ELEVATION: {
    MIN: -11000, // Mariana Trench
    MAX: 8849,   // Mount Everest
  },
} as const;

/**
 * Color index names (0-13)
 */
export const COLOR_NAMES = [
  'Red',
  'Orange',
  'Yellow',
  'Green',
  'Cyan',
  'Blue',
  'Purple',
  'Pink',
  'Brown',
  'Gray',
  'Black',
  'White',
  'Gold',
  'Silver',
] as const;

/**
 * Generation display names
 */
export const GENERATION_NAMES = {
  0: 'Genesis',
  1: 'First',
  2: 'Second',
  3: 'Third',
} as const;
