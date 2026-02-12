/**
 * Contract Types for GeoRelationalNFT (NOROSI)
 *
 * These types represent the on-chain data structures and interfaces
 * for interacting with the GeoRelationalNFT smart contract.
 */

import type { Address, Hex } from 'viem';

// ============================================================================
// Core Contract Types
// ============================================================================

/**
 * Geographic coordinates in contract format (millionths of a degree)
 * - 35.6789° → 35,678,900
 * - -74.0060° → -74,006,000
 */
export type ContractCoordinate = bigint;

/**
 * Decoded token ID data structure
 * This is returned by the decodeTokenId function
 */
export interface DecodedTokenData {
  latitude: ContractCoordinate;
  longitude: ContractCoordinate;
  elevation: bigint;
  colorIndex: bigint;
  tree: bigint;
  generation: bigint;
  quadrant: bigint;
}

/**
 * ERC-5521 Reference structure
 * Represents a reference to another token
 */
export interface Reference {
  contractAddress: Address;
  tokenId: bigint;
}

/**
 * H3 geospatial index parameters (4-level structure)
 */
export interface H3Params {
  h3r6: string;  // ~3.2 km hexagons (city-level)
  h3r8: string;  // ~0.5 km hexagons (district-level)
  h3r10: string; // ~0.07 km hexagons (street-level)
  h3r12: string; // ~0.01 km hexagons (building-level)
}

/**
 * Metadata result from GeoMetadata contract
 */
export interface MetadataResult {
  latStr: string;
  lonStr: string;
  elevStr: string;
  distanceStr: string;
  attributes: string;
  isRare: boolean;
}

// ============================================================================
// Minting Parameters
// ============================================================================

/**
 * Basic mint parameters (without references)
 */
export interface MintParams {
  to: Address;
  latitude: ContractCoordinate;
  longitude: ContractCoordinate;
  elevation: bigint;
  colorIndex: bigint;
  message: string;
  h3: H3Params;
}

/**
 * Mint with chain parameters (includes references)
 */
export interface MintWithChainParams extends MintParams {
  refAddresses: Address[];
  refTokenIds: bigint[];
}

/**
 * Signed mint parameters (for EIP-712 signed minting)
 */
export interface SignedMintParams extends MintParams {
  signature: Hex;
}

/**
 * Signed mint with chain parameters
 */
export interface SignedMintWithChainParams extends MintWithChainParams {
  signature: Hex;
}

// ============================================================================
// Contract Events
// ============================================================================

/**
 * FumiMinted event parameters
 */
export interface FumiMintedEvent {
  tokenId: bigint;
  to: Address;
  from: Address;
  text: string;
  h3r6: string;
  h3r8: string;
  h3r10: string;
  h3r12: string;
}

/**
 * UpdateNode event parameters (ERC-5521)
 */
export interface UpdateNodeEvent {
  contractAddr: Address;
  tokenId: bigint;
  referAddresses: Address[];
  referTokenIds: bigint[];
}

/**
 * MetadataUpdate event parameters (ERC-4906)
 */
export interface MetadataUpdateEvent {
  tokenId: bigint;
}

/**
 * BatchMetadataUpdate event parameters (ERC-4906)
 */
export interface BatchMetadataUpdateEvent {
  fromTokenId: bigint;
  toTokenId: bigint;
}

// ============================================================================
// Contract Read Functions Return Types
// ============================================================================

/**
 * Result from getH3r6/r8/r10/r12 functions
 */
export type H3Index = string;

/**
 * Result from getMessage function
 */
export type TokenMessage = string;

/**
 * Result from referredOf function
 */
export interface ReferredOfResult {
  addresses: Address[];
  tokenIds: bigint[];
}

/**
 * Result from tokenURI function
 */
export type TokenURI = string;

// ============================================================================
// Coordinate Helper Types
// ============================================================================

/**
 * Geographic coordinate in degrees (human-readable format)
 */
export interface GeoCoordinate {
  latitude: number;  // -90 to 90
  longitude: number; // -180 to 180
}

/**
 * Quadrant encoding for tokenId
 * - 0: (+lat, +lon) - NE quadrant
 * - 1: (-lat, +lon) - SE quadrant
 * - 2: (+lat, -lon) - NW quadrant
 * - 3: (-lat, -lon) - SW quadrant
 */
export type Quadrant = 0 | 1 | 2 | 3;

/**
 * Token ID structure breakdown
 * tokenId = quadrant × 10^20 + |latitude| × 10^10 + |longitude|
 */
export interface TokenIdStructure {
  quadrant: Quadrant;
  latitude: ContractCoordinate;
  longitude: ContractCoordinate;
  tokenId: bigint;
}

// ============================================================================
// Helper Function Types
// ============================================================================

/**
 * Convert degrees to contract format (millionths)
 */
export type DegreesToContract = (degrees: number) => ContractCoordinate;

/**
 * Convert from contract format to degrees
 */
export type ContractToDegrees = (contractValue: ContractCoordinate) => number;

/**
 * Encode coordinates into tokenId
 */
export type EncodeTokenId = (latitude: ContractCoordinate, longitude: ContractCoordinate) => bigint;

/**
 * Decode tokenId into coordinates and metadata
 */
export type DecodeTokenId = (tokenId: bigint) => Promise<DecodedTokenData>;

// ============================================================================
// Contract Configuration
// ============================================================================

/**
 * Contract deployment information
 */
export interface ContractDeployment {
  chainId: number;
  contractAddress: Address;
  dateTime: Address;
  geoMath: Address;
  geoMetadata: Address;
  fumi: Address;
  blockNumber: bigint;
  deploymentDate: string;
}

/**
 * Network-specific deployments
 */
export interface NetworkDeployments {
  sepolia?: ContractDeployment;
  amoy?: ContractDeployment;
  mainnet?: ContractDeployment;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Contract custom errors
 */
export type ContractError =
  | 'InvalidCoordinates'
  | 'InvalidElevation'
  | 'InvalidColorIndex'
  | 'InvalidH3Index'
  | 'TokenDoesNotExist'
  | 'NotTokenOwner'
  | 'TooManyTokensInTree'
  | 'InvalidGeneration'
  | 'InvalidSignature'
  | 'NonceAlreadyUsed'
  | 'ContractPaused';

/**
 * Contract error with details
 */
export interface ContractErrorDetails {
  error: ContractError;
  message: string;
  data?: unknown;
}

// ============================================================================
// Constants
// ============================================================================
