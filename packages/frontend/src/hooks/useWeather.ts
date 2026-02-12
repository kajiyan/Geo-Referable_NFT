import { useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '@/lib/hooks'
import {
  fetchWeather,
  clearWeather,
  selectWeather,
  selectHasWeatherData,
  selectWeatherLoading,
  selectWeatherError,
  selectWeatherColorIndex,
  type ColorIndexSource,
} from '@/lib/slices/weatherSlice'

export interface UseWeatherResult {
  // Current weather state
  colorIndex: number | null
  colorIndexSource: ColorIndexSource | null
  loading: boolean
  error: string | null

  // Status flags
  hasWeatherData: boolean

  // Actions
  getWeather: (lat: number, lon: number) => void
  clearWeatherData: () => void
}

/**
 * Hook to access and manage weather data from Redux store.
 *
 * Weather is fetched once when location is first acquired anywhere in the app.
 * Subsequent calls to getWeather will be ignored if weather has already been fetched.
 */
export function useWeather(): UseWeatherResult {
  const dispatch = useAppDispatch()

  const { colorIndex, colorIndexSource, loading, error } = useAppSelector(selectWeather)
  const hasWeatherData = useAppSelector(selectHasWeatherData)

  const getWeather = useCallback(
    (lat: number, lon: number) => {
      // Validate coordinates
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        console.error('[useWeather] Invalid coordinates:', { lat, lon })
        return
      }

      // fetchWeather has internal condition check - it will skip if already fetched
      dispatch(fetchWeather({ lat, lon }))
    },
    [dispatch]
  )

  const clearWeatherData = useCallback(() => {
    dispatch(clearWeather())
  }, [dispatch])

  return {
    colorIndex,
    colorIndexSource,
    loading,
    error,
    hasWeatherData,
    getWeather,
    clearWeatherData,
  }
}

/**
 * Simplified hook that only returns weather data (no actions).
 * Useful for components that only need to display weather data.
 */
export function useWeatherData() {
  const colorIndex = useAppSelector(selectWeatherColorIndex)
  const loading = useAppSelector(selectWeatherLoading)
  const error = useAppSelector(selectWeatherError)
  const hasWeatherData = useAppSelector(selectHasWeatherData)

  return {
    colorIndex,
    loading,
    error,
    hasWeatherData,
  }
}
