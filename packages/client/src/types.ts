/**
 * Geographical location data structure
 */
export interface GeoLocation {
  latitude: bigint;
  longitude: bigint;
  radius: bigint;
  timestamp: bigint;
}

/**
 * Mint parameters for GeoNFT
 */
export interface MintParams {
  to: `0x${string}`;
  uri: string;
  latitude: bigint;
  longitude: bigint;
  radius: bigint;
}

/**
 * Update geo location parameters
 */
export interface UpdateGeoLocationParams {
  tokenId: bigint;
  latitude: bigint;
  longitude: bigint;
  radius: bigint;
}

/**
 * Coordinate helper - convert degrees to contract format (millionths)
 */
export const degreesToContract = (degrees: number): bigint => {
  return BigInt(Math.round(degrees * 1_000_000));
};

/**
 * Coordinate helper - convert from contract format to degrees
 */
export const contractToDegrees = (contractValue: bigint): number => {
  return Number(contractValue) / 1_000_000;
};
