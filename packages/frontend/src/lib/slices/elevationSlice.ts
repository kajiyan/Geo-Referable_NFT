import { createSlice, createAsyncThunk, PayloadAction, isRejected } from '@reduxjs/toolkit'
import { ElevationService } from '../elevation/ElevationService'
import { fetchGSIElevationOnly } from '../elevation/index'
import type { RootState } from '@/lib/store'

export interface ElevationCoordinates {
  lat: number
  lon: number
}

export type ElevationSource = 'api' | 'cache' | 'default' | 'gsi' | 'open-meteo'  // 'default' = fixed fallback for AR

export interface ElevationHistoryEntry {
  coordinates: ElevationCoordinates
  elevation: number
  source: ElevationSource
  timestamp: number
}

export interface ElevationState {
  current: {
    coordinates: ElevationCoordinates | null
    elevation: number | null
    source: ElevationSource | null
    loading: boolean
    error: string | null
  }
  history: ElevationHistoryEntry[]
  // Flag for AR elevation fetch (only fetched once per session)
  hasFetchedForAR: boolean
  arElevationLoading: boolean
}

const initialState: ElevationState = {
  current: {
    coordinates: null,
    elevation: null,
    source: null,
    loading: false,
    error: null,
  },
  history: [],
  hasFetchedForAR: false,
  arElevationLoading: false,
}

/**
 * Helper function to update elevation history
 * Avoids duplicates and maintains max 20 entries
 */
function updateElevationHistory(
  history: ElevationHistoryEntry[],
  entry: ElevationHistoryEntry
): void {
  const existingIndex = history.findIndex(
    (e) =>
      e.coordinates.lat === entry.coordinates.lat &&
      e.coordinates.lon === entry.coordinates.lon
  )

  if (existingIndex >= 0) {
    // Update existing entry
    history[existingIndex] = entry
  } else {
    // Add new entry to the beginning
    history.unshift(entry)
    // Keep only the last 20 entries
    if (history.length > 20) {
      history.splice(20)
    }
  }
}

/**
 * Fetch elevation specifically for AR view.
 * Uses GSI API only with fixed fallback (no Open-Meteo).
 * Only fetches once per session (controlled by hasFetchedForAR flag).
 */
export const fetchElevationForAR = createAsyncThunk(
  'elevation/fetchForAR',
  async (
    { lat, lon }: ElevationCoordinates,
    { signal, rejectWithValue }
  ) => {
    try {
      const result = await fetchGSIElevationOnly(lat, lon, signal)

      return {
        coordinates: { lat, lon },
        elevation: result.elevation,
        source: result.source,
        timestamp: Date.now(),
      }
    } catch (error) {
      if (signal?.aborted) {
        return rejectWithValue('Request was aborted')
      }
      return rejectWithValue((error as Error).message)
    }
  },
  {
    condition: (_, { getState }) => {
      const { elevation } = getState() as { elevation: ElevationState }

      // Only fetch once for AR - skip if already fetched or loading
      if (elevation.hasFetchedForAR || elevation.arElevationLoading) {
        console.log('[elevationSlice] AR elevation fetch skipped: already fetched or loading')
        return false
      }

      return true
    },
  }
)

export const fetchElevation = createAsyncThunk(
  'elevation/fetch',
  async (
    { lat, lon }: ElevationCoordinates,
    { signal, rejectWithValue }
  ) => {
    try {
      const elevationService = new ElevationService()
      const result = await elevationService.getElevationWithFallback(lat, lon, signal)
      
      return {
        coordinates: { lat, lon },
        elevation: result.elevation,
        source: result.source,
        timestamp: Date.now(),
      }
    } catch (error) {
      if (signal?.aborted) {
        return rejectWithValue('Request was aborted')
      }
      return rejectWithValue((error as Error).message)
    }
  },
  {
    condition: ({ lat, lon }, { getState }) => {
      const { elevation } = getState() as { elevation: ElevationState }
      
      // Prevent duplicate requests for the same coordinates
      if (
        elevation.current.loading &&
        elevation.current.coordinates?.lat === lat &&
        elevation.current.coordinates?.lon === lon
      ) {
        return false
      }
      
      return true
    },
  }
)

const elevationSlice = createSlice({
  name: 'elevation',
  initialState,
  reducers: {
    clearCurrentElevation: (state) => {
      state.current = {
        coordinates: null,
        elevation: null,
        source: null,
        loading: false,
        error: null,
      }
    },
    clearHistory: (state) => {
      state.history = []
    },
    removeHistoryEntry: (state, action: PayloadAction<number>) => {
      state.history.splice(action.payload, 1)
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchElevation.pending, (state, action) => {
        state.current.loading = true
        state.current.error = null
        state.current.coordinates = action.meta.arg
      })
      .addCase(fetchElevation.fulfilled, (state, action) => {
        const { coordinates, elevation, source, timestamp } = action.payload

        state.current.loading = false
        state.current.coordinates = coordinates
        state.current.elevation = elevation
        state.current.source = source
        state.current.error = null

        // Add to history using helper function
        updateElevationHistory(state.history, {
          coordinates,
          elevation,
          source,
          timestamp,
        })
      })
      // AR-specific elevation fetch cases
      .addCase(fetchElevationForAR.pending, (state) => {
        state.arElevationLoading = true
        state.current.error = null
      })
      .addCase(fetchElevationForAR.fulfilled, (state, action) => {
        const { coordinates, elevation, source, timestamp } = action.payload

        state.arElevationLoading = false
        state.hasFetchedForAR = true
        state.current.coordinates = coordinates
        state.current.elevation = elevation
        state.current.source = source
        state.current.error = null

        console.log('[elevationSlice] AR elevation fetched:', {
          elevation,
          source,
          coordinates,
        })

        // Add to history using helper function
        updateElevationHistory(state.history, {
          coordinates,
          elevation,
          source,
          timestamp,
        })
      })
      // Common error handling for both thunks
      .addMatcher(
        isRejected(fetchElevation, fetchElevationForAR),
        (state, action) => {
          state.current.loading = false
          state.arElevationLoading = false
          state.current.error =
            (action.payload as string) ||
            action.error.message ||
            'Failed to fetch elevation'
          // Note: hasFetchedForAR is not set to true on error - allowing retry
        }
      )
  },
})

export const { clearCurrentElevation, clearHistory, removeHistoryEntry } = elevationSlice.actions

// Selectors
export const selectElevation = (state: RootState) => state.elevation.current

export const selectElevationValue = (state: RootState): number | null =>
  state.elevation.current.elevation

export const selectElevationLoading = (state: RootState): boolean =>
  state.elevation.current.loading

export const selectElevationError = (state: RootState): string | null =>
  state.elevation.current.error

export const selectHasFetchedForAR = (state: RootState): boolean =>
  state.elevation.hasFetchedForAR

export const selectARElevationLoading = (state: RootState): boolean =>
  state.elevation.arElevationLoading

export const selectElevationHistory = (state: RootState) =>
  state.elevation.history

export default elevationSlice.reducer