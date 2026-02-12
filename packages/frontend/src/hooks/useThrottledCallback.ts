import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

type Callback<Args extends unknown[]> = (...args: Args) => void;

export const useThrottledCallback = <Args extends unknown[]>(
  callback: Callback<Args>,
  delay: number
) => {
  const callbackRef = useRef(callback);
  useIsomorphicLayoutEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const lastCallRef = useRef<number>(0);
  const trailingRef = useRef<Args | undefined>(undefined);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback<Callback<Args>>((...args: Args) => {
    const timestamp = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const now = timestamp;
    const timeSinceLast = now - lastCallRef.current;

    const invoke = () => {
      lastCallRef.current = typeof performance !== 'undefined' ? performance.now() : Date.now();
      callbackRef.current(...(trailingRef.current ?? args));
      trailingRef.current = undefined;
    };

    if (lastCallRef.current === 0 || timeSinceLast >= delay) {
      invoke();
      return;
    }

    trailingRef.current = args;

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(invoke, delay - timeSinceLast);
  }, [delay]);
};
