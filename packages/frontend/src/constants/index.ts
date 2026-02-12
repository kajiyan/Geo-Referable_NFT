// Network configurations
export const SUPPORTED_CHAINS = {
  POLYGON: 137,         // Polygon mainnet
  POLYGON_AMOY: 80002,  // Polygon Amoy testnet (recommended for testing)
  SEPOLIA: 11155111,    // Ethereum Sepolia testnet (legacy - deprecated)
  MAINNET: 1,           // Ethereum mainnet
} as const

// Contract addresses (V3.8.0 - 2026-02-12 - GeoReferableNFT rename deployment)
export const CONTRACT_ADDRESSES = {
  [SUPPORTED_CHAINS.POLYGON_AMOY]: {
    GEO_REFERABLE_NFT: '0x4D765E2c06507e7D958A0b2677C85BE7235e889E' as `0x${string}`,
    DATE_TIME: '0x02006eFC55C00fA4B8eE53142618f4A2064D9587' as `0x${string}`,
    GEO_MATH: '0xB266f093092d58E9750650914b18a4f830aD8085' as `0x${string}`,
    GEO_METADATA: '0x4682Ba294b95fBE0a6d09501Dda04dF923957418' as `0x${string}`,
    NOROSI_FONT: '0x23159654a4Df89d9Fa81269a24C7ac5F1939efC8' as `0x${string}`,
    FUMI: '0x03D35F603388532dd76B62C62FfE249cdff319AE' as `0x${string}`,
  },
  [SUPPORTED_CHAINS.POLYGON]: {
    // To be deployed
    GEO_REFERABLE_NFT: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  },
  [SUPPORTED_CHAINS.SEPOLIA]: {
    // Legacy deployment (deprecated)
    GEO_REFERABLE_NFT: '0x7b05Ae982330Ab9C3dBbaE47ec1AE8e7a32458b5' as `0x${string}`,
  },
  [SUPPORTED_CHAINS.MAINNET]: {
    // Future Ethereum mainnet deployment
    GEO_REFERABLE_NFT: '0x0000000000000000000000000000000000000000' as `0x${string}`,
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
  return CONTRACT_ADDRESSES[chainId as keyof typeof CONTRACT_ADDRESSES]?.GEO_REFERABLE_NFT
    || CONTRACT_ADDRESSES[SUPPORTED_CHAINS.POLYGON_AMOY].GEO_REFERABLE_NFT
}

// Contract limits
/** Maximum token index per tree (0-based, enforced by GeoReferableNFT.sol) */
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