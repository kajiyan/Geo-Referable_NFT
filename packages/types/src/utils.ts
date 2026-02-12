/**
 * Utility Types and Helper Functions for GeoReferableNFT (NOROSI)
 *
 * Type-safe utility functions for common operations.
 */

import type { ContractCoordinate } from './contract';
import type { GeoCoordinate, CoordinateValidation, H3Validation } from './shared';

// ============================================================================
// Coordinate Conversion
// ============================================================================

/**
 * Convert degrees to contract format (millionths)
 * @param degrees - Coordinate in degrees
 * @returns Contract format coordinate (millionths)
 * @example degreesToContract(35.6789) => 35678900n
 */
export function degreesToContract(degrees: number): ContractCoordinate {
  return BigInt(Math.round(degrees * 1_000_000));
}

/**
 * Convert from contract format to degrees
 * @param contractValue - Coordinate in contract format
 * @returns Coordinate in degrees
 * @example contractToDegrees(35678900n) => 35.6789
 */
export function contractToDegrees(contractValue: ContractCoordinate): number {
  return Number(contractValue) / 1_000_000;
}

/**
 * Convert elevation in meters to contract format
 * @param meters - Elevation in meters
 * @returns Contract format elevation (ten-thousandths)
 */
export function elevationToContract(meters: number): bigint {
  return BigInt(Math.round(meters * 10_000));
}

/**
 * Convert from contract format to meters
 * @param contractValue - Elevation in contract format
 * @returns Elevation in meters
 */
export function contractToElevation(contractValue: bigint): number {
  return Number(contractValue) / 10_000;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate geographic coordinates
 * @param coordinate - Coordinate to validate
 * @returns Validation result
 */
export function validateCoordinate(coordinate: GeoCoordinate): CoordinateValidation {
  const errors = [];

  if (coordinate.latitude < -90 || coordinate.latitude > 90) {
    errors.push({
      field: 'latitude',
      message: 'Latitude must be between -90 and 90 degrees',
      code: 'INVALID_LATITUDE',
    });
  }

  if (coordinate.longitude < -180 || coordinate.longitude > 180) {
    errors.push({
      field: 'longitude',
      message: 'Longitude must be between -180 and 180 degrees',
      code: 'INVALID_LONGITUDE',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    coordinate: errors.length === 0 ? coordinate : undefined,
  };
}

/**
 * Validate H3 index format
 * @param h3Index - H3 index string
 * @returns Validation result
 */
export function validateH3Index(h3Index: string): H3Validation {
  const errors = [];

  if (h3Index.length !== 15) {
    errors.push({
      field: 'h3Index',
      message: 'H3 index must be 15 characters',
      code: 'INVALID_H3_LENGTH',
    });
  }

  // H3 index should be hexadecimal
  if (!/^[0-9a-f]{15}$/i.test(h3Index)) {
    errors.push({
      field: 'h3Index',
      message: 'H3 index must be hexadecimal',
      code: 'INVALID_H3_FORMAT',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    h3Index: errors.length === 0 ? h3Index : undefined,
  };
}

/**
 * Validate color index
 * @param colorIndex - Color index (0-13, matches Fumi.sol COLOR_TABLE)
 * @returns true if valid
 */
export function validateColorIndex(colorIndex: number): boolean {
  return Number.isInteger(colorIndex) && colorIndex >= 0 && colorIndex <= 13;
}

/**
 * Validate elevation
 * @param elevation - Elevation in meters
 * @returns true if valid (roughly -11000 to 8849)
 */
export function validateElevation(elevation: number): boolean {
  return elevation >= -11000 && elevation <= 8849;
}

// ============================================================================
// Formatting
// ============================================================================

/**
 * Format coordinate for display
 * @param degrees - Coordinate in degrees
 * @param precision - Number of decimal places (default: 6)
 * @returns Formatted string
 */
export function formatCoordinate(degrees: number, precision: number = 6): string {
  return degrees.toFixed(precision);
}

/**
 * Format latitude with direction
 * @param latitude - Latitude in degrees
 * @returns Formatted string with N/S
 */
export function formatLatitude(latitude: number): string {
  const direction = latitude >= 0 ? 'N' : 'S';
  return `${formatCoordinate(Math.abs(latitude))}° ${direction}`;
}

/**
 * Format longitude with direction
 * @param longitude - Longitude in degrees
 * @returns Formatted string with E/W
 */
export function formatLongitude(longitude: number): string {
  const direction = longitude >= 0 ? 'E' : 'W';
  return `${formatCoordinate(Math.abs(longitude))}° ${direction}`;
}

/**
 * Format elevation for display
 * @param meters - Elevation in meters
 * @returns Formatted string
 */
export function formatElevation(meters: number): string {
  if (meters >= 0) {
    return `+${meters.toFixed(1)}m`;
  }
  return `${meters.toFixed(1)}m`;
}

/**
 * Format token ID for display
 * @param tokenId - Token ID
 * @returns Shortened hex string
 */
export function formatTokenId(tokenId: bigint): string {
  const hex = tokenId.toString(16);
  if (hex.length <= 8) {
    return `#${hex}`;
  }
  return `#${hex.slice(0, 4)}...${hex.slice(-4)}`;
}

/**
 * Format address for display
 * @param address - Ethereum address
 * @returns Shortened address
 */
export function formatAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// ============================================================================
// Parsing
// ============================================================================

/**
 * Parse comma-separated token IDs (for subgraph data)
 * @param tokenIdsString - Comma-separated token IDs
 * @returns Array of bigints
 */
export function parseTokenIds(tokenIdsString: string): bigint[] {
  if (!tokenIdsString || tokenIdsString.trim() === '') {
    return [];
  }
  return tokenIdsString.split(',').map((id) => BigInt(id.trim()));
}

/**
 * Parse BigDecimal string from subgraph
 * @param value - BigDecimal as string
 * @returns Number
 */
export function parseBigDecimal(value: string): number {
  return parseFloat(value);
}

/**
 * Parse timestamp to Date
 * @param timestamp - Unix timestamp as bigint
 * @returns Date object
 */
export function parseTimestamp(timestamp: bigint): Date {
  return new Date(Number(timestamp) * 1000);
}

// ============================================================================
// Distance Calculations
// ============================================================================

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param coord1 - First coordinate
 * @param coord2 - Second coordinate
 * @returns Distance in meters
 */
export function calculateDistance(coord1: GeoCoordinate, coord2: GeoCoordinate): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = (coord1.latitude * Math.PI) / 180;
  const φ2 = (coord2.latitude * Math.PI) / 180;
  const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
  const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Format distance for display
 * @param meters - Distance in meters
 * @returns Formatted string with appropriate unit
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters.toFixed(0)}m`;
  }
  return `${(meters / 1000).toFixed(2)}km`;
}

// ============================================================================
// Token ID Encoding/Decoding
// ============================================================================

/**
 * Determine quadrant from coordinates
 * @param latitude - Latitude in contract format
 * @param longitude - Longitude in contract format
 * @returns Quadrant (0-3)
 */
export function determineQuadrant(latitude: ContractCoordinate, longitude: ContractCoordinate): 0 | 1 | 2 | 3 {
  if (latitude >= 0n && longitude >= 0n) return 0; // NE
  if (latitude < 0n && longitude >= 0n) return 1; // SE
  if (latitude >= 0n && longitude < 0n) return 2; // NW
  return 3; // SW
}

/**
 * Encode coordinates into token ID
 * @param latitude - Latitude in contract format
 * @param longitude - Longitude in contract format
 * @returns Token ID
 */
export function encodeTokenId(latitude: ContractCoordinate, longitude: ContractCoordinate): bigint {
  const quadrant = BigInt(determineQuadrant(latitude, longitude));
  const absLat = latitude < 0n ? -latitude : latitude;
  const absLon = longitude < 0n ? -longitude : longitude;

  return quadrant * 10n ** 20n + absLat * 10n ** 10n + absLon;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if value is a valid Ethereum address
 */
export function isAddress(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[0-9a-f]{40}$/i.test(value);
}

/**
 * Check if value is a valid transaction hash
 */
export function isHash(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[0-9a-f]{64}$/i.test(value);
}

/**
 * Check if value is a valid bigint or bigint-like string
 */
export function isBigInt(value: unknown): value is bigint {
  if (typeof value === 'bigint') return true;
  if (typeof value === 'string') {
    try {
      BigInt(value);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

// ============================================================================
// Array Utilities
// ============================================================================

/**
 * Chunk array into smaller arrays
 * @param array - Input array
 * @param size - Chunk size
 * @returns Array of chunks
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Remove duplicates from array
 * @param array - Input array
 * @returns Array without duplicates
 */
export function unique<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}

// ============================================================================
// Constants Export
// ============================================================================

export const UTILS_CONSTANTS = {
  /** Coordinate precision multiplier */
  COORDINATE_PRECISION: 1_000_000,

  /** Elevation precision multiplier */
  ELEVATION_PRECISION: 10_000,

  /** Earth's radius in meters */
  EARTH_RADIUS_METERS: 6371000,

  /** Quadrant encoding */
  QUADRANTS: {
    NE: 0, // +lat, +lon
    SE: 1, // -lat, +lon
    NW: 2, // +lat, -lon
    SW: 3, // -lat, -lon
  },
} as const;
