'use client'

import { useAccount } from 'wagmi'
import { useEffect, useRef } from 'react'
import { useAppDispatch, useAppSelector } from '@/lib/hooks'
import { clearWeather, fetchWeather } from '@/lib/slices/weatherSlice'
import { selectGpsPosition } from '@/lib/slices/sensorSlice'

/**
 * Synchronizes weather state with wallet connection status.
 *
 * Behaviors:
 * - On wallet disconnect: Clears weather state (colorIndex, hasFetched, etc.)
 * - On wallet connect (with existing GPS): Triggers weather fetch immediately
 *
 * This hook should be mounted in WalletReconnectProvider to ensure it runs
 * at the application root level.
 */
export function useWalletWeatherSync(): void {
  const dispatch = useAppDispatch()
  const { isConnected } = useAccount()
  const gpsPosition = useAppSelector(selectGpsPosition)

  // Track previous connection state to detect transitions
  const prevConnectedRef = useRef<boolean | null>(null)

  useEffect(() => {
    const wasConnected = prevConnectedRef.current
    prevConnectedRef.current = isConnected

    // Skip on initial render (wasConnected is null)
    if (wasConnected === null) return

    // Wallet disconnected: clear weather state
    if (wasConnected && !isConnected) {
      console.log('[useWalletWeatherSync] Wallet disconnected, clearing weather state')
      dispatch(clearWeather())
      return
    }

    // Wallet connected: trigger weather fetch if GPS is available
    if (!wasConnected && isConnected && gpsPosition) {
      console.log('[useWalletWeatherSync] Wallet connected with GPS available, fetching weather')
      dispatch(
        fetchWeather({
          lat: gpsPosition.latitude,
          lon: gpsPosition.longitude,
        })
      )
    }
  }, [isConnected, gpsPosition, dispatch])
}
