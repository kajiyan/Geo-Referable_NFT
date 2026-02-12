import type { Coordinates, ValidatedCoordinates } from '@/types/mapTypes'

export const CoordinateValidator = {
  isValid: (lat: number, lng: number): boolean => {
    return !isNaN(lat) && !isNaN(lng) && 
           lat >= -90 && lat <= 90 && 
           lng >= -180 && lng <= 180
  },
  
  sanitize: (lat: string | number, lng: string | number): [number, number] => {
    const numLat = typeof lat === 'string' ? parseFloat(lat) : lat
    const numLng = typeof lng === 'string' ? parseFloat(lng) : lng
    return [isNaN(numLat) ? 0 : numLat, isNaN(numLng) ? 0 : numLng]
  },
  
  validate: (lat: string | number, lng: string | number): ValidatedCoordinates => {
    const [numLat, numLng] = CoordinateValidator.sanitize(lat, lng)
    return {
      latitude: numLat,
      longitude: numLng,
      isValid: CoordinateValidator.isValid(numLat, numLng)
    }
  }
}

export const DistanceCalculator = {
  haversine: (point1: Coordinates, point2: Coordinates): number => {
    const R = 6371000 // Earth's radius in meters
    const dLat = (point2.latitude - point1.latitude) * Math.PI / 180
    const dLon = (point2.longitude - point1.longitude) * Math.PI / 180
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  },
  
  euclidean: (point1: Coordinates, point2: Coordinates): number => {
    const latDiff = point1.latitude - point2.latitude
    const lngDiff = point1.longitude - point2.longitude
    return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111000 // Convert to meters
  }
}

// Common coordinate transformations
export const CoordinateTransforms = {
  boundsToCenter: (bounds: [number, number, number, number]): [number, number] => {
    const [west, south, east, north] = bounds
    return [(west + east) / 2, (south + north) / 2]
  },
  
  expandBounds: (
    bounds: [number, number, number, number], 
    expansionFactor: number = 0.1
  ): [number, number, number, number] => {
    const [west, south, east, north] = bounds
    const latExpansion = (north - south) * expansionFactor
    const lngExpansion = (east - west) * expansionFactor
    
    return [
      west - lngExpansion,
      south - latExpansion,
      east + lngExpansion,
      north + latExpansion
    ]
  }
}