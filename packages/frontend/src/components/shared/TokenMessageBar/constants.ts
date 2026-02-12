/**
 * TokenMessageBar component constants
 * Extracted from CollectionItem for shared use
 */

/**
 * Animation timing constants for visibility observer
 */
export const ANIMATION_CONSTANTS = {
  /** Delay before visibility observer becomes "armed" (prevents flicker on initial render) */
  VISIBILITY_ARM_DELAY_MS: 600,
  /** Intersection observer threshold values */
  VISIBILITY_THRESHOLD: [0, 0.05] as const,
} as const;

/**
 * Message bar size constants from Figma design
 */
export const MESSAGE_BAR_SIZES = {
  /** Message bar width (vertical bar width) */
  MSG_WIDTH: 16,
  /** Message bar height (visible viewport height) */
  MSG_HEIGHT: 88,
} as const;

/**
 * Message marquee constants
 */
export const MESSAGE_CONSTANTS = {
  DEFAULT_SPEED_SECONDS: 10,
  DEFAULT_GAP_PX: 6,
} as const;
