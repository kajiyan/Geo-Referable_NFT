import { MAP_CONFIG } from '@/config/mapConstants'

export interface URLCoordinates {
  latitude: number
  longitude: number
  zoom: number
}

/**
 * Build a coordinate URL for map navigation
 * @example buildCoordinateUrl(35.6789, 139.7654, 16) => "/@35.6789,139.7654,16z"
 */
export function buildCoordinateUrl(
  latitude: number,
  longitude: number,
  zoom: number = MAP_CONFIG.STYLES.DEFAULT_ZOOM
): string {
  // 4 decimal places = ~11m precision at equator
  const lat = latitude.toFixed(4)
  const lng = longitude.toFixed(4)
  return `/@${lat},${lng},${zoom}z`
}

/**
 * Parse coordinate URL params into coordinates
 * @example parseCoordinateUrl(['@35.6789,139.7654,16z']) => { latitude: 35.6789, longitude: 139.7654, zoom: 16 }
 * @example parseCoordinateUrl(['%4035.6789,139.7654,16z']) => { latitude: 35.6789, longitude: 139.7654, zoom: 16 }
 */
export function parseCoordinateUrl(coords?: string[]): URLCoordinates | null {
  if (!coords?.length) {
    return null
  }

  // Decode URL-encoded characters (e.g., %40 -> @)
  const segment = decodeURIComponent(coords[0])

  if (!segment?.startsWith('@')) {
    return null
  }

  const parts = segment.slice(1).split(',')

  if (parts.length !== 3) {
    return null
  }

  const latitude = parseFloat(parts[0])
  const longitude = parseFloat(parts[1])
  const zoomStr = parts[2]
  const zoom = parseFloat(zoomStr.replace(/z$/i, ''))

  // Validate latitude: -90 to 90
  if (isNaN(latitude) || latitude < -90 || latitude > 90) return null

  // Validate longitude: -180 to 180
  if (isNaN(longitude) || longitude < -180 || longitude > 180) return null

  // Validate zoom: MIN_ZOOM to MAX_ZOOM
  if (isNaN(zoom) || zoom < MAP_CONFIG.STYLES.MIN_ZOOM || zoom > MAP_CONFIG.STYLES.MAX_ZOOM) return null

  return { latitude, longitude, zoom }
}
