import type { CardinalDirection } from '@/lib/slices/sensorSlice'

export interface GpsCoordinate {
  latitude: number
  longitude: number
}

export interface CardinalOffset {
  latOffset: number
  lonOffset: number
}

const EARTH_RADIUS_M = 6371000

export function toRadians(degrees: number): number {
  return degrees * Math.PI / 180
}

export function toDegrees(radians: number): number {
  return radians * 180 / Math.PI
}

export function haversineDistance(
  coord1: GpsCoordinate,
  coord2: GpsCoordinate
): number {
  const lat1Rad = toRadians(coord1.latitude)
  const lat2Rad = toRadians(coord2.latitude)
  const deltaLatRad = toRadians(coord2.latitude - coord1.latitude)
  const deltaLonRad = toRadians(coord2.longitude - coord1.longitude)

  const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) *
    Math.sin(deltaLonRad / 2) * Math.sin(deltaLonRad / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return EARTH_RADIUS_M * c
}

export function calculateDestinationPoint(
  origin: GpsCoordinate,
  bearing: number,
  distance: number
): GpsCoordinate {
  const lat1Rad = toRadians(origin.latitude)
  const lon1Rad = toRadians(origin.longitude)
  const bearingRad = toRadians(bearing)
  const angularDistance = distance / EARTH_RADIUS_M

  const lat2Rad = Math.asin(
    Math.sin(lat1Rad) * Math.cos(angularDistance) +
    Math.cos(lat1Rad) * Math.sin(angularDistance) * Math.cos(bearingRad)
  )

  const lon2Rad = lon1Rad + Math.atan2(
    Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(lat1Rad),
    Math.cos(angularDistance) - Math.sin(lat1Rad) * Math.sin(lat2Rad)
  )

  return {
    latitude: toDegrees(lat2Rad),
    longitude: toDegrees(lon2Rad),
  }
}

export function getCardinalBearing(direction: CardinalDirection): number {
  switch (direction) {
    case 'north':
      return 0
    case 'east':
      return 90
    case 'south':
      return 180
    case 'west':
      return 270
    default:
      return 0
  }
}

export function calculateCardinalOffset(
  origin: GpsCoordinate,
  direction: CardinalDirection,
  distance: number
): GpsCoordinate {
  const bearing = getCardinalBearing(direction)
  return calculateDestinationPoint(origin, bearing, distance)
}

export function calculateCardinalOffsets(
  origin: GpsCoordinate,
  distance: number
): Record<CardinalDirection, GpsCoordinate> {
  return {
    north: calculateCardinalOffset(origin, 'north', distance),
    south: calculateCardinalOffset(origin, 'south', distance),
    east: calculateCardinalOffset(origin, 'east', distance),
    west: calculateCardinalOffset(origin, 'west', distance),
  }
}

export function validateGpsCoordinate(coord: GpsCoordinate): boolean {
  return (
    typeof coord.latitude === 'number' &&
    typeof coord.longitude === 'number' &&
    coord.latitude >= -90 &&
    coord.latitude <= 90 &&
    coord.longitude >= -180 &&
    coord.longitude <= 180 &&
    !isNaN(coord.latitude) &&
    !isNaN(coord.longitude)
  )
}

export function distanceBasedScale(distance: number, maxDistance: number = 1000): number {
  return Math.max(0.1, Math.min(1.0, 1.0 - (distance / maxDistance)))
}