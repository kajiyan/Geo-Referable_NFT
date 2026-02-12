export const GRAPHICS_CONFIG = {
  MAX_PIXEL_RATIO: 2,
} as const

export const RENDERING_CONFIG = {
  MAX_RENDER_DISTANCE_M: 1000,
  MIN_RENDER_DISTANCE_M: 10,
} as const

export const GPS_CONFIG = {
  // Initialization delay before starting GPS
  INIT_DELAY_MS: 100,

  // GPS cache validity period
  MAX_WATCH_AGE_MS: 10000,

  // Minimum distance for position update
  MIN_DISTANCE_M: 5,

  // Normal accuracy threshold (allows indoor WiFi + cellular)
  MIN_ACCURACY_M: 150,

  // Relaxed accuracy threshold during initialization (allows cellular-only startup)
  INIT_MAX_ACCURACY_M: 300,
} as const

export const RECOVERY_CONFIG = {
  CONTEXT_RETRY_MAX: 2,
  CONTEXT_BACKOFF_MS: [200, 500, 1000] as const,
} as const

/**
 * Valid weather color indices (0-12)
 *
 * Weather types:
 * 0: Clear, 1: Partly Cloudy, 2: Cloudy, 3: Overcast,
 * 4: Light Drizzle, 5: Light Rain, 6: Moderate Rain, 7: Rain,
 * 8: Heavy Rain, 9: Thunder Rain, 10: Heavy Thunder,
 * 11: Snow, 12: Fog
 */
export type WeatherColorIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12

/**
 * Type guard for valid weather color index
 */
export function isValidWeatherColorIndex(index: number | null): index is WeatherColorIndex {
  return index !== null && Number.isInteger(index) && index >= 0 && index <= 12
}

/**
 * Weather-based visibility configuration
 * Maps weather colorIndex (0-12) to maximum render distance in meters
 */
export const WEATHER_VISIBILITY_CONFIG: Record<WeatherColorIndex, number> = {
  0: 10000,  // Clear - 10km
  1: 8000,   // Partly Cloudy - 8km
  2: 6000,   // Cloudy - 6km
  3: 4000,   // Overcast - 4km
  4: 3000,   // Light Drizzle - 3km
  5: 2500,   // Light Rain - 2.5km
  6: 2000,   // Moderate Rain - 2km
  7: 1500,   // Rain - 1.5km
  8: 1200,   // Heavy Rain - 1.2km
  9: 1100,   // Thunder Rain - 1.1km
  10: 1000,  // Heavy Thunder - 1km (minimum)
  11: 1500,  // Snow - 1.5km
  12: 1000,  // Fog - 1km (minimum)
} as const

/** Default visibility when weather data is unavailable (4km, overcast equivalent) */
export const DEFAULT_VISIBILITY = 4000

/**
 * Get visibility distance for weather condition
 * @param colorIndex - Weather color index (0-12) or null
 * @returns Visibility distance in meters
 */
export function getWeatherVisibility(colorIndex: number | null): number {
  if (isValidWeatherColorIndex(colorIndex)) {
    return WEATHER_VISIBILITY_CONFIG[colorIndex]
  }
  return DEFAULT_VISIBILITY
}
