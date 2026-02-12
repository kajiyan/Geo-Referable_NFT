export const MAP_CONFIG = {
  STYLES: {
    POSITRON: 'https://tiles.openfreemap.org/styles/positron',
    DARK: 'https://tiles.openfreemap.org/styles/dark',
    DEFAULT_ZOOM: 15,
    JAPAN_OVERVIEW_ZOOM: 5, // Zoom level to show all of Japan
    MIN_ZOOM: 1,
    MAX_ZOOM: 18
  },

  LOCATIONS: {
    TOKYO: {
      longitude: 139.766084,
      latitude: 35.681382,
      name: '東京'
    },
    JAPAN_CENTER: {
      longitude: 137.0,
      latitude: 37.5,
      name: '日本'
    }
  },

  PERFORMANCE: {
    MAX_VISIBLE_MARKERS: 100,
    DEBOUNCE_MS: 300,
    ANIMATION_DURATION_MS: 10000
  },

  H3_RESOLUTIONS: {
    HIGH_DETAIL: 12,    // Individual tokens
    MEDIUM_DETAIL: 9,   // Medium areas
    LOW_DETAIL: 7       // Large areas
  },

  // Hotspot configuration for dynamic initial map positioning
  HOTSPOT: {
    RESOLUTION: 8,        // r8 = district level (~500m)
    TOP_N: 10,            // Consider top 10 hotspots
    PERSIST_SESSION: true // Use same hotspot within browser session
  }
} as const

export type MapConfigType = typeof MAP_CONFIG

// Default map initialization values (Tokyo fallback)
export const INITIAL_VIEW_STATE = {
  longitude: MAP_CONFIG.LOCATIONS.TOKYO.longitude,
  latitude: MAP_CONFIG.LOCATIONS.TOKYO.latitude,
  zoom: MAP_CONFIG.STYLES.DEFAULT_ZOOM
} as const

// Japan overview view state (for initial hotspot discovery animation)
export const JAPAN_OVERVIEW_VIEW_STATE = {
  longitude: MAP_CONFIG.LOCATIONS.JAPAN_CENTER.longitude,
  latitude: MAP_CONFIG.LOCATIONS.JAPAN_CENTER.latitude,
  zoom: MAP_CONFIG.STYLES.JAPAN_OVERVIEW_ZOOM
} as const

// Error messages
export const MAP_ERROR_MESSAGES = {
  LOAD_FAILED: 'マップの読み込みに失敗しました',
  NETWORK_ERROR: 'ネットワークエラーが発生しました',
  TOKENS_LOAD_ERROR: 'NFT読み込みエラー'
} as const