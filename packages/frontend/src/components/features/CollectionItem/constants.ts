/**
 * CollectionItem component constants
 * Based on Figma design: NFT/SM/Item (node-id: 221581:1776)
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
 * Size constants from Figma design
 */
export const COLLECTION_ITEM_SIZES = {
  // Container dimensions (inner content)
  CONTAINER_WIDTH: 342,
  CONTAINER_HEIGHT: 189,
  // Outer frame with padding
  FRAME_PADDING: 6,
  FRAME_WIDTH: 354,
  FRAME_HEIGHT: 201,
  // Message bar dimensions
  MSG_WIDTH: 16,
  MSG_HEIGHT: 88,
  // Tag dimensions
  TAG_PADDING_X: 8,
  TAG_BORDER_RADIUS: 8,
  // Gaps
  GAP: 8,
  MSG_GAP: 5,
} as const;

/**
 * Typography constants from Figma design
 */
export const COLLECTION_ITEM_TYPOGRAPHY = {
  // XS/Regular - tags
  FONT_SIZE_XS: 12,
  FONT_WEIGHT_NORMAL: 400,
  LINE_HEIGHT_XS: 16,
  LETTER_SPACING_XS: 0.5,
  // XL/Bold - token ID
  FONT_SIZE_XL: 20,
  FONT_WEIGHT_BOLD: 700,
  LINE_HEIGHT_XL: 100, // percentage
  LETTER_SPACING_XL: 0.5,
} as const;

/**
 * Message marquee constants
 */
export const MESSAGE_CONSTANTS = {
  DEFAULT_SPEED_SECONDS: 10,
  DEFAULT_GAP_PX: 6,
  DEFAULT_TEXT_COLOR: '#0C0A09',
  FULL_WIDTH_SPACE: '\u3000',
  TOKEN_ID_PAD_LENGTH: 3,
} as const;

/**
 * StaticMap configuration for collection item
 */
export const STATIC_MAP_CONFIG = {
  ZOOM: 16,
  ASPECT_RATIO: '16/9',
  DEFAULT_WIDTH: 342,
} as const;

/**
 * Norosi2D background configuration for CollectionItem
 * Following Fumi.sol wave rendering specifications
 *
 * @see packages/contracts/contracts/Fumi.sol
 */
export const NOROSI_BACKGROUND_CONFIG = {
  /** Main waves height ratio (full height) */
  MAIN_HEIGHT_RATIO: 1.0,
  /** Parent waves height ratio (container is already positioned at bottom 55%) */
  PARENT_HEIGHT_RATIO: 1.0,
  /** Horizontal spread of wave lines */
  LINE_SPREAD: 0.06,
  /** Parent waves opacity (Fumi.sol: 0.85) */
  PARENT_OPACITY: 0.85,
  /** IntersectionObserver root margin for pre-loading */
  VISIBILITY_ROOT_MARGIN: '100px 0px',
} as const;
