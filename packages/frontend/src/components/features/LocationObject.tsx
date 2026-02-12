"use client"

import { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { useLocationBased } from './sensors/LocationBasedContext'
import type { LocationObjectProps } from '@/types/locationTypes'

export function LocationObject({
  longitude,
  latitude,
  elevation = 0,
  properties = {},
  children,
}: LocationObjectProps) {
  const groupRef = useRef<THREE.Group>(null)
  const { lonLatToWorldCoords, isReady, isGpsReady } = useLocationBased()

  const stableProperties = useMemo(() => ({ ...properties }), [properties])

  const position = useMemo(() => {
    if (!isReady || !isGpsReady) {
      return [0, elevation, 0] as [number, number, number]
    }

    try {
      const [x, z] = lonLatToWorldCoords(longitude, latitude)

      if (process.env.NODE_ENV === 'development') {
        console.log(`LocationObject: "${stableProperties.name || 'unnamed'}"`,
          `GPS(${latitude.toFixed(6)}, ${longitude.toFixed(6)}) -> 3D(x:${x.toFixed(2)}, y:${elevation}, z:${z.toFixed(2)})`)
      }

      return [x, elevation, z] as [number, number, number]
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('LocationObject: Coordinate transformation failed, GPS may not be initialized yet', error)
      }
      return [0, elevation, 0] as [number, number, number]
    }
  }, [isReady, isGpsReady, lonLatToWorldCoords, longitude, latitude, elevation, stableProperties])

  if (!isReady) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('LocationObject: LocationBased not ready. Make sure this component is used inside LocationBased.')
    }
    return null
  }

  return (
    <group ref={groupRef} position={position}>
      {children}
    </group>
  )
}