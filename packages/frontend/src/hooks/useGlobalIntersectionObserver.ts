import { useEffect, useRef, useCallback } from 'react'

class GlobalIntersectionManager {
  private static instance: GlobalIntersectionManager
  private observer: IntersectionObserver
  private callbacks = new WeakMap<Element, (visible: boolean) => void>()
  private observedElements = new Set<Element>()

  private constructor() {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const callback = this.callbacks.get(entry.target)
          if (callback) {
            callback(entry.isIntersecting)
          }
        })
      },
      {
        root: null,
        rootMargin: '50px',
        threshold: [0, 0.1, 0.5, 1.0]
      }
    )
  }

  static getInstance(): GlobalIntersectionManager {
    if (!GlobalIntersectionManager.instance) {
      GlobalIntersectionManager.instance = new GlobalIntersectionManager()
    }
    return GlobalIntersectionManager.instance
  }

  observe(element: Element, callback: (visible: boolean) => void): void {
    this.callbacks.set(element, callback)
    this.observedElements.add(element)
    this.observer.observe(element)
  }

  unobserve(element: Element): void {
    this.callbacks.delete(element)
    this.observedElements.delete(element)
    this.observer.unobserve(element)
  }

  getObservedCount(): number {
    return this.observedElements.size
  }
}

export function useGlobalIntersectionObserver(
  elementRef: React.RefObject<Element>,
  callback: (visible: boolean) => void,
  enabled: boolean = true
): void {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  const stableCallback = useCallback((visible: boolean) => {
    callbackRef.current(visible)
  }, [])

  useEffect(() => {
    if (!enabled || !elementRef.current) return

    const element = elementRef.current
    const manager = GlobalIntersectionManager.getInstance()

    manager.observe(element, stableCallback)

    return () => {
      manager.unobserve(element)
    }
  }, [elementRef, stableCallback, enabled])
}

// Hook to get performance stats for debugging
export function useIntersectionObserverStats(): { observedCount: number } {
  const manager = GlobalIntersectionManager.getInstance()
  return {
    observedCount: manager.getObservedCount()
  }
}