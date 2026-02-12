import { WEATHER_TOKEN_COLORS } from '@/lib/weatherTokens'

/**
 * Token color palette - re-exported from weatherTokens for backwards compatibility.
 * Single source of truth: weatherTokens.ts
 */
export const TOKEN_COLORS = Object.values(WEATHER_TOKEN_COLORS) as readonly string[]