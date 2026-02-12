/**
 * API type definitions for the NOROSI application.
 *
 * Centralizes EIP-712 type definitions and API response types for type safety
 * across the application. Uses Viem best practices with `as const` for
 * optimal type inference.
 *
 * @see https://viem.sh/docs/actions/wallet/signTypedData
 */

// Import H3Values from canonical location to avoid duplicate exports
import type { H3Values } from '@/utils/h3'

// Re-export for convenience (but don't duplicate the definition)
export type { H3Values }

// ============================================================================
// EIP-712 Domain Constants
// ============================================================================

/**
 * EIP-712 domain name for signature verification.
 * Must match the contract's DOMAIN_NAME.
 */
export const EIP712_DOMAIN_NAME = 'NOROSI' as const

/**
 * EIP-712 domain version for signature verification.
 * Must match the contract's DOMAIN_VERSION.
 */
export const EIP712_DOMAIN_VERSION = '2' as const

// ============================================================================
// EIP-712 Type Definitions (Viem best practice: use `as const`)
// ============================================================================

/**
 * Base EIP-712 type fields shared by Mint and MintWithChain.
 *
 * Field order matters for signature verification - must match contract exactly.
 * Using `as const` enables TypeScript to infer literal types for better type checking.
 */
export const EIP712_BASE_FIELDS = [
  { name: 'to', type: 'address' },
  { name: 'latitude', type: 'int256' },
  { name: 'longitude', type: 'int256' },
  { name: 'elevation', type: 'int256' },
  { name: 'colorIndex', type: 'uint256' },
  { name: 'message', type: 'string' },
  { name: 'h3r6', type: 'string' },
  { name: 'h3r8', type: 'string' },
  { name: 'h3r10', type: 'string' },
  { name: 'h3r12', type: 'string' },
  { name: 'nonce', type: 'uint256' },
] as const

/**
 * Additional EIP-712 type fields for chain mint (reference fields).
 * These are inserted after 'to' but before the coordinate fields.
 */
export const EIP712_CHAIN_FIELDS = [
  { name: 'refAddresses', type: 'address[]' },
  { name: 'refTokenIds', type: 'uint256[]' },
] as const

/**
 * Complete EIP-712 types object for basic Mint operation.
 * Ready to use with Viem's signTypedData.
 */
export const EIP712_MINT_TYPES = {
  Mint: EIP712_BASE_FIELDS,
} as const

/**
 * Complete EIP-712 types object for MintWithChain operation.
 * Field order: to, refAddresses, refTokenIds, latitude, longitude, ...
 */
export const EIP712_MINT_WITH_CHAIN_TYPES = {
  MintWithChain: [
    EIP712_BASE_FIELDS[0], // to
    ...EIP712_CHAIN_FIELDS, // refAddresses, refTokenIds
    ...EIP712_BASE_FIELDS.slice(1), // latitude, longitude, ...
  ],
} as const

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Signature API response for successful mint requests.
 *
 * Contains the cryptographic signature and all computed values needed
 * for the mint transaction.
 */
export interface SignatureResponse {
  /** EIP-712 signature from server signer */
  signature: `0x${string}`

  /** Server-computed H3 values for verification */
  h3Values: H3Values

  /** Weather-based color index (0-255) */
  computedColorIndex: number

  /** Source of the color index (api, cache, seasonal_default) */
  colorIndexSource: 'api' | 'cache' | 'seasonal_default'

  /** Computed elevation in meters */
  computedElevation: number

  /** Source of the elevation (gsi, open-meteo, cache, default) */
  elevationSource: 'gsi' | 'open-meteo' | 'cache' | 'default'

  /** Pre-scaled latitude (lat * 1e6) as string for BigInt parsing */
  scaledLatitude: string

  /** Pre-scaled longitude (lon * 1e6) as string for BigInt parsing */
  scaledLongitude: string

  /** Pre-scaled elevation (elevation * 1e4) as string for BigInt parsing */
  scaledElevation: string

  /** Nonce for signature uniqueness */
  nonce: string

  /** Signature expiration timestamp (Unix seconds) */
  deadline: string
}

/**
 * Error response from the signature API.
 */
export interface SignatureErrorResponse {
  /** Error code from SecureErrorHandler */
  error: string

  /** Human-readable error message */
  message: string

  /** Additional validation details (if applicable) */
  details?: string[]

  /** Response timestamp */
  timestamp: string

  /** Request ID for debugging */
  requestId: string

  /** Retry-after seconds (for rate limiting) */
  retryAfter?: number
}

// ============================================================================
// Request Types
// ============================================================================

/**
 * Base request body for signature API (basic mint).
 */
export interface SignatureRequestBase {
  /** User's wallet address */
  address: `0x${string}`

  /** GPS latitude in degrees */
  latitude: number

  /** GPS longitude in degrees */
  longitude: number

  /** User's message (max 54 chars) */
  text: string
}

/**
 * Extended request body for chain mint.
 */
export interface SignatureRequestChain extends SignatureRequestBase {
  /** Contract addresses of referenced tokens */
  refAddresses: `0x${string}`[]

  /** Token IDs being referenced (as strings for JSON) */
  refTokenIds: string[]
}

/**
 * Union type for all signature request variants.
 */
export type SignatureRequest = SignatureRequestBase | SignatureRequestChain

/**
 * Type guard to check if request is a chain mint request.
 */
export function isChainMintRequest(
  request: SignatureRequest
): request is SignatureRequestChain {
  return 'refAddresses' in request && 'refTokenIds' in request
}

// ============================================================================
// Mint Data Types (for useNorosi hook)
// ============================================================================

/**
 * Data required for signedMint contract call.
 * Uses pre-scaled BigInt values for exact signature match.
 */
export interface MintData {
  /** Pre-scaled latitude as BigInt */
  scaledLatitude: bigint

  /** Pre-scaled longitude as BigInt */
  scaledLongitude: bigint

  /** Pre-scaled elevation as BigInt */
  scaledElevation: bigint

  /** Weather-based color index */
  colorIndex: number

  /** User's message */
  text: string

  /** H3 index at resolution 6 */
  h3r6: string

  /** H3 index at resolution 8 */
  h3r8: string

  /** H3 index at resolution 10 */
  h3r10: string

  /** H3 index at resolution 12 */
  h3r12: string

  /** Server-generated EIP-712 signature */
  signature: `0x${string}`
}

/**
 * Extended data for signedMintWithChain contract call.
 */
export interface MintWithChainData extends MintData {
  /** Addresses of referenced token contracts */
  refAddresses: `0x${string}`[]

  /** Token IDs being referenced */
  refTokenIds: bigint[]
}
