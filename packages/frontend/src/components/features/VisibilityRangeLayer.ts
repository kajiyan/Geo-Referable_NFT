// @ts-expect-error - deck.gl 8.x types with bundler moduleResolution
import { ScatterplotLayer } from '@deck.gl/layers'

type RGBA = [number, number, number, number]

interface CircleData {
  /** [longitude, latitude] */
  position: [number, number]
  /** Radius in meters */
  radius: number
}

/**
 * Parse hex color string to RGBA tuple.
 */
function hexToRgba(hex: string, alpha: number): RGBA {
  const h = hex.replace('#', '')
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
    alpha,
  ]
}

interface VisibilityRangeLayerOptions {
  /** User's current position */
  position: { latitude: number; longitude: number } | null
  /** Observer visibility range in meters (r_observer) */
  radiusMeters: number
  /** Hex color for the circle (e.g. '#F3A0B6' or '#B2B2B2') */
  color: string
  /** Whether the layer should be visible */
  visible?: boolean
}

/**
 * Creates the observer visibility range circle.
 * Stroke-dominant with semi-transparent fill (~16% opacity) to preserve connection line visibility.
 */
export function createVisibilityRangeLayer({
  position,
  radiusMeters,
  color,
  visible = true,
}: VisibilityRangeLayerOptions): ScatterplotLayer | null {
  if (!position || !visible) {
    return null
  }

  return new ScatterplotLayer({
    id: 'visibility-range-layer',
    data: [
      {
        position: [position.longitude, position.latitude],
        radius: radiusMeters,
      },
    ],
    pickable: false,
    opacity: 1,
    stroked: true,
    filled: true,
    radiusUnits: 'meters',
    radiusMinPixels: 0,
    radiusMaxPixels: 10000,
    lineWidthUnits: 'pixels',
    lineWidthMinPixels: 2,
    lineWidthMaxPixels: 4,
    getPosition: (d: CircleData) => d.position,
    getRadius: (d: CircleData) => d.radius,
    getFillColor: hexToRgba(color, 40),
    getLineColor: hexToRgba(color, 160),
    getLineWidth: 2,
  })
}

interface SmokeReachLayerOptions {
  /** Single smoke circle for the selected token */
  circle: CircleData
  /** Hex color for the circle (TOKEN_COLORS[mintColorIndex]) */
  color: string
}

/**
 * Creates the smoke reach circle for the selected token only.
 * Stroke-dominant with semi-transparent fill (~16% opacity).
 */
export function createSmokeReachLayer({
  circle,
  color,
}: SmokeReachLayerOptions): ScatterplotLayer {
  return new ScatterplotLayer({
    id: 'smoke-reach-layer',
    data: [circle],
    pickable: false,
    opacity: 1,
    stroked: true,
    filled: true,
    radiusUnits: 'meters',
    radiusMinPixels: 0,
    radiusMaxPixels: 10000,
    lineWidthUnits: 'pixels',
    lineWidthMinPixels: 1,
    lineWidthMaxPixels: 3,
    getPosition: (d: CircleData) => d.position,
    getRadius: (d: CircleData) => d.radius,
    getFillColor: hexToRgba(color, 40),
    getLineColor: hexToRgba(color, 140),
    getLineWidth: 2,
  })
}

export type { CircleData as SmokeCircle }
