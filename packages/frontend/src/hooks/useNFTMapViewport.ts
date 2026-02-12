import { useCallback, useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import debounce from 'lodash.debounce'
import type { MapRef } from 'react-map-gl/maplibre'

// Type for debounced function returned by lodash.debounce
interface DebouncedFunction<T extends (...args: unknown[]) => unknown> {
  (...args: Parameters<T>): ReturnType<T> | undefined
  cancel(): void
  flush(): ReturnType<T> | undefined
}
import {
  fetchTokensForViewport,
  loadTokensFromIndexedDB,
  updateViewport,
  selectMapViewport,
  selectMapLoading,
  selectMapError
} from '@/lib/slices/nftMapSlice'
import {
  hasSignificantViewportChange,
  optimizeH3Queries
} from '@/utils/h3Utils'
import type { AppDispatch } from '@/lib/store'
import type { MapViewportState } from '@/types/mapTypes'

interface UseNFTMapViewportOptions {
  debounceMs?: number
  significantChangeThreshold?: number
  enabled?: boolean
}

interface UseNFTMapViewportResult {
  onViewportChange: () => void
  viewport: MapViewportState | null
  loading: boolean
  error: string | null
  refetch: () => void
  refetchImmediate: () => void
}

export function useNFTMapViewport(
  mapRef: React.RefObject<MapRef | null>,
  options: UseNFTMapViewportOptions = {}
): UseNFTMapViewportResult {
  const {
    debounceMs = 300,
    significantChangeThreshold = 0.001,
    enabled = true
  } = options
  
  const dispatch = useDispatch<AppDispatch>()
  const viewport = useSelector(selectMapViewport)
  const loading = useSelector(selectMapLoading)
  const error = useSelector(selectMapError)
  
  const previousH3CellsRef = useRef<{
    r6: string[]
    r8: string[]
    r10: string[]
    r12: string[]
  }>({ r6: [], r8: [], r10: [], r12: [] })
  
  const lastBoundsRef = useRef<[number, number, number, number] | null>(null)
  
  const fetchTokensForCurrentViewport = useCallback(() => {
    if (!enabled || !mapRef.current) {
      console.log('[useNFTMapViewport] ❌ Early return: enabled =', enabled, 'mapRef =', !!mapRef.current)
      return
    }

    try {
      const map = mapRef.current.getMap()
      if (!map) {
        console.log('[useNFTMapViewport] ❌ Early return: map not available')
        return
      }

      // Note: Removed map.loaded() check - it was too strict during navigation
      // The map can process getBounds() even while tiles are loading

      const bounds = map.getBounds()
      const zoom = map.getZoom()

      const boundsArray: [number, number, number, number] = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth()
      ]

      console.log('[useNFTMapViewport] Viewport info:', {
        bounds: boundsArray,
        zoom,
        lastBounds: lastBoundsRef.current,
        threshold: significantChangeThreshold
      })

      const hasSignificantChange = hasSignificantViewportChange(
        boundsArray,
        lastBoundsRef.current,
        significantChangeThreshold
      )

      if (!hasSignificantChange) {
        console.log('[useNFTMapViewport] ❌ Early return: no significant viewport change')
        return
      }

      console.log('[useNFTMapViewport] ✅ Significant viewport change detected')

      lastBoundsRef.current = boundsArray

      const viewportBounds = {
        bounds: boundsArray,
        zoom
      }

      const h3CellsResult = optimizeH3Queries(
        viewportBounds,
        previousH3CellsRef.current
      )

      console.log('[useNFTMapViewport] H3 optimization result:', {
        shouldRefetch: h3CellsResult.shouldRefetch,
        previousCells: {
          r6: previousH3CellsRef.current.r6.length,
          r8: previousH3CellsRef.current.r8.length,
          r10: previousH3CellsRef.current.r10.length,
          r12: previousH3CellsRef.current.r12.length,
        },
        newCells: {
          r6: h3CellsResult.r6.length,
          r8: h3CellsResult.r8.length,
          r10: h3CellsResult.r10.length,
          r12: h3CellsResult.r12.length,
        }
      })

      if (!h3CellsResult.shouldRefetch) {
        console.log('[useNFTMapViewport] ❌ Skipping fetch - sufficient overlap with previous query')
        return
      }

      console.log('[useNFTMapViewport] ✅ Dispatching fetchTokensForViewport')

      previousH3CellsRef.current = {
        r6: h3CellsResult.r6,
        r8: h3CellsResult.r8,
        r10: h3CellsResult.r10,
        r12: h3CellsResult.r12
      }

      const mapViewport = {
        bounds: boundsArray,
        zoom,
        center: [(boundsArray[0] + boundsArray[2]) / 2, (boundsArray[1] + boundsArray[3]) / 2] as [number, number]
      }

      dispatch(updateViewport(mapViewport))

      // Offline-first loading: Load from IndexedDB first for instant display
      dispatch(loadTokensFromIndexedDB({
        h3Cells: {
          r6: h3CellsResult.r6,
          r8: h3CellsResult.r8,
          r10: h3CellsResult.r10,
          r12: h3CellsResult.r12
        }
      }))

      // Then fetch from network to update with latest data
      dispatch(fetchTokensForViewport({
        h3Cells: {
          r6: h3CellsResult.r6,
          r8: h3CellsResult.r8,
          r10: h3CellsResult.r10,
          r12: h3CellsResult.r12
        },
        viewport: mapViewport
      }))

    } catch (error) {
      console.error('[useNFTMapViewport] Error in fetchTokensForCurrentViewport:', error)
    }
  }, [enabled, mapRef, dispatch, significantChangeThreshold])
  
  // Use ref to maintain stable debounced function reference
  const debouncedFetchRef = useRef<DebouncedFunction<typeof fetchTokensForCurrentViewport> | null>(null)

  useEffect(() => {
    debouncedFetchRef.current = debounce(fetchTokensForCurrentViewport, debounceMs)
    return () => debouncedFetchRef.current?.cancel()
  }, [fetchTokensForCurrentViewport, debounceMs])

  const debouncedFetch = useCallback(() => {
    debouncedFetchRef.current?.()
  }, [])
  
  const onViewportChange = useCallback(() => {
    if (!enabled) return
    debouncedFetch()
  }, [enabled, debouncedFetch])
  
  const refetch = useCallback(() => {
    lastBoundsRef.current = null
    previousH3CellsRef.current = { r6: [], r8: [], r10: [], r12: [] }
    fetchTokensForCurrentViewport()
  }, [fetchTokensForCurrentViewport])

  const refetchImmediate = useCallback(() => {
    console.log('refetchImmediate called: canceling debounced fetch and fetching immediately')
    debouncedFetchRef.current?.cancel()  // Cancel any pending debounced fetch
    lastBoundsRef.current = null
    previousH3CellsRef.current = { r6: [], r8: [], r10: [], r12: [] }
    fetchTokensForCurrentViewport()
  }, [fetchTokensForCurrentViewport])

  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map || !enabled) return
    
    const handleLoad = () => {
      setTimeout(() => {
        fetchTokensForCurrentViewport()
      }, 100)
    }
    
    const handleMoveEnd = () => {
      onViewportChange()
    }
    
    const handleZoomEnd = () => {
      onViewportChange()
    }
    
    if (map.loaded()) {
      handleLoad()
    } else {
      map.once('load', handleLoad)
    }
    
    map.on('moveend', handleMoveEnd)
    map.on('zoomend', handleZoomEnd)
    
    return () => {
      if (map) {
        map.off('load', handleLoad)
        map.off('moveend', handleMoveEnd)
        map.off('zoomend', handleZoomEnd)
      }
      debouncedFetchRef.current?.cancel()
    }
  }, [mapRef, enabled, onViewportChange, fetchTokensForCurrentViewport])
  
  return {
    onViewportChange,
    viewport,
    loading,
    error,
    refetch,
    refetchImmediate
  }
}