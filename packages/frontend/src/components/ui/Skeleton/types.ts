import type { CSSProperties } from 'react';

/**
 * Skeleton component variant types
 */
export type SkeletonVariant = 'rectangle' | 'circle' | 'text';

/**
 * Skeleton animation types
 */
export type SkeletonAnimation = 'wave' | 'none';

/**
 * Props for the Skeleton component
 */
export interface SkeletonProps {
  /**
   * Visual variant of the skeleton
   * @default 'rectangle'
   */
  variant?: SkeletonVariant;

  /**
   * Width of the skeleton (in pixels or CSS string)
   * @example 200 or "100%"
   */
  width?: number | string;

  /**
   * Height of the skeleton (in pixels or CSS string)
   * @example 100 or "50vh"
   */
  height?: number | string;

  /**
   * Aspect ratio of the skeleton (e.g., "16/9", "1/1")
   * Only applies when height is not specified
   * @example "16/9" or "4/3"
   */
  aspectRatio?: string;

  /**
   * Additional CSS class names
   */
  className?: string;

  /**
   * Custom inline styles
   */
  style?: CSSProperties;

  /**
   * Animation style
   * @default 'wave'
   */
  animation?: SkeletonAnimation;
}

/**
 * Props for the SkeletonGroup component
 */
export interface SkeletonGroupProps {
  /**
   * Number of skeleton items to display
   * @default 3
   */
  count?: number;

  /**
   * Gap between skeleton items (in pixels or CSS string)
   * @default 8
   */
  gap?: number | string;

  /**
   * Direction of skeleton items
   * @default 'column'
   */
  direction?: 'row' | 'column';

  /**
   * Props to pass to each Skeleton component
   */
  skeletonProps?: SkeletonProps;

  /**
   * Additional CSS class names
   */
  className?: string;

  /**
   * Base key prefix for generating unique keys
   * @default 'skeleton'
   */
  keyPrefix?: string;
}
