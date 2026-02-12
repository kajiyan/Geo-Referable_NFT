/**
 * Query Wrapper with Fallback Support
 *
 * Provides a unified interface for GraphQL queries that automatically
 * switches between Apollo Client (Subgraph) and fallback mock data
 * based on the NEXT_PUBLIC_USE_FALLBACK environment variable.
 */

import type { DocumentNode, TypedDocumentNode, OperationVariables, FetchPolicy } from '@apollo/client'
import { FALLBACK_CONFIG } from '@/config/fallbackConfig'
import { fallbackDataService } from './FallbackDataService'
import { Token } from '@/types'

export interface QueryOptions<TVariables extends OperationVariables = OperationVariables> {
  query: DocumentNode | TypedDocumentNode<unknown, TVariables>
  variables?: TVariables
  fetchPolicy?: FetchPolicy
  context?: { signal?: AbortSignal }
}

export interface QueryResult<TData> {
  data: TData
  fromFallback: boolean
}

/**
 * Query tokens with automatic fallback support
 *
 * When NEXT_PUBLIC_USE_FALLBACK=true, this function returns mock data
 * instead of querying the Subgraph.
 *
 * NOTE: The `fromFallback` field in QueryResult should be used to track
 * fallback state per-request. This avoids race conditions from global state.
 */
export async function queryWithFallback<TData = Record<string, Token[]>>(
  options: QueryOptions
): Promise<QueryResult<TData>> {
  // Check if fallback mode is enabled
  if (FALLBACK_CONFIG.USE_FALLBACK) {
    console.log('[queryWithFallback] Using fallback mode (env: NEXT_PUBLIC_USE_FALLBACK=true)')

    try {
      const data = await fallbackDataService.queryTokens(
        (options.variables || {}) as Record<string, unknown>
      )

      return {
        data: data as TData,
        fromFallback: true,
      }
    } catch (error) {
      console.error('[queryWithFallback] Fallback query failed:', error)
      throw error
    }
  }

  // Normal mode: use Apollo Client
  const { apolloClient } = await import('./client')

  const result = await apolloClient.query({
    query: options.query,
    variables: options.variables,
    fetchPolicy: options.fetchPolicy || 'network-only',
    context: options.context,
  })

  return {
    data: result.data as TData,
    fromFallback: false,
  }
}

/**
 * Check if the app is configured to use fallback data
 *
 * NOTE: This returns the static config value. For per-request tracking,
 * use the `fromFallback` field in QueryResult instead.
 */
export function isUsingFallback(): boolean {
  return FALLBACK_CONFIG.USE_FALLBACK
}

/**
 * Get the fallback configuration
 */
export function getFallbackConfig(): typeof FALLBACK_CONFIG {
  return FALLBACK_CONFIG
}

/**
 * Preload fallback data (call on app startup for faster fallback)
 */
export async function preloadFallbackData(): Promise<void> {
  if (FALLBACK_CONFIG.USE_FALLBACK) {
    try {
      await fallbackDataService.initialize()
      console.log('[queryWithFallback] Fallback data preloaded')
    } catch (error) {
      console.error('[queryWithFallback] Failed to preload fallback data:', error)
    }
  }
}

/**
 * Get fallback data statistics
 */
export async function getFallbackStats(): Promise<{
  isLoaded: boolean
  tokenCount: number
  metadata: Awaited<ReturnType<typeof fallbackDataService.getMetadata>>
} | null> {
  if (!FALLBACK_CONFIG.USE_FALLBACK) {
    return null
  }

  return {
    isLoaded: fallbackDataService.isLoaded(),
    tokenCount: fallbackDataService.getTokenCount(),
    metadata: await fallbackDataService.getMetadata(),
  }
}
