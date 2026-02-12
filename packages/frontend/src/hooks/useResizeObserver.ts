import { useEffect, useState, RefObject } from 'react';

export interface ResizeObserverDimensions {
  width: number;
  height: number;
}

/**
 * ResizeObserver を使用してエレメントのサイズを監視
 * CSS calc() 式の解決後の実際のピクセル値を取得可能
 *
 * @param ref - 監視対象の要素への RefObject
 * @returns { width, height } - 要素の現在のサイズ（初期値は 0）
 *
 * @example
 * ```tsx
 * const containerRef = useRef<HTMLDivElement>(null);
 * const { height: containerHeight } = useResizeObserver(containerRef);
 * ```
 */
export function useResizeObserver(
  ref: RefObject<HTMLElement | null>
): ResizeObserverDimensions {
  const [dimensions, setDimensions] = useState<ResizeObserverDimensions>({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    if (!ref.current) return;

    const element = ref.current;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        if (width > 0 || height > 0) {
          setDimensions({ width, height });
        }
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return dimensions;
}
