/**
 * History component constants
 * Data-only constants following the Button component pattern
 */

/**
 * Color constants
 */
export const HISTORY_COLORS = {
  WHITE: '#ffffff',
  STONE_950: '#0c0a09',
  STONE_500: '#78716c',
  STONE_300: '#d6d3d1',
} as const;

/**
 * Size constants
 */
export const HISTORY_SIZES = {
  CONTAINER_HEIGHT: 189,
  MSG_WIDTH: 16,
  MSG_HEIGHT: 88,
  TAG_PADDING_X: 8,
  TAG_PADDING_Y: 4,
  GAP: 8,
} as const;

/**
 * Typography constants
 */
export const HISTORY_TYPOGRAPHY = {
  FONT_SIZE_XS: '12px',
  FONT_SIZE_XL: '20px',
  FONT_WEIGHT_NORMAL: 400,
  FONT_WEIGHT_BOLD: 700,
} as const;

/**
 * Grid layout constants
 */
export const GRID_CONSTANTS = {
  ROW_HEIGHT: 189,
  SCRIM_WIDTH: 107,
  COLUMNS_VISIBLE: 3,
  VERTICAL_GAP: 0,
} as const;

/**
 * Message marquee constants
 */
export const MESSAGE_CONSTANTS = {
  DEFAULT_SPEED_SECONDS: 10,
  DEFAULT_GAP_PX: 12,
  DEFAULT_TEXT_COLOR: '#0C0A09',
  FULL_WIDTH_SPACE: '\u3000',
  TOKEN_ID_PAD_LENGTH: 3,
} as const;

// Legacy exports for backward compatibility during migration
// TODO: Remove after all components are updated
export const HISTORY_CONSTANTS = {
  COLORS: HISTORY_COLORS,
  SIZES: HISTORY_SIZES,
  TYPOGRAPHY: HISTORY_TYPOGRAPHY,
} as const;
