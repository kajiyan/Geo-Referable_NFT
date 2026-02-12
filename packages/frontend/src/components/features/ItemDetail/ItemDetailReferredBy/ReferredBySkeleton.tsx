'use client';

import React, { memo, useMemo } from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import { HEIGHTS } from '@/lib/itemDetailGradients';
import './ItemDetailReferredBy.css';

interface ReferredBySkeletonProps {
  /** Number of rows to display skeleton for */
  rowCount: number;
  /** Override row height (default: 398px) */
  rowHeight?: number;
  /** Override gap between rows (default: 16px) */
  gap?: number;
}

/**
 * Skeleton component for ReferredBy section
 * Calculates total height based on row count using the same formula as calculateReferredByHeight
 */
const ReferredBySkeletonComponent: React.FC<ReferredBySkeletonProps> = ({
  rowCount,
  rowHeight = HEIGHTS.REFERRED_BY_ROW,
  gap = HEIGHTS.ROW_GAP,
}) => {
  // Calculate total height: (rowHeight × rowCount) + (gap × (rowCount - 1))
  const totalHeight = useMemo(() => {
    if (rowCount <= 0) return rowHeight; // Default to 1 row
    return (rowHeight * rowCount) + (gap * Math.max(0, rowCount - 1));
  }, [rowCount, rowHeight, gap]);

  if (rowCount <= 0) {
    return (
      <div className="item-detail-referred-by">
        <Skeleton width="100%" height={rowHeight} />
      </div>
    );
  }

  return (
    <div className="item-detail-referred-by">
      <Skeleton width="100%" height={totalHeight} />
    </div>
  );
};

export const ReferredBySkeleton = memo(ReferredBySkeletonComponent);
ReferredBySkeleton.displayName = 'ReferredBySkeleton';
