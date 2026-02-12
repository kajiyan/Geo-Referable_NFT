import { useCallback, useEffect, useRef } from 'react'
import { useAppDispatch, useAppSelector } from '@/lib/hooks'
import { 
  fetchElevation, 
  clearCurrentElevation, 
  clearHistory,
  removeHistoryEntry 
} from '@/lib/slices/elevationSlice'

export interface UseElevationResult {
  // Current elevation state
  coordinates: { lat: number; lon: number } | null
  elevation: number | null
  source: 'api' | 'cache' | 'default' | 'gsi' | 'open-meteo' | null
  loading: boolean
  error: string | null
  
  // History
  history: Array<{
    coordinates: { lat: number; lon: number }
    elevation: number
    source: 'api' | 'cache' | 'default' | 'gsi' | 'open-meteo'
    timestamp: number
  }>
  
  // Actions
  getElevation: (lat: number, lon: number) => void
  clearElevation: () => void
  clearElevationHistory: () => void
  removeHistoryItem: (index: number) => void
}

interface UseElevationOptions {
  debounceMs?: number
}

export function useElevation(options: UseElevationOptions = {}): UseElevationResult {
  const { debounceMs = 500 } = options
  const dispatch = useAppDispatch()
  const elevationState = useAppSelector(state => state.elevation)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  
  const getElevation = useCallback((lat: number, lon: number) => {
    // Validate coordinates
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      console.error('Invalid coordinates:', { lat, lon })
      return
    }
    
    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    
    // Abort any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    // Create new abort controller
    abortControllerRef.current = new AbortController()
    
    // Debounce the API call
    debounceTimerRef.current = setTimeout(() => {
      dispatch(fetchElevation({ lat, lon }))
    }, debounceMs)
  }, [dispatch, debounceMs])
  
  const clearElevation = useCallback(() => {
    // Cancel any pending requests
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    
    dispatch(clearCurrentElevation())
  }, [dispatch])
  
  const clearElevationHistory = useCallback(() => {
    dispatch(clearHistory())
  }, [dispatch])
  
  const removeHistoryItem = useCallback((index: number) => {
    dispatch(removeHistoryEntry(index))
  }, [dispatch])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])
  
  return {
    // Current state
    coordinates: elevationState.current.coordinates,
    elevation: elevationState.current.elevation,
    source: elevationState.current.source,
    loading: elevationState.current.loading,
    error: elevationState.current.error,
    
    // History
    history: elevationState.history,
    
    // Actions
    getElevation,
    clearElevation,
    clearElevationHistory,
    removeHistoryItem,
  }
}

// Convenience hook with immediate elevation fetching
export function useElevationWithCoordinates(
  lat?: number, 
  lon?: number, 
  options: UseElevationOptions = {}
): UseElevationResult {
  const elevation = useElevation(options)
  const { getElevation } = elevation
  
  useEffect(() => {
    if (lat !== undefined && lon !== undefined) {
      getElevation(lat, lon)
    }
  }, [lat, lon, getElevation])
  
  return elevation
}