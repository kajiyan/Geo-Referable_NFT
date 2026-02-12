/**
 * Fallback Configuration for Subgraph unavailability
 *
 * When The Graph Subgraph is unavailable (e.g., "service is overloaded" errors),
 * this configuration controls fallback behavior to pre-generated mock data.
 *
 * Usage:
 * - Normal operation: Leave NEXT_PUBLIC_USE_FALLBACK unset or false
 * - During outage: Set NEXT_PUBLIC_USE_FALLBACK=true in .env.local
 */

export const FALLBACK_CONFIG = {
  /**
   * Manual toggle: Enable fallback mode via environment variable
   * When true, all Subgraph queries will be served from mock data
   */
  USE_FALLBACK: process.env.NEXT_PUBLIC_USE_FALLBACK === 'true',

  /**
   * URL to the pre-generated mock token data
   */
  MOCK_DATA_URL: '/data/mock-tokens.json',

  /**
   * Show UI indicator when in fallback mode
   */
  SHOW_FALLBACK_INDICATOR: true,

  /**
   * Cache duration for mock data in memory (ms)
   * Once loaded, mock data is kept in memory for this duration
   */
  CACHE_DURATION_MS: 5 * 60 * 1000, // 5 minutes
} as const;

export type FallbackConfig = typeof FALLBACK_CONFIG;
