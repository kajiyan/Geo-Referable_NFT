'use client';

/**
 * CollectionItemBackground component
 * Renders SVG wave animation as background for CollectionItem
 *
 * Performance optimization: Viewport culling + animation pause
 * - SVG is NOT rendered until element enters viewport (triggerOnce)
 * - Once rendered, SVG stays in DOM (avoids filter recalculation)
 * - Animation is paused when element leaves viewport (saves CPU)
 * - Animation resumes when element re-enters viewport
 *
 * Uses react-intersection-observer for optimized observer management:
 * - Observer instances are shared internally
 * - useOnInView provides callback without re-renders
 *
 * Uses WaveSVG component which implements Fumi.sol wave rendering:
 * - Deterministic wave paths from tokenId (keccak256)
 * - Main waves: full height, based on token.refCount (3-12 waves)
 * - Parent waves: bottom 55%, based on parent.refCount, 85% opacity
 * - CSS animations for rising effect (stroke-dasharray/dashoffset)
 */

import React, { useState, useCallback, useMemo, memo } from 'react';
import { useInView, useOnInView } from 'react-intersection-observer';
import { WaveSVG } from '../WaveSVG';
import type { Token } from '@/types';
import { getParentData, parseColorIndex } from './utils';
import { cn } from '@/lib/cn';

/** IntersectionObserver root margin for pre-loading */
const VIEWPORT_ROOT_MARGIN = '200px 0px';

interface CollectionItemBackgroundProps {
  token: Token;
}

/**
 * CollectionItem background with WaveSVG animation
 *
 * Fumi.sol compliance:
 * - Uses same keccak256 hashing for deterministic wave generation
 * - Same wave count calculation based on refCount
 * - Same gradient colors from colorIndex
 * - CSS animations matching Fumi.sol timing (8s main, 10s parent)
 */
const CollectionItemBackgroundComponent: React.FC<CollectionItemBackgroundProps> = ({ token }) => {
  // Animation pause state (only state we need to manage)
  const [isPaused, setIsPaused] = useState(true);

  // Observer 1: Initial render trigger (triggerOnce)
  // - inView becomes true once and stays true forever
  // - ref is callback ref that handles observer lifecycle
  // - Observers are shared internally for same options
  const { ref: renderRef, inView: shouldRender } = useInView({
    triggerOnce: true,
    rootMargin: VIEWPORT_ROOT_MARGIN,
    threshold: 0,
    fallbackInView: true, // SSR fallback
  });

  // Observer 2: Animation pause/resume (no re-renders!)
  // - Callback fires on enter/leave without causing component re-render
  // - Perfect for animation-play-state control
  // - skip: Only observe after SVG is rendered
  const pauseRef = useOnInView(
    (inView) => {
      setIsPaused(!inView);
    },
    {
      rootMargin: VIEWPORT_ROOT_MARGIN,
      threshold: 0,
      skip: !shouldRender,
    }
  );

  // Merge multiple refs into one callback
  // Recommended pattern from react-intersection-observer docs
  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      renderRef(node);
      pauseRef(node);
    },
    [renderRef, pauseRef]
  );

  // Compute wave configuration from token data
  const waveConfig = useMemo(() => {
    const colorIndex = parseColorIndex(token.colorIndex);
    const refCount = parseInt(token.refCount || '0', 10);
    const parentData = getParentData(token);
    const totalDistance = parseInt(token.totalDistance || '0', 10);

    return {
      tokenId: token.tokenId,
      colorIndex,
      referenceColorIndex: parentData?.colorIndex,
      refCount,
      parentRefCount: parentData?.refCount ?? 0,
      hasParent: totalDistance > 0, // Fumi.sol: totalDistance > 0 = has children (being referenced)
    };
  }, [token.tokenId, token.colorIndex, token.refCount, token.totalDistance, token.referringTo]);

  return (
    <div
      ref={setRefs}
      className={cn(
        'collection-item__background',
        shouldRender && 'collection-item__background--visible'
      )}
    >
      {shouldRender && (
        <WaveSVG
          tokenId={waveConfig.tokenId}
          colorIndex={waveConfig.colorIndex}
          referenceColorIndex={waveConfig.referenceColorIndex}
          refCount={waveConfig.refCount}
          parentRefCount={waveConfig.parentRefCount}
          hasParent={waveConfig.hasParent}
          isPaused={isPaused}
          className="w-full h-full"
        />
      )}
    </div>
  );
};

export const CollectionItemBackground = memo(CollectionItemBackgroundComponent);
CollectionItemBackground.displayName = 'CollectionItemBackground';
