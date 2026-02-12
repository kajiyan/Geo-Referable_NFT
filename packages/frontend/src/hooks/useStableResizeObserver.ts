import { useEffect, useState, useRef, RefObject } from 'react';
import { logger } from '@/lib/logger';

export interface StableResizeObserverDimensions {
  width: number;
  height: number;
  /** Whether the dimensions have stabilized (no changes for debounce period) */
  isStable: boolean;
}

/**
 * Debounced ResizeObserver hook that waits for dimensions to stabilize
 *
 * This is useful when measuring elements that have asynchronous layout
 * (e.g., Swiper components that initialize after render).
 *
 * @param ref - RefObject to the element to observe
 * @param debounceMs - Milliseconds to wait for dimensions to stabilize (default: 150)
 * @returns Dimensions and stability status
 *
 * @example
 * ```tsx
 * const contentRef = useRef<HTMLElement>(null);
 * const { height, isStable } = useStableResizeObserver(contentRef, 200);
 *
 * // Only use height when stable
 * const stableHeight = isStable ? height : 0;
 * ```
 */
export function useStableResizeObserver(
  ref: RefObject<HTMLElement | null>,
  debounceMs: number = 150
): StableResizeObserverDimensions {
  const [dimensions, setDimensions] = useState<StableResizeObserverDimensions>({
    width: 0,
    height: 0,
    isStable: false,
  });

  // Track when the element becomes available
  // This forces the effect to re-run when ref.current changes from null to element
  const [element, setElement] = useState<HTMLElement | null>(null);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDimensionsRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });

  // Check for ref.current changes using requestAnimationFrame
  // This is necessary because ref.current changes don't trigger re-renders
  useEffect(() => {
    let rafId: number;
    let attempts = 0;
    const maxAttempts = 50; // ~830ms at 60fps

    const checkRef = () => {
      if (ref.current && ref.current !== element) {
        setElement(ref.current);
      } else if (!ref.current && attempts < maxAttempts) {
        attempts++;
        rafId = requestAnimationFrame(checkRef);
      }
    };

    checkRef();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [ref, element]);

  // Get element identifier for logging
  const getElementId = (el: HTMLElement | null): string => {
    if (!el) return 'null';
    if (el.id) return `#${el.id}`;
    if (el.className) return `.${el.className.split(' ')[0]}`;
    return el.tagName.toLowerCase();
  };

  useEffect(() => {
    if (!element) return;

    const elementId = getElementId(element);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      const { width, height } = entry.contentRect;
      if (width <= 0 && height <= 0) return;

      // Check if dimensions actually changed
      const changed =
        width !== lastDimensionsRef.current.width ||
        height !== lastDimensionsRef.current.height;

      if (!changed) return;

      logger.debug('RESIZE', `${elementId}: ${lastDimensionsRef.current.height} -> ${height}px (unstable)`);

      // Update last known dimensions
      lastDimensionsRef.current = { width, height };

      // Clear previous timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Mark as unstable immediately when dimensions change
      setDimensions((prev) => ({
        ...prev,
        width,
        height,
        isStable: false,
      }));

      // Set new timeout to mark as stable
      timeoutRef.current = setTimeout(() => {
        logger.debug('RESIZE', `${elementId}: ${height}px (STABLE after ${debounceMs}ms)`);
        setDimensions((prev) => ({
          ...prev,
          isStable: true,
        }));
      }, debounceMs);
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [element, debounceMs]);

  return dimensions;
}
