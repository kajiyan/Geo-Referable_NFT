/**
 * TypeScript type definitions for WaveSVG component
 */

/**
 * Props for the WaveSVG component
 */
export interface WaveSVGProps {
  /**
   * Token ID used as RNG seed for deterministic wave generation
   * Matches Fumi.sol tokenId parameter
   */
  tokenId: string;

  /**
   * Token's color index (0-13)
   * Maps to Fumi.sol COLOR_TABLE
   */
  colorIndex: number;

  /**
   * Parent/reference token's color index (0-13)
   * Used for gradient bottom color
   * If undefined, uses colorIndex (monochrome gradient)
   */
  referenceColorIndex?: number;

  /**
   * Token's reference count
   * Determines number of main waves (3-12)
   */
  refCount: number;

  /**
   * Parent token's reference count
   * Determines number of parent waves (3-12)
   * Default: 0 (no parent waves)
   */
  parentRefCount?: number;

  /**
   * Whether token has a parent (totalDistance > 0)
   * Controls gradient top opacity
   */
  hasParent: boolean;

  /**
   * Whether animations are paused
   * Used with IntersectionObserver for performance
   */
  isPaused?: boolean;

  /**
   * Additional CSS class name
   */
  className?: string;

  /**
   * Inline styles
   */
  style?: React.CSSProperties;

  /**
   * Whether to disable the blur/halftone filter
   * Useful for performance optimization in lists
   */
  disableFilter?: boolean;
}

/**
 * Wave path data for a single wave line
 */
export interface WavePathData {
  /**
   * SVG path d attribute value
   */
  d: string;

  /**
   * Wave index (0 to waveCount-1)
   */
  index: number;
}

/**
 * Wave generation parameters (derived from tokenId hash)
 */
export interface WaveParams {
  /**
   * Amplitude in fixed-point (scaled by 1e5)
   * Range: 2_000_000 to 5_000_000 (20-50px)
   */
  amp1e5: bigint;

  /**
   * Frequency in fixed-point (scaled by 1e4)
   * Range: 50 to 150 (0.005-0.015)
   */
  freq1e4: bigint;

  /**
   * Phase in fixed-point (scaled by 1e4)
   * Range: 0 to 62832 (0 to 2π)
   */
  phase1e4: bigint;
}

/**
 * Gradient stop configuration
 */
export interface GradientStop {
  /**
   * Offset percentage (0-100)
   */
  offset: string;

  /**
   * Stop color (hex format)
   */
  color: string;

  /**
   * Stop opacity (0-1)
   */
  opacity: number;
}
