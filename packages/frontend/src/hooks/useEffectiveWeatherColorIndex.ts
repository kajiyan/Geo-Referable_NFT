'use client'

import { useAccount } from 'wagmi'
import { useAppSelector } from '@/lib/hooks'
import { selectWeatherColorIndex } from '@/lib/slices/weatherSlice'
import { FALLBACK_COLOR_INDEX } from '@/lib/weatherTokens'

/**
 * Returns the effective weather color index based on wallet connection state.
 *
 * Logic:
 * - If wallet connected AND weather fetched: returns weather colorIndex
 * - Otherwise: returns FALLBACK_COLOR_INDEX (13 = #B2B2B2)
 *
 * This hook centralizes the logic for determining which color to display,
 * handling edge cases like:
 * - Wallet not connected
 * - Weather API failure (colorIndex is null)
 * - Weather not yet fetched
 *
 * @returns number - Always returns a valid colorIndex (never null)
 */
export function useEffectiveWeatherColorIndex(): number {
  const { isConnected } = useAccount()
  const reduxColorIndex = useAppSelector(selectWeatherColorIndex)

  // Return fallback if:
  // 1. Wallet not connected, OR
  // 2. Weather not yet fetched / API failed (colorIndex is null)
  if (!isConnected || reduxColorIndex === null) {
    return FALLBACK_COLOR_INDEX
  }

  return reduxColorIndex
}
