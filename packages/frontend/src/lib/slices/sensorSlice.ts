import { createSlice, PayloadAction, createSelector, createAsyncThunk } from '@reduxjs/toolkit'
import type { RootState } from '@/lib/store'

export interface GpsPosition {
  latitude: number
  longitude: number
  altitude?: number
  accuracy: number
  timestamp: number
  source?: 'auto' | 'manual'
}

export interface DeviceOrientation {
  alpha: number | null
  beta: number | null
  gamma: number | null
  timestamp: number
}

export type ViewMode = 'map' | 'ar'
export type CardinalDirection = 'north' | 'south' | 'east' | 'west'

export interface DirectionalObject {
  direction: CardinalDirection
  position: [number, number, number]
  distance: number
  visible: boolean
  color: string
  name: string
}

export interface ArObjectState {
  directionalObjects: DirectionalObject[]
  objectsVisible: boolean
  displayDistance: number
}

export interface MapViewport {
  longitude: number
  latitude: number
  zoom: number
}

export interface SensorState {
  gpsPosition: GpsPosition | null
  deviceOrientation: DeviceOrientation | null
  gpsError: string | null
  orientationError: string | null
  isGpsActive: boolean
  isOrientationActive: boolean
  isFetchingLocation: boolean
  viewMode: ViewMode
  arObjects: ArObjectState
  /** Flag to request map centering animation (set by dialog, cleared by map) */
  shouldCenterMap: boolean
  /** Last known MapComponent viewport for restoration on remount */
  lastMapViewport: MapViewport | null
  /** Whether AR permissions were denied (GPS, camera, or orientation) */
  arPermissionDenied: boolean
}

const initialState: SensorState = {
  gpsPosition: null,
  deviceOrientation: null,
  gpsError: null,
  orientationError: null,
  isGpsActive: false,
  isOrientationActive: false,
  isFetchingLocation: false,
  viewMode: 'map',
  shouldCenterMap: false,
  lastMapViewport: null,
  arPermissionDenied: false,
  arObjects: {
    directionalObjects: [
      { direction: 'north', position: [0, 0, 0], distance: 50, visible: true, color: '#ff6b6b', name: 'North' },
      { direction: 'south', position: [0, 0, 0], distance: 50, visible: true, color: '#ffd93d', name: 'South' },
      { direction: 'east', position: [0, 0, 0], distance: 50, visible: true, color: '#6bcf7f', name: 'East' },
      { direction: 'west', position: [0, 0, 0], distance: 50, visible: true, color: '#6b9cff', name: 'West' },
    ],
    objectsVisible: true,
    displayDistance: 50,
  },
}

// Development fallback location (Tokyo Station)
// Only used when geolocation completely fails in development
const DEV_FALLBACK_LOCATION: GpsPosition = {
  latitude: 35.681236,
  longitude: 139.767125,
  altitude: undefined,
  accuracy: 1000, // Low accuracy to indicate it's fallback
  timestamp: Date.now(),
  source: 'manual',
}

// Async thunk for fetching current location manually
export const fetchCurrentLocation = createAsyncThunk(
  'sensor/fetchCurrentLocation',
  async (_, { rejectWithValue }) => {
    return new Promise<GpsPosition>((resolve, reject) => {
      if (!navigator.geolocation) {
        return reject(new Error('Geolocation is not supported by your browser'))
      }

      // First attempt with high accuracy (GPS)
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            altitude: position.coords.altitude ?? undefined,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
            source: 'manual',
          })
        },
        (error) => {
          // If high accuracy fails, try with lower accuracy (Wi-Fi/IP)
          console.warn('High accuracy geolocation failed, trying low accuracy:', error.message)

          navigator.geolocation.getCurrentPosition(
            (position) => {
              resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                altitude: position.coords.altitude ?? undefined,
                accuracy: position.coords.accuracy,
                timestamp: position.timestamp,
                source: 'manual',
              })
            },
            (fallbackError) => {
              // In development, use fallback location if all methods fail
              if (process.env.NODE_ENV === 'development') {
                console.warn('All geolocation methods failed. Using development fallback location (Tokyo Station).')
                resolve({
                  ...DEV_FALLBACK_LOCATION,
                  timestamp: Date.now(),
                })
              } else {
                const errorMessages: Record<number, string> = {
                  1: 'Location permission denied. Please enable location access in your browser settings.',
                  2: 'Location information unavailable. Please check your device settings and ensure location services are enabled.',
                  3: 'Location request timed out. Please try again.',
                }
                reject(new Error(errorMessages[fallbackError.code] || fallbackError.message))
              }
            },
            {
              enableHighAccuracy: false, // Use network-based location
              timeout: 15000,
              maximumAge: 60000, // Allow cached location up to 1 minute old
            }
          )
        },
        {
          enableHighAccuracy: true,
          timeout: 15000, // Increased from 10s to 15s
          maximumAge: 0,
        }
      )
    }).catch((error) => {
      return rejectWithValue(error.message)
    })
  }
)

const sensorSlice = createSlice({
  name: 'sensor',
  initialState,
  reducers: {
    updateGpsPosition: (state, action: PayloadAction<GpsPosition>) => {
      state.gpsPosition = action.payload
      state.gpsError = null
    },
    setGpsError: (state, action: PayloadAction<string | null>) => {
      state.gpsError = action.payload
      // Preserve last known gpsPosition on transient errors (timeout, unavailable)
      // so that mint button and map remain functional with stale-but-valid data.
      // Only clear position on explicit permission denial (no recovery possible).
    },
    setGpsActive: (state, action: PayloadAction<boolean>) => {
      state.isGpsActive = action.payload
    },

    updateDeviceOrientation: (state, action: PayloadAction<DeviceOrientation>) => {
      state.deviceOrientation = action.payload
      state.orientationError = null
    },
    setOrientationError: (state, action: PayloadAction<string | null>) => {
      state.orientationError = action.payload
    },
    setOrientationActive: (state, action: PayloadAction<boolean>) => {
      state.isOrientationActive = action.payload
    },

    setViewMode: (state, action: PayloadAction<ViewMode>) => {
      state.viewMode = action.payload
    },

    updateDirectionalObjectPositions: (state, action: PayloadAction<DirectionalObject[]>) => {
      state.arObjects.directionalObjects = action.payload
    },

    /** Request map to center on current GPS position */
    requestMapCenter: (state) => {
      state.shouldCenterMap = true
    },

    /** Clear the map center request (called by map after animation) */
    clearMapCenterRequest: (state) => {
      state.shouldCenterMap = false
    },

    /** Save last MapComponent viewport for restoration on remount */
    setLastMapViewport: (state, action: PayloadAction<MapViewport>) => {
      state.lastMapViewport = action.payload
    },

    /** Mark AR as denied due to permission rejection */
    setArPermissionDenied: (state, action: PayloadAction<boolean>) => {
      state.arPermissionDenied = action.payload
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCurrentLocation.pending, (state) => {
        state.isFetchingLocation = true
        state.gpsError = null
      })
      .addCase(fetchCurrentLocation.fulfilled, (state, action) => {
        state.gpsPosition = action.payload
        state.isFetchingLocation = false
        state.gpsError = null
      })
      .addCase(fetchCurrentLocation.rejected, (state, action) => {
        state.isFetchingLocation = false
        state.gpsError = action.payload as string
      })
  },
})

export const {
  updateGpsPosition,
  setGpsError,
  setGpsActive,
  updateDeviceOrientation,
  setOrientationError,
  setOrientationActive,
  setViewMode,
  updateDirectionalObjectPositions,
  requestMapCenter,
  clearMapCenterRequest,
  setLastMapViewport,
  setArPermissionDenied,
} = sensorSlice.actions

export const selectGpsPosition = (state: RootState): GpsPosition | null => 
  state.sensor?.gpsPosition ?? null

export const selectDeviceOrientation = (state: RootState): DeviceOrientation | null => 
  state.sensor?.deviceOrientation ?? null

export const selectViewMode = (state: RootState): ViewMode => 
  state.sensor?.viewMode ?? 'map'

export const selectSensorErrors = createSelector(
  [
    (state: RootState) => state.sensor?.gpsError ?? null,
    (state: RootState) => state.sensor?.orientationError ?? null,
  ],
  (gps, orientation) => ({ gps, orientation }),
)

export const selectSensorStatus = createSelector(
  [
    (state: RootState) => Boolean(state.sensor?.isGpsActive),
    (state: RootState) => Boolean(state.sensor?.isOrientationActive),
  ],
  (isGpsActive, isOrientationActive) => ({ isGpsActive, isOrientationActive }),
)

export const selectArObjectsState = createSelector(
  [
    (state: RootState) => state.sensor?.arObjects.directionalObjects ?? [],
    (state: RootState) => state.sensor?.arObjects.objectsVisible ?? false,
    (state: RootState) => state.sensor?.arObjects.displayDistance ?? 50,
  ],
  (directionalObjects, objectsVisible, displayDistance) => ({
    directionalObjects,
    objectsVisible,
    displayDistance,
  }),
)

export const selectIsFetchingLocation = (state: RootState): boolean =>
  state.sensor?.isFetchingLocation ?? false

export const selectGpsError = (state: RootState): string | null =>
  state.sensor?.gpsError ?? null

export const selectShouldCenterMap = (state: RootState): boolean =>
  state.sensor?.shouldCenterMap ?? false

export const selectLastMapViewport = (state: RootState): MapViewport | null =>
  state.sensor?.lastMapViewport ?? null

export const selectArPermissionDenied = (state: RootState): boolean =>
  state.sensor?.arPermissionDenied ?? false

export default sensorSlice.reducer
