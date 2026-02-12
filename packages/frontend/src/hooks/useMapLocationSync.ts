"use client"

import { useEffect, useRef } from 'react'
import type { MapRef } from 'react-map-gl/maplibre'
import { useSelector } from 'react-redux'
import { selectGpsPosition } from '@/lib/slices/sensorSlice'
import { GPS_CONFIG } from '@/config/gpsConfig'

interface Options {
  enabled?: boolean
  minAccuracy?: number
  fly?: boolean
  onSyncComplete?: () => void
}

export function useMapLocationSync(mapRef: React.RefObject<MapRef | null>, opts: Options = {}) {
  const { enabled = true, minAccuracy = GPS_CONFIG.MIN_ACCURACY_M, fly = false, onSyncComplete } = opts
  const gps = useSelector(selectGpsPosition)
  const lastTsRef = useRef<number>(0)

  useEffect(() => {
    if (!enabled || !gps) return

    // Only center map on manual GPS updates (from button click)
    // Prevent auto-centering during AR continuous tracking
    if (gps.source !== 'manual') return

    if (gps.accuracy && gps.accuracy > minAccuracy) return
    if (gps.timestamp <= lastTsRef.current) return
    const map = mapRef.current?.getMap?.()
    if (!map) return
    lastTsRef.current = gps.timestamp
    const center = [gps.longitude, gps.latitude] as [number, number]

    // Set up one-time moveend listener to call onSyncComplete after map move
    const handleMoveEnd = () => {
      map.off('moveend', handleMoveEnd)
      onSyncComplete?.()
    }

    try {
      if (onSyncComplete) {
        map.once('moveend', handleMoveEnd)
      }

      if (fly) {
        map.flyTo({ center, speed: 0.8, curve: 1.2, essential: true })
      } else {
        map.easeTo({ center, duration: 800, essential: true })
      }
    } catch (e) {
      // Clean up listener on error
      map.off('moveend', handleMoveEnd)
    }
  }, [enabled, fly, gps, minAccuracy, mapRef, onSyncComplete])
}

