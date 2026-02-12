// Network configurations
export const SUPPORTED_CHAINS = {
  POLYGON: 137,         // Polygon mainnet
  POLYGON_AMOY: 80002,  // Polygon Amoy testnet (recommended for testing)
  SEPOLIA: 11155111,    // Ethereum Sepolia testnet (legacy - deprecated)
  MAINNET: 1,           // Ethereum mainnet
} as const

// Contract addresses (V3.7.0 - 2026-02-01 - NOROSI branding, EIP712 domain fix, external_url)
export const CONTRACT_ADDRESSES = {
  [SUPPORTED_CHAINS.POLYGON_AMOY]: {
    GEO_RELATIONAL_NFT: '0xCF3C96a9a7080c5d8bBA706250681A9d27573847' as `0x${string}`,
    DATE_TIME: '0x20A287615768903478A97E526DEDfB8c5f7d1Bb6' as `0x${string}`,
    GEO_MATH: '0xCBE6Fcdb1210CE68C0767Bc0a33f31E6c4D996e0' as `0x${string}`,
    GEO_METADATA: '0x963F740813e35Fa5573A0838F4aB18F21e20324F' as `0x${string}`,
    NOROSI_FONT: '0x4E10895b2d9D0493aFac7C648991F79B7C7BfFcA' as `0x${string}`,
    FUMI: '0xd4b3285aB4fCAE666207108E9e3432eBac24B3f9' as `0x${string}`,
  },
  [SUPPORTED_CHAINS.POLYGON]: {
    // To be deployed
    GEO_RELATIONAL_NFT: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  },
  [SUPPORTED_CHAINS.SEPOLIA]: {
    // Legacy deployment (deprecated)
    GEO_RELATIONAL_NFT: '0x7b05Ae982330Ab9C3dBbaE47ec1AE8e7a32458b5' as `0x${string}`,
  },
  [SUPPORTED_CHAINS.MAINNET]: {
    // Future Ethereum mainnet deployment
    GEO_RELATIONAL_NFT: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  },
} as const

// Chain names mapping (OpenSea compliant)
export const CHAIN_NAMES: Record<number, string> = {
  [SUPPORTED_CHAINS.POLYGON]: 'polygon',
  [SUPPORTED_CHAINS.POLYGON_AMOY]: 'amoy',
  [SUPPORTED_CHAINS.SEPOLIA]: 'sepolia',
  [SUPPORTED_CHAINS.MAINNET]: 'ethereum',
}

// Get chain name from chain ID
export const getChainName = (chainId: number): string => {
  return CHAIN_NAMES[chainId] || 'amoy'
}

// Get contract address from chain ID
export const getContractAddress = (chainId: number): `0x${string}` => {
  return CONTRACT_ADDRESSES[chainId as keyof typeof CONTRACT_ADDRESSES]?.GEO_RELATIONAL_NFT
    || CONTRACT_ADDRESSES[SUPPORTED_CHAINS.POLYGON_AMOY].GEO_RELATIONAL_NFT
}

// Contract limits
/** Maximum token index per tree (0-based, enforced by GeoRelationalNFT.sol) */
export const MAX_TOKEN_INDEX_PER_TREE = 999

// App configuration
export const APP_CONFIG = {
  NAME: 'Norosi DApp',
  DESCRIPTION: 'Norosi NFT Frontend Application',
  URL: 'https://norosi.app',
} as const

// API endpoints
export const API_ENDPOINTS = {
  METADATA: '/api/metadata',
  MINT: '/api/mint',
} as const

// Storage keys and utilities
export * from './storage'