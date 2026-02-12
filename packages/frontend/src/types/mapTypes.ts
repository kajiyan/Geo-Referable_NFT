import type { Token } from '@/types/index'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MapLibreMap = any

// Map Event Types
export interface MapErrorEvent {
  error: Error
  target: MapLibreMap
  originalEvent?: Event
}

export interface MapMoveEvent {
  viewState: {
    zoom: number
    latitude: number
    longitude: number
    bearing: number
    pitch: number
  }
  target: MapLibreMap
  originalEvent?: MouseEvent | TouchEvent | WheelEvent
}

export interface MapLoadEvent {
  target: MapLibreMap
  isSourceLoaded: boolean
  isStyleLoaded: boolean
  isInitialLoad: boolean
}

// Map State Types
export interface MapViewportState {
  zoom: number
  center: [number, number]
  bounds: [number, number, number, number] // [west, south, east, north]
}

export interface MapBounds {
  getWest(): number
  getSouth(): number
  getEast(): number
  getNorth(): number
}

export interface MapRef {
  getMap(): MapLibreMap & {
    getBounds(): MapBounds
    addControl(control: unknown): void
    removeControl(control: unknown): void
  }
  flyTo(options: { center: [number, number]; zoom?: number; duration?: number }): void
}

// Processed Token Types (V3.1)
export interface ProcessedToken extends Token {
  numericLatitude: number
  numericLongitude: number
  numericElevation: number
  numericColorIndex: number  // Changed from numericWeather in V3.1
  numericGeneration: number
  numericTree: number
  /** Tree index (0-based position within tree) for badge display */
  numericTreeIndex: number
  /** Unix timestamp (seconds) when NFT was minted */
  createdAtTimestamp: number
  /** Unix timestamp (seconds) of first reference, or null if none */
  firstReferenceAt: number | null
}

// Component Props Types
export interface MapMarqueeProps {
  text: string
  scale?: number
  bgColor?: string
  badgeNumber?: number
  animationDuration?: number
  gapWidth?: number
  respectReducedMotion?: boolean
  onActivate?: () => void
}

// Hook Return Types
export interface MapStateHook {
  currentZoom: number
  currentBounds: [number, number, number, number] | null
  mapError: Error | null
  handlers: {
    handleMapLoad: () => void
    handleMapError: (error: MapErrorEvent) => void
    handleMove: (evt: MapMoveEvent) => void
  }
}

// Configuration Types
export interface MapConfig {
  STYLES: {
    POSITRON: string
    DEFAULT_ZOOM: number
    MIN_ZOOM: number
    MAX_ZOOM: number
  }
  LOCATIONS: {
    TOKYO: {
      longitude: number
      latitude: number
      name: string
    }
  }
  PERFORMANCE: {
    MAX_VISIBLE_MARKERS: number
    CLUSTER_RADIUS_METERS: number
    DEBOUNCE_MS: number
    ANIMATION_DURATION_MS: number
  }
  H3_RESOLUTIONS: {
    HIGH_DETAIL: number
    MEDIUM_DETAIL: number
    LOW_DETAIL: number
  }
  CLUSTERING: {
    MIN_ZOOM_FOR_INDIVIDUAL: number
    OVERLAP_THRESHOLD: number
    CONNECTION_OPACITY: number
  }
}

// Error Reporting Types
export type MapErrorContext = 
  | 'initialization'
  | 'token_processing'
  | 'viewport_change'
  | 'clustering'
  | 'layer_rendering'
  | 'network_request'
  | 'performance'

export interface ErrorMetadata {
  tokenCount?: number
  viewport?: MapViewportState
  zoom?: number
  severity?: 'warning' | 'error' | 'critical'
  [key: string]: unknown
}

// Coordinate Types
export interface Coordinates {
  latitude: number
  longitude: number
}

export interface ValidatedCoordinates extends Coordinates {
  isValid: boolean
}

// Performance Types
export interface PerformanceMetric {
  type: 'render_time' | 'memory_usage' | 'frame_rate'
  operation: string
  value: number
  timestamp: number
  userAgent: string
  viewport: string
}