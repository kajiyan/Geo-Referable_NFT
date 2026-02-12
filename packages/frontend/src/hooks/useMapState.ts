import { useCallback, useState } from 'react'
import type { MapRef } from 'react-map-gl/maplibre'
import type { 
  MapErrorEvent, 
  MapMoveEvent,
  MapStateHook
} from '@/types/mapTypes'
import { MAP_CONFIG } from '@/config/mapConstants'

export function useMapState(
  mapRef: React.RefObject<MapRef | null>,
  onViewportChange: () => void
): MapStateHook {
  const [currentZoom, setCurrentZoom] = useState<number>(MAP_CONFIG.STYLES.DEFAULT_ZOOM)
  const [currentBounds, setCurrentBounds] = useState<[number, number, number, number] | null>(null)
  const [mapError, setMapError] = useState<Error | null>(null)

  const handleMapLoad = useCallback(() => {
    console.log('Map loaded successfully')
    setMapError(null)
    onViewportChange()
  }, [onViewportChange])

  const handleMapError = useCallback((error: MapErrorEvent) => {
    console.error('Map error:', error)
    setMapError(new Error('マップの読み込みに失敗しました'))
  }, [])

  const handleMove = useCallback((evt: MapMoveEvent) => {
    setCurrentZoom(evt.viewState.zoom)
    const bounds = mapRef.current?.getMap()?.getBounds()
    if (bounds) {
      setCurrentBounds([
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth()
      ])
    }
  }, [mapRef])

  return {
    currentZoom,
    currentBounds,
    mapError,
    handlers: {
      handleMapLoad,
      handleMapError,
      handleMove
    }
  }
}