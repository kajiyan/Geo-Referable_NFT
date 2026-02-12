import { useRef, useCallback } from 'react'
import {
  AnimationState,
  AnimationPhase,
  ANIMATION_TIMELINE,
  CAMERA_CONFIG,
  MAP_PLANE_CONFIG,
  NOROSI_CONFIG,
} from './types'

/**
 * Easing function: ease-in-out cubic
 * Smooth start and end — natural for cinematic camera movements
 */
function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/** Create a fresh AnimationState object (owned by a single hook instance) */
function createAnimationState(): AnimationState {
  return {
    phase: 'idle',
    progress: 0,
    elapsed: 0,
    camera: { x: 0, y: 0, z: 0, rotationX: 0 },
    mapPlane: { rotationX: 0, y: 0 },
    skyOpacity: 0,
    norosiHeight: 0,
    norosiOpacity: 0,
    rainOpacity: 0,
  }
}

/**
 * Calculate animation state based on elapsed time.
 * Mutates the provided `out` object to avoid per-frame allocations.
 */
function calculateAnimationState(elapsed: number, out: AnimationState): AnimationState {
  const {
    MAP_DURATION,
    ZOOM_START,
    ZOOM_DURATION,
    SKY_FADE_START,
    SKY_FADE_DURATION,
    NOROSI_START,
    NOROSI_DURATION,
    TOTAL_DURATION,
  } = ANIMATION_TIMELINE

  const {
    INITIAL_X,
    INITIAL_Y,
    INITIAL_Z,
    INITIAL_ROTATION_X,
    ZOOM_END_X,
    ZOOM_END_Y,
    ZOOM_END_Z,
    ZOOM_END_ROTATION_X,
    NOROSI_END_X,
    NOROSI_END_Y,
    NOROSI_END_Z,
    NOROSI_END_ROTATION_X,
  } = CAMERA_CONFIG

  const { INITIAL_HEIGHT, FINAL_HEIGHT } = NOROSI_CONFIG

  // Determine current phase
  let phase: AnimationPhase = 'idle'
  let progress = 0

  if (elapsed <= 0) {
    phase = 'idle'
    progress = 0
  } else if (elapsed < MAP_DURATION) {
    phase = 'map'
    progress = elapsed / MAP_DURATION
  } else if (elapsed < ZOOM_START + ZOOM_DURATION) {
    phase = 'zoom'
    progress = (elapsed - ZOOM_START) / ZOOM_DURATION
  } else if (elapsed < TOTAL_DURATION) {
    phase = 'norosi'
    progress = (elapsed - NOROSI_START) / NOROSI_DURATION
  } else {
    phase = 'complete'
    progress = 1
  }

  // Calculate camera position and rotation
  // Phase 1 (ZOOM): INITIAL → ZOOM_END (1-4s)
  // Phase 2 (NOROSI): ZOOM_END → NOROSI_END (2.75-6s) - camera rises following Norosi
  let cameraX = INITIAL_X
  let cameraY = INITIAL_Y
  let cameraZ = INITIAL_Z
  let cameraRotationX = INITIAL_ROTATION_X

  if (elapsed > ZOOM_START) {
    const zoomProgress = Math.min(1, (elapsed - ZOOM_START) / ZOOM_DURATION)
    const easedZoomProgress = easeInOutCubic(zoomProgress)

    // Zoom phase: INITIAL → ZOOM_END
    cameraX = INITIAL_X + (ZOOM_END_X - INITIAL_X) * easedZoomProgress
    cameraY = INITIAL_Y + (ZOOM_END_Y - INITIAL_Y) * easedZoomProgress
    cameraZ = INITIAL_Z + (ZOOM_END_Z - INITIAL_Z) * easedZoomProgress
    cameraRotationX = INITIAL_ROTATION_X + (ZOOM_END_ROTATION_X - INITIAL_ROTATION_X) * easedZoomProgress

    // Norosi phase: current position → NOROSI_END (camera follows rising Norosi)
    // Uses current zoom-interpolated values as start to avoid discontinuity
    // (zoom and norosi phases overlap: zoom 1-4s, norosi 2.75-6s)
    if (elapsed > NOROSI_START) {
      const norosiCameraProgress = Math.min(1, (elapsed - NOROSI_START) / NOROSI_DURATION)
      const easedNorosiProgress = easeInOutCubic(norosiCameraProgress)

      // Snapshot current zoom-interpolated position as norosi start point
      const startX = cameraX
      const startY = cameraY
      const startZ = cameraZ
      const startRotX = cameraRotationX

      cameraX = startX + (NOROSI_END_X - startX) * easedNorosiProgress
      cameraY = startY + (NOROSI_END_Y - startY) * easedNorosiProgress
      cameraZ = startZ + (NOROSI_END_Z - startZ) * easedNorosiProgress
      cameraRotationX = startRotX + (NOROSI_END_ROTATION_X - startRotX) * easedNorosiProgress
    }
  }

  // Map plane is now fixed horizontally - no animation needed
  // The camera movement creates the visual effect of the map tilting

  // Sky is always fully visible (no fade-in animation)
  // The natural reveal happens as the camera zooms out and map shrinks
  const skyOpacity = 1

  // Rain/snow opacity: hidden during top-down view, fades in during zoom (2-4s)
  // This prevents rain streaks from appearing to fall sideways when camera looks straight down
  let rainOpacity = 0
  if (elapsed > SKY_FADE_START) {
    rainOpacity = Math.min(1, (elapsed - SKY_FADE_START) / SKY_FADE_DURATION)
  }

  // Calculate Norosi height and opacity (emerges during NOROSI phase)
  let norosiHeight = INITIAL_HEIGHT
  let norosiOpacity = 0
  if (elapsed > NOROSI_START) {
    const norosiProgress = Math.min(1, (elapsed - NOROSI_START) / NOROSI_DURATION)
    const easedProgress = easeInOutCubic(norosiProgress)
    norosiHeight = INITIAL_HEIGHT + (FINAL_HEIGHT - INITIAL_HEIGHT) * easedProgress
    // Fade in quickly: reach full opacity at 25% progress (0.75s into norosi phase)
    // Start with base opacity of 0.5 so smoke is visible immediately
    norosiOpacity = Math.min(1, 0.5 + norosiProgress * 2)
  }

  // Mutate the caller-owned state object to avoid per-frame allocations
  out.phase = phase
  out.progress = Math.max(0, Math.min(1, progress))
  out.elapsed = elapsed
  out.camera.x = cameraX
  out.camera.y = cameraY
  out.camera.z = cameraZ
  out.camera.rotationX = cameraRotationX
  out.mapPlane.rotationX = MAP_PLANE_CONFIG.ROTATION_X
  out.mapPlane.y = MAP_PLANE_CONFIG.Y
  out.skyOpacity = skyOpacity
  out.norosiHeight = norosiHeight
  out.norosiOpacity = norosiOpacity
  out.rainOpacity = rainOpacity
  return out
}

/**
 * Hook for managing animation timeline state.
 * Uses refs instead of state to avoid re-renders during useFrame.
 * Each hook instance owns its own AnimationState object (no shared singleton).
 */
export function useAnimationTimeline() {
  const elapsedRef = useRef(0)
  const isPlayingRef = useRef(false)
  // Each instance gets its own state object, initialized lazily once
  const stateRef = useRef<AnimationState>(null!)
  const initializedRef = useRef(false)
  if (!initializedRef.current) {
    stateRef.current = createAnimationState()
    calculateAnimationState(0, stateRef.current)
    initializedRef.current = true
  }

  /**
   * Update animation state based on delta time
   * Call this from useFrame
   */
  const update = useCallback((delta: number): AnimationState => {
    if (!isPlayingRef.current) {
      return stateRef.current
    }

    elapsedRef.current += delta
    calculateAnimationState(elapsedRef.current, stateRef.current)

    // Auto-stop when complete
    if (stateRef.current.phase === 'complete') {
      isPlayingRef.current = false
    }

    return stateRef.current
  }, [])

  /**
   * Start or resume the animation
   */
  const play = useCallback(() => {
    isPlayingRef.current = true
  }, [])

  /**
   * Pause the animation
   */
  const pause = useCallback(() => {
    isPlayingRef.current = false
  }, [])

  /**
   * Reset the animation to the beginning
   */
  const reset = useCallback(() => {
    elapsedRef.current = 0
    calculateAnimationState(0, stateRef.current)
    isPlayingRef.current = false
  }, [])

  /**
   * Get current animation state without updating
   */
  const getState = useCallback((): AnimationState => {
    return stateRef.current
  }, [])

  /**
   * Check if animation is currently playing
   */
  const isPlaying = useCallback((): boolean => {
    return isPlayingRef.current
  }, [])

  /**
   * Check if animation is complete
   */
  const isComplete = useCallback((): boolean => {
    return stateRef.current.phase === 'complete'
  }, [])

  return {
    update,
    play,
    pause,
    reset,
    getState,
    isPlaying,
    isComplete,
  }
}
