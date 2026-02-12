export const CACHE_CONFIG = {
  // Memory limits
  MAX_CACHED_TOKENS: 3000,              // ~5.4 MB (safe for iPhone 17)
  MAX_VISIBLE_MARKERS: 100,             // Display limit (unchanged)
  FORCE_CLEANUP_THRESHOLD: 4000,        // Emergency cleanup trigger

  // Spatial bounds
  VIEWPORT_BUFFER_MULTIPLIER: 2.5,      // Cache Zone = Viewport × 2.5

  // Timing
  CLEANUP_DEBOUNCE_MS: 1000,            // Wait 1s after last viewport change
  MIN_KEEP_TIME_MS: 60000,              // Keep tokens for at least 60s
  PERIODIC_CLEANUP_INTERVAL_MS: 30000,  // Check every 30s

  // H3 integration (Phase 2)
  USE_H3_CELL_FILTERING: true,          // Phase 1: false, Phase 2: true (ENABLED)
  H3_OVERLAP_THRESHOLD: 0.3,            // 30% H3 cell overlap = keep token

  // Priority scoring weights (Hybrid Adaptive Algorithm v2.0)
  // Balanced Discovery: New tokens are 6x more discoverable while preserving chain history
  PRIORITY_WEIGHTS: {
    GENERATION: 0.25,     // Reference chain depth (was: 0.4)
    REF_COUNT: 0.20,      // Number of references (was: 0.3)
    HAS_MESSAGE: 0.15,    // Has user message (was: 0.2)
    RECENCY: 0.15,        // Recently viewed (was: 0.1)
    FRESHNESS: 0.25,      // NEW: Token creation recency
  },

  // Discovery incentives for new tokens (Cold Start mitigation)
  EXPLORATION_BONUS: 0.4,              // Bonus score for newly minted tokens
  EXPLORATION_BONUS_DAYS: 7,           // Bonus duration (7 days after minting)
  FRESHNESS_HALF_LIFE_DAYS: 30,        // Freshness score decay rate (30 days)

  // Caps to prevent over-privileging established tokens
  GENERATION_CAP: 8,                   // Max generation score (was: implicit 10)
  REF_COUNT_CAP: 8,                    // Max refCount score (was: 10)

  // Memory safety
  MEMORY_WARNING_THRESHOLD_MB: 8,       // Warn at 8MB
  MEMORY_CRITICAL_THRESHOLD_MB: 10,     // Force cleanup at 10MB
} as const

export type CacheConfig = typeof CACHE_CONFIG
