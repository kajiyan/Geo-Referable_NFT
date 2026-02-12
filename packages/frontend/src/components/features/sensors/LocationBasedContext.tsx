"use client"

import { createContext, useContext } from 'react'
import * as LocAR from 'locar'

export interface LocationBasedContextValue {
  locationBased: LocAR.LocationBased | null
  lonLatToWorldCoords: (longitude: number, latitude: number) => [number, number]
  isReady: boolean
  isGpsReady: boolean
}

export const LocationBasedContext = createContext<LocationBasedContextValue | null>(null)

export function useLocationBased(): LocationBasedContextValue {
  const context = useContext(LocationBasedContext)
  if (!context) {
    throw new Error('useLocationBased must be used within a LocationBasedContext.Provider')
  }
  return context
}