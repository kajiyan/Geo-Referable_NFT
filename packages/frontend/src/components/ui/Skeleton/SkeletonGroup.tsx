'use client';

import React, { memo, useMemo } from 'react';
import type { CSSProperties } from 'react';
import type { SkeletonGroupProps } from './types';
import { Skeleton } from './Skeleton';

/**
 * Convert width/height value to CSS string
 */
const toCssValue = (value: number | string | undefined): string | undefined => {
  if (value === undefined) return undefined;
  return typeof value === 'number' ? `${value}px` : value;
};

/**
 * SkeletonGroup component for displaying multiple skeleton elements
 *
 * Renders a group of Skeleton components with consistent spacing and direction.
 * Useful for creating complex loading states with multiple elements.
 *
 * @example
 * // Vertical list of text skeletons
 * <SkeletonGroup
 *   count={5}
 *   gap={12}
 *   skeletonProps={{ variant: 'text', width: '100%' }}
 * />
 *
 * @example
 * // Horizontal row of circle skeletons
 * <SkeletonGroup
 *   count={3}
 *   direction="row"
 *   gap={16}
 *   skeletonProps={{ variant: 'circle', width: 48, height: 48 }}
 * />
 */
export const SkeletonGroup: React.FC<SkeletonGroupProps> = memo(({
  count = 3,
  gap = 8,
  direction = 'column',
  skeletonProps,
  className = '',
  keyPrefix = 'skeleton',
}) => {
  // Compute container styles
  const containerStyle = useMemo<CSSProperties>(() => ({
    display: 'flex',
    flexDirection: direction,
    gap: toCssValue(gap),
  }), [direction, gap]);

  // Generate skeleton items with proper keys
  const skeletonItems = useMemo(() =>
    Array.from({ length: count }, (_, index) => (
      <Skeleton
        key={`${keyPrefix}-${index}`}
        {...skeletonProps}
      />
    )),
    [count, keyPrefix, skeletonProps]
  );

  return (
    <div
      className={className}
      style={containerStyle}
      role="status"
      aria-busy="true"
      aria-label="Loading multiple items"
    >
      {skeletonItems}
    </div>
  );
});

SkeletonGroup.displayName = 'SkeletonGroup';
