/**
 * Build OpenSea URL for a token
 * Following industry standard external link pattern used by Doodles, Azuki, BAYC, etc.
 */

const CHAIN_MAP: Record<string, string> = {
  polygon: 'matic',
  amoy: 'matic-amoy',
  ethereum: 'ethereum',
  mainnet: 'ethereum',
}

/**
 * Build OpenSea asset URL for a specific token
 * @param chain - Chain name (polygon, amoy, ethereum)
 * @param address - Contract address
 * @param tokenId - Token ID
 * @returns OpenSea URL for the token
 */
export function buildOpenSeaUrl(
  chain: string,
  address: string,
  tokenId: string
): string {
  const openSeaChain = CHAIN_MAP[chain.toLowerCase()] || 'matic-amoy'
  return `https://opensea.io/assets/${openSeaChain}/${address}/${tokenId}`
}

/**
 * Build OpenSea collection URL for a contract
 * @param chain - Chain name
 * @param address - Contract address
 * @returns OpenSea collection URL
 */
export function buildOpenSeaCollectionUrl(
  chain: string,
  address: string
): string {
  const openSeaChain = CHAIN_MAP[chain.toLowerCase()] || 'matic-amoy'
  return `https://opensea.io/collection/${openSeaChain}/${address}`
}
