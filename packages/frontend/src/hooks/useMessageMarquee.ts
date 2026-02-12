/**
 * Shared hook for calculating marquee animation parameters
 * Used by HistoryItem and CollectionItem components
 *
 * Features:
 * - Measures text width at runtime
 * - Handles SSR with useIsomorphicLayoutEffect
 * - Retries measurement if initial width is 0
 * - Observes element resize with ResizeObserver
 * - Waits for fonts to load
 *
 * @see packages/frontend/src/components/features/History/HistoryItem.tsx
 * @see packages/frontend/src/components/features/CollectionItem/CollectionItem.tsx
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export interface MessageMarqueeOptions {
  gap: number;
  viewportLength: number;
  text: string;
}

export function useMessageMarquee<T extends HTMLElement>(
  targetRef: RefObject<T | null>,
  { gap, viewportLength, text }: MessageMarqueeOptions
) {
  const [unitWidth, setUnitWidth] = useState(0);
  const retryTimerRef = useRef<number | null>(null);

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const measure = useCallback(() => {
    if (typeof window === 'undefined') return;
    clearRetryTimer();

    const span = targetRef.current;
    if (!span) return;

    const prevWidth = span.style.width;
    span.style.width = 'auto';

    const rawWidth = span.scrollWidth || span.getBoundingClientRect().width;
    span.style.width = prevWidth;

    const width = Math.ceil(rawWidth);
    if (width > 0) {
      setUnitWidth((prev) => (prev !== width ? width : prev));
    } else {
      retryTimerRef.current = window.setTimeout(() => {
        if (!targetRef.current) return;
        const retryWidth = Math.ceil(
          targetRef.current.scrollWidth || targetRef.current.getBoundingClientRect().width
        );
        if (retryWidth > 0) {
          setUnitWidth((prev) => (prev !== retryWidth ? retryWidth : prev));
        }
      }, 50);
    }
  }, [clearRetryTimer, targetRef]);

  useIsomorphicLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    measure();
    const id = window.setTimeout(measure, 0);
    return () => clearTimeout(id);
  }, [measure, text]);

  useEffect(() => {
    const span = targetRef.current;
    if (!span) return;

    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => measure());
      ro.observe(span);
    }

    const handleResize = () => measure();
    window.addEventListener('resize', handleResize);

    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [measure, targetRef]);

  useEffect(() => {
    let cancelled = false;
    const waitForFonts = async () => {
      if (!document.fonts || !document.fonts.ready) return;
      try {
        await document.fonts.ready;
        if (!cancelled) measure();
      } catch {
        if (!cancelled) {
          setTimeout(measure, 100);
        }
      }
    };

    waitForFonts();

    return () => {
      cancelled = true;
      clearRetryTimer();
    };
  }, [clearRetryTimer, measure]);

  const ready = unitWidth > 0;
  const contentBase = Math.max(1, unitWidth);
  const period = contentBase + gap;

  const repeatCount = useMemo(() => {
    if (!unitWidth) return 1;
    const needed = Math.ceil(viewportLength / period) + 3;
    return Math.max(4, needed);
  }, [period, unitWidth, viewportLength]);

  return {
    period,
    ready,
    repeatCount,
  };
}
