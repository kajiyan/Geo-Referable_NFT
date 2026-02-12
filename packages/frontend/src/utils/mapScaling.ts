import { useCallback } from 'react'

// Meter-based scaling helpers for MapMarquee (HTML marker) from OpenFreeMapReactGL reference
// meters per pixel at latitude & zoom in Web Mercator (tileSize 256)
export const useMapScaling = () => {
  const metersPerPixel = useCallback((latDeg: number, z: number) => {
    const latRad = (latDeg * Math.PI) / 180
    return 156543.03392804097 * Math.cos(latRad) / Math.pow(2, z)
  }, [])

  const pixelsPerMeter = useCallback((latDeg: number, z: number) => 
    1 / Math.max(1e-9, metersPerPixel(latDeg, z)), 
    [metersPerPixel]
  )

  return { metersPerPixel, pixelsPerMeter }
}

// Standalone functions for non-hook usage
export const metersPerPixel = (latDeg: number, z: number) => {
  const latRad = (latDeg * Math.PI) / 180
  return 156543.03392804097 * Math.cos(latRad) / Math.pow(2, z)
}

export const pixelsPerMeter = (latDeg: number, z: number) => 
  1 / Math.max(1e-9, metersPerPixel(latDeg, z))