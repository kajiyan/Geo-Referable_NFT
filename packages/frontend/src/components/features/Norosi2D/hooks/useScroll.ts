/**
 * @fileoverview useScroll hook - Manages scroll-based view positioning
 * Converted from ScrollManager class to React hook
 */

import { useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import type paper from 'paper';
import { logger } from '@/lib/logger';

/**
 * Hook return type for scroll management
 */
export interface UseScrollReturn {
  /** Manually trigger scroll update */
  update: () => void;
  /** Sets view center Y and calculates corresponding scroll position */
  setViewCenterYAndScroll: (targetY: number) => void;
}

/**
 * Hook to manage scroll-based view positioning for the canvas
 *
 * @param paperScope - Paper.js scope instance
 * @param scrollTargetSelector - CSS selector for scroll target element (null for body scroll)
 * @param totalHeightRatio - Sum of all height ratios
 * @param containerHeight - Container element height
 * @param disabled - When true, disables scroll sync and body height modification (for modal use)
 * @returns Scroll management functions
 *
 * @remarks
 * Synchronizes Paper.js view center with scroll position or element viewport position
 * Supports both body scroll and element-based scroll synchronization
 */
export function useScroll(
  paperScope: typeof paper | null,
  scrollTargetSelector: string | null,
  totalHeightRatio: number,
  containerHeight: number,
  disabled: boolean = false
): UseScrollReturn {
  const initialViewCenterRef = useRef<paper.Point | null>(null);

  // Ref to store current totalHeightRatio to avoid stale closure in event handlers
  // This solves the issue where handleScroll captures an old value when the ratio changes
  const totalHeightRatioRef = useRef(totalHeightRatio);

  // Sync ref with current value on every render
  useLayoutEffect(() => {
    totalHeightRatioRef.current = totalHeightRatio;
  }, [totalHeightRatio]);

  /**
   * Handles scroll events
   */
  const handleScroll = useCallback((): void => {
    if (!paperScope || !paperScope.view) return;

    // Read from ref to avoid stale closure
    const currentTotalHeightRatio = totalHeightRatioRef.current;

    const canvasHeight = paperScope.view.size.height;
    const viewportHeight = window.innerHeight;

    logger.debug('SCROLL', `handleScroll: totalHeightRatio=${currentTotalHeightRatio.toFixed(3)}, canvasHeight=${canvasHeight.toFixed(0)}, viewportHeight=${viewportHeight}`);

    // Use scroll target element if specified
    if (scrollTargetSelector) {
      const element = document.querySelector(scrollTargetSelector);
      if (!element) {
        console.warn(`Scroll target element "${scrollTargetSelector}" not found`);
        return;
      }

      const scrollTop = element.scrollTop;
      const scrollHeight = element.scrollHeight;
      const clientHeight = element.clientHeight;
      const maxGridScroll = scrollHeight - clientHeight;

      // Auto-detect scroll mode:
      // - If element has internal scroll (scrollHeight > clientHeight), use element scroll mode
      // - Otherwise, use viewport-relative mode (track element position in viewport)
      const hasInternalScroll = maxGridScroll > 0;

      logger.debug('SCROLL', `Element: scrollHeight=${scrollHeight}, clientHeight=${clientHeight}, maxGridScroll=${maxGridScroll}, hasInternalScroll=${hasInternalScroll}`);

      // Canvas content height based on totalHeightRatio
      const canvasContentHeight = currentTotalHeightRatio * canvasHeight;

      // Offset for centering if content is smaller than viewport
      const offsetY = Math.max(0, (1.0 - currentTotalHeightRatio) * canvasHeight);

      if (hasInternalScroll) {
        // === Element Scroll Mode ===
        // Used by HistoryGrid where the element itself is scrollable

        // If canvas content fits in view (no panning needed)
        if (canvasContentHeight <= canvasHeight) {
          const centerY = offsetY + canvasContentHeight / 2;
          if (initialViewCenterRef.current) {
            paperScope.view.center = new paperScope.Point(
              initialViewCenterRef.current.x,
              centerY
            );
          }
          return;
        }

        // Calculate max canvas view offset
        const maxCanvasOffset = canvasContentHeight - canvasHeight;

        // Map grid scroll to canvas scroll
        // For column-reverse: scrollTop ranges from -maxGridScroll to 0
        // scrollTop=0 → see bottom of canvas (generation 0)
        // scrollTop=-maxGridScroll → see top of canvas (highest generation)
        // Use Math.abs() to handle negative scrollTop in column-reverse layouts
        const scrollRatio = Math.abs(scrollTop) / maxGridScroll;

        // Bottom-anchored view center calculation:
        // At scrollRatio=0: view shows bottom of canvas → center at high Y
        // At scrollRatio=1: view shows top of canvas → center at low Y
        const bottomCenterY = offsetY + canvasContentHeight - canvasHeight / 2;
        const targetY = bottomCenterY - scrollRatio * maxCanvasOffset;

        // Update view center
        if (initialViewCenterRef.current) {
          paperScope.view.center = new paperScope.Point(
            initialViewCenterRef.current.x,
            targetY
          );
        }
      } else {
        // === Viewport-Relative Mode ===
        // Used when element doesn't have internal scroll
        // Tracks element position in viewport as body scrolls
        const rect = element.getBoundingClientRect();
        const elementHeight = rect.height;
        const canvasRange = currentTotalHeightRatio * canvasHeight;

        // === Fixed Alignment Mode ===
        // When element height equals canvas height (content fits exactly),
        // use fixed positioning to ensure proper alignment.
        // This prevents the gradient from extending past the grid boundaries.
        if (Math.abs(elementHeight - canvasHeight) < 1) {
          const targetY = canvasHeight / 2;
          if (initialViewCenterRef.current) {
            paperScope.view.center = new paperScope.Point(
              initialViewCenterRef.current.x,
              targetY
            );
          }
          return;
        }

        // === Dynamic Viewport-Relative Mode ===
        // For elements that don't fill the viewport exactly,
        // track element position as body scrolls
        //
        // Uses 1:1 mapping between DOM position and canvas position:
        // - activeStart: starting point for active scrolling range
        // - activeRange: the range over which scrolling affects canvas view
        // - progress: how far through the active range we are
        // - targetY: directly mapped to canvas content position

        // Calculate viewport center position within the element
        const viewportCenter = viewportHeight / 2;
        const centerPositionInElement = viewportCenter - rect.top;

        // Define the active range: starts at max(0, elementHeight - canvasRange), length = canvasRange (1:1 mapping)
        // This ensures DOM scroll maps directly to canvas content scroll
        const activeStart = Math.max(0, elementHeight - canvasRange);
        const activeRange = canvasRange;

        // Map active range to canvas range (1:1 mapping)
        // When centerPositionInElement is at activeStart, we're at the top of canvas content
        // When centerPositionInElement is at activeStart + canvasRange, we're at the bottom
        const progress = (centerPositionInElement - activeStart) / activeRange;
        const targetY = offsetY + progress * canvasRange;

        logger.debug('SCROLL', `Dynamic Mode: centerInElement=${centerPositionInElement.toFixed(0)}, activeStart=${activeStart.toFixed(0)}, activeRange=${activeRange.toFixed(0)}, progress=${progress.toFixed(3)}, offsetY=${offsetY.toFixed(0)}, targetY=${targetY.toFixed(0)}`);

        // Update view center (no clamping to allow blank states at edges)
        if (initialViewCenterRef.current) {
          paperScope.view.center = new paperScope.Point(
            initialViewCenterRef.current.x,
            targetY
          );
        }
      }
    } else {
      // Traditional scroll-based calculation
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const maxScroll = document.documentElement.scrollHeight - viewportHeight;

      // Calculate scroll progress (0.0 to 1.0)
      const scrollProgress = maxScroll > 0 ? scrollTop / maxScroll : 0;

      // Calculate view offset
      const totalScrollHeight = (currentTotalHeightRatio - 1.0) * canvasHeight;
      const offsetY = totalScrollHeight * scrollProgress;

      // Update view center
      if (initialViewCenterRef.current) {
        paperScope.view.center = new paperScope.Point(
          initialViewCenterRef.current.x,
          initialViewCenterRef.current.y + offsetY
        );
      }
    }
  }, [paperScope, scrollTargetSelector]); // totalHeightRatio is read from ref to avoid stale closure

  /**
   * Sets view center Y and calculates corresponding scroll position
   */
  const setViewCenterYAndScroll = useCallback((targetY: number): void => {
    if (!paperScope || !paperScope.view) return;

    // Read from ref to avoid stale closure
    const currentTotalHeightRatio = totalHeightRatioRef.current;

    const canvasHeight = paperScope.view.size.height;

    // If using scroll target element, just set view center
    if (scrollTargetSelector) {
      const offsetY = Math.max(0, (1.0 - currentTotalHeightRatio) * canvasHeight);
      const minY = offsetY;
      const maxY = offsetY + currentTotalHeightRatio * canvasHeight;
      const clampedY = Math.max(minY, Math.min(maxY, targetY));

      paperScope.view.center = new paperScope.Point(
        paperScope.view.center.x,
        clampedY
      );
      return;
    }

    // Traditional scroll-based mode
    const minY = canvasHeight / 2;
    const maxY = canvasHeight / 2 + (currentTotalHeightRatio - 1.0) * canvasHeight;
    const clampedY = Math.max(minY, Math.min(maxY, targetY));

    // Set view center
    paperScope.view.center = new paperScope.Point(
      paperScope.view.center.x,
      clampedY
    );

    // Calculate corresponding scroll position
    const offsetY = clampedY - canvasHeight / 2;
    const totalScrollHeight = (currentTotalHeightRatio - 1.0) * canvasHeight;
    const scrollProgress = totalScrollHeight > 0 ? offsetY / totalScrollHeight : 0;
    const viewportHeight = window.innerHeight;
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - viewportHeight);
    const scrollTop = maxScroll * scrollProgress;

    // Scroll to position
    window.scrollTo(0, scrollTop);
  }, [paperScope, scrollTargetSelector]); // totalHeightRatio is read from ref to avoid stale closure

  /**
   * Manually trigger scroll update
   */
  const update = useCallback((): void => {
    handleScroll();
  }, [handleScroll]);

  // Initialize and attach scroll listener
  useEffect(() => {
    // Early return if disabled or no paper scope
    if (disabled || !paperScope || !paperScope.view) return;

    logger.debug('SCROLL', `Initializing: totalHeightRatio=${totalHeightRatio.toFixed(3)}, containerHeight=${containerHeight}, scrollTargetSelector=${scrollTargetSelector}`);

    // Store initial view center
    initialViewCenterRef.current = paperScope.view.center.clone();

    // Track if we modified body height (for cleanup)
    let modifiedBodyHeight = false;

    // Only set body height if not using scroll target element
    if (!scrollTargetSelector) {
      document.body.style.height = `${totalHeightRatio * containerHeight}px`;
      modifiedBodyHeight = true;
    }

    // Apply initial scroll position
    handleScroll();

    // Attach scroll event listener to appropriate target
    if (scrollTargetSelector) {
      const element = document.querySelector(scrollTargetSelector);
      if (element) {
        // Auto-detect scroll mode based on element's scrollability
        const hasInternalScroll = element.scrollHeight > element.clientHeight;

        if (hasInternalScroll) {
          // Element Scroll Mode: listen to element's scroll events
          element.addEventListener('scroll', handleScroll, { passive: true });
          return () => {
            element.removeEventListener('scroll', handleScroll);
            // Reset body height if we modified it
            if (modifiedBodyHeight) {
              document.body.style.height = '';
            }
          };
        } else {
          // Viewport-Relative Mode: listen to window scroll
          window.addEventListener('scroll', handleScroll, { passive: true });
          return () => {
            window.removeEventListener('scroll', handleScroll);
            // Reset body height if we modified it
            if (modifiedBodyHeight) {
              document.body.style.height = '';
            }
          };
        }
      }
    }

    // Fallback to window scroll (no scrollTargetSelector)
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Cleanup
    return () => {
      window.removeEventListener('scroll', handleScroll);
      // Reset body height if we modified it
      if (modifiedBodyHeight) {
        document.body.style.height = '';
      }
    };
  }, [disabled, paperScope, scrollTargetSelector, totalHeightRatio, containerHeight, handleScroll]);

  // Trigger scroll recalculation when totalHeightRatio changes
  // This ensures the view is updated immediately when heights change (e.g., after data loads)
  useEffect(() => {
    if (disabled || !paperScope?.view) {
      return; // No cleanup needed
    }

    logger.debug('SCROLL', `totalHeightRatio changed: ${totalHeightRatio.toFixed(3)} - triggering scroll recalculation`);

    // Use requestAnimationFrame to ensure the layout is stable
    const frameId = requestAnimationFrame(() => {
      handleScroll();
    });
    return () => cancelAnimationFrame(frameId);
  }, [totalHeightRatio, disabled, paperScope, handleScroll]);

  return {
    update,
    setViewCenterYAndScroll,
  };
}
