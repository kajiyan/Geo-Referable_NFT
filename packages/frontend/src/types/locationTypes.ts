import type { ReactNode } from 'react'

export interface LocationObjectProps {
  longitude: number
  latitude: number
  elevation?: number
  properties?: Record<string, unknown>
  children: ReactNode
}

export interface GpsPosition {
  latitude: number
  longitude: number
  altitude?: number
  accuracy: number
  timestamp: number
}