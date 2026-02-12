/**
 * @fileoverview useNorosiDialogAnimation hook
 * Manages phased Norosi2D animation state for dialog backgrounds
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { NOROSI_ANIMATION_TIMING } from '@/lib/constants/norosiAnimation'
import { getWeatherColorHex, FALLBACK_COLOR_INDEX } from '@/lib/weatherTokens'
import type { GradientColorGroup } from '@/components/features/Norosi2D/types'

/**
 * Color configuration for single-color variant (MintDialogContent)
 */
export interface SingleColorConfig {
  variant: 'single'
  /** Weather colorIndex for the new token */
  colorIndex: number | null
}

/**
 * Color configuration for dual-color variant (RelayMintDialogContent)
 */
export interface DualColorConfig {
  variant: 'dual'
  /** Parent token's colorIndex */
  parentColorIndex: number | null
  /** New token's colorIndex (from weather) */
  newColorIndex: number | null
}

export type ColorConfig = SingleColorConfig | DualColorConfig

/**
 * Animation state returned by the hook
 */
export interface NorosiDialogAnimationState {
  /** Whether to mount the Norosi2D component */
  shouldMountNorosi: boolean
  /** Whether Norosi2D should be visible (opacity transition) */
  isNorosiVisible: boolean
  /** Whether grayscale filter should be removed */
  isColorReady: boolean
  /** Computed gradient colors for Norosi2D */
  gradientColors: GradientColorGroup[]
  /** Reset function for external cleanup needs */
  reset: () => void
}

/**
 * Hook options
 */
export interface UseNorosiDialogAnimationOptions {
  /** Whether the dialog is open */
  isOpen: boolean
  /** Color configuration (single or dual) */
  colorConfig: ColorConfig
}

/**
 * Manages phased Norosi2D animation state for dialog backgrounds
 *
 * Animation phases:
 * 1. Wait for colors to be available
 * 2. Capture colors (prevents reference instability)
 * 3. Mount Norosi2D (invisible)
 * 4. Fade in with grayscale
 * 5. Transition to full color
 *
 * @example
 * // Single-color variant (MintDialogContent)
 * const { shouldMountNorosi, isNorosiVisible, isColorReady, gradientColors } =
 *   useNorosiDialogAnimation({
 *     isOpen,
 *     colorConfig: { variant: 'single', colorIndex: weatherColorIndex }
 *   })
 *
 * @example
 * // Dual-color variant (RelayMintDialogContent)
 * const { shouldMountNorosi, isNorosiVisible, isColorReady, gradientColors } =
 *   useNorosiDialogAnimation({
 *     isOpen,
 *     colorConfig: {
 *       variant: 'dual',
 *       parentColorIndex,
 *       newColorIndex: weatherColorIndex
 *     }
 *   })
 */
export function useNorosiDialogAnimation({
  isOpen,
  colorConfig,
}: UseNorosiDialogAnimationOptions): NorosiDialogAnimationState {
  // Animation state
  const [shouldMountNorosi, setShouldMountNorosi] = useState(false)
  const [isNorosiVisible, setIsNorosiVisible] = useState(false)
  const [isColorReady, setIsColorReady] = useState(false)

  // Captured colors (stabilizes gradientColors reference)
  const [capturedColors, setCapturedColors] = useState<{
    single?: number
    parent?: number
    new?: number
  } | null>(null)

  // Reset function for manual cleanup
  const reset = useCallback(() => {
    setShouldMountNorosi(false)
    setIsNorosiVisible(false)
    setIsColorReady(false)
    setCapturedColors(null)
  }, [])

  // Phase 0: Reset when dialog closes
  useEffect(() => {
    if (!isOpen) {
      reset()
    }
  }, [isOpen, reset])

  // Phase 1: Capture colors when available (allows re-capture when colorIndex changes)
  useEffect(() => {
    if (!isOpen) return

    if (colorConfig.variant === 'single') {
      // Use fallback colorIndex when wallet not connected / weather not fetched
      const colorIndex = colorConfig.colorIndex ?? FALLBACK_COLOR_INDEX
      // Only update if color actually changed (prevents unnecessary re-renders)
      if (capturedColors?.single !== colorIndex) {
        setCapturedColors({ single: colorIndex })
      }
    } else {
      // Dual variant: parent is required, new can fallback
      if (colorConfig.parentColorIndex !== null) {
        const newParent = colorConfig.parentColorIndex
        const newNew = colorConfig.newColorIndex ?? FALLBACK_COLOR_INDEX
        // Only update if colors actually changed
        if (capturedColors?.parent !== newParent || capturedColors?.new !== newNew) {
          setCapturedColors({ parent: newParent, new: newNew })
        }
      }
    }
  }, [isOpen, colorConfig, capturedColors])

  // Phase 2: Mount Norosi2D after colors are captured
  useEffect(() => {
    if (!isOpen || capturedColors === null || shouldMountNorosi) return

    const mountTimer = requestAnimationFrame(() => {
      setShouldMountNorosi(true)
    })
    return () => cancelAnimationFrame(mountTimer)
  }, [isOpen, capturedColors, shouldMountNorosi])

  // Phase 3: Fade in with grayscale
  useEffect(() => {
    if (!shouldMountNorosi || isNorosiVisible) return

    const timer = setTimeout(
      () => setIsNorosiVisible(true),
      NOROSI_ANIMATION_TIMING.INIT_DELAY_MS
    )
    return () => clearTimeout(timer)
  }, [shouldMountNorosi, isNorosiVisible])

  // Phase 4: Remove grayscale
  useEffect(() => {
    if (!isNorosiVisible || isColorReady) return

    const timer = setTimeout(
      () => setIsColorReady(true),
      NOROSI_ANIMATION_TIMING.GRAYSCALE_DURATION_MS
    )
    return () => clearTimeout(timer)
  }, [isNorosiVisible, isColorReady])

  // Compute gradient colors from captured values
  const gradientColors = useMemo((): GradientColorGroup[] => {
    if (capturedColors === null) {
      // Fallback - should not be used when mounted
      return [['#B2B2B200', '#B2B2B2', '#B2B2B2']]
    }

    if ('single' in capturedColors && capturedColors.single !== undefined) {
      // Single-color variant (MintDialogContent)
      // Matches Fumi.sol: transparent -> color -> color
      const hexColor = getWeatherColorHex(capturedColors.single)
      return [[`${hexColor}00`, hexColor, hexColor]]
    }

    // Dual-color variant (RelayMintDialogContent)
    // Group 0 (bottom): Parent wave - solid parent color
    // Group 1 (top): New wave - transparent -> new -> parent
    const parentHex = getWeatherColorHex(capturedColors.parent ?? null)
    const newHex = getWeatherColorHex(capturedColors.new ?? null)
    return [
      [parentHex, parentHex, parentHex],
      [`${newHex}00`, newHex, parentHex],
    ]
  }, [capturedColors])

  return {
    shouldMountNorosi,
    isNorosiVisible,
    isColorReady,
    gradientColors,
    reset,
  }
}
