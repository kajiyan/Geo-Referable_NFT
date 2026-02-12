/**
 * Chain utilities for consistent chain selection across the application.
 *
 * Centralizes chain ID selection logic to avoid duplication and ensure
 * consistent behavior between frontend and API routes.
 */

import { polygon, polygonAmoy, sepolia, type Chain } from 'viem/chains'

/**
 * Supported chain IDs in the application
 */
export type SupportedChainId = typeof polygon.id | typeof polygonAmoy.id | typeof sepolia.id

/**
 * Default chain ID when not specified (Polygon Amoy testnet)
 */
export const DEFAULT_CHAIN_ID = polygonAmoy.id

/**
 * Get the chain ID from environment variable or return default.
 * For use in both client and server contexts.
 */
export function getChainId(): SupportedChainId {
  const envChainId = process.env.NEXT_PUBLIC_CHAIN_ID
  if (!envChainId) return DEFAULT_CHAIN_ID

  const parsedId = parseInt(envChainId, 10)

  // Only return if it's a supported chain
  if (parsedId === polygon.id) return polygon.id
  if (parsedId === polygonAmoy.id) return polygonAmoy.id
  if (parsedId === sepolia.id) return sepolia.id

  return DEFAULT_CHAIN_ID
}

/**
 * Get the Viem chain object for the given chain ID.
 * Used for creating public clients and signing operations.
 *
 * @param chainId - Optional chain ID override. If not provided, uses getChainId()
 * @returns Viem Chain object
 */
export function getChain(chainId?: number): Chain {
  const id = chainId ?? getChainId()

  switch (id) {
    case polygon.id:
      return polygon
    case sepolia.id:
      return sepolia
    case polygonAmoy.id:
    default:
      return polygonAmoy
  }
}

/**
 * Get the chain name for display purposes.
 *
 * @param chainId - Optional chain ID. If not provided, uses getChainId()
 * @returns Human-readable chain name
 */
export function getChainName(chainId?: number): string {
  const id = chainId ?? getChainId()

  switch (id) {
    case polygon.id:
      return 'Polygon Mainnet'
    case sepolia.id:
      return 'Sepolia'
    case polygonAmoy.id:
    default:
      return 'Polygon Amoy'
  }
}

/**
 * Check if the current chain is a testnet.
 *
 * @param chainId - Optional chain ID. If not provided, uses getChainId()
 * @returns true if testnet, false if mainnet
 */
export function isTestnet(chainId?: number): boolean {
  const id = chainId ?? getChainId()
  return id !== polygon.id
}
