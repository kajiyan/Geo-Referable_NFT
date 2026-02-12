/**
 * @fileoverview Norosi2D animation timing and configuration constants
 * Used by MintDialogContent and RelayMintDialogContent for consistent animation behavior
 */

/**
 * Phased animation timing constants for Norosi2D dialog backgrounds
 *
 * Animation sequence:
 * 1. Dialog opens -> Wait for colorIndex capture
 * 2. INIT_DELAY_MS -> Mount Norosi2D (invisible)
 * 3. GRAYSCALE_DURATION_MS -> Fade in with grayscale filter
 * 4. (RelayMint only) SCROLL_ANIMATION_DELAY_MS -> Begin scroll transition
 * 5. SCROLL_ANIMATION_DURATION_MS -> Complete scroll animation
 */
export const NOROSI_ANIMATION_TIMING = {
  /** Wait time for Paper.js canvas initialization (canvas mount + scope setup) */
  INIT_DELAY_MS: 100,
  /** Grayscale display duration for visual stabilization before color reveal */
  GRAYSCALE_DURATION_MS: 250,
  /** Delay before scroll animation starts (after grayscale ends) - RelayMint only */
  SCROLL_ANIMATION_DELAY_MS: 500,
  /** Duration of scroll animation - RelayMint only */
  SCROLL_ANIMATION_DURATION_MS: 3000,
} as const

export type NorosiAnimationTiming = typeof NOROSI_ANIMATION_TIMING

/**
 * Height ratios for wave groups
 *
 * Based on Fumi.sol rendering logic:
 * - PARENT: 100% to fill viewport initially
 * - NEW: 105% based on Fumi.sol main wave ratio (420/400)
 * - SINGLE: 100% for basic mint (single wave group)
 */
export const NOROSI_HEIGHT_RATIOS = {
  /** Parent wave: covers full viewport */
  PARENT: 1.0,
  /** New wave: 420/400 from Fumi.sol */
  NEW: 1.05,
  /** Single group for basic mint */
  SINGLE: 1.0,
} as const

export type NorosiHeightRatios = typeof NOROSI_HEIGHT_RATIOS

/**
 * Pre-computed height ratio arrays for Norosi2D groupHeightRatio prop
 * Note: Using explicit types instead of `as const` for array mutability compatibility with Norosi2DProps
 */
export const NOROSI_GROUP_HEIGHT_RATIOS: {
  SINGLE: number[]
  DUAL: number[]
} = {
  /** Single group (basic mint) */
  SINGLE: [NOROSI_HEIGHT_RATIOS.SINGLE],
  /** Dual groups (relay mint): [parent, new] */
  DUAL: [NOROSI_HEIGHT_RATIOS.PARENT, NOROSI_HEIGHT_RATIOS.NEW],
}

/**
 * Default Norosi2D visual configuration for modal backgrounds
 */
export const NOROSI_MODAL_DEFAULTS = {
  /** Container opacity when visible */
  VISIBLE_OPACITY: 0.6,
  /** Wave stroke width */
  STROKE_WIDTH: 10,
  /** Default wave count (based on refCount=0 logic from Fumi.sol) */
  DEFAULT_LINES_COUNT: 3,
  /** Horizontal spread between wave lines */
  LINE_SPREAD: 0.05,
  /** Gradient positions matching Fumi.sol */
  GRADIENT_POSITIONS: [0, 0.7, 1.0] as [number, number, number],
} as const

export type NorosiModalDefaults = typeof NOROSI_MODAL_DEFAULTS

/**
 * Calculates wave count from reference count
 * Mirrors Fumi.sol _getWaveCountFromRefs function
 *
 * @param refCount - Number of references the token has
 * @returns Wave count (3-12)
 */
export function getWaveCountFromRefs(refCount: number): number {
  if (refCount < 5) return 3
  if (refCount < 10) return 5
  if (refCount < 20) return 7
  if (refCount < 50) return 9
  if (refCount < 100) return 10
  return 12
}
