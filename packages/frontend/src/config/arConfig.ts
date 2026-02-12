export const GRAPHICS_CONFIG = {
  MAX_PIXEL_RATIO: 2,
} as const

export const RENDERING_CONFIG = {
  MAX_RENDER_DISTANCE_M: 1000,
  MIN_RENDER_DISTANCE_M: 10,
  TEXTURE_SCALE: 1.0,
} as const

export const GPS_CONFIG = {
  INIT_DELAY_MS: 100,
  MAX_WATCH_AGE_MS: 10000,
  MIN_DISTANCE_M: 5,
  MIN_ACCURACY_M: 100,
  // Allow loosening the accuracy floor during initialisation when devices only provide coarse fixes
  INIT_MAX_ACCURACY_M: 150,
} as const

export const RECOVERY_CONFIG = {
  CONTEXT_RETRY_MAX: 2,
  CONTEXT_BACKOFF_MS: [200, 500, 1000] as const,
} as const

