/**
 * Zod validation schemas for API requests and responses.
 *
 * Provides type-safe runtime validation using Zod's safeParse pattern
 * which returns discriminated unions for ergonomic error handling.
 *
 * @example
 * const result = parseSignatureResponse(jsonData)
 * if (result.success) {
 *   // result.data is typed as SignatureResponse
 *   console.log(result.data.signature)
 * } else {
 *   // result.error is typed as z.ZodError
 *   console.error(result.error.issues)
 * }
 */

import { z } from 'zod'

// ============================================================================
// Primitive Validators
// ============================================================================

/**
 * Validates Ethereum hex strings (0x-prefixed).
 */
const hexString = z.string().regex(/^0x[a-fA-F0-9]+$/, 'Must be a valid hex string')

/**
 * Validates Ethereum addresses (42 characters with 0x prefix).
 */
const ethereumAddress = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Must be a valid Ethereum address')
  .transform((val) => val as `0x${string}`)

/**
 * Validates H3 index strings (15 hex chars without 0x prefix).
 */
const h3Index = z.string().regex(/^[a-fA-F0-9]{15}$/, 'Must be a valid H3 index')

/**
 * Validates BigInt strings (numeric only, for JSON serialization).
 */
const bigIntString = z.string().regex(/^-?\d+$/, 'Must be a numeric string')

// ============================================================================
// H3 Values Schema
// ============================================================================

/**
 * Schema for H3 geospatial index values at multiple resolutions.
 */
export const h3ValuesSchema = z.object({
  h3r6: h3Index,
  h3r8: h3Index,
  h3r10: h3Index,
  h3r12: h3Index,
})

export type H3ValuesSchema = z.infer<typeof h3ValuesSchema>

// ============================================================================
// Signature Response Schema
// ============================================================================

/**
 * Schema for successful signature API response.
 *
 * Validates all fields returned by /api/signature on success.
 */
export const signatureResponseSchema = z.object({
  /** EIP-712 signature from server signer */
  signature: hexString.transform((val) => val as `0x${string}`),

  /** Server-computed H3 values for verification */
  h3Values: h3ValuesSchema,

  /** Weather-based color index (0-255) */
  computedColorIndex: z.number().int().min(0).max(255),

  /** Source of the color index */
  colorIndexSource: z.enum(['api', 'cache', 'seasonal_default']),

  /** Computed elevation in meters */
  computedElevation: z.number(),

  /** Source of the elevation */
  elevationSource: z.enum(['gsi', 'open-meteo', 'cache', 'default']),

  /** Pre-scaled latitude as string for BigInt parsing */
  scaledLatitude: bigIntString,

  /** Pre-scaled longitude as string for BigInt parsing */
  scaledLongitude: bigIntString,

  /** Pre-scaled elevation as string for BigInt parsing */
  scaledElevation: bigIntString,

  /** Nonce for signature uniqueness */
  nonce: bigIntString,

  /** Response timestamp */
  timestamp: z.string(),

  /** Request ID for debugging */
  requestId: z.string(),
})

export type SignatureResponseSchema = z.infer<typeof signatureResponseSchema>

// ============================================================================
// Error Response Schema
// ============================================================================

/**
 * Schema for error responses from the signature API.
 */
export const errorResponseSchema = z.object({
  /** Error code from SecureErrorHandler */
  error: z.string(),

  /** Human-readable error message */
  message: z.string(),

  /** Additional validation details */
  details: z.array(z.string()).optional(),

  /** Response timestamp */
  timestamp: z.string(),

  /** Request ID for debugging */
  requestId: z.string(),

  /** Retry-after seconds (for rate limiting) */
  retryAfter: z.number().int().positive().optional(),
})

export type ErrorResponseSchema = z.infer<typeof errorResponseSchema>

// ============================================================================
// Request Schemas
// ============================================================================

/**
 * Base request schema for signature API.
 */
export const signatureRequestBaseSchema = z.object({
  /** User's wallet address */
  address: ethereumAddress,

  /** GPS latitude in degrees (-90 to 90) */
  latitude: z.number().min(-90).max(90),

  /** GPS longitude in degrees (-180 to 180) */
  longitude: z.number().min(-180).max(180),

  /** User's message (max 54 chars) */
  text: z.string().min(1).max(54),
})

/**
 * Extended request schema for chain mint.
 */
export const signatureRequestChainSchema = signatureRequestBaseSchema.extend({
  /** Contract addresses of referenced tokens */
  refAddresses: z.array(ethereumAddress).min(1),

  /** Token IDs being referenced (as strings for JSON) */
  refTokenIds: z.array(z.string()).min(1),
})

// ============================================================================
// Parse Functions (with discriminated union return types)
// ============================================================================

/**
 * Result type for safe parsing operations.
 * Uses Zod's SafeParseReturnType for discriminated union pattern.
 */
export type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: z.ZodError }

/**
 * Safely parse and validate a signature response.
 *
 * @param data - Raw data from JSON.parse or response.json()
 * @returns Discriminated union with typed data or error
 *
 * @example
 * const result = parseSignatureResponse(await response.json())
 * if (result.success) {
 *   const { signature, scaledLatitude } = result.data
 *   // Use typed data...
 * } else {
 *   console.error('Validation failed:', result.error.issues)
 * }
 */
export function parseSignatureResponse(data: unknown): ParseResult<SignatureResponseSchema> {
  const result = signatureResponseSchema.safeParse(data)
  return result.success
    ? { success: true, data: result.data }
    : { success: false, error: result.error }
}

/**
 * Safely parse and validate an error response.
 *
 * @param data - Raw data from JSON.parse or response.json()
 * @returns Discriminated union with typed data or error
 */
export function parseErrorResponse(data: unknown): ParseResult<ErrorResponseSchema> {
  const result = errorResponseSchema.safeParse(data)
  return result.success
    ? { success: true, data: result.data }
    : { success: false, error: result.error }
}

/**
 * Safely parse and validate H3 values.
 *
 * @param data - Raw H3 values object
 * @returns Discriminated union with typed data or error
 */
export function parseH3Values(data: unknown): ParseResult<H3ValuesSchema> {
  const result = h3ValuesSchema.safeParse(data)
  return result.success
    ? { success: true, data: result.data }
    : { success: false, error: result.error }
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Format Zod validation errors into a human-readable string.
 *
 * @param error - Zod validation error
 * @returns Formatted error message
 */
export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''
      return `${path}${issue.message}`
    })
    .join('; ')
}

/**
 * Check if a value is a valid signature response without parsing.
 *
 * @param data - Data to validate
 * @returns true if valid, false otherwise
 */
export function isValidSignatureResponse(data: unknown): data is SignatureResponseSchema {
  return signatureResponseSchema.safeParse(data).success
}
