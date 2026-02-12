/**
 * Types for procedural mint animation
 */

export interface MintAnimationData {
  latitude: number       // degrees (e.g., 35.1815)
  longitude: number      // degrees (e.g., 136.8993)
  colorIndex: number     // 0-13 (weather color)
  message?: string       // optional text to display
  dateOverride?: Date    // override current time (for debug)
  mapDataUrl?: string    // pre-captured map image data URL (skips iframe capture)
}

export type AnimationPhase = 'idle' | 'map' | 'zoom' | 'norosi' | 'complete'

export interface AnimationState {
  phase: AnimationPhase
  progress: number        // 0-1 within current phase
  elapsed: number         // total elapsed time (seconds)

  // Camera transform (position and rotation)
  camera: {
    x: number             // X position
    y: number             // Y position (rises during zoom)
    z: number             // Z position (moves back during zoom)
    rotationX: number     // X rotation (looks down during zoom)
  }

  // Map plane transform (tilts to create overhead view)
  mapPlane: {
    rotationX: number     // X rotation (tilts to lie flat)
    y: number             // Y position (moves down during zoom)
  }

  skyOpacity: number
  norosiHeight: number
  norosiOpacity: number
  /** 0→1 fade-in for rain/snow (hidden during top-down, visible after oblique) */
  rainOpacity: number
}

/**
 * Timeline configuration (seconds)
 */
export const ANIMATION_TIMELINE = {
  MAP_DURATION: 1,        // 0-1s: Map display
  ZOOM_START: 1,
  ZOOM_DURATION: 3,       // 1-4s: Camera zoom out
  SKY_FADE_START: 2,
  SKY_FADE_DURATION: 2,   // 2-4s: Sky fade in
  NOROSI_START: 2.75,
  NOROSI_DURATION: 3.25,  // 2.75-6s: Norosi emergence
  TOTAL_DURATION: 6,
} as const

/**
 * Camera configuration
 * Camera starts with top-down view of horizontal map, then pulls back to oblique view
 * Map plane is fixed horizontally - only camera moves
 *
 * Animation phases:
 * 1. INITIAL → ZOOM_END (1-4s): Camera pulls back from top-down to oblique view
 * 2. ZOOM_END → NOROSI_END (3-6s): Camera rises following Norosi, looking down
 *
 * Final framing calculation (oblique view like minted-animate.jpg frame 3):
 * - Camera at (0, 10, 12), FOV 60° (half = 30°)
 * - Map near edge at (0, 0, 6), direction: (0, -10, -6) → ~59° down
 * - For near edge at viewport bottom: rotation + 30° = 59° → rotation ≈ -0.5 rad
 * - Lower Y = more oblique/foreshortened view (NOT overhead)
 */
export const CAMERA_CONFIG = {
  // Initial state: top-down view (map fills screen)
  INITIAL_X: 0,
  INITIAL_Y: 8,           // Close enough for 12×12 map to cover canvas at FOV 60°
  INITIAL_Z: 0.1,         // Slight offset to avoid gimbal lock
  INITIAL_ROTATION_X: -Math.PI / 2, // Looking straight down (-90°)

  // Zoom end state: oblique view (map at bottom, sky above)
  // Like minted-animate.jpg frame 3 - map appears foreshortened/tilted
  ZOOM_END_X: 0,
  ZOOM_END_Y: 10,            // Lower camera for oblique view (not overhead)
  ZOOM_END_Z: 12,            // Further back
  ZOOM_END_ROTATION_X: -0.4, // ~23° down

  // Norosi end state: low-angle shot looking UP at rising Norosi (煽り)
  // Camera drops near ground, moves close to map, tilts upward
  NOROSI_END_X: 0,
  NOROSI_END_Y: 2,            // Near ground level for dramatic low angle
  NOROSI_END_Z: 12,           // Keep same Z distance as zoom end
  NOROSI_END_ROTATION_X: 0.4, // ~23° looking UP (positive = tilting upward)

  FOV: 60,
} as const

/**
 * Map plane configuration
 * Map is fixed horizontally (like ground) - camera moves, not the map
 * Square texture (1024x1024) for better quality with mipmapping
 */
export const MAP_PLANE_CONFIG = {
  WIDTH: 12,
  HEIGHT: 12,             // Square for 1:1 texture mapping

  // Fixed horizontal position (parallel to sky)
  ROTATION_X: -Math.PI / 2, // Laying flat (facing up)
  Y: 0,                     // At origin
} as const

/**
 * Norosi animation configuration
 * Note: These values are scaled for the mint animation scene (not AR view).
 * Camera final position is Y=10, Z=22. Norosi emerges from map center.
 * Smaller size for better balance with the map.
 */
export const NOROSI_CONFIG = {
  INITIAL_HEIGHT: 0,
  FINAL_HEIGHT: 16,   // Taller for more dramatic rising effect
  WIDTH: 2,           // Narrower for slimmer silhouette
} as const
