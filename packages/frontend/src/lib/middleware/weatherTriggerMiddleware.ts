import { Middleware, isAction } from '@reduxjs/toolkit'
import { getAccount } from '@wagmi/core'
import { fetchWeather } from '../slices/weatherSlice'
import type { GpsPosition } from '../slices/sensorSlice'
import type { RootState } from '../store'
import { config } from '../wagmi'

/**
 * Check if we're in a browser environment
 */
const isBrowser = typeof window !== 'undefined'

/**
 * Middleware to automatically trigger weather fetch on first location acquisition.
 *
 * Triggers on:
 * 1. fetchCurrentLocation.fulfilled - when location is manually fetched
 * 2. sensor/updateGpsPosition - when location is updated from auto-tracking
 *
 * Weather fetch is only triggered once per session (controlled by weatherSlice.hasFetched).
 */
export const weatherTriggerMiddleware: Middleware = (store) => {
  // Only run in browser environment
  if (!isBrowser) {
    return (next) => (action) => next(action)
  }

  return (next) => (action) => {
    const result = next(action)

    if (!isAction(action)) return result

    // Check if this is a location update action
    const isLocationUpdate =
      action.type === 'sensor/fetchCurrentLocation/fulfilled' ||
      action.type === 'sensor/updateGpsPosition'

    if (isLocationUpdate) {
      const state = store.getState() as RootState

      // Check if weather has already been fetched
      if (state.weather?.hasFetched) {
        return result
      }

      // Skip weather fetch if wallet is not connected
      // Disconnected users can only create temporary posts (colorIndex: 13)
      const account = getAccount(config)
      if (!account.isConnected) {
        console.log('[weatherTriggerMiddleware] Skipped: wallet not connected')
        return result
      }

      // Get the location from the action payload or state
      let lat: number | undefined
      let lon: number | undefined

      if (action.type === 'sensor/fetchCurrentLocation/fulfilled') {
        // For async thunk, payload is the GpsPosition
        const payload = (action as unknown as { payload: GpsPosition }).payload
        lat = payload.latitude
        lon = payload.longitude
      } else if (action.type === 'sensor/updateGpsPosition') {
        // For sync action, payload is the GpsPosition
        const payload = (action as unknown as { payload: GpsPosition }).payload
        lat = payload.latitude
        lon = payload.longitude
      }

      if (lat !== undefined && lon !== undefined) {
        console.log('[weatherTriggerMiddleware] Location acquired, triggering weather fetch:', {
          lat,
          lon,
        })

        // Dispatch weather fetch (the thunk's condition will prevent duplicates)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        store.dispatch(fetchWeather({ lat, lon }) as any)
      }
    }

    return result
  }
}
