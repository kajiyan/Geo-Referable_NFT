/**
 * @fileoverview useNorosiScrollAnimation hook
 * Manages RAF-based scroll animation for Norosi2D with proper cleanup
 *
 * CRITICAL: This hook fixes the memory leak bug where RAF loops continued
 * after dialog close in the original RelayMintDialogContent implementation.
 */

import { useRef, useCallback, useEffect, useState } from 'react'
import {
  NOROSI_ANIMATION_TIMING,
  NOROSI_HEIGHT_RATIOS,
} from '@/lib/constants/norosiAnimation'
import type { Norosi2DRef } from '@/components/features/Norosi2D/types'

/**
 * Configuration for scroll animation
 */
export interface ScrollAnimationConfig {
  /** Parent wave height ratio */
  parentHeightRatio?: number
  /** New wave height ratio */
  newHeightRatio?: number
  /** Animation duration in milliseconds */
  durationMs?: number
}

/**
 * Return type for useNorosiScrollAnimation
 */
export interface NorosiScrollAnimationReturn {
  /** Ref to attach to Norosi2D component */
  norosiRef: React.RefObject<Norosi2DRef | null>
  /** Whether Norosi2D is ready for programmatic control */
  isNorosi2DReady: boolean
  /** Whether the initial position has been set */
  hasInitialPosition: boolean
  /** Whether the scroll animation has completed */
  hasAnimated: boolean
  /** Set initial view position to parent wave */
  setInitialPosition: () => boolean
  /** Manually trigger the scroll animation */
  startAnimation: () => void
  /** Reset animation state (call when dialog closes) */
  reset: () => void
  /** Callback to pass as Norosi2D's onReady prop */
  handleNorosi2DReady: () => void
}

/**
 * Manages RAF-based scroll animation for Norosi2D in relay mint dialogs
 *
 * This hook properly handles:
 * - RAF loop cleanup on unmount and dialog close
 * - Animation locking to prevent concurrent animations
 * - Initial position setting before animation starts
 * - Waiting for Norosi2D readiness via onReady callback (no polling)
 *
 * @example
 * const {
 *   norosiRef,
 *   hasInitialPosition,
 *   hasAnimated,
 *   setInitialPosition,
 *   startAnimation,
 *   reset,
 *   handleNorosi2DReady
 * } = useNorosiScrollAnimation()
 *
 * // Reset when dialog closes
 * useEffect(() => {
 *   if (!isOpen) reset()
 * }, [isOpen, reset])
 *
 * // Set initial position when Norosi2D is visible and ready
 * useEffect(() => {
 *   if (isNorosiVisible && isNorosi2DReady && !hasInitialPosition) {
 *     setInitialPosition()
 *   }
 * }, [isNorosiVisible, isNorosi2DReady, hasInitialPosition, setInitialPosition])
 *
 * // Start animation when ready
 * useEffect(() => {
 *   if (isColorReady && hasInitialPosition && !hasAnimated) {
 *     const timer = setTimeout(startAnimation, NOROSI_ANIMATION_TIMING.SCROLL_ANIMATION_DELAY_MS)
 *     return () => clearTimeout(timer)
 *   }
 * }, [isColorReady, hasInitialPosition, hasAnimated, startAnimation])
 *
 * // In JSX
 * <Norosi2D ref={norosiRef} onReady={handleNorosi2DReady} ... />
 */
export function useNorosiScrollAnimation(
  config: ScrollAnimationConfig = {}
): NorosiScrollAnimationReturn {
  const {
    parentHeightRatio = NOROSI_HEIGHT_RATIOS.PARENT,
    newHeightRatio = NOROSI_HEIGHT_RATIOS.NEW,
    durationMs = NOROSI_ANIMATION_TIMING.SCROLL_ANIMATION_DURATION_MS,
  } = config

  // Refs for Norosi2D access and animation control
  const norosiRef = useRef<Norosi2DRef | null>(null)

  // RAF cleanup refs - CRITICAL for preventing memory leaks
  const rafIdRef = useRef<number | null>(null)
  const animationLockRef = useRef(false)

  // Animation state refs (using refs to avoid useCallback dependency issues)
  const hasInitialPositionRef = useRef(false)
  const hasAnimatedRef = useRef(false)

  // State for external consumption (triggers re-renders)
  const [hasInitialPosition, setHasInitialPosition] = useState(false)
  const [hasAnimated, setHasAnimated] = useState(false)

  // Norosi2D readiness state (driven by onReady callback)
  const [isNorosi2DReady, setIsNorosi2DReady] = useState(false)

  /**
   * Cancels any running RAF animation
   * CRITICAL: Must be called on dialog close and component unmount
   */
  const cancelAnimation = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
    animationLockRef.current = false
  }, [])

  /**
   * Reset all animation state
   * Call this when dialog closes
   */
  const reset = useCallback(() => {
    cancelAnimation()
    hasInitialPositionRef.current = false
    hasAnimatedRef.current = false
    setHasInitialPosition(false)
    setHasAnimated(false)
    setIsNorosi2DReady(false)
  }, [cancelAnimation])

  /**
   * Callback for Norosi2D's onReady prop.
   * Signals that Norosi2D has dimensions and Paper.js view is initialized.
   */
  const handleNorosi2DReady = useCallback(() => {
    setIsNorosi2DReady(true)
  }, [])

  /**
   * Set initial view position to show parent wave.
   * Should only be called when Norosi2D is confirmed ready (via onReady).
   * @returns true if position was set, false if not ready or already set
   */
  const setInitialPosition = useCallback((): boolean => {
    if (!norosiRef.current || hasInitialPositionRef.current) return false

    const containerHeight = norosiRef.current.getContainerHeight()
    if (containerHeight === 0) return false

    // Initial position: Center of parent wave (bottom of canvas)
    const startY = containerHeight * (newHeightRatio + parentHeightRatio / 2)
    const success = norosiRef.current.setViewCenterY(startY)

    if (success) {
      hasInitialPositionRef.current = true
      setHasInitialPosition(true)
    }
    return success
  }, [newHeightRatio, parentHeightRatio])

  /**
   * Start the scroll animation from parent wave to new wave
   * Uses RAF for smooth 60fps animation with proper cleanup
   */
  const startAnimation = useCallback(() => {
    // Guards: prevent concurrent animations and require initial position
    if (animationLockRef.current || hasAnimatedRef.current) return
    if (!norosiRef.current || !hasInitialPositionRef.current) return

    const containerHeight = norosiRef.current.getContainerHeight()
    if (containerHeight === 0) return

    // Lock animation to prevent re-entry
    animationLockRef.current = true

    // Calculate Y positions
    const startY = containerHeight * (newHeightRatio + parentHeightRatio / 2)
    const endY = containerHeight * newHeightRatio / 2

    const startTime = performance.now()

    const animate = (currentTime: number) => {
      // Check if animation was cancelled
      if (!animationLockRef.current) return

      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / durationMs, 1)

      // Cubic ease-in-out for smooth acceleration and deceleration
      const eased = progress < 0.5
        ? 4 * Math.pow(progress, 3)
        : 1 - Math.pow(-2 * progress + 2, 3) / 2

      const currentY = startY + (endY - startY) * eased

      // Use return value to detect if view became unavailable
      const success = norosiRef.current?.setViewCenterY(currentY) ?? false
      if (!success && progress < 1) {
        // View became unavailable, stop animation gracefully
        rafIdRef.current = null
        animationLockRef.current = false
        return
      }

      if (progress < 1) {
        rafIdRef.current = requestAnimationFrame(animate)
      } else {
        // Animation complete
        rafIdRef.current = null
        animationLockRef.current = false
        hasAnimatedRef.current = true
        setHasAnimated(true)
      }
    }

    rafIdRef.current = requestAnimationFrame(animate)
  }, [durationMs, newHeightRatio, parentHeightRatio])

  // Cleanup on unmount - CRITICAL for preventing memory leaks
  useEffect(() => {
    return () => {
      cancelAnimation()
    }
  }, [cancelAnimation])

  return {
    norosiRef,
    isNorosi2DReady,
    hasInitialPosition,
    hasAnimated,
    setInitialPosition,
    startAnimation,
    reset,
    handleNorosi2DReady,
  }
}
