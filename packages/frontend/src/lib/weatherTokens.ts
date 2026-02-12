/**
 * Weather condition IDs (0-12) representing different weather states.
 * Used for mapping to color tokens.
 */
export type WeatherCondition = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/**
 * Weather token color palette expressed as hex values.
 * These map to CSS custom properties defined in `index.css` for easy theming.
 */
export const WEATHER_TOKEN_COLORS = {
  clear: '#F3A0B6',
  partlyCloudy: '#F7D6BA',
  cloudy: '#D3FFE2',
  overcast: '#FBFFC5',
  lightDrizzle: '#C9EDFD',
  lightRain: '#B8B3FB',
  moderateRain: '#9993FB',
  rain: '#E3FFB2',
  heavyRain: '#8AD2B6',
  rainThunder: '#E1FF86',
  heavyRainThunder: '#DB78FB',
  snow: '#96FFCD',
  mistFog: '#93B2B6',
  fallback: '#B2B2B2',
} as const;

export type WeatherTokenColorKey = keyof typeof WEATHER_TOKEN_COLORS;

/**
 * CSS custom property names for each palette entry.
 */
export const WEATHER_TOKEN_COLOR_VARS: Record<WeatherTokenColorKey, `var(--token-color-weather-${string})`> = {
  clear: 'var(--token-color-weather-clear)',
  partlyCloudy: 'var(--token-color-weather-partly-cloudy)',
  cloudy: 'var(--token-color-weather-cloudy)',
  overcast: 'var(--token-color-weather-overcast)',
  lightDrizzle: 'var(--token-color-weather-light-drizzle)',
  lightRain: 'var(--token-color-weather-light-rain)',
  moderateRain: 'var(--token-color-weather-moderate-rain)',
  rain: 'var(--token-color-weather-rain)',
  heavyRain: 'var(--token-color-weather-heavy-rain)',
  rainThunder: 'var(--token-color-weather-rain-thunder)',
  heavyRainThunder: 'var(--token-color-weather-heavy-rain-thunder)',
  snow: 'var(--token-color-weather-snow)',
  mistFog: 'var(--token-color-weather-mist-fog)',
  fallback: 'var(--token-color-weather-fallback)',
} as const;

/**
 * Lookup for weather condition IDs → CSS custom property.
 * Includes a graceful fallback colour for unknown/unsupported IDs.
 */
export const WEATHER_TOKEN_COLOR_BY_ID: Record<WeatherCondition, `var(--token-color-weather-${string})`> = {
  0: WEATHER_TOKEN_COLOR_VARS.clear,
  1: WEATHER_TOKEN_COLOR_VARS.partlyCloudy,
  2: WEATHER_TOKEN_COLOR_VARS.cloudy,
  3: WEATHER_TOKEN_COLOR_VARS.overcast,
  4: WEATHER_TOKEN_COLOR_VARS.lightDrizzle,
  5: WEATHER_TOKEN_COLOR_VARS.lightRain,
  6: WEATHER_TOKEN_COLOR_VARS.moderateRain,
  7: WEATHER_TOKEN_COLOR_VARS.rain,
  8: WEATHER_TOKEN_COLOR_VARS.heavyRain,
  9: WEATHER_TOKEN_COLOR_VARS.rainThunder,
  10: WEATHER_TOKEN_COLOR_VARS.heavyRainThunder,
  11: WEATHER_TOKEN_COLOR_VARS.snow,
  12: WEATHER_TOKEN_COLOR_VARS.mistFog,
} as const;

export const DEFAULT_WEATHER_TOKEN_COLOR = WEATHER_TOKEN_COLOR_VARS.fallback;

/**
 * Fallback colorIndex for when weather data is unavailable.
 * Used when wallet is not connected or weather fetch fails.
 * Maps to WEATHER_TOKEN_COLORS.fallback (#B2B2B2).
 */
export const FALLBACK_COLOR_INDEX = 13;

export function getWeatherTokenColor(weatherId?: WeatherCondition) {
  if (weatherId === undefined) {
    return DEFAULT_WEATHER_TOKEN_COLOR;
  }
  return WEATHER_TOKEN_COLOR_BY_ID[weatherId] ?? DEFAULT_WEATHER_TOKEN_COLOR;
}

/**
 * Lookup for weather condition IDs → hex color value.
 * Maps colorIndex (0-12) directly to hex colors.
 * Matches Fumi.sol COLOR_TABLE exactly.
 */
const WEATHER_TOKEN_COLORS_BY_INDEX: Record<WeatherCondition, string> = {
  0: WEATHER_TOKEN_COLORS.clear,           // '#F3A0B6'
  1: WEATHER_TOKEN_COLORS.partlyCloudy,    // '#F7D6BA'
  2: WEATHER_TOKEN_COLORS.cloudy,          // '#D3FFE2'
  3: WEATHER_TOKEN_COLORS.overcast,        // '#FBFFC5'
  4: WEATHER_TOKEN_COLORS.lightDrizzle,    // '#C9EDFD'
  5: WEATHER_TOKEN_COLORS.lightRain,       // '#B8B3FB'
  6: WEATHER_TOKEN_COLORS.moderateRain,    // '#9993FB'
  7: WEATHER_TOKEN_COLORS.rain,            // '#E3FFB2'
  8: WEATHER_TOKEN_COLORS.heavyRain,       // '#8AD2B6'
  9: WEATHER_TOKEN_COLORS.rainThunder,     // '#E1FF86'
  10: WEATHER_TOKEN_COLORS.heavyRainThunder, // '#DB78FB'
  11: WEATHER_TOKEN_COLORS.snow,           // '#96FFCD'
  12: WEATHER_TOKEN_COLORS.mistFog,        // '#93B2B6'
} as const;

/**
 * Get hex color for weather colorIndex (0-12).
 * Used for Norosi2D gradientColors generation.
 *
 * @param colorIndex - Weather color index (0-12) or null
 * @returns Hex color string (e.g., '#F3A0B6')
 */
export function getWeatherColorHex(colorIndex: number | null): string {
  if (colorIndex === null || colorIndex < 0 || colorIndex > 12) {
    return WEATHER_TOKEN_COLORS.fallback;
  }
  return WEATHER_TOKEN_COLORS_BY_INDEX[colorIndex as WeatherCondition];
}

