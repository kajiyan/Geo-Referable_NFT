/**
 * @norosi/types - Shared TypeScript types for GeoRelationalNFT (NOROSI) monorepo
 *
 * This package provides type definitions for:
 * - Smart contract interactions
 * - Subgraph queries
 * - Shared application types
 * - Utility types and helpers
 *
 * @packageDocumentation
 */

// Re-export all types from submodules
export * from './contract';
export * from './subgraph';
export {
  // Coordinate types
  type GeoCoordinate as SharedGeoCoordinate,
  type GeoCoordinateWithElevation,
  type GeoLocation,
  type CoordinateHelpers,

  // Token display types
  type TokenMetadata,
  type TokenAttribute,
  type TokenDisplay,

  // Minting flow types
  type MintInput,
  type PreparedMintData,
  type MintResult,

  // Map and discovery types
  type MapBounds,
  type MapZoomLevel,
  type TokenCluster,
  type TokenSearchFilters,

  // Reference tree types
  type TokenNode,
  type ReferenceTree,
  type TreeStats,

  // Analytics types
  type PlatformStats,
  type UserStats,
  type GeoDistribution,

  // Validation types
  type ValidationResult,
  type ValidationError,
  type CoordinateValidation,
  type H3Validation,

  // Network types
  type SupportedNetwork,
  type NetworkConfig,
  type NetworkConfigs,

  // UI state types
  type LoadingState,
  type ErrorState,
  type TransactionState,
  type PaginationState,

  // Constants
  DEFAULTS,
  COORDINATE_LIMITS,
  COLOR_NAMES,
  GENERATION_NAMES,
} from './shared';
export * from './utils';

// Re-export viem types for convenience
export type { Address, Hash, Hex } from 'viem';
