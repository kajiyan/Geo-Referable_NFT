import { useState, useEffect } from 'react';

/**
 * Hook to track viewport height with debounced resize handling
 *
 * This ensures that components using viewport height re-render
 * when the window is resized, with debouncing to prevent excessive updates.
 *
 * @param debounceMs - Milliseconds to debounce resize events (default: 100)
 * @returns Current viewport height in pixels
 *
 * @example
 * ```tsx
 * const viewportHeight = useViewportHeight(100);
 *
 * // viewportHeight updates on window resize with 100ms debounce
 * ```
 */
export function useViewportHeight(debounceMs: number = 100): number {
  const [height, setHeight] = useState(() =>
    typeof window !== 'undefined' ? window.innerHeight : 1000
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const handleResize = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setHeight(window.innerHeight);
      }, debounceMs);
    };

    window.addEventListener('resize', handleResize);

    // Initial measurement (in case SSR value differs)
    setHeight(window.innerHeight);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [debounceMs]);

  return height;
}
