/**
 * Fumi.sol algorithm constants for SVG wave generation
 * @see packages/contracts/contracts/Fumi.sol
 */

import { WEATHER_TOKEN_COLORS } from '@/lib/weatherTokens';

// ============================================
// Fixed-point arithmetic scales
// ============================================

/** 2π × 10^4 for fixed-point angle calculations */
export const TWO_PI_1E4 = 62832;

/** Vertical step in phase space (13.7931 × 10^4) */
export const STEP_1E4 = 137_931;

/** Conversion factor: radians to degrees×10 numerator */
export const DEG10_NUM = 203_400;

/** Conversion factor: radians to degrees×10 denominator (355 × 10^4) */
export const DEG10_DEN = 3_550_000;

/** Scale factor 10^4 */
export const SCALE_1E4 = 10_000;

/** Scale factor 10^5 */
export const SCALE_1E5 = 100_000;

/** Scale factor 10^10 (as BigInt for precision) */
export const SCALE_1E10 = BigInt('10000000000');

// ============================================
// Wave amplitude parameters
// ============================================

/** Minimum amplitude: 20px × 10^5 (as BigInt) */
export const AMP_MIN_1E5 = BigInt('2000000');

/** Amplitude span: max - min + 1 (20-50px range) (as BigInt) */
export const AMP_SPAN = BigInt('3000001');

// ============================================
// Wave frequency parameters
// ============================================

/** Minimum frequency: 0.005 × 10^4 (as BigInt) */
export const FREQ_MIN_1E4 = BigInt('50');

/** Frequency span: max - min + 1 (0.005-0.015 range) (as BigInt) */
export const FREQ_SPAN = BigInt('101');

// ============================================
// Wave segment counts
// ============================================

/** Number of segments for main waves (Y: -20 to 420) */
export const N_SEG = 29;

/** Number of segments for parent reference waves (Y: 200 to 420) */
export const PARENT_N_SEG = 12;

// ============================================
// Y-axis positions and step sizes
// ============================================

/** Main wave starting Y coordinate */
export const MAIN_WAVE_START_Y = -20;

/** Parent wave starting Y coordinate */
export const PARENT_WAVE_START_Y = 200;

/** Main wave vertical step size (420 - (-20)) / 29 ≈ 15.172 */
export const MAIN_WAVE_DY = '15.172';

/** Parent wave vertical step size (420 - 200) / 12 ≈ 18.333 */
export const PARENT_WAVE_DY = '18.333';

/** Parent wave phase calculation step (scaled by 1e4) */
export const PARENT_STEP_SIZE = 133_333;

// ============================================
// SVG viewBox dimensions
// ============================================

/** SVG viewBox width */
export const SVG_WIDTH = 400;

/** SVG viewBox height */
export const SVG_HEIGHT = 400;

/** SVG viewBox string */
export const SVG_VIEWBOX = '0 0 400 400';

// ============================================
// Animation timing (seconds)
// ============================================

/** Main wave animation duration */
export const MAIN_ANIMATION_DURATION = 8;

/** Parent wave animation duration */
export const PARENT_ANIMATION_DURATION = 10;

// ============================================
// Stroke properties
// ============================================

/** Stroke dash array for wave animation */
export const STROKE_DASHARRAY = '41 16';

/** Stroke dash offset for main wave animation end state */
export const STROKE_DASHOFFSET_MAIN = 456;

/** Stroke dash offset for parent wave animation end state */
export const STROKE_DASHOFFSET_PARENT = 228;

/** Stroke width for wave paths */
export const STROKE_WIDTH = 10;

/** Stroke line cap style */
export const STROKE_LINECAP = 'round';

// ============================================
// Parent wave opacity
// ============================================

/** Parent wave group opacity (Fumi.sol: 0.85) */
export const PARENT_OPACITY = 0.85;

// ============================================
// Color table (matches Fumi.sol COLOR_TABLE)
// ============================================

/**
 * Color lookup table mapping colorIndex (0-13) to hex colors
 * Matches Fumi.sol COLOR_TABLE exactly
 * Derived from single source of truth: weatherTokens.ts
 */
export const COLOR_TABLE: readonly string[] = Object.values(WEATHER_TOKEN_COLORS);

/**
 * Get hex color for a color index
 * @param colorIndex - Color index (0-13)
 * @returns Hex color string (e.g., '#F3A0B6')
 */
export function getColorHex(colorIndex: number): string {
  const safeIndex = Math.abs(colorIndex) % 14;
  return COLOR_TABLE[safeIndex];
}
