/**
 * @fileoverview Type definitions for Norosi2D wave animation system
 */

/**
 * Wave physics parameters
 */
export interface WaveConfig {
  /** Minimum wave amplitude */
  AMP_MIN: number;
  /** Maximum wave amplitude */
  AMP_MAX: number;
  /** Minimum wave frequency */
  FREQ_MIN: number;
  /** Wave frequency range */
  FREQ_RANGE: number;
  /** Minimum wave animation speed */
  SPEED_MIN: number;
  /** Wave speed range */
  SPEED_RANGE: number;
}

/**
 * SVG filter configuration
 */
export interface FilterConfig {
  /** Gaussian blur standard deviation */
  GAUSSIAN_BLUR: number;
  /** Halftone dot expansion radius */
  HALFTONE_RADIUS: number;
  /** Posterization level values (space-separated) */
  POSTERIZE_LEVELS: string;
  /** Halftone dot size in pixels */
  DOT_SIZE: number;
  /** Halftone dot color */
  DOT_COLOR: string;
  /** SVG blend mode */
  BLEND_MODE: string;
}

/**
 * Main configuration object
 */
export interface Norosi2DConfig {
  /** Base canvas size for scaling calculations (px) */
  BASE_SIZE: number;
  /** Canvas aspect ratio (width/height) */
  ASPECT_RATIO: number;
  /** Pixel ratio for canvas resolution control (null = auto-detect) */
  PIXEL_RATIO: number | null;
  /** Number of wave lines to render */
  LINES_COUNT: number;
  /** Number of points per wave line */
  POINTS_PER_LINE: number;
  /** Wave physics parameters */
  WAVE: WaveConfig;
  /** Width of wave line strokes */
  STROKE_WIDTH: number;
  /** Line cap style */
  STROKE_CAP: 'round' | 'square' | 'butt';
  /** Background color in hex format */
  BACKGROUND_COLOR: string;
  /** Horizontal offset ratio for wave lines */
  CENTER_X_OFFSET_RATIO: number;
  /** Wave spacing as multiple of stroke width (rangeX = strokeWidth × this value) */
  SPACING_TO_STROKE_RATIO: number;
  /** SVG filter configuration */
  FILTER: FilterConfig;
  /** Debounce delay for resize events in milliseconds */
  RESIZE_DEBOUNCE_MS: number;
}

/**
 * Gradient color group (array of 3 colors)
 */
export type GradientColorGroup = [string, string, string];

/**
 * Component props for Norosi2D
 */
export interface Norosi2DProps {
  /** Canvas element ID (optional, auto-generated if not provided) */
  canvasId?: string;
  /** Gradient color groups */
  gradientColors?: GradientColorGroup[];
  /** Fixed gradient color stop positions */
  gradientPositions?: [number, number, number];
  /** Height ratio per group (single number or array) */
  groupHeightRatio?: number | number[];
  /** CSS selector for scroll target element (null for body scroll) */
  scrollTargetSelector?: string | null;
  /** Custom configuration overrides */
  config?: Partial<Norosi2DConfig>;
  /** CSS class name for container */
  className?: string;
  /** Inline styles for container */
  style?: React.CSSProperties;
  /** Use container-relative positioning instead of fixed viewport positioning */
  containerized?: boolean;
  /**
   * Override stroke width (fixed value, ignores scale-based adjustment)
   * When specified, this value is used directly without scaling
   */
  strokeWidth?: number;
  /**
   * Number of wave lines to render
   * Overrides config.LINES_COUNT
   */
  linesCount?: number;
  /**
   * Horizontal spread of wave lines (0-1 ratio)
   * Higher values = wider spread between lines
   * Overrides config.CENTER_X_OFFSET_RATIO
   * @default 0.08
   */
  lineSpread?: number;
  /**
   * Per-group wave counts (overrides linesCount per group)
   * Array index maps to gradient group index (0 = bottom group = generation 0)
   * If undefined or shorter than gradientGroups, falls back to linesCount
   */
  groupWaveCounts?: number[];
  /**
   * Per-group parent wave counts
   * Renders shorter waves (bottom half only) with reduced opacity
   * Used to visualize parent token's influence in History view
   * If undefined, no parent waves are rendered
   */
  groupParentWaveCounts?: number[];
  /**
   * Disables scroll-based view positioning and body height modification.
   * Use this when rendering inside modals or dialogs where scroll sync is not needed.
   * @default false
   */
  disableScroll?: boolean;
  /**
   * Callback fired when the component is ready for programmatic control
   * (container has dimensions and Paper.js view is initialized).
   */
  onReady?: () => void;
}

/**
 * Wave animation parameters (cached to maintain consistent shapes)
 */
export interface WaveParams {
  /** Wave amplitude */
  amp: number;
  /** Wave frequency */
  freq: number;
  /** Wave phase offset */
  phase: number;
  /** Wave animation speed */
  speed: number;
}

/**
 * Wave path data stored in Paper.js path.data
 */
export interface WavePathData extends WaveParams {
  /** Base X position */
  baseX: number;
}

/**
 * Gradient group positioning data
 */
export interface GroupData {
  /** Start Y position */
  startY: number;
  /** End Y position */
  endY: number;
  /** Group height */
  groupHeight: number;
  /** Point spacing */
  pointSpacing: number;
}

/**
 * Gradient stop [color, position] pair
 */
export type GradientStop = [string, number];

/**
 * Array of gradient stops for a gradient group
 */
export type GradientStops = GradientStop[];

/**
 * Ref interface for Norosi2D component
 * Exposes scroll control for programmatic animation
 */
export interface Norosi2DRef {
  /**
   * Sets the view center Y position (for animation).
   * @returns true if successful, false if Paper.js view is not ready
   */
  setViewCenterY: (targetY: number) => boolean;
  /** Gets the current container height */
  getContainerHeight: () => number;
  /** Gets the total height ratio */
  getTotalHeightRatio: () => number;
  /**
   * Checks if the Norosi2D component is ready for animation.
   * @returns true if container has dimensions and Paper.js view is initialized
   */
  isReady: () => boolean;
}
