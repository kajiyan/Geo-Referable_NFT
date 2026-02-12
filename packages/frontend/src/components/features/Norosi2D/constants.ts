/**
 * @fileoverview Application Configuration Constants
 * Centralized configuration for the Norosi2D wave animation system
 */

import type { Norosi2DConfig, GradientColorGroup } from './types';

/**
 * Default configuration for Norosi2D wave animation
 *
 * @remarks
 * - BASE_SIZE: Base design size (400px) for scaling calculations
 * - ASPECT_RATIO: Canvas width/height ratio (1 = square)
 * - PIXEL_RATIO: null = auto-detect device pixel ratio, or force 1/2/3
 * - LINES_COUNT: Number of animated wave lines
 * - POINTS_PER_LINE: Points per wave path (higher = smoother curves)
 * - WAVE: Physics parameters for sine wave animation
 * - STROKE_WIDTH: Line thickness in pixels
 * - STROKE_CAP: Line ending style (round/square/butt)
 * - BACKGROUND_COLOR: Canvas background color
 * - CENTER_X_OFFSET_RATIO: Horizontal spread of wave lines (0.08 = 8% of container width)
 * - FILTER: SVG filter pipeline parameters
 * - RESIZE_DEBOUNCE_MS: Debounce delay for resize events
 */
export const DEFAULT_CONFIG: Norosi2DConfig = {
  // Canvas Configuration
  BASE_SIZE: 400,
  ASPECT_RATIO: 1,

  /**
   * Pixel Ratio Configuration
   * Controls canvas resolution rendering quality
   *
   * - null or 'auto': Use device's native pixel ratio (window.devicePixelRatio)
   * - 1: Standard resolution (1:1 pixel mapping)
   * - 2: Retina/HiDPI resolution (2x resolution)
   * - 3: Ultra-high resolution (3x resolution)
   *
   * Higher values = sharper rendering but increased memory/performance cost
   */
  PIXEL_RATIO: null,

  // Animation Configuration
  LINES_COUNT: 12,
  POINTS_PER_LINE: 30,

  // Wave Parameters (base values for 400x400 canvas)
  WAVE: {
    AMP_MIN: 16,
    AMP_MAX: 40,
    FREQ_MIN: 0.005,
    FREQ_RANGE: 0.01,
    SPEED_MIN: 1,
    SPEED_RANGE: 2,
  },

  // Visual Style
  STROKE_WIDTH: 8,
  STROKE_CAP: 'round',
  BACKGROUND_COLOR: '#ffffff',

  // Layout Parameters
  CENTER_X_OFFSET_RATIO: 0.08,
  /** Wave spacing as multiple of stroke width (rangeX = strokeWidth × 2) */
  SPACING_TO_STROKE_RATIO: 1.4,

  // SVG Filter Parameters
  FILTER: {
    GAUSSIAN_BLUR: 6,
    HALFTONE_RADIUS: 3,
    POSTERIZE_LEVELS: '0 0.5 1',
    DOT_SIZE: 3,
    DOT_COLOR: 'black',
    BLEND_MODE: 'multiply',
  },

  // Resize Configuration
  RESIZE_DEBOUNCE_MS: 100,
};

/**
 * Default scroll target element selector
 * The canvas rendering position will be synchronized with this element's viewport position
 * Set to null to disable (body scroll will be used instead)
 */
export const DEFAULT_SCROLL_TARGET_SELECTOR: string | null = '#main';

/**
 * Default gradient color groups
 * Each group contains 3 colors [start, middle, end]
 * Groups are displayed in order: index 0 is top, index 1 is bottom
 *
 * @remarks
 * First color of first group uses transparency (#B8B3FB00) for smooth top fade
 */
export const DEFAULT_GRADIENT_COLORS: GradientColorGroup[] = [
  ['#B8B3FB00', '#B8B3FB', '#96FFCD'], // Group 0 (top) - Purple to green
  ['#ff0000', '#00ff00', '#0000ff'],   // Group 1 (bottom) - RGB
];

/**
 * Fixed gradient color stop positions
 * These positions are used for all gradient groups
 * [start, middle, end] at positions [0, 0.7, 1.0]
 */
export const DEFAULT_GRADIENT_POSITIONS: [number, number, number] = [0, 0.7, 1.0];

/**
 * Default group height ratio configuration
 * - Single number: applies to all groups (e.g., 1.0 = each group gets 1x viewport height)
 * - Array: per-group ratios (e.g., [0.5, 1.0] = first group 0.5x, second 1.0x)
 *
 * @example
 * // Each group gets 0.5× viewport height
 * DEFAULT_GROUP_HEIGHT_RATIO = 0.5;
 *
 * @example
 * // First group 0.5×, second group 1.0× viewport height
 * DEFAULT_GROUP_HEIGHT_RATIO = [0.5, 1.0];
 */
export const DEFAULT_GROUP_HEIGHT_RATIO: number | number[] = 0.5;

/**
 * Parent wave rendering configuration
 * These values control how parent waves are displayed relative to main waves
 *
 * Parent waves visualize the parent token's influence in History view.
 * They appear as shorter, semi-transparent waves in the bottom portion of each group.
 *
 * @remarks
 * - START_POSITION_RATIO: 0.45 means parent waves start at 45% from the top (bottom 55%)
 * - HEIGHT_RATIO: 0.55 means parent waves occupy 55% of the group height
 * - HORIZONTAL_SPREAD_RATIO: 0.6 means parent waves have 60% of main waves' horizontal spread
 * - OPACITY: 0.5 means parent waves are 50% transparent
 */
export const PARENT_WAVE_CONFIG = {
  /** Start position as ratio from top (0.45 = 45% from top = bottom 55%) */
  START_POSITION_RATIO: 0.45,
  /** Height ratio of parent waves (0.55 = 55% of group height) */
  HEIGHT_RATIO: 0.55,
  /** Horizontal spread ratio relative to main waves */
  HORIZONTAL_SPREAD_RATIO: 0.6,
  /** Opacity of parent waves */
  OPACITY: 0.5,
} as const;
