import { GPS_CONFIG } from '@/config/gpsConfig'

export interface NativeGpsWatcherOptions {
  enableHighAccuracy?: boolean
  maximumAgeMs?: number
}

export interface NativeGpsWatcher {
  start: () => boolean
  stop: () => void
  isActive: () => boolean
}

export function createNativeGpsWatcher(
  onUpdate: (position: GeolocationPosition) => void,
  onError: (code: number) => void,
  options?: NativeGpsWatcherOptions,
): NativeGpsWatcher {
  let watchId: number | null = null
  const settings = {
    enableHighAccuracy: options?.enableHighAccuracy ?? true,
    maximumAge: options?.maximumAgeMs ?? GPS_CONFIG.MAX_WATCH_AGE_MS,
  }

  const start = (): boolean => {
    if (!navigator.geolocation) {
      onError(2)
      return false
    }
    try {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          try {
            onUpdate(position)
          } catch {}
        },
        (err) => {
          onError((err as GeolocationPositionError).code)
        },
        settings,
      ) as unknown as number
      return true
    } catch {
      onError(2)
      return false
    }
  }

  const stop = () => {
    if (watchId != null) {
      try { navigator.geolocation.clearWatch(watchId) } catch {}
      watchId = null
    }
  }

  const isActive = () => watchId != null

  return { start, stop, isActive }
}


