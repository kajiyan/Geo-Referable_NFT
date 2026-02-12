'use client';

import React, { memo, useMemo } from 'react';
import type { CSSProperties } from 'react';
import type { SkeletonProps } from './types';
import styles from './Skeleton.module.css';

/**
 * Variant-specific CSS classes mapping
 */
const VARIANT_CLASSES: Record<string, string> = {
  rectangle: styles.rectangle,
  circle: styles.circle,
  text: styles.text,
} as const;

/**
 * Animation-specific CSS classes mapping
 */
const ANIMATION_CLASSES: Record<string, string> = {
  wave: styles.wave,
  none: styles.none,
} as const;

/**
 * Convert width/height value to CSS string
 */
const toCssValue = (value: number | string | undefined): string | undefined => {
  if (value === undefined) return undefined;
  return typeof value === 'number' ? `${value}px` : value;
};

/**
 * Skeleton component for displaying loading placeholders
 *
 * A flexible skeleton loader component that supports multiple variants,
 * animations, and aspect ratios. Follows accessibility best practices
 * with proper ARIA attributes.
 *
 * @example
 * // Basic rectangle skeleton
 * <Skeleton width={200} height={100} />
 *
 * @example
 * // Aspect ratio based skeleton (for images/maps)
 * <Skeleton width={800} aspectRatio="16/9" />
 *
 * @example
 * // Circle skeleton (for avatars)
 * <Skeleton variant="circle" width={64} height={64} />
 *
 * @example
 * // Text line skeleton
 * <Skeleton variant="text" width="100%" />
 *
 * @example
 * // Static skeleton without animation
 * <Skeleton width={200} height={100} animation="none" />
 */
export const Skeleton: React.FC<SkeletonProps> = memo(({
  variant = 'rectangle',
  width,
  height,
  aspectRatio,
  className = '',
  style,
  animation = 'wave',
}) => {
  // Compute inline styles based on props
  const inlineStyles = useMemo<CSSProperties>(() => ({
    ...(width && { width: toCssValue(width) }),
    ...(height && { height: toCssValue(height) }),
    // Apply aspect ratio only when height is not specified
    ...(aspectRatio && !height && { aspectRatio }),
    // Merge custom styles
    ...style,
  }), [width, height, aspectRatio, style]);

  // Compute combined class names
  const classNames = useMemo(() => {
    const classes = [
      styles.skeleton,
      VARIANT_CLASSES[variant],
      ANIMATION_CLASSES[animation],
      className,
    ].filter(Boolean);

    return classes.join(' ');
  }, [variant, animation, className]);

  return (
    <div
      className={classNames}
      style={inlineStyles}
      role="status"
      aria-busy="true"
      aria-label="Loading content"
    >
      <span className={styles.srOnly}>Loading...</span>
    </div>
  );
});

Skeleton.displayName = 'Skeleton';
