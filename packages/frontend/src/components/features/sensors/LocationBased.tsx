"use client"

import React, { useEffect, useRef, useImperativeHandle, forwardRef, useCallback, useMemo, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { useDispatch, useSelector } from 'react-redux'
import { LocationBased as LocARLocationBased } from 'locar'

import {
  updateGpsPosition,
  setGpsError,
  setGpsActive,
  selectGpsPosition,
  setViewMode,
  setArPermissionDenied,
} from '@/lib/slices/sensorSlice'
import { GPS_CONFIG } from '@/config/gpsConfig'
import { createNativeGpsWatcher, type NativeGpsWatcher } from '@/hooks/useNativeGPS'
import { LocationBasedContext, type LocationBasedContextValue } from './LocationBasedContext'
import { logger } from '@/lib/logger'

/** Map GeolocationPositionError code to a human-readable message */
function gpsErrorMessage(code: number): string {
  switch (code) {
    case 1: return 'Location permission denied'
    case 2: return 'Position unavailable'
    case 3: return 'Location timeout'
    default: return 'Unknown error'
  }
}

interface LocationBasedProps {
  gpsMinDistance?: number
  gpsMinAccuracy?: number
  autoStart?: boolean
  children?: React.ReactNode
}

export interface LocationBasedRef {
  startGps: () => Promise<boolean>
  stopGps: () => boolean
  fakeGps: (lon: number, lat: number, elev?: number | null, acc?: number) => void
}

export const LocationBased = forwardRef<LocationBasedRef, LocationBasedProps>(
  (
    {
      gpsMinDistance = GPS_CONFIG.MIN_DISTANCE_M,
      gpsMinAccuracy = GPS_CONFIG.MIN_ACCURACY_M,
      autoStart = true,
      children,
    },
    ref,
  ) => {
    const { scene, camera } = useThree()
    const dispatch = useDispatch()
    // Get existing GPS from Redux for immediate seeding on re-mount
    const existingGps = useSelector(selectGpsPosition)
    const locationBasedRef = useRef<LocARLocationBased | null>(null)
    const lastPositionRef = useRef<{ lat: number; lon: number } | null>(null)
    const isStartedRef = useRef<boolean>(false)
    const nativeWatchIdRef = useRef<number | null>(null)
    const nativeWatcherRef = useRef<NativeGpsWatcher | null>(null)
    const [isGpsReady, setIsGpsReady] = useState(false)
    const gpsMinAccuracyRef = useRef<number>(gpsMinAccuracy)

    const ensureLocarOrigin = useCallback(
      (longitude: number, latitude: number, altitude: number | null | undefined, accuracy: number | null | undefined): boolean => {
        const locarInstance = locationBasedRef.current
        if (!locarInstance) {
          return false
        }

        try {
          locarInstance.lonLatToWorldCoords(longitude, latitude)
          return true
        } catch (error) {
          const numericAccuracy = typeof accuracy === 'number' && Number.isFinite(accuracy) ? accuracy : null
          if (numericAccuracy == null) {
            return false
          }

          const currentMinAccuracy = gpsMinAccuracyRef.current ?? gpsMinAccuracy
          if (numericAccuracy <= currentMinAccuracy) {
            return false
          }

          const relaxedMinAccuracy = Math.min(
            GPS_CONFIG.INIT_MAX_ACCURACY_M,
            Math.max(currentMinAccuracy, Math.ceil(numericAccuracy)),
          )

          if (relaxedMinAccuracy <= currentMinAccuracy) {
            return false
          }

          gpsMinAccuracyRef.current = relaxedMinAccuracy

          try { locarInstance.setGpsOptions({ gpsMinAccuracy: relaxedMinAccuracy }) } catch {}
          try { locarInstance.fakeGps(longitude, latitude, altitude ?? null, numericAccuracy) } catch {}

          try {
            locarInstance.lonLatToWorldCoords(longitude, latitude)
            return true
          } catch {
            return false
          }
        }
      },
      [gpsMinAccuracy],
    )

    const handleGpsUpdate = useCallback(
      (position: GeolocationPosition | { coords?: GeolocationCoordinates; timestamp?: number }, distanceMoved: number) => {
        const coords: GeolocationCoordinates | undefined = position?.coords
        if (!coords || typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') {
          return
        }
        const { latitude, longitude, altitude, accuracy } = coords

        // Accept the very first fix unconditionally
        const isFirstFix = !lastPositionRef.current
        // Accept when moved enough (fall back to true if distance not provided)
        const movedEnough = typeof distanceMoved === 'number' ? distanceMoved >= gpsMinDistance : true
        // Also accept if coordinates actually changed slightly (robust to provider nuances)
        const changed =
          !lastPositionRef.current ||
          Math.abs(lastPositionRef.current.lat - latitude) > 1e-7 ||
          Math.abs(lastPositionRef.current.lon - longitude) > 1e-7

        if (isFirstFix || movedEnough || changed) {
          lastPositionRef.current = { lat: latitude, lon: longitude }
          dispatch(
            updateGpsPosition({
              latitude,
              longitude,
              altitude: altitude ?? undefined,
              accuracy: typeof accuracy === 'number' ? accuracy : 0,
              timestamp: position.timestamp ?? Date.now(),
              source: 'auto',
            }),
          )
          dispatch(setGpsError(null))

          const hasOrigin = ensureLocarOrigin(longitude, latitude, altitude, typeof accuracy === 'number' ? accuracy : null)
          setIsGpsReady((prev) => (hasOrigin ? (prev ? prev : true) : false))
        }
      },
      [dispatch, ensureLocarOrigin, gpsMinDistance],
    )

    // Start native geolocation watch as a fallback when LocAR fails
    const startNativeWatch = useCallback((): boolean => {
      const watcher = createNativeGpsWatcher(
        (position) => {
          try {
            const coords = position.coords
            if (coords && typeof coords.longitude === 'number' && typeof coords.latitude === 'number') {
              locationBasedRef.current?.fakeGps(coords.longitude, coords.latitude, coords.altitude ?? null, coords.accuracy)
            }
          } catch {}
          handleGpsUpdate(position, Number.MAX_VALUE)
        },
        (code) => {
          dispatch(setGpsError(gpsErrorMessage(code)))
          // Only reset isGpsReady on permission denial (unrecoverable).
          // Transient errors preserve GPS readiness per W3C spec.
          if (code === 1) {
            setIsGpsReady(false)
          }
        },
        { enableHighAccuracy: true, maximumAgeMs: GPS_CONFIG.MAX_WATCH_AGE_MS },
      )
      nativeWatcherRef.current = watcher
      const ok = watcher.start()
      if (ok) {
        nativeWatchIdRef.current = 1
        dispatch(setGpsActive(true))
      }
      return ok
    }, [dispatch, handleGpsUpdate, setIsGpsReady])

    const handleGpsError = useCallback(
      (code: number) => {
        dispatch(setGpsError(gpsErrorMessage(code)))
        // Only reset GPS ready on permission denial (code 1) — unrecoverable.
        // Transient errors (timeout=3, unavailable=2) do NOT terminate watchPosition
        // (per W3C Geolocation spec), so preserve isGpsReady to avoid AR flickering.
        if (code === 1) {
          setIsGpsReady(false)
          console.log('[VIEW_SWITCH] GPS permission denied → fallback to MapView')
          dispatch(setArPermissionDenied(true))
          dispatch(setViewMode('map'))
          return
        }
        // On timeout, fall back to native watch if not already active
        if (code === 3 && nativeWatchIdRef.current == null) {
          try { startNativeWatch() } catch {}
        }
      },
      [dispatch, setIsGpsReady, startNativeWatch],
    )

    const stopNativeWatch = useCallback(() => {
      try { nativeWatcherRef.current?.stop() } catch {}
      nativeWatcherRef.current = null
      nativeWatchIdRef.current = null
    }, [])

    useEffect(() => {
      gpsMinAccuracyRef.current = gpsMinAccuracy
      const locarInstance = locationBasedRef.current
      if (locarInstance) {
        try { locarInstance.setGpsOptions({ gpsMinAccuracy }) } catch {}
      }
    }, [gpsMinAccuracy])

    useEffect(() => {
      let locationBased: LocARLocationBased | null = null
      // Cancel flag prevents stale getCurrentPosition callbacks from firing after unmount
      let cancelled = false

      const init = async () => {
        console.log('[VIEW_SWITCH] LocationBased init start', { hasExistingGps: !!(existingGps?.latitude) })

        try {
          // Check if geolocation is available
          if (!navigator.geolocation) {
            dispatch(setGpsError('Geolocation not supported'))
            return
          }

          // Check if we're in a secure context (HTTPS), but allow localhost exceptions
          if (!window.isSecureContext) {
            const host = window.location.hostname
            const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '::1'
            if (!isLocalhost) {
              dispatch(setGpsError('HTTPS required for location access'))
            }
          }

          locationBased = new LocARLocationBased(scene, camera, {
            gpsMinDistance,
            gpsMinAccuracy,
          })

          gpsMinAccuracyRef.current = gpsMinAccuracy

          locationBased.on('gpsupdate', handleGpsUpdate)
          locationBased.on('gpserror', handleGpsError)

          locationBasedRef.current = locationBased
          console.log('[VIEW_SWITCH] LocAR instance created')

          // Immediate seeding with Redux GPS if available (for fast re-mount)
          if (existingGps && existingGps.latitude && existingGps.longitude) {
            try {
              const seedAcc = existingGps.accuracy ?? 0
              console.log('[VIEW_SWITCH] Redux GPS seed: fakeGps', {
                lon: existingGps.longitude.toFixed(6),
                lat: existingGps.latitude.toFixed(6),
                acc: seedAcc,
              })
              locationBased.fakeGps(
                existingGps.longitude,
                existingGps.latitude,
                existingGps.altitude ?? null,
                seedAcc
              )
              let hasOrigin = ensureLocarOrigin(
                existingGps.longitude,
                existingGps.latitude,
                existingGps.altitude ?? null,
                seedAcc
              )
              console.log('[VIEW_SWITCH] Redux GPS seed: ensureLocarOrigin →', hasOrigin)

              // If seed failed (accuracy too low), retry with maximum relaxed accuracy
              if (!hasOrigin) {
                console.log('[VIEW_SWITCH] Redux GPS seed: retry with relaxed accuracy', GPS_CONFIG.INIT_MAX_ACCURACY_M)
                gpsMinAccuracyRef.current = GPS_CONFIG.INIT_MAX_ACCURACY_M
                try { locationBased.setGpsOptions({ gpsMinAccuracy: GPS_CONFIG.INIT_MAX_ACCURACY_M }) } catch {}
                try {
                  locationBased.fakeGps(
                    existingGps.longitude,
                    existingGps.latitude,
                    existingGps.altitude ?? null,
                    GPS_CONFIG.INIT_MAX_ACCURACY_M
                  )
                } catch {}
                hasOrigin = ensureLocarOrigin(
                  existingGps.longitude,
                  existingGps.latitude,
                  existingGps.altitude ?? null,
                  GPS_CONFIG.INIT_MAX_ACCURACY_M
                )
                console.log('[VIEW_SWITCH] Redux GPS seed: retry result →', hasOrigin)
              }

              if (hasOrigin) {
                console.log('[VIEW_SWITCH] isGpsReady → true (via Redux seed)')
                setIsGpsReady(true)
              }
            } catch (e) {
              logger.warn('LocationBased', 'Failed to seed with Redux GPS', e)
            }
          }

          if (autoStart) {
            // Quick coarse fix using native API to avoid early timeouts
            try {
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  if (cancelled) {
                    console.log('[VIEW_SWITCH] getCurrentPosition callback ignored (cancelled)')
                    return
                  }
                  // Seed LocAR with the first fix before we publish readiness
                  try {
                    const coords = pos.coords
                    if (coords && typeof coords.longitude === 'number' && typeof coords.latitude === 'number') {
                      locationBasedRef.current?.fakeGps(coords.longitude, coords.latitude, coords.altitude ?? null, coords.accuracy)
                    }
                  } catch {}
                  handleGpsUpdate(pos, Number.MAX_VALUE)
                },
                (err) => {
                  if (cancelled) return
                  handleGpsError((err as GeolocationPositionError).code)
                },
                { enableHighAccuracy: false, maximumAge: 30000, timeout: 7000 },
              )
            } catch {}
            // Wait briefly for component to stabilize before starting GPS
            await new Promise(resolve => setTimeout(resolve, GPS_CONFIG.INIT_DELAY_MS))
            if (cancelled) return
            const ok = await locationBased.startGps()
            console.log('[VIEW_SWITCH] startGps() →', ok)
            if (cancelled) return
            isStartedRef.current = ok
            dispatch(setGpsActive(ok))
            if (!ok) {
              // Fallback to native geolocation watch
              const fb = startNativeWatch()
              if (!fb) dispatch(setGpsError('Failed to start GPS'))
            }
          }
        } catch (e) {
          logger.error('LocationBased', 'Initialization failed', e)
          dispatch(setGpsError('Failed to initialize GPS'))
        }
      }

      init()

      return () => {
        console.log('[VIEW_SWITCH] LocationBased cleanup: stopping GPS, clearing refs')
        cancelled = true
        try {
          if (locationBased) {
            // Detach listeners before stopping to avoid stray callbacks during teardown
            ;(locationBased as any).off?.('gpsupdate', handleGpsUpdate)
            ;(locationBased as any).off?.('gpserror', handleGpsError)
            if (isStartedRef.current) {
              locationBased.stopGps()
            }
          }
        } catch (e) {
          // Cleanup error handled silently
        }
        locationBasedRef.current = null
        gpsMinAccuracyRef.current = gpsMinAccuracy
        stopNativeWatch()
        isStartedRef.current = false
        setIsGpsReady(false)
        dispatch(setGpsActive(false))
      }
    // Note: existingGps intentionally excluded from deps - we only want the initial value at mount time
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scene, camera, gpsMinDistance, gpsMinAccuracy, autoStart, handleGpsUpdate, handleGpsError, dispatch, startNativeWatch, stopNativeWatch, setIsGpsReady, ensureLocarOrigin])

    // React to autoStart changes to start/stop GPS without remounting
    useEffect(() => {
      const lb = locationBasedRef.current
      if (!lb) return
      ;(async () => {
        try {
          if (autoStart && !isStartedRef.current && nativeWatchIdRef.current == null) {
            const ok = await lb.startGps()
            isStartedRef.current = ok
            dispatch(setGpsActive(ok))
            if (!ok) {
              const fb = startNativeWatch()
              if (!fb) dispatch(setGpsError('Failed to start GPS'))
            }
          } else if (!autoStart) {
            if (isStartedRef.current) lb.stopGps()
            stopNativeWatch()
            isStartedRef.current = false
            setIsGpsReady(false)
            dispatch(setGpsActive(false))
          }
        } catch (e) {
          // GPS toggle error handled silently
        }
      })()
    }, [autoStart, dispatch, startNativeWatch, stopNativeWatch, setIsGpsReady])

    useImperativeHandle(
      ref,
      () => ({
        startGps: async () => {
          try {
            if (!locationBasedRef.current) {
              return false
            }

            try {
              locationBasedRef.current.setGpsOptions({ gpsMinAccuracy: gpsMinAccuracyRef.current })
            } catch {}

            const ok = await locationBasedRef.current.startGps()
            isStartedRef.current = ok
            dispatch(setGpsActive(ok))
            if (!ok) {
              dispatch(setGpsError('Failed to start GPS'))
            }
            return ok
          } catch (e) {
            isStartedRef.current = false
            dispatch(setGpsActive(false))
            dispatch(setGpsError('Failed to start GPS'))
            return false
          }
        },
        stopGps: () => {
          try {
            if (locationBasedRef.current) {
              dispatch(setGpsActive(false))
              setIsGpsReady(false)
              const stopped = locationBasedRef.current.stopGps()
              isStartedRef.current = false
              return stopped
            }
            return false
          } catch (e) {
            return false
          }
        },
        fakeGps: (lon, lat, elev, acc) => {
          try {
            locationBasedRef.current?.fakeGps(lon, lat, elev, acc)
          } catch (e) {
            // fakeGps error handled silently
          }
        },
      }),
      [dispatch, setIsGpsReady],
    )

    // H3 fix: Remove ref.current from dependency array (refs don't trigger re-renders)
    // isGpsReady is only set to true after locationBasedRef.current is properly initialized,
    // so it serves as the correct trigger for context updates
    const contextValue: LocationBasedContextValue = useMemo(() => ({
      locationBased: locationBasedRef.current,
      lonLatToWorldCoords: (longitude: number, latitude: number): [number, number] => {
        if (!locationBasedRef.current || !isGpsReady) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('LocationBased: lonLatToWorldCoords called before GPS is ready')
          }
          return [0, 0]
        }
        try {
          return locationBasedRef.current.lonLatToWorldCoords(longitude, latitude) as [number, number]
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('LocationBased: lonLatToWorldCoords failed, GPS may not be initialized yet', error)
          }
          return [0, 0]
        }
      },
      isReady: Boolean(locationBasedRef.current) && isGpsReady,
      isGpsReady,
    }), [isGpsReady])

    return (
      <LocationBasedContext.Provider value={contextValue}>
        {children}
      </LocationBasedContext.Provider>
    )
  },
)

LocationBased.displayName = 'LocationBased'

export default LocationBased
