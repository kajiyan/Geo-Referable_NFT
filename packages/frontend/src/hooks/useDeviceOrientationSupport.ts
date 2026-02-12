'use client'

import { useState, useEffect } from 'react'

/**
 * Detects if DeviceOrientation API is actually supported and working.
 *
 * Desktop browsers may have the API defined but won't fire events,
 * so we test for actual event firing with a timeout.
 *
 * @returns true if supported, false if not, null while detecting
 */
export function useDeviceOrientationSupport(): boolean | null {
  const [isSupported, setIsSupported] = useState<boolean | null>(null)

  useEffect(() => {
    // Check if API exists
    if (typeof window === 'undefined' || !window.DeviceOrientationEvent) {
      setIsSupported(false)
      return
    }

    let resolved = false

    // Timeout: if no event fires within 1 second, assume desktop
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        setIsSupported(false)
      }
    }, 1000)

    const handler = (e: DeviceOrientationEvent) => {
      // Check if we get actual orientation values (not all null)
      if (!resolved && (e.alpha !== null || e.beta !== null || e.gamma !== null)) {
        resolved = true
        clearTimeout(timeout)
        setIsSupported(true)
        window.removeEventListener('deviceorientation', handler)
      }
    }

    window.addEventListener('deviceorientation', handler)

    return () => {
      clearTimeout(timeout)
      window.removeEventListener('deviceorientation', handler)
    }
  }, [])

  return isSupported
}
