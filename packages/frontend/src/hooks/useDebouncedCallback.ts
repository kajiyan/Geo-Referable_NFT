import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

type Callback<Args extends unknown[]> = (...args: Args) => void;

export const useDebouncedCallback = <Args extends unknown[]>(
  callback: Callback<Args>,
  delay: number
) => {
  const callbackRef = useRef(callback);
  useIsomorphicLayoutEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback<Callback<Args>>((...args: Args) => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => callbackRef.current(...args), delay);
  }, [delay]);
};
