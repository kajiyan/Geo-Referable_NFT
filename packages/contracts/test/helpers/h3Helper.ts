/**
 * H3 Helper Utility for Testing
 *
 * This module provides mock H3 index calculation for testing purposes.
 * In production, use the h3-js library: import { latLngToCell } from "h3-js";
 *
 * For now, we generate deterministic hex strings based on coordinates
 * that are consistent enough for testing purposes.
 */

export interface H3Params {
  h3r6: string;
  h3r8: string;
  h3r10: string;
  h3r12: string;
}

/**
 * Calculate deterministic H3 indices for testing
 *
 * This generates mock H3 hex strings that look realistic and are deterministic
 * based on the input coordinates. Real H3 implementation would use:
 * latLngToCell(lat, lon, resolution)
 *
 * H3 hex strings are typically 15 characters representing a 64-bit value.
 * Format: First 1-2 chars indicate resolution, remaining chars encode location.
 *
 * @param lat - Latitude in degrees (-90 to 90)
 * @param lon - Longitude in degrees (-180 to 180)
 * @returns H3Params object with hex strings for resolutions 6, 8, 10, and 12
 */
export function calculateH3(lat: number, lon: number): H3Params {
  // Normalize coordinates to positive values for hex encoding
  const latNorm = Math.abs(lat);
  const lonNorm = Math.abs(lon);

  // Add coordinate signs to the encoding for uniqueness
  const latSign = lat >= 0 ? 1 : 0;
  const lonSign = lon >= 0 ? 1 : 0;
  const quadrant = (latSign << 1) | lonSign;

  // Resolution 6 (city-level, ~3.2km) - Base mode indicator 88
  const latR6 = Math.floor(latNorm * 50);
  const lonR6 = Math.floor(lonNorm * 50);
  const r6 = `88${quadrant}${latR6.toString(16).padStart(4, '0')}${lonR6.toString(16).padStart(5, '0')}`;

  // Resolution 8 (district-level, ~0.5km) - Base mode indicator 89
  const latR8 = Math.floor(latNorm * 500);
  const lonR8 = Math.floor(lonNorm * 500);
  const r8 = `89${quadrant}${latR8.toString(16).padStart(4, '0')}${lonR8.toString(16).padStart(5, '0')}`;

  // Resolution 10 (street-level, ~0.07km) - Base mode indicator 8a
  const latR10 = Math.floor(latNorm * 5000);
  const lonR10 = Math.floor(lonNorm * 5000);
  const r10 = `8a${quadrant}${latR10.toString(16).padStart(5, '0')}${lonR10.toString(16).padStart(5, '0')}`;

  // Resolution 12 (building-level, ~0.01km) - Base mode indicator 8b
  const latR12 = Math.floor(latNorm * 50000);
  const lonR12 = Math.floor(lonNorm * 50000);
  const r12 = `8b${quadrant}${latR12.toString(16).padStart(5, '0')}${lonR12.toString(16).padStart(5, '0')}`;

  return {
    h3r6: r6.slice(0, 15),
    h3r8: r8.slice(0, 15),
    h3r10: r10.slice(0, 15),
    h3r12: r12.slice(0, 15),
  };
}

/**
 * Get H3 params from latitude/longitude in millionths
 *
 * This is a convenience function for the contract's coordinate format.
 * The contract stores coordinates as millionths of a degree.
 * Handles both number and bigint inputs.
 *
 * @param latMillionths - Latitude in millionths (e.g., 35_678_900 = 35.678900°)
 * @param lonMillionths - Longitude in millionths (e.g., 139_456_789 = 139.456789°)
 * @returns H3Params object with hex strings for all three resolutions
 *
 * @example
 * // Tokyo Station coordinates
 * const h3 = getH3FromMillionths(35_681_236, 139_767_125);
 * // Returns: { h3r7: "...", h3r9: "...", h3r12: "..." }
 */
export function getH3FromMillionths(
  latMillionths: number | bigint,
  lonMillionths: number | bigint,
): H3Params {
  const lat = Number(latMillionths) / 1_000_000;
  const lon = Number(lonMillionths) / 1_000_000;
  return calculateH3(lat, lon);
}

/**
 * Get H3 params from latitude/longitude as BigInt values in millionths
 *
 * This overload handles BigInt inputs which are common when working with
 * ethers.js and Hardhat contract types.
 *
 * @param latMillionths - Latitude in millionths as BigInt
 * @param lonMillionths - Longitude in millionths as BigInt
 * @returns H3Params object with hex strings for all three resolutions
 */
export function getH3FromMillionthsBigInt(latMillionths: bigint, lonMillionths: bigint): H3Params {
  return getH3FromMillionths(Number(latMillionths), Number(lonMillionths));
}

/**
 * Validate H3 string format
 *
 * @param h3str - H3 hex string to validate
 * @returns true if the string looks like a valid H3 index
 */
export function isValidH3String(h3str: string): boolean {
  // H3 strings should be 15 hex characters
  return /^[0-9a-f]{15}$/i.test(h3str);
}

/**
 * Generate H3 indices for a list of coordinate pairs
 *
 * @param coords - Array of [lat, lon] pairs in millionths
 * @returns Array of H3Params objects
 */
export function batchGetH3(coords: Array<[number, number]>): H3Params[] {
  return coords.map(([lat, lon]) => getH3FromMillionths(lat, lon));
}

// Example usage for common test locations
export const TEST_LOCATIONS = {
  // Tokyo Station
  TOKYO: {
    lat: 35_681_236,
    lon: 139_767_125,
    get h3() {
      return getH3FromMillionths(this.lat, this.lon);
    },
  },
  // New York City (Times Square)
  NEW_YORK: {
    lat: 40_758_896,
    lon: -73_985_130,
    get h3() {
      return getH3FromMillionths(this.lat, this.lon);
    },
  },
  // London (Big Ben)
  LONDON: {
    lat: 51_500_729,
    lon: -124_773,
    get h3() {
      return getH3FromMillionths(this.lat, this.lon);
    },
  },
  // Sydney Opera House
  SYDNEY: {
    lat: -33_856_784,
    lon: 151_215_297,
    get h3() {
      return getH3FromMillionths(this.lat, this.lon);
    },
  },
  // Mount Fuji summit
  FUJI: {
    lat: 35_360_556,
    lon: 138_727_778,
    get h3() {
      return getH3FromMillionths(this.lat, this.lon);
    },
  },
};
